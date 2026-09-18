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
  var SVG_TESOURA = '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8.1" y1="7.5" x2="20" y2="19"/><line x1="8.1" y1="16.5" x2="20" y2="5"/></svg>';
  var SVG_CABELO = '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 18c2-4 2-8 0-12"/><path d="M9 18c2-4 2-8 0-12"/><path d="M14 18c2-4 2-8 0-12"/><path d="M19 18c2-4 2-8 0-12"/></svg>';
  var SVG_ESMALTE = '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v3l1.5 2v13a1 1 0 01-1 1h-7a1 1 0 01-1-1V7L9 5V2z"/><path d="M9 2h6"/></svg>';
  var SVG_SPARKLE = '<svg viewBox="0 0 24 24" width="42" height="42" fill="currentColor"><path d="M12 2L14.3 7.7L20 10L14.3 12.3L12 18L9.7 12.3L4 10L9.7 7.7z"/></svg>';
  var SVG_LOJA = '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M3 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0"/><path d="M5 9v10h14V9"/><path d="M9 19v-6h6v6"/></svg>';
  var SVG_PIN = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>';
  var SVG_FOGUETE = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c2.5 2 4 5.5 4 9 0 2-.5 3.5-1 4.5l-3 3-3-3c-.5-1-1-2.5-1-4.5 0-3.5 1.5-7 4-9z"/><circle cx="12" cy="9" r="1.6"/><path d="M8.5 15.5L6 18M15.5 15.5L18 18M9 21l1-2M15 21l-1-2"/></svg>';

  var ICONES = {
    barbearia: SVG_TESOURA,
    salao: SVG_CABELO,
    manicure_pedicure: SVG_ESMALTE,
    estetica: SVG_SPARKLE,
    outro: SVG_LOJA
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

  function hexParaRgba(hex, alpha) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.substr(0, 2), 16) || 0;
    var g = parseInt(h.substr(2, 2), 16) || 0;
    var b = parseInt(h.substr(4, 2), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  var CTA_CADASTRO =
    '<div class="catalogo-cta">' +
    '<span class="catalogo-cta-emoji" aria-hidden="true">' + SVG_FOGUETE + '</span>' +
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
      var icone = ICONES[e.segmento] || SVG_LOJA;
      var sombra = '0 1px 2px rgba(20,20,30,.05), 0 16px 26px -14px ' + hexParaRgba(cor, 0.45);
      return '<a class="catalogo-card" href="' + link + '" style="box-shadow:' + sombra + ';">' +
        '<div class="catalogo-capa" style="background:linear-gradient(135deg,' + cor + ',' + cor + 'cc);">' +
        '<span class="catalogo-capa-icone" aria-hidden="true">' + icone + '</span>' +
        '<span class="catalogo-avatar" style="background:' + cor + ';">' + escapeHtml(iniciais(e.nome)) + '</span>' +
        '</div>' +
        '<div class="catalogo-corpo">' +
        '<span class="catalogo-info">' +
        '<span class="catalogo-nome">' + escapeHtml(e.nome) + '</span>' +
        '<span class="catalogo-tags">' +
        '<span class="catalogo-tag">' + escapeHtml(SEGMENTOS[e.segmento] || 'Estabelecimento') + '</span>' +
        '<span class="catalogo-tag">' + SVG_PIN + ' ' + escapeHtml(e.cidade) + '</span>' +
        '</span>' +
        '</span>' +
        '<span class="catalogo-seta" aria-hidden="true">→</span>' +
        '</div>' +
        '</a>' +
        '<a class="catalogo-criar-assim" href="cadastro.html?template=' + encodeURIComponent(e.template || 'classico-boiserie') + '">+ Criar uma loja assim →</a>';
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
