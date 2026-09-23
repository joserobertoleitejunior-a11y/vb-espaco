/* "Outdoor de promoções" — vitrine de promoções ativas de QUALQUER
   estabelecimento do VB Agenda, não só o do próprio dono. Fica no topo
   do catálogo, feito billboard: rola na horizontal, some sozinha se
   não tiver nenhuma promoção ativa (nunca mostra uma seção vazia). */
(function () {
  if (!window.db) return;

  var secaoEl = document.getElementById('outdoorPromo');
  var trilhoEl = document.getElementById('outdoorPromoTrilho');
  if (!secaoEl || !trilhoEl) return;

  var CHAVE_CACHE = 'outdoor_promocoes';

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hexParaRgba(hex, alpha) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.substr(0, 2), 16) || 15;
    var g = parseInt(h.substr(2, 2), 16) || 107;
    var b = parseInt(h.substr(4, 2), 16) || 92;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function renderizar(lista) {
    if (!lista || !lista.length) {
      secaoEl.classList.add('oculto');
      return;
    }
    trilhoEl.innerHTML = lista.map(function (p) {
      var cor = p.estabelecimento_cor || '#0F6B5C';
      var link = '/' + encodeURIComponent(p.estabelecimento_slug) + '/' + encodeURIComponent(p.estabelecimento_cidade);
      var fundo = p.foto_url
        ? "background-image:linear-gradient(180deg, rgba(0,0,0,.05) 40%, rgba(0,0,0,.75) 100%), url('" + p.foto_url + "'); background-size:cover; background-position:center;"
        : 'background:linear-gradient(150deg,' + cor + ',' + hexParaRgba(cor, 0.75) + ');';
      return '<a class="outdoor-promo-card" href="' + link + '" style="' + fundo + '">' +
        '<span class="outdoor-promo-selo">Promoção</span>' +
        '<span class="outdoor-promo-card-texto">' +
        '<span class="outdoor-promo-card-titulo">' + escapeHtml(p.titulo) + '</span>' +
        '<span class="outdoor-promo-card-estab">' + escapeHtml(p.estabelecimento_nome) + ' · ' + escapeHtml(p.estabelecimento_cidade) + '</span>' +
        '</span>' +
        '</a>';
    }).join('');
    secaoEl.classList.remove('oculto');
  }

  db.rpc('promocoes_vitrine_publica', { p_limite: 12 }).then(function (res) {
    if (res.error) { renderizarDeCacheOuEsconder(); return; }
    var lista = res.data || [];
    if (window.VBCache) window.VBCache.salvar(CHAVE_CACHE, lista);
    renderizar(lista);
  }, renderizarDeCacheOuEsconder);

  function renderizarDeCacheOuEsconder() {
    var cache = window.VBCache ? window.VBCache.carregar(CHAVE_CACHE) : null;
    renderizar(cache && cache.dados);
  }
})();
