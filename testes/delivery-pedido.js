// Abre a pizzaria e percorre o pedido como um cliente: lista -> "+" -> personalizar -> meio a meio.
const { chromium } = require('playwright');
const { CAT, ITENS, BORDAS, LOJA, IDENT } = require('./loja-visual.js');

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const erros = []; p.on('pageerror', e => erros.push(String(e)));
  await p.addInitScript(({ loja, ident, cardapio }) => {
    const mapa = { delivery_buscar_estabelecimento: loja, buscar_estabelecimento: [ident], delivery_cardapio_publico: cardapio, respostas_publicas: {} };
    window.__rpcs = [];
    window.supabase = { createClient: () => ({
      rpc: (n, a) => { window.__rpcs.push({ n, a }); return Promise.resolve({ data: n in mapa ? mapa[n] : null, error: null }); },
      auth: { getSession: () => Promise.resolve({ data: { session: null } }), getUser: () => Promise.resolve({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) }, from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }) };
  }, { loja: LOJA, ident: IDENT, cardapio: { itens: ITENS, bordas: BORDAS, combos: [], categorias: CAT } });
  await p.route('**supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await p.goto('http://127.0.0.1:8900/pizzaria-dom-rafa/itapetininga/pedir', { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(2200);

  let passou = 0, falhou = 0;
  const checa = (nome, ok, det) => { console.log((ok ? 'OK  ' : 'FALHA') + '  ' + nome.padEnd(52) + (det || '')); if (ok) passou++; else falhou++; };
  const foto = (n) => p.screenshot({ path: `/tmp/p-${n}.png` });

  await foto('1-topo');
  checa('sem o botao "Fazer pedido" da Agenda no topo', !(await p.isVisible('.hero-cta')));
  checa('sem os botoes redondos "Ver / Pedir"', !(await p.isVisible('#tplServiceStrip')));
  checa('o cardapio e uma LISTA (uma linha por pizza)', (await p.$$('.dl-item')).length === 9, String((await p.$$('.dl-item')).length) + ' linhas');
  checa('nao sobrou nenhum botao redondo de pizza', (await p.$$('.servico-redondo[data-item]')).length === 0);
  checa('as pizzas com foto mostram a foto', (await p.$$('.dl-foto img')).length === 3);
  checa('as sem foto ganham a caixinha com o desenho', (await p.$$('.dl-foto-vazia')).length === 6);
  checa('aparece o cartao do meio a meio no topo', !!(await p.$('.dl-meio')));

  // rola ate o cardapio
  await p.evaluate(() => document.getElementById('servicosSecao').scrollIntoView());
  await p.waitForTimeout(500);
  await foto('2-lista');

  // "+" na linha: um toque, sem abrir nada
  await p.click('.dl-item[data-item="i1"] [data-dl-mais]');
  await p.waitForTimeout(400);
  checa('"+" poe no pedido sem abrir tela', (await p.evaluate(() => document.getElementById('sheet').classList.contains('aberto'))) === false);
  checa('a linha vira um contador (1)', (await p.textContent('.dl-item[data-item="i1"] .dl-qtd span')) === '1');
  await p.click('.dl-item[data-item="i1"] [data-dl-mais]');
  await p.waitForTimeout(300);
  checa('"+" de novo sobe pra 2', (await p.textContent('.dl-item[data-item="i1"] .dl-qtd span')) === '2');
  await p.click('.dl-item[data-item="i1"] [data-dl-menos]');
  await p.waitForTimeout(300);
  checa('"−" desce pra 1', (await p.textContent('.dl-item[data-item="i1"] .dl-qtd span')) === '1');
  checa('a barra de baixo mostra o pedido', !(await p.evaluate(() => document.getElementById('cartBar').classList.contains('vazio'))), (await p.textContent('#cartTotal')));
  await foto('3-contador');

  // personalizar: tirar ingredientes
  await p.click('.dl-item[data-item="i2"] .dl-abrir');
  await p.waitForTimeout(600);
  await foto('4-personalizar');
  checa('a tela de personalizar mostra os ingredientes', (await p.$$('.dl-ing')).length === 4, (await p.$$eval('.dl-ing', e => e.map(x => x.textContent.trim()))).join(', '));
  await p.click('.dl-ing[data-tirar="catupiry"], .dl-ing[data-tirar="cheddar"], .dl-ing[data-tirar="calabresa"]');
  await p.waitForTimeout(250);
  checa('tocar num ingrediente risca (fora)', (await p.$$('.dl-ing.fora')).length === 1);
  await p.fill('#itemObs', 'bem assada');
  await p.click('#itemAddBtn');
  await p.waitForTimeout(500);
  const linha = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /carrinho|cart/i.test(k))) || '[]'));
  const l2 = linha.find(x => x.item_id === 'i2');
  checa('o que foi tirado vai na observacao do pedido', !!(l2 && /^sem /.test(l2.obs) && /bem assada/.test(l2.obs)), l2 ? JSON.stringify(l2.obs) : 'linha nao achada');

  // meio a meio
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.dl-meio').getBoundingClientRect().top + scrollY - 140));
  await p.waitForTimeout(300);
  await foto('5-cartao-meio');
  await p.click('.dl-meio');
  await p.waitForTimeout(600);
  await foto('6-meio-vazio');
  checa('abre a tela do meio a meio com o 1o sabor para escolher', !!(await p.$('.dl-slot.ativo[data-meio-slot="a"]')));
  checa('o botao de adicionar espera os dois sabores', await p.evaluate(() => document.getElementById('meioAddBtn').disabled));
  await p.click('.dl-opcao[data-meio-pick="i1"]');
  await p.waitForTimeout(400);
  checa('depois do 1o sabor ja abre o 2o', !!(await p.$('.dl-slot.ativo[data-meio-slot="b"]')));
  checa('o mesmo sabor nao pode nas duas metades', await p.evaluate(() => document.querySelector('.dl-opcao[data-meio-pick="i1"]').disabled));
  await p.fill('#meioBusca', 'portu');
  await p.waitForTimeout(250);
  checa('a busca de sabor filtra a lista', (await p.$$('#meioLista .dl-opcao:not(.oculto)')).length === 1);
  await p.click('.dl-opcao[data-meio-pick="i7"]');
  await p.waitForTimeout(500);
  await foto('7-meio-pronto');
  checa('com os dois sabores o botao libera', !(await p.evaluate(() => document.getElementById('meioAddBtn').disabled)));
  const precoBtn = await p.textContent('#meioAddBtn');
  checa('cobra o sabor mais caro (Portuguesa 40,99)', /40,99/.test(precoBtn), precoBtn.trim());
  checa('mostra os ingredientes das duas metades', (await p.$$('.dl-ings')).length === 2);
  await p.click('.dl-ing[data-tirar-b="ovo"]');
  await p.waitForTimeout(200);
  await p.click('#meioAddBtn');
  await p.waitForTimeout(500);
  const rpcs = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /carrinho|cart/i.test(k))) || '[]'));
  const meio = rpcs.find(x => x.meio_item_id);
  checa('o meio a meio entra no pedido com as duas metades', !!(meio && meio.item_id === 'i1' && meio.meio_item_id === 'i7'), meio ? meio.descricao : 'nao achei');
  checa('...com o preco do mais caro', !!(meio && Math.abs(meio.preco - 40.99) < 0.01), meio ? String(meio.preco) : '');
  checa('...e dizendo de qual metade tirou', !!(meio && /2ª metade sem ovo/.test(meio.obs)), meio ? JSON.stringify(meio.obs) : '');

  await foto('8-barra');
  console.log('\n' + passou + ' passaram, ' + falhou + ' falharam');
  console.log('erros de script:', erros.length ? erros : 'nenhum');
  await b.close();
  process.exit(falhou ? 1 : 0);
})();
