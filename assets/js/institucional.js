/* Página /:slug/:cidade/institucional — "conheça a casa": sobre,
   equipe, galeria e serviços, com o mesmo cabeçalho/rodapé/modo admin
   do perfil público. */
(function () {
  if (!window.db) return;

  var partes = window.location.pathname.split('/').filter(Boolean);
  var slug = partes[0];
  var cidade = partes[1];

  var carregando = document.getElementById('carregando');
  var naoEncontrado = document.getElementById('naoEncontrado');
  var tpl = document.getElementById('tplClassico');
  var estabId = null;
  var linhaAtual = null;
  var modoAdmin = false;

  var TEMPLATE_PASTAS = {
    'classico-boiserie': 'tpl-classico',
    'claro-minimal': 'tpl-claro',
    'escuro-premium': 'tpl-escuro',
    'automotivo-carbono': 'tpl-automotivo'
  };
  var templateAtualParaCor = 'classico-boiserie';
  var TEMPLATES_COM_TERRACOTTA = ['claro-minimal', 'escuro-premium', 'automotivo-carbono'];
  function aplicarTemplateCss(templateKey) {
    templateAtualParaCor = templateKey || 'classico-boiserie';
    var pasta = TEMPLATE_PASTAS[templateKey] || 'tpl-classico';
    document.getElementById('tplBase').href = '/assets/' + pasta + '/css/base.css?v=4';
    document.getElementById('tplFeminino').href = '/assets/' + pasta + '/css/feminino.css?v=3';
  }

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
  // segunda cor da paleta: quando o dono escolhe uma, ela vira o tom
  // "profundo" usado nos degradês (botões, hero) no lugar do escurecimento
  // automático — as duas cores predominantes do site ficam nas mãos dele.
  function aplicarCorDinamica(cor, corSecundaria) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(cor || '')) return;
    var rgb = hexParaRgbNums(cor);
    var corSecundariaValida = /^#[0-9A-Fa-f]{6}$/.test(corSecundaria || '');
    var escuro = corSecundariaValida ? corSecundaria : rgbParaHex(misturarRgb(rgb, [0, 0, 0], 0.28));
    var claro = rgbParaHex(misturarRgb(rgb, [255, 255, 255], 0.42));
    var estilo = document.getElementById('tplCorDinamica');
    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = 'tplCorDinamica';
      document.head.appendChild(estilo);
    }
    if (TEMPLATES_COM_TERRACOTTA.indexOf(templateAtualParaCor) > -1) {
      estilo.textContent = ':root{--terracotta:' + cor + '; --terracotta-deep:' + escuro + '; --terracotta-claro:' + claro + '; --terracotta-rgb:' + rgb.join(',') + ';}';
    } else {
      estilo.textContent = ':root{--dourado:' + cor + '; --dourado-escuro:' + escuro + '; --dourado-claro:' + claro + '; --dourado-rgb:' + rgb.join(',') + ';}';
    }
  }
  function salvarCor(cor, corSecundaria) {
    linhaAtual.cor_destaque = cor;
    linhaAtual.cor_secundaria = corSecundaria;
    aplicarCorDinamica(cor, corSecundaria);
    db.rpc('tenant_admin_atualizar_cor', { p_estabelecimento_id: estabId, p_cor_destaque: cor, p_cor_secundaria: corSecundaria || null });
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

  var SESSION_KEY = 'vbGeneroSessao_' + slug + '_' + cidade;
  (function aplicarGeneroSalvo() {
    var femCss = document.getElementById('tplFeminino');
    var escolha = null;
    try { escolha = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
    femCss.disabled = (escolha !== 'feminino');
  })();

  // ---------- horário (mesma lógica de agrupamento do perfil.js) ----------
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
    }, function () { wrap.innerHTML = '<p>Consulte os horários pelo WhatsApp</p>'; });
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

  function geocodificarEndereco(endereco, cidade) {
    var consulta = [endereco, cidade, 'Brasil'].filter(Boolean).join(', ');
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(consulta);
    return fetch(url).then(function (res) { return res.json(); }).then(function (dados) {
      var achado = dados && dados[0];
      return achado ? { lat: parseFloat(achado.lat), lng: parseFloat(achado.lon) } : null;
    }, function () { return null; });
  }

  // ---------- redes sociais (mesmo padrão do perfil.js) ----------
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
    var visiveis = REDES.filter(function (r) {
      if (r.chave === 'whatsapp') return !!linhaAtual.telefone_whatsapp;
      return modoAdmin || linhaAtual[r.chave];
    });
    strip.innerHTML = visiveis.map(function (r) {
      var url = r.chave === 'whatsapp' ? 'https://wa.me/55' + linhaAtual.telefone_whatsapp.replace(/\D/g, '') : linhaAtual[r.chave];
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
        var novo = window.prompt('Link do ' + btn.getAttribute('title') + ' (deixe vazio pra remover):', linhaAtual[chave] || '');
        if (novo === null) return;
        linhaAtual[chave] = novo.trim() || null;
        db.rpc('tenant_admin_atualizar_redes', {
          p_estabelecimento_id: estabId,
          p_instagram_url: linhaAtual.instagram_url,
          p_facebook_url: linhaAtual.facebook_url,
          p_tiktok_url: linhaAtual.tiktok_url
        }).then(carregarRedesSociais);
      });
    });
  }

  // ---------- equipe ----------
  function carregarEquipe() {
    var grid = document.getElementById('tplEquipeGrid');
    db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      var cartoes = linhas.map(function (p) {
        var remover = modoAdmin ? '<button type="button" class="vb-remover-x" data-remover-membro="' + p.id + '">×</button>' : '';
        return '<div class="vb-foto-wrap" style="text-align:center; padding:1rem; border:1px solid var(--stone); border-radius:10px;">' +
          '<img src="' + (p.foto_url ? escapeHtml(p.foto_url) : '/assets/tpl-classico/img/placeholder-portrait.svg') + '" alt="" style="width:84px; height:84px; border-radius:50%; object-fit:cover; margin-bottom:0.6rem;">' +
          remover +
          '<p style="font-weight:700;">' + escapeHtml(p.nome) + '</p>' +
          '<p style="color:var(--ink-soft); font-size:0.85rem;">' + escapeHtml(p.especialidade || '') + '</p>' +
          '</div>';
      }).join('');
      grid.innerHTML = cartoes + (linhas.length ? '' : '<p style="color:var(--ink-soft);">Equipe em breve.</p>') +
        (modoAdmin ? '<button type="button" class="vb-add-tile" id="vbAddMembro" style="min-height:140px;">+</button>' : '');

      if (!modoAdmin) return;
      grid.querySelectorAll('[data-remover-membro]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          db.rpc('tenant_admin_remover_membro', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-membro') }).then(carregarEquipe);
        });
      });
      var addBtn = document.getElementById('vbAddMembro');
      if (addBtn) addBtn.addEventListener('click', function () {
        var nome = window.prompt('Nome do profissional:');
        if (!nome) return;
        var especialidade = window.prompt('Especialidade (opcional):') || null;
        db.rpc('tenant_admin_salvar_membro', { p_estabelecimento_id: estabId, p_id: null, p_nome: nome, p_especialidade: especialidade, p_foto_url: null }).then(carregarEquipe);
      });
    });
  }

  // ---------- galeria ----------
  function carregarGaleria() {
    db.rpc('tenant_listar_galeria', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      if (!linhas.length && !modoAdmin) return;
      var grid = document.getElementById('tplGridInst');
      var fotosHtml = linhas.slice(0, 9).map(function (g) {
        var remover = modoAdmin ? '<button type="button" class="vb-remover-x" data-remover-galeria="' + g.id + '">×</button>' : '';
        return '<div class="vb-foto-wrap"><img src="' + escapeHtml(g.foto_url) + '" alt="" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:6px;" loading="lazy">' + remover + '</div>';
      }).join('');
      grid.innerHTML = fotosHtml + (modoAdmin ? '<button type="button" class="vb-add-tile" id="vbAddFotoInst">+</button><input type="file" id="vbAddFotoInstInput" accept="image/*" multiple style="display:none;">' : '');
      document.getElementById('tplGaleriaSecaoInst').classList.remove('oculto');
      if (!modoAdmin) return;
      grid.querySelectorAll('[data-remover-galeria]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          db.rpc('tenant_admin_remover_foto', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-galeria') }).then(carregarGaleria);
        });
      });
      document.getElementById('vbAddFotoInst').addEventListener('click', function () { document.getElementById('vbAddFotoInstInput').click(); });
      document.getElementById('vbAddFotoInstInput').addEventListener('change', function (e) {
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

  // ---------- serviços ----------
  function carregarServicos() {
    var lista = document.getElementById('tplListaServicosInst');
    db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      if (!linhas.length && !modoAdmin) { lista.innerHTML = '<li style="border:none; color:var(--ink-soft);">Serviços em breve.</li>'; return; }
      if (!modoAdmin) {
        lista.innerHTML = linhas.map(function (s) {
          return '<li><span class="nome">' + escapeHtml(s.nome) + '</span><span class="cidade">' + formatarPreco(s.preco) + '</span></li>';
        }).join('');
        return;
      }
      lista.innerHTML = linhas.map(function (s) {
        return '<li style="position:relative; padding-right:2.2rem;">' +
          '<span class="nome" contenteditable="true" data-servico-id="' + s.id + '" data-campo="nome">' + escapeHtml(s.nome) + '</span>' +
          '<span class="cidade" contenteditable="true" data-servico-id="' + s.id + '" data-campo="preco">' + Number(s.preco).toFixed(2).replace('.', ',') + '</span>' +
          '<button type="button" class="vb-remover-x" data-remover-servico="' + s.id + '">×</button>' +
          '</li>';
      }).join('') + '<li style="border:none;"><button type="button" class="btn btn-ghost" id="vbAddServicoInst" style="padding:0.4rem 0.8rem; font-size:0.82rem;">+ Novo serviço</button></li>';
      lista.querySelectorAll('[data-servico-id]').forEach(function (el) {
        el.addEventListener('blur', function () {
          var pai = el.parentNode;
          var novoNome = pai.querySelector('[data-campo="nome"]').textContent.trim();
          var novoPreco = parseFloat(pai.querySelector('[data-campo="preco"]').textContent.replace(',', '.')) || 0;
          var atual = linhas.filter(function (s) { return s.id === el.getAttribute('data-servico-id'); })[0];
          db.rpc('tenant_admin_salvar_servico', { p_estabelecimento_id: estabId, p_id: el.getAttribute('data-servico-id'), p_nome: novoNome, p_preco: novoPreco, p_categoria: atual ? atual.categoria : 'unissex' });
        });
      });
      lista.querySelectorAll('[data-remover-servico]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          db.rpc('tenant_admin_remover_servico', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-servico') }).then(carregarServicos);
        });
      });
      var addBtn = document.getElementById('vbAddServicoInst');
      if (addBtn) addBtn.addEventListener('click', function () {
        var nome = window.prompt('Nome do serviço:');
        if (!nome) return;
        var preco = parseFloat(window.prompt('Preço (ex: 45.00):') || '0') || 0;
        db.rpc('tenant_admin_salvar_servico', { p_estabelecimento_id: estabId, p_id: null, p_nome: nome, p_preco: preco, p_categoria: 'unissex' }).then(carregarServicos);
      });
    });
  }

  // ---------- modo admin ----------
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

  function salvarSobre() {
    var texto = document.getElementById('tplSobreTexto').textContent.trim();
    linhaAtual.sobre_texto = texto;
    db.rpc('tenant_admin_atualizar_sobre', { p_estabelecimento_id: estabId, p_sobre_texto: texto });
  }
  function salvarTituloInstitucional() {
    var el = document.getElementById('tplTituloInstitucional');
    var titulo = el.textContent.trim();
    if (!titulo) {
      el.textContent = linhaAtual.titulo_institucional || ('Conheça a ' + linhaAtual.nome);
      return;
    }
    linhaAtual.titulo_institucional = titulo;
    db.rpc('tenant_admin_atualizar_titulo_institucional', { p_estabelecimento_id: estabId, p_titulo: titulo });
  }
  function salvarEndereco() {
    var endereco = document.getElementById('tplEnderecoRodape').textContent.trim();
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

  // conta de verdade logada e dona deste estabelecimento? liga o modo
  // admin direto, sem pedir PIN nenhum (a conta já é a prova de dono).
  function verificarSessaoDono() {
    db.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (session && linhaAtual && session.user.id === linhaAtual.dono_user_id) {
        ativarModoAdmin();
      }
    });
  }

  function ativarModoAdmin() {
    if (modoAdmin) return;
    modoAdmin = true;
    document.body.classList.add('vb-modo-admin');
    document.getElementById('adminModoBarra').classList.remove('oculto');
    var sobre = document.getElementById('tplSobreTexto');
    var endereco = document.getElementById('tplEnderecoRodape');
    var nomeTopo = document.getElementById('tplNomeTopo');
    var tituloInst = document.getElementById('tplTituloInstitucional');
    sobre.setAttribute('contenteditable', 'true');
    endereco.setAttribute('contenteditable', 'true');
    nomeTopo.setAttribute('contenteditable', 'true');
    tituloInst.setAttribute('contenteditable', 'true');
    sobre.addEventListener('blur', salvarSobre);
    endereco.addEventListener('blur', salvarEndereco);
    nomeTopo.addEventListener('blur', salvarNome);
    tituloInst.addEventListener('blur', salvarTituloInstitucional);
    carregarEquipe();
    carregarGaleria();
    carregarServicos();
    carregarRedesSociais();
  }
  function desativarModoAdmin() {
    modoAdmin = false;
    document.body.classList.remove('vb-modo-admin');
    document.getElementById('adminModoBarra').classList.add('oculto');
    document.getElementById('tplSobreTexto').removeAttribute('contenteditable');
    document.getElementById('tplEnderecoRodape').removeAttribute('contenteditable');
    document.getElementById('tplNomeTopo').removeAttribute('contenteditable');
    document.getElementById('tplTituloInstitucional').removeAttribute('contenteditable');
    try { localStorage.removeItem(chaveAdmin()); } catch (e) {}
    carregarEquipe();
    carregarGaleria();
    carregarServicos();
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
      if (jaDesbloqueado || modoAdmin) { ativarModoAdmin(); return; }
      overlay.classList.remove('oculto');
      msg.textContent = '';
      input.value = '';
      input.focus();
    });
    document.getElementById('adminPinCancelar').addEventListener('click', function () { overlay.classList.add('oculto'); });
    function confirmarPin() {
      var pin = input.value.trim();
      if (!pin) return;
      msg.className = 'msg';
      msg.textContent = 'Verificando…';
      db.rpc('tenant_verificar_pin', { p_estabelecimento_id: estabId, p_pin: pin }).then(function (res) {
        if (res.error || !res.data) { msg.className = 'msg msg-erro'; msg.textContent = 'PIN incorreto.'; return; }
        try { localStorage.setItem(chaveAdmin(), '1'); } catch (e) {}
        overlay.classList.add('oculto');
        ativarModoAdmin();
        db.auth.getSession().then(function (sessRes) {
          var session = sessRes.data && sessRes.data.session;
          if (session) db.rpc('tenant_reivindicar_estabelecimento', { p_estabelecimento_id: estabId, p_pin: pin });
        });
      }, function () { msg.className = 'msg msg-erro'; msg.textContent = 'Sem conexão agora.'; });
    }
    document.getElementById('adminPinConfirmar').addEventListener('click', confirmarPin);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmarPin(); });
    document.getElementById('adminSairBtn').addEventListener('click', desativarModoAdmin);
    var corInput = document.getElementById('adminCorInput');
    var corSecundariaInput = document.getElementById('adminCorSecundariaInput');
    corInput.addEventListener('input', function () { aplicarCorDinamica(corInput.value, corSecundariaInput.value); });
    corInput.addEventListener('change', function () { salvarCor(corInput.value, corSecundariaInput.value); });
    corSecundariaInput.addEventListener('input', function () { aplicarCorDinamica(corInput.value, corSecundariaInput.value); });
    corSecundariaInput.addEventListener('change', function () { salvarCor(corInput.value, corSecundariaInput.value); });
  }

  function renderizar(linha) {
    carregando.classList.add('oculto');
    estabId = linha.id;
    linhaAtual = linha;
    aplicarTemplateCss(linha.template);
    aplicarCorDinamica(linha.cor_destaque, linha.cor_secundaria);
    var adminCorInput = document.getElementById('adminCorInput');
    if (adminCorInput) adminCorInput.value = linha.cor_destaque || '#C9A227';
    var adminCorSecundariaInput = document.getElementById('adminCorSecundariaInput');
    if (adminCorSecundariaInput) {
      adminCorSecundariaInput.value = linha.cor_secundaria || rgbParaHex(misturarRgb(hexParaRgbNums(linha.cor_destaque || '#C9A227'), [0, 0, 0], 0.28));
    }

    var base = '/' + encodeURIComponent(slug) + '/' + encodeURIComponent(cidade);
    document.title = linha.nome + ' — Site institucional — VB Agenda';
    document.getElementById('tplNomeTopo').textContent = linha.nome;
    document.getElementById('tplNomeRodape').textContent = linha.nome;
    document.getElementById('tplTituloInstitucional').textContent = linha.titulo_institucional || ('Conheça a ' + linha.nome);
    document.getElementById('tplSobreTexto').textContent = linha.sobre_texto || 'Ainda não escrevemos nossa história aqui — em breve.';
    document.getElementById('tplCidadeRodape').textContent = linha.cidade.charAt(0).toUpperCase() + linha.cidade.slice(1) + '/SP';
    document.getElementById('tplEnderecoMenu').textContent = linha.cidade.charAt(0).toUpperCase() + linha.cidade.slice(1) + '/SP';
    document.getElementById('tplCopyright').textContent = '© ' + new Date().getFullYear() + ' ' + linha.nome + ' — todos os direitos reservados';
    document.getElementById('tplLinkPerfil').href = base;
    document.getElementById('tplLinkInicio').href = base;
    document.getElementById('tplLinkAgenda').href = base + '#agendar';
    document.getElementById('tplBotaoAgendar').href = base + '#agendar';
    document.getElementById('tplBotaoAgendar').textContent = (linha.texto_cta || 'Agendar horário') + ' →';

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

    tpl.classList.remove('oculto');
    carregarEquipe();
    carregarGaleria();
    carregarServicos();
    carregarRedesSociais();
    iniciarModoAdmin();
    var jaDesbloqueado = false;
    try { jaDesbloqueado = localStorage.getItem(chaveAdmin()) === '1'; } catch (e) {}
    if (jaDesbloqueado) ativarModoAdmin();
    verificarSessaoDono();
  }

  db.rpc('buscar_estabelecimento', { p_slug: slug, p_cidade: cidade }).then(function (res) {
    var linha = res.data && res.data[0];
    if (res.error || !linha) { mostrarNaoEncontrado(); return; }
    renderizar(linha);
  }, mostrarNaoEncontrado);
})();
