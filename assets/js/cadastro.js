/* Fluxo de onboarding: login/cadastro de dono (e-mail+senha ou Google)
   e criação do estabelecimento — o coração do "já quero testar criar
   os primeiros dentro desse app". */
(function () {
  if (!window.db) return;

  // Login de verdade: precisa criar conta ou entrar (e-mail+senha, ou
  // Google) pra ver e criar estabelecimentos — a conta é o que decide
  // quem é dono de cada site (ver tenant_reivindicar_estabelecimento).
  var TESTE_SEM_LOGIN = false;

  var authBox = document.getElementById('authBox');
  var painelBox = document.getElementById('painelBox');
  var sairBtn = document.getElementById('sairBtn');
  var authMsg = document.getElementById('authMsg');
  var listaMsg = document.getElementById('listaMsg');
  var listaEl = document.getElementById('listaEstabelecimentos');

  var modoCriarConta = false;

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
    estetica_automotiva: 'Estética automotiva',
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
        var fotoTopo = e.foto_capa_url || e.foto_hero_url;
        var topoStyle = fotoTopo
          ? "background-image:linear-gradient(0deg, rgba(0,0,0,.25), rgba(0,0,0,.05)), url('" + fotoTopo + "');"
          : 'background-image:linear-gradient(135deg,' + cor + ',' + cor + 'cc);';
        var avatarConteudo = e.foto_perfil_url
          ? '<span class="dash-card-avatar-foto" style="background-image:url(\'' + e.foto_perfil_url + '\');"></span>'
          : escapeHtml(iniciais(e.nome));
        var trialData = e.trial_termina_em ? new Date(e.trial_termina_em + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        var faltando = [];
        if (!e.total_servicos) faltando.push('nenhum serviço');
        if (!e.total_equipe) faltando.push('nenhum profissional');
        var configPendenteHtml = faltando.length
          ? '<div class="dash-card-config-pendente">' +
            '<p>Seu site ainda está escondido de quem visita: falta cadastrar ' + faltando.join(' e ') + '. Entre no site (Ver site →) e use o menu ☰ → Admin com o PIN acima pra completar.</p>' +
            '</div>'
          : '';
        var pagamentoHtml = e.forma_pagamento
          ? '<div class="dash-card-pagamento">Forma de pagamento: <strong>' + (e.forma_pagamento === 'pix' ? 'Pix' : 'Cartão de crédito') + '</strong> — cobrança automática ainda será ativada, por enquanto seu acesso segue liberado.</div>'
          : '<div class="dash-card-pagamento dash-card-pagamento-pendente">' +
            '<p>1º mês grátis' + (trialData ? ' até ' + trialData : '') + '. Depois, R$ 39,90/mês. Escolha como prefere pagar:</p>' +
            '<div class="dash-card-acoes">' +
            '<button type="button" class="btn btn-ghost" data-forma-pagamento-id="' + e.id + '" data-forma="pix" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Pix</button>' +
            '<button type="button" class="btn btn-ghost" data-forma-pagamento-id="' + e.id + '" data-forma="cartao" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Cartão de crédito</button>' +
            '</div></div>';
        return '<li class="dash-card">' +
          '<div class="dash-card-topo" style="' + topoStyle + '">' +
          '<span class="dash-card-segmento">' + escapeHtml(SEGMENTOS_LABEL[e.segmento] || 'Estabelecimento') + '</span>' +
          '<span class="dash-card-avatar" style="background:' + cor + ';">' + avatarConteudo + '</span>' +
          '</div>' +
          '<div class="dash-card-corpo">' +
          '<span class="nome">' + escapeHtml(e.nome) + '</span><br><span class="cidade">' + escapeHtml(e.cidade) + '</span>' +
          '<div class="dash-card-stats"><span><strong>' + (e.total_agendamentos || 0) + '</strong> agendamento(s)</span><span><strong>' + (e.total_servicos || 0) + '</strong> serviço(s)</span><span><strong>' + (e.total_equipe || 0) + '</strong> profissional(is)</span></div>' +
          '<div class="dash-card-acessos">' +
          '<span>👁 <strong>' + (e.total_acessos || 0) + '</strong> acesso(s) ao site</span>' +
          '<label class="dash-card-acessos-toggle"><input type="checkbox" data-toggle-contador-id="' + e.id + '"' + (e.mostrar_contador_publico ? ' checked' : '') + '> Mostrar pro público</label>' +
          '</div>' +
          '<div class="dash-card-pin">PIN de admin do site: <strong>' + escapeHtml(e.admin_pin || '----') + '</strong></div>' +
          configPendenteHtml +
          pagamentoHtml +
          '<div class="dash-card-acoes">' +
          '<a class="btn btn-ghost" style="padding:0.5rem 0.9rem; font-size:0.85rem;" href="' + link + '" target="_blank" rel="noopener">Ver site →</a>' +
          '<a class="btn btn-ghost" style="padding:0.5rem 0.9rem; font-size:0.85rem;" href="' + link + '">Editar meu site →</a>' +
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

  listaEl.addEventListener('change', function (e) {
    var caixa = e.target.closest('[data-toggle-contador-id]');
    if (!caixa) return;
    db.rpc('tenant_admin_alternar_contador_publico', {
      p_estabelecimento_id: caixa.getAttribute('data-toggle-contador-id'),
      p_mostrar: caixa.checked
    });
  });

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
  function iniciais(nome) {
    var partes = (nome || '').trim().split(/\s+/);
    return ((partes[0] || '')[0] || '').toUpperCase() + ((partes[1] || '')[0] || '').toUpperCase();
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
    // cobre o retorno do login do Google (a sessão só fica pronta
    // depois que o supabase-js processa o redirect) e o logout.
    db.auth.onAuthStateChange(function (evento, session) {
      if (session) mostrarPainel();
      else if (evento === 'SIGNED_OUT') window.location.reload();
    });
  }
})();
