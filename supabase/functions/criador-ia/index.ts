// IA do criador de conteúdo: roteiro de vídeo, legenda, proposta e sugestão de preço.
// POST { tipo: 'roteiro' | 'legenda' | 'proposta' | 'preco', dados: {...} } → { texto, uso }
// Cobra créditos do plano do criador (criador_ia_consumir: 400/mês) e devolve se a IA falhar.
// A chave do Claude é o secret ANTHROPIC_API_KEY do projeto e nunca sai daqui.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const erro = (m: string, s = 400) => resp({ erro: m }, s);

const MODELO = Deno.env.get("CLAUDE_MODELO_CRIADOR") || "claude-sonnet-5-5";
const MODELO_RESERVA = "claude-haiku-5-5";
const URL_API = "https://api.anthropic.com/v1/messages";

const PESO: Record<string, number> = { roteiro: 2, legenda: 1, proposta: 1, preco: 1 };

const BASE = `Você é o assistente de um criador de conteúdo brasileiro (influenciador ou videomaker freelancer) que faz vídeos para pequenos negócios.
Escreva em português do Brasil, simples e direto, no tom pedido. Não invente fatos sobre o negócio, números de seguidores, resultados ou preços de mercado exatos: use só o que foi informado e deixe claro quando algo é estimativa.
Responda só com o texto pronto para usar, em texto simples (sem tabelas e sem markdown pesado). Pode usar linhas em branco e listas curtas com "-" ou números.`;

const s = (v: unknown, n = 500) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

function montar(tipo: string, d: Record<string, unknown>): { system: string; user: string; max: number } | null {
  if (tipo === "roteiro") {
    return {
      system: BASE + `\nTarefa: criar o ROTEIRO de um vídeo curto. Entregue: 1) Gancho dos primeiros 3 segundos; 2) Cenas numeradas, cada uma com "O que filmar" e "Fala/legenda na tela"; 3) Chamada para ação final; 4) Duração estimada e sugestão de música/clima. Ideias simples de gravar só com o celular.`,
      user: `Negócio: ${s(d.negocio, 120)}\nTipo de negócio: ${s(d.tipo_negocio, 80)}\nFormato: ${s(d.formato, 80) || "Reels de 30 segundos"}\nObjetivo: ${s(d.objetivo, 160) || "atrair clientes"}\nTom: ${s(d.tom, 60) || "descontraído"}\nDetalhes (produtos, promoção, diferenciais): ${s(d.detalhes, 600)}`,
      max: 1100,
    };
  }
  if (tipo === "legenda") {
    return {
      system: BASE + `\nTarefa: escrever 3 opções de legenda curtas para postar o vídeo, cada uma com chamada para ação e de 5 a 8 hashtags locais e do nicho. Sem exagerar em emojis.`,
      user: `Negócio: ${s(d.negocio, 120)}\nRede: ${s(d.rede, 40) || "Instagram"}\nSobre o vídeo: ${s(d.sobre, 500)}\nTom: ${s(d.tom, 60) || "descontraído"}\nCidade: ${s(d.cidade, 60)}`,
      max: 700,
    };
  }
  if (tipo === "proposta") {
    const lista = Array.isArray(d.servicos) ? (d.servicos as Record<string, unknown>[]).slice(0, 8) : [];
    const servicos = lista.map((x) => `- ${s(x.nome, 80)} | ${s(x.preco, 40)} | prazo: ${s(x.prazo, 30) || "a combinar"} | uso: ${s(x.uso, 40)}`).join("\n");
    return {
      system: BASE + `\nTarefa: escrever uma PROPOSTA comercial. Entregue duas partes: (A) mensagem curta para enviar no WhatsApp (até 6 linhas, educada e direta); (B) proposta organizada com: serviços e valores (use exatamente os informados), prazo, o que está incluso, direito de uso do vídeo, forma de pagamento sugerida (50% para começar e 50% na entrega, se não houver outra informada) e próximo passo. Não invente descontos nem valores.`,
      user: `Criador: ${s(d.criador, 80)}\nCliente (negócio): ${s(d.cliente, 120)}\nServiços escolhidos:\n${servicos || "(nenhum informado)"}\nObservações: ${s(d.observacoes, 400)}`,
      max: 1000,
    };
  }
  if (tipo === "preco") {
    return {
      system: BASE + `\nTarefa: SUGERIR uma faixa de preço (mínimo, ideal e máximo, em reais) para o serviço, com 3 a 5 linhas explicando o raciocínio (esforço, alcance, direito de uso, prazo, revisões) e como o criador pode justificar o valor ao cliente. Deixe claro que é uma estimativa para ele ajustar, não uma tabela oficial.`,
      user: `Serviço: ${s(d.entrega, 200)}\nNicho: ${s(d.nicho, 80)}\nSeguidores (informado): ${s(d.seguidores, 40) || "não informado"}\nCidade: ${s(d.cidade, 60)}\nDireito de uso: ${s(d.uso, 60) || "só orgânico"}\nObservações: ${s(d.observacoes, 300)}`,
      max: 700,
    };
  }
  return null;
}

async function chamar(chave: string, modelo: string, corpo: Record<string, unknown>): Promise<string> {
  const r = await fetch(URL_API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ ...corpo, model: modelo }),
    signal: AbortSignal.timeout(40000),
  });
  if (r.ok) {
    const d = await r.json().catch(() => null);
    const t = (d?.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    if (!t) throw { status: 502 };
    return t;
  }
  const txt = (await r.text().catch(() => "")).slice(0, 300);
  console.error("criador-ia claude", modelo, r.status, txt.slice(0, 200));
  throw { status: r.status, motivo: /credit balance|billing/i.test(txt) ? "saldo" : undefined };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("Método inválido.", 405);

  const chave = (Deno.env.get("ANTHROPIC_API_KEY") || "").replace(/\s+/g, "");
  if (!chave) return erro("A IA ainda não foi ligada neste app.", 503);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + jwt } },
  });
  const { data: quem } = await db.auth.getUser();
  if (!quem?.user) return erro("Entre na sua conta primeiro.", 401);

  let corpo: { tipo?: string; dados?: Record<string, unknown> };
  try { corpo = await req.json(); } catch { return erro("Pedido inválido."); }
  const tipo = String(corpo.tipo || "");
  const pedido = montar(tipo, corpo.dados && typeof corpo.dados === "object" ? corpo.dados : {});
  if (!pedido) return erro("Escolha o que você quer criar.");

  const peso = PESO[tipo] || 1;
  const { data: uso, error: eUso } = await db.rpc("criador_ia_consumir", { p_peso: peso });
  if (eUso) {
    console.error("criador-ia: créditos indisponíveis:", eUso.message);
    return erro("Esta área ainda está sendo ativada. Volte em breve.", 503);
  }
  if (!uso || uso.ok === false) return erro(String(uso?.mensagem || "Seus créditos de IA acabaram por agora."), 429);

  let texto = "";
  let falha: { status: number; motivo?: string } = { status: 0 };
  for (const modelo of [MODELO, MODELO_RESERVA]) {
    try {
      texto = await chamar(chave, modelo, { system: pedido.system, messages: [{ role: "user", content: pedido.user }], max_tokens: pedido.max });
      break;
    } catch (e) {
      falha = e && typeof (e as { status: number }).status === "number" ? (e as { status: number; motivo?: string }) : { status: 0 };
      if ([400, 401, 402, 403].includes(falha.status)) break;
    }
  }
  if (!texto) {
    await db.rpc("criador_ia_devolver", { p_peso: peso }); // não cobra quando a IA falhou
    if (falha.motivo === "saldo") return erro("O saldo da IA acabou. Avise o suporte.", 503);
    if (falha.status === 401 || falha.status === 403) return erro("A IA não está ligada direito neste app (chave inválida). Avise o suporte.", 503);
    if ([429, 529, 503, 0].includes(falha.status)) return erro("A IA está congestionada neste momento. Espere uns segundos e tente de novo.", 503);
    return erro("Não consegui gerar agora. Tente de novo.", 502);
  }
  const { data: sit } = await db.rpc("criador_ia_situacao");
  return resp({ texto: texto.trim(), uso: sit || null });
});
