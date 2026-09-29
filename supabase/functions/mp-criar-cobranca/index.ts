// Cria uma cobrança da mensalidade da plataforma no Mercado Pago
// (Checkout Pro) pro dono de um estabelecimento e devolve o link de
// pagamento. Chamada pelo painel: supabase.functions.invoke('mp-criar-cobranca', { body: { estabelecimento_id } })
//
// Segredos necessários (Project Settings → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN — token de produção ou teste do Mercado Pago
//   SITE_URL        — ex: https://vb-espaco.joserobertoleitejunior.workers.dev (sem barra no fim)
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "método não permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
  const SITE_URL = Deno.env.get("SITE_URL") || "https://vb-espaco.joserobertoleitejunior.workers.dev";

  if (!MP_TOKEN) {
    return resposta({ erro: "Mercado Pago ainda não configurado (falta o secret MP_ACCESS_TOKEN)." }, 500);
  }

  // identifica quem está chamando pelo JWT que o painel manda (o Supabase
  // já confere a assinatura antes de rodar a função; aqui só lemos quem é)
  const authHeader = req.headers.get("Authorization") || "";
  const clienteChamador = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErro } = await clienteChamador.auth.getUser();
  if (userErro || !userData?.user) return resposta({ erro: "Sessão inválida — entre de novo." }, 401);

  let corpo: { estabelecimento_id?: string };
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "Corpo inválido." }, 400);
  }
  const estabelecimentoId = corpo.estabelecimento_id;
  if (!estabelecimentoId) return resposta({ erro: "Falta estabelecimento_id." }, 400);

  // service role: ignora RLS pra confirmar que é dono de verdade e ler a mensalidade
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: estab, error: estabErro } = await admin
    .from("estabelecimentos")
    .select("id, nome, mensalidade, dono_user_id")
    .eq("id", estabelecimentoId)
    .single();
  if (estabErro || !estab) return resposta({ erro: "Estabelecimento não encontrado." }, 404);
  if (estab.dono_user_id !== userData.user.id) return resposta({ erro: "Sem permissão pra este estabelecimento." }, 403);

  const valor = Number(estab.mensalidade) || 39.9;

  const preferencia = {
    items: [
      {
        title: "Assinatura Pertin — " + estab.nome,
        quantity: 1,
        currency_id: "BRL",
        unit_price: valor,
      },
    ],
    external_reference: estabelecimentoId,
    back_urls: {
      success: SITE_URL + "/painel-area.html?pagamento=aprovado",
      pending: SITE_URL + "/painel-area.html?pagamento=pendente",
      failure: SITE_URL + "/painel-area.html?pagamento=recusado",
    },
    auto_return: "approved",
    notification_url: SUPABASE_URL + "/functions/v1/mp-webhook",
    statement_descriptor: "PERTIN",
  };

  const mpResposta = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + MP_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferencia),
  });
  const mpDados = await mpResposta.json();
  if (!mpResposta.ok) {
    console.error("mercado pago recusou a preferência", mpDados);
    return resposta({ erro: "Não deu pra criar a cobrança agora. Tenta de novo em instantes." }, 502);
  }

  await admin.from("mp_cobrancas").insert({
    estabelecimento_id: estabelecimentoId,
    mp_preference_id: mpDados.id,
    valor,
    status: "pendente",
  });

  // sandbox_init_point existe quando o token é de teste; produção usa init_point
  return resposta({ init_point: mpDados.init_point || mpDados.sandbox_init_point });
});
