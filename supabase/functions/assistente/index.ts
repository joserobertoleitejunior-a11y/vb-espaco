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

// Congestionamento no Google (503/429) é passageiro: em vez de desistir na
// primeira, esperamos um pouco e repetimos; se o modelo preferido continuar
// lotado, tentamos o irmão mais leve. Erro que não é congestionamento (chave
// errada, pedido inválido) não melhora repetindo, então volta na hora.
// Os nomes "latest" são apelidos do Google: não quebram quando uma versão
// do modelo é aposentada.
const MODELOS = [Deno.env.get("GEMINI_MODELO") || "gemini-flash-latest", "gemini-flash-lite-latest"];
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function pedirAoGemini(chave: string, corpo: unknown): Promise<{ texto: string } | { erroStatus: number }> {
  let status = 0;
  for (const modelo of MODELOS) {
    for (let n = 0; n < 2; n++) {
      let r: Response;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
          body: JSON.stringify(corpo),
        });
      } catch (e) {
        // o motivo fica no log do projeto (sem a chave), pra não virar adivinhação
        console.error("fetch gemini falhou", modelo, String(e));
        status = 0;
        continue;
      }
      if (r.ok) {
        const d = await r.json().catch(() => null);
        return { texto: d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "" };
      }
      status = r.status;
      console.error("gemini", modelo, r.status, (await r.text().catch(() => "")).slice(0, 300));
      if (status !== 429 && status !== 503 && status < 500) return { erroStatus: status };
      await espera(800 * (n + 1));
    }
  }
  return { erroStatus: status };
}

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
pedir_foto_cardapio {}                     — o dono quer mexer no cardápio: peça a foto aqui no chat
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
- Cardápio: se ele falar em montar, preencher, atualizar ou "editar o cardápio"
  (ou a tabela de serviços), NÃO mande ele pra outra tela. Use
  "pedir_foto_cardapio" e diga, na "fala", que ele pode mandar a foto do
  cardápio pelo botão da câmera aqui do chat, que você lê e preenche.
  Só use "abrir_editor" se ele pedir pra mexer num item específico à mão.

O que está na tela agora (use para entender o pedido):
${JSON.stringify(ctx).slice(0, 3000)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("Método inválido.", 405);

  // A chave vem de um campo que aceita várias linhas: um Enter ou um espaço
  // sem querer no fim entrava no endereço e a chamada estourava antes de sair.
  // Tiramos tudo o que não é a chave, e ela vai no cabeçalho x-goog-api-key em
  // vez da URL — assim ela não aparece em log nenhum.
  const chave = (Deno.env.get("GEMINI_API_KEY") || "").replace(/\s+/g, "");
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

  const resposta = await pedirAoGemini(chave, {
    systemInstruction: { parts: [{ text: instrucao(corpo.contexto || {}) }] },
    // a variável é "texto": escrever só { text } procurava uma variável "text"
    // que não existe, e a chamada morria antes de sair
    contents: [...conversa, { role: "user", parts: [{ text: texto }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 700, responseMimeType: "application/json" },
  });
  if ("erroStatus" in resposta) {
    const s = resposta.erroStatus;
    // dizemos a verdade: a fila é do Google, não é defeito do app nem do dono
    if (s === 429 || s === 503) return erro("A IA está congestionada neste momento. Espere uns segundos e peça de novo.", 503);
    if (s === 400 || s === 401 || s === 403) return erro("O funcionário não está ligado direito neste app.", 503);
    return erro("Não consegui falar com o funcionário agora.", 502);
  }

  let saida: { fala?: string; acao?: { nome?: string; args?: Record<string, unknown> } | null };
  try { saida = JSON.parse(resposta.texto.replace(/^```(?:json)?|```$/g, "").trim()); } catch {
    return resp({ fala: "Não entendi direito. Pode falar de outro jeito?", acao: null });
  }
  const nome = saida.acao?.nome && /^[a-z_]{3,30}$/.test(saida.acao.nome) ? saida.acao.nome : null;
  return resp({
    fala: String(saida.fala || "Pronto.").slice(0, 400),
    acao: nome && nome !== "nada" ? { nome, args: saida.acao?.args && typeof saida.acao.args === "object" ? saida.acao.args : {} } : null,
  });
});
