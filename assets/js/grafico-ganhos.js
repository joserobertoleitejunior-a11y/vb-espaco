/* Gráfico de barras do faturamento — um só componente, usado no painel (Ganhos)
   e dentro do chat com o funcionário. Cada barra é um botão: tocar mostra o dia
   e o valor numa linha de leitura (no celular não existe "passar o mouse").

     VBGrafico.barras(serie, { formatar: fn(valor), tema: 'claro'|'terminal' }) → html
       serie = [{ dia: '03/11', total: 293.94 }, …]
   Quem usa só precisa pôr o html na página: os toques são ouvidos no document. */
(function (global) {
  'use strict';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function barras(serie, op) {
    op = op || {};
    var fmt = op.formatar || function (v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); };
    serie = serie || [];
    var maior = serie.reduce(function (m, d) { return Math.max(m, Number(d.total) || 0); }, 0);
    if (!(maior > 0)) return '';
    var n = serie.length;
    // muitas barras: só alguns rótulos, senão as datas se atropelam
    var passo = n <= 8 ? 1 : n <= 16 ? 2 : 5;
    var melhor = 0;
    serie.forEach(function (d, i) { if ((Number(d.total) || 0) > (Number(serie[melhor].total) || 0)) melhor = i; });
    var html = '<div class="vg vg-' + (op.tema || 'claro') + '" data-vg>' +
      '<p class="vg-leitura" data-vg-leitura>Toque numa barra pra ver o valor do dia</p>' +
      '<div class="vg-barras' + (n > 16 ? ' vg-denso' : '') + '">';
    serie.forEach(function (d, i) {
      var v = Number(d.total) || 0, h = Math.max(v > 0 ? 4 : 1, Math.round((v / maior) * 100));
      var rotulo = (i % passo === 0 || i === n - 1) ? esc(d.dia) : '';
      html += '<button type="button" class="vg-col' + (i === melhor ? ' vg-melhor' : '') + '" data-vg-dia="' + esc(d.dia) + '" data-vg-valor="' + esc(fmt(v)) + '" aria-label="' + esc(d.dia) + ': ' + esc(fmt(v)) + '">' +
        '<span class="vg-trilho"><span class="vg-barra" style="height:' + h + '%;animation-delay:' + Math.min(i, 30) * 18 + 'ms"></span></span>' +
        '<span class="vg-rotulo">' + rotulo + '</span></button>';
    });
    return html + '</div></div>';
  }

  document.addEventListener('click', function (e) {
    var col = e.target.closest && e.target.closest('[data-vg-dia]');
    if (!col) return;
    var raiz = col.closest('[data-vg]');
    if (!raiz) return;
    raiz.querySelectorAll('.vg-col.on').forEach(function (c) { c.classList.remove('on'); });
    col.classList.add('on');
    var l = raiz.querySelector('[data-vg-leitura]');
    if (l) l.innerHTML = '<b>' + esc(col.getAttribute('data-vg-dia')) + '</b> · ' + esc(col.getAttribute('data-vg-valor'));
  });

  global.VBGrafico = { barras: barras };
})(window);
