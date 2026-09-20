/* Visualizador de status (tipo Stories do Instagram, mas com 24h fixas
   de duração — sem opção de deixar "permanente"). window.VBStatus.abrir
   busca os status ainda válidos daquele estabelecimento e mostra em
   tela cheia, um de cada vez, avançando sozinho ou por toque. */
(function () {
  if (!window.db) return;

  var overlay = null;
  var itens = [];
  var indiceAtual = 0;
  var timerAvanco = null;
  var DURACAO_MS = 5000;

  function construirOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'vb-status-overlay oculto';
    overlay.innerHTML =
      '<div class="vb-status-barras" id="vbStatusBarras"></div>' +
      '<button type="button" class="vb-status-fechar" id="vbStatusFechar" aria-label="Fechar">×</button>' +
      '<div class="vb-status-corpo" id="vbStatusCorpo"></div>' +
      '<div class="vb-status-zona-esq" id="vbStatusZonaEsq" aria-label="Status anterior"></div>' +
      '<div class="vb-status-zona-dir" id="vbStatusZonaDir" aria-label="Próximo status"></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#vbStatusFechar').addEventListener('click', fechar);
    overlay.querySelector('#vbStatusZonaEsq').addEventListener('click', function () { irPara(indiceAtual - 1); });
    overlay.querySelector('#vbStatusZonaDir').addEventListener('click', function () { irPara(indiceAtual + 1); });
    return overlay;
  }

  function renderBarras() {
    var barrasEl = overlay.querySelector('#vbStatusBarras');
    barrasEl.innerHTML = itens.map(function (_, i) {
      return '<span class="vb-status-barra"><span class="vb-status-barra-fill' + (i < indiceAtual ? ' vb-status-cheia' : '') + '" data-barra="' + i + '"></span></span>';
    }).join('');
  }

  function renderAtual() {
    var item = itens[indiceAtual];
    if (!item) { fechar(); return; }
    var corpoEl = overlay.querySelector('#vbStatusCorpo');
    corpoEl.innerHTML =
      (item.foto_url ? '<div class="vb-status-foto" style="background-image:url(\'' + item.foto_url + '\')"></div>' : '') +
      (item.texto ? '<p class="vb-status-texto">' + escapeHtml(item.texto) + '</p>' : '');
    renderBarras();
    var fill = overlay.querySelector('[data-barra="' + indiceAtual + '"]');
    if (fill) {
      fill.style.transition = 'none';
      fill.style.width = '0%';
      // força o reflow antes de animar, senão o navegador junta as duas
      // mudanças de width numa só e a barra nunca "enche" visualmente.
      void fill.offsetWidth;
      fill.style.transition = 'width ' + DURACAO_MS + 'ms linear';
      fill.style.width = '100%';
    }
    clearTimeout(timerAvanco);
    timerAvanco = setTimeout(function () { irPara(indiceAtual + 1); }, DURACAO_MS);
  }

  function irPara(indice) {
    if (indice < 0) { indice = 0; }
    if (indice >= itens.length) { fechar(); return; }
    indiceAtual = indice;
    renderAtual();
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fechar() {
    clearTimeout(timerAvanco);
    if (overlay) overlay.classList.add('oculto');
    document.body.style.overflow = '';
  }

  function abrir(estabelecimentoId) {
    db.rpc('estabelecimento_status_publico', { p_estabelecimento_id: estabelecimentoId }).then(function (res) {
      itens = (res.data || []).filter(function (s) { return s.foto_url || s.texto; });
      if (!itens.length) return;
      construirOverlay();
      indiceAtual = 0;
      overlay.classList.remove('oculto');
      document.body.style.overflow = 'hidden';
      renderAtual();
    });
  }

  window.VBStatus = { abrir: abrir };
})();
