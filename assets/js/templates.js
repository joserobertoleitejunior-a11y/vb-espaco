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

  // ---- "segue sua foto": a cor vem de cor-da-imagem.js (opção "Seguir
  // foto" do site, ligada sozinha nesses estilos); aqui só o fundo ----
  // põe a foto como fundo (var --foto-fundo, usada pelos estilos "foto")
  function fundoDaFoto(url) {
    var s = document.documentElement.style;
    if (url) s.setProperty('--foto-fundo', 'url("' + String(url).replace(/"/g, '%22') + '")');
    else s.removeProperty('--foto-fundo');
  }

  global.VibeTemplates = {
    LISTA: LISTA, GRUPOS: GRUPOS, achar: achar, aplicar: aplicar,
    usaTerracotta: usaTerracotta, segueFoto: segueFoto, fundoDaFoto: fundoDaFoto
  };
})(window);
