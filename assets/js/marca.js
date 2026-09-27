/* Nome da plataforma num lugar só. Enquanto o nome oficial não sai,
   é "Vibe"; pra trocar, muda aqui (e nos <title>/meta das páginas).
   Todo elemento com data-vibe-marca recebe o nome. */
(function (global) {
  'use strict';
  var MARCA = { nome: 'Vibe', slogan: 'Agende, peça e chame quem faz — perto de você.' };
  global.VIBE_MARCA = MARCA;
  function aplicar() {
    document.querySelectorAll('[data-vibe-marca]').forEach(function (el) { el.textContent = MARCA.nome; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})(window);
