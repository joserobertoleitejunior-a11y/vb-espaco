/* Início (index.html): embaixo de "Agendar um horário", "Pedir pra
   entregar" e "Chamar um profissional", os tipos de negócio de cada área
   vão se alternando em letra de código, decodificando na tela — todos os
   que existem no app (segmentos.js), um de cada vez.
   O texto fixo de antes continua pro leitor de tela. */
(function (global) {
  'use strict';
  if (!global.VibeSegmentos) return;
  var reduz = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GLIFOS = '01<>/{}[]#*+=_:;';
  var INTERVALO = 2600;

  function decodificar(el, texto) {
    if (reduz) { el.textContent = texto; return; }
    var n = texto.length, t0 = null, passo = 28, giro = 180;
    function quadro(agora) {
      if (t0 === null) t0 = agora;
      var t = agora - t0, saida = '', fim = true;
      for (var i = 0; i < n; i++) {
        var ch = texto[i], pronto = t - i * passo;
        if (ch === ' ' || pronto >= giro) saida += ch;
        else { saida += GLIFOS[(Math.random() * GLIFOS.length) | 0]; fim = false; }
      }
      el.textContent = saida;
      if (!fim) requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);
  }

  var linhas = [];
  // "Tenho um negócio" / "Meu painel": chama pra criar o site, passando por
  // todos os tipos de negócio do app (das três áreas, sem repetir)
  var TODOS = [];
  ['agenda', 'delivery', 'servicos'].forEach(function (a) {
    (global.VibeSegmentos.POR_AREA[a] || []).forEach(function (k) { if (k !== 'outro' && TODOS.indexOf(k) === -1) TODOS.push(k); });
  });
  document.querySelectorAll('.sp-op[data-area]').forEach(function (op) {
    var area = op.getAttribute('data-area');
    var negocio = area === 'negocio';
    var chaves = negocio ? TODOS : (global.VibeSegmentos.POR_AREA[area] || []).filter(function (k) { return k !== 'outro'; });
    var lista = chaves.map(function (k) { return global.VibeSegmentos.nome(k); });
    var small = op.querySelector('.sp-txt small');
    if (!small || lista.length < 2) return;
    small.removeAttribute('data-aviso-gratis');
    small.classList.add('sp-cod');
    small.setAttribute('aria-label', negocio ? 'Crie grátis o site do seu negócio' : small.textContent);
    small.innerHTML = '<span class="sp-cod-sinal" aria-hidden="true">&gt;</span>' +
      (negocio ? '<span class="sp-cod-fixo" aria-hidden="true">crie grátis:</span>' : '') +
      '<span class="sp-cod-txt" aria-hidden="true"></span><span class="sp-cod-cursor" aria-hidden="true"></span>';
    var linha = { el: small.querySelector('.sp-cod-txt'), lista: lista, i: 0 };
    linha.el.textContent = lista[0];
    linhas.push(linha);
  });
  if (!linhas.length) return;

  // as três linhas trocam em tempos diferentes, pra não piscar tudo junto
  var vez = 0;
  function proximo() {
    if (!document.hidden) {
      var l = linhas[vez % linhas.length];
      l.i = (l.i + 1) % l.lista.length;
      decodificar(l.el, l.lista[l.i]);
      vez++;
    }
    setTimeout(proximo, INTERVALO / linhas.length);
  }
  linhas.forEach(function (l, k) { setTimeout(function () { decodificar(l.el, l.lista[0]); }, 300 + k * 220); });
  if (!reduz) setTimeout(proximo, 1600);
})(window);
