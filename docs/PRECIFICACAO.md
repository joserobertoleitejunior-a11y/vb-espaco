> **Atualização:** a tabela vigente é 14,90 (1 forma, 80 créditos) · 21,90 (2 formas ou Delivery, 150) · 34,90 (Completo: Delivery + outra forma, ou "IA completa", 400). Os valores abaixo são da versão anterior (10 / 19,90 / 28,99).

# Precificação — regras fechadas e conta de margem

Regras definidas pelo dono (a cobrança ainda está desligada: o app segue grátis na fase de finalização).

| Como o negócio usa o app | Mensalidade | Créditos de IA/mês | Teto por dia |
|---|---|---|---|
| **Só "Chamar"** (pedreiro, eletricista, chaveiro…) | **R$ 10,00** | 40 | 15 |
| **Só Agenda**, ou **2 formas sem Delivery** (ex.: Chamar + Agenda) | **R$ 19,90** | 80 | 25 |
| **Delivery** (cardápio com fotos + Caixa completo), sozinho ou com outras formas | **R$ 28,99** | 150 | 40 |
| *Extra opcional:* **IA Turbo** (troca a cota por 400 créditos) | + R$ 9,90 | 400 | 40 |

O valor sai **sozinho das áreas ligadas** no negócio (a mensalidade é recalculada quando o dono liga ou
desliga Agenda, Delivery ou Chamar). Isso fica no banco, em `assistente_planos` — mudar preço ou cota é
um `UPDATE`, sem mexer no código. A cobrança do Mercado Pago lê esse valor.

## Premissas que EU assumi (confirmar)

1. **Delivery + qualquer outra forma = R$ 28,99** (não soma). Ex.: Delivery + Agenda não vira R$ 19,90 + 28,99.
2. **"2 formas" = Chamar + Agenda** custa R$ 19,90. Agenda + Delivery cai na regra do Delivery.
3. **O "IA Turbo" de R$ 9,90 é sugestão minha** (você não pediu). Se não quiser, é só não oferecer: não afeta o resto.
4. O teste grátis de 30 dias e os "3 meses grátis para os 20 primeiros" continuam como estão.

## Conta de margem (ESTIMATIVA — conferir nos painéis reais nos primeiros dias)

Premissas de custo (não verificadas): taxa do Mercado Pago até ~5% + parte fixa; IA da Anthropic de
~R$ 0,01 a 0,03 por mensagem e de ~R$ 0,10 a 0,30 por foto de cardápio, no pior caso de uso total da cota;
armazenamento de fotos dentro do plano do Supabase.

| Plano | Receita | Taxa de pagamento (~5%) | IA no pior caso | Sobra estimada |
|---|---|---|---|---|
| Chamar R$ 10,00 | 10,00 | ~0,50 | ~1,00 | **~R$ 8,50** |
| Agenda / 2 formas R$ 19,90 | 19,90 | ~1,00 | ~2,00 | **~R$ 16,90** |
| Delivery + Caixa R$ 28,99 | 28,99 | ~1,45 | ~5,00 | **~R$ 22,50** |

Impostos (Simples, nota fiscal) **não entram** nessa conta: confirmar com um contador.

## Custos fixos para cobrir (estimativa)

Supabase Pro (~US$ 25), Cloudflare Workers (pago, se passar do limite grátis), domínio, e o mínimo da
Anthropic. Algo na faixa de **R$ 200 a R$ 300 por mês**. Isso se cobre com **uns 15 a 25 clientes pagantes**
numa mistura dos três planos.

## Riscos e cuidados

- **Chamar a R$ 10,00:** a taxa fixa do meio de pagamento pesa mais (percentualmente). Pix costuma ser
  bem mais barato que cartão. Incentivar Pix na cobrança.
- **Quem liga o Delivery só no mês de cobrança:** o preço sobe na hora porque acompanha as áreas. Avisar o
  dono antes (a tela de ligar/desligar áreas deve mostrar o novo valor).
- **Cobrança hoje é manual todo mês** (Checkout Pro). Para os planos baratos, esquecer de pagar vira
  inadimplência. A fase 2 (débito automático, API de Assinaturas) ajuda muito no plano de R$ 10.
- **Preço do Delivery (R$ 28,99):** justificado por fotos de cardápio + Caixa completo. Deixar isso
  explícito na página de preços.

## Decisões pendentes

1. Confirmar as 4 premissas acima.
2. Oferecer ou não o "IA Turbo".
3. Autônomo sem endereço fixo ("Chamar") pode usar a Agenda também? Se sim, vira R$ 19,90 sozinho.
