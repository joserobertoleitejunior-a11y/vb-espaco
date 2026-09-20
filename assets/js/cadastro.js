/* Fluxo de onboarding: login/cadastro de dono (e-mail+senha ou Google)
   e criação do estabelecimento — o coração do "já quero testar criar
   os primeiros dentro desse app". */
(function () {
  if (!window.db) return;

  // Login de verdade: precisa criar conta ou entrar (e-mail+senha, ou
  // Google) pra ver e criar estabelecimentos — a conta (dono_user_id) é
  // o que decide quem é dono de cada site, sem PIN nenhum envolvido.
  var TESTE_SEM_LOGIN = false;

  var authBox = document.getElementById('authBox');
  var painelBox = document.getElementById('painelBox');
  var sairBtn = document.getElementById('sairBtn');
  var authMsg = document.getElementById('authMsg');
  var listaMsg = document.getElementById('listaMsg');
  var listaEl = document.getElementById('listaEstabelecimentos');

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

    db.auth.signInWithPassword({ email: email, password: senha }).then(function (res) {
      btn.disabled = false;
      if (res.error) {
        authMsg.className = 'msg msg-erro';
        authMsg.textContent = res.error.message;
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

  // Criar conta nova com e-mail e senha (alternativa ao Google) — o
  // dono_user_id do estabelecimento vai ser essa conta do mesmo jeito.
  document.getElementById('criarContaBtn').addEventListener('click', function () {
    var email = document.getElementById('authEmail').value.trim();
    var senha = document.getElementById('authSenha').value;
    var btn = document.getElementById('criarContaBtn');
    if (!email || !senha) {
      authMsg.className = 'msg msg-erro';
      authMsg.textContent = 'Preencha e-mail e senha pra criar a conta.';
      return;
    }
    if (senha.length < 6) {
      authMsg.className = 'msg msg-erro';
      authMsg.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
      return;
    }
    btn.disabled = true;
    authMsg.className = 'msg';
    authMsg.textContent = 'Criando sua conta…';

    db.auth.signUp({ email: email, password: senha }).then(function (res) {
      btn.disabled = false;
      if (res.error) {
        authMsg.className = 'msg msg-erro';
        authMsg.textContent = res.error.message;
        return;
      }
      if (res.data && res.data.session) {
        authMsg.textContent = '';
        mostrarPainel();
        return;
      }
      // projeto configurado pra exigir confirmação por e-mail antes de liberar sessão
      authMsg.className = 'msg msg-ok';
      authMsg.textContent = 'Conta criada! Confira seu e-mail pra confirmar antes de entrar.';
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
        var fotoAvatar = e.foto_perfil_url || e.foto_hero_url;
        var avatarConteudo = fotoAvatar
          ? '<span class="dash-card-avatar-foto"' + (fotoAvatar === fotoTopo ? ' data-alinhar-topo="' + fotoAvatar + '"' : ' style="background-image:url(\'' + fotoAvatar + '\');"') + '></span>'
          : escapeHtml(iniciais(e.nome));
        var moldura = e.moldura_foto || 'simples';
        var trialData = e.trial_termina_em ? new Date(e.trial_termina_em + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        var faltando = [];
        if (!e.total_servicos) faltando.push('nenhum serviço');
        if (!e.total_equipe) faltando.push('nenhum profissional');
        var configPendenteHtml = faltando.length
          ? '<div class="dash-card-config-pendente">' +
            '<p>Seu site ainda está escondido de quem visita: falta cadastrar ' + faltando.join(' e ') + '. Clique em "Editar meu site →" — como você já está logado na sua conta, o modo admin abre direto.</p>' +
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
          '<span class="dash-card-avatar-anel moldura-' + moldura + '" style="--avatar-cor:' + cor + ';">' +
          '<span class="dash-card-avatar" style="background:' + cor + ';">' + avatarConteudo + '</span>' +
          '</span>' +
          '</div>' +
          '<div class="dash-card-corpo">' +
          '<span class="nome">' + escapeHtml(e.nome) + '</span><br><span class="cidade">' + escapeHtml(e.cidade) + '</span>' +
          '<div class="dash-card-stats"><span><strong>' + (e.total_agendamentos || 0) + '</strong> agendamento(s)</span><span><strong>' + (e.total_servicos || 0) + '</strong> serviço(s)</span><span><strong>' + (e.total_equipe || 0) + '</strong> profissional(is)</span></div>' +
          '<div class="dash-card-acessos">' +
          '<span>👁 <strong>' + (e.total_acessos || 0) + '</strong> acesso(s) ao site</span>' +
          '<label class="dash-card-acessos-toggle"><input type="checkbox" data-toggle-contador-id="' + e.id + '"' + (e.mostrar_contador_publico ? ' checked' : '') + '> Mostrar pro público</label>' +
          '</div>' +
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
      alinharFotosDuplicadas();
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

  // mesma lógica do catálogo: quando o avatar cai na mesma foto da capa
  // (sem foto de perfil própria), alinha o recorte do avatar com o
  // recorte exato que já aparece atrás dele, em vez de recortar cada um
  // do seu jeito (o que parecia um corte no meio da imagem).
  function alinharFotosDuplicadas() {
    listaEl.querySelectorAll('[data-alinhar-topo]').forEach(function (avatarFotoEl) {
      var card = avatarFotoEl.closest('.dash-card');
      var topoEl = card && card.querySelector('.dash-card-topo');
      var url = avatarFotoEl.getAttribute('data-alinhar-topo');
      if (!topoEl || !url) return;
      var img = new Image();
      img.onload = function () {
        var topoRect = topoEl.getBoundingClientRect();
        var avatarRect = avatarFotoEl.getBoundingClientRect();
        if (!topoRect.width || !avatarRect.width || !img.naturalWidth) return;
        var escala = Math.max(topoRect.width / img.naturalWidth, topoRect.height / img.naturalHeight);
        var largura = img.naturalWidth * escala;
        var altura = img.naturalHeight * escala;
        var offX = (topoRect.width - largura) / 2;
        var offY = (topoRect.height - altura) / 2;
        var deltaX = avatarRect.left - topoRect.left;
        var deltaY = avatarRect.top - topoRect.top;
        avatarFotoEl.style.backgroundImage = "url('" + url + "')";
        avatarFotoEl.style.backgroundSize = largura + 'px ' + altura + 'px';
        avatarFotoEl.style.backgroundPosition = (offX - deltaX) + 'px ' + (offY - deltaY) + 'px';
      };
      img.src = url;
    });
  }

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
    window.VBDialogo.confirm('Apagar "' + nome + '" de vez? Não tem como desfazer — some o site, os serviços, a equipe e a agenda dele.').then(function (ok) {
      if (!ok) return;
      btn.disabled = true;
      db.rpc('admin_apagar_estabelecimento', { p_id: btn.getAttribute('data-apagar-id') }).then(function (res) {
        if (res.error) {
          btn.disabled = false;
          window.VBDialogo.alert('Não deu pra apagar: ' + res.error.message);
          return;
        }
        carregarEstabelecimentos();
      }, function () {
        btn.disabled = false;
        window.VBDialogo.alert('Sem conexão agora — tenta de novo em instantes.');
      });
    });
  });

  function mostrarPainel() {
    authBox.classList.add('oculto');
    painelBox.classList.remove('oculto');
    sairBtn.classList.remove('oculto');
    carregarEstabelecimentos();
  }

  // O Google/Supabase manda erro de volta pela própria URL (hash ou
  // query), tipo ?error=... ou #error=access_denied&error_description=...
  // Sem isso, a tela só voltava pro login calada, sem dizer o motivo.
  (function mostrarErroDoRedirect() {
    var hash = window.location.hash ? new URLSearchParams(window.location.hash.slice(1)) : null;
    var query = new URLSearchParams(window.location.search);
    var erro = (hash && hash.get('error_description')) || query.get('error_description') ||
      (hash && hash.get('error')) || query.get('error');
    if (erro) {
      authMsg.className = 'msg msg-erro';
      authMsg.textContent = decodeURIComponent(erro).replace(/\+/g, ' ');
      history.replaceState(null, '', window.location.pathname);
    }
  })();

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
