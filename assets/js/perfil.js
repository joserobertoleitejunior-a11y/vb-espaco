/* Página pública /:slug/:cidade — template "classico-boiserie", cópia
   fiel do design do Rafael Cabeleireiros (mesmo CSS dele, ver
   assets/tpl-classico/), com dados de verdade (serviços, galeria,
   agenda) por estabelecimento. */
(function () {
  if (!window.db) return;

  var partes = window.location.pathname.split('/').filter(Boolean);
  var slug = partes[0];
  var cidade = partes[1];

  var carregando = document.getElementById('carregando');
  var naoEncontrado = document.getElementById('naoEncontrado');
  var tpl = document.getElementById('tplClassico');
  var estabId = null;
  var generoAtual = null;
  var linhaAtual = null;

  // ---------- template visual: cada estabelecimento escolhe uma pasta
  // de CSS (mesma estrutura de HTML/classes, só trocam tokens/fonte) ----------
  var TEMPLATE_PASTAS = {
    'classico-boiserie': 'tpl-classico',
    'claro-minimal': 'tpl-claro',
    'escuro-premium': 'tpl-escuro',
    'automotivo-carbono': 'tpl-automotivo'
  };
  function aplicarTemplateCss(templateKey) {
    var pasta = TEMPLATE_PASTAS[templateKey] || 'tpl-classico';
    document.getElementById('tplBase').href = '/assets/' + pasta + '/css/base.css?v=2';
    document.getElementById('tplFeminino').href = '/assets/' + pasta + '/css/feminino.css?v=2';
    var widget = document.getElementById('tplWidget');
    if (widget) widget.href = '/assets/' + pasta + '/css/widget.css?v=2';
  }

  // ---- cor de destaque (sobrescreve --dourado/--dourado-escuro/--dourado-claro
  // do template, hoje só implementado de verdade no tpl-classico — nos outros
  // templates a variável ainda não é usada em nenhum seletor, então isso não
  // muda nada visualmente até serem migrados também). ----
  function hexParaRgbNums(hex) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16) || 0, parseInt(h.substr(2, 2), 16) || 0, parseInt(h.substr(4, 2), 16) || 0];
  }
  function misturarRgb(rgb, alvo, quantidade) {
    return rgb.map(function (c, i) { return Math.round(c + (alvo[i] - c) * quantidade); });
  }
  function rgbParaHex(rgb) {
    return '#' + rgb.map(function (c) {
      return Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
    }).join('');
  }
  function aplicarCorDinamica(cor) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(cor || '')) return;
    var rgb = hexParaRgbNums(cor);
    var escuro = rgbParaHex(misturarRgb(rgb, [0, 0, 0], 0.28));
    var claro = rgbParaHex(misturarRgb(rgb, [255, 255, 255], 0.42));
    var estilo = document.getElementById('tplCorDinamica');
    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = 'tplCorDinamica';
      document.head.appendChild(estilo);
    }
    estilo.textContent = ':root{--dourado:' + cor + '; --dourado-escuro:' + escuro + '; --dourado-claro:' + claro + '; --dourado-rgb:' + rgb.join(',') + ';}';
  }
  function salvarCor(cor) {
    linhaAtual.cor_destaque = cor;
    aplicarCorDinamica(cor);
    db.rpc('tenant_admin_atualizar_cor', { p_estabelecimento_id: estabId, p_cor_destaque: cor });
  }

  if (!slug || !cidade) {
    carregando.classList.add('oculto');
    naoEncontrado.classList.remove('oculto');
    return;
  }

  function mostrarNaoEncontrado() {
    carregando.classList.add('oculto');
    naoEncontrado.classList.remove('oculto');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function formatarPreco(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }

  var SEGMENTOS = {
    barbearia: 'Barbearia',
    salao: 'Salão de beleza',
    manicure_pedicure: 'Manicure e pedicure',
    estetica: 'Estética',
    estetica_automotiva: 'Estética automotiva',
    outro: 'Estabelecimento'
  };

  var COPY = {
    masculino: { headline: 'Seu estilo, sem complicação.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
    feminino: { headline: 'Sua beleza merece hora marcada.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' }
  };

  // ---------- horário de funcionamento (rodapé), agrupando dias
  // consecutivos com o mesmo horário — igual "Segunda a sábado: 8h às
  // 18h" do Rafael, só que calculado a partir do que o dono cadastrou ----------
  var DIAS_PLENO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  function formatarHora(h) {
    var hm = String(h || '').slice(0, 5).replace(/^0/, '');
    return hm.replace(/:00$/, '');
  }

  function formatarHorarios(linhas) {
    var porDia = {};
    (linhas || []).forEach(function (h) { porDia[h.dia_semana] = h; });
    var dias = [];
    for (var i = 0; i < 7; i++) {
      var h = porDia[i] || { abre: '08:00', fecha: '18:00', fechado: i === 0 };
      dias.push({ dia: i, abre: formatarHora(h.abre), fecha: formatarHora(h.fecha), fechado: h.fechado });
    }
    var grupos = [];
    dias.forEach(function (d) {
      var ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.abre === d.abre && ultimo.fecha === d.fecha && ultimo.fechado === d.fechado) {
        ultimo.fim = d.dia;
      } else {
        grupos.push({ inicio: d.dia, fim: d.dia, abre: d.abre, fecha: d.fecha, fechado: d.fechado });
      }
    });
    return grupos.filter(function (g) { return !g.fechado; }).map(function (g) {
      var label = g.inicio === g.fim ? DIAS_PLENO[g.inicio] : DIAS_PLENO[g.inicio] + ' a ' + DIAS_PLENO[g.fim];
      return label + ': ' + g.abre + 'h às ' + g.fecha + 'h';
    });
  }

  function carregarHorarioRodape() {
    var wrap = document.getElementById('tplHorarioRodape');
    if (!wrap) return;
    db.rpc('tenant_listar_horarios', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = formatarHorarios(res.data || []);
      wrap.innerHTML = linhas.length
        ? linhas.map(function (l) { return '<p>' + escapeHtml(l) + '</p>'; }).join('')
        : '<p>Consulte os horários pelo WhatsApp</p>';
    }, function () {
      wrap.innerHTML = '<p>Consulte os horários pelo WhatsApp</p>';
    });
  }

  // ---------- gênero: fixo (masculino/feminino) ou "ambos" (com gate) ----------
  var SESSION_KEY = 'vbGeneroSessao_' + slug + '_' + cidade;

  function boiseriePlaceholder(corHex) {
    var cor = (corHex || '#C9A227').replace('#', '');
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect x='9' y='9' width='54' height='54' rx='6' fill='none' stroke='%23" + cor + "' stroke-opacity='0.4' stroke-width='1.6'/%3E%3Crect x='18' y='18' width='36' height='36' rx='3' fill='none' stroke='%23" + cor + "' stroke-opacity='0.4' stroke-width='1.1'/%3E%3C/svg%3E";
  }

  // ---------- modo admin: PIN + edição inline direto no site ----------
  var modoAdmin = false;
  var ESTOQUE_FOTOS_ADMIN = [
    { url: '/assets/tpl-classico/img/estoque/hero-masculino-1.jpg', legenda: 'Studio dourado' },
    { url: '/assets/tpl-classico/img/estoque/hero-feminino-1.jpg', legenda: 'Salão rosé' },
    { url: '/assets/tpl-classico/img/estoque/fachada-1.jpg', legenda: 'Fachada clássica' }
  ];

  function chaveAdmin() { return 'vbAdminUnlocked_' + estabId; }

  function salvarNome() {
    var el = document.getElementById('tplNomeTopo');
    var nome = el.textContent.trim();
    if (!nome) {
      el.textContent = linhaAtual.nome;
      return;
    }
    linhaAtual.nome = nome;
    document.getElementById('tplNomeRodape').textContent = nome;
    db.rpc('tenant_admin_atualizar_nome', { p_estabelecimento_id: estabId, p_nome: nome });
  }

  function salvarCta() {
    var el = document.getElementById('tplCtaTexto');
    var texto = el.textContent.trim();
    if (!texto) {
      el.textContent = linhaAtual.texto_cta || 'Agendar horário';
      return;
    }
    linhaAtual.texto_cta = texto;
    db.rpc('tenant_admin_atualizar_cta', { p_estabelecimento_id: estabId, p_texto_cta: texto });
  }

  function salvarTextoHero() {
    var titulo = document.getElementById('tplHeadline').textContent.trim();
    var subtitulo = document.getElementById('tplSubcopy').textContent.trim();
    linhaAtual.titulo_hero = titulo;
    linhaAtual.subtitulo_hero = subtitulo;
    db.rpc('tenant_admin_atualizar_texto', {
      p_estabelecimento_id: estabId,
      p_titulo_hero: titulo,
      p_subtitulo_hero: subtitulo
    });
  }

  function abrirEditorHero() {
    var existente = document.getElementById('vbHeroEditor');
    if (existente) { existente.remove(); return; }
    var caixa = document.createElement('div');
    caixa.id = 'vbHeroEditor';
    caixa.style.cssText = 'position:absolute; z-index:20; bottom:1rem; left:1rem; right:1rem; background:#fff; border-radius:10px; padding:0.9rem; box-shadow:0 10px 30px rgba(0,0,0,.25);';
    caixa.innerHTML =
      '<p style="margin:0 0 0.5rem; font-size:0.85rem; font-weight:700;">Trocar foto principal</p>' +
      '<input type="file" id="vbHeroEditorUpload" accept="image/*" style="margin-bottom:0.6rem; width:100%;">' +
      '<div style="display:flex; gap:0.4rem;">' +
      ESTOQUE_FOTOS_ADMIN.map(function (f) {
        return '<img src="' + f.url + '" data-estoque-url="' + f.url + '" title="' + f.legenda + '" style="width:52px; height:52px; object-fit:cover; border-radius:6px; cursor:pointer;">';
      }).join('') +
      '</div>' +
      '<p class="msg" id="vbHeroEditorMsg" style="margin-top:0.5rem;"></p>';
    document.getElementById('tplHeroFoto').appendChild(caixa);

    function salvarFotoHero(url) {
      var msg = document.getElementById('vbHeroEditorMsg');
      msg.textContent = 'Salvando…';
      var chave = (generoAtual === 'feminino') ? 'p_foto_hero_feminino_url' : 'p_foto_hero_url';
      var payload = { p_estabelecimento_id: estabId, p_foto_hero_url: null, p_foto_hero_feminino_url: null };
      payload[chave] = url;
      db.rpc('tenant_admin_atualizar_hero', payload).then(function (res) {
        if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
        if (generoAtual === 'feminino') linhaAtual.foto_hero_feminino_url = url; else linhaAtual.foto_hero_url = url;
        caixa.remove();
        aplicarGenero(generoAtual);
      });
    }

    caixa.querySelectorAll('[data-estoque-url]').forEach(function (img) {
      img.addEventListener('click', function (e) {
        e.stopPropagation();
        salvarFotoHero(img.getAttribute('data-estoque-url'));
      });
    });
    document.getElementById('vbHeroEditorUpload').addEventListener('change', function (e) {
      e.stopPropagation();
      var file = e.target.files[0];
      if (!file || !window.VBUpload) return;
      document.getElementById('vbHeroEditorMsg').textContent = 'Enviando…';
      window.VBUpload.uploadFoto(file, estabId, 'hero').then(salvarFotoHero, function (err) {
        document.getElementById('vbHeroEditorMsg').className = 'msg msg-erro';
        document.getElementById('vbHeroEditorMsg').textContent = err.message || 'Falha ao enviar.';
      });
    });
  }

  function atualizarMapaLink() {
    var link = document.getElementById('tplMapaLink');
    if (!link) return;
    if (linhaAtual.endereco_lat != null && linhaAtual.endereco_lng != null) {
      link.href = 'https://www.google.com/maps/search/?api=1&query=' + linhaAtual.endereco_lat + ',' + linhaAtual.endereco_lng;
      return;
    }
    var consulta = [linhaAtual.nome, linhaAtual.endereco, linhaAtual.cidade].filter(Boolean).join(' ');
    link.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consulta);
  }

  // Reconhece o endereço digitado num par de coordenadas reais (OpenStreetMap
  // Nominatim, gratuito e sem chave) pra deixar o link do mapa preciso — se
  // não achar nada, o endereço em texto continua salvo normalmente.
  function geocodificarEndereco(endereco, cidade) {
    var consulta = [endereco, cidade, 'Brasil'].filter(Boolean).join(', ');
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(consulta);
    return fetch(url).then(function (res) { return res.json(); }).then(function (dados) {
      var achado = dados && dados[0];
      return achado ? { lat: parseFloat(achado.lat), lng: parseFloat(achado.lon) } : null;
    }, function () { return null; });
  }

  function salvarEndereco() {
    var endereco = document.getElementById('tplEnderecoRodape').textContent.trim();
    // salva o texto na hora — geocodificar é só um extra pra deixar o mapa
    // preciso, e não pode travar a ação principal se o serviço demorar/falhar.
    linhaAtual.endereco = endereco;
    linhaAtual.endereco_lat = null;
    linhaAtual.endereco_lng = null;
    atualizarMapaLink();
    db.rpc('tenant_admin_atualizar_endereco', { p_estabelecimento_id: estabId, p_endereco: endereco, p_lat: null, p_lng: null });
    if (!endereco) return;
    geocodificarEndereco(endereco, linhaAtual.cidade).then(function (coord) {
      if (!coord) return;
      linhaAtual.endereco_lat = coord.lat;
      linhaAtual.endereco_lng = coord.lng;
      atualizarMapaLink();
      db.rpc('tenant_admin_atualizar_endereco', {
        p_estabelecimento_id: estabId,
        p_endereco: endereco,
        p_lat: coord.lat,
        p_lng: coord.lng
      });
    });
  }

  // esconde o site de quem visita enquanto faltar serviço ou equipe
  // (ninguém deveria cair numa agenda vazia sem profissional/serviço pra
  // escolher) — o dono ainda enxerga tudo normal assim que entra no modo
  // admin, pra poder completar o cadastro.
  function atualizarGateIncompleto() {
    var gate = document.getElementById('incompletoGate');
    if (!gate || !linhaAtual) return;
    var incompleto = !linhaAtual.tem_servico || !linhaAtual.tem_equipe;
    if (incompleto && !modoAdmin) {
      document.getElementById('incompletoTitulo').textContent = linhaAtual.nome + ' está quase pronto';
      gate.classList.add('open');
      document.body.classList.add('scroll-locked');
    } else {
      gate.classList.remove('open');
      if (!document.getElementById('genderGate') || !document.getElementById('genderGate').classList.contains('open')) {
        document.body.classList.remove('scroll-locked');
      }
    }
  }

  function ativarModoAdmin() {
    if (modoAdmin) return;
    modoAdmin = true;
    document.body.classList.add('vb-modo-admin');
    document.getElementById('adminModoBarra').classList.remove('oculto');
    // o dono não deveria ficar travado atrás do gate de gênero (ainda sem
    // resposta) pra poder editar — resolve com o padrão e segue.
    var gate = document.getElementById('genderGate');
    if (gate && gate.classList.contains('open')) {
      gate.classList.remove('open');
      document.body.classList.remove('scroll-locked');
      aplicarGenero(generoAtual || 'masculino');
    }
    atualizarGateIncompleto();
    var titulo = document.getElementById('tplHeadline');
    var sub = document.getElementById('tplSubcopy');
    var endereco = document.getElementById('tplEnderecoRodape');
    var nomeTopo = document.getElementById('tplNomeTopo');
    var ctaTexto = document.getElementById('tplCtaTexto');
    titulo.setAttribute('contenteditable', 'true');
    sub.setAttribute('contenteditable', 'true');
    endereco.setAttribute('contenteditable', 'true');
    nomeTopo.setAttribute('contenteditable', 'true');
    ctaTexto.setAttribute('contenteditable', 'true');
    titulo.addEventListener('blur', salvarTextoHero);
    sub.addEventListener('blur', salvarTextoHero);
    endereco.addEventListener('blur', salvarEndereco);
    nomeTopo.addEventListener('blur', salvarNome);
    ctaTexto.addEventListener('blur', salvarCta);
    document.getElementById('tplHeroFoto').addEventListener('click', abrirEditorHero);
    carregarServicos();
    carregarGaleria();
    carregarRedesSociais();
  }

  function desativarModoAdmin() {
    modoAdmin = false;
    document.body.classList.remove('vb-modo-admin');
    document.getElementById('adminModoBarra').classList.add('oculto');
    document.getElementById('tplHeadline').removeAttribute('contenteditable');
    document.getElementById('tplSubcopy').removeAttribute('contenteditable');
    document.getElementById('tplEnderecoRodape').removeAttribute('contenteditable');
    document.getElementById('tplNomeTopo').removeAttribute('contenteditable');
    document.getElementById('tplCtaTexto').removeAttribute('contenteditable');
    try { localStorage.removeItem(chaveAdmin()); } catch (e) {}
    // reconfere se já tem serviço/equipe (pode ter completado agora) antes
    // de decidir se o portão "em preparação" volta a aparecer pra visita.
    db.rpc('buscar_estabelecimento', { p_slug: slug, p_cidade: cidade }).then(function (res) {
      var linha = res.data && res.data[0];
      if (linha) {
        linhaAtual.tem_servico = linha.tem_servico;
        linhaAtual.tem_equipe = linha.tem_equipe;
      }
      atualizarGateIncompleto();
    });
    carregarServicos();
    carregarGaleria();
    carregarRedesSociais();
  }

  function iniciarModoAdmin() {
    var overlay = document.getElementById('adminPinOverlay');
    var input = document.getElementById('adminPinInput');
    var msg = document.getElementById('adminPinMsg');

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('.vb-admin-trigger');
      if (!trigger) return;
      e.preventDefault();
      if (window.RafaelMenu) window.RafaelMenu.close();
      var jaDesbloqueado = false;
      try { jaDesbloqueado = localStorage.getItem(chaveAdmin()) === '1'; } catch (err) {}
      if (jaDesbloqueado || modoAdmin) {
        ativarModoAdmin();
        return;
      }
      overlay.classList.remove('oculto');
      msg.textContent = '';
      input.value = '';
      input.focus();
    });

    document.getElementById('adminPinCancelar').addEventListener('click', function () {
      overlay.classList.add('oculto');
    });

    function confirmarPin() {
      var pin = input.value.trim();
      if (!pin) return;
      msg.className = 'msg';
      msg.textContent = 'Verificando…';
      db.rpc('tenant_verificar_pin', { p_estabelecimento_id: estabId, p_pin: pin }).then(function (res) {
        if (res.error || !res.data) {
          msg.className = 'msg msg-erro';
          msg.textContent = 'PIN incorreto.';
          return;
        }
        try { localStorage.setItem(chaveAdmin(), '1'); } catch (e) {}
        overlay.classList.add('oculto');
        ativarModoAdmin();
      }, function () {
        msg.className = 'msg msg-erro';
        msg.textContent = 'Sem conexão agora.';
      });
    }
    document.getElementById('adminPinConfirmar').addEventListener('click', confirmarPin);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmarPin(); });
    document.getElementById('adminSairBtn').addEventListener('click', desativarModoAdmin);
    var corInput = document.getElementById('adminCorInput');
    corInput.addEventListener('input', function () { aplicarCorDinamica(corInput.value); });
    corInput.addEventListener('change', function () { salvarCor(corInput.value); });
  }

  function aplicarGenero(g) {
    generoAtual = g;
    var femCss = document.getElementById('tplFeminino');
    femCss.disabled = (g !== 'feminino');

    var nome = linhaAtual.nome;
    document.getElementById('tplEyebrow').textContent = (SEGMENTOS[linhaAtual.segmento] || 'Estabelecimento') + ' · ' + linhaAtual.cidade;
    document.getElementById('tplHeadline').textContent = linhaAtual.titulo_hero || COPY[g].headline;
    document.getElementById('tplSubcopy').textContent = linhaAtual.subtitulo_hero || COPY[g].sub;

    var fotoHero = (g === 'feminino' && linhaAtual.foto_hero_feminino_url) ? linhaAtual.foto_hero_feminino_url : linhaAtual.foto_hero_url;
    var heroFoto = document.getElementById('tplHeroFoto');
    heroFoto.style.backgroundColor = 'var(--linen-deep)';
    if (fotoHero) {
      heroFoto.style.backgroundImage = 'url("' + fotoHero + '")';
      heroFoto.style.backgroundSize = 'cover';
    } else {
      // o padrão boiserie é um ladrilho pequeno (72x72) pra repetir, não
      // uma foto — "cover" esticava ele até virar um único quadrado gigante.
      heroFoto.style.backgroundImage = 'url("' + boiseriePlaceholder(linhaAtual.cor_destaque) + '")';
      heroFoto.style.backgroundSize = '72px 72px';
    }

    var trocaBtn = document.getElementById('tplTrocaGenero');
    if (linhaAtual.genero_atendimento === 'ambos') {
      var outro = g === 'masculino' ? 'feminino' : 'masculino';
      document.getElementById('tplTrocaGlifo').textContent = outro === 'feminino' ? 'F' : 'M';
      document.getElementById('tplTrocaLabel').textContent = outro === 'feminino' ? 'Área feminina' : 'Área masculina';
      trocaBtn.classList.remove('oculto');
      trocaBtn.onclick = function (e) {
        e.preventDefault();
        try { sessionStorage.setItem(SESSION_KEY, outro); } catch (err) {}
        aplicarGenero(outro);
      };
    } else {
      trocaBtn.classList.add('oculto');
    }
  }

  function mostrarSplashSeNecessario() {
    var chave = 'vbSplashVisto_' + estabId;
    var jaViu = false;
    try { jaViu = sessionStorage.getItem(chave) === '1'; } catch (e) {}
    if (jaViu) return;
    try { sessionStorage.setItem(chave, '1'); } catch (e) {}
    var splash = document.getElementById('vbSplash');
    if (!splash) return;
    splash.classList.remove('oculto');
    setTimeout(function () { splash.classList.add('oculto'); }, 1500);
  }

  function iniciarGenero() {
    if (linhaAtual.genero_atendimento !== 'ambos') {
      document.getElementById('genderGate').remove();
      mostrarSplashSeNecessario();
      aplicarGenero(linhaAtual.genero_atendimento);
      return;
    }
    var escolhaSalva = null;
    try { escolhaSalva = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
    if (escolhaSalva) {
      document.getElementById('genderGate').remove();
      aplicarGenero(escolhaSalva);
      return;
    }
    var gate = document.getElementById('genderGate');
    gate.classList.add('open');
    document.body.classList.add('scroll-locked');
    gate.querySelectorAll('[data-gender-escolha]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var escolha = btn.getAttribute('data-gender-escolha');
        try { sessionStorage.setItem(SESSION_KEY, escolha); } catch (e) {}
        document.body.classList.remove('scroll-locked');
        gate.remove();
        aplicarGenero(escolha);
      });
    });
  }

  // ---------- serviços, galeria, agenda ----------
  var ICONE_TESOURA = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="23" r="3.2"/><circle cx="9" cy="9" r="3.2"/><line x1="11.5" y1="11" x2="26" y2="23"/><line x1="11.5" y1="21" x2="26" y2="9"/></svg>';
  var ICONE_AGENDA = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="9" width="20" height="16" rx="2"/><line x1="6" y1="14" x2="26" y2="14"/><line x1="11" y1="6" x2="11" y2="11"/><line x1="21" y1="6" x2="21" y2="11"/></svg>';

  // ---------- redes sociais (mesmo padrão em todas as réplicas) ----------
  var ICONE_WHATSAPP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c4.97 0 9-3.8 9-8.5S16.97 4 12 4s-9 3.8-9 8.5c0 1.7.5 3.2 1.4 4.5L3 21l4.3-1.3c1.3.8 2.9 1.3 4.7 1.3z"/><path d="M8.7 9.3c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .5.4l.6 1.5c.1.2 0 .4-.1.5l-.5.5c-.1.1-.2.3-.1.5.3.6 1.4 1.7 2 2 .2.1.4 0 .5-.1l.5-.5c.1-.1.3-.2.5-.1l1.5.6c.4.1.4.3.4.5v.5c0 .2 0 .4-.5.6-1.6.6-3.7-.5-5.1-1.9-1.4-1.4-2.5-3.5-1.9-5.1z" fill="currentColor" stroke="none"/></svg>';
  var ICONE_INSTAGRAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.3"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>';
  var ICONE_FACEBOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M14 8.5h-1.3c-.9 0-1.7.7-1.7 1.6v2h3l-.4 2.6h-2.6V19"/></svg>';
  var ICONE_TIKTOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.5a3.5 3.5 0 1 1-3-3.46"/><path d="M14 4c.3 2.2 1.8 3.8 4 4.2"/></svg>';

  var REDES = [
    { chave: 'whatsapp', label: 'WhatsApp', icone: ICONE_WHATSAPP },
    { chave: 'instagram_url', label: 'Instagram', icone: ICONE_INSTAGRAM },
    { chave: 'facebook_url', label: 'Facebook', icone: ICONE_FACEBOOK },
    { chave: 'tiktok_url', label: 'TikTok', icone: ICONE_TIKTOK }
  ];

  function carregarRedesSociais() {
    var strip = document.getElementById('tplRedesSociais');
    if (!strip) return;
    var linksVisiveis = REDES.filter(function (r) {
      if (r.chave === 'whatsapp') return !!linhaAtual.telefone_whatsapp;
      return modoAdmin || linhaAtual[r.chave];
    });
    strip.innerHTML = linksVisiveis.map(function (r) {
      var url = r.chave === 'whatsapp'
        ? 'https://wa.me/55' + linhaAtual.telefone_whatsapp.replace(/\D/g, '')
        : linhaAtual[r.chave];
      var vazio = r.chave !== 'whatsapp' && !url;
      var estiloVazio = vazio ? ' style="opacity:0.4;"' : '';
      if (modoAdmin && r.chave !== 'whatsapp') {
        return '<button type="button" class="social-badge" data-rede="' + r.chave + '" title="' + r.label + '"' + estiloVazio + '>' + r.icone + '</button>';
      }
      return '<a class="social-badge" href="' + escapeHtml(url) + '" target="_blank" rel="noopener" title="' + r.label + '">' + r.icone + '</a>';
    }).join('');

    if (!modoAdmin) return;
    strip.querySelectorAll('[data-rede]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var chave = btn.getAttribute('data-rede');
        var atual = linhaAtual[chave] || '';
        var novo = window.prompt('Link do ' + btn.getAttribute('title') + ' (deixe vazio pra remover):', atual);
        if (novo === null) return;
        novo = novo.trim() || null;
        linhaAtual[chave] = novo;
        db.rpc('tenant_admin_atualizar_redes', {
          p_estabelecimento_id: estabId,
          p_instagram_url: linhaAtual.instagram_url,
          p_facebook_url: linhaAtual.facebook_url,
          p_tiktok_url: linhaAtual.tiktok_url
        }).then(carregarRedesSociais);
      });
    });
  }

  var servicosCache = [];

  function carregarServicos() {
    var lista = document.getElementById('tplListaServicos');
    var strip = document.getElementById('tplServiceStrip');
    db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      servicosCache = linhas;
      strip.innerHTML =
        '<button type="button" class="service-badge" onclick="document.getElementById(\'servicosSecao\').scrollIntoView({behavior:\'smooth\'})"><span class="mark">' + ICONE_TESOURA + '</span><strong>Ver</strong><span>Serviços</span></button>' +
        '<button type="button" class="service-badge" data-open-widget><span class="mark">' + ICONE_AGENDA + '</span><strong>Agendar</strong><span>Horário</span></button>';

      if (!linhas.length && !modoAdmin) {
        lista.innerHTML = '<li style="border:none; color:var(--ink-soft);">Serviços em breve.</li>';
        return;
      }

      if (!modoAdmin) {
        lista.innerHTML = linhas.map(function (s) {
          return '<li><span class="nome">' + escapeHtml(s.nome) + '</span><span class="cidade">' + formatarPreco(s.preco) + '</span></li>';
        }).join('');
      } else {
        lista.innerHTML = linhas.map(function (s) {
          return '<li style="position:relative; padding-right:2.2rem;">' +
            '<span class="nome" contenteditable="true" data-servico-id="' + s.id + '" data-campo="nome" data-vb-editavel="servico">' + escapeHtml(s.nome) + '</span>' +
            '<span class="cidade" contenteditable="true" data-servico-id="' + s.id + '" data-campo="preco" data-vb-editavel="servico">' + Number(s.preco).toFixed(2).replace('.', ',') + '</span>' +
            '<button type="button" class="vb-remover-x" data-remover-servico="' + s.id + '">×</button>' +
            '</li>';
        }).join('') + '<li style="border:none;"><button type="button" class="btn btn-ghost" id="vbAddServico" style="padding:0.4rem 0.8rem; font-size:0.82rem;">+ Novo serviço</button></li>';

        lista.querySelectorAll('[data-servico-id]').forEach(function (el) {
          el.addEventListener('blur', function () {
            var novoNome = el.parentNode.querySelector('[data-campo="nome"]').textContent.trim();
            var novoPreco = parseFloat(el.parentNode.querySelector('[data-campo="preco"]').textContent.replace(',', '.')) || 0;
            db.rpc('tenant_admin_salvar_servico', {
              p_estabelecimento_id: estabId, p_id: el.getAttribute('data-servico-id'),
              p_nome: novoNome, p_preco: novoPreco, p_categoria: linhas.filter(function (s) { return s.id === el.getAttribute('data-servico-id'); })[0].categoria
            });
          });
        });
        lista.querySelectorAll('[data-remover-servico]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            db.rpc('tenant_admin_remover_servico', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-servico') }).then(carregarServicos);
          });
        });
        var addBtn = document.getElementById('vbAddServico');
        if (addBtn) addBtn.addEventListener('click', function () {
          var nome = window.prompt('Nome do serviço:');
          if (!nome) return;
          var preco = parseFloat(window.prompt('Preço (ex: 45.00):') || '0') || 0;
          db.rpc('tenant_admin_salvar_servico', { p_estabelecimento_id: estabId, p_id: null, p_nome: nome, p_preco: preco, p_categoria: 'unissex' }).then(carregarServicos);
        });
      }
    });
  }

  function carregarGaleria() {
    db.rpc('tenant_listar_galeria', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      if (!linhas.length && !modoAdmin) return;

      var grid = document.getElementById('tplGrid');
      var fotosHtml = linhas.slice(0, 9).map(function (g) {
        var remover = modoAdmin ? '<button type="button" class="vb-remover-x" data-remover-galeria="' + g.id + '">×</button>' : '';
        return '<div class="vb-foto-wrap"><img src="' + escapeHtml(g.foto_url) + '" alt="" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:6px;" loading="lazy">' + remover + '</div>';
      }).join('');
      grid.innerHTML = fotosHtml + (modoAdmin ? '<button type="button" class="vb-add-tile" id="vbAddFoto">+</button><input type="file" id="vbAddFotoInput" accept="image/*" multiple style="display:none;">' : '');
      document.getElementById('tplGaleriaSecao').classList.remove('oculto');

      if (!modoAdmin) return;
      grid.querySelectorAll('[data-remover-galeria]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          db.rpc('tenant_admin_remover_foto', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-galeria') }).then(carregarGaleria);
        });
      });
      document.getElementById('vbAddFoto').addEventListener('click', function () {
        document.getElementById('vbAddFotoInput').click();
      });
      document.getElementById('vbAddFotoInput').addEventListener('change', function (e) {
        var arquivos = Array.prototype.slice.call(e.target.files);
        if (!arquivos.length || !window.VBUpload) return;
        Promise.all(arquivos.map(function (arquivo) {
          return window.VBUpload.uploadFoto(arquivo, estabId, 'galeria').then(function (url) {
            return db.rpc('tenant_admin_adicionar_foto', { p_estabelecimento_id: estabId, p_foto_url: url, p_staff_id: null });
          });
        })).then(carregarGaleria);
      });
    });
  }

  // ---------- agenda em passo a passo (mesmo fluxo do Rafael, com dados
  // de verdade por estabelecimento e horários que respeitam quem já
  // marcou) ----------
  var WIZ_STORAGE_PREFIX = 'vbClienteContato_';
  var DIAS_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  function iniciarWizard() {
    var overlay = document.getElementById('wizardOverlay');
    if (!overlay) return;

    var closeBtn = document.getElementById('wizardClose');
    var backBtn = document.getElementById('wizardBack');
    var nextBtn = document.getElementById('wizardNext');
    var wizardNav = overlay.querySelector('.wizard-nav');
    var successEl = document.getElementById('wizardSuccess');
    var successCloseBtn = document.getElementById('wizardSuccessClose');
    var whatsappLink = document.getElementById('wizardWhatsappLink');
    var welcomeHint = document.getElementById('welcomeBackHint');
    var nomeInput = document.getElementById('wizNome');
    var telefoneInput = document.getElementById('wizTelefone');
    var profissionalList = overlay.querySelector('[data-group="profissional"]');
    var servicoGrid = overlay.querySelector('[data-group="servico"]');
    var diaRow = overlay.querySelector('[data-group="dia"]');
    var horarioGrid = overlay.querySelector('[data-group="horario"]');
    var steps = Array.prototype.slice.call(overlay.querySelectorAll('.wizard-step'));
    var dots = Array.prototype.slice.call(overlay.querySelectorAll('.wizard-steps-dots span'));
    var totalSteps = steps.length;
    var current = 1;
    var choices = {};
    var staffList = [];
    var diasDisponiveis = [];
    var lastFocused = null;

    function storageKey() { return WIZ_STORAGE_PREFIX + estabId; }

    function isoDate(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function carregarProfissionais() {
      db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId }).then(function (res) {
        staffList = res.data || [];
        if (!staffList.length) {
          profissionalList.innerHTML = '<button type="button" class="pick-card" data-value="Qualquer profissional">Qualquer profissional disponível</button>';
          return;
        }
        profissionalList.innerHTML = staffList.map(function (p) {
          return '<button type="button" class="pick-card" data-value="' + escapeHtml(p.nome) + '" data-staff-id="' + p.id + '">' +
            '<img src="' + (p.foto_url ? escapeHtml(p.foto_url) : '/assets/tpl-classico/img/placeholder-portrait.svg') + '" alt="">' +
            escapeHtml(p.nome) + (p.especialidade ? ' — ' + escapeHtml(p.especialidade) : '') +
            '</button>';
        }).join('');
      });
    }

    function carregarServicosWizard() {
      var genero = generoAtual;
      var lista = servicosCache.filter(function (s) { return s.categoria === genero || s.categoria === 'unissex'; });
      if (!lista.length) lista = servicosCache;
      servicoGrid.innerHTML = lista.map(function (s) {
        return '<button type="button" class="pick-btn" data-value="' + escapeHtml(s.nome) + '">' + escapeHtml(s.nome) + '</button>';
      }).join('');
    }

    function gerarDiasUteis(n) {
      var dias = [];
      var hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      for (var i = 1; dias.length < n; i++) {
        var d = new Date(hoje);
        d.setDate(hoje.getDate() + i);
        dias.push(d);
      }
      return dias;
    }

    function renderDias() {
      diasDisponiveis = gerarDiasUteis(6);
      diaRow.innerHTML = diasDisponiveis.map(function (d) {
        var label = DIAS_ABREV[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
        return '<button type="button" class="day-btn" data-value="' + label + '" data-iso="' + isoDate(d) + '">' +
          DIAS_ABREV[d.getDay()] + '<br>' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '</button>';
      }).join('');
    }

    function renderHorarios(slots) {
      if (!slots || !slots.length) {
        horarioGrid.innerHTML = '<p style="grid-column:1/-1; color:var(--ink-soft); font-size:0.9rem;">Sem horários livres nesse dia.</p>';
        return;
      }
      horarioGrid.innerHTML = slots.map(function (s) {
        return '<button type="button" class="time-btn" data-value="' + s.horario + '"' + (s.disponivel ? '' : ' disabled style="opacity:.35;"') + '>' + s.horario + (s.disponivel ? '' : ' (ocupado)') + '</button>';
      }).join('');
    }

    function atualizarHorarios() {
      var diaBtn = diaRow.querySelector('.day-btn.selected');
      if (!diaBtn) return;
      var iso = diaBtn.getAttribute('data-iso');
      var profBtn = profissionalList.querySelector('.pick-card.selected');
      var staffId = profBtn ? profBtn.getAttribute('data-staff-id') : null;
      horarioGrid.innerHTML = '<p style="grid-column:1/-1; color:var(--ink-soft); font-size:0.9rem;">Carregando…</p>';
      db.rpc('tenant_public_agenda_slots', { p_estabelecimento_id: estabId, p_dia: iso, p_staff_id: staffId || null }).then(function (res) {
        renderHorarios(res.data || []);
      }, function () {
        renderHorarios([]);
      });
    }

    function isStepValid(step) {
      var stepEl = steps[step - 1];
      var requiredInputs = stepEl.querySelectorAll('.field-input[required]');
      if (requiredInputs.length) {
        return Array.prototype.every.call(requiredInputs, function (inp) { return inp.value.trim().length > 0; });
      }
      var group = stepEl.querySelector('[data-group]');
      if (!group) return true;
      return Boolean(choices[group.getAttribute('data-group')]);
    }

    function render() {
      steps.forEach(function (s) { s.classList.toggle('active', Number(s.dataset.step) === current); });
      dots.forEach(function (d) {
        var n = Number(d.dataset.dot);
        d.classList.toggle('active', n === current);
        d.classList.toggle('done', n < current);
      });
      nextBtn.textContent = current === totalSteps ? 'Confirmar' : 'Continuar';
      nextBtn.classList.toggle('is-disabled', !isStepValid(current));
      if (current === totalSteps) {
        document.getElementById('wizSummaryBox').innerHTML =
          'Nome: <strong>' + escapeHtml(choices.nome || '—') + '</strong><br>' +
          'Profissional: <strong>' + escapeHtml(choices.profissional || '—') + '</strong><br>' +
          'Serviço: <strong>' + escapeHtml(choices.servico || '—') + '</strong><br>' +
          'Dia: <strong>' + escapeHtml(choices.dia || '—') + '</strong><br>' +
          'Horário: <strong>' + escapeHtml(choices.horario || '—') + '</strong>';
      }
    }

    function selectChoice(groupName, value) {
      choices[groupName] = value;
      var group = overlay.querySelector('[data-group="' + groupName + '"]');
      if (group) {
        group.querySelectorAll('[data-value]').forEach(function (b) {
          b.classList.toggle('selected', b.getAttribute('data-value') === value);
        });
      }
      if (groupName === 'profissional' || groupName === 'dia') atualizarHorarios();
      render();
    }

    [profissionalList, servicoGrid, diaRow, horarioGrid].forEach(function (group) {
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-value]');
        if (!btn || btn.disabled) return;
        selectChoice(group.getAttribute('data-group'), btn.getAttribute('data-value'));
      });
    });

    function syncContato() {
      choices.nome = nomeInput.value.trim();
      choices.telefone = telefoneInput.value.trim();
    }
    ['input', 'change', 'blur'].forEach(function (evt) {
      nomeInput.addEventListener(evt, function () { syncContato(); render(); });
      telefoneInput.addEventListener(evt, function () { syncContato(); render(); });
    });

    function lockScroll() {
      document.body.classList.add('scroll-locked');
    }
    function unlockScroll() {
      document.body.classList.remove('scroll-locked');
    }

    function open() {
      lastFocused = document.activeElement;
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      lockScroll();
      carregarProfissionais();
      carregarServicosWizard();
      renderDias();

      var saved = null;
      try {
        var raw = localStorage.getItem(storageKey());
        if (raw) saved = JSON.parse(raw);
      } catch (e) {}

      current = 1;
      choices = {};
      if (saved && saved.nome && saved.telefone) {
        choices.nome = saved.nome;
        choices.telefone = saved.telefone;
        nomeInput.value = saved.nome;
        telefoneInput.value = saved.telefone;
        welcomeHint.textContent = 'Bem-vindo de volta, ' + saved.nome.split(' ')[0] + '! Já preenchemos seus dados — é só conferir.';
        welcomeHint.style.display = '';
        db.rpc('tenant_registrar_cliente', { p_estabelecimento_id: estabId, p_nome: saved.nome, p_telefone: saved.telefone });
        current = 2;
      } else {
        welcomeHint.style.display = 'none';
        nomeInput.value = '';
        telefoneInput.value = '';
      }
      render();
      if (closeBtn) closeBtn.focus();
    }

    function mostrarSucesso(whatsappUrl) {
      whatsappLink.href = whatsappUrl;
      document.getElementById('wizSummarySuccessBox').innerHTML = document.getElementById('wizSummaryBox').innerHTML;
      steps.forEach(function (s) { s.classList.remove('active'); });
      wizardNav.style.display = 'none';
      successEl.style.display = '';
      overlay.scrollTop = 0;
      if (successCloseBtn) successCloseBtn.focus();
    }

    function close() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      unlockScroll();
      current = 1;
      choices = {};
      nextBtn.disabled = false;
      wizardNav.style.display = '';
      successEl.style.display = 'none';
      overlay.querySelectorAll('.selected').forEach(function (b) { b.classList.remove('selected'); });
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    if (successCloseBtn) successCloseBtn.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    backBtn.addEventListener('click', function () {
      if (current > 1) { current--; render(); overlay.scrollTop = 0; } else { close(); }
    });

    nextBtn.addEventListener('click', function () {
      syncContato();
      if (!isStepValid(current)) {
        var stepEl = steps[current - 1];
        var vazio = stepEl.querySelector('.field-input[required]');
        if (vazio) { if (vazio.reportValidity) vazio.reportValidity(); else vazio.focus(); }
        return;
      }

      var eraContato = current === 1;
      if (eraContato) {
        try { localStorage.setItem(storageKey(), JSON.stringify({ nome: choices.nome, telefone: choices.telefone })); } catch (e) {}
      }

      if (current < totalSteps) {
        current++;
        render();
        overlay.scrollTop = 0;
        if (eraContato) db.rpc('tenant_registrar_cliente', { p_estabelecimento_id: estabId, p_nome: choices.nome || '', p_telefone: choices.telefone || '' });
        return;
      }

      nextBtn.disabled = true;
      var diaBtn = diaRow.querySelector('.day-btn.selected');
      var profBtn = profissionalList.querySelector('.pick-card.selected');
      db.rpc('tenant_criar_agendamento', {
        p_estabelecimento_id: estabId,
        p_cliente_nome: choices.nome || '',
        p_cliente_telefone: choices.telefone || '',
        p_staff_id: profBtn ? profBtn.getAttribute('data-staff-id') : null,
        p_staff_nome: choices.profissional || null,
        p_servico: choices.servico || null,
        p_dia: diaBtn ? diaBtn.getAttribute('data-iso') : null,
        p_dia_label: choices.dia || null,
        p_horario: choices.horario || ''
      }).then(function (res) {
        nextBtn.disabled = false;
        if (res.error) {
          window.alert(res.error.message);
          current = 4;
          render();
          atualizarHorarios();
          return;
        }
        var tel = (linhaAtual.telefone_whatsapp || '').replace(/\D/g, '');
        var msg = 'Olá! Quero agendar um horário:%0A' +
          '• Nome: ' + encodeURIComponent(choices.nome || '') + '%0A' +
          '• Profissional: ' + encodeURIComponent(choices.profissional || '') + '%0A' +
          '• Serviço: ' + encodeURIComponent(choices.servico || '') + '%0A' +
          '• Dia: ' + encodeURIComponent(choices.dia || '') + '%0A' +
          '• Horário: ' + encodeURIComponent(choices.horario || '');
        var url = tel ? ('https://wa.me/55' + tel + '?text=' + msg) : '#';
        mostrarSucesso(url);
      }, function () {
        nextBtn.disabled = false;
        window.alert('Sem conexão agora — tenta de novo em instantes.');
      });
    });

    document.addEventListener('click', function (e) {
      if (modoAdmin && e.target.closest('[contenteditable="true"]')) return;
      if (e.target.closest('[data-open-widget]')) {
        if (window.RafaelMenu) window.RafaelMenu.close();
        open();
      }
    });
  }

  function renderizar(linha) {
    carregando.classList.add('oculto');
    estabId = linha.id;
    linhaAtual = linha;
    aplicarTemplateCss(linha.template);
    aplicarCorDinamica(linha.cor_destaque);
    var adminCorInput = document.getElementById('adminCorInput');
    if (adminCorInput) adminCorInput.value = linha.cor_destaque || '#C9A227';

    document.title = linha.nome + ' — VB Agenda';
    document.getElementById('tplNomeTopo').textContent = linha.nome;
    document.getElementById('tplNomeRodape').textContent = linha.nome;
    document.getElementById('tplCtaTexto').textContent = linha.texto_cta || 'Agendar horário';
    document.getElementById('tplCidadeRodape').textContent = linha.cidade.charAt(0).toUpperCase() + linha.cidade.slice(1) + '/SP';
    document.getElementById('tplEnderecoMenu').textContent = linha.cidade.charAt(0).toUpperCase() + linha.cidade.slice(1) + '/SP';
    document.getElementById('tplCopyright').textContent = '© ' + new Date().getFullYear() + ' ' + linha.nome + ' — todos os direitos reservados';

    if (linha.telefone_whatsapp) {
      var tel = linha.telefone_whatsapp.replace(/\D/g, '');
      ['tplTelefoneMenu', 'tplTelefoneRodape'].forEach(function (id) {
        var a = document.getElementById(id);
        a.href = 'tel:+55' + tel;
        a.textContent = linha.telefone_whatsapp;
      });
    } else {
      document.getElementById('tplTelefoneMenu').closest('p').style.display = 'none';
      document.getElementById('tplTelefoneRodape').style.display = 'none';
    }

    document.getElementById('tplEnderecoRodape').textContent = linha.endereco || 'Endereço não informado';
    atualizarMapaLink();
    carregarHorarioRodape();
    var linkInst = document.getElementById('tplLinkInstitucional');
    if (linkInst) linkInst.href = '/' + encodeURIComponent(slug) + '/' + encodeURIComponent(cidade) + '/institucional';

    tpl.classList.remove('oculto');
    iniciarGenero();
    carregarServicos();
    carregarGaleria();
    carregarRedesSociais();
    iniciarModoAdmin();
    iniciarWizard();
    var jaDesbloqueado = false;
    try { jaDesbloqueado = localStorage.getItem(chaveAdmin()) === '1'; } catch (e) {}
    if (jaDesbloqueado) ativarModoAdmin();

    // site incompleto (sem serviço ou sem equipe) pra quem visita? mostra
    // "em preparação" por cima de tudo (inclusive do gate de gênero, que
    // não faz sentido perguntar pra um site ainda vazio) — o conteúdo por
    // baixo continua sendo montado normal, então o admin edita tudo assim
    // que desbloqueia (linha acima já chama isso de novo).
    atualizarGateIncompleto();

    // veio de outra página do site (ex: institucional.html) com
    // #agendar na URL? abre a agenda direto.
    if (window.location.hash === '#agendar') {
      var gatilho = document.querySelector('[data-open-widget]');
      if (gatilho) gatilho.click();
    }
  }

  db.rpc('buscar_estabelecimento', { p_slug: slug, p_cidade: cidade }).then(function (res) {
    var linha = res.data && res.data[0];
    if (res.error || !linha) {
      mostrarNaoEncontrado();
      return;
    }
    renderizar(linha);
  }, mostrarNaoEncontrado);
})();
