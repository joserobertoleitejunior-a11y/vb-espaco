// Lê o cardápio (ou a lista de serviços) de uma FOTO e devolve os itens já
// separados por categoria, com nome, descrição e preço — pro dono só conferir
// e salvar. Quem lê a imagem é o Gemini; a chave fica aqui no servidor
// (secret GEMINI_API_KEY), nunca no navegador.
//
// POST { imagem: "data:image/jpeg;base64,...", tipo?: "cardapio" | "servicos" }
//   → { categorias: [{ nome, itens: [{ nome, descricao, preco }] }], promocoes: [{ nome, descricao, preco, qtd_sabores }], aviso? }
//
// Só pra dono logado: o Authorization do Supabase precisa valer.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const erro = (msg: string, status = 400) => resp({ erro: msg }, status);

// Congestionamento no Google (503/429) é passageiro: esperamos um pouco e
// repetimos; se o modelo preferido continuar lotado, tentamos o irmão mais
// leve. Erro que não é congestionamento não melhora repetindo, então volta
// na hora. Os nomes "latest" são apelidos do Google e não quebram quando
// uma versão do modelo é aposentada.
// Ler foto é trabalho pesado: aqui vamos em fila mesmo (um por vez), mas com
// limite de tempo, pra um modelo lotado não deixar o dono esperando à toa.
const MODELOS = [Deno.env.get("GEMINI_MODELO") || "gemini-3.8-flash", "gemini-flash-latest", "gemini-3.5-flash-lite"];
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const LIMITE_BYTES = 6 * 1024 * 1024; // ~6 MB de imagem já é foto grande demais

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
          signal: AbortSignal.timeout(50000), // ler foto demora, mas não pode ser pra sempre
        });
      } catch (e) {
        console.error("fetch gemini falhou", modelo, String(e));
        status = 0;
        break; // estourou o tempo: vai pro próximo modelo
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
      if (status === 404) break;   // modelo aposentado: tenta o próximo nome, não insiste neste
      if (status !== 429 && status !== 503 && status < 500) return { erroStatus: status };
      if (status === 503 || status === 429) break; // lotado: troca de modelo na hora
      await espera(400 * (n + 1));
    }
  }
  return { erroStatus: status };
}

function instrucao(tipo: string) {
  const oQue = tipo === "servicos" ? "serviços" : "itens do cardápio";
  return `Você lê a foto de um ${tipo === "servicos" ? "catálogo de serviços" : "cardápio"} brasileiro e devolve os ${oQue} em JSON.

Regras:
- Responda SÓ o JSON, sem texto em volta e sem blocos de código.
- Formato: {"categorias":[{"nome":"...","itens":[{"nome":"...","descricao":"...","preco":0}]}],"extras":[],"promocoes":[{"nome":"...","descricao":"...","preco":0,"qtd_sabores":2}]}
- "promocoes" são ofertas e combos (ex.: "2 pizzas grandes por R$ 79,90", "Terça: pizza + refri"). "preco" é o preço fechado da promoção; "qtd_sabores" é quantas pizzas/sabores o cliente escolhe (1 se não for de sabores). Coloque aí só o que é promoção, nunca repita no cardápio normal. Se não houver, use [].
- Foto que é SÓ uma promoção: devolva "categorias":[] e a promoção em "promocoes".
- "preco" é número em reais (ex.: 42.90). Se o preço não estiver legível, use 0.
- "descricao" é curta (até 90 caracteres); se não houver, use "".
- Use as categorias que aparecem na foto, na ordem em que aparecem. Se não houver nenhuma, use uma só, chamada "Cardápio".
- Títulos de seção, endereço, telefone, horário e propaganda NÃO são itens.
- Se o mesmo item tem mais de um tamanho/preço (ex.: Broto 30, Grande 45), crie um item para cada, com o tamanho no nome: "Calabresa (Grande)".
- Pegue os ingredientes como "descricao" (ex.: "Molho, mussarela, calabresa e cebola."). Se houver, não invente.
- Preço escrito como "R$ 37,90", "37,9" ou "37" vira 37.90. "Consulte" ou ilegível vira 0.
- Bordas recheadas, adicionais e taxas NÃO entram como item: coloque-os em "extras": [{"nome":"Borda Catupiry","preco":8}].
- Copie os nomes como estão escritos, só arrumando MAIÚSCULAS para a forma normal.
- Não invente item nenhum: só o que dá pra ler na foto.
- Se a foto não for um ${tipo === "servicos" ? "catálogo" : "cardápio"} nem tiver promoção, devolva {"categorias":[],"promocoes":[]}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("Método inválido.", 405);

  // A chave vem de um campo que aceita várias linhas: um Enter ou um espaço
  // sem querer no fim entrava no endereço e a chamada estourava antes de sair.
  // Tiramos tudo o que não é a chave, e ela vai no cabeçalho x-goog-api-key em
  // vez da URL — assim ela não aparece em log nenhum.
  const chave = (Deno.env.get("GEMINI_API_KEY") || "").replace(/\s+/g, "");
  if (!chave) { console.error("ler-cardapio: sem GEMINI_API_KEY"); return erro("A leitura por foto ainda não foi ligada neste app.", 503); }

  // só dono logado usa (a chamada gasta cota)
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + jwt } },
  });
  const { data: quem } = await db.auth.getUser();
  if (!quem?.user) { console.error("ler-cardapio: sem sessão"); return erro("Entre na sua conta primeiro.", 401); }

  let corpo: { imagem?: string; tipo?: string; estabId?: string };
  try { corpo = await req.json(); } catch (e) {
    console.error("ler-cardapio: corpo não é JSON", String(e));
    return erro("Pedido inválido.");
  }

  // deixa rastro do que chegou: sem isso, "não consegui ler" vira adivinhação.
  // Só o começo do data URL e o tamanho — nada da imagem em si vai pro log.
  const img = corpo.imagem || "";
  console.log("ler-cardapio: recebi", img.slice(0, 32), Math.round(img.length / 1024) + "KB", "tipo=" + (corpo.tipo || "cardapio"));

  // Limite justo por estabelecimento (fotos gastam bem mais que texto). Sem a função no banco, deixa passar.
  if (corpo.estabId && /^[0-9a-f-]{36}$/i.test(corpo.estabId)) {
    const { data: uso, error: eUso } = await db.rpc("assistente_consumir", { p_estabelecimento_id: corpo.estabId, p_tipo: "foto" });
    if (eUso) console.error("ler-cardapio: contagem de uso indisponível:", eUso.message);
    else if (uso && uso.ok === false) return erro(String(uso.mensagem || "Seus créditos de IA acabaram por agora. Dá pra cadastrar os itens pelo painel."), 429);
  }

  const m = /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/=]+)$/.exec(img);
  if (!m) {
    console.error("ler-cardapio: formato recusado", img.slice(0, 48));
    return erro("Mande uma foto (JPG, PNG ou WebP).");
  }
  if (m[2].length * 0.75 > LIMITE_BYTES) {
    console.error("ler-cardapio: foto grande demais", Math.round(m[2].length * 0.75 / 1024) + "KB");
    return erro("Foto muito pesada — tire de mais perto ou mande em partes.");
  }

  const resposta = await pedirAoGemini(chave, {
    contents: [{ parts: [{ text: instrucao(corpo.tipo || "cardapio") }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
    // foto de cardápio é difícil (letra pequena, colunas): um pouco de "pensamento" melhora a leitura
    generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } },
  });
  if ("erroStatus" in resposta) {
    const s = resposta.erroStatus;
    if (s === 429 || s === 503) return erro("A IA está congestionada neste momento. Espere uns segundos e mande a foto de novo.", 503);
    if (s === 400 || s === 401 || s === 403) return erro("A leitura por foto não está ligada direito neste app.", 503);
    return erro("Não consegui falar com o leitor de fotos agora.", 502);
  }

  let lido: { categorias?: { nome?: string; itens?: { nome?: string; descricao?: string; preco?: unknown }[] }[]; promocoes?: { nome?: string; descricao?: string; preco?: unknown; qtd_sabores?: unknown }[]; extras?: { nome?: string; preco?: unknown }[] };
  try { lido = JSON.parse(resposta.texto.replace(/^```(?:json)?|```$/g, "").trim()); } catch {
    console.error("ler-cardapio: a IA não devolveu JSON", resposta.texto.slice(0, 200));
    return erro("Não consegui ler essa foto. Tente uma mais nítida.");
  }

  // limpa o que veio: nada de nome vazio, preço estranho ou lista gigante
  const categorias = (lido.categorias || []).slice(0, 12).map((c) => ({
    nome: String(c.nome || "Cardápio").trim().slice(0, 40) || "Cardápio",
    itens: (c.itens || []).slice(0, 60).map((i) => {
      const preco = Number(String(i.preco ?? 0).replace(",", "."));
      return {
        nome: String(i.nome || "").trim().slice(0, 80),
        descricao: String(i.descricao || "").trim().slice(0, 90),
        preco: Number.isFinite(preco) && preco > 0 && preco < 100000 ? Math.round(preco * 100) / 100 : 0,
      };
    }).filter((i) => i.nome),
  })).filter((c) => c.itens.length);

  const promocoes = (lido.promocoes || []).slice(0, 12).map((x) => {
    const preco = Number(String(x.preco ?? 0).replace(",", "."));
    const q = Math.round(Number(x.qtd_sabores));
    return {
      nome: String(x.nome || "").trim().slice(0, 80),
      descricao: String(x.descricao || "").trim().slice(0, 140),
      preco: Number.isFinite(preco) && preco > 0 && preco < 100000 ? Math.round(preco * 100) / 100 : 0,
      qtd_sabores: Number.isFinite(q) && q >= 1 && q <= 6 ? q : 1,
    };
  }).filter((x) => x.nome);

  const extras = (lido.extras || []).slice(0, 12).map((x) => {
    const preco = Number(String(x.preco ?? 0).replace(",", "."));
    return { nome: String(x.nome || "").trim().slice(0, 60), preco: Number.isFinite(preco) && preco > 0 && preco < 10000 ? Math.round(preco * 100) / 100 : 0 };
  }).filter((x) => x.nome);

  const total = categorias.reduce((t, c) => t + c.itens.length, 0);
  return resp({
    categorias,
    promocoes,
    extras,
    aviso: total + promocoes.length ? "Confira os preços antes de salvar — a leitura da foto pode errar." : "Não achei nenhum item nessa foto. Tente com mais luz, mais perto ou sem cortar as bordas.",
  });
});
