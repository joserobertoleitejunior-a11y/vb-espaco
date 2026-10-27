/* Nome da plataforma num lugar só: "Passo a passo". Pra trocar, muda
   aqui (e nos <title>/meta das páginas).

   Dois jeitos de marcar um elemento:
   - data-vibe-marca: recebe o nome como texto puro (menus, rodapés,
     legendas — qualquer menção ao nome que não seja o logotipo).
   - data-vibe-marca-logo: recebe o logotipo de verdade (a letra
     em letra de código (JetBrains Mono), numa pastilha de vidro; o "a"
     do meio sai mais leve, como o degrau entre um passo e o próximo — e, se o nome tiver "i", o pino
     dourado entra no lugar do ponto).
     Vazio ("") é a versão pequena, junto do cubo na faixa fina do
     topo; ="hero" é a versão grande da splash. Some sozinho se o nome não tiver "i" minúsculo (troca de
     nome no futuro). A fonte é carregada aqui mesmo (carregarFonte). */
(function (global) {
  'use strict';
  var MARCA = { nome: 'Passo a passo', slogan: 'O próximo passo a um clique.' };
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

  // "Passo a passo": o " a " do meio vira o degrau dourado. Senão, troca a
  // última letra "i" minúscula pelo "ı" sem ponto + o pino por cima dele;
  // sem "i" no nome, fica só o texto normal
  function palavraHtml(nome) {
    var degrau = nome.match(/^(\S+) (a|e|de) (\S+)$/);
    if (degrau) {
      return escapeHtml(degrau[1]) + ' <span class="pt-degrau">' + escapeHtml(degrau[2]) + '</span> ' + escapeHtml(degrau[3]);
    }
    var idx = nome.lastIndexOf('i');
    if (idx === -1) return escapeHtml(nome);
    return escapeHtml(nome.slice(0, idx)) +
      '<span class="pt-idot">ı' + PINO + '</span>' +
      escapeHtml(nome.slice(idx + 1));
  }

  function logoHtml(nome, variante) {
    var palavra = '<span class="pt-word">' + palavraHtml(nome) + '</span>';
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
  // letra "de código" (monoespaçada) só pro logotipo; o nome aparece
  // devagar quando a letra já chegou — sem trocar de fonte na frente da pessoa
  function carregarFonte() {
    if (!document.getElementById('ptFonteCodigo')) {
      var l = document.createElement('link');
      l.id = 'ptFonteCodigo';
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap';
      document.head.appendChild(l);
    }
    var mostrar = function () { document.documentElement.classList.add('pt-marca-pronta'); };
    if (document.fonts && document.fonts.load) {
      Promise.race([
        document.fonts.load('600 1em "JetBrains Mono"'),
        new Promise(function (r) { setTimeout(r, 1200); })
      ]).then(mostrar, mostrar);
    } else mostrar();
  }

  function iniciar() { carregarFonte(); aplicar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
