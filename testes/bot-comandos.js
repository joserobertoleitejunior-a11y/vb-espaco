const { chromium } = require('playwright');

// cada caso: o que a IA responderia, e o que o app tem que fazer
const CASOS = [
  { nome: 'abrir_aba',             acao: { nome: 'abrir_aba', args: { aba: 'caixa' } },                      pedeSim: false },
  { nome: 'abrir_editor',          acao: { nome: 'abrir_editor', args: { parte: 'foto' } },                  pedeSim: false },
  { nome: 'consultar',             acao: { nome: 'consultar', args: { oQue: 'hoje' } },                      pedeSim: false },
  { nome: 'confirmar_agendamento', acao: { nome: 'confirmar_agendamento', args: { cliente: 'Ana' } },         pedeSim: true },
  { nome: 'concluir_agendamento',  acao: { nome: 'concluir_agendamento', args: { cliente: 'Ana' } },          pedeSim: true },
  { nome: 'cancelar_agendamento',  acao: { nome: 'cancelar_agendamento', args: { cliente: 'Ana' } },          pedeSim: true },
  { nome: 'avancar_pedido',        acao: { nome: 'avancar_pedido', args: { numero: 7 } },                     pedeSim: true },
  { nome: 'cancelar_pedido',       acao: { nome: 'cancelar_pedido', args: { numero: 7 } },                    pedeSim: true },
  { nome: 'lancar_venda',          acao: { nome: 'lancar_venda', args: { descricao: 'Corte', valor: 40 } },   pedeSim: true },
  { nome: 'mudar_nome_funcionario',acao: { nome: 'mudar_nome_funcionario', args: { nome: 'Tonho' } },         pedeSim: false, interno: true },
  { nome: 'pedir_foto_cardapio',   acao: { nome: 'pedir_foto_cardapio', args: {} },                           pedeSim: false, interno: true },
  { nome: 'nada (só conversa)',    acao: null,                                                                pedeSim: false, interno: true },
  { nome: 'ação inventada',        acao: { nome: 'voar_ate_marte', args: {} },                                pedeSim: false, interno: true },
];

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erros = []; p.on('pageerror', e => erros.push(String(e)));
  await p.goto('http://127.0.0.1:8899/cadastro.html', { waitUntil: 'networkidle' }).catch(()=>{});
  await p.waitForTimeout(1800);

  await p.evaluate(() => {
    window.__chamadas = [];
    window.__proxima = null;
    // finge o servidor: devolve a ação que o teste mandou, sem chamar o Gemini
    window.db = window.db || {};
    window.db.functions = { invoke: () => Promise.resolve({ data: { fala: 'ok', acao: window.__proxima } }) };
    window.db.rpc = () => Promise.resolve({ data: 'Tonho', error: null });
    const anota = (n) => (args) => { window.__chamadas.push({ nome: n, args }); return 'feito: ' + n; };
    const nomes = ['abrir_aba','abrir_editor','consultar','confirmar_agendamento','concluir_agendamento',
                   'cancelar_agendamento','avancar_pedido','cancelar_pedido','lancar_venda',
                   'salvar_cardapio_lido','conferir_cardapio_lido'];
    const acoes = {}; nomes.forEach(n => acoes[n] = anota(n));
    window.VBFuncionario.montar({ estabId: 'teste', negocio: 'Teste', areas: ['agenda','delivery'], acoes });
    window.VBFuncionario.abrir();
  });
  await p.waitForTimeout(700);
  const bat = await p.$('#fnBatNome');
  if (bat) { await bat.fill('Zé'); await p.click('.fn-bat-ok'); await p.waitForTimeout(700); }

  const falar = async (txt) => {
    await p.fill('#fnTexto', txt);
    await p.press('#fnTexto', 'Enter');
    await p.waitForTimeout(700);
  };
  const ultimaFala = () => p.evaluate(() => {
    const m = [...document.querySelectorAll('.fn-ele p')];
    return m.length ? m[m.length-1].textContent.trim() : '';
  });

  let passou = 0, falhou = 0;
  for (const c of CASOS) {
    await p.evaluate(a => { window.__proxima = a; window.__chamadas = []; }, c.acao);
    await falar('teste ' + c.nome);
    let ok = true, detalhe = '';
    const chamadasAntes = await p.evaluate(() => window.__chamadas.length);

    if (c.pedeSim) {
      if (chamadasAntes !== 0) { ok = false; detalhe = 'EXECUTOU SEM PERGUNTAR'; }
      const fala = await ultimaFala();
      if (ok && !/sim/i.test(fala)) { ok = false; detalhe = 'não pediu confirmação: ' + fala.slice(0,50); }
      // responde "sim" (a ação da IA não é consultada de novo)
      await p.evaluate(() => { window.__proxima = null; });
      await falar('sim');
      const dps = await p.evaluate(() => window.__chamadas.map(x => x.nome));
      if (ok && dps[0] !== c.acao.nome) { ok = false; detalhe = 'após sim, chamou ' + JSON.stringify(dps); }
    } else if (!c.interno) {
      const ch = await p.evaluate(() => window.__chamadas.map(x => x.nome));
      if (ch[0] !== c.acao.nome) { ok = false; detalhe = 'chamou ' + JSON.stringify(ch); }
    } else {
      const fala = await ultimaFala();
      if (!fala) { ok = false; detalhe = 'não respondeu nada'; }
      detalhe = detalhe || ('resposta: "' + fala.slice(0, 46) + '"');
    }
    console.log((ok ? 'OK  ' : 'FALHA') + '  ' + c.nome.padEnd(26) + (detalhe || ''));
    ok ? passou++ : falhou++;
  }

  // recusar uma ação que pede confirmação
  await p.evaluate(() => { window.__proxima = { nome: 'cancelar_pedido', args: { numero: 9 } }; window.__chamadas = []; });
  await falar('cancela o 9');
  await p.evaluate(() => { window.__proxima = null; });
  await falar('não');
  const depoisDoNao = await p.evaluate(() => window.__chamadas.length);
  const falaNao = await ultimaFala();
  const okNao = depoisDoNao === 0;
  console.log((okNao ? 'OK  ' : 'FALHA') + '  responder "não"'.padEnd(32) + '"' + falaNao.slice(0,40) + '"');
  okNao ? passou++ : falhou++;

  // o nome mudou mesmo?
  const nomeAgora = await p.evaluate(() => window.VBFuncionario.nome());
  console.log((nomeAgora === 'Tonho' ? 'OK  ' : 'FALHA') + '  nome trocado pela IA'.padEnd(32) + '→ ' + nomeAgora);
  nomeAgora === 'Tonho' ? passou++ : falhou++;

  console.log('\n' + passou + ' passaram, ' + falhou + ' falharam');
  console.log('erros de script:', erros.length ? erros : 'nenhum');
  await b.close();
  process.exit(falhou ? 1 : 0);
})();
