// Entrar com digital/rosto (passkey / WebAuthn) na Matriz — cliente e dono.
// A digital nunca sai do celular: aqui fica só a chave pública do aparelho
// (vb_cliente_passkeys / vb_dono_passkeys) e a assinatura de cada entrada é
// conferida antes de abrir a sessão.
//
// ações (POST JSON { acao, ... }):
//  cliente
//   opcoes-registro { token }                → desafio pra ativar neste aparelho
//   registrar       { desafio_id, id, clientDataJSON, spki, alg }
//   opcoes-entrar   { telefone? }            → desafio (+ chaves, se veio o telefone;
//                                              sem telefone, o celular mostra as contas salvas)
//   entrar          { desafio_id, id, clientDataJSON, authenticatorData, signature }
//                                             → { token, telefone, nome }
//  dono (conta do Supabase)
//   dono-opcoes-registro { jwt }             → desafio pra ativar neste aparelho
//   dono-registrar       { desafio_id, id, clientDataJSON, spki, alg }
//   dono-opcoes-entrar   {}                  → desafio (o celular mostra as contas salvas)
//   dono-entrar          { desafio_id, id, clientDataJSON, authenticatorData, signature }
//                                             → { token_hash } (vira sessão com auth.verifyOtp)
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const erro = (msg: string, status = 400) => resp({ erro: msg }, status);

const enc = new TextEncoder();
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deB64(s: string): Uint8Array {
  const n = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(n + "===".slice((n.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function sha256(dados: Uint8Array | string): Promise<Uint8Array> {
  const d = typeof dados === "string" ? enc.encode(dados) : dados;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", d));
}
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const iguais = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

// assinatura ECDSA vem em DER; o WebCrypto quer r||s (64 bytes)
function derParaBruto(der: Uint8Array): Uint8Array {
  let i = 2;
  if (der[1] & 0x80) i = 2 + (der[1] & 0x7f);
  const pega = () => {
    i++; // 0x02
    const n = der[i++];
    let v = der.slice(i, i + n);
    i += n;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = pega(), s = pega();
  const bruto = new Uint8Array(64);
  bruto.set(r, 0); bruto.set(s, 32);
  return bruto;
}

// de onde veio o pedido: o passkey fica preso a esse domínio (rp_id)
type Origem = { origem: string; rpId: string };
function origemDe(req: Request): Origem | null {
  const o = req.headers.get("origin") || "";
  try {
    const u = new URL(o);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null;
    return { origem: u.origin, rpId: u.hostname };
  } catch { return null; }
}

async function telefoneDoToken(token: string): Promise<string | null> {
  if (!token) return null;
  const { data } = await db.from("vb_cliente_sessoes").select("telefone, expira_em")
    .eq("token_hash", hex(await sha256(token))).maybeSingle();
  if (!data || new Date(data.expira_em) <= new Date()) return null;
  return data.telefone;
}

type Desafio = { id: string; telefone: string | null; user_id: string | null; desafio: string };
async function novoDesafio(tipo: string, dono: { telefone?: string | null; user_id?: string | null }) {
  const desafio = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const { data, error } = await db.from("vb_cliente_desafios")
    .insert({ telefone: dono.telefone || null, user_id: dono.user_id || null, desafio, tipo, expira_em: new Date(Date.now() + 5 * 60e3).toISOString() })
    .select("id").single();
  if (error) throw error;
  return { id: data.id as string, desafio };
}
async function usarDesafio(id: string, tipo: string): Promise<Desafio | null> {
  const { data } = await db.from("vb_cliente_desafios").select("*").eq("id", id).eq("tipo", tipo).maybeSingle();
  if (!data || new Date(data.expira_em) <= new Date()) return null;
  // vale uma vez só
  await db.from("vb_cliente_desafios").update({ expira_em: new Date().toISOString() }).eq("id", id);
  return data as Desafio;
}

function conferirClientData(clientDataB64: string, tipo: string, desafio: string, origem: string): boolean {
  try {
    const cd = JSON.parse(new TextDecoder().decode(deB64(clientDataB64)));
    return cd.type === tipo && cd.challenge === desafio && cd.origin === origem;
  } catch { return false; }
}

const ALGS: Record<number, RsaHashedImportParams | EcKeyImportParams> = {
  [-7]: { name: "ECDSA", namedCurve: "P-256" },
  [-257]: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
};

// guarda a chave pública de um aparelho novo (cliente ou dono)
async function registrar(c: Record<string, unknown>, d: Desafio, org: Origem, tabela: string, dono: Record<string, unknown>) {
  if (!conferirClientData(String(c.clientDataJSON || ""), "webauthn.create", d.desafio, org.origem)) return erro("Não deu pra confirmar este aparelho.");
  const alg = Number(c.alg);
  if (!ALGS[alg]) return erro("Este aparelho usa um tipo de chave que ainda não aceitamos.");
  const spki = String(c.spki || "");
  // a chave precisa abrir: se não abrir aqui, não abriria na hora de entrar
  await crypto.subtle.importKey("spki", deB64(spki), ALGS[alg], false, ["verify"]);
  const { error } = await db.from(tabela).upsert({ id: String(c.id), ...dono, chave_spki: spki, alg, rp_id: org.rpId, contador: 0 });
  if (error) throw error;
  return resp({ ok: true });
}

// confere a assinatura de uma entrada; devolve a linha da chave ou null
async function conferirEntrada(c: Record<string, unknown>, d: Desafio, org: Origem, tabela: string) {
  const { data: pk } = await db.from(tabela).select("*").eq("id", String(c.id)).eq("rp_id", org.rpId).maybeSingle();
  if (!pk) return null;
  const cdB64 = String(c.clientDataJSON || "");
  if (!conferirClientData(cdB64, "webauthn.get", d.desafio, org.origem)) return null;
  const auth = deB64(String(c.authenticatorData || ""));
  if (auth.length < 37 || !iguais(auth.slice(0, 32), await sha256(org.rpId))) return null;
  if (!(auth[32] & 0x01)) return null; // presença do usuário
  const contador = new DataView(auth.buffer, auth.byteOffset + 33, 4).getUint32(0);
  const cdHash = await sha256(deB64(cdB64));
  const assinado = new Uint8Array(auth.length + cdHash.length);
  assinado.set(auth, 0); assinado.set(cdHash, auth.length);
  let assinatura = deB64(String(c.signature || ""));
  const ec = pk.alg === -7;
  const chave = await crypto.subtle.importKey("spki", deB64(pk.chave_spki), ALGS[pk.alg], false, ["verify"]);
  if (ec) assinatura = derParaBruto(assinatura);
  const ok = await crypto.subtle.verify(ec ? { name: "ECDSA", hash: "SHA-256" } : { name: "RSASSA-PKCS1-v1_5" }, chave, assinatura, assinado);
  if (!ok) return null;
  // contador que volta pra trás = chave copiada
  if (contador > 0 && pk.contador > 0 && contador <= pk.contador) return null;
  await db.from(tabela).update({ contador }).eq("id", pk.id);
  return pk;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("Método não aceito.", 405);
  const org = origemDe(req);
  if (!org) return erro("Origem não aceita.", 403);
  let c: Record<string, unknown>;
  try { c = await req.json(); } catch { return erro("Pedido inválido."); }

  try {
    /* ---------------- cliente ---------------- */
    if (c.acao === "opcoes-registro") {
      const tel = await telefoneDoToken(String(c.token || ""));
      if (!tel) return erro("Entre de novo com sua senha.", 401);
      const { data: cli } = await db.from("vb_clientes_globais").select("nome").eq("telefone", tel).maybeSingle();
      const { data: ja } = await db.from("vb_cliente_passkeys").select("id").eq("telefone", tel).eq("rp_id", org.rpId);
      const d = await novoDesafio("registro", { telefone: tel });
      return resp({
        desafio_id: d.id, challenge: d.desafio, rpId: org.rpId,
        userId: b64url(await sha256("matriz:" + tel)), nome: tel, apelido: (cli && cli.nome) || tel,
        excluir: (ja || []).map((x: { id: string }) => x.id),
      });
    }
    if (c.acao === "registrar") {
      const d = await usarDesafio(String(c.desafio_id || ""), "registro");
      if (!d || !d.telefone) return erro("Demorou demais. Tente de novo.");
      return await registrar(c, d, org, "vb_cliente_passkeys", { telefone: d.telefone });
    }
    if (c.acao === "opcoes-entrar") {
      const tel = String(c.telefone || "").replace(/\D/g, "");
      let permitir: string[] = [];
      if (tel) {
        const { data: chaves } = await db.from("vb_cliente_passkeys").select("id").eq("telefone", tel).eq("rp_id", org.rpId);
        if (!chaves || !chaves.length) return erro("A digital não está ativada pra esse WhatsApp. Entre com a senha.", 404);
        permitir = chaves.map((x: { id: string }) => x.id);
      }
      const d = await novoDesafio("entrar", { telefone: tel || null });
      return resp({ desafio_id: d.id, challenge: d.desafio, rpId: org.rpId, permitir });
    }
    if (c.acao === "entrar") {
      const d = await usarDesafio(String(c.desafio_id || ""), "entrar");
      if (!d) return erro("Demorou demais. Tente de novo.");
      const pk = await conferirEntrada(c, d, org, "vb_cliente_passkeys");
      // veio o telefone? a chave tem que ser dele
      if (!pk || (d.telefone && pk.telefone !== d.telefone)) return erro("Essa digital não está cadastrada aqui. Entre com a senha.", 401);
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      const { error } = await db.from("vb_cliente_sessoes").insert({
        token_hash: hex(await sha256(token)), telefone: pk.telefone,
        expira_em: new Date(Date.now() + 60 * 864e5).toISOString(),
      });
      if (error) throw error;
      const { data: cli } = await db.from("vb_clientes_globais").select("nome").eq("telefone", pk.telefone).maybeSingle();
      return resp({ token, telefone: pk.telefone, nome: (cli && cli.nome) || "" });
    }

    /* ---------------- dono ---------------- */
    if (c.acao === "dono-opcoes-registro") {
      const { data: u } = await db.auth.getUser(String(c.jwt || ""));
      const user = u && u.user;
      if (!user) return erro("Entre de novo com seu e-mail e senha.", 401);
      const { data: ja } = await db.from("vb_dono_passkeys").select("id").eq("user_id", user.id).eq("rp_id", org.rpId);
      const d = await novoDesafio("dono-registro", { user_id: user.id });
      return resp({
        desafio_id: d.id, challenge: d.desafio, rpId: org.rpId,
        userId: b64url(await sha256("dono:" + user.id)), nome: user.email || user.id, apelido: user.email || "Dono",
        excluir: (ja || []).map((x: { id: string }) => x.id),
      });
    }
    if (c.acao === "dono-registrar") {
      const d = await usarDesafio(String(c.desafio_id || ""), "dono-registro");
      if (!d || !d.user_id) return erro("Demorou demais. Tente de novo.");
      return await registrar(c, d, org, "vb_dono_passkeys", { user_id: d.user_id });
    }
    if (c.acao === "dono-opcoes-entrar") {
      const d = await novoDesafio("dono-entrar", {});
      return resp({ desafio_id: d.id, challenge: d.desafio, rpId: org.rpId, permitir: [] });
    }
    if (c.acao === "dono-entrar") {
      const d = await usarDesafio(String(c.desafio_id || ""), "dono-entrar");
      if (!d) return erro("Demorou demais. Tente de novo.");
      const pk = await conferirEntrada(c, d, org, "vb_dono_passkeys");
      if (!pk) return erro("Essa digital não está cadastrada aqui. Entre com e-mail e senha.", 401);
      const { data: u, error: eu } = await db.auth.admin.getUserById(pk.user_id);
      if (eu || !u || !u.user || !u.user.email) return erro("Conta não encontrada.", 404);
      // um link de entrada de uso único, que o navegador troca por sessão (verifyOtp);
      // não manda e-mail nenhum
      const { data: link, error: el } = await db.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
      if (el || !link || !link.properties) throw el || new Error("sem link");
      return resp({ token_hash: link.properties.hashed_token, email: u.user.email });
    }

    return erro("Ação desconhecida.");
  } catch (e) {
    console.error(e);
    return erro("Não deu agora. Tente de novo.", 500);
  }
});
