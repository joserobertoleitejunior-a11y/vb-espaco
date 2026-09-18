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
    outro: 'Estabelecimento'
  };

  var COPY = {
    masculino: { headline: 'Seu estilo, sem complicação.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
    feminino: { headline: 'Sua beleza merece hora marcada.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' }
  };

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

  function ativarModoAdmin() {
    if (modoAdmin) return;
    modoAdmin = true;
    document.body.classList.add('vb-modo-admin');
    document.getElementById('adminModoBarra').classList.remove('oculto');
    var titulo = document.getElementById('tplHeadline');
    var sub = document.getElementById('tplSubcopy');
    titulo.setAttribute('contenteditable', 'true');
    sub.setAttribute('contenteditable', 'true');
    titulo.addEventListener('blur', salvarTextoHero);
    sub.addEventListener('blur', salvarTextoHero);
    document.getElementById('tplHeroFoto').addEventListener('click', abrirEditorHero);
    carregarServicos();
    carregarGaleria();
  }

  function desativarModoAdmin() {
    modoAdmin = false;
    document.body.classList.remove('vb-modo-admin');
    document.getElementById('adminModoBarra').classList.add('oculto');
    document.getElementById('tplHeadline').removeAttribute('contenteditable');
    document.getElementById('tplSubcopy').removeAttribute('contenteditable');
    try { localStorage.removeItem(chaveAdmin()); } catch (e) {}
    carregarServicos();
    carregarGaleria();
  }

  function iniciarModoAdmin() {
    var overlay = document.getElementById('adminPinOverlay');
    var input = document.getElementById('adminPinInput');
    var msg = document.getElementById('adminPinMsg');

    document.getElementById('menuAdminLink').addEventListener('click', function (e) {
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
    heroFoto.style.backgroundImage = 'url("' + (fotoHero || boiseriePlaceholder(linhaAtual.cor_destaque)) + '")';

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

  function iniciarGenero() {
    if (linhaAtual.genero_atendimento !== 'ambos') {
      document.getElementById('genderGate').remove();
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

  function carregarServicos() {
    var lista = document.getElementById('tplListaServicos');
    var select = document.getElementById('agServico');
    var strip = document.getElementById('tplServiceStrip');
    db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      strip.innerHTML =
        '<button type="button" class="service-badge" onclick="document.getElementById(\'agendarSecao\').scrollIntoView({behavior:\'smooth\'})"><span class="mark">' + ICONE_TESOURA + '</span><strong>Ver</strong><span>Serviços</span></button>' +
        '<a href="#agendarSecao" class="service-badge"><span class="mark">' + ICONE_AGENDA + '</span><strong>Agendar</strong><span>Horário</span></a>';

      if (!linhas.length && !modoAdmin) {
        lista.innerHTML = '<li style="border:none; color:var(--ink-soft);">Serviços em breve.</li>';
        select.innerHTML = '<option value="">Nenhum serviço cadastrado ainda</option>';
        select.disabled = true;
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

      select.innerHTML = linhas.length ? linhas.map(function (s) {
        return '<option value="' + escapeHtml(s.nome) + '">' + escapeHtml(s.nome) + ' — ' + formatarPreco(s.preco) + '</option>';
      }).join('') : '<option value="">Nenhum serviço cadastrado ainda</option>';
      select.disabled = !linhas.length;
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

  document.getElementById('formAgendar').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = document.getElementById('agendarMsg');
    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    msg.className = 'msg';
    msg.textContent = 'Agendando…';

    var dia = document.getElementById('agDia').value;
    var dataObj = dia ? new Date(dia + 'T00:00:00') : null;
    var diaLabel = dataObj ? dataObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : dia;

    db.rpc('tenant_criar_agendamento', {
      p_estabelecimento_id: estabId,
      p_cliente_nome: document.getElementById('agNome').value.trim(),
      p_cliente_telefone: document.getElementById('agTelefone').value.trim(),
      p_staff_id: null,
      p_staff_nome: null,
      p_servico: document.getElementById('agServico').value || null,
      p_dia: dia,
      p_dia_label: diaLabel,
      p_horario: document.getElementById('agHorario').value
    }).then(function (res) {
      btn.disabled = false;
      if (res.error) {
        msg.className = 'msg msg-erro';
        msg.textContent = res.error.message;
        return;
      }
      msg.className = 'msg msg-ok';
      msg.textContent = 'Agendamento confirmado! ✓';
      document.getElementById('formAgendar').reset();
    }, function () {
      btn.disabled = false;
      msg.className = 'msg msg-erro';
      msg.textContent = 'Sem conexão agora — tenta de novo em instantes.';
    });
  });

  function renderizar(linha) {
    carregando.classList.add('oculto');
    estabId = linha.id;
    linhaAtual = linha;

    document.title = linha.nome + ' — VB Agenda';
    document.getElementById('tplNomeTopo').textContent = linha.nome;
    document.getElementById('tplNomeRodape').textContent = linha.nome;
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
      var wa = document.getElementById('whatsappBtn');
      wa.href = 'https://wa.me/55' + tel;
      wa.classList.remove('oculto');
    } else {
      document.getElementById('tplTelefoneMenu').closest('p').style.display = 'none';
    }

    tpl.classList.remove('oculto');
    iniciarGenero();
    carregarServicos();
    carregarGaleria();
    iniciarModoAdmin();
    var jaDesbloqueado = false;
    try { jaDesbloqueado = localStorage.getItem(chaveAdmin()) === '1'; } catch (e) {}
    if (jaDesbloqueado) ativarModoAdmin();
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
