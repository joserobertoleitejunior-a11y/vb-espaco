/* Sem zoom em lugar nenhum do app — nem no iPhone.
   O Safari do iOS ignora o "user-scalable=no" do viewport desde o iOS 10,
   então travamos na mão: pinça (gesture*), dois dedos arrastando, toque
   duplo e, no computador, Ctrl + roda do mouse / Ctrl + "+" "-" "0".
   O zoom automático do iPhone ao tocar num campo de texto pequeno é
   evitado no CSS (campos com pelo menos 16px). */
(function () {
  'use strict';
  var nao = function (e) { if (e.cancelable) e.preventDefault(); };

  // iPhone/iPad: pinça
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, nao, { passive: false });
  });
  // dois ou mais dedos na tela
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) nao(e);
  }, { passive: false });
  // toque duplo: o CSS touch-action já impede o zoom nos navegadores novos;
  // no iPhone antigo travamos o segundo toque rápido — mas sem perder o
  // toque: quem toca uma opção e logo outra (ou "Continuar") ainda escolhe
  // certo, porque o clique é disparado na mão no lugar tocado
  document.documentElement.style.touchAction = 'manipulation';
  var ultimo = 0, x0 = 0, y0 = 0, t0 = 0;
  document.addEventListener('touchstart', function (e) {
    var t = e.touches && e.touches[0];
    if (t) { x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); }
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var agora = Date.now();
    var c = e.changedTouches && e.changedTouches[0];
    // arrastar/rolar NÃO é toque: nunca mexe nisso (antes, rolar rápido duas vezes
    // travava a rolagem e podia clicar num botão sem querer)
    var foiToque = c && Math.abs(c.clientX - x0) < 10 && Math.abs(c.clientY - y0) < 10 && agora - t0 < 350;
    if (!foiToque) { ultimo = 0; return; }
    var rapido = agora - ultimo < 320;
    ultimo = agora;
    if (!rapido || (e.touches && e.touches.length) || (e.changedTouches && e.changedTouches.length > 1)) return;
    var alvo = e.target && e.target.closest ? e.target : null;
    if (!alvo || alvo.closest('input, textarea, select, [contenteditable="true"]')) return;
    nao(e);
    var clicavel = alvo.closest('button, a, label, summary, [role="button"], [role="link"], [data-key], [data-value], [tabindex]');
    if (clicavel && !clicavel.disabled) clicavel.click();
  }, { passive: false });
  // computador: Ctrl/⌘ + roda do mouse (e pinça do trackpad) ou + - 0
  document.addEventListener('wheel', function (e) { if (e.ctrlKey || e.metaKey) nao(e); }, { passive: false });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].indexOf(e.key) > -1) nao(e);
  });
})();
