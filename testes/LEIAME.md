# Testes do funcionário digital

Dois arquivos que põem o chat do funcionário pra rodar de verdade num
navegador, com o servidor fingido — nenhuma chamada sai pra internet e
nenhum dado real é tocado.

- `bot-comandos.js` — dispara **todos** os comandos que a IA pode pedir e
  confere: quem executa na hora, quem pergunta "sim" antes, o que acontece
  ao responder "não", e o que ele faz com um comando inventado.
- `bot-foto-e-args.js` — a foto do cardápio pelo chat (leitura, as duas
  saídas, salvar e conferir), se os argumentos chegam inteiros até o
  executor, e o que acontece com foto sem item e com arquivo que não é foto.

## Como rodar

    cd <a pasta do projeto>
    python3 -m http.server 8899 --bind 127.0.0.1 &
    node testes/bot-comandos.js
    node testes/bot-foto-e-args.js

Cada um sai com código 0 se tudo passou. Precisa do Playwright com Chromium.

## O que eles NÃO cobrem

As ações que precisam de login de verdade: o que acontece dentro do painel
de pedidos (`atenderFuncionario` em assets/pedidos/painel.js) e as RPCs do
banco. Os testes param na fronteira — conferem que o app chama a ação certa,
com os argumentos certos, e não que o banco gravou.
