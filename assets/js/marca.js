/* Nome da plataforma num lugar só. Enquanto o nome oficial não sai,
   é "Pertin"; pra trocar, muda aqui (e nos <title>/meta das páginas).

   Dois jeitos de marcar um elemento:
   - data-vibe-marca: recebe o nome como texto puro (menus, rodapés,
     legendas — qualquer menção ao nome que não seja o logotipo).
   - data-vibe-marca-logo: recebe o nome como o logotipo de verdade
     (junto do cubo, na faixa fina do topo ou na splash) — o "i" ganha
     um pino fino, no mesmo traço dourado do cubo. Some sozinho se o
     nome não tiver "i" minúsculo (troca de nome no futuro). */
(function (global) {
  'use strict';
  var MARCA = { nome: 'Pertin', slogan: 'O que você precisa bem perto de você.' };
  global.VIBE_MARCA = MARCA;

  function escapeHtml(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var PINO = '<svg class="pt-pin" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 2.2C8.1 2.2 5 5.4 5 9.3c0 5.1 6.3 12.1 6.7 12.5.2.2.4.2.6 0 .4-.4 6.7-7.4 6.7-12.5 0-3.9-3.1-7.1-7-7.1z" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<circle cx="12" cy="9.2" r="2.1" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

  // troca a última letra "i" minúscula pelo "ı" sem ponto + o pino por
  // cima dele; sem "i" no nome, fica só o texto normal
  function logoHtml(nome) {
    var idx = nome.lastIndexOf('i');
    if (idx === -1) return escapeHtml(nome);
    return escapeHtml(nome.slice(0, idx)) +
      '<span class="pt-idot">ı' + PINO + '</span>' +
      escapeHtml(nome.slice(idx + 1));
  }

  function aplicar() {
    document.querySelectorAll('[data-vibe-marca]').forEach(function (el) { el.textContent = MARCA.nome; });
    document.querySelectorAll('[data-vibe-slogan]').forEach(function (el) { el.textContent = MARCA.slogan; });
    document.querySelectorAll('[data-vibe-marca-logo]').forEach(function (el) {
      el.innerHTML = logoHtml(MARCA.nome);
      el.setAttribute('aria-label', MARCA.nome);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})(window);
