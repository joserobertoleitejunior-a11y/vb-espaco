# Mercado Pago — mensalidade da plataforma (Fase A)

Já está pronto e publicado: banco (`mp_cobrancas`), as duas edge functions
(`mp-criar-cobranca` e `mp-webhook`, já no ar) e o botão "Pagar agora" no
painel do dono. Falta só a sua parte — sem isso, o botão dá erro
"Mercado Pago ainda não configurado".

## O que essa fase faz

Cada estabelecimento tem 30 dias de teste grátis (`trial_termina_em`).
Quando o dono clica "Pagar R$ 39,90 agora" no painel, abre o Checkout Pro
do Mercado Pago (Pix, cartão ou boleto, o que você deixar habilitado na
sua conta). Ao aprovar, a assinatura fica "em dia" por mais 30 dias a
partir de hoje (ou a partir do fim do período atual, se ele ainda não
tiver acabado). **Isso é cobrança manual, mensal** — o dono precisa
voltar e pagar de novo todo mês (ainda não é débito automático recorrente
— fica pra uma fase 2 se quiser, usando a API de Assinaturas do Mercado
Pago em vez do Checkout Pro).

## O que só você consegue fazer

1. **Conta de vendedor no Mercado Pago** (se ainda não tiver uma pra este
   negócio): [mercadopago.com.br](https://www.mercadopago.com.br), cria a
   conta com CPF ou CNPJ.
2. **Criar uma aplicação em Mercado Pago Developers**:
   [mercadopago.com.br/developers/panel](https://www.mercadopago.com.br/developers/panel)
   → "Criar aplicação" → tipo "Pagamentos online" → "Checkout Pro".
3. **Pegar o Access Token**: na aplicação criada, aba "Credenciais de
   produção" (ou "Credenciais de teste", pra testar primeiro sem dinheiro
   de verdade) → copia o **Access Token** (começa com `APP_USR-` na
   produção, `TEST-` no teste).
4. **Guardar como secret no Supabase** (nunca no chat, nunca no código):
   painel do Supabase → projeto `vb-espaco` (`oeracgvnuomcaydmizzj`) →
   **Project Settings → Edge Functions → Secrets** → "Add new secret":
   - Nome: `MP_ACCESS_TOKEN`
   - Valor: o Access Token que você copiou
   
   Opcional (só se quiser mudar o link de retorno do pagamento antes de
   trocar de domínio):
   - Nome: `SITE_URL`
   - Valor: `https://vb-espaco.joserobertoleitejunior.workers.dev` (sem
     barra no final) — quando o domínio próprio entrar, atualiza aqui.
5. **Configurar o Webhook** (pra eu saber quando um pagamento é aprovado):
   na mesma aplicação → aba "Webhooks" → "Configurar notificações" →
   URL: `https://oeracgvnuomcaydmizzj.supabase.co/functions/v1/mp-webhook`
   → marca o evento **Pagamentos**.
6. **Testar com credenciais de teste primeiro** (recomendado): use um
   [usuário de teste comprador](https://www.mercadopago.com.br/developers/panel/test-users)
   pra simular um pagamento Pix/cartão de teste antes de ativar de
   verdade com as credenciais de produção.

## Depois que os secrets estiverem configurados

Me avisa (só que "configurei", não precisa mandar o token) que eu:
- testo o fluxo completo (criar cobrança → pagar no sandbox → webhook
  confirma → assinatura vira "em dia" no painel);
- confiro os logs da função pra garantir que não sobrou nenhum erro.

## Onde cada coisa mora

- **Tabela**: `public.mp_cobrancas` (histórico, uma linha por cobrança).
- **Funções**: `supabase/functions/mp-criar-cobranca` (cria o link de
  pagamento) e `supabase/functions/mp-webhook` (confirma o pagamento
  direto na API do Mercado Pago — nunca confia só no aviso).
- **Painel**: `assets/js/cadastro.js`, função `pagamentoCardHtml` (o
  cartão verde/vermelho de cada estabelecimento) e o clique em
  `[data-pagar-mensalidade]`.

## Fases seguintes (não feitas ainda)

- **Fase B**: cliente final paga online (Pix/cartão) direto no
  agendamento/pedido, não só o dono.
- **Fase C**: split automático de 5% — marketplace do Mercado Pago, cada
  dono conecta a própria conta via OAuth.
