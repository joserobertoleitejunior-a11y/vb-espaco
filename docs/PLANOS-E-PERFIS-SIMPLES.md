# Planos pagos e perfis rápidos (pedreiro, diarista, eletricista…)

> **Os preços definitivos estão em `PRECIFICACAO.md`** (Chamar R$ 10,00 · Agenda R$ 19,90 · Delivery R$ 28,99). A tabela de planos abaixo foi a primeira ideia e está superada.

Estudo para decidir. Nada aqui foi construído ainda. Os números de custo são estimativas
(precisam ser conferidos nos painéis da Anthropic e do Mercado Pago nos primeiros dias de uso).

## 1. O problema

Hoje criar o site tem 15 passos (identidade, estilo, cardápio, horário, endereço, redes…). Para
uma pizzaria isso faz sentido. Para um **pedreiro, diarista ou eletricista** é demais:
- não tem loja, então endereço, horário de balcão e cardápio não se aplicam;
- vende **serviço sob orçamento**, não produto com preço fixo;
- decide pelo celular, no meio do dia, e abandona se a tela for longa;
- o que fecha cliente é **WhatsApp + fotos de trabalhos feitos + cidade que atende**.

## 2. Perfil "Autônomo" — 4 passos, 2 minutos

| Passo | Pergunta | O que o app faz sozinho |
|---|---|---|
| 1 | "O que você faz?" (escolhe 1–3 ícones: pedreiro, pintor, eletricista, encanador, diarista…) | segmento, categorias, serviços sugeridos, textos, estilo, fotos de estoque |
| 2 | WhatsApp | botão "Pedir orçamento" liga direto |
| 3 | "Onde você atende?" (cidade + bairros ou "região toda") | no lugar do endereço: área de atendimento, sem pino de loja |
| 4 | "Mande 3 fotos de trabalhos seus" (ou pule) | galeria "Antes e depois", selo de portfólio |

Tudo o mais nasce com padrão do segmento e pode ser editado depois (ou **por comando**).

**Criar falando:** o dono escreve ou grava um áudio: *"sou pedreiro em Itapetininga, faço reforma,
piso, reboco e muro, atendo a região toda"*. A IA preenche segmento, serviços (com "a partir de" ou
"sob orçamento"), cidade e uma apresentação. O dono só confere. Custo: 1 mensagem de IA.

**Orçamento em vez de preço fixo:** cada serviço aceita "a partir de R$", "por m²", "por visita" ou
"sob orçamento". O cliente descreve o serviço (texto + foto) e o pedido chega no WhatsApp do
profissional já organizado. O app já tem o pedido de orçamento com foto (segmento `servicos`).

**Selos de confiança baratos:** "responde rápido", "X trabalhos mostrados", "verificado por
WhatsApp". Avaliações de clientes já existem na plataforma.

## 3. Opções pagas (proposta)

| Plano | Para quem | Preço sugerido | Inclui | Custo estimado de IA/mês | Margem aprox. |
|---|---|---|---|---|---|
| **Autônomo** | pedreiro, diarista, eletricista, freelancer | **R$ 14,90** | perfil rápido, orçamento no WhatsApp, galeria, 30 créditos de IA | R$ 0,30–1,50 | R$ 12+ |
| **Matriz** (atual) | salão, barbearia, loja pequena | R$ 19,90 | site, agenda ou cardápio, 60 créditos | R$ 0,60–3 | R$ 15+ |
| **Matriz + IA** | quem quer o terminal completo | R$ 34,90 | 400 créditos/mês, foto de cardápio, dashboard | até ~R$ 5–6 (teto) | R$ 9+ |
| **Destaque** (avulso) | qualquer plano | R$ 9,90 a R$ 29,90 por semana | aparece no topo das buscas e na home da cidade | quase zero | quase tudo |
| **Criador de conteúdo** | influenciadores e videomakers | R$ 0 + comissão (ver outro documento) | perfil, catálogo, propostas | quase zero | % por contrato |

Observações:
- O plano **Autônomo** custa menos porque o autônomo tem menos receita e menos uso de IA. O risco
  é canibalizar o Matriz: separar pelo **tipo de negócio** (autônomo sem endereço fixo) evita isso.
- Taxa do meio de pagamento (Mercado Pago) deve sair da margem: uns 1% a 5% conforme a forma de pagar.
  A conta acima já deixa folga.
- Teste grátis de 30 dias continua. No fim, o profissional escolhe plano ou fica no "Autônomo grátis
  limitado" (1 serviço, sem IA)? **Decisão sua.**

## 4. O que precisa ser construído (ordem sugerida)

1. Segmentos de autônomo (pedreiro, pintor, eletricista, encanador, diarista, jardineiro, marceneiro…)
   com serviços sugeridos e fotos de estoque — a maior parte já existe em `segmentos.js` e
   `servicos-sugeridos.js`.
2. Assistente de criação rápido (4 passos) como alternativa ao de 15 passos, escolhido pelo segmento.
3. "Área de atendimento" no lugar do endereço (bairros/região) — hoje o site pede endereço.
4. Preço por unidade ("a partir de", "por m²") nos serviços.
5. Criar o perfil por texto/áudio, usando o terminal.
6. Plano Autônomo no pagamento (a tabela `assistente_planos` já tem a estrutura; é adicionar a linha
   e o preço no Mercado Pago).

## 5. Decisões que dependem de você

- Preço do Autônomo: R$ 14,90? Menos? Gratuito com limite?
- Quais segmentos de autônomo entram primeiro (sugestão: pedreiro, pintor, eletricista, encanador, diarista).
- Aceita lançar o Autônomo sem endereço (só região)? (muda o que o cliente vê no site.)
