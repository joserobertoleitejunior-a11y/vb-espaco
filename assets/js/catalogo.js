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
    estetica_automotiva: 'Estética automotiva',
    outro: 'Estabelecimento'
  };
  var SVG_TESOURA = '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8.1" y1="7.5" x2="20" y2="19"/><line x1="8.1" y1="16.5" x2="20" y2="5"/></svg>';
  var SVG_CABELO = '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 18c2-4 2-8 0-12"/><path d="M9 18c2-4 2-8 0-12"/><path d="M14 18c2-4 2-8 0-12"/><path d="M19 18c2-4 2-8 0-12"/></svg>';
  var SVG_ESMALTE = '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v3l1.5 2v13a1 1 0 01-1 1h-7a1 1 0 01-1-1V7L9 5V2z"/><path d="M9 2h6"/></svg>';
  var SVG_SPARKLE = '<svg viewBox="0 0 24 24" width="42" height="42" fill="currentColor"><path d="M12 2L14.3 7.7L20 10L14.3 12.3L12 18L9.7 12.3L4 10L9.7 7.7z"/></svg>';
  var SVG_LOJA = '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M3 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0"/><path d="M5 9v10h14V9"/><path d="M9 19v-6h6v6"/></svg>';
  var SVG_CARRO = '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l1.5-4.5A2 2 0 0 1 6.4 6h11.2a2 2 0 0 1 1.9 1.5L21 12"/><path d="M3 12h18v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4z"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></svg>';
  var SVG_PIN = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>';
  var SVG_FOGUETE = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c2.5 2 4 5.5 4 9 0 2-.5 3.5-1 4.5l-3 3-3-3c-.5-1-1-2.5-1-4.5 0-3.5 1.5-7 4-9z"/><circle cx="12" cy="9" r="1.6"/><path d="M8.5 15.5L6 18M15.5 15.5L18 18M9 21l1-2M15 21l-1-2"/></svg>';

  var ICONES = {
    barbearia: SVG_TESOURA,
    salao: SVG_CABELO,
    manicure_pedicure: SVG_ESMALTE,
    estetica: SVG_SPARKLE,
    estetica_automotiva: SVG_CARRO,
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

  var SVG_WHATSAPP = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.36a9.9 9.9 0 004.62 1.14h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.12c-.24.68-1.4 1.3-1.93 1.35-.5.05-1.03.24-3.46-.73-2.93-1.17-4.8-4.16-4.94-4.35-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36l.55.01c.18 0 .42-.07.65.5.24.58.83 2 .9 2.14.07.15.12.32.02.51-.1.19-.14.31-.28.47-.14.17-.3.37-.42.5-.14.15-.29.31-.13.6.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.45.29.14.46.12.62-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.64-.14.26.1 1.66.78 1.94.93.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/></svg>';
  var SVG_INSTAGRAM = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>';
  var SVG_FACEBOOK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M13.5 21v-7.6h2.55l.38-2.96h-2.93V8.56c0-.86.24-1.44 1.47-1.44h1.57V4.48c-.27-.04-1.2-.12-2.28-.12-2.26 0-3.8 1.38-3.8 3.9v2.18H8v2.96h2.46V21h3.04z"/></svg>';
  var SVG_TIKTOK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M16.6 5.82c-.9-.98-1.4-2.26-1.4-3.58h-3.03v13.4c0 1.5-1.22 2.72-2.72 2.72a2.72 2.72 0 01-2.72-2.72 2.72 2.72 0 012.72-2.72c.28 0 .55.04.8.12v-3.08a5.8 5.8 0 00-.8-.06A5.76 5.76 0 003 15.36 5.76 5.76 0 008.76 21.1a5.76 5.76 0 005.76-5.76V8.9a7.15 7.15 0 004.16 1.34V7.2a4.3 4.3 0 01-2.08-1.38z"/></svg>';

  var SOCIAL_ICONES = [
    { campo: 'instagram_url', svg: SVG_INSTAGRAM },
    { campo: 'facebook_url', svg: SVG_FACEBOOK },
    { campo: 'tiktok_url', svg: SVG_TIKTOK }
  ];

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
      var capaStyle = e.foto_capa_url
        ? "background-image:linear-gradient(0deg, rgba(0,0,0,.28), rgba(0,0,0,.1)), url('" + e.foto_capa_url + "'); background-size:cover; background-position:center;"
        : 'background:linear-gradient(135deg,' + cor + ',' + cor + 'cc);';
      var avatarConteudo = e.foto_perfil_url
        ? '<span class="catalogo-avatar-foto" style="background-image:url(\'' + e.foto_perfil_url + '\');"></span>'
        : escapeHtml(iniciais(e.nome));
      var selosSociais = SOCIAL_ICONES.filter(function (s) { return e[s.campo]; }).map(function (s) {
        return '<span class="catalogo-selo-social" aria-hidden="true">' + s.svg + '</span>';
      }).join('');
      if (e.telefone_whatsapp) selosSociais += '<span class="catalogo-selo-social" aria-hidden="true">' + SVG_WHATSAPP + '</span>';
      return '<a class="catalogo-card" href="' + link + '" style="box-shadow:' + sombra + ';">' +
        '<div class="catalogo-capa" style="' + capaStyle + '">' +
        '<span class="catalogo-capa-icone" aria-hidden="true">' + (e.foto_capa_url ? '' : icone) + '</span>' +
        '<span class="catalogo-avatar" style="background:' + cor + ';">' + avatarConteudo + '</span>' +
        '</div>' +
        '<div class="catalogo-corpo">' +
        '<span class="catalogo-info">' +
        '<span class="catalogo-nome">' + escapeHtml(e.nome) + '</span>' +
        '<span class="catalogo-tags">' +
        '<span class="catalogo-tag">' + escapeHtml(SEGMENTOS[e.segmento] || 'Estabelecimento') + '</span>' +
        '<span class="catalogo-tag">' + SVG_PIN + ' ' + escapeHtml(e.cidade) + '</span>' +
        (selosSociais ? '<span class="catalogo-tag catalogo-tag-social">' + selosSociais + '</span>' : '') +
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
