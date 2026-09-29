// Recebe o aviso do Mercado Pago quando um pagamento muda de status.
// NUNCA confia no conteúdo do aviso em si — sempre busca o pagamento de
// novo direto na API do Mercado Pago, com o nosso token secreto, e só
// então decide o que fazer. Sempre responde 200 rápido (o Mercado Pago
// tenta de novo se não receber 200, então erro nosso não pode travar o
// aviso — só registra e segue).
//
// Configurar no Mercado Pago Developers: Webhooks → URL de notificação:
//   https://oeracgvnuomcaydmizzj.supabase.co/functions/v1/mp-webhook
//
// Segredos necessários (iguais aos da mp-criar-cobranca):
//   MP_ACCESS_TOKEN
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    if (!MP_TOKEN) {
      console.error("MP_ACCESS_TOKEN não configurado");
      return new Response("ok", { status: 200 });
    }

    // o Mercado Pago manda o id do pagamento tanto no corpo (formato novo,
    // { type: 'payment', data: { id } }) quanto na querystring (formato
    // antigo, ?topic=payment&id=...) — aceita os dois
    const url = new URL(req.url);
    let paymentId = url.searchParams.get("id") || url.searchParams.get("data.id");
    let topico = url.searchParams.get("topic") || url.searchParams.get("type");
    if (!paymentId && req.method === "POST") {
      try {
        const corpo = await req.json();
        paymentId = corpo?.data?.id || corpo?.id || null;
        topico = corpo?.type || corpo?.action || topico;
      } catch {
        // corpo vazio ou não-JSON — tudo bem, tenta pela querystring mesmo
      }
    }
    if (!paymentId || (topico && topico !== "payment" && !String(topico).startsWith("payment."))) {
      return new Response("ok", { status: 200 }); // outro tipo de aviso (ex: merchant_order) — ignora
    }

    // busca o pagamento de verdade na API do Mercado Pago — é a única
    // fonte confiável de status
    const mpResposta = await fetch("https://api.mercadopago.com/v1/payments/" + paymentId, {
      headers: { Authorization: "Bearer " + MP_TOKEN },
    });
    if (!mpResposta.ok) {
      console.error("não achou o pagamento no Mercado Pago", paymentId, mpResposta.status);
      return new Response("ok", { status: 200 });
    }
    const pagamento = await mpResposta.json();
    const estabelecimentoId = pagamento.external_reference;
    const status = pagamento.status; // approved | pending | rejected | cancelled | refunded | ...
    if (!estabelecimentoId) return new Response("ok", { status: 200 });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const statusCobranca = status === "approved" ? "aprovado" : status === "rejected" || status === "cancelled" ? "recusado" : "pendente";

    // grava/atualiza a cobrança por mp_payment_id — reprocessar o mesmo
    // aviso duas vezes não duplica nem soma dias de novo
    const { data: existente } = await admin
      .from("mp_cobrancas")
      .select("id, status")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    if (existente) {
      if (existente.status !== statusCobranca) {
        await admin.from("mp_cobrancas").update({
          status: statusCobranca,
          pago_em: status === "approved" ? new Date().toISOString() : null,
        }).eq("id", existente.id);
      }
    } else {
      await admin.from("mp_cobrancas").insert({
        estabelecimento_id: estabelecimentoId,
        mp_payment_id: String(paymentId),
        mp_preference_id: pagamento.order?.id ? String(pagamento.order.id) : null,
        valor: pagamento.transaction_amount,
        status: statusCobranca,
        pago_em: status === "approved" ? new Date().toISOString() : null,
      });
    }

    // só estende a assinatura na primeira vez que este pagamento aparece
    // como aprovado (existente == null ou ainda não estava aprovado antes)
    const eraNovoAprovado = status === "approved" && (!existente || existente.status !== "aprovado");
    if (eraNovoAprovado) {
      const { data: estab } = await admin
        .from("estabelecimentos")
        .select("trial_termina_em")
        .eq("id", estabelecimentoId)
        .single();
      const hoje = new Date();
      const baseAtual = estab?.trial_termina_em ? new Date(estab.trial_termina_em + "T00:00:00") : hoje;
      const base = baseAtual > hoje ? baseAtual : hoje;
      base.setDate(base.getDate() + 30);
      await admin.from("estabelecimentos").update({
        pagamento_status: "em_dia",
        trial_termina_em: base.toISOString().slice(0, 10),
      }).eq("id", estabelecimentoId);
    } else if (status === "rejected" || status === "cancelled") {
      // não mexe no pagamento_status aqui: só um novo pagamento aprovado
      // deve mudar o status de "atrasado"/"bloqueado" pra "em dia" — uma
      // recusa isolada não derruba quem já estava em dia
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("erro no webhook do mercado pago", e);
    return new Response("ok", { status: 200 }); // sempre 200 pro Mercado Pago não ficar re-tentando em loop
  }
});
