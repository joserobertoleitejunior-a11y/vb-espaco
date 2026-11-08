# Ala de criadores de conteúdo

Estudo e desenho. Nada aqui foi construído ainda. A meta é uma **ala própria** para influenciadores e
videomakers freelancers venderem vídeos para empresas, e uma forma de os vídeos **rodarem dentro do
app** e **renderem dinheiro** para o criador e para a plataforma.

## 1. Visão em uma frase

> Um catálogo de criadores onde o estabelecimento contrata um vídeo, e o vídeo é publicado no perfil
> dele e nas áreas de divulgação do app — com comissão para o criador por cada cliente que o vídeo trouxer.

## 2. O perfil do criador (a "vitrine")

- Foto, nome, @, cidade e regiões onde grava, nicho (comida, beleza, moda, serviços, eventos…)
- Redes: Instagram, TikTok, YouTube, com seguidores (declarado; depois verificado)
- **Portfólio:** vídeos (link de Instagram/TikTok/YouTube no começo; upload depois)
- **Catálogo de serviços e preços**, no mesmo formato do catálogo de serviços do app:
  - "Reels de 30 s" — R$ X
  - "Pacote 4 vídeos/mês" — R$ Y
  - "Cobertura de evento" — a partir de R$ Z
  - "Contrato mensal de conteúdo" — R$ W/mês
  - "Sob orçamento" para o que não tem preço fixo
- Cada serviço informa: prazo, nº de revisões incluídas, e **direito de uso** (só orgânico / pode virar
  anúncio pago / exclusividade). Isso evita briga depois.
- Selos: "verificado", "X vídeos entregues", avaliação das empresas.

## 3. Os dois caminhos de dinheiro

**A) Trabalho contratado (freelancer)**
1. A empresa abre o perfil do criador, escolhe um serviço (ou pede orçamento) e escreve o briefing.
2. O criador aceita (ou contrapropõe).
3. A empresa paga — o valor fica **retido** até a entrega ser aprovada (custódia).
4. O criador entrega (link/arquivo). A empresa aprova ou pede revisão.
5. Pagamento liberado ao criador, menos a **taxa da plataforma (sugestão: 10% a 15%)**.

**B) Divulgação com comissão (afiliado)**
- O criador posta vídeo sobre um estabelecimento que **já existe no app** e recebe um **link ou cupom
  rastreável**. O estabelecimento aprova o vídeo antes de ir ao ar.
- Cada pedido ou agendamento vindo do link gera comissão (sugestão: estabelecimento escolhe de 5% a
  10% do valor; a plataforma retém uma parte, por exemplo 30% dessa comissão).
- O app **já mede** visualização, clique, agendamento e pedido por anúncio (`anuncios` e
  `anuncio_conversoes`). A comissão se apoia nesses mesmos números.

## 4. Onde o vídeo aparece no app

1. **Perfil do estabelecimento:** faixa "Vídeos de quem já foi" (só vídeos aprovados pelo dono).
2. **Explorar / home da cidade:** carrossel de vídeos em destaque por cidade e categoria.
3. **Áreas de anúncio** que já existem: o anúncio ganha um vídeo no lugar da foto.
4. **Perfil do criador:** todos os vídeos que ele fez, com link para cada estabelecimento.

O vídeo pode ser **incorporado** (Instagram, TikTok e YouTube permitem) no começo, sem armazenar nada.
Isso evita custo de armazenamento e banda. Upload próprio fica para uma fase posterior.

## 5. Dados (proposta de tabelas)

`criadores`, `criador_servicos` (pacotes e preços), `criador_portfolio`, `briefings` (pedidos de
orçamento), `contratos` (valor, status, taxa), `entregas`, `videos_publicados` (video_url,
estabelecimento_id, criador_id, status de aprovação, área), `comissoes` (conversão → valor).
Tudo com RLS e funções `security definer`, como o resto do banco.

## 6. Fases (cada uma já entrega valor sozinha)

| Fase | O que entrega | Pagamento? | Tamanho |
|---|---|---|---|
| **1** | Perfil de criador + catálogo + página pública + "pedir orçamento" (briefing por formulário e WhatsApp) | não | ~1 semana |
| **2** | Vídeos nos perfis dos estabelecimentos (incorporados, com aprovação do dono) + vitrine "Criadores" no explorar + link/cupom rastreável | não | ~1 semana |
| **3** | Contratação paga com custódia e **comissão por conversão** (Mercado Pago marketplace, cada criador conecta a própria conta) | sim | 2 a 3 semanas |
| **4** | Upload de vídeo no app, ranking, painel de ganhos, saque | sim | depois |

A fase 1 e a 2 não mexem com dinheiro, então saem rápido e já testam se tem demanda dos dois lados
(criadores e empresas).

## 7. Riscos que precisam de decisão antes da fase 3

- **Direitos autorais** (música em vídeo) e **direito de imagem** (clientes que aparecem).
- **Publicidade identificada** (#publi): o app deve avisar o criador e marcar o vídeo.
- **Verificação de identidade** (CPF) para quem recebe dinheiro.
- **Impostos:** a plataforma recebendo comissão e repassando a criadores pode exigir CNPJ e emissão de
  nota. **Vale conversar com um contador antes de ligar dinheiro.**
- **Fraude:** clique e pedido falsos para inflar comissão. O app já guarda o telefone do cliente, então
  dá para exigir cliente real e pedido concluído antes de pagar comissão.
- **Disputas:** entrega fora do combinado. Regras claras de revisão e prazo nos termos.

## 8. Decisões que dependem de você

1. Começar pela fase 1 + 2 (sem dinheiro) para testar a demanda? **(recomendado)**
2. Taxa da plataforma: 10%, 15% ou outra? Comissão por conversão: quanto fica com a plataforma?
3. O criador paga algo para estar na ala (assinatura) ou só a comissão? Sugestão: grátis no começo.
4. Quem entra: só criadores com perfil verificado, ou aberto a qualquer um?

## 11. Decisões de novembro (substituem as sugestões acima onde conflitam)

- **Indicação vale de qualquer lugar:** link `…/criar.html?ref=CÓDIGO`; o código fica guardado 60 dias (`assets/js/indicacao.js`) e é gravado quando o negócio é criado (`indicacao_registrar`).
- **Comissão: 15% de cada pagamento aprovado** do negócio indicado, todo mês, enquanto ele pagar. Calculada no webhook do Mercado Pago (`criador_comissao_registrar`); reembolso cancela a comissão (`criador_comissao_cancelar`). Repasse ao criador é manual no começo (status `a_pagar` → `paga`).
- **Plano do criador: R$ 4,90/mês** (suposição a confirmar). Com 4 negócios pagando, a comissão já cobre o plano. A cobrança do plano do criador ainda não foi ligada.
- **Locais de anúncio à venda** (tabela `anuncio_locais`, preço por semana): topo da busca, página da cidade, áreas Agendar/Pedir/Chamar, vídeo no perfil de outro negócio. Pedido = `anuncio_reservas` (status `pedido`); pagamento e publicação ainda manuais.
- SQL: `supabase/sql/2026_11_criadores_indicacao_anuncios.sql` (não aplicado). Página: `criadores.html`.
