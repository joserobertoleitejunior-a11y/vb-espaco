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
  var ultimo = 0;
  document.addEventListener('touchend', function (e) {
    var agora = Date.now();
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
