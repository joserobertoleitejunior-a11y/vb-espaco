/* Home do VB Espaço = catálogo estilo iFood: lista os estabelecimentos
   ativos, com filtro por segmento, cada card levando pro link público
   dele (/:slug/:cidade). */
(function () {
  if (!window.db) return;

  var listaEl = document.getElementById('listaCatalogo');
  var filtrosEl = document.getElementById('filtros');
  var segmentoAtual = '';

  var SEGMENTOS = {
    barbearia: 'Barbearia',
    salao: 'Salão de beleza',
    manicure_pedicure: 'Manicure e pedicure',
    estetica: 'Estética',
    outro: 'Estabelecimento'
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function iniciais(nome) {
    var partes = (nome || '').trim().split(/\s+/);
    return ((partes[0] || '')[0] || '').toUpperCase() + ((partes[1] || '')[0] || '').toUpperCase();
  }

  function carregar() {
    listaEl.innerHTML = '<div class="card"><div class="skeleton" style="height:1.4rem; width:60%; margin-bottom:0.5rem;"></div><div class="skeleton" style="height:1rem; width:35%;"></div></div>';

    db.rpc('listar_estabelecimentos', { p_cidade: null, p_segmento: segmentoAtual || null }).then(function (res) {
      if (res.error) {
        listaEl.innerHTML = '<p class="msg msg-erro">Sem conexão agora — tenta de novo em instantes.</p>';
        return;
      }
      var linhas = res.data || [];
      if (!linhas.length) {
        listaEl.innerHTML = '<p style="color:var(--tinta-suave); text-align:center; padding:2rem 0;">Nenhum estabelecimento por aqui ainda nesse filtro.</p>';
        return;
      }
      listaEl.innerHTML = linhas.map(function (e) {
        var link = '/' + encodeURIComponent(e.slug) + '/' + encodeURIComponent(e.cidade);
        return '<a class="catalogo-card" href="' + link + '">' +
          '<span class="catalogo-avatar" style="background:' + escapeHtml(e.cor_destaque || '#C9A227') + ';">' + escapeHtml(iniciais(e.nome)) + '</span>' +
          '<span class="catalogo-info">' +
          '<span class="catalogo-nome">' + escapeHtml(e.nome) + '</span>' +
          '<span class="catalogo-segmento">' + escapeHtml(SEGMENTOS[e.segmento] || 'Estabelecimento') + ' · ' + escapeHtml(e.cidade) + '</span>' +
          '</span>' +
          '<span class="catalogo-seta" aria-hidden="true">→</span>' +
          '</a>';
      }).join('');
    }, function () {
      listaEl.innerHTML = '<p class="msg msg-erro">Sem conexão agora — tenta de novo em instantes.</p>';
    });
  }

  filtrosEl.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      filtrosEl.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-ativo'); });
      chip.classList.add('is-ativo');
      segmentoAtual = chip.getAttribute('data-segmento') || '';
      carregar();
    });
  });

  carregar();
})();
