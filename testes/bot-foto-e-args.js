const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erros = []; p.on('pageerror', e => erros.push(String(e)));
  await p.goto('http://127.0.0.1:8899/cadastro.html', { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1800);
  await p.evaluate(() => {
    window.__chamadas = []; window.__proxima = null;
    window.__lido = { categorias: [{ nome: 'Marmitas', itens: [
      { nome: 'Marmita P', descricao: '', preco: 18 }, { nome: 'Marmita G', descricao: '', preco: 24 }] }], aviso: 'confira' };
    window.db = window.db || {};
    window.db.functions = { invoke: (fn) => Promise.resolve(
      fn === 'ler-cardapio' ? { data: window.__lido } : { data: { fala: 'ok', acao: window.__proxima } }) };
    window.db.rpc = () => Promise.resolve({ data: 'Ze', error: null });
    const anota = (n) => (args) => { window.__chamadas.push({ nome: n, args }); return 'feito'; };
    const acoes = {}; ['abrir_aba', 'lancar_venda', 'salvar_cardapio_lido', 'consultar']
      .forEach(n => { acoes[n] = anota(n); });
    window.VBFuncionario.montar({ estabId: 'teste', negocio: 'Teste', areas: ['delivery'], acoes });
    window.VBFuncionario.abrir();
  });
  await p.waitForTimeout(700);
  const bat = await p.$('#fnBatNome');
  if (bat) { await bat.fill('Ze'); await p.click('.fn-bat-ok'); await p.waitForTimeout(700); }
  const falar = async (t) => { await p.fill('#fnTexto', t); await p.press('#fnTexto', 'Enter'); await p.waitForTimeout(700); };
  const ultima = () => p.evaluate(() => { const m = [...document.querySelectorAll('.fn-ele p')]; return m.length ? m[m.length - 1].textContent : ''; });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const mandarFoto = async (nome) => { await p.setInputFiles('#fnArquivo', { name: nome, mimeType: 'image/png', buffer: png }); await p.waitForTimeout(1800); };
  let passou = 0, falhou = 0;
  const checa = (nome, ok, det) => { console.log((ok ? 'OK  ' : 'FALHA') + '  ' + nome.padEnd(48) + (det || '')); if (ok) passou++; else falhou++; };

  // 1. os argumentos chegam inteiros ate o executor
  await p.evaluate(() => { window.__proxima = { nome: 'abrir_aba', args: { aba: 'ganhos' } }; window.__chamadas = []; });
  await falar('abre ganhos');
  let c = await p.evaluate(() => window.__chamadas[0]);
  checa('args chegam inteiros (abrir_aba)', !!(c && c.args && c.args.aba === 'ganhos'), JSON.stringify(c && c.args));

  await p.evaluate(() => { window.__proxima = { nome: 'lancar_venda', args: { descricao: 'Corte', valor: 40.5, forma: 'pix' } }; window.__chamadas = []; });
  await falar('lanca uma venda');
  await p.evaluate(() => { window.__proxima = null; });
  await falar('sim');
  c = await p.evaluate(() => window.__chamadas[0]);
  checa('args chegam inteiros (lancar_venda)',
    !!(c && c.args && c.args.descricao === 'Corte' && c.args.valor === 40.5 && c.args.forma === 'pix'), JSON.stringify(c && c.args));

  // 2. a IA pedindo a foto faz a camera piscar
  await p.evaluate(() => { window.__proxima = { nome: 'pedir_foto_cardapio', args: {} }; });
  await falar('quero editar o cardapio');
  checa('pedir_foto_cardapio pisca a camera',
    await p.evaluate(() => document.getElementById('fnAnexo').classList.contains('fn-pisca')));

  // 3. a foto aparece NA CONVERSA, e a IA responde o que leu com o cartao de itens
  await p.evaluate(() => { window.__proxima = null; window.__chamadas = []; });
  await mandarFoto('cardapio.png');
  checa('a foto aparece na conversa', (await p.$$('.fn-foto img')).length === 1);
  checa('o feixe de leitura sai ao terminar', !(await p.evaluate(() => document.querySelector('.fn-foto').classList.contains('lendo'))));
  const fala = await ultima();
  checa('a IA diz o que leu', /Li 2 itens/.test(fala), fala.slice(0, 40));
  checa('cada item vira uma linha com interruptor', (await p.$$('.fn-pz .fn-tg input')).length === 2);
  const txtBotao = await p.textContent('[data-fn-cardapio-txt]');
  checa('o botao diz quantos entram', /Pôr 2 itens/.test(txtBotao), txtBotao);

  // 4. salvar do jeito que esta: tudo ligado manda tudo
  await p.click('[data-fn-cardapio-salvar]');
  await p.waitForTimeout(700);
  c = await p.evaluate(() => window.__chamadas[0]);
  checa('salvar tudo manda os 2 itens',
    !!(c && c.nome === 'salvar_cardapio_lido' && c.args.categorias[0].itens.length === 2),
    c ? c.nome + ' com ' + c.args.categorias[0].itens.length + ' itens' : 'nada');
  checa('o cartao some depois de salvar', (await p.$$('.fn-cardapio')).length === 0);

  // 5. desliga um item, corrige preco e nome: so o que ficou ligado vai, ja corrigido
  await p.evaluate(() => { window.__chamadas = []; });
  await mandarFoto('c.png');
  await p.click('.fn-pz[data-ii="1"] .fn-tg');
  const t1 = await p.textContent('[data-fn-cardapio-txt]');
  checa('desligar um item atualiza o botao', /Pôr 1 item/.test(t1), t1);
  checa('o item desligado fica apagado', await p.evaluate(() => document.querySelector('.fn-pz[data-ii="1"]').classList.contains('fn-pz-off')));
  await p.fill('.fn-pz[data-ii="0"] .fn-pz-preco', '19,90');
  await p.fill('.fn-pz[data-ii="0"] .fn-pz-nome', 'Marmita Pequena');
  await p.click('[data-fn-cardapio-salvar]');
  await p.waitForTimeout(700);
  c = await p.evaluate(() => window.__chamadas[0]);
  const it = c && c.args && c.args.categorias && c.args.categorias[0] && c.args.categorias[0].itens;
  checa('salva so o que ficou ligado, ja corrigido',
    !!(it && it.length === 1 && it[0].preco === 19.9 && it[0].nome === 'Marmita Pequena'), it ? JSON.stringify(it) : 'nada');

  // 5b. o interruptor da categoria liga e desliga todos de uma vez
  await p.evaluate(() => { window.__chamadas = []; });
  await mandarFoto('c2.png');
  await p.click('.fn-pz-cat[data-cat="0"] .fn-tg-cat');
  checa('categoria desligada apaga todos os itens', (await p.$$('.fn-pz-off')).length === 2);
  checa('sem nada ligado o botao fica travado', await p.evaluate(() => document.querySelector('[data-fn-cardapio-salvar]').disabled));
  await p.click('.fn-pz-cat[data-cat="0"] .fn-tg-cat');
  checa('ligar a categoria de novo religa todos', (await p.$$('.fn-pz-off')).length === 0);

  // 5c. "Agora nao" nao salva nada
  await p.click('[data-fn-cardapio-cancelar]');
  await p.waitForTimeout(400);
  checa('"Agora nao" nao salva nada', (await p.evaluate(() => window.__chamadas.length)) === 0 && (await p.$$('.fn-cardapio')).length === 0);

  // 6. foto sem item nenhum nao mostra cartao
  await p.evaluate(() => { window.__lido = { categorias: [], aviso: 'Nao achei nenhum item nessa foto.' }; window.__chamadas = []; });
  await mandarFoto('v.png');
  checa('foto sem itens nao mostra cartao', (await p.$$('.fn-cardapio')).length === 0);

  // 7. arquivo que nao e imagem
  await p.setInputFiles('#fnArquivo', { name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') });
  await p.waitForTimeout(900);
  const f2 = await ultima();
  checa('arquivo que nao e imagem e recusado', /parece uma foto/i.test(f2), f2.slice(0, 44));

  console.log('\n' + passou + ' passaram, ' + falhou + ' falharam');
  console.log('erros de script:', erros.length ? erros : 'nenhum');
  await b.close();
  process.exit(falhou ? 1 : 0);
})();
