# Vibe

Plataforma única (um app só) pra negócios locais de Itapetininga/SP e região. Cada negócio tem até duas **áreas**, com o mesmo link, o mesmo login e o mesmo painel:

| Área | Pra quem | O cliente… | No painel |
|---|---|---|---|
| **Agenda** | barbearia, salão, manicure, estética, estética automotiva, petshop | agenda serviço, profissional, dia e hora | Agenda |
| **Delivery** | pizzaria, lanche, açaí, mercado, adega, petshop… | pede pelo cardápio/catálogo; o pedido vai pro WhatsApp e pro painel | Delivery |
| **No local** | borracheiro, chaveiro, guincho, eletricista, pedreiro… | chama na hora (com GPS) ou pede orçamento | No local |

Delivery e No local não andam juntos; qualquer um dos dois pode andar junto com a Agenda. "Vibe" é o nome provisório: pra trocar, muda `assets/js/marca.js` (e os `<title>`/meta das páginas). Os padrões fixos da agência estão em `PADROES-AGENCIA.md`.

## Links

Produção: `https://vb-espaco.joserobertoleitejunior.workers.dev` (Cloudflare Workers, deploy automático a cada push na `main`).

| Caminho | Página | O que é |
|---|---|---|
| `/` | `index.html` | **Splash única do Vibe**: "O que você precisa agora?" → Agendar, Pedir, Chamar um profissional, Tenho um negócio/Meu painel. É o único lugar em que a plataforma aparece como site próprio. |
| `/explorar.html?area=agenda\|delivery\|servicos` | `index.html` (mesma página) | Lista de negócios por área, com busca, "perto de mim", filtros e o toggle. Mora na mesma página da splash: trocar de tela ou de área não recarrega nada (o worker serve `index.html` nesse endereço). |
| `/:slug/:cidade` | `perfil.html` | Site do negócio na Agenda (estilo escolhido pelo dono). |
| `/:slug/:cidade/pedir` (também `/chamar` e `/orcamento`) | `pedir.html` | Loja (Delivery) ou chamado/orçamento (No local) do mesmo negócio. |
| `/:slug/:cidade/institucional` | `institucional.html` | Página institucional do negócio. |
| `/criar.html` | `criar.html` | Passo a passo (funil) pra criar o negócio. |
| `/cadastro.html` | `cadastro.html` | Login do dono (e-mail/senha ou Google) e painel da Agenda. |
| `/painel-area.html` | `painel-area.html` | Painel do Delivery e do No local (pedidos, cardápio/serviços, loja, resumo). |
| `/pedir.html?demo=<tipo>` | `pedir.html` | Loja/chamado de exemplo, sem banco (usada na pré-visualização do funil). |

O `_worker.js` serve `perfil.html`/`pedir.html`/`institucional.html` nas rotas de 2–3 segmentos mantendo a URL original.

## Faixa da plataforma e toggle das áreas

No site de cada negócio, a plataforma só aparece numa **faixa fina no topo** (`.faixa-vibe`): o cubo minúsculo + o nome, e o toggle das áreas do próprio negócio (Agendar · Pedir/Chamar). O espaço abaixo da faixa é só do negócio — o logo da plataforma nunca entra no hero. O toggle (`assets/js/vibe-toggle.js` + `assets/css/vibe-toggle.css`) tem bolha que estica como líquido, ícones que se desenham, cubo CSS 3D e troca de página deslizando pro lado (View Transitions, com fallback em CSS). Arrastar a tela pro lado também troca de área. Os nomes das áreas nos painéis ficam em `VibeToggle.NOMES`.

## Passo a passo de criação (funil)

`assets/js/criar.js` — as perguntas mudam conforme as respostas:

1. **O que seu negócio faz?** Agenda / Delivery / No local (+ opção de juntar a Agenda com uma das outras).
2. **Tipo de negócio**: só os da área (lista única em `assets/js/segmentos.js`, que precisa bater com `vibe_segmentos()` no banco).
3. **Perguntas da área**: atendimento masculino/feminino (Agenda de beleza), entrega/retirada (Delivery), onde atende (No local).
4. **Aparência**: estilo do site (Agenda) ou jeito da loja — lista, grade, cardápio, vitrine; claro ou vibrante.
5. **Nome e link**, **cidade**, **WhatsApp** → `criar_estabelecimento(..., p_areas, p_servico_onde)`.

A pré-visualização ao fundo troca sozinha entre o site da Agenda e a loja de exemplo. `?area=`, `?segmento=` e `?template=` chegam já escolhidos (e sobrevivem ao login).

## Estilos do site (Agenda)

Lista única em `assets/js/templates.js` (usada pelo site, página institucional, preview e funil). 14 estilos em 4 grupos:

- **Claros**: Claro, Nórdico, Papel, Pastel, Clássico, Boho
- **Vibrantes**: Aurora (margens translúcidas), Vidro, Neon, Forno
- **Escuros**: Escuro, Automotivo
- **Seguem sua foto**: Ambiente (a foto de capa desfocada vira o fundo), Luz — ligam o "Seguir foto" (`cor-da-imagem.js`)

Cada estilo usa uma pasta-base (`assets/tpl-*/css/`) e, nos novos, uma camada extra (`assets/tpl-extra/*.css`). O dono troca o estilo pelo botão **Estilo** na barra de edição do próprio site (vê ao vivo antes de salvar). Os prints ficam em `assets/img/templates/` e são gerados a partir do `preview-embutido.html`.

## Banco (Supabase `oeracgvnuomcaydmizzj`)

- RLS em todas as tabelas; acesso só por funções `SECURITY DEFINER`. Toda função `tenant_admin_*` começa com `vibe_exigir_dono(id)`.
- `estabelecimentos.areas text[]` + `servico_onde` (cliente/loja/ambos). A área de pedidos vive em `delivery_estabelecimentos` (mesmo `id`, 1:1), sincronizada por gatilho.
- Fotos no bucket `tenant-fotos`: só o dono escreve na pasta do próprio negócio (mais pastas temporárias `novo-*` durante a criação).

## Testes

Playwright com Chromium (`/opt/pw-browsers/chromium`), Supabase simulado (mock do supabase-js) e fontes locais. Cobrem: splash e Explorar, funil nas três áreas (inclusive o que é enviado ao banco), loja/chamado/orçamento, painel das áreas, toggle e gesto, galeria de estilos. Mudanças no banco são testadas com transação que desfaz tudo no fim (nunca mexe em negócio real).
