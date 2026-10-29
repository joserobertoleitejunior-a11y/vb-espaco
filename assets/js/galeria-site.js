/* Galeria do site do negócio (Agendar e Pedir/Chamar): faixa de fotos
   grandes que desliza pro lado no celular, mosaico no computador, e a foto
   em tela cheia ao tocar (arrasta pro lado, setas, Esc fecha).
   Fotos vêm de tenant_listar_galeria (as mesmas que o dono sobe no passo
   "Galeria de fotos" do editor).

   VBGaleria.montar(secao, fotos, { titulo: 'Galeria' })   fotos: [{ foto_url, estilo }]
   VBGaleria.telaCheia(fotos, indice) */
(function (global) {
  'use strict';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var SETA = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

  function montar(secao, fotos, opts) {
    opts = opts || {};
    if (!secao) return;
    if (!fotos || !fotos.length) { secao.classList.add('oculto'); return; }
    var n = fotos.length;
    secao.classList.add('gs');
    secao.innerHTML =
      '<div class="gs-topo">' +
        '<div><p class="eyebrow">' + esc(opts.titulo || 'Galeria') + '</p>' +
        '<p class="gs-conta">' + n + (n === 1 ? ' foto' : ' fotos') + '</p></div>' +
        (n > 1 ? '<button type="button" class="gs-todas" data-gs="0">Ver em tela cheia</button>' : '') +
      '</div>' +
      '<div class="gs-faixa gs-n' + Math.min(n, 5) + (n === 1 ? ' gs-uma' : '') + '">' +
        fotos.map(function (f, i) {
          return '<button type="button" class="gs-item" data-gs="' + i + '" aria-label="Abrir foto ' + (i + 1) + ' de ' + n + '">' +
            '<img src="' + esc(f.foto_url) + '" alt="" loading="lazy" decoding="async">' +
            (f.estilo ? '<span class="gs-legenda">' + esc(f.estilo) + '</span>' : '') +
          '</button>';
        }).join('') +
      '</div>';
    secao.classList.remove('oculto');
    secao.onclick = function (e) {
      var b = e.target.closest('[data-gs]');
      if (b) telaCheia(fotos, Number(b.getAttribute('data-gs')));
    };
  }

  var aberta = null;
  function telaCheia(fotos, indice) {
    if (aberta) aberta.fechar();
    var i = indice || 0;
    var el = document.createElement('div');
    el.className = 'gs-tela';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Galeria de fotos');
    el.innerHTML =
      '<button type="button" class="gs-fechar" aria-label="Fechar">×</button>' +
      '<span class="gs-contador" aria-live="polite"></span>' +
      '<div class="gs-palco"><img alt=""></div>' +
      (fotos.length > 1 ? '<button type="button" class="gs-nav gs-ant" aria-label="Foto anterior">' + SETA + '</button>' +
        '<button type="button" class="gs-nav gs-prox" aria-label="Próxima foto">' + SETA + '</button>' : '') +
      '<p class="gs-tela-legenda"></p>';
    document.body.appendChild(el);
    var img = el.querySelector('img'), contador = el.querySelector('.gs-contador'), legenda = el.querySelector('.gs-tela-legenda');
    var rolagemAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function mostrar(k) {
      i = (k + fotos.length) % fotos.length;
      img.classList.remove('gs-entrou');
      img.src = fotos[i].foto_url;
      void img.offsetWidth;
      img.classList.add('gs-entrou');
      contador.textContent = (i + 1) + ' / ' + fotos.length;
      legenda.textContent = fotos[i].estilo || '';
      // já carrega a próxima pra passar sem esperar
      if (fotos.length > 1) { var pre = new Image(); pre.src = fotos[(i + 1) % fotos.length].foto_url; }
    }
    function fechar() {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = rolagemAntes;
      el.classList.add('gs-saindo');
      setTimeout(function () { el.remove(); }, 180);
      aberta = null;
    }
    function tecla(e) {
      if (e.key === 'Escape') fechar();
      else if (e.key === 'ArrowRight') mostrar(i + 1);
      else if (e.key === 'ArrowLeft') mostrar(i - 1);
    }
    document.addEventListener('keydown', tecla);
    el.querySelector('.gs-fechar').addEventListener('click', fechar);
    var ant = el.querySelector('.gs-ant'), prox = el.querySelector('.gs-prox');
    if (ant) ant.addEventListener('click', function () { mostrar(i - 1); });
    if (prox) prox.addEventListener('click', function () { mostrar(i + 1); });
    // tocar fora da foto fecha
    el.querySelector('.gs-palco').addEventListener('click', function (e) { if (e.target === this) fechar(); });
    // arrastar pro lado troca a foto; pra baixo fecha
    var x0 = null, y0 = null;
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) mostrar(i + (dx < 0 ? 1 : -1));
      else if (dy > 90) fechar();
    });
    mostrar(i);
    el.querySelector('.gs-fechar').focus();
    aberta = { fechar: fechar };
  }

  global.VBGaleria = { montar: montar, telaCheia: telaCheia };
})(window);
