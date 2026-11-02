// Lê o cardápio (ou a lista de serviços) de uma FOTO e devolve os itens já
// separados por categoria, com nome, descrição e preço — pro dono só conferir
// e salvar. Quem lê a imagem é o Gemini; a chave fica aqui no servidor
// (secret GEMINI_API_KEY), nunca no navegador.
//
// POST { imagem: "data:image/jpeg;base64,...", tipo?: "cardapio" | "servicos" }
//   → { categorias: [{ nome, itens: [{ nome, descricao, preco }] }], aviso? }
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

// o apelido "latest" do Google: não quebra quando uma versão do modelo é aposentada
const MODELO = Deno.env.get("GEMINI_MODELO") || "gemini-flash-latest";
const LIMITE_BYTES = 6 * 1024 * 1024; // ~6 MB de imagem já é foto grande demais

function instrucao(tipo: string) {
  const oQue = tipo === "servicos" ? "serviços" : "itens do cardápio";
  return `Você lê a foto de um ${tipo === "servicos" ? "catálogo de serviços" : "cardápio"} brasileiro e devolve os ${oQue} em JSON.

Regras:
- Responda SÓ o JSON, sem texto em volta e sem blocos de código.
- Formato: {"categorias":[{"nome":"...","itens":[{"nome":"...","descricao":"...","preco":0}]}]}
- "preco" é número em reais (ex.: 42.90). Se o preço não estiver legível, use 0.
- "descricao" é curta (até 90 caracteres); se não houver, use "".
- Use as categorias que aparecem na foto. Se não houver nenhuma, use uma só, chamada "Cardápio".
- Copie os nomes como estão escritos, só arrumando MAIÚSCULAS para a forma normal.
- Não invente item nenhum: só o que dá pra ler na foto.
- Se a foto não for um ${tipo === "servicos" ? "catálogo" : "cardápio"}, devolva {"categorias":[]}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("Método inválido.", 405);

  // A chave vem de um campo que aceita várias linhas: um Enter ou um espaço
  // sem querer no fim entrava no endereço e a chamada estourava antes de sair
  // ("Não consegui falar..."). Tiramos tudo o que não é a chave, e ela vai no
  // cabeçalho x-goog-api-key em vez da URL — assim ela não aparece em log nenhum.
  const chave = (Deno.env.get("GEMINI_API_KEY") || "").replace(/\s+/g, "");
  if (!chave) return erro("A leitura por foto ainda não foi ligada neste app.", 503);

  // só dono logado usa (a chamada gasta cota)
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + jwt } },
  });
  const { data: quem } = await db.auth.getUser();
  if (!quem?.user) return erro("Entre na sua conta primeiro.", 401);

  let corpo: { imagem?: string; tipo?: string };
  try { corpo = await req.json(); } catch { return erro("Pedido inválido."); }

  const m = /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/=]+)$/.exec(corpo.imagem || "");
  if (!m) return erro("Mande uma foto (JPG, PNG ou WebP).");
  if (m[2].length * 0.75 > LIMITE_BYTES) return erro("Foto muito pesada — tire de mais perto ou mande em partes.");

  let r: Response;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        contents: [{ parts: [{ text: instrucao(corpo.tipo || "cardapio") }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: "application/json" },
      }),
    });
  } catch (e) {
    console.error("fetch gemini falhou", MODELO, String(e));
    return erro("Não consegui falar com o leitor de fotos agora.", 502);
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    console.error("gemini", r.status, txt.slice(0, 400));
    return erro(r.status === 429 ? "Muitas fotos de uma vez. Espere um minuto e tente de novo." : "O leitor de fotos não respondeu agora.", 502);
  }

  const d = await r.json().catch(() => null);
  const texto = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  let lido: { categorias?: { nome?: string; itens?: { nome?: string; descricao?: string; preco?: unknown }[] }[] };
  try { lido = JSON.parse(texto.replace(/^```(?:json)?|```$/g, "").trim()); } catch { return erro("Não consegui ler essa foto. Tente uma mais nítida."); }

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

  const total = categorias.reduce((t, c) => t + c.itens.length, 0);
  return resp({
    categorias,
    aviso: total ? "Confira os preços antes de salvar — a leitura da foto pode errar." : "Não achei nenhum item nessa foto. Tente com mais luz, mais perto ou sem cortar as bordas.",
  });
});
