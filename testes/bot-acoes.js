// Testa as ações do funcionário digital (assets/js/bot-acoes.js) contra um banco de mentira em memória.
// Uso: node testes/bot-acoes.js
const { criar, _teste } = require('../assets/js/bot-acoes.js');

let passou = 0, falhou = 0;
const checa = (n, ok, d) => { console.log((ok ? 'OK  ' : 'FALHA') + '  ' + n.padEnd(58) + (d || '')); ok ? passou++ : falhou++; };

function bancoFalso() {
  const s = { itens: [], cats: [], bordas: [], combos: [], chamadas: [], loja: {}, servicos: [], equipe: [], vendas: [], promos: [], agend: [], horarios: [], seq: 0 };
  const nid = () => 'id' + (++s.seq);
  const handlers = {
    delivery_admin_listar_itens: () => s.itens.slice(),
    delivery_admin_listar_categorias: () => s.cats.slice(),
    delivery_admin_listar_bordas: () => s.bordas.slice(),
    delivery_admin_listar_combos: () => s.combos.slice(),
    delivery_admin_salvar_categoria: (a) => { const c = { id: nid(), nome: a.p_nome, ordem: a.p_ordem }; s.cats.push(c); return c; },
    delivery_admin_remover_categoria: (a) => { s.cats = s.cats.filter(c => c.id !== a.p_id); },
    delivery_admin_salvar_item: (a) => {
      const novo = { id: a.p_id || nid(), nome: a.p_nome, preco: a.p_preco, categoria_id: a.p_categoria_id, ativo: a.p_ativo, permite_meio_a_meio: a.p_permite_meio_a_meio, aceita_borda: a.p_aceita_borda, ordem: a.p_ordem };
      const i = s.itens.findIndex(x => x.id === novo.id); if (i >= 0) s.itens[i] = novo; else s.itens.push(novo); return novo;
    },
    delivery_admin_remover_item: (a) => { s.itens = s.itens.filter(x => x.id !== a.p_id); },
    delivery_admin_alternar_item: (a) => { const x = s.itens.find(i => i.id === a.p_id); x.ativo = a.p_ativo; },
    delivery_admin_salvar_borda: (a) => { s.bordas.push({ id: nid(), nome: a.p_nome, preco: a.p_preco }); },
    delivery_admin_salvar_combo: (a) => { s.combos.push({ id: nid(), nome: a.p_nome, preco: a.p_preco, itens: a.p_itens_permitidos, qtd: a.p_qtd_sabores }); },
    delivery_admin_atualizar_estabelecimento: (a) => { Object.assign(s.loja, a.p_campos); },
    tenant_listar_servicos: () => s.servicos.slice(),
    tenant_listar_equipe: () => s.equipe.slice(),
    tenant_admin_salvar_servico: (a) => { s.servicos.push({ id: nid(), nome: a.p_nome, preco: a.p_preco }); },
    tenant_admin_salvar_staff: (a) => { s.equipe.push({ id: nid(), nome: a.p_nome }); },
    tenant_admin_criar_agendamento: (a) => { s.agend.push(a); },
    tenant_admin_salvar_horario: (a) => { s.horarios.push(a); },
    tenant_listar_horarios: () => (s.horariosBanco || []).slice(),
    delivery_admin_meus_estabelecimentos: () => [Object.assign({ id: 'e1' }, s.loja)],
    tenant_admin_publicar_promocao: (a) => { s.promos.push({ id: nid(), titulo: a.p_titulo }); },
    tenant_admin_listar_vendas_hoje: () => s.vendas.slice(),
    tenant_admin_remover_venda: (a) => { s.vendas = s.vendas.filter(v => v.id !== a.p_id); },
  };
  s.db = { rpc: (n, a) => { s.chamadas.push(n); if (!handlers[n]) return Promise.resolve({ data: null, error: { message: 'rpc inesperada: ' + n } }); try { return Promise.resolve({ data: handlers[n](a), error: null }); } catch (e) { return Promise.resolve({ data: null, error: { message: e.message } }); } } };
  return s;
}
const fmt = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const montar = (s, extra) => criar(Object.assign({ db: s.db, estabId: 'e1', areas: ['delivery', 'agenda'], segmento: 'pizzaria', preco: fmt, recarregar: (o) => { s.recarregou = (s.recarregou || []).concat(o); }, tour: () => { s.tour = true; } }, extra));
const erro = (p) => p.then(() => null, (e) => e.message);

(async () => {
  // utilidades
  checa('data: "amanha" e dia da semana viram ISO', /^\d{4}-\d{2}-\d{2}$/.test(_teste.dataISO('amanhã')) && /^\d{4}-\d{2}-\d{2}$/.test(_teste.dataISO('sexta')));
  checa('data: 05/11 vira ISO do ano atual', _teste.dataISO('05/11') === new Date().getFullYear() + '-11-05');
  checa('hora: "14h30" e "9" viram HH:MM', _teste.hora('14h30') === '14:30' && _teste.hora('9') === '09:00' && _teste.hora('25:00') === null);
  checa('preço: "R$ 12,50" e "1.250,00"', _teste.num('R$ 12,50') === 12.5 && _teste.num('1.250,00') === 1250);

  // cardápio
  let s = bancoFalso(), A = montar(s);
  let t = await A.adicionar_item({ nome: 'Calabresa', preco: 37.99 });
  checa('adicionar_item cria a categoria sozinha e o item', s.cats.length === 1 && s.itens.length === 1 && /37,99/.test(t), t);
  checa('pizza nasce com meio a meio e borda ligados', s.itens[0].permite_meio_a_meio === true && s.itens[0].aceita_borda === true);
  await A.adicionar_item({ nome: 'Refrigerante 2L', preco: 12, categoria: 'Bebidas' });
  checa('bebida NAO nasce com meio a meio', s.itens[1].permite_meio_a_meio === false && s.cats.length === 2);
  await A.adicionar_item({ nome: 'Frango Catupiry' });
  checa('sem preço entra como "a combinar" (0)', s.itens[2].preco === 0);
  t = await A.mudar_preco_item({ nome: 'calabresa', preco: '40,50' });
  checa('mudar_preco_item acha o item sem acento/maiúscula', s.itens[0].preco === 40.5 && /40,50/.test(t), t);
  t = await A.disponibilidade_item({ nome: 'refri', disponivel: false });
  checa('disponibilidade_item (esgotado) acha por parte do nome', s.itens[1].ativo === false, t);
  await A.adicionar_item({ nome: 'Calabresa Cheddar', preco: 38 });
  checa('nome repetido pergunta qual (ambiguidade)', /Qual/.test(await erro(A.mudar_preco_item({ nome: 'calab', preco: 1 }))));
  checa('item que não existe diz que não achou', /Não achei/.test(await erro(A.remover_item({ nome: 'sushi' }))));
  t = await A.remover_item({ nome: 'Frango Catupiry' });
  checa('remover_item apaga só esse', s.itens.length === 3 && !s.itens.some(i => i.nome === 'Frango Catupiry'), t);
  await A.adicionar_borda({ nome: 'Catupiry', preco: 8 });
  checa('adicionar_borda', s.bordas.length === 1);
  await A.criar_combo({ nome: '2 pizzas', preco: 79.9, qtd_sabores: 2 });
  checa('criar_combo usa as pizzas com preço', s.combos.length === 1 && s.combos[0].qtd === 2 && s.combos[0].itens.length >= 1);
  t = await A.limpar_cardapio();
  checa('limpar_cardapio apaga TODOS os itens e categorias', s.itens.length === 0 && s.cats.length === 0 && /apaguei 3 itens/.test(t), t);
  checa('limpar de novo diz que já está vazio', /já está vazio/.test(await A.limpar_cardapio()));
  checa('depois de mexer, o painel é recarregado', (s.recarregou || []).includes('cardapio'));

  // loja
  s = bancoFalso(); A = montar(s);
  await A.abrir_fechar_loja({ modo: 'fechar' });
  checa('abrir_fechar_loja: "fechar" => fechado', s.loja.status_manual === 'fechado');
  await A.abrir_fechar_loja({ modo: 'pelo horário' });
  checa('abrir_fechar_loja: "pelo horário" => auto', s.loja.status_manual === 'auto');
  t = await A.configurar_loja({ taxa_entrega: '8,50', pedido_minimo: 30, retirada: true, aviso: 'Hoje fechamos às 23h' });
  checa('configurar_loja grava taxa, mínimo, retirada e aviso', s.loja.taxa_entrega === 8.5 && s.loja.pedido_minimo === 30 && s.loja.aceita_retirada === true && s.loja.aviso === 'Hoje fechamos às 23h', t);
  checa('configurar_loja sem nada pergunta o que mudar', /O que você quer mudar/.test(await erro(A.configurar_loja({}))));

  // agenda
  s = bancoFalso(); s.servicos = [{ id: 'sv1', nome: 'Corte feminino', preco: 45 }]; s.equipe = [{ id: 'st1', nome: 'Carla' }]; A = montar(s);
  t = await A.criar_agendamento({ cliente: 'Maria', telefone: '(15) 99999-1111', servico: 'corte', profissional: 'carla', dia: '2026-11-10', horario: '14h' });
  const ag = s.agend[0];
  checa('criar_agendamento acha serviço e profissional pelo nome', ag && ag.p_servico === 'Corte feminino' && ag.p_staff_id === 'st1' && ag.p_horario === '14:00' && ag.p_dia === '2026-11-10' && ag.p_cliente_telefone === '15999991111', t);
  checa('criar_agendamento sem horário pergunta', /Que horas/.test(await erro(A.criar_agendamento({ cliente: 'Ana', dia: 'amanhã' }))));
  await A.adicionar_servico({ nome: 'Hidratação', preco: 80 });
  checa('adicionar_servico', s.servicos.length === 2);
  await A.adicionar_profissional({ nome: 'Dani', especialidade: 'Unhas' });
  checa('adicionar_profissional', s.equipe.length === 2);
  await A.horario_funcionamento({ dia: 'sábado', abre: '9', fecha: '14:00' });
  checa('horario_funcionamento: sábado = dia 6', s.horarios[0].p_dia_semana === 6 && s.horarios[0].p_abre === '09:00' && s.horarios[0].p_fecha === '14:00');
  await A.horario_funcionamento({ dia: 'domingo', fechado: true });
  checa('horario_funcionamento: domingo fechado', s.horarios[1].p_dia_semana === 0 && s.horarios[1].p_fechado === true);
  // horário em lote: intervalos de dias, turnos, delivery e agenda
  { const sd = bancoFalso(); const volta = []; const Ad = montar(sd, { areas: ['delivery'], registrarDesfazer: (d) => volta.push(d) });
    sd.loja.horarios = { 0: [['13:00', '22:00']], 6: [['13:00', '22:00']] };
    let tx = await Ad.horario_funcionamento({ dias: 'segunda a sexta', abre: '18h', fecha: '23:00' });
    checa('horário: "segunda a sexta" grava os 5 dias do delivery', ['1', '2', '3', '4', '5'].every(d => JSON.stringify(sd.loja.horarios[d]) === '[["18:00","23:00"]]') && sd.loja.horarios[6] && !sd.agenda, tx);
    checa('horário: o texto diz os dias em português', /^Seg a sex: 18h às 23h\.$/.test(tx), tx);
    checa('horário: guarda como desfazer o que existia antes', volta.length === 1 && volta[0].passos[0].args.p_campos.horarios[0][0][0] === '13:00');
    tx = await Ad.horario_funcionamento({ dias: 'fim de semana', fechado: true });
    checa('horário: "fim de semana" fechado tira sábado e domingo', !('6' in sd.loja.horarios) && !('0' in sd.loja.horarios) && '1' in sd.loja.horarios, tx);
    tx = await Ad.horario_funcionamento({ dias: 'todos os dias', turnos: [['11:00', '14:00'], ['18:00', '00:00']] });
    checa('horário: dois turnos por dia (almoço e jantar)', Object.keys(sd.loja.horarios).length === 7 && sd.loja.horarios[3].length === 2 && sd.loja.horarios[3][1][1] === '00:00', tx);
    checa('horário: meia-noite sai por extenso', /meia-noite/.test(tx), tx);
    checa('horário: terça e quinta', (await Ad.horario_funcionamento({ dias: 'terça e quinta', abre: '10', fecha: '15' })) === 'Terça e quinta: 10h às 15h.');
    checa('horário: abre = fecha é recusado', /mesma hora/.test(await erro(Ad.horario_funcionamento({ dias: 'sexta', abre: '10:00', fecha: '10:00' }))));
    checa('horário: sem dia, pergunta qual', /Quais dias/.test(await erro(Ad.horario_funcionamento({ abre: '10', fecha: '12' }))));
    checa('horário: não deixa a loja sem nenhum dia aberto', /nenhum dia aberto/.test(await erro(Ad.horario_funcionamento({ dias: 'todos os dias', fechado: true }))));
  }
  { const sa = bancoFalso(); sa.horariosBanco = [{ dia_semana: 2, abre: '09:00:00', fecha: '17:00:00', fechado: false }]; const volta = [];
    const Aa = montar(sa, { areas: ['agenda'], registrarDesfazer: (d) => volta.push(d) });
    await Aa.horario_funcionamento({ dias: 'terça e quinta', abre: '10', fecha: '19' });
    checa('horário (agenda): uma chamada por dia', sa.horarios.length === 2 && sa.horarios[0].p_dia_semana === 2 && sa.horarios[1].p_dia_semana === 4 && sa.horarios[1].p_abre === '10:00');
    checa('horário (agenda): desfazer devolve terça e deixa quinta fechada', volta[0].passos.length === 2 && volta[0].passos[0].args.p_abre === '09:00' && volta[0].passos[1].args.p_fechado === true);
    checa('horário (agenda): dois turnos não cabem', /um horário por dia/.test(await erro(Aa.horario_funcionamento({ dias: 'sexta', turnos: [['9', '12'], ['14', '18']] }))));
  }
  checa('negócio sem agenda não agenda', /não tem agenda/.test(await erro(montar(bancoFalso(), { areas: ['delivery'] }).criar_agendamento({ cliente: 'X', dia: 'hoje', horario: '10:00' }))));

  // promoção, venda, tour
  await A.publicar_promocao({ titulo: 'Terça em dobro', texto: '2 por 1', dias: 5 });
  checa('publicar_promocao', s.promos.length === 1);
  s.vendas = [{ id: 'v1', descricao: 'Corte', valor: 40 }, { id: 'v2', descricao: 'Barba', valor: 25 }];
  t = await A.remover_venda({ descricao: 'barba' });
  checa('remover_venda acha pela descrição', s.vendas.length === 1 && s.vendas[0].id === 'v1', t);
  await A.abrir_tour();
  checa('abrir_tour chama o tour', s.tour === true);

  console.log('\n' + passou + ' passaram, ' + falhou + ' falharam');
  process.exit(falhou ? 1 : 0);
})();
