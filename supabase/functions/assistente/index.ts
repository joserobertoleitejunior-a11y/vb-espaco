// O "funcionário" do estabelecimento: o dono fala (ou escreve) o que quer e a IA
// responde com UMA ação pra o app executar. Quem decide a ação é o Gemini; quem
// executa é sempre o navegador do dono, com as RPCs que ele já tem permissão de
// chamar. Esta função NÃO toca no banco: ela só entende o pedido.
//
// POST { texto, contexto: { nome_assistente, negocio, areas, resumo… } }
//   → { fala, acao: { nome, args } | null }
//
// A chave do Gemini é secret do projeto (GEMINI_API_KEY) e nunca sai daqui.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const erro = (m: string, s = 400) => resp({ erro: m }, s);
const MODELO = "gemini-2.0-flash";

// O que o funcionário pode fazer. O app conhece cada uma destas ações.
const ACOES = `
abrir_aba           { aba: "agenda"|"pedidos"|"caixa"|"clientes"|"ganhos"|"site" }   — leva o dono pra essa tela
confirmar_agendamento { cliente?: string, id?: string }   — confirma um horário pendente
concluir_agendamento  { cliente?: string, id?: string }   — marca como concluído (pergunta o valor)
cancelar_agendamento  { cliente?: string, id?: string }
avancar_pedido      { numero?: number }      — passa o pedido pro próximo passo (aceitar → avisar → concluir)
cancelar_pedido     { numero: number }
lancar_venda        { descricao: string, valor: number, forma?: "pix"|"dinheiro"|"cartao", cliente?: string }
consultar           { oQue: "hoje"|"vendas"|"agenda"|"pedidos"|"clientes"|"anuncio" }  — responde com números
abrir_editor        { parte?: "foto"|"textos"|"estilo"|"servicos"|"equipe"|"galeria"|"horario"|"contato"|"localizacao"|"redes" }
mudar_nome_funcionario { nome: string }   — o dono quer chamar o funcionário de outro jeito
nada                {}                     — só conversa, sem ação
`;

function instrucao(ctx: Record<string, unknown>) {
  return `Você é ${ctx.nome_assistente || "o funcionário"}, o funcionário digital do estabelecimento "${ctx.negocio || ""}" no app Matriz. Fala com o DONO do negócio, em português do Brasil, do jeito mais simples possível — como um colega de trabalho, nunca como um robô.

Responda SEMPRE em JSON: {"fala":"...","acao":{"nome":"...","args":{}}}
- "fala": uma ou duas frases curtas, no máximo 220 caracteres. Sem emoji.
- "acao": uma das ações abaixo, ou null quando for só conversa.

Ações que você pode pedir:${ACOES}

Regras:
- Nunca invente número de venda, preço ou nome de cliente. Se faltar informação, pergunte na "fala" e mande "acao": null.
- Se o dono pedir algo que não está na lista, explique na "fala" o que dá pra fazer e mande "acao": null.
- Para consultar qualquer número, use a ação "consultar": o app mostra os dados de verdade.
- Nunca fale de chave, API, banco de dados nem de como o app funciona por dentro.
- Se o dono quiser te dar outro nome, use "mudar_nome_funcionario".

O que está na tela agora (use para entender o pedido):
${JSON.stringify(ctx).slice(0, 3000)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("Método inválido.", 405);

  const chave = Deno.env.get("GEMINI_API_KEY");
  if (!chave) return erro("O funcionário ainda não foi ligado neste app.", 503);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + jwt } },
  });
  const { data: quem } = await db.auth.getUser();
  if (!quem?.user) return erro("Entre na sua conta primeiro.", 401);

  let corpo: { texto?: string; contexto?: Record<string, unknown>; historico?: { de: string; texto: string }[] };
  try { corpo = await req.json(); } catch { return erro("Pedido inválido."); }
  const texto = String(corpo.texto || "").trim().slice(0, 600);
  if (!texto) return erro("Diga o que você quer.");

  const conversa = (corpo.historico || []).slice(-6).map((m) => ({
    role: m.de === "eu" ? "user" : "model",
    parts: [{ text: String(m.texto || "").slice(0, 500) }],
  }));

  let r: Response;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${chave}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucao(corpo.contexto || {}) }] },
        contents: [...conversa, { role: "user", parts: [{ text }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700, responseMimeType: "application/json" },
      }),
    });
  } catch { return erro("Não consegui falar com o funcionário agora.", 502); }
  if (!r.ok) {
    console.error("gemini", r.status, (await r.text().catch(() => "")).slice(0, 300));
    return erro(r.status === 429 ? "Muita coisa de uma vez. Espere um minutinho." : "O funcionário não respondeu agora.", 502);
  }

  const d = await r.json().catch(() => null);
  const bruto = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  let saida: { fala?: string; acao?: { nome?: string; args?: Record<string, unknown> } | null };
  try { saida = JSON.parse(bruto.replace(/^```(?:json)?|```$/g, "").trim()); } catch {
    return resp({ fala: "Não entendi direito. Pode falar de outro jeito?", acao: null });
  }
  const nome = saida.acao?.nome && /^[a-z_]{3,30}$/.test(saida.acao.nome) ? saida.acao.nome : null;
  return resp({
    fala: String(saida.fala || "Pronto.").slice(0, 400),
    acao: nome && nome !== "nada" ? { nome, args: saida.acao?.args && typeof saida.acao.args === "object" ? saida.acao.args : {} } : null,
  });
});
