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
      // o modelo não aceitou desligar o "pensamento": repete sem essa opção, em vez de falhar
      if (status === 400 && (corpo as { generationConfig?: { thinkingConfig?: unknown } }).generationConfig?.thinkingConfig) {
        delete (corpo as { generationConfig: { thinkingConfig?: unknown } }).generationConfig.thinkingConfig;
        n--; continue;
      }
      if (status !== 429 && status !== 503 && status < 500) return { erroStatus: status };
      await espera(400 * (n + 1));
    }
  }
  return { erroStatus: status };
}

// O que o funcionário pode fazer. O app conhece cada uma destas ações.
const ACOES = `
abrir_aba           { aba: "agenda"|"pedidos"|"cardapio"|"caixa"|"clientes"|"ganhos"|"site" }   — leva o dono pra essa tela
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
adicionar_item      { nome: string, preco?: number, categoria?: string, descricao?: string }   — põe um item/serviço no cardápio
mudar_preco_item    { nome: string, preco: number }
mudar_nome_item     { nome: string, novo_nome: string }
disponibilidade_item { nome: string, disponivel: boolean }   — esgotado (false) ou de volta (true)
remover_item        { nome: string }
limpar_cardapio     {}                     — apaga TODOS os itens e categorias do cardápio
criar_categoria     { nome: string }
remover_categoria   { nome: string }
adicionar_borda     { nome: string, preco: number }
remover_borda       { nome: string }
criar_combo         { nome: string, preco: number, qtd_sabores?: number }   — promoção fechada de pizzas/itens
remover_combo       { nome: string }
abrir_fechar_loja   { modo: "aberto"|"fechado"|"auto" }   — abre/fecha a loja de delivery agora, ou volta ao horário
configurar_loja     { taxa_entrega?: number, pedido_minimo?: number, tempo_min?: number, tempo_max?: number, entrega?: boolean, retirada?: boolean, aviso?: string, chave_pix?: string, whatsapp?: string }
criar_agendamento   { cliente: string, telefone?: string, servico?: string, profissional?: string, dia: "YYYY-MM-DD", horario: "HH:MM" }
adicionar_servico   { nome: string, preco: number }   — serviço da agenda
mudar_preco_servico { nome: string, preco: number }
remover_servico     { nome: string }
adicionar_profissional { nome: string, especialidade?: string }
remover_profissional   { nome: string }
horario_funcionamento  { dia: "segunda"…"domingo", abre?: "HH:MM", fecha?: "HH:MM", fechado?: boolean }
publicar_promocao   { titulo: string, texto?: string, dias?: number }   — promoção que aparece no site
apagar_promocao     { titulo: string }
publicar_recado     { texto: string }      — recado do dia no site (24 horas)
remover_venda       { descricao?: string } — apaga a venda de hoje (a última, se não disser qual)
editar_site         { titulo?: string, subtitulo?: string, sobre?: string, instagram?: string, cta?: string }
buscar_cliente      { nome: string }       — telefone e histórico de um cliente
abrir_tour          {}                     — o dono quer aprender a usar o app: abre o tour
nada                {}                     — só conversa, sem ação
`;

function instrucao(ctx: Record<string, unknown>) {
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const diaSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(new Date());
  return `Você é ${ctx.nome_assistente || "o funcionário"}, o funcionário digital do estabelecimento "${ctx.negocio || ""}" no app Matriz. Fala com o DONO do negócio, em português do Brasil, do jeito mais simples possível — como um colega de trabalho, nunca como um robô.

Responda SEMPRE em JSON: {"fala":"...","acao":{"nome":"...","args":{}}}
- "fala": uma ou duas frases curtas, no máximo 220 caracteres. Sem emoji.
- "acao": uma das ações abaixo, ou null quando for só conversa.

Ações que você pode pedir:${ACOES}

Hoje é ${hoje} (${diaSemana}). Use isso pra entender \"hoje\", \"amanhã\", \"sexta\" e mande a data em YYYY-MM-DD.

Regras:
- VOCÊ CONSEGUE FAZER TUDO o que o app faz: cada coisa tem uma ação na lista. Nunca diga que não consegue nem mande o dono fazer à mão se existe uma ação pra isso. Pra \"apagar tudo do cardápio\" use limpar_cardapio; pra apagar um item, remover_item; pra mudar preço, mudar_preco_item; pra marcar esgotado, disponibilidade_item.
- Ações que apagam ou mexem em dinheiro: o app pede o \"sim\" do dono sozinho, então só mande a ação — sem perguntar de novo na fala.
- Se faltar um dado (nome do item, preço, dia, hora), pergunte só o que falta e mande \"acao\": null.
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

  const t0 = Date.now();
  const resposta = await pedirAoGemini(chave, {
    systemInstruction: { parts: [{ text: instrucao(corpo.contexto || {}) }] },
    // a variável é "texto": escrever só { text } procurava uma variável "text"
    // que não existe, e a chamada morria antes de sair
    contents: [...conversa, { role: "user", parts: [{ text: texto }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 900, responseMimeType: "application/json" , thinkingConfig: { thinkingBudget: 0 } },
  });
  console.log("assistente: gemini respondeu em", Date.now() - t0, "ms");
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
