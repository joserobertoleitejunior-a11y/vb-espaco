/* Confirmação visual de "salvo" — o mesmo cubo 3D da marca (agora em
   CSS puro, sem depender de WebGL/CDN pra disparar instantâneo toda
   vez que algo salva) gira cada vez mais rápido e desaparece num
   ponto, feito uma TV antiga desligando. Chame window.VBSalvo.mostrar()
   depois de qualquer ação que salvou algo de verdade. */
(function () {
  var DURACAO_NORMAL = 1000; // ms — soma de todos os estágios do CSS, com folga
  var DURACAO_REDUZIDA = 900;

  var reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var FACES = ['frente', 'tras', 'direita', 'esquerda', 'cima', 'baixo'];

  function montarConteudo() {
    if (reduzMovimento) {
      return '<p class="vb-salvo-check" aria-hidden="true">✓</p><p class="vb-salvo-texto"></p>';
    }
    var cubo = FACES.map(function (f) { return '<div class="vb-salvo-face vb-salvo-face-' + f + '"></div>'; }).join('');
    return '<div class="vb-salvo-cena"><div class="vb-salvo-cubo">' + cubo + '</div></div><p class="vb-salvo-texto"></p>';
  }

  function mostrar(texto) {
    var antigo = document.querySelector('.vb-salvo-overlay');
    if (antigo) antigo.remove();

    var overlay = document.createElement('div');
    overlay.className = 'vb-salvo-overlay' + (reduzMovimento ? ' reduz-movimento' : '');
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = montarConteudo();
    overlay.querySelector('.vb-salvo-texto').textContent = texto || 'Salvo';
    document.body.appendChild(overlay);

    setTimeout(function () { overlay.remove(); }, reduzMovimento ? DURACAO_REDUZIDA : DURACAO_NORMAL);
  }

  window.VBSalvo = { mostrar: mostrar };
})();
