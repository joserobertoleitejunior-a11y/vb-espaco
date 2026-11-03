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
  const checa = (nome, ok, det) => { console.log((ok ? 'OK  ' : 'FALHA') + '  ' + nome.padEnd(46) + (det || '')); if (ok) passou++; else falhou++; };

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

  // 3. fluxo da foto: leitura, amostra, duas saidas
  await p.evaluate(() => { window.__proxima = null; window.__chamadas = []; });
  await mandarFoto('cardapio.png');
  const fala = await ultima();
  checa('foto: a IA responde o que leu', /Li 2 itens/.test(fala), fala.split('\n')[0]);
  checa('foto: aparecem as duas saidas', (await p.$$('.fn-escolhas .fn-esc')).length === 2);

  // 4. "Por tudo do jeito que esta" manda as categorias certas
  await p.click('[data-fn-lido="salvar"]');
  await p.waitForTimeout(700);
  c = await p.evaluate(() => window.__chamadas[0]);
  checa('botao salvar manda salvar_cardapio_lido',
    !!(c && c.nome === 'salvar_cardapio_lido' && c.args.categorias[0].itens.length === 2),
    c ? c.nome + ' com ' + c.args.categorias[0].itens.length + ' itens' : 'nada');

  // 5. "Revisar e corrigir aqui": a lista abre NO CHAT; corrige um preco, tira um item, salva
  await p.evaluate(() => { window.__chamadas = []; });
  await mandarFoto('c.png');
  await p.click('[data-fn-lido="conferir"]');
  await p.waitForTimeout(500);
  checa('revisar abre a lista no chat (2 itens)', (await p.$$('.fn-rev-item')).length === 2);
  await p.fill('.fn-rev-item[data-ii="0"] .fn-rev-preco', '19,90');
  await p.uncheck('.fn-rev-item[data-ii="1"] input[type="checkbox"]');
  await p.click('[data-fn-rev-salvar]');
  await p.waitForTimeout(700);
  c = await p.evaluate(() => window.__chamadas[0]);
  const it = c && c.args && c.args.categorias && c.args.categorias[0] && c.args.categorias[0].itens;
  checa('salvar manda SO o que foi revisado',
    !!(c && c.nome === 'salvar_cardapio_lido' && it && it.length === 1 && it[0].preco === 19.9 && it[0].nome === 'Marmita P'),
    it ? JSON.stringify(it) : 'nada');
  checa('a lista de revisao some depois de salvar', (await p.$$('.fn-rev')).length === 0);

  // 5b. cancelar a revisao nao salva nada
  await p.evaluate(() => { window.__chamadas = []; });
  await mandarFoto('c2.png');
  await p.click('[data-fn-lido="conferir"]');
  await p.waitForTimeout(400);
  await p.click('[data-fn-rev-cancelar]');
  await p.waitForTimeout(500);
  checa('cancelar a revisao nao salva nada', (await p.evaluate(() => window.__chamadas.length)) === 0);

  // 5c. desmarcar TUDO nao salva nada e avisa
  await p.evaluate(() => { window.__chamadas = []; });
  await mandarFoto('c3.png');
  await p.click('[data-fn-lido="conferir"]');
  await p.waitForTimeout(400);
  await p.uncheck('.fn-rev-item[data-ii="0"] input[type="checkbox"]');
  await p.uncheck('.fn-rev-item[data-ii="1"] input[type="checkbox"]');
  await p.click('[data-fn-rev-salvar]');
  await p.waitForTimeout(500);
  checa('tirar todos os itens nao salva e avisa',
    (await p.evaluate(() => window.__chamadas.length)) === 0 && /tirou todos/i.test(await ultima()));

  // 6. foto sem item nenhum nao oferece salvar
  await p.evaluate(() => { window.__lido = { categorias: [], aviso: 'Nao achei nenhum item nessa foto.' }; window.__chamadas = []; });
  await mandarFoto('v.png');
  checa('foto sem itens nao oferece salvar', (await p.$$('.fn-escolhas .fn-esc')).length === 0);

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
