/* Home do VB Agenda = catálogo estilo iFood: busca por nome + filtro
   por segmento, cada card levando pro link público (/:slug/:cidade). */
(function () {
  if (!window.db) return;

  var listaEl = document.getElementById('listaCatalogo');
  var filtrosEl = document.getElementById('filtros');
  var buscaEl = document.getElementById('buscaInput');
  var segmentoAtual = '';
  var todos = [];
  var estadoOffline = null; // null | 'com-cache' | 'sem-cache'
  var pertoBtn = document.getElementById('buscaPertoBtn');
  var pertoTexto = document.getElementById('buscaPertoTexto');
  var localizacaoAtual = null; // { lat, lng } quando "Perto de mim" está ativo

  var ICONE_OFFLINE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.58 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';
  var ICONE_OFFLINE_GRANDE = '<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.58 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';

  function chaveCache() { return 'catalogo_' + (localizacaoAtual ? 'perto' : (segmentoAtual || 'todos')); }
  function avisoOfflineHtml() {
    return estadoOffline === 'com-cache'
      ? '<div class="vb-offline-aviso">' + ICONE_OFFLINE + '<span>Sem conexão agora — mostrando o catálogo salvo, pode estar um pouco desatualizado.</span></div>'
      : '';
  }

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
  var SVG_FOGO = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="#ff6a1a" d="M12.5 1.5c1.2 3.4-3.2 4.6-3.2 8.2a3.2 3.2 0 006.4 0c0-1-0.6-1.8-0.9-2.6 2.4 1.4 4.2 4 4.2 6.9a6.5 6.5 0 01-13 0c0-5.6 4.4-7.3 6.5-12.5z"/><path fill="#ffcf40" d="M12.3 10.2c0.7 1.4-1.5 2-1.5 3.7a1.7 1.7 0 003.4 0c0-0.5-0.3-0.9-0.5-1.3 1 0.7 1.6 1.8 1.6 2.9a3 3 0 01-6 0c0-2.6 1.9-3.8 3-5.3z"/></svg>';
  var SVG_ESTRELA_CTA = '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M12 2L14.3 7.7L20 10L14.3 12.3L12 18L9.7 12.3L4 10L9.7 7.7z"/></svg>';

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
    { campo: 'instagram_url', svg: SVG_INSTAGRAM, rotulo: 'Instagram', href: function (e) { return e.instagram_url; } },
    { campo: 'facebook_url', svg: SVG_FACEBOOK, rotulo: 'Facebook', href: function (e) { return e.facebook_url; } },
    { campo: 'tiktok_url', svg: SVG_TIKTOK, rotulo: 'TikTok', href: function (e) { return e.tiktok_url; } },
    { campo: 'telefone_whatsapp', svg: SVG_WHATSAPP, rotulo: 'WhatsApp', href: function (e) { return 'https://wa.me/55' + soNumeros(e.telefone_whatsapp); } }
  ];

  function soNumeros(str) { return String(str || '').replace(/\D/g, ''); }

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
    '<span class="catalogo-cta-emoji" aria-hidden="true">' + SVG_ESTRELA_CTA + '</span>' +
    '<p class="catalogo-cta-titulo">Mais estabelecimentos chegando em breve</p>' +
    '<p class="catalogo-cta-texto">Tem um salão, barbearia ou estúdio? Seja um dos primeiros no VB Agenda.</p>' +
    '<a class="btn btn-primario" href="criar.html">Quero cadastrar o meu →</a>' +
    '</div>';

  function renderizar() {
    if (estadoOffline === 'sem-cache') {
      listaEl.innerHTML = '<div class="vb-offline-vazio">' + ICONE_OFFLINE_GRANDE +
        '<p class="vb-offline-vazio-titulo">Sem conexão</p>' +
        '<p class="vb-offline-vazio-texto">Ainda não tem nada salvo desse catálogo neste aparelho. Assim que a internet voltar, ele carrega sozinho.</p></div>';
      return;
    }

    var termo = (buscaEl.value || '').trim().toLowerCase();
    var linhas = todos.filter(function (e) {
      return !termo || e.nome.toLowerCase().indexOf(termo) > -1;
    });

    if (!linhas.length) {
      listaEl.innerHTML = avisoOfflineHtml() + '<p style="color:var(--tinta-suave); text-align:center; padding:2rem 0;">Nenhum estabelecimento encontrado.</p>' + CTA_CADASTRO;
      return;
    }

    listaEl.innerHTML = avisoOfflineHtml() + linhas.map(function (e) {
      var link = '/' + encodeURIComponent(e.slug) + '/' + encodeURIComponent(e.cidade);
      var cor = e.cor_destaque || '#C9A227';
      var icone = ICONES[e.segmento] || SVG_LOJA;
      var sombra = '0 1px 2px rgba(20,20,30,.05), 0 16px 26px -14px ' + hexParaRgba(cor, 0.45);
      var fotoTopo = e.foto_capa_url || e.foto_hero_url;
      var capaStyle = fotoTopo
        ? "background-image:linear-gradient(0deg, rgba(0,0,0,.28), rgba(0,0,0,.1)), url('" + fotoTopo + "'); background-size:cover; background-position:center;"
        : 'background:linear-gradient(135deg,' + cor + ',' + cor + 'cc);';
      var fotoAvatar = e.foto_perfil_url || e.foto_hero_url;
      var avatarConteudo = fotoAvatar
        ? '<span class="catalogo-avatar-foto" style="background-image:url(\'' + fotoAvatar + '\');"></span>'
        : escapeHtml(iniciais(e.nome));
      // avatar tem status ativo (postado nas últimas 24h)? entra a moldura
      // de destaque nas cores do próprio site, tipo o anel de story do
      // Instagram — e o avatar vira clicável pra abrir o status.
      var moldura = e.tem_status_ativo ? 'aura' : (e.moldura_foto || 'simples');
      var avatarAcao = e.tem_status_ativo ? 'status' : (fotoAvatar ? 'foto' : null);
      var selosSociais = SOCIAL_ICONES.filter(function (s) { return s.href(e); }).map(function (s) {
        return '<a class="catalogo-selo-social" href="' + escapeHtml(s.href(e)) + '" target="_blank" rel="noopener" aria-label="' + s.rotulo + '" data-social-link>' + s.svg + '</a>';
      }).join('');
      var enderecoTexto = e.endereco || e.cidade;
      var mapaHref = (e.endereco_lat != null && e.endereco_lng != null)
        ? 'https://www.google.com/maps/search/?api=1&query=' + e.endereco_lat + ',' + e.endereco_lng
        : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([e.nome, e.endereco, e.cidade].filter(Boolean).join(' '));
      var tagMapa = '<a class="catalogo-tag catalogo-tag-mapa" href="' + mapaHref + '" target="_blank" rel="noopener" aria-label="Abrir endereço no mapa" data-mapa-link style="background:' + hexParaRgba(cor, 0.15) + '; color:' + cor + ';">' + SVG_PIN + ' ' + escapeHtml(enderecoTexto) + '</a>';
      var avisoPromo = e.tem_promocao_ativa
        ? '<button type="button" class="catalogo-promo-aviso" data-abrir-promocoes="' + e.id + '" aria-label="Ver promoções de ' + escapeHtml(e.nome) + '">' +
          '<span class="catalogo-promo-fogo" aria-hidden="true">' + SVG_FOGO + '</span>' +
          'Essa loja contém promoções, <u>clique para saber mais</u>' +
          '</button>'
        : '';
      return '<div class="catalogo-item">' +
        '<div class="catalogo-card" role="link" tabindex="0" data-href="' + link + '" style="box-shadow:' + sombra + ';">' +
        '<div class="catalogo-capa" style="' + capaStyle + '">' +
        '<span class="catalogo-capa-icone" aria-hidden="true">' + (fotoTopo ? '' : icone) + '</span>' +
        '</div>' +
        '<div class="catalogo-corpo">' +
        (avatarAcao === 'status'
          ? '<button type="button" class="catalogo-avatar-anel moldura-' + moldura + '" style="--avatar-cor:' + cor + ';" data-abrir-status="' + e.id + '" aria-label="Ver status de ' + escapeHtml(e.nome) + '">'
          : avatarAcao === 'foto'
            ? '<button type="button" class="catalogo-avatar-anel moldura-' + moldura + '" style="--avatar-cor:' + cor + ';" data-zoom-foto="' + escapeHtml(fotoAvatar) + '" aria-label="Ver foto de ' + escapeHtml(e.nome) + '">'
            : '<span class="catalogo-avatar-anel moldura-' + moldura + '" style="--avatar-cor:' + cor + ';">') +
        '<span class="catalogo-avatar" style="background:' + cor + ';">' + avatarConteudo + '</span>' +
        (avatarAcao ? '</button>' : '</span>') +
        '<span class="catalogo-info">' +
        '<span class="catalogo-nome">' + escapeHtml(e.nome) + '</span>' +
        '<span class="catalogo-tags">' +
        '<span class="catalogo-tag">' + escapeHtml(SEGMENTOS[e.segmento] || 'Estabelecimento') + '</span>' +
        tagMapa +
        (e.distancia_km != null ? '<span class="catalogo-tag catalogo-tag-distancia">' + SVG_PIN + ' ' + String(e.distancia_km).replace('.', ',') + ' km</span>' : '') +
        '</span>' +
        (selosSociais ? '<span class="catalogo-tags catalogo-tags-social">' + selosSociais + '</span>' : '') +
        avisoPromo +
        '</span>' +
        '<span class="catalogo-seta" aria-hidden="true">→</span>' +
        '</div>' +
        '</div>' +
        '<a class="catalogo-criar-assim" href="criar.html?template=' + encodeURIComponent(e.template || 'classico-boiserie') + '">+ Criar uma loja assim →</a>' +
        '</div>';
    }).join('') + CTA_CADASTRO;
  }

  // o card inteiro age como link (acessível por teclado também), mas os
  // ícones sociais e o avatar com status são cliques à parte — sem isso,
  // eles ficariam presos dentro de um <a> gigante (inválido em HTML e
  // pouco confiável) ou nunca seriam clicáveis de verdade.
  listaEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-social-link], [data-mapa-link]')) return;
    var abrirStatus = e.target.closest('[data-abrir-status]');
    if (abrirStatus) {
      if (window.VBStatus) window.VBStatus.abrir(abrirStatus.getAttribute('data-abrir-status'));
      return;
    }
    var zoomFoto = e.target.closest('[data-zoom-foto]');
    if (zoomFoto) {
      if (window.VBFotoZoom) window.VBFotoZoom.abrir(zoomFoto.getAttribute('data-zoom-foto'));
      return;
    }
    var abrirPromo = e.target.closest('[data-abrir-promocoes]');
    if (abrirPromo) {
      abrirPromoPopover(abrirPromo, abrirPromo.getAttribute('data-abrir-promocoes'));
      return;
    }
    var card = e.target.closest('.catalogo-card');
    if (card && card.getAttribute('data-href')) window.location.href = card.getAttribute('data-href');
  });
  listaEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('[data-social-link], [data-abrir-status], [data-mapa-link], [data-zoom-foto], [data-abrir-promocoes]')) return;
    var card = e.target.closest('.catalogo-card');
    if (!card) return;
    e.preventDefault();
    window.location.href = card.getAttribute('data-href');
  });

  // ---- balãozinho de promoções: um popover pequeno, ancorado no botão
  // que foi clicado, mostrando os banners de promoção ativa daquele
  // estabelecimento (busca sob demanda, só quando abre). ----
  var promoPopover = null;
  function construirPromoPopover() {
    if (promoPopover) return promoPopover;
    promoPopover = document.createElement('div');
    promoPopover.className = 'catalogo-promo-popover oculto';
    promoPopover.innerHTML =
      '<span class="catalogo-promo-popover-seta"></span>' +
      '<button type="button" class="catalogo-promo-popover-fechar" aria-label="Fechar">×</button>' +
      '<div class="catalogo-promo-popover-corpo" id="catalogoPromoPopoverCorpo"></div>';
    document.body.appendChild(promoPopover);
    promoPopover.querySelector('.catalogo-promo-popover-fechar').addEventListener('click', fecharPromoPopover);
    document.addEventListener('click', function (e) {
      if (!promoPopover || promoPopover.classList.contains('oculto')) return;
      if (promoPopover.contains(e.target) || e.target.closest('[data-abrir-promocoes]')) return;
      fecharPromoPopover();
    });
    window.addEventListener('resize', fecharPromoPopover);
    return promoPopover;
  }
  function fecharPromoPopover() { if (promoPopover) promoPopover.classList.add('oculto'); }
  function posicionarPromoPopover(botao) {
    var rect = botao.getBoundingClientRect();
    var largura = Math.min(300, document.documentElement.clientWidth - 24);
    var esquerda = window.scrollX + rect.left;
    var maxEsquerda = window.scrollX + document.documentElement.clientWidth - largura - 12;
    if (esquerda > maxEsquerda) esquerda = Math.max(window.scrollX + 12, maxEsquerda);
    promoPopover.style.width = largura + 'px';
    promoPopover.style.top = (window.scrollY + rect.bottom + 10) + 'px';
    promoPopover.style.left = esquerda + 'px';
    promoPopover.querySelector('.catalogo-promo-popover-seta').style.left = Math.max(12, (window.scrollX + rect.left + rect.width / 2) - esquerda - 7) + 'px';
  }
  function abrirPromoPopover(botao, estabId) {
    construirPromoPopover();
    var estab = todos.filter(function (t) { return t.id === estabId; })[0];
    var link = estab ? '/' + encodeURIComponent(estab.slug) + '/' + encodeURIComponent(estab.cidade) : '#';
    var corpoEl = promoPopover.querySelector('#catalogoPromoPopoverCorpo');
    corpoEl.innerHTML = '<div class="skeleton" style="height:1rem; width:70%; margin-bottom:0.5rem;"></div><div class="skeleton" style="height:3.2rem;"></div>';
    posicionarPromoPopover(botao);
    promoPopover.classList.remove('oculto');
    db.rpc('estabelecimento_promocoes_publicas', { p_estabelecimento_id: estabId }).then(function (res) {
      var lista = res.data || [];
      if (!lista.length) { corpoEl.innerHTML = '<p class="catalogo-promo-popover-vazio">Sem promoções ativas no momento.</p>'; return; }
      corpoEl.innerHTML = lista.map(function (p) {
        return '<a class="catalogo-promo-banner" href="' + link + '#promocoesSecao">' +
          (p.foto_url ? '<span class="catalogo-promo-banner-foto" style="background-image:url(\'' + p.foto_url + '\')"></span>' : '') +
          '<span class="catalogo-promo-banner-texto"><strong>' + escapeHtml(p.titulo) + '</strong>' + (p.texto ? '<br>' + escapeHtml(p.texto) : '') + '</span>' +
          '</a>';
      }).join('');
    }, function () { corpoEl.innerHTML = '<p class="catalogo-promo-popover-vazio">Sem conexão agora.</p>'; });
  }

  function usarCacheOuOffline() {
    var cache = window.VBCache ? window.VBCache.carregar(chaveCache()) : null;
    if (cache && cache.dados && cache.dados.length) {
      todos = cache.dados;
      estadoOffline = 'com-cache';
    } else {
      todos = [];
      estadoOffline = 'sem-cache';
    }
    renderizar();
  }

  function carregar() {
    listaEl.innerHTML = '<div class="card"><div class="skeleton" style="height:1.4rem; width:60%; margin-bottom:0.5rem;"></div><div class="skeleton" style="height:1rem; width:35%;"></div></div>';

    var chamada = localizacaoAtual
      ? db.rpc('listar_estabelecimentos_por_raio', { p_lat: localizacaoAtual.lat, p_lng: localizacaoAtual.lng, p_raio_km: 15, p_segmento: segmentoAtual || null })
      : db.rpc('listar_estabelecimentos', { p_cidade: null, p_segmento: segmentoAtual || null });

    chamada.then(function (res) {
      if (res.error) {
        listaEl.innerHTML = '<p class="msg msg-erro">' + escapeHtml(res.error.message || 'Não deu pra carregar agora.') + '</p>';
        return;
      }
      todos = res.data || [];
      estadoOffline = null;
      if (window.VBCache) window.VBCache.salvar(chaveCache(), todos);
      renderizar();
    }, function () {
      usarCacheOuOffline();
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

  if (pertoBtn) pertoBtn.addEventListener('click', function () {
    if (localizacaoAtual) {
      localizacaoAtual = null;
      pertoBtn.classList.remove('is-ativo');
      pertoTexto.textContent = 'Perto de mim';
      carregar();
      return;
    }
    if (!navigator.geolocation) {
      window.VBDialogo ? window.VBDialogo.alert('Seu navegador não permite localização.') : alert('Seu navegador não permite localização.');
      return;
    }
    pertoBtn.disabled = true;
    pertoTexto.textContent = 'Localizando…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      localizacaoAtual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      pertoBtn.disabled = false;
      pertoBtn.classList.add('is-ativo');
      pertoTexto.textContent = 'Perto de mim';
      carregar();
    }, function () {
      pertoBtn.disabled = false;
      pertoTexto.textContent = 'Perto de mim';
      var msg = 'Não consegui acessar sua localização — verifica se o navegador tem permissão.';
      if (window.VBDialogo) window.VBDialogo.alert(msg); else alert(msg);
    }, { timeout: 10000 });
  });

  carregar();
})();
