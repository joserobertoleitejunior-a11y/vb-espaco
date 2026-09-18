/* Fluxo de onboarding: login/cadastro de dono (e-mail+senha ou Google)
   e criação do estabelecimento — o coração do "já quero testar criar
   os primeiros dentro desse app". */
(function () {
  if (!window.db) return;

  // TEMPORÁRIO — testando o motor de criação de estabelecimento sem
  // exigir login (Google/e-mail ainda não configurados de verdade).
  // Trocar pra false assim que o login estiver pronto pra valer.
  var TESTE_SEM_LOGIN = true;

  // veio do botão "Criar uma loja assim" no catálogo? guarda pra usar
  // na hora de criar o estabelecimento.
  var templateEscolhido = new URLSearchParams(window.location.search).get('template') || 'classico-boiserie';

  var TEMPLATES_DISPONIVEIS = [
    { chave: 'classico-boiserie', nome: 'Clássico', preview: 'linear-gradient(135deg,#FAF7F1,#C9A227)' },
    { chave: 'claro-minimal', nome: 'Claro', preview: 'linear-gradient(135deg,#FFFFFF,#1F8A6E)' },
    { chave: 'escuro-premium', nome: 'Escuro', preview: 'linear-gradient(135deg,#121212,#D9AE55)' },
    { chave: 'automotivo-carbono', nome: 'Automotivo', preview: 'linear-gradient(135deg,#15161A,#D8342A)' }
  ];
  var templateEscolhaEl = document.getElementById('estabTemplateEscolha');
  function renderizarTemplateEscolha() {
    templateEscolhaEl.innerHTML = TEMPLATES_DISPONIVEIS.map(function (t) {
      return '<button type="button" class="tpl-swatch-card' + (t.chave === templateEscolhido ? ' is-selecionado' : '') + '" data-template="' + t.chave + '">' +
        '<div class="tpl-swatch-preview" style="background:' + t.preview + ';"></div>' +
        '<span class="tpl-swatch-nome">' + t.nome + '</span>' +
        '</button>';
    }).join('');
  }
  renderizarTemplateEscolha();
  templateEscolhaEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-template]');
    if (!btn) return;
    templateEscolhido = btn.getAttribute('data-template');
    renderizarTemplateEscolha();
  });

  var authBox = document.getElementById('authBox');
  var painelBox = document.getElementById('painelBox');
  var sairBtn = document.getElementById('sairBtn');
  var authMsg = document.getElementById('authMsg');
  var estabMsg = document.getElementById('estabMsg');
  var listaMsg = document.getElementById('listaMsg');
  var listaEl = document.getElementById('listaEstabelecimentos');

  var modoCriarConta = false;

  var MAPA_ACENTOS = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c', 'ñ': 'n'
  };
  function removerAcentos(texto) {
    var resultado = '';
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      resultado += MAPA_ACENTOS[c] || c;
    }
    return resultado;
  }
  function slugificar(texto) {
    return removerAcentos((texto || '').toLowerCase())
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  document.getElementById('estabNome').addEventListener('input', function () {
    document.getElementById('estabSlug').value = slugificar(this.value);
  });

  // ---- foto principal (hero) na hora de criar: upload ou estoque ----
  var heroEscolhidoUrl = null;
  var pastaFotoTemporaria = window.VBUpload ? window.VBUpload.novaPastaTemporaria() : 'novo-' + Date.now();
  var ESTOQUE_FOTOS_CADASTRO = [
    { url: '/assets/tpl-classico/img/estoque/hero-masculino-1.jpg', legenda: 'Studio dourado' },
    { url: '/assets/tpl-classico/img/estoque/hero-feminino-1.jpg', legenda: 'Salão rosé' },
    { url: '/assets/tpl-classico/img/estoque/fachada-1.jpg', legenda: 'Fachada clássica' }
  ];
  var estoqueEl = document.getElementById('estabHeroEstoque');
  if (estoqueEl) {
    estoqueEl.innerHTML = ESTOQUE_FOTOS_CADASTRO.map(function (f) {
      return '<img src="' + f.url + '" data-estoque-url="' + f.url + '" title="' + f.legenda + '" alt="' + f.legenda + '" style="width:72px; height:72px; object-fit:cover; border-radius:8px; cursor:pointer; border:2px solid transparent;">';
    }).join('');
    estoqueEl.addEventListener('click', function (e) {
      var img = e.target.closest('[data-estoque-url]');
      if (!img) return;
      heroEscolhidoUrl = img.getAttribute('data-estoque-url');
      document.getElementById('heroPreviewCadastro').style.backgroundImage = "url('" + heroEscolhidoUrl + "')";
    });
    document.getElementById('estabHeroUpload').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file || !window.VBUpload) return;
      estabMsg.className = 'msg';
      estabMsg.textContent = 'Enviando foto…';
      window.VBUpload.uploadFoto(file, pastaFotoTemporaria, 'hero').then(function (url) {
        heroEscolhidoUrl = url;
        document.getElementById('heroPreviewCadastro').style.backgroundImage = "url('" + url + "')";
        estabMsg.textContent = '';
      }, function (err) {
        estabMsg.className = 'msg msg-erro';
        estabMsg.textContent = err.message || 'Falha ao enviar a foto.';
      });
    });
  }

  document.getElementById('criarContaLink').addEventListener('click', function (e) {
    e.preventDefault();
    modoCriarConta = !modoCriarConta;
    document.getElementById('entrarBtn').textContent = modoCriarConta ? 'Criar conta' : 'Entrar';
    this.textContent = modoCriarConta ? 'Já tenho conta' : 'Criar agora';
    authMsg.textContent = '';
  });

  document.getElementById('googleBtn').addEventListener('click', function () {
    db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/cadastro.html' }
    });
  });

  document.getElementById('emailForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('authEmail').value.trim();
    var senha = document.getElementById('authSenha').value;
    var btn = document.getElementById('entrarBtn');
    btn.disabled = true;
    authMsg.className = 'msg';
    authMsg.textContent = 'Um instante…';

    var acao = modoCriarConta
      ? db.auth.signUp({ email: email, password: senha })
      : db.auth.signInWithPassword({ email: email, password: senha });

    acao.then(function (res) {
      btn.disabled = false;
      if (res.error) {
        authMsg.className = 'msg msg-erro';
        authMsg.textContent = res.error.message;
        return;
      }
      if (modoCriarConta && res.data && res.data.user && !res.data.session) {
        authMsg.className = 'msg msg-ok';
        authMsg.textContent = 'Conta criada! Confira seu e-mail pra confirmar antes de entrar.';
        return;
      }
      authMsg.textContent = '';
      mostrarPainel();
    }, function () {
      btn.disabled = false;
      authMsg.className = 'msg msg-erro';
      authMsg.textContent = 'Sem conexão agora — tenta de novo em instantes.';
    });
  });

  sairBtn.addEventListener('click', function () {
    db.auth.signOut().then(function () {
      window.location.reload();
    });
  });

  var SEGMENTOS_LABEL = {
    barbearia: 'Barbearia',
    salao: 'Salão de beleza',
    manicure_pedicure: 'Manicure e pedicure',
    estetica: 'Estética',
    outro: 'Estabelecimento'
  };

  function carregarEstabelecimentos() {
    listaEl.innerHTML = '<li><span class="skeleton" style="width:70%;"></span></li>';
    db.rpc('meus_estabelecimentos_com_stats').then(function (res) {
      if (res.error) {
        listaMsg.className = 'msg msg-erro';
        listaMsg.textContent = res.error.message;
        listaEl.innerHTML = '';
        return;
      }
      var linhas = res.data || [];
      if (!linhas.length) {
        listaEl.innerHTML = '';
        listaMsg.textContent = 'Nenhum estabelecimento cadastrado ainda.';
        return;
      }
      listaMsg.textContent = '';
      listaEl.innerHTML = linhas.map(function (e) {
        var link = '/' + encodeURIComponent(e.slug) + '/' + encodeURIComponent(e.cidade);
        var cor = e.cor_destaque || '#C9A227';
        var topoStyle = e.foto_hero_url
          ? "background-image:url('" + e.foto_hero_url + "');"
          : 'background-image:linear-gradient(135deg,' + cor + ',' + cor + 'cc);';
        var trialData = e.trial_termina_em ? new Date(e.trial_termina_em + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        var pagamentoHtml = e.forma_pagamento
          ? '<div class="dash-card-pagamento">Forma de pagamento: <strong>' + (e.forma_pagamento === 'pix' ? 'Pix' : 'Cartão de crédito') + '</strong> — cobrança automática ainda será ativada, por enquanto seu acesso segue liberado.</div>'
          : '<div class="dash-card-pagamento dash-card-pagamento-pendente">' +
            '<p>1º mês grátis' + (trialData ? ' até ' + trialData : '') + '. Depois, R$ 39,90/mês. Escolha como prefere pagar:</p>' +
            '<div class="dash-card-acoes">' +
            '<button type="button" class="btn btn-ghost" data-forma-pagamento-id="' + e.id + '" data-forma="pix" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Pix</button>' +
            '<button type="button" class="btn btn-ghost" data-forma-pagamento-id="' + e.id + '" data-forma="cartao" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Cartão de crédito</button>' +
            '</div></div>';
        return '<li class="dash-card">' +
          '<div class="dash-card-topo" style="' + topoStyle + '"><span class="dash-card-segmento">' + escapeHtml(SEGMENTOS_LABEL[e.segmento] || 'Estabelecimento') + '</span></div>' +
          '<div class="dash-card-corpo">' +
          '<span class="nome">' + escapeHtml(e.nome) + '</span><br><span class="cidade">' + escapeHtml(e.cidade) + '</span>' +
          '<div class="dash-card-stats"><span><strong>' + (e.total_agendamentos || 0) + '</strong> agendamento(s)</span><span><strong>' + (e.total_servicos || 0) + '</strong> serviço(s)</span></div>' +
          '<div class="dash-card-pin">PIN de admin do site: <strong>' + escapeHtml(e.admin_pin || '----') + '</strong></div>' +
          pagamentoHtml +
          '<div class="dash-card-acoes">' +
          '<a class="btn btn-ghost" style="padding:0.5rem 0.9rem; font-size:0.85rem;" href="' + link + '" target="_blank" rel="noopener">Ver site →</a>' +
          '<a class="btn btn-ghost" style="padding:0.5rem 0.9rem; font-size:0.85rem;" href="editar.html?id=' + encodeURIComponent(e.id) + '">Editar</a>' +
          '<button class="btn btn-ghost" type="button" style="padding:0.5rem 0.9rem; font-size:0.85rem; color:var(--erro); border-color:var(--erro);" data-apagar-id="' + e.id + '" data-apagar-nome="' + escapeHtml(e.nome) + '">Apagar</button>' +
          '</div>' +
          '</div>' +
          '</li>';
      }).join('');
    }, function () {
      listaEl.innerHTML = '';
      listaMsg.className = 'msg msg-erro';
      listaMsg.textContent = 'Sem conexão agora — tenta de novo em instantes.';
    });
  }

  listaEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-forma-pagamento-id]');
    if (!btn) return;
    btn.closest('.dash-card-acoes').querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    db.rpc('tenant_cadastrar_forma_pagamento', {
      p_estabelecimento_id: btn.getAttribute('data-forma-pagamento-id'),
      p_forma_pagamento: btn.getAttribute('data-forma')
    }).then(carregarEstabelecimentos);
  });

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Botão de apagar site — só pro admin por enquanto (sem senha ainda,
  // fica pra depois). Apaga de verdade, sem volta.
  listaEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-apagar-id]');
    if (!btn) return;
    var nome = btn.getAttribute('data-apagar-nome');
    if (!window.confirm('Apagar "' + nome + '" de vez? Não tem como desfazer — some o site, os serviços, a equipe e a agenda dele.')) return;
    btn.disabled = true;
    db.rpc('admin_apagar_estabelecimento', { p_id: btn.getAttribute('data-apagar-id') }).then(function (res) {
      if (res.error) {
        btn.disabled = false;
        window.alert('Não deu pra apagar: ' + res.error.message);
        return;
      }
      carregarEstabelecimentos();
    }, function () {
      btn.disabled = false;
      window.alert('Sem conexão agora — tenta de novo em instantes.');
    });
  });

  document.getElementById('estabForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = document.getElementById('criarEstabBtn');
    btn.disabled = true;
    estabMsg.className = 'msg';
    estabMsg.textContent = 'Criando…';

    db.rpc('criar_estabelecimento', {
      p_nome: document.getElementById('estabNome').value.trim(),
      p_slug: document.getElementById('estabSlug').value.trim(),
      p_cidade: document.getElementById('estabCidade').value.trim(),
      p_segmento: document.getElementById('estabSegmento').value,
      p_telefone_whatsapp: document.getElementById('estabWhatsapp').value.trim() || null,
      p_template: templateEscolhido,
      p_foto_hero_url: heroEscolhidoUrl
    }).then(function (res) {
      btn.disabled = false;
      if (res.error) {
        estabMsg.className = 'msg msg-erro';
        estabMsg.textContent = res.error.message.indexOf('duplicate') > -1 || res.error.message.indexOf('unique') > -1
          ? 'Já existe um estabelecimento com esse link nessa cidade — tenta mudar o nome ou o link.'
          : res.error.message;
        return;
      }
      var pin = res.data && res.data.admin_pin;
      estabMsg.className = 'msg msg-ok';
      estabMsg.textContent = pin
        ? 'Estabelecimento criado! Seu PIN de admin é ' + pin + ' — guarde bem, é ele que abre o modo de edição no site (menu ☰ → Admin).'
        : 'Estabelecimento criado! Já aparece na lista acima.';
      document.getElementById('estabForm').reset();
      document.getElementById('estabCidade').value = 'Itapetininga';
      heroEscolhidoUrl = null;
      document.getElementById('heroPreviewCadastro').style.backgroundImage = 'none';
      pastaFotoTemporaria = window.VBUpload ? window.VBUpload.novaPastaTemporaria() : 'novo-' + Date.now();
      carregarEstabelecimentos();
    }, function () {
      btn.disabled = false;
      estabMsg.className = 'msg msg-erro';
      estabMsg.textContent = 'Sem conexão agora — tenta de novo em instantes.';
    });
  });

  function mostrarPainel() {
    authBox.classList.add('oculto');
    painelBox.classList.remove('oculto');
    sairBtn.classList.remove('oculto');
    carregarEstabelecimentos();
  }

  if (TESTE_SEM_LOGIN) {
    mostrarPainel();
    sairBtn.classList.add('oculto');
  } else {
    db.auth.getSession().then(function (res) {
      if (res.data && res.data.session) mostrarPainel();
    });
  }
})();
