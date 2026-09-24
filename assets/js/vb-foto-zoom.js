/* Visualizador de foto em tela cheia — tipo abrir a foto de perfil no
   WhatsApp: sem barra de progresso nem avanço automático (isso é o
   vb-status.js), só a imagem ampliada, toca em qualquer lugar ou no ×
   pra fechar. */
(function () {
  var overlay = null;

  function construir() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'vb-foto-zoom-overlay oculto';
    overlay.innerHTML =
      '<button type="button" class="vb-foto-zoom-fechar" aria-label="Fechar">×</button>' +
      '<img class="vb-foto-zoom-img" alt="">';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', fechar);
    return overlay;
  }

  function abrir(url, alt) {
    if (!url) return;
    construir();
    var img = overlay.querySelector('.vb-foto-zoom-img');
    img.src = url;
    img.alt = alt || '';
    overlay.classList.remove('oculto');
    document.body.style.overflow = 'hidden';
  }

  function fechar() {
    if (!overlay) return;
    overlay.classList.add('oculto');
    overlay.querySelector('.vb-foto-zoom-img').src = '';
    document.body.style.overflow = '';
  }

  window.VBFotoZoom = { abrir: abrir, fechar: fechar };
})();
