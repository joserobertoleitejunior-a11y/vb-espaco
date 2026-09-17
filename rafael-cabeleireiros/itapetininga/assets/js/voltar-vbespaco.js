/* Atalho fixo "← Catálogo", igual o botão de voltar do iFood — leva de
   volta pro catálogo geral do VB Espaço. Autocontido (não depende do
   CSS deste site) porque este é o site próprio do estabelecimento. */
(function () {
  var style = document.createElement('style');
  style.textContent =
    '.vb-voltar-catalogo{position:fixed;top:0.9rem;left:0.9rem;z-index:9999;' +
    'display:inline-flex;align-items:center;gap:0.35rem;background:rgba(28,26,23,0.82);' +
    'color:#fff;text-decoration:none;font-size:0.82rem;font-weight:600;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'padding:0.45rem 0.8rem;border-radius:999px;backdrop-filter:blur(2px);}' +
    '.vb-voltar-catalogo:active{transform:scale(0.97);}';
  document.head.appendChild(style);

  var link = document.createElement('a');
  link.className = 'vb-voltar-catalogo';
  link.href = '../../index.html';
  link.innerHTML = '&larr; Catálogo';
  document.body.appendChild(link);
})();
