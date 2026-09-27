/* Tema das áreas de pedido/chamado (Delivery e Serviços) do app.
   Um visual só, claro e translúcido, com a mesma letra do app (a do
   sistema). O que muda por área é só um tom bem sutil no fundo:
   agenda = verde da marca, delivery = pêssego/tomate, serviços = aço.
   A cor de destaque vem do estabelecimento (cor_destaque) ou da área.

   Duas escolhas do dono:
   - layout: lista | grade | cardapio | vitrine (como os itens aparecem)
   - tom:    claro (padrão) | vibrante (faixa colorida no topo, cartões
             brancos translúcidos por cima — ainda sóbrio) */
(function (global) {
  'use strict';

  var AREAS = {
    agenda:   { nome: 'Agenda',   cor: '#0F6B5C', tinta: '15, 107, 92' },
    delivery: { nome: 'Delivery', cor: '#C4553A', tinta: '232, 122, 70' },
    servicos: { nome: 'Serviços', cor: '#2F5D7C', tinta: '70, 104, 138' }
  };

  var LAYOUTS = [
    { chave: 'lista', nome: 'Lista', descricao: 'Um embaixo do outro, foto pequena do lado. O jeito mais rápido de pedir.' },
    { chave: 'grade', nome: 'Grade', descricao: 'Dois por linha, com a foto em cima. Bom pra quem tem foto de tudo.' },
    { chave: 'cardapio', nome: 'Cardápio', descricao: 'Como o cardápio impresso da mesa: nome, pontilhado e preço.' },
    { chave: 'vitrine', nome: 'Vitrine', descricao: 'Capa grande e foto grande de cada item.' }
  ];

  var TONS = [
    { chave: 'claro', nome: 'Claro', descricao: 'Fundo claro com um toque da cor da área.' },
    { chave: 'vibrante', nome: 'Vibrante', descricao: 'Faixa na cor da sua marca no topo, cartões translúcidos por cima.' }
  ];

  function hexParaRgb(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }
  function luminancia(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  // cor muito clara (ex.: dourado) fica ilegível como texto em fundo claro:
  // escurece até ter contraste mínimo pra ser usada em texto/links
  function paraTexto(rgb) {
    var r = rgb.slice();
    for (var i = 0; i < 12 && luminancia(r) > 0.28; i++) r = r.map(function (v) { return Math.round(v * 0.86); });
    return r;
  }

  function layoutValido(l) { return LAYOUTS.some(function (x) { return x.chave === l; }) ? l : null; }
  function tomValido(t) { return TONS.some(function (x) { return x.chave === t; }) ? t : null; }

  function aplicar(opts) {
    opts = opts || {};
    var area = AREAS[opts.area] ? opts.area : 'delivery';
    var a = AREAS[area];
    var cor = hexParaRgb(opts.cor) ? opts.cor : a.cor;
    var rgb = hexParaRgb(cor);
    var txt = paraTexto(rgb);
    var raiz = document.documentElement;
    raiz.setAttribute('data-area', area);
    raiz.setAttribute('data-layout', layoutValido(opts.layout) || 'lista');
    raiz.setAttribute('data-tom', tomValido(opts.tom) || 'claro');
    var s = raiz.style;
    s.setProperty('--accent', cor);
    s.setProperty('--accent-rgb', rgb.join(', '));
    s.setProperty('--accent-texto', 'rgb(' + txt.join(', ') + ')');
    s.setProperty('--on-accent', luminancia(rgb) > 0.45 ? '#1f2024' : '#ffffff');
    s.setProperty('--tint-rgb', a.tinta);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = (tomValido(opts.tom) === 'vibrante') ? cor : '#f4f4f6';
    return { area: area, cor: cor };
  }

  global.VBTema = { AREAS: AREAS, LAYOUTS: LAYOUTS, TONS: TONS, aplicar: aplicar, layoutValido: layoutValido, tomValido: tomValido, hexParaRgb: hexParaRgb };
})(window);
