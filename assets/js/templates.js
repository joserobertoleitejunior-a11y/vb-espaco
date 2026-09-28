/* Estilos do site da Agenda num lugar só (antes a lista ficava repetida
   em perfil.js, institucional.js e criar-preview.js).

   Cada estilo usa uma pasta-base (mesmo HTML/classes, só muda o CSS) e
   pode ter uma camada "extra" por cima — é assim que os estilos novos
   nascem sem duplicar 30 KB de CSS cada. Os estilos "segue sua foto"
   tiram a cor de destaque da foto de capa e usam a própria foto,
   desfocada, como fundo translúcido. */
(function (global) {
  'use strict';

  var PRINT = '/assets/img/templates/';
  var EXTRA = '/assets/tpl-extra/';
  var V_BASE = 'v=5', V_FEM = 'v=3', V_WIDGET = 'v=5', V_EXTRA = 'v=1';

  var GRUPOS = [
    { chave: '', nome: 'Todos' },
    { chave: 'claro', nome: 'Claros' },
    { chave: 'vibrante', nome: 'Vibrantes' },
    { chave: 'escuro', nome: 'Escuros' },
    { chave: 'foto', nome: 'Seguem sua foto' }
  ];

  var LISTA = [
    { chave: 'claro-minimal', nome: 'Claro', grupo: 'claro', pasta: 'tpl-claro', print: 'claro.jpg' },
    { chave: 'classico-boiserie', nome: 'Clássico', grupo: 'claro', pasta: 'tpl-classico', print: 'classico.jpg' },
    { chave: 'boho-terracota', nome: 'Boho', grupo: 'claro', pasta: 'tpl-boho', print: 'boho.jpg' },
    { chave: 'vidro-fosco', nome: 'Vidro', grupo: 'vibrante', pasta: 'tpl-vidro', print: 'vidro.jpg' },
    { chave: 'pizza-forno', nome: 'Forno', grupo: 'vibrante', pasta: 'tpl-pizza', print: 'pizza.jpg' },
    { chave: 'escuro-premium', nome: 'Escuro', grupo: 'escuro', pasta: 'tpl-escuro', print: 'escuro.jpg' },
    { chave: 'automotivo-carbono', nome: 'Automotivo', grupo: 'escuro', pasta: 'tpl-automotivo', print: 'automotivo.jpg' },
  ];
  var POR_CHAVE = {};
  LISTA.forEach(function (t) { t.print = PRINT + t.print; POR_CHAVE[t.chave] = t; });

  function achar(chave) { return POR_CHAVE[chave] || POR_CHAVE['classico-boiserie']; }
  // só o Clássico usa --dourado como cor de destaque; os outros, --terracotta
  function usaTerracotta(chave) { return achar(chave).pasta !== 'tpl-classico'; }
  function segueFoto(chave) { return !!achar(chave).segueFoto; }

  function trocarLink(id, href) {
    var el = document.getElementById(id);
    if (el && href && el.getAttribute('href') !== href) el.setAttribute('href', href);
    return el;
  }
  // troca o CSS da página (links #tplBase, #tplFeminino, #tplWidget, #tplExtra)
  function aplicar(chave) {
    var t = achar(chave);
    var raiz = '/assets/' + t.pasta + '/css/';
    trocarLink('tplBase', raiz + 'base.css?' + V_BASE);
    trocarLink('tplFeminino', raiz + 'feminino.css?' + V_FEM);
    trocarLink('tplWidget', raiz + 'widget.css?' + V_WIDGET);
    var extra = document.getElementById('tplExtra');
    if (!extra && t.extra) {
      extra = document.createElement('link');
      extra.rel = 'stylesheet';
      extra.id = 'tplExtra';
      document.head.appendChild(extra);
    }
    if (extra) {
      if (t.extra) { trocarLink('tplExtra', EXTRA + t.extra + '?' + V_EXTRA); extra.disabled = false; } else extra.disabled = true;
    }
    document.documentElement.setAttribute('data-tpl', t.chave);
    return t;
  }

  // ---- "segue sua foto": fundo com a própria foto + cor dominante ----
  function rgbParaHex(rgb) {
    return '#' + rgb.map(function (c) { return Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'); }).join('');
  }
  // cor dominante com personalidade: agrupa os pixels por matiz e fica com
  // o grupo de maior peso (saturação × brilho), ignorando branco/preto/cinza
  function corDominante(img) {
    var c = document.createElement('canvas');
    c.width = c.height = 40;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 40, 40);
    var px = ctx.getImageData(0, 0, 40, 40).data;
    var baldes = [];
    for (var i = 0; i < 12; i++) baldes.push({ peso: 0, r: 0, g: 0, b: 0 });
    for (var p = 0; p < px.length; p += 4) {
      var r = px[p], g = px[p + 1], b = px[p + 2];
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var sat = max ? (max - min) / max : 0;
      var val = max / 255;
      if (sat < 0.18 || val < 0.16 || val > 0.97) continue;
      var h;
      if (max === r) h = ((g - b) / (max - min)) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
      var bal = baldes[Math.floor(((h * 60 + 360) % 360) / 30)];
      var peso = sat * (0.4 + val);
      bal.peso += peso; bal.r += r * peso; bal.g += g * peso; bal.b += b * peso;
    }
    var melhor = baldes.reduce(function (a, x) { return x.peso > a.peso ? x : a; }, { peso: 0 });
    if (!melhor.peso) return null;
    return rgbParaHex([melhor.r / melhor.peso, melhor.g / melhor.peso, melhor.b / melhor.peso]);
  }
  var cacheCor = {};
  // devolve a cor (#rrggbb) da foto, ou null se não der pra ler (CORS, erro)
  function corDaFoto(url) {
    if (!url) return Promise.resolve(null);
    if (cacheCor[url] !== undefined) return Promise.resolve(cacheCor[url]);
    return new Promise(function (ok) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        var cor = null;
        try { cor = corDominante(img); } catch (e) { cor = null; }
        cacheCor[url] = cor;
        ok(cor);
      };
      img.onerror = function () { cacheCor[url] = null; ok(null); };
      img.src = url;
    });
  }
  // põe a foto como fundo (var --foto-fundo, usada pelos estilos "foto")
  function fundoDaFoto(url) {
    var s = document.documentElement.style;
    if (url) s.setProperty('--foto-fundo', 'url("' + String(url).replace(/"/g, '%22') + '")');
    else s.removeProperty('--foto-fundo');
  }

  global.VibeTemplates = {
    LISTA: LISTA, GRUPOS: GRUPOS, achar: achar, aplicar: aplicar,
    usaTerracotta: usaTerracotta, segueFoto: segueFoto, corDaFoto: corDaFoto, fundoDaFoto: fundoDaFoto
  };
})(window);
