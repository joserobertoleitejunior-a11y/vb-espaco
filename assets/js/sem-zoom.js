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
  // toque duplo (fora de campos de texto, onde ele seleciona palavra)
  var ultimo = 0;
  document.addEventListener('touchend', function (e) {
    var agora = Date.now();
    if (agora - ultimo < 320 && !(e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]'))) nao(e);
    ultimo = agora;
  }, { passive: false });
  // computador: Ctrl/⌘ + roda do mouse (e pinça do trackpad) ou + - 0
  document.addEventListener('wheel', function (e) { if (e.ctrlKey || e.metaKey) nao(e); }, { passive: false });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].indexOf(e.key) > -1) nao(e);
  });
})();
