/* Tipos de negócio da plataforma num lugar só: nome, área (agenda,
   delivery ou servicos), exemplo de nome e ícone de linha. Usado pelo
   Explorar (chips) e pelo passo a passo de criação. A lista de chaves
   precisa bater com vibe_segmentos() no banco. */
(function (global) {
  'use strict';

  // Enquanto Delivery e No local ainda estão em validação, só Agenda
  // aparece pra quem visita (splash e Explorar). Criar um negócio nas
  // outras áreas continua funcionando normal — é só a descoberta
  // pública que fica escondida. Mude aqui quando cada uma for liberada.
  var AREAS_PUBLICAS = ['agenda'];

  var LISTA = [
    // chave, nome, áreas onde aparece, exemplo de nome
    ['barbearia', 'Barbearia', ['agenda'], 'Nome da sua barbearia'],
    ['salao', 'Salão de beleza', ['agenda'], 'Nome do seu salão'],
    ['manicure_pedicure', 'Manicure e pedicure', ['agenda'], 'Nome do seu espaço'],
    ['estetica', 'Estética', ['agenda'], 'Nome da sua clínica'],
    ['estetica_automotiva', 'Estética automotiva', ['agenda', 'servicos'], 'Nome da sua estética automotiva'],
    ['petshop', 'Petshop', ['agenda', 'delivery'], 'Nome do seu petshop'],
    ['pizzaria', 'Pizzaria', ['delivery'], 'Nome da sua pizzaria'],
    ['hamburgueria', 'Hamburgueria', ['delivery'], 'Nome da sua hamburgueria'],
    ['lanchonete', 'Lanchonete', ['delivery'], 'Nome da sua lanchonete'],
    ['restaurante', 'Restaurante', ['delivery'], 'Nome do seu restaurante'],
    ['japonesa', 'Japonesa', ['delivery'], 'Nome do seu restaurante'],
    ['marmitaria', 'Marmitaria', ['delivery'], 'Nome da sua marmitaria'],
    ['acaiteria', 'Açaí', ['delivery'], 'Nome da sua açaiteria'],
    ['sorveteria', 'Sorveteria', ['delivery'], 'Nome da sua sorveteria'],
    ['doceria', 'Doceria', ['delivery'], 'Nome da sua doceria'],
    ['padaria', 'Padaria', ['delivery'], 'Nome da sua padaria'],
    ['mercado', 'Mercado', ['delivery'], 'Nome do seu mercado'],
    ['adega', 'Adega', ['delivery'], 'Nome da sua adega'],
    ['borracharia', 'Borracharia', ['servicos'], 'Nome da sua borracharia'],
    ['chaveiro', 'Chaveiro', ['servicos'], 'Nome do seu chaveiro'],
    ['guincho', 'Guincho', ['servicos'], 'Nome do seu guincho'],
    ['eletricista', 'Eletricista', ['servicos'], 'Seu nome ou da sua empresa'],
    ['encanador', 'Encanador', ['servicos'], 'Seu nome ou da sua empresa'],
    ['pedreiro', 'Pedreiro e reformas', ['servicos'], 'Seu nome ou da sua empresa'],
    ['vidraceiro', 'Vidraçaria', ['servicos'], 'Nome da sua vidraçaria'],
    ['ar_condicionado', 'Ar-condicionado', ['servicos'], 'Nome da sua empresa'],
    ['montador', 'Montador de móveis', ['servicos'], 'Seu nome ou da sua empresa'],
    ['diarista', 'Diarista', ['servicos'], 'Seu nome'],
    ['jardinagem', 'Jardinagem', ['servicos'], 'Seu nome ou da sua empresa'],
    ['dedetizacao', 'Dedetização', ['servicos'], 'Nome da sua empresa'],
    ['assistencia_tecnica', 'Assistência técnica', ['servicos'], 'Nome da sua assistência'],
    ['outro', 'Outro', ['agenda', 'delivery', 'servicos'], 'Nome do seu negócio']
  ];

  // traços 24×24 (sem <svg>) — viram ícone em qualquer tamanho
  var TRACOS = {
    barbearia: '<circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><path d="M8.1 7.5L20 19M8.1 16.5L20 5"/>',
    salao: '<path d="M4 18c2-4 2-8 0-12"/><path d="M9 18c2-4 2-8 0-12"/><path d="M14 18c2-4 2-8 0-12"/><path d="M19 18c2-4 2-8 0-12"/>',
    manicure_pedicure: '<path d="M9 2h6v3l1.5 2v13a1 1 0 01-1 1h-7a1 1 0 01-1-1V7L9 5V2z"/><path d="M9 2h6"/>',
    estetica: '<path d="M12 3l2 5.5L19.5 10.5 14 12.5 12 18 10 12.5 4.5 10.5 10 8.5z"/>',
    estetica_automotiva: '<path d="M3 12l1.5-4.5A2 2 0 016.4 6h11.2a2 2 0 011.9 1.5L21 12"/><path d="M3 12h18v4a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1H7v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-4z"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>',
    petshop: '<circle cx="5.5" cy="9.5" r="2"/><circle cx="9.5" cy="5.5" r="2"/><circle cx="14.5" cy="5.5" r="2"/><circle cx="18.5" cy="9.5" r="2"/><path d="M12 12c-3.5 0-6.5 2.2-6.5 5.2 0 1.5 1.2 2.8 2.8 2.8.9 0 1.7-.4 2.3-1 .4-.4 1-.6 1.4-.6s1 .2 1.4.6c.6.6 1.4 1 2.3 1 1.6 0 2.8-1.3 2.8-2.8 0-3-3-5.2-6.5-5.2z"/>',
    pizzaria: '<path d="M12 2c5.5 0 10 4.5 10 10 0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2C2 6.5 6.5 2 12 2z"/><circle cx="9" cy="9" r="1"/><circle cx="14" cy="7" r="1"/><circle cx="16" cy="11" r="1"/>',
    hamburgueria: '<path d="M4 10a8 5 0 0116 0z"/><path d="M3 13.5h18"/><path d="M4 17h16a2 2 0 01-2 2H6a2 2 0 01-2-2z"/>',
    lanchonete: '<path d="M6 8h12l-1.2 12H7.2z"/><path d="M9 8V5a3 3 0 016 0v3"/>',
    restaurante: '<circle cx="13" cy="13" r="7"/><circle cx="13" cy="13" r="3.5"/><path d="M3 3v6a2 2 0 002 2v10M3 6h4"/>',
    japonesa: '<path d="M3 13h18a9 6 0 01-18 0z"/><path d="M14 3l-4 10"/><path d="M18 4l-5 9"/>',
    marmitaria: '<rect x="3" y="8" width="18" height="11" rx="2"/><path d="M3 12h18"/><path d="M9 8V6h6v2"/>',
    acaiteria: '<path d="M5 10h14l-2 10H7z"/><path d="M8 10a4 4 0 018 0"/><path d="M12 4v2"/>',
    sorveteria: '<path d="M8 11l4 10 4-10"/><path d="M7 11a5 5 0 1110 0z"/>',
    doceria: '<path d="M4 12h16v8H4z"/><path d="M4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1.5 4 0"/><path d="M12 12V8"/><path d="M12 5.5v.01"/>',
    padaria: '<path d="M4 14c0-5 3.6-8 8-8s8 3 8 8v4H4z"/><path d="M9 10l1 4"/><path d="M15 10l-1 4"/>',
    mercado: '<path d="M3 4h2l2.4 11h10.8L20 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    adega: '<path d="M10 3h4v4l2 3v10a1 1 0 01-1 1H9a1 1 0 01-1-1V10l2-3z"/><path d="M8 14h8"/>',
    borracharia: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5"/>',
    chaveiro: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M18 12v3"/><path d="M15.5 12v2"/>',
    guincho: '<path d="M2 16V9h9v7"/><path d="M11 12h5l3 4"/><path d="M11 16h11"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/><path d="M4 9l5-5"/>',
    eletricista: '<path d="M13 2L5 13.5h6L10 22l8-11.5h-6z"/>',
    encanador: '<path d="M12 3s6 6.4 6 10.5a6 6 0 01-12 0C6 9.4 12 3 12 3z"/>',
    pedreiro: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>',
    vidraceiro: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 13l4-4M11 16l6-6"/>',
    ar_condicionado: '<rect x="2.5" y="4" width="19" height="9" rx="2"/><path d="M6 10h12"/><path d="M8 16.5c0 1.5-1 2.5-1 3.5M12 16.5v3.5M16 16.5c0 1.5 1 2.5 1 3.5"/>',
    montador: '<path d="M14.7 6.3a4 4 0 015 5L9 22l-3-3L16.7 8.3"/><path d="M4 20l2-2"/>',
    diarista: '<path d="M12 3v9"/><path d="M7 12h10l1.5 9h-13z"/><path d="M10 16v5M14 16v5"/>',
    jardinagem: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-7 7-7 0 4-3 7-7 7z"/><path d="M12 15c0-3-2.4-5.5-6-5.5 0 3 2.4 5.5 6 5.5z"/>',
    dedetizacao: '<ellipse cx="12" cy="14" rx="4" ry="6"/><path d="M12 8V4M8 11l-4-2M16 11l4-2M8 15H4M16 15h4M8.5 18.5L5 21M15.5 18.5L19 21"/>',
    assistencia_tecnica: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    outro: '<path d="M3 9l1-5h16l1 5"/><path d="M3 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0"/><path d="M5 9v10h14V9"/><path d="M9 19v-6h6v6"/>'
  };

  var POR_CHAVE = {};
  var POR_AREA = { agenda: [], delivery: [], servicos: [] };
  LISTA.forEach(function (l) {
    POR_CHAVE[l[0]] = { chave: l[0], nome: l[1], areas: l[2], exemplo: l[3] };
    l[2].forEach(function (a) { POR_AREA[a].push(l[0]); });
  });
  // em cada área, primeiro os tipos "da casa"; os que também aparecem em
  // outra área vêm depois, e "Outro" sempre por último
  Object.keys(POR_AREA).forEach(function (a) {
    function ordem(k) { return k === 'outro' ? 2 : POR_CHAVE[k].areas[0] === a ? 0 : 1; }
    POR_AREA[a] = POR_AREA[a].map(function (k, i) { return [k, i]; })
      .sort(function (x, y) { return ordem(x[0]) - ordem(y[0]) || x[1] - y[1]; })
      .map(function (x) { return x[0]; });
  });

  function icone(chave, tamanho, traco) {
    var t = TRACOS[chave] || TRACOS.outro;
    var n = tamanho || 24;
    return '<svg viewBox="0 0 24 24" width="' + n + '" height="' + n + '" fill="none" stroke="currentColor" stroke-width="' + (traco || 1.7) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t + '</svg>';
  }
  function nome(chave) { return POR_CHAVE[chave] ? POR_CHAVE[chave].nome : 'Estabelecimento'; }
  function exemplo(chave) { return POR_CHAVE[chave] ? POR_CHAVE[chave].exemplo : 'Nome do seu negócio'; }
  function daArea(chave, area) { return !!(POR_CHAVE[chave] && POR_CHAVE[chave].areas.indexOf(area) > -1); }

  global.VibeSegmentos = { POR_CHAVE: POR_CHAVE, POR_AREA: POR_AREA, icone: icone, nome: nome, exemplo: exemplo, daArea: daArea, AREAS_PUBLICAS: AREAS_PUBLICAS };
})(window);
