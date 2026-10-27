/* Nome da plataforma num lugar só: "Passo a passo". Pra trocar, muda
   aqui (e nos <title>/meta das páginas).

   Dois jeitos de marcar um elemento:
   - data-vibe-marca: recebe o nome como texto puro (menus, rodapés,
     legendas — qualquer menção ao nome que não seja o logotipo).
   - data-vibe-marca-logo: recebe o logotipo de verdade (a letra
     serifada da marca; o "a" do meio sai em inox prateado e itálico, como
     o degrau entre um passo e o próximo — e, se o nome tiver "i", o pino
     dourado entra no lugar do ponto).
     Vazio ("") é a versão pequena, junto do cubo na faixa fina do
     topo; ="hero" é a versão grande da splash, com o traço dourado
     embaixo. Some sozinho se o nome não tiver "i" minúsculo (troca de
     nome no futuro). Fonte: Fraunces (carregada no <head> de cada
     página que usa o logotipo — ver <link ... family=Fraunces>). */
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

  var SWOOSH = '<svg class="pt-swoosh" viewBox="0 0 120 18" aria-hidden="true">' +
    '<path d="M3 4c20 12 94 12 114 0" fill="none" stroke="#C9A227" stroke-width="4" stroke-linecap="round"/></svg>';

  // "Passo a passo": o " a " do meio vira o degrau dourado. Senão, troca a
  // última letra "i" minúscula pelo "ı" sem ponto + o pino por cima dele;
  // sem "i" no nome, fica só o texto normal
  // cada letra vira um degrau (--i = posição na escada): na rolagem o nome
  // "sobe a escada" letra por letra — ver ligarRolagem()
  function letras(txt, inicio) {
    return Array.prototype.map.call(txt, function (c, k) {
      return '<span class="pt-l" style="--i:' + (inicio + k) + '">' + escapeHtml(c) + '</span>';
    }).join('');
  }
  function palavraHtml(nome) {
    var degrau = nome.match(/^(\S+) (a|e|de) (\S+)$/);
    if (degrau) {
      var meio = degrau[1].length;
      return letras(degrau[1], 0) + ' <span class="pt-degrau" style="--i:' + meio + '">' + escapeHtml(degrau[2]) + '</span> ' + letras(degrau[3], meio + 1);
    }
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
  // rolagem da página → o nome sobe a escada (letras em degrau), o "a" de
  // inox inclina e o brilho do metal corre junto; parando de rolar, tudo
  // volta pro lugar com mola. Uma conta por quadro, só com transform.
  function ligarRolagem() {
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // a variável vai só nos logotipos (no <html> recalculava a página inteira a cada quadro)
    var logos = document.querySelectorAll('[data-vibe-marca-logo]');
    if (!logos.length) return;
    function definir(nome, v) { for (var i = 0; i < logos.length; i++) logos[i].style.setProperty(nome, v); }
    var alvo = 0, atual = 0, vel = 0, quadro = null, brilho = 0;
    function passo() {
      // mola: segue o alvo e acomoda sozinha quando a rolagem para
      vel += (alvo - atual) * 0.18;
      vel *= 0.72;
      atual += vel;
      alvo *= 0.86;
      definir('--pt-escada', atual.toFixed(3));
      definir('--pt-brilho', brilho.toFixed(3));
      if (Math.abs(atual) > 0.002 || Math.abs(alvo) > 0.002 || Math.abs(vel) > 0.002) quadro = requestAnimationFrame(passo);
      else { definir('--pt-escada', '0'); quadro = null; }
    }
    function empurrar(dy) {
      // descendo, o nome sobe a escada; subindo, desce — mais forte quanto mais rápido
      alvo = Math.max(-1, Math.min(1, alvo + dy / 140));
      brilho = (brilho + dy / 600) % 1;
      if (!quadro) quadro = requestAnimationFrame(passo);
    }
    // rolagem da página e de telas que rolam por dentro (splash/explorar)
    if (document.scrollingElement) document.scrollingElement.__ptY = document.scrollingElement.scrollTop;
    document.addEventListener('scroll', function (e) {
      var el = e.target === document ? document.scrollingElement : e.target;
      if (!el || el.scrollTop == null) return;
      var antes = el.__ptY == null ? el.scrollTop : el.__ptY;
      el.__ptY = el.scrollTop;
      empurrar(el.scrollTop - antes);
    }, { passive: true, capture: true });
  }

  function iniciar() { aplicar(); ligarRolagem(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
