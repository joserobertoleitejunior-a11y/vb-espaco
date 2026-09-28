/* Nome da plataforma num lugar só. Enquanto o nome oficial não sai,
   é "Cadê? Achei!"; pra trocar, muda aqui (e nos <title>/meta das páginas).
   Todo elemento com data-vibe-marca recebe o nome. */
(function (global) {
  'use strict';
  var MARCA = { nome: 'Cadê? Achei!', slogan: 'Precisou? Achou.' };
  global.VIBE_MARCA = MARCA;
  function aplicar() {
    document.querySelectorAll('[data-vibe-marca]').forEach(function (el) { el.textContent = MARCA.nome; });
    document.querySelectorAll('[data-vibe-slogan]').forEach(function (el) { el.textContent = MARCA.slogan; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})(window);
