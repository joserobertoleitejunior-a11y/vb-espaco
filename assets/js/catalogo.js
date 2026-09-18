/* Home do VB Agenda = catálogo estilo iFood: busca por nome + filtro
   por segmento, cada card levando pro link público (/:slug/:cidade). */
(function () {
  if (!window.db) return;

  var listaEl = document.getElementById('listaCatalogo');
  var filtrosEl = document.getElementById('filtros');
  var buscaEl = document.getElementById('buscaInput');
  var segmentoAtual = '';
  var todos = [];

  var SEGMENTOS = {
    barbearia: 'Barbearia',
    salao: 'Salão de beleza',
    manicure_pedicure: 'Manicure e pedicure',
    estetica: 'Estética',
    outro: 'Estabelecimento'
  };
  var ICONES = {
    barbearia: '💈',
    salao: '💇',
    manicure_pedicure: '💅',
    estetica: '✨',
    outro: '🏪'
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

  var CTA_CADASTRO =
    '<div class="catalogo-cta">' +
    '<span class="catalogo-cta-emoji">🚀</span>' +
    '<p class="catalogo-cta-titulo">Mais estabelecimentos chegando em breve</p>' +
    '<p class="catalogo-cta-texto">Tem um salão, barbearia ou estúdio? Seja um dos primeiros no VB Agenda.</p>' +
    '<a class="btn btn-primario" href="cadastro.html">Quero cadastrar o meu →</a>' +
    '</div>';

  function renderizar() {
    var termo = (buscaEl.value || '').trim().toLowerCase();
    var linhas = todos.filter(function (e) {
      return !termo || e.nome.toLowerCase().indexOf(termo) > -1;
    });

    if (!linhas.length) {
      listaEl.innerHTML = '<p style="color:var(--tinta-suave); text-align:center; padding:2rem 0;">Nenhum estabelecimento encontrado.</p>' + CTA_CADASTRO;
      return;
    }

    listaEl.innerHTML = linhas.map(function (e) {
      var link = '/' + encodeURIComponent(e.slug) + '/' + encodeURIComponent(e.cidade);
      var cor = e.cor_destaque || '#C9A227';
      var icone = ICONES[e.segmento] || '🏪';
      return '<a class="catalogo-card" href="' + link + '">' +
        '<div class="catalogo-capa" style="background:linear-gradient(135deg,' + cor + ',' + cor + 'cc);">' +
        '<span class="catalogo-capa-icone" aria-hidden="true">' + icone + '</span>' +
        '<span class="catalogo-avatar" style="background:' + cor + ';">' + escapeHtml(iniciais(e.nome)) + '</span>' +
        '</div>' +
        '<div class="catalogo-corpo">' +
        '<span class="catalogo-info">' +
        '<span class="catalogo-nome">' + escapeHtml(e.nome) + '</span>' +
        '<span class="catalogo-tags">' +
        '<span class="catalogo-tag">' + escapeHtml(SEGMENTOS[e.segmento] || 'Estabelecimento') + '</span>' +
        '<span class="catalogo-tag">📍 ' + escapeHtml(e.cidade) + '</span>' +
        '</span>' +
        '</span>' +
        '<span class="catalogo-seta" aria-hidden="true">→</span>' +
        '</div>' +
        '</a>';
    }).join('') + CTA_CADASTRO;
  }

  function carregar() {
    listaEl.innerHTML = '<div class="card"><div class="skeleton" style="height:1.4rem; width:60%; margin-bottom:0.5rem;"></div><div class="skeleton" style="height:1rem; width:35%;"></div></div>';

    db.rpc('listar_estabelecimentos', { p_cidade: null, p_segmento: segmentoAtual || null }).then(function (res) {
      if (res.error) {
        listaEl.innerHTML = '<p class="msg msg-erro">Sem conexão agora — tenta de novo em instantes.</p>';
        return;
      }
      todos = res.data || [];
      renderizar();
    }, function () {
      listaEl.innerHTML = '<p class="msg msg-erro">Sem conexão agora — tenta de novo em instantes.</p>';
    });
  }

  filtrosEl.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      filtrosEl.querySelectorAll('.chip').forEach(function (c) {
        c.classList.remove('is-ativo');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('is-ativo');
      chip.setAttribute('aria-pressed', 'true');
      segmentoAtual = chip.getAttribute('data-segmento') || '';
      carregar();
    });
  });

  buscaEl.addEventListener('input', renderizar);

  carregar();
})();
