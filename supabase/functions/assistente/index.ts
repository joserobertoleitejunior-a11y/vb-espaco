// O "funcionário" do estabelecimento: o dono fala (ou escreve) o que quer e a IA
// responde com UMA ação pra o app executar. Quem decide a ação é o Claude; quem
// executa é sempre o navegador do dono, com as RPCs que ele já tem permissão de
// chamar. Esta função NÃO toca no banco: ela só entende o pedido.
//
// POST { texto, contexto: { nome_assistente, negocio, areas, resumo… } }
//   → { fala, acao: { nome, args } | null }
//
// A chave do Claude é secret do projeto (ANTHROPIC_API_KEY) e nunca sai daqui.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const erro = (m: string, s = 400) => resp({ erro: m }, s);

// IA: Claude (Anthropic). A chave é o secret ANTHROPIC_API_KEY do projeto e nunca sai daqui.
// Tenta o modelo rápido; se ele falhar por sobrecarga ou tempo, cai no reserva.
const MODELO_CHAT = Deno.env.get("CLAUDE_MODELO") || "claude-haiku-5-5";
const MODELO_RESERVA = "claude-sonnet-5-5";
const URL_API = "https://api.anthropic.com/v1/messages";

type ErroIA = { status: number; motivo?: string };

async function chamar(chave: string, modelo: string, corpo: Record<string, unknown>): Promise<string> {
  const r = await fetch(URL_API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ ...corpo, model: modelo }),
    signal: AbortSignal.timeout(20000),
  });
  if (r.ok) {
    const d = await r.json().catch(() => null);
    const t = (d?.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    if (!t) throw { status: 502 };
    return t;
  }
  const txt = (await r.text().catch(() => "")).slice(0, 300);
  console.error("claude", modelo, r.status, txt.slice(0, 200));
  throw { status: r.status, motivo: /credit balance|billing/i.test(txt) ? "saldo" : undefined };
}

async function pedirAoClaude(chave: string, corpo: Record<string, unknown>): Promise<{ texto: string } | { erroStatus: number; motivo?: string }> {
  let ultimo: ErroIA = { status: 0 };
  for (const modelo of [MODELO_CHAT, MODELO_RESERVA]) {
    try {
      const texto = await chamar(chave, modelo, corpo);
      console.log("assistente: respondeu", modelo);
      return { texto };
    } catch (e) {
      ultimo = (e && typeof (e as ErroIA).status === "number") ? (e as ErroIA) : { status: 0 };
      console.error("assistente: falhou", modelo, ultimo.status || String(e));
      // erro nosso (chave, saldo, pedido inválido): trocar de modelo não ajuda
      if ([400, 401, 402, 403].includes(ultimo.status)) break;
    }
  }
  return { erroStatus: ultimo.status || 503, motivo: ultimo.motivo };
}

// A API exige que a conversa comece pelo usuário e alterne os papéis.
function montarConversa(hist: { de: string; texto: string }[] | undefined, texto: string): { role: string; content: string }[] {
  const out: { role: string; content: string }[] = [];
  for (const m of (hist || []).slice(-6)) {
    const role = m.de === "eu" ? "user" : "assistant";
    const content = String(m.texto || "").slice(0, 500).trim();
    if (!content) continue;
    if (!out.length && role === "assistant") continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n" + content;
    else out.push({ role, content });
  }
  const ultimo = out[out.length - 1];
  if (ultimo && ultimo.role === "user") { if (!ultimo.content.endsWith(texto)) ultimo.content += "\n" + texto; }
  else out.push({ role: "user", content: texto });
  return out;
}

const ACOES = `
abrir_aba           { aba: "agenda"|"pedidos"|"cardapio"|"caixa"|"clientes"|"ganhos"|"site" }   — leva o dono pra essa tela
confirmar_agendamento { cliente?: string, id?: string }   — confirma um horário pendente
concluir_agendamento  { cliente?: string, id?: string }   — marca como concluído (pergunta o valor)
cancelar_agendamento  { cliente?: string, id?: string }
avancar_pedido      { numero?: number }      — passa o pedido pro próximo passo (aceitar → avisar → concluir)
cancelar_pedido     { numero: number }
lancar_venda        { descricao: string, valor: number, forma?: "pix"|"dinheiro"|"cartao", cliente?: string }
consultar           { oQue: "hoje"|"vendas"|"agenda"|"pedidos"|"clientes"|"anuncio" }  — responde com números
mostrar_dashboard   { dias?: 1|3|5|7|15|30 }   — mostra no chat o gráfico e os números de faturamento do período (use pra "como foi a semana", "gráfico", "dashboard")
pedir_foto_cardapio {}                     — o dono quer montar ou atualizar o cardápio (ou mandar uma promoção): peça a foto aqui no chat; dá pra mandar várias de uma vez
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
buscar_cliente      { nome: string }       — telefone e histórico de um cliente
abrir_tour          {}                     — o dono quer aprender a usar o app: abre o tour
nada                {}                     — só conversa, sem ação
`;

function instrucao(ctx: Record<string, unknown>) {
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const diaSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(new Date());
  const fixa = `Você é o funcionário digital de um estabelecimento no app Matriz. Fala com o DONO do negócio, em português do Brasil, do jeito mais simples possível — como um colega de trabalho, nunca como um robô.

Responda SEMPRE só com JSON puro, sem texto em volta e sem blocos de código: {"fala":"...","acao":{"nome":"...","args":{}}}
- "fala": uma ou duas frases curtas, no máximo 220 caracteres. Sem emoji.
- "acao": uma das ações abaixo, ou null quando for só conversa.

Ações que você pode pedir:${ACOES}

Regras:
- VOCÊ CONSEGUE FAZER TUDO o que o app faz: cada coisa tem uma ação na lista. Nunca diga que não consegue nem mande o dono fazer à mão se existe uma ação pra isso. Pra "apagar tudo do cardápio" use limpar_cardapio; pra apagar um item, remover_item; pra mudar preço, mudar_preco_item; pra marcar esgotado, disponibilidade_item.
- Ações que apagam ou mexem em dinheiro: o app pede o "sim" do dono sozinho, então só mande a ação — sem perguntar de novo na fala.
- Se faltar um dado (nome do item, preço, dia, hora), pergunte só o que falta e mande "acao": null.
- Nunca invente número de venda, preço ou nome de cliente. Se faltar informação, pergunte na "fala" e mande "acao": null.
- Se o dono pedir algo que não está na lista, explique na "fala" o que dá pra fazer e mande "acao": null.
- Para consultar qualquer número, use a ação "consultar": o app mostra os dados de verdade.
- Nunca fale de chave, API, banco de dados nem de como o app funciona por dentro.
- Se o dono quiser te dar outro nome, use "mudar_nome_funcionario".
- Cardápio: se ele falar em montar, preencher, atualizar ou "editar o cardápio" (ou a tabela de serviços), NÃO mande ele pra outra tela. Use "pedir_foto_cardapio" e diga, na "fala", que ele pode mandar a foto do cardápio pelo botão da câmera aqui do chat, que você lê e preenche. Se ele quiser mexer num item específico, use mudar_preco_item, mudar_nome_item ou disponibilidade_item.
- VOCÊ NÃO EDITA O SITE (fotos, textos, estilo, cores, galeria, endereço do site): isso o dono faz na aba "Meu site", pelo editor. Se pedirem, explique isso em uma frase e mande "acao": null.
- Gráficos e números: pra mostrar faturamento, semana, mês ou dashboard use "mostrar_dashboard" (o gráfico aparece no chat). Escolha o período mais próximo do que ele pediu.`;
  const variavel = `Seu nome é ${ctx.nome_assistente || "o funcionário"} e você trabalha no estabelecimento "${ctx.negocio || ""}".
Hoje é ${hoje} (${diaSemana}). Use isso pra entender "hoje", "amanhã", "sexta" e mande a data em YYYY-MM-DD.

O que está na tela agora (use para entender o pedido):
${JSON.stringify(ctx).slice(0, 3000)}`;
  // o bloco fixo é igual pra todo mundo: a API guarda em cache e cobra bem menos nas próximas mensagens
  return [{ type: "text", text: fixa, cache_control: { type: "ephemeral" } }, { type: "text", text: variavel }];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("Método inválido.", 405);

  // A chave vem de um campo que aceita várias linhas: um Enter ou um espaço
  // sem querer no fim entrava no endereço e a chamada estourava antes de sair.
  // Tiramos tudo o que não é a chave, e ela vai no cabeçalho x-api-key em
  // vez da URL — assim ela não aparece em log nenhum.
  const chave = (Deno.env.get("ANTHROPIC_API_KEY") || "").replace(/\s+/g, "");
  if (!chave) return erro("O funcionário ainda não foi ligado neste app.", 503);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + jwt } },
  });
  const { data: quem } = await db.auth.getUser();
  if (!quem?.user) return erro("Entre na sua conta primeiro.", 401);

  let corpo: { texto?: string; contexto?: Record<string, unknown>; historico?: { de: string; texto: string }[]; estabId?: string };
  try { corpo = await req.json(); } catch { return erro("Pedido inválido."); }
  const texto = String(corpo.texto || "").trim().slice(0, 600);
  if (!texto) return erro("Diga o que você quer.");

  // Limite justo por estabelecimento (por dia). Se a função de contagem ainda não existe no banco,
  // deixa passar: o limite só vale depois que ela for criada.
  if (corpo.estabId && /^[0-9a-f-]{36}$/i.test(corpo.estabId)) {
    const { data: uso, error: eUso } = await db.rpc("assistente_consumir", { p_estabelecimento_id: corpo.estabId, p_tipo: "mensagem" });
    if (eUso) console.error("assistente: contagem de uso indisponível:", eUso.message);
    else if (uso && uso.ok === false) {
      return erro(String(uso.mensagem || "Seus créditos de IA acabaram por agora. Os botões do painel continuam funcionando."), 429);
    }
  }

  const t0 = Date.now();
  const resposta = await pedirAoClaude(chave, {
    system: instrucao(corpo.contexto || {}),
    messages: montarConversa(corpo.historico, texto),
    max_tokens: 700,
  });
  console.log("assistente: IA respondeu em", Date.now() - t0, "ms");
  if ("erroStatus" in resposta) {
    const s = resposta.erroStatus;
    if (resposta.motivo === "saldo") return erro("O saldo da IA acabou. Avise o suporte para recarregar. Enquanto isso os botões do painel funcionam normalmente.", 503);
    if (s === 401 || s === 403) return erro("O funcionário não está ligado direito neste app (chave da IA inválida). Avise o suporte.", 503);
    if (s === 429 || s === 529 || s === 503 || s === 0) return erro("A IA está congestionada neste momento. Espere uns segundos e peça de novo.", 503);
    return erro("Não consegui falar com o funcionário agora.", 502);
  }

  let saida: { fala?: string; acao?: { nome?: string; args?: Record<string, unknown> } | null };
  try { saida = JSON.parse(resposta.texto.slice(resposta.texto.indexOf("{"), resposta.texto.lastIndexOf("}") + 1)); } catch {
    return resp({ fala: "Não entendi direito. Pode falar de outro jeito?", acao: null });
  }
  const nome = saida.acao?.nome && /^[a-z_]{3,30}$/.test(saida.acao.nome) ? saida.acao.nome : null;
  return resp({
    fala: String(saida.fala || "Pronto.").slice(0, 400),
    acao: nome && nome !== "nada" ? { nome, args: saida.acao?.args && typeof saida.acao.args === "object" ? saida.acao.args : {} } : null,
  });
});
