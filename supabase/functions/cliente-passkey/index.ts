// Entrar com rosto/digital (passkey / WebAuthn) na conta do cliente da Matriz.
// O celular guarda a chave privada; aqui fica só a pública (vb_cliente_passkeys)
// e a assinatura de cada entrada é conferida antes de abrir a sessão.
//
// ações (POST JSON { acao, ... }):
//   opcoes-registro { token }                         → desafio pra ativar neste aparelho
//   registrar      { desafio_id, id, clientDataJSON, spki, alg }
//   opcoes-entrar  { telefone }                       → desafio + chaves desse WhatsApp
//   entrar         { desafio_id, id, clientDataJSON, authenticatorData, signature }
//                                                      → { token, telefone, nome }
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
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
function origemDe(req: Request): { origem: string; rpId: string } | null {
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

async function novoDesafio(telefone: string, tipo: string) {
  const desafio = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const { data, error } = await db.from("vb_cliente_desafios")
    .insert({ telefone, desafio, tipo, expira_em: new Date(Date.now() + 5 * 60e3).toISOString() })
    .select("id").single();
  if (error) throw error;
  return { id: data.id as string, desafio };
}
async function usarDesafio(id: string, tipo: string) {
  const { data } = await db.from("vb_cliente_desafios").select("*").eq("id", id).eq("tipo", tipo).maybeSingle();
  if (!data || new Date(data.expira_em) <= new Date()) return null;
  // vale uma vez só
  await db.from("vb_cliente_desafios").update({ expira_em: new Date().toISOString() }).eq("id", id);
  return data as { telefone: string; desafio: string };
}

function conferirClientData(clientDataB64: string, tipo: string, desafio: string, origem: string): boolean {
  try {
    const cd = JSON.parse(new TextDecoder().decode(deB64(clientDataB64)));
    return cd.type === tipo && cd.challenge === desafio && cd.origin === origem;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("Método não aceito.", 405);
  const org = origemDe(req);
  if (!org) return erro("Origem não aceita.", 403);
  let c: Record<string, string | number>;
  try { c = await req.json(); } catch { return erro("Pedido inválido."); }

  try {
    if (c.acao === "opcoes-registro") {
      const tel = await telefoneDoToken(String(c.token || ""));
      if (!tel) return erro("Entre de novo com sua senha.", 401);
      const { data: cli } = await db.from("vb_clientes_globais").select("nome").eq("telefone", tel).maybeSingle();
      const { data: ja } = await db.from("vb_cliente_passkeys").select("id").eq("telefone", tel).eq("rp_id", org.rpId);
      const d = await novoDesafio(tel, "registro");
      return resp({
        desafio_id: d.id, challenge: d.desafio, rpId: org.rpId,
        userId: b64url(await sha256("matriz:" + tel)), nome: tel, apelido: (cli && cli.nome) || tel,
        excluir: (ja || []).map((x: { id: string }) => x.id),
      });
    }

    if (c.acao === "registrar") {
      const d = await usarDesafio(String(c.desafio_id || ""), "registro");
      if (!d) return erro("Demorou demais. Tente de novo.");
      if (!conferirClientData(String(c.clientDataJSON || ""), "webauthn.create", d.desafio, org.origem)) return erro("Não deu pra confirmar este aparelho.");
      const alg = Number(c.alg);
      if (alg !== -7 && alg !== -257) return erro("Este aparelho usa um tipo de chave que ainda não aceitamos.");
      const spki = String(c.spki || "");
      // a chave precisa abrir: se não abrir aqui, não abriria na hora de entrar
      await crypto.subtle.importKey("spki", deB64(spki),
        alg === -7 ? { name: "ECDSA", namedCurve: "P-256" } : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      const { error } = await db.from("vb_cliente_passkeys").upsert({ id: String(c.id), telefone: d.telefone, chave_spki: spki, alg, rp_id: org.rpId, contador: 0 });
      if (error) throw error;
      return resp({ ok: true });
    }

    if (c.acao === "opcoes-entrar") {
      const tel = String(c.telefone || "").replace(/\D/g, "");
      const { data: chaves } = await db.from("vb_cliente_passkeys").select("id").eq("telefone", tel).eq("rp_id", org.rpId);
      if (!chaves || !chaves.length) return erro("Rosto/digital não está ativado neste aparelho. Entre com a senha.", 404);
      const d = await novoDesafio(tel, "entrar");
      return resp({ desafio_id: d.id, challenge: d.desafio, rpId: org.rpId, permitir: chaves.map((x: { id: string }) => x.id) });
    }

    if (c.acao === "entrar") {
      const d = await usarDesafio(String(c.desafio_id || ""), "entrar");
      if (!d) return erro("Demorou demais. Tente de novo.");
      const { data: pk } = await db.from("vb_cliente_passkeys").select("*").eq("id", String(c.id)).eq("telefone", d.telefone).eq("rp_id", org.rpId).maybeSingle();
      if (!pk) return erro("Esse rosto/digital não é desta conta.", 401);
      const cdB64 = String(c.clientDataJSON || "");
      if (!conferirClientData(cdB64, "webauthn.get", d.desafio, org.origem)) return erro("Não deu pra confirmar.", 401);
      const auth = deB64(String(c.authenticatorData || ""));
      if (auth.length < 37 || !iguais(auth.slice(0, 32), await sha256(org.rpId))) return erro("Não deu pra confirmar.", 401);
      if (!(auth[32] & 0x01)) return erro("Confirme no aparelho.", 401); // presença do usuário
      const contador = new DataView(auth.buffer, auth.byteOffset + 33, 4).getUint32(0);
      const cdHash = await sha256(deB64(cdB64));
      const assinado = new Uint8Array(auth.length + cdHash.length);
      assinado.set(auth, 0); assinado.set(cdHash, auth.length);
      let assinatura = deB64(String(c.signature || ""));
      const ec = pk.alg === -7;
      const chave = await crypto.subtle.importKey("spki", deB64(pk.chave_spki),
        ec ? { name: "ECDSA", namedCurve: "P-256" } : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      if (ec) assinatura = derParaBruto(assinatura);
      const ok = await crypto.subtle.verify(ec ? { name: "ECDSA", hash: "SHA-256" } : { name: "RSASSA-PKCS1-v1_5" }, chave, assinatura, assinado);
      if (!ok) return erro("Não deu pra confirmar.", 401);
      // contador que volta pra trás = chave copiada
      if (contador > 0 && pk.contador > 0 && contador <= pk.contador) return erro("Não deu pra confirmar.", 401);
      await db.from("vb_cliente_passkeys").update({ contador }).eq("id", pk.id);
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      const { error } = await db.from("vb_cliente_sessoes").insert({
        token_hash: hex(await sha256(token)), telefone: d.telefone,
        expira_em: new Date(Date.now() + 60 * 864e5).toISOString(),
      });
      if (error) throw error;
      const { data: cli } = await db.from("vb_clientes_globais").select("nome").eq("telefone", d.telefone).maybeSingle();
      return resp({ token, telefone: d.telefone, nome: (cli && cli.nome) || "" });
    }

    return erro("Ação desconhecida.");
  } catch (e) {
    console.error(e);
    return erro("Não deu agora. Tente de novo.", 500);
  }
});
