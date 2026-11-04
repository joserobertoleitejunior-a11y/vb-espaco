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

// Os modelos 2.5 foram aposentados para contas novas (o Google responde 404 e indica os
// substitutos). Corremos três ao mesmo tempo: o primeiro sai na hora, o segundo aos 2,5 s e o
// terceiro aos 5 s — vale a primeira resposta boa. Assim um modelo lotado (503) não segura o dono.
const MODELOS = [
  Deno.env.get("GEMINI_MODELO") || "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// O Google aposenta modelos de tempos em tempos (responde 404). Em vez de o app quebrar
// esperando alguém trocar o nome na mão, ele pergunta ao próprio Google quais modelos esta
// chave pode usar e passa a usar esses. A lista fica guardada enquanto a função está de pé.
let descobertos: string[] | null = null;
async function descobrirModelos(chave: string): Promise<string[]> {
  if (descobertos) return descobertos;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": chave },
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json().catch(() => null);
    const nomes: string[] = (d?.models || [])
      .filter((m: { supportedGenerationMethods?: string[] }) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m: { name?: string }) => String(m.name || "").replace("models/", ""))
      // fora o que não serve pra conversar: imagem, áudio, embeddings, experimentais
      .filter((n: string) => /flash|pro/.test(n) && !/image|audio|tts|embedding|live|vision|exp|thinking/.test(n));
    // os "lite" primeiro (respondem mais rápido), depois os flash comuns
    nomes.sort((a, b) => (b.includes("lite") ? 1 : 0) - (a.includes("lite") ? 1 : 0));
    console.log("assistente: modelos desta chave:", nomes.join(", ") || "(nenhum)");
    descobertos = nomes.slice(0, 3);
    return descobertos;
  } catch (e) {
    console.error("assistente: não consegui listar os modelos:", String(e));
    return [];
  }
}

// Como pedir "pouco pensamento": os modelos 3.x usam thinkingLevel; os 2.x, thinkingBudget.
// Se o modelo recusar (400), tentamos a próxima opção e, por último, sem a opção nenhuma.
function opcoesPensar(modelo: string): (Record<string, unknown> | null)[] {
  if (/gemini-3/.test(modelo)) return [{ thinkingLevel: "minimal" }, { thinkingLevel: "low" }, null];
  return [{ thinkingBudget: 0 }, null];
}

async function umModelo(chave: string, modelo: string, corpo: Record<string, unknown>): Promise<string> {
  let ultimo: { status: number; quota?: boolean } = { status: 0 };
  for (const pensar of opcoesPensar(modelo)) {
    const gc = { ...(corpo.generationConfig as Record<string, unknown>) };
    delete gc.thinkingConfig;
    if (pensar) gc.thinkingConfig = pensar;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({ ...corpo, generationConfig: gc }),
      signal: AbortSignal.timeout(12000),
    });
    if (r.ok) {
      const d = await r.json().catch(() => null);
      const texto = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
      if (!texto) throw { status: 502 };
      return texto;
    }
    const txt = (await r.text().catch(() => "")).slice(0, 300);
    console.error("gemini", modelo, r.status, txt.slice(0, 160));
    ultimo = { status: r.status, quota: r.status === 429 && /quota/i.test(txt) };
    if (r.status !== 400) break;   // só o 400 (opção recusada) pede outra tentativa neste modelo
  }
  throw ultimo;
}

// Corre vários modelos: o primeiro sai na hora, o segundo aos 2,5 s, o terceiro aos 5 s.
// Vale a primeira resposta boa — um modelo lotado não segura o dono.
function corrida(chave: string, corpo: unknown, lista: string[]): Promise<{ texto: string } | { erroStatus: number; teve404: boolean; quota: boolean }> {
  return new Promise((ok) => {
    if (!lista.length) return ok({ erroStatus: 404, teve404: true, quota: false });
    let falhas = 0, ultimo = 0, teve404 = false, quota = false, acabou = false;
    const lancados = new Set<number>();
    const lanca = (i: number) => {
      if (acabou || lancados.has(i) || i >= lista.length) return;
      lancados.add(i);
      umModelo(chave, lista[i], corpo as Record<string, unknown>).then(
        (texto) => { if (!acabou) { acabou = true; console.log("assistente: venceu", lista[i]); ok({ texto }); } },
        (e) => {
          const st = (e && e.status) || 0;
          console.error("assistente: falhou", lista[i], st || String(e));
          if (st === 404) teve404 = true; else if (st) ultimo = st;   // estouro de tempo (st 0) não apaga um 429 já visto
          if (e && e.quota) quota = true;
          falhas++;
          lanca(i + 1);                                   // falhou: chama o próximo já
          if (falhas >= lista.length && !acabou) { acabou = true; ok({ erroStatus: ultimo || (teve404 ? 404 : 503), teve404, quota }); }
        },
      );
    };
    lanca(0);
    espera(2500).then(() => lanca(1));
    espera(5000).then(() => lanca(2));
  });
}

async function pedirAoGemini(chave: string, corpo: unknown): Promise<{ texto: string } | { erroStatus: number; quota?: boolean }> {
  const r = await corrida(chave, corpo, descobertos || MODELOS);
  if ("texto" in r) return r;
  // algum nome de modelo não existe mais: pergunta ao Google quais existem e tenta de novo
  if (r.teve404 && !descobertos) {
    const lista = await descobrirModelos(chave);
    if (lista.length) {
      const r2 = await corrida(chave, corpo, lista);
      if ("texto" in r2) return r2;
      return { erroStatus: r2.erroStatus, quota: r2.quota };
    }
  }
  return { erroStatus: r.erroStatus, quota: r.quota };
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
  Se ele quiser mexer num item específico, use mudar_preco_item, mudar_nome_item ou disponibilidade_item.
- VOCÊ NÃO EDITA O SITE (fotos, textos, estilo, cores, galeria, endereço do site): isso o dono faz na aba "Meu site", pelo editor. Se pedirem, explique isso em uma frase e mande "acao": null.
- Gráficos e números: pra mostrar faturamento, semana, mês ou dashboard use "mostrar_dashboard" (o gráfico aparece no chat). Escolha o período mais próximo do que ele pediu.

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
      return erro(`Você já usou as ${uso.limite} mensagens de hoje. O limite volta amanhã — enquanto isso, os botões do painel continuam funcionando normalmente.`, 429);
    }
  }

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
    generationConfig: { temperature: 0.2, maxOutputTokens: 900, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
  });
  console.log("assistente: gemini respondeu em", Date.now() - t0, "ms");
  if ("erroStatus" in resposta) {
    const s = resposta.erroStatus;
    // dizemos a verdade: a fila é do Google, não é defeito do app nem do dono
    if ("quota" in resposta && resposta.quota) return erro("A cota gratuita da IA (Google) acabou por agora. Ela volta sozinha quando renovar. Enquanto isso os botões do painel funcionam normalmente.", 503);
    if (s === 429 || s === 503) return erro("A IA está congestionada neste momento. Espere uns segundos e peça de novo.", 503);
    if (s === 404) return erro("O funcionário precisa de um ajuste técnico (o modelo de IA mudou de nome). Avise o suporte.", 503);
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
