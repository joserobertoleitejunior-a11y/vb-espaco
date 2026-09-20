# VB Agenda

Plataforma white-label de agendamento e pagamento pra salões, barbearias, manicure/pedicure e estética — começando por Itapetininga/SP. Ver `PADROES-AGENCIA.md` pros padrões fixos da agência.

## Como funciona o link de cada estabelecimento

`vb-espaco.joserobertoleitejunior.workers.dev/:slug/:cidade` — ex: `.../rafael-cabeleireiros/itapetininga`. Hospedagem em Cloudflare Workers (não usamos mais Netlify), roteada pelo `_worker.js` na raiz, que intercepta caminhos de dois segmentos (`/:slug/:cidade` e `/:slug/:cidade/institucional`) e serve `perfil.html`/`institucional.html` preservando a URL original — o JS lê o caminho real da URL pra saber qual estabelecimento buscar.

## Páginas

- `index.html` — institucional/landing.
- `cadastro.html` — login/criação de conta do dono (e-mail+senha ou Google) e cadastro de estabelecimento.
- `perfil.html` — página pública de cada estabelecimento.

## Status

MVP em teste: criar conta, cadastrar estabelecimento, ver o perfil público. Agenda, pagamento e split de comissão ainda não portados (vêm do motor do [Rafael Cabeleireiros](https://github.com/joserobertoleitejunior-a11y/rafael-cabeleireiros-), que agora é o primeiro estabelecimento desta plataforma).
