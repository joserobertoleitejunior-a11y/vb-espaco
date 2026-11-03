// Caixa passo a passo: percorre a venda como um profissional (celular) e confere o que sai para o banco.
// Uso: servir a pasta em http://127.0.0.1:8899 e rodar `node testes/caixa-passo.js`
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const erros = []; p.on('pageerror', e => erros.push(String(e)));
  await p.goto('http://127.0.0.1:' + (process.env.PORTA || 8899) + '/cadastro.html', { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1500);
  const abrir = (equipe) => p.evaluate((equipe) => {
    window.__envios = []; window.__fim = 0;
    window.VBCaixaPasso.abrir({
      servicos: [{ id: 's1', nome: 'Corte masculino', preco: 40 }, { id: 's2', nome: 'Barba', preco: 25 }, { id: 's3', nome: 'Hidratação', preco: 80 }],
      equipe: equipe ? [{ id: 'f1', nome: 'Carlos' }, { id: 'f2', nome: 'Ana' }] : [],
      formas: [{ chave: 'pix', nome: 'Pix' }, { chave: 'dinheiro', nome: 'Dinheiro' }, { chave: 'cartao', nome: 'Cartão' }],
      preco: v => 'R$ ' + Number(v).toFixed(2).replace('.', ','),
      base: { p_estabelecimento_id: 'e1' },
      enviar: (params) => { window.__envios.push(params); return Promise.resolve({ res: {} }); },
      aoTerminar: () => { window.__fim++; }
    });
  }, equipe);
  let passou = 0, falhou = 0;
  const checa = (nome, ok, det) => { console.log((ok ? 'OK  ' : 'FALHA') + '  ' + nome.padEnd(54) + (det || '')); if (ok) passou++; else falhou++; };
  const espera = (ms = 330) => p.waitForTimeout(ms);
  const conta = () => p.textContent('[data-cxw-conta]');
  const botao = () => p.$eval('.cxw-pe', e => e.textContent.trim());

  // ---- venda 1: com equipe, Pix ----
  await abrir(true); await espera();
  checa('abre no passo 1 de 5', /Passo 1 de 5/.test(await conta()));
  checa('sem nada escolhido o botao fica travado', await p.$eval('[data-cxw-avancar]', e => e.disabled));
  await p.screenshot({ path: '/tmp/cx-1.png' });
  await p.click('[data-cxw-item="s1"]'); await p.click('[data-cxw-item="s1"]'); await p.click('[data-cxw-item="s2"]');
  checa('tocar de novo soma (2x corte)', (await p.textContent('[data-cxw-item="s1"] .cxw-qtd b')) === '2');
  checa('o botao mostra o total (R$ 105,00)', /105,00/.test(await botao()), await botao());
  await p.click('[data-cxw-menos="s1"]');
  checa('o "−" tira um (total 65,00)', /65,00/.test(await botao()), await botao());
  await p.click('[data-cxw-item="s1"]');
  await p.click('[data-cxw-avulso]'); await p.fill('#cxwAvDesc', 'Shampoo'); await p.fill('#cxwAvValor', '30,50'); await p.click('[data-cxw-avulso-ok]');
  checa('"Outro item" entra na venda (135,50)', /135,50/.test(await botao()), await botao());
  await p.click('[data-cxw-avancar]'); await espera();
  checa('passo 2: quem atendeu', /Passo 2 de 5/.test(await conta()) && !!(await p.$('[data-cxw-staff="f1"]')));
  checa('nesse passo nao tem botao (um toque avanca)', (await p.$eval('.cxw-pe', e => e.classList.contains('vazio'))));
  await p.screenshot({ path: '/tmp/cx-2.png' });
  await p.click('[data-cxw-staff="f2"]'); await espera(600);
  checa('um toque na Ana ja vai pro passo 3', /Passo 3 de 5/.test(await conta()));
  await p.screenshot({ path: '/tmp/cx-3.png' });
  await p.click('[data-cxw-forma="pix"]'); await espera(600);
  checa('Pix: um toque e vai pro passo 4', /Passo 4 de 5/.test(await conta()));
  await p.fill('#cxwNome', 'Maria'); await p.fill('#cxwTel', '15999998888');
  await p.screenshot({ path: '/tmp/cx-4.png' });
  await p.click('[data-cxw-avancar]'); await espera();
  checa('passo 5: conferir', /Passo 5 de 5/.test(await conta()) && /135,50/.test(await p.textContent('.cxw-total')));
  await p.screenshot({ path: '/tmp/cx-5.png' });
  await p.click('[data-cxw-registrar]'); await espera(500);
  const e1 = await p.evaluate(() => window.__envios);
  checa('envia uma venda por item (3)', e1.length === 3, String(e1.length));
  checa('com profissional, cliente e forma', e1.every(x => x.p_staff_nome === 'Ana' && x.p_cliente_nome === 'Maria' && x.p_cliente_telefone === '15999998888' && x.p_forma_pagamento === 'pix' && x.p_estabelecimento_id === 'e1'));
  checa('2x corte vira "2x Corte masculino" = 80', e1.some(x => x.p_descricao === '2x Corte masculino' && x.p_valor === 80 && x.p_servico_id === 's1'));
  checa('item avulso sem servico, valor 30,50', e1.some(x => x.p_descricao === 'Shampoo' && x.p_valor === 30.5 && x.p_servico_id === null));
  checa('mostra "Venda registrada!" e avisa a lista', /Venda registrada/.test(await p.textContent('.cxw-corpo')) && (await p.evaluate(() => window.__fim)) === 1);
  await p.screenshot({ path: '/tmp/cx-6.png' });
  await p.click('[data-cxw-nova]'); await espera();
  checa('"Nova venda" recomeca limpo', /Passo 1 de 5/.test(await conta()) && /Toque no que/.test(await botao()));
  await p.click('[data-cxw-fechar]'); await espera(400);
  checa('fechar remove a tela', !(await p.$('.cxw')));

  // ---- venda 2: sem equipe, dinheiro com troco ----
  await abrir(false); await espera();
  checa('sem equipe sao 4 passos', /Passo 1 de 4/.test(await conta()));
  await p.click('[data-cxw-item="s3"]'); await p.click('[data-cxw-avancar]'); await espera();
  checa('sem equipe pula direto pra pagamento', /Passo 2 de 4/.test(await conta()) && !!(await p.$('[data-cxw-forma="pix"]')));
  await p.click('[data-cxw-forma="dinheiro"]'); await espera(300);
  checa('Dinheiro nao avanca sozinho e pergunta o troco', /Passo 2 de 4/.test(await conta()) && !!(await p.$('#cxwRec')));
  await p.click('[data-cxw-rec="100"]'); await espera(100);
  checa('troco de 100 pra 80 = 20,00', /Troco: R\$ 20,00/.test(await p.textContent('#cxwTroco')), await p.textContent('#cxwTroco'));
  await p.screenshot({ path: '/tmp/cx-7.png' });
  await p.click('[data-cxw-avancar]'); await espera();
  await p.click('[data-cxw-pular]'); await espera();
  checa('"Pular" no cliente leva ao conferir sem cliente', /Passo 4 de 4/.test(await conta()) && /Sem cliente/.test(await p.textContent('.cxw-dados')));
  await p.click('[data-cxw-voltar]'); await espera(); await p.click('[data-cxw-voltar]'); await espera();
  checa('voltar funciona e guarda a escolha', /Passo 2 de 4/.test(await conta()) && !!(await p.$('[data-cxw-forma="dinheiro"].on')));
  await p.click('[data-cxw-fechar]'); await espera(400);

  // ---- venda 3: pagamento dividido ----
  await abrir(false); await espera();
  await p.click('[data-cxw-item="s3"]'); await p.click('[data-cxw-avancar]'); await espera();
  await p.click('[data-cxw-dividir]'); await espera(100);
  checa('dividir exige os dois jeitos e o valor', await p.$eval('[data-cxw-avancar]', e => e.disabled));
  await p.fill('#cxwV1', '50'); await p.click('[data-cxw-forma2="cartao"]'); await espera(100);
  checa('mostra o resto (30,00)', /Resto: R\$ 30,00/.test(await p.textContent('#cxwResto')), await p.textContent('#cxwResto'));
  await p.screenshot({ path: '/tmp/cx-8.png' });
  checa('com tudo preenchido libera', !(await p.$eval('[data-cxw-avancar]', e => e.disabled)));
  await p.click('[data-cxw-avancar]'); await espera(); await p.click('[data-cxw-pular]'); await espera();
  await p.click('[data-cxw-registrar]'); await espera(500);
  const e3 = await p.evaluate(() => window.__envios);
  checa('manda 2 pagamentos: pix 50 + cartao 30', e3.length === 2 && e3[0].p_forma_pagamento === 'pix' && e3[0].p_valor === 50 && e3[1].p_forma_pagamento === 'cartao' && e3[1].p_valor === 30, JSON.stringify(e3.map(x => [x.p_forma_pagamento, x.p_valor])));

  // ---- erro do servidor: mostra e deixa tentar de novo ----
  await p.click('[data-cxw-fechar]'); await espera(400);
  await p.evaluate(() => {
    window.VBCaixaPasso.abrir({ servicos: [{ id: 's1', nome: 'Corte', preco: 40 }], equipe: [], formas: [{ chave: 'pix', nome: 'Pix' }], preco: v => 'R$ ' + v,
      base: {}, enviar: () => Promise.resolve({ res: { error: { message: 'sem permissao' } } }) });
  });
  await espera();
  await p.click('[data-cxw-item="s1"]'); await p.click('[data-cxw-avancar]'); await espera();
  await p.click('[data-cxw-forma="pix"]'); await espera(600); await p.click('[data-cxw-pular]'); await espera();
  await p.click('[data-cxw-registrar]'); await espera(400);
  checa('erro do servidor aparece e o botao volta', /sem permissao/.test(await p.textContent('.cxw-corpo')) && !(await p.$eval('[data-cxw-registrar]', e => e.disabled)));

  console.log('\n' + passou + ' passaram, ' + falhou + ' falharam');
  console.log('erros de script:', erros.length ? erros : 'nenhum');
  await b.close();
  process.exit(falhou ? 1 : 0);
})();
