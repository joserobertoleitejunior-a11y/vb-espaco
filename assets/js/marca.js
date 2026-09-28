/* Nome da plataforma num lugar só. Enquanto o nome oficial não sai,
   é "Pertin"; pra trocar, muda aqui (e nos <title>/meta das páginas).

   Dois jeitos de marcar um elemento:
   - data-vibe-marca: recebe o nome como texto puro (menus, rodapés,
     legendas — qualquer menção ao nome que não seja o logotipo).
   - data-vibe-marca-logo: recebe o logotipo de verdade (a letra
     serifada da marca, com um pino dourado no lugar do ponto do "i").
     Vazio ("") é a versão pequena, junto do cubo na faixa fina do
     topo; ="hero" é a versão grande da splash, com o traço dourado
     embaixo. Some sozinho se o nome não tiver "i" minúsculo (troca de
     nome no futuro). Fonte: Fraunces (carregada no <head> de cada
     página que usa o logotipo — ver <link ... family=Fraunces>). */
(function (global) {
  'use strict';
  var MARCA = { nome: 'Pertin', slogan: 'O que você precisa bem perto de você.' };
  global.VIBE_MARCA = MARCA;

  function escapeHtml(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // pino de localização (o mesmo ícone-padrão de mapa, só que dourado):
  // contorno + furo central desenhados no mesmo path, então o "buraco"
  // sempre mostra o que tiver atrás, seja fundo claro ou escuro
  var PINO = '<svg class="pt-pin" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 1.8C7.9 1.8 4.6 5.1 4.6 9.2c0 5.7 6.4 12.1 7 12.7.2.2.5.3.8.3s.6-.1.8-.3c.6-.6 7-7 7-12.7 0-4.1-3.3-7.4-7.4-7.4zm0 10.1c-1.5 0-2.7-1.2-2.7-2.7S10.5 6.5 12 6.5s2.7 1.2 2.7 2.7-1.2 2.7-2.7 2.7z"/>' +
    '</svg>';

  var SWOOSH = '<svg class="pt-swoosh" viewBox="0 0 120 18" aria-hidden="true">' +
    '<path d="M3 4c20 12 94 12 114 0" fill="none" stroke="#C9A227" stroke-width="4" stroke-linecap="round"/></svg>';

  // troca a última letra "i" minúscula pelo "ı" sem ponto + o pino por
  // cima dele; sem "i" no nome, fica só o texto normal
  function palavraHtml(nome) {
    var idx = nome.lastIndexOf('i');
    if (idx === -1) return escapeHtml(nome);
    return escapeHtml(nome.slice(0, idx)) +
      '<span class="pt-idot">ı' + PINO + '</span>' +
      escapeHtml(nome.slice(idx + 1));
  }

  function logoHtml(nome, variante) {
    var palavra = '<span class="pt-word">' + palavraHtml(nome) + '</span>';
    if (variante === 'hero') palavra += SWOOSH;
    return palavra;
  }

  function aplicar() {
    document.querySelectorAll('[data-vibe-marca]').forEach(function (el) { el.textContent = MARCA.nome; });
    document.querySelectorAll('[data-vibe-slogan]').forEach(function (el) { el.textContent = MARCA.slogan; });
    document.querySelectorAll('[data-vibe-marca-logo]').forEach(function (el) {
      el.innerHTML = logoHtml(MARCA.nome, el.getAttribute('data-vibe-marca-logo'));
      el.setAttribute('aria-label', MARCA.nome);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})(window);
