/* Estilos do site da Agenda num lugar só (antes a lista ficava repetida
   em perfil.js, institucional.js e criar-preview.js).

   Cada estilo usa uma pasta-base (mesmo HTML/classes, só muda o CSS) e
   pode ter uma camada "extra" por cima — é assim que os estilos novos
   nascem sem duplicar 30 KB de CSS cada. Os estilos "segue sua foto"
   ligam o "Seguir foto" (cor tirada da foto de capa) e usam a própria
   foto, desfocada, como fundo translúcido. */
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
    { chave: 'nordico', nome: 'Nórdico', grupo: 'claro', pasta: 'tpl-claro', extra: 'nordico.css', print: 'nordico.jpg' },
    { chave: 'papel', nome: 'Papel', grupo: 'claro', pasta: 'tpl-claro', extra: 'papel.css', print: 'papel.jpg' },
    { chave: 'pastel', nome: 'Pastel', grupo: 'claro', pasta: 'tpl-claro', extra: 'pastel.css', print: 'pastel.jpg' },
    { chave: 'classico-boiserie', nome: 'Clássico', grupo: 'claro', pasta: 'tpl-classico', print: 'classico.jpg' },
    { chave: 'boho-terracota', nome: 'Boho', grupo: 'claro', pasta: 'tpl-boho', print: 'boho.jpg' },
    { chave: 'aurora', nome: 'Aurora', grupo: 'vibrante', pasta: 'tpl-vidro', extra: 'aurora.css', print: 'aurora.jpg' },
    { chave: 'vidro-fosco', nome: 'Vidro', grupo: 'vibrante', pasta: 'tpl-vidro', print: 'vidro.jpg' },
    { chave: 'neon', nome: 'Neon', grupo: 'vibrante', pasta: 'tpl-escuro', extra: 'neon.css', print: 'neon.jpg' },
    { chave: 'pizza-forno', nome: 'Forno', grupo: 'vibrante', pasta: 'tpl-pizza', print: 'pizza.jpg' },
    { chave: 'escuro-premium', nome: 'Escuro', grupo: 'escuro', pasta: 'tpl-escuro', print: 'escuro.jpg' },
    { chave: 'automotivo-carbono', nome: 'Automotivo', grupo: 'escuro', pasta: 'tpl-automotivo', print: 'automotivo.jpg' },
    { chave: 'ambiente', nome: 'Ambiente', grupo: 'foto', pasta: 'tpl-vidro', extra: 'ambiente.css', print: 'ambiente.jpg', segueFoto: true },
    { chave: 'luz', nome: 'Luz', grupo: 'foto', pasta: 'tpl-claro', extra: 'luz.css', print: 'luz.jpg', segueFoto: true }
  ];

  var POR_CHAVE = {};
  LISTA.forEach(function (t) { t.print = PRINT + t.print; POR_CHAVE[t.chave] = t; });

  function achar(chave) { return POR_CHAVE[chave] || POR_CHAVE['classico-boiserie']; }
  // só o Clássico usa --dourado como cor de destaque; os outros, --terracotta
  function usaTerracotta(chave) { return achar(chave).pasta !== 'tpl-classico'; }
  function segueFoto(chave) { return !!achar(chave).segueFoto; }

  // Troca um CSS do estilo sem deixar a página "crua": o arquivo novo entra
  // ao lado do antigo e o antigo só sai quando o novo terminou de carregar
  // (trocar o href direto apagava o estilo por um instante — a tela piscava
  // e mostrava o layout sem formatação). Lendo o <head> ainda (nada pintado),
  // escreve o link no lugar, e ele segura a primeira pintura até carregar.
  var carregando = [];
  function trocarLink(id, href) {
    var el = document.getElementById(id);
    if (!el || !href) return el;
    if ((el.getAttribute('data-destino') || el.getAttribute('href')) === href) return el;
    if (!document.body && document.readyState === 'loading') {
      document.write('<link rel="stylesheet" id="' + id + '" href="' + href + '"' + (el.disabled ? ' disabled' : '') + '>');
      el.parentNode.removeChild(el);
      return document.getElementById(id);
    }
    // desligado (ex.: CSS feminino em site masculino) não carrega nem pinta: troca direto
    if (el.disabled) { el.setAttribute('href', href); return el; }
    var novo = el.cloneNode(false);
    novo.removeAttribute('id');
    novo.setAttribute('href', href);
    el.setAttribute('data-destino', href);
    carregando.push(new Promise(function (pronto) {
      function trocar() {
        var atual = document.getElementById(id);
        if (atual && atual !== novo) { novo.disabled = atual.disabled; atual.parentNode.removeChild(atual); }
        novo.id = id;
        pronto();
      }
      novo.addEventListener('load', trocar);
      novo.addEventListener('error', trocar);
      setTimeout(trocar, 4000); // rede ruim: não prende a tela pra sempre
    }));
    el.parentNode.insertBefore(novo, el.nextSibling);
    return el;
  }
  // resolve quando todo CSS trocado por aplicar() já está na tela
  function quandoPronto() { return Promise.all(carregando.slice()); }

  // troca o CSS da página (links #tplBase, #tplFeminino, #tplWidget, #tplExtra)
  function aplicar(chave) {
    var t = achar(chave);
    var raiz = '/assets/' + t.pasta + '/css/';
    trocarLink('tplBase', raiz + 'base.css?' + V_BASE);
    trocarLink('tplFeminino', raiz + 'feminino.css?' + V_FEM);
    trocarLink('tplWidget', raiz + 'widget.css?' + V_WIDGET);
    var extra = document.getElementById('tplExtra');
    if (!extra && t.extra && !document.body && document.readyState === 'loading') {
      document.write('<link rel="stylesheet" id="tplExtra" href="' + EXTRA + t.extra + '?' + V_EXTRA + '">');
      extra = document.getElementById('tplExtra');
    }
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

  // ---- "segue sua foto": a cor vem de cor-da-imagem.js (opção "Seguir
  // foto" do site, ligada sozinha nesses estilos); aqui só o fundo ----
  // põe a foto como fundo (var --foto-fundo, usada pelos estilos "foto")
  function fundoDaFoto(url) {
    var s = document.documentElement.style;
    if (url) s.setProperty('--foto-fundo', 'url("' + String(url).replace(/"/g, '%22') + '")');
    else s.removeProperty('--foto-fundo');
  }

  // ---- lembrar o visual do site neste aparelho: na próxima visita o estilo
  // e a cor certos entram ANTES da primeira pintura (chamado no <head>), em
  // vez de a tela piscar do estilo padrão pro do negócio ----
  function chaveVisual() {
    var p = location.pathname.split('/').filter(Boolean);
    return p.length >= 2 && !/\.html$/.test(p[0]) ? 'vb-visual:' + p[0] + '/' + p[1] : null;
  }
  function lembrar(chave) {
    var k = chaveVisual();
    if (!k) return;
    try {
      var cor = document.getElementById('tplCorDinamica');
      localStorage.setItem(k, JSON.stringify({ t: chave, css: cor ? cor.textContent : '' }));
    } catch (e) {}
  }
  function restaurar() {
    var k = chaveVisual(), v = null;
    try { v = k && JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {}
    if (!v || !v.t || !POR_CHAVE[v.t]) return false;
    aplicar(v.t);
    if (v.css && !document.getElementById('tplCorDinamica')) {
      var st = document.createElement('style');
      st.id = 'tplCorDinamica';
      st.textContent = v.css;
      document.head.appendChild(st);
    }
    return true;
  }

  global.VibeTemplates = {
    LISTA: LISTA, GRUPOS: GRUPOS, achar: achar, aplicar: aplicar,
    usaTerracotta: usaTerracotta, segueFoto: segueFoto, fundoDaFoto: fundoDaFoto,
    lembrar: lembrar, restaurar: restaurar, quandoPronto: quandoPronto
  };
})(window);
