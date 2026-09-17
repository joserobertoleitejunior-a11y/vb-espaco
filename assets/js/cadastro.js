/* Fluxo de onboarding: login/cadastro de dono (e-mail+senha ou Google)
   e criação do estabelecimento — o coração do "já quero testar criar
   os primeiros dentro desse app". */
(function () {
  if (!window.db) return;

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

  function carregarEstabelecimentos() {
    listaEl.innerHTML = '<li><span class="skeleton" style="width:70%;"></span></li>';
    db.rpc('meus_estabelecimentos').then(function (res) {
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
        return '<li>' +
          '<span><span class="nome">' + escapeHtml(e.nome) + '</span><br>' +
          '<span class="cidade">' + escapeHtml(e.cidade) + '</span></span>' +
          '<a class="btn btn-ghost" style="padding:0.5rem 0.9rem; font-size:0.85rem;" href="' + link + '" target="_blank" rel="noopener">Ver perfil →</a>' +
          '</li>';
      }).join('');
    }, function () {
      listaEl.innerHTML = '';
      listaMsg.className = 'msg msg-erro';
      listaMsg.textContent = 'Sem conexão agora — tenta de novo em instantes.';
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

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
      p_telefone_whatsapp: document.getElementById('estabWhatsapp').value.trim() || null
    }).then(function (res) {
      btn.disabled = false;
      if (res.error) {
        estabMsg.className = 'msg msg-erro';
        estabMsg.textContent = res.error.message.indexOf('duplicate') > -1 || res.error.message.indexOf('unique') > -1
          ? 'Já existe um estabelecimento com esse link nessa cidade — tenta mudar o nome ou o link.'
          : res.error.message;
        return;
      }
      estabMsg.className = 'msg msg-ok';
      estabMsg.textContent = 'Estabelecimento criado! Já aparece na lista acima.';
      document.getElementById('estabForm').reset();
      document.getElementById('estabCidade').value = 'Itapetininga';
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

  db.auth.getSession().then(function (res) {
    if (res.data && res.data.session) mostrarPainel();
  });
})();
