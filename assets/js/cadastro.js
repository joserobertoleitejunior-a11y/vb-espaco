/* Fluxo de onboarding: login/cadastro de dono (e-mail+senha ou Google)
   e criação do estabelecimento — o coração do "já quero testar criar
   os primeiros dentro desse app". */
(function () {
  if (!window.db) return;

  // Ação de escrita com suporte offline: tenta a rede, e só cai na fila
  // local (vb-offline.js) se a falha for de conectividade — nunca perde
  // uma venda/agendamento por falta de internet, nem finge sucesso.
  // Retorna sempre { offline, res } — quando offline, "res" não existe
  // ainda (só vai existir de verdade quando a fila sincronizar).
  function chamarComFila(rpcNome, params, descricao) {
    return window.VBOffline
      ? window.VBOffline.executarOuEnfileirar(rpcNome, params, descricao)
      : db.rpc(rpcNome, params).then(function (res) { return { offline: false, res: res }; });
  }
  function chamarVendaComFila(params) {
    return chamarComFila('tenant_admin_registrar_venda', params, 'Venda: ' + params.p_descricao);
  }

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
  var topbarIcones = document.getElementById('topbarIcones');
  var offlineBtn = document.getElementById('offlineBtn');
  var offlineBadge = document.getElementById('offlineBadge');
  var offlineDropdown = document.getElementById('offlineDropdown');
  var offlineEl = document.getElementById('offlineDropdownConteudo');
  var notifBtn = document.getElementById('notifBtn');
  var notifBadge = document.getElementById('notifBadge');
  var notifDropdown = document.getElementById('notifDropdown');
  var notificacoesEl = document.getElementById('notifDropdownConteudo');
  var menuBtn = document.getElementById('menuBtn');
  var menuDropdown = document.getElementById('menuDropdown');
  var topbarMenuEmail = document.getElementById('topbarMenuEmail');

  // ---- dropdowns do topbar (offline, notificações e menu): só um aberto
  // por vez, fecha ao clicar fora ou apertar Esc — mesmo padrão de
  // qualquer dropdown nativo, sem framework nenhum. ----
  function fecharDropdown(btn, dropdown) {
    if (dropdown.classList.contains('oculto')) return;
    dropdown.classList.remove('is-aberto');
    btn.setAttribute('aria-expanded', 'false');
    setTimeout(function () { dropdown.classList.add('oculto'); }, 160);
  }
  function fecharDropdowns() {
    fecharDropdown(offlineBtn, offlineDropdown);
    fecharDropdown(notifBtn, notifDropdown);
    fecharDropdown(menuBtn, menuDropdown);
  }
  function alternarDropdown(btn, dropdown) {
    var abrindo = dropdown.classList.contains('oculto');
    fecharDropdowns();
    if (abrindo) {
      dropdown.classList.remove('oculto');
      // remove o "oculto" (display:none) num frame e só depois liga a
      // classe que anima opacidade/posição — sem isso a transição não
      // roda (não dá pra animar a partir de display:none).
      requestAnimationFrame(function () {
        dropdown.classList.add('is-aberto');
        btn.setAttribute('aria-expanded', 'true');
      });
    }
  }
  offlineBtn.addEventListener('click', function (e) { e.stopPropagation(); alternarDropdown(offlineBtn, offlineDropdown); });
  notifBtn.addEventListener('click', function (e) { e.stopPropagation(); alternarDropdown(notifBtn, notifDropdown); });
  menuBtn.addEventListener('click', function (e) { e.stopPropagation(); alternarDropdown(menuBtn, menuDropdown); });

  // ---- fila offline: badge com quantidade pendente + lista no dropdown,
  // com botão de "tentar de novo" pro item que ficou com problema de
  // verdade (não é falta de rede) e "descartar" pra desistir dele. ----
  function atualizarOfflineBarra(fila) {
    if (!offlineBtn) return;
    var pendentes = fila || [];
    if (!pendentes.length) {
      offlineBtn.classList.add('oculto');
      return;
    }
    offlineBtn.classList.remove('oculto');
    offlineBadge.textContent = pendentes.length;
    offlineBadge.classList.remove('oculto');
    offlineEl.innerHTML = pendentes.map(function (a) {
      var quando = new Date(a.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return '<div class="topbar-notif-item">' +
        '<p>' + escapeHtml(a.descricao || a.rpcNome) + '</p>' +
        '<p style="font-size:0.72rem; color:var(--tinta-suave);">' + quando + (a.problema ? ' · ' + escapeHtml(a.problema) : ' · aguardando conexão') + '</p>' +
        (a.problema
          ? '<div style="display:flex; gap:0.4rem; margin-top:0.3rem;">' +
            '<button type="button" class="btn btn-ghost" data-offline-tentar="' + a.id + '" style="padding:0.25rem 0.6rem; font-size:0.72rem;">Tentar de novo</button>' +
            '<button type="button" class="btn btn-ghost" data-offline-descartar="' + a.id + '" style="padding:0.25rem 0.6rem; font-size:0.72rem; color:var(--erro); border-color:var(--erro);">Descartar</button>' +
            '</div>'
          : '') +
        '</div>';
    }).join('');
    offlineEl.querySelectorAll('[data-offline-tentar]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.VBOffline.tentarNovamente(btn.getAttribute('data-offline-tentar')); });
    });
    offlineEl.querySelectorAll('[data-offline-descartar]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.VBOffline.remover(Number(btn.getAttribute('data-offline-descartar'))); });
    });
  }
  if (window.VBOffline) window.VBOffline.aoMudarFila(atualizarOfflineBarra);
  // conteúdo dos dois dropdowns é só texto e links/botões que navegam ou
  // disparam uma ação (abrir dashboard, sair) — faz sentido fechar o
  // dropdown nesses cliques também, então não trava a propagação aqui.
  document.addEventListener('click', fecharDropdowns);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharDropdowns(); });

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

  // ícones do card do estabelecimento — mesmo traço fino usado no resto
  // do app (nada de emoji), tanto nas estatísticas quanto nos botões de
  // ação, pra dar mais acabamento visual ao card.
  var ICONE_STAT_AGENDA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>';
  var ICONE_STAT_SERVICO = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8.1" y1="7.5" x2="20" y2="19"/><line x1="8.1" y1="16.5" x2="20" y2="5"/></svg>';
  var ICONE_STAT_EQUIPE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6"/><circle cx="17.5" cy="9" r="2.2"/><path d="M15 20c.2-2.6 1.7-4.6 4-5.2"/></svg>';
  var ICONE_ACAO_GESTAO = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M2.5 11h19"/><path d="M7 7V5.5A2.5 2.5 0 0 1 9.5 3h5A2.5 2.5 0 0 1 17 5.5V7"/><circle cx="12" cy="14.5" r="1.8"/></svg>';
  var ICONE_ACAO_VER = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICONE_ACAO_EDITAR = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var ICONE_ACAO_APAGAR = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
  var ICONE_MENU_CHEVRON = '<svg class="dash-card-menu-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';
  var ICONE_ACESSOS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';

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
      // quem já tem um site não precisa ver "criar outro" toda hora — some
      // sozinho assim que existe pelo menos um estabelecimento cadastrado.
      var ctaCard = document.querySelector('.criar-cta-card');
      if (ctaCard) ctaCard.classList.toggle('oculto', linhas.length > 0);
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
            '<p>Seu site ainda está escondido de quem visita: falta cadastrar ' + faltando.join(' e ') + '. Clique em "Editar site" — como você já está logado na sua conta, o modo admin abre direto.</p>' +
            '</div>'
          : '';
        var mensalidadeTexto = formatarPreco(e.mensalidade || 39.9) + '/mês';
        var pagamentoHtml;
        if (e.pagamento_status === 'em_dia') {
          pagamentoHtml = '<div class="dash-card-pagamento dash-card-pagamento-emdia">Assinatura em dia — ' + mensalidadeTexto + (e.forma_pagamento ? ' via ' + (e.forma_pagamento === 'pix' ? 'Pix' : 'cartão de crédito') : '') + '.</div>';
        } else if (e.pagamento_status === 'atrasado') {
          pagamentoHtml = '<div class="dash-card-pagamento dash-card-pagamento-urgente">Pagamento atrasado — regularize a assinatura (' + mensalidadeTexto + ') para não perder o acesso ao seu site.</div>';
        } else if (e.pagamento_status === 'bloqueado') {
          pagamentoHtml = '<div class="dash-card-pagamento dash-card-pagamento-urgente">Acesso bloqueado por falta de pagamento. Fale com o suporte do VB Agenda para regularizar.</div>';
        } else if (e.forma_pagamento) {
          pagamentoHtml = '<div class="dash-card-pagamento">Forma de pagamento: <strong>' + (e.forma_pagamento === 'pix' ? 'Pix' : 'Cartão de crédito') + '</strong> — cobrança automática ainda será ativada, por enquanto seu acesso segue liberado.</div>';
        } else {
          pagamentoHtml = '<div class="dash-card-pagamento dash-card-pagamento-pendente">' +
            '<p>1º mês grátis' + (trialData ? ' até ' + trialData : '') + '. Depois, ' + mensalidadeTexto + '. Escolha como prefere pagar:</p>' +
            '<div class="dash-card-pagamento-botoes">' +
            '<button type="button" class="btn btn-ghost" data-forma-pagamento-id="' + e.id + '" data-forma="pix" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Pix</button>' +
            '<button type="button" class="btn btn-ghost" data-forma-pagamento-id="' + e.id + '" data-forma="cartao" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Cartão de crédito</button>' +
            '</div></div>';
        }
        // linha de menu genérica: ícone + rótulo à esquerda, valor à
        // direita — o mesmo formato pra estatística (só leitura) e pra
        // ação (link/botão clicável, com seta indicando que abre algo).
        function linhaMenu(icone, rotulo, valorHtml, acaoAttrs, classesExtra) {
          var tag = acaoAttrs ? (acaoAttrs.indexOf('href=') > -1 ? 'a' : 'button') : 'div';
          var abre = tag !== 'div';
          return '<' + tag + (tag === 'button' ? ' type="button"' : '') + ' class="dash-card-menu-linha' + (abre ? ' is-acao' : '') + (classesExtra ? ' ' + classesExtra : '') + '"' + (acaoAttrs || '') + '>' +
            '<span class="rotulo">' + icone + escapeHtml(rotulo) + '</span>' +
            '<span class="valor">' + valorHtml + (abre ? ICONE_MENU_CHEVRON : '') + '</span>' +
            '</' + tag + '>';
        }
        return '<li class="dash-card">' +
          '<div class="dash-card-layout">' +
          '<div class="dash-card-identidade">' +
          '<div class="dash-card-topo" style="' + topoStyle + '">' +
          '<span class="dash-card-segmento">' + escapeHtml(SEGMENTOS_LABEL[e.segmento] || 'Estabelecimento') + '</span>' +
          '<span class="dash-card-avatar-anel moldura-' + moldura + '" style="--avatar-cor:' + cor + ';">' +
          '<span class="dash-card-avatar" style="background:' + cor + ';">' + avatarConteudo + '</span>' +
          '</span>' +
          '</div>' +
          '<div class="dash-card-nome-bloco"><span class="nome">' + escapeHtml(e.nome) + '</span><span class="cidade">' + escapeHtml(e.cidade) + '</span></div>' +
          '</div>' +
          '<div class="dash-card-menu">' +
          configPendenteHtml +
          pagamentoHtml +
          '<div class="dash-card-menu-corpo">' +
          '<div class="dash-card-menu-grupo">' +
          '<p class="dash-card-menu-titulo">Visão geral</p>' +
          linhaMenu(ICONE_STAT_AGENDA, 'Agendamentos', '<strong>' + (e.total_agendamentos || 0) + '</strong>') +
          linhaMenu(ICONE_STAT_SERVICO, 'Serviços', '<strong>' + (e.total_servicos || 0) + '</strong>') +
          linhaMenu(ICONE_STAT_EQUIPE, 'Profissionais', '<strong>' + (e.total_equipe || 0) + '</strong>') +
          linhaMenu(ICONE_ACESSOS, 'Acessos ao site', '<strong>' + (e.total_acessos || 0) + '</strong>' +
            '<label class="dash-card-switch" title="Mostrar pro público"><input type="checkbox" data-toggle-contador-id="' + e.id + '"' + (e.mostrar_contador_publico ? ' checked' : '') + '><span class="dash-card-switch-trilho"></span></label>') +
          '<p class="dash-card-menu-legenda">Ativar deixa esse número de acessos visível pra quem visita o site — público, não só pra você.</p>' +
          '</div>' +
          '<div class="dash-card-menu-grupo">' +
          '<p class="dash-card-menu-titulo">Ações</p>' +
          linhaMenu(ICONE_ACAO_GESTAO, 'Gestão', (e.total_pendentes ? '<span class="dash-badge-pendente">' + e.total_pendentes + '</span>' : ''),
            ' data-abrir-dashboard-id="' + e.id + '" data-abrir-dashboard-nome="' + escapeHtml(e.nome) + '"', 'is-principal') +
          linhaMenu(ICONE_ACAO_VER, 'Ver site', '', ' href="' + link + '" target="_blank" rel="noopener"') +
          linhaMenu(ICONE_ACAO_EDITAR, 'Editar site', '', ' href="' + link + '"') +
          linhaMenu(ICONE_ACAO_APAGAR, 'Apagar site', '', ' data-apagar-id="' + e.id + '" data-apagar-nome="' + escapeHtml(e.nome) + '"', 'is-perigo') +
          '</div>' +
          '</div>' +
          '</div>' +
          '</div>' +
          '</li>';
      }).join('');
      atualizarNotificacoesBarra(linhas);
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
    var estabIdAlvo = caixa.getAttribute('data-toggle-contador-id');
    var ligar = caixa.checked;

    function salvar() {
      db.rpc('tenant_admin_alternar_contador_publico', {
        p_estabelecimento_id: estabIdAlvo,
        p_mostrar: ligar
      }).then(function (res) {
        if (res && res.error) {
          caixa.checked = !ligar;
          window.VBDialogo.alert('Não deu pra salvar agora — tenta de novo em instantes.');
          return;
        }
        if (window.VBSalvo) window.VBSalvo.mostrar(ligar ? 'Agora é público' : 'Voltou a ser privado');
      }, function () {
        caixa.checked = !ligar;
        window.VBDialogo.alert('Não deu pra salvar agora — tenta de novo em instantes.');
      });
    }

    // ligar é uma decisão de privacidade (torna um dado público) — confirma
    // antes; desligar (voltar a privado) não precisa de confirmação.
    if (ligar) {
      caixa.checked = false;
      window.VBDialogo.confirm('Isso deixa o número de acessos ao site visível publicamente, pra qualquer pessoa que visitar — não só pra você. Quer ativar?').then(function (ok) {
        if (!ok) return;
        caixa.checked = true;
        salvar();
      });
    } else {
      salvar();
    }
  });

  listaEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-forma-pagamento-id]');
    if (!btn) return;
    btn.closest('.dash-card-pagamento-botoes').querySelectorAll('button').forEach(function (b) { b.disabled = true; });
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
  function formatarPreco(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }
  // ---- exportação em PDF (antes era CSV puro, que abria feito bloco de
  // notas sem formatação nenhuma) — tabela limpa, com título, cabeçalho
  // destacado e listras zebradas pra ficar fácil de ler. ----
  function baixarPdf(titulo, nomeArquivo, cabecalho, linhas) {
    if (!window.jspdf) { window.VBDialogo.alert('Não deu pra gerar o PDF agora — recarregue a página e tente de novo.'); return; }
    var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    var nomeEstab = (dashboardTitulo && dashboardTitulo.textContent) || '';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(31, 32, 36);
    doc.text(titulo, 40, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(107, 109, 118);
    var subtitulo = [nomeEstab, 'gerado em ' + new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' — ');
    doc.text(subtitulo, 40, 60);
    doc.autoTable({
      head: [cabecalho],
      body: linhas.map(function (linha) { return linha.map(function (campo) { return campo == null ? '' : String(campo); }); }),
      startY: 76,
      margin: { left: 40, right: 40 },
      styles: { font: 'helvetica', fontSize: 9.5, textColor: [31, 32, 36], cellPadding: 7, lineColor: [231, 231, 234], lineWidth: 0.5 },
      headStyles: { fillColor: [234, 29, 44], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 249, 250] }
    });
    // rodapé com número de página: só dá pra saber o total depois que
    // a tabela inteira foi montada, então roda numa segunda passada.
    var totalPaginas = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(107, 109, 118);
      doc.text('VB Agenda · página ' + p + ' de ' + totalPaginas, 40, doc.internal.pageSize.getHeight() - 18);
    }
    doc.save(nomeArquivo);
  }

  // ---------- notificações (agendamentos aguardando confirmação em
  // qualquer um dos estabelecimentos do dono): sininho com contador no
  // topbar, conteúdo mora num dropdown — não ocupa espaço na tela até
  // o dono querer olhar. ----------
  function atualizarNotificacoesBarra(linhas) {
    if (!notificacoesEl) return;
    var comPendentes = (linhas || []).filter(function (e) { return e.total_pendentes > 0; });
    if (!comPendentes.length) {
      notifBadge.classList.add('oculto');
      notificacoesEl.innerHTML = '<p class="topbar-dropdown-vazio">Nenhum agendamento aguardando confirmação por enquanto.</p>';
      return;
    }
    var totalGeral = comPendentes.reduce(function (soma, e) { return soma + Number(e.total_pendentes); }, 0);
    var resumoTexto = comPendentes.length === 1
      ? 'Você tem ' + totalGeral + ' agendamento(s) aguardando confirmação em ' + escapeHtml(comPendentes[0].nome) + '.'
      : 'Você tem ' + totalGeral + ' agendamento(s) aguardando confirmação, em ' + comPendentes.length + ' estabelecimentos.';
    notificacoesEl.innerHTML =
      '<p class="topbar-dropdown-resumo">' + resumoTexto + '</p>' +
      '<div class="dash-notificacoes-chips">' +
      comPendentes.map(function (e) {
        return '<button type="button" class="dash-notificacao-chip" data-abrir-dashboard-id="' + e.id + '" data-abrir-dashboard-nome="' + escapeHtml(e.nome) + '" data-abrir-dashboard-aba="agenda">' +
          escapeHtml(e.nome) + ' (' + e.total_pendentes + ')</button>';
      }).join('') +
      '</div>';
    notifBadge.textContent = totalGeral > 9 ? '9+' : String(totalGeral);
    notifBadge.classList.remove('oculto');
  }

  // ---------- Dashboard por estabelecimento: Resumo (gráfico), Agenda
  // (lista + agendamento manual), Clientes e Caixa (PDV) — tudo que antes
  // vivia em "Painel do dono" dentro do próprio site (perfil.html) agora
  // mora aqui, na conta do dono. O site (perfil.html) virou só o Modo
  // Edição visual. ----------
  var dashboardOverlay = document.getElementById('dashboardOverlay');
  var dashboardCorpo = document.getElementById('dashboardCorpo');
  var dashboardTitulo = document.getElementById('dashboardTitulo');
  var dashEstabId = null;
  var dashAbaAtual = 'resumo';
  var STATUS_LABEL = { pendente: 'Pendente', confirmado: 'Confirmado', cancelado: 'Cancelado', concluido: 'Concluído' };
  var FORMAS_PAGAMENTO = [
    { chave: 'pix', nome: 'Pix' },
    { chave: 'dinheiro', nome: 'Dinheiro' },
    { chave: 'cartao', nome: 'Cartão' }
  ];
  var DIAS_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  // ícones dos estados vazios (mesmo traço fino usado no resto do app) —
  // "didático": cada aba explica com uma frase curta como os dados chegam
  // ali, em vez de só dizer "nenhum X ainda" sem contexto nenhum.
  var ICONE_VAZIO_AGENDA = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>';
  var ICONE_VAZIO_CLIENTES = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6"/><circle cx="17.5" cy="9" r="2.2"/><path d="M15 20c.2-2.6 1.7-4.6 4-5.2"/></svg>';
  var ICONE_VAZIO_CAIXA = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M2.5 11h19"/><path d="M7 7V5.5A2.5 2.5 0 0 1 9.5 3h5A2.5 2.5 0 0 1 17 5.5V7"/><circle cx="12" cy="14.5" r="1.8"/></svg>';
  var ICONE_VAZIO_GRAFICO = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="20" x2="4" y2="12"/><line x1="10" y1="20" x2="10" y2="6"/><line x1="16" y1="20" x2="16" y2="14"/><line x1="22" y1="20" x2="22" y2="9"/></svg>';
  var ICONE_VAZIO_COMUNIDADE = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5L14.5 8.7L21 10.5L14.5 12.3L12 19.5L9.5 12.3L3 10.5L9.5 8.7z"/></svg>';

  function blocoVazio(icone, titulo, texto) {
    return '<div class="dash-vazio"><span class="dash-vazio-icone">' + icone + '</span>' +
      '<p class="dash-vazio-titulo">' + titulo + '</p>' +
      '<p class="dash-vazio-texto">' + texto + '</p></div>';
  }

  function abrirDashboard(estabId, nome, abaInicial) {
    dashEstabId = estabId;
    dashboardTitulo.textContent = nome;
    dashboardOverlay.classList.remove('oculto');
    // Caixa é a aba mais usada no dia a dia (registrar uma venda é rápido
    // e constante) — abre direto nela, em vez do Resumo.
    mostrarAbaDashboard(abaInicial || 'caixa');
  }
  function fecharDashboard() {
    dashboardOverlay.classList.add('oculto');
    dashEstabId = null;
  }
  function mostrarAbaDashboard(aba) {
    dashAbaAtual = aba;
    document.querySelectorAll('#dashboardAbas [data-dash-aba]').forEach(function (b) {
      b.classList.toggle('is-ativa', b.getAttribute('data-dash-aba') === aba);
    });
    // trocar o innerHTML por um skeleton na hora e substituir de novo
    // assim que a RPC responde (quase instantâneo, sobretudo em rede boa)
    // pisca a tela — dá a sensação de algo quebrando no clique. Em vez
    // disso, mantém o conteúdo da aba anterior visível (só esmaecido)
    // até o novo conteúdo estar pronto pra entrar de uma vez.
    dashboardCorpo.classList.add('dash-carregando');
    if (aba === 'resumo') renderizarDashResumo();
    else if (aba === 'agenda') renderizarDashAgenda();
    else if (aba === 'clientes') renderizarDashClientes();
    else if (aba === 'caixa') renderizarDashCaixa();
    else if (aba === 'comunidade') renderizarDashComunidade();
  }

  function renderizarDashResumo() {
    var estabId = dashEstabId;
    db.rpc('tenant_admin_dashboard_resumo', { p_estabelecimento_id: estabId, p_dias: 14 }).then(function (res) {
      if (dashEstabId !== estabId) return;
      if (res.error) { dashboardCorpo.classList.remove('dash-carregando'); dashboardCorpo.innerHTML = '<p class="msg msg-erro">' + escapeHtml(res.error.message) + '</p>'; return; }
      var r = res.data || {};
      var dias = r.faturamento_por_dia || [];
      var maiorValor = dias.reduce(function (m, d) { return Math.max(m, Number(d.total)); }, 0);
      var status = r.agendamentos_por_status || {};
      var statusComMovimento = Object.keys(STATUS_LABEL).filter(function (k) { return status[k] > 0; });

      dashboardCorpo.classList.remove('dash-carregando');
      dashboardCorpo.innerHTML =
        '<p class="dash-secao-intro">Visão geral dos últimos 14 dias: quanto entrou, quantos agendamentos e quantos clientes já passaram por aqui.</p>' +
        '<div class="dash-resumo-cards">' +
        '<div class="dash-resumo-card"><span class="dash-resumo-numero">' + formatarPreco(r.total_hoje || 0) + '</span><span class="dash-resumo-label">Faturado hoje</span></div>' +
        '<div class="dash-resumo-card"><span class="dash-resumo-numero">' + formatarPreco(r.total_periodo || 0) + '</span><span class="dash-resumo-label">Últimos 14 dias</span></div>' +
        '<div class="dash-resumo-card"><span class="dash-resumo-numero">' + (r.agendamentos_periodo || 0) + '</span><span class="dash-resumo-label">Agendamentos (14 dias)</span></div>' +
        '<div class="dash-resumo-card"><span class="dash-resumo-numero">' + (r.total_clientes || 0) + '</span><span class="dash-resumo-label">Clientes no total</span></div>' +
        '</div>' +
        '<p class="dash-resumo-subtitulo">Faturamento por dia</p>' +
        (maiorValor > 0
          ? '<div class="dash-grafico-barras">' +
            dias.map(function (d) {
              var altura = Math.round((Number(d.total) / maiorValor) * 100);
              return '<div class="dash-barra-coluna-envolt" title="' + escapeHtml(d.dia) + ': ' + formatarPreco(d.total) + '">' +
                '<div class="dash-barra-coluna"><div class="dash-barra" style="height:' + altura + '%;"></div></div>' +
                '<span class="dash-barra-label">' + escapeHtml(d.dia) + '</span>' +
                '</div>';
            }).join('') +
            '</div>'
          : blocoVazio(ICONE_VAZIO_GRAFICO, 'Ainda sem vendas no período', 'Assim que você registrar uma venda na aba Caixa (ou um cliente concluir um serviço), o faturamento de cada dia aparece aqui, em barras.')
        ) +
        '<p class="dash-resumo-subtitulo">Agendamentos por status</p>' +
        (statusComMovimento.length
          ? '<div class="dash-status-resumo">' +
            statusComMovimento.map(function (k) {
              return '<span class="painel-status-badge ' + k + '">' + STATUS_LABEL[k] + ': ' + status[k] + '</span>';
            }).join('') +
            '</div>'
          : '<p class="dash-secao-intro" style="margin:0;">Nenhum agendamento pendente, confirmado, cancelado ou concluído ainda — eles vão aparecer aqui separados por status conforme forem chegando.</p>') +
        (r.top_servicos && r.top_servicos.length ? '<p class="dash-resumo-subtitulo">Mais vendidos no período</p><div id="dashTopServicos">' +
          r.top_servicos.map(function (s) {
            return '<div class="painel-lista-item"><span><span class="principal">' + escapeHtml(s.nome) + '</span><br><span class="secundario">' + s.qtd + ' venda(s)</span></span><span><strong>' + formatarPreco(s.total) + '</strong></span></div>';
          }).join('') + '</div>' : '');
    }, function () { dashboardCorpo.classList.remove('dash-carregando'); dashboardCorpo.innerHTML = '<p class="msg msg-erro">Sem conexão agora.</p>'; });
  }

  function renderizarDashAgenda() {
    var estabId = dashEstabId;
    Promise.all([
      db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }),
      db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId }),
      db.rpc('tenant_admin_listar_agenda', { p_estabelecimento_id: estabId })
    ]).then(function (resultados) {
      if (dashEstabId !== estabId) return;
      var servicos = resultados[0].data || [];
      var equipe = resultados[1].data || [];
      var linhas = resultados[2].data || [];
      var semCadastroBase = !servicos.length || !equipe.length;
      dashboardCorpo.classList.remove('dash-carregando');
      dashboardCorpo.innerHTML =
        '<p class="dash-resumo-subtitulo" style="margin-top:0;">Novo agendamento manual</p>' +
        '<p class="dash-secao-intro">Pra cliente que liga ou chega no balcão sem passar pelo site — entra direto confirmado, com o cliente já registrado.</p>' +
        (semCadastroBase
          ? '<p class="msg msg-erro" style="margin-bottom:1rem;">Cadastre pelo menos 1 serviço e 1 profissional em "Editar meu site" antes de criar um agendamento manual.</p>'
          : '<form id="dashAgendamentoForm" class="dash-campos-grid">' +
            '<div class="field field-full"><label for="dashAgCliente">Nome do cliente</label><input type="text" id="dashAgCliente" placeholder="Ex: Maria Silva" required></div>' +
            '<div class="field field-full"><label for="dashAgTelefone">Telefone (com DDD)</label><input type="text" id="dashAgTelefone" placeholder="Ex: 15999998888" required></div>' +
            '<div class="field"><label for="dashAgServico">Serviço</label><select id="dashAgServico" required><option value="">Selecione…</option>' +
            servicos.map(function (s) { return '<option value="' + escapeHtml(s.nome) + '">' + escapeHtml(s.nome) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field"><label for="dashAgProfissional">Profissional</label><select id="dashAgProfissional"><option value="">Qualquer um</option>' +
            equipe.map(function (p) { return '<option value="' + p.id + '" data-nome="' + escapeHtml(p.nome) + '">' + escapeHtml(p.nome) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field"><label for="dashAgData">Dia</label><input type="date" id="dashAgData" required></div>' +
            '<div class="field"><label for="dashAgHorario">Horário</label><input type="time" id="dashAgHorario" required></div>' +
            '<button class="btn btn-primario field-full" type="submit">Criar agendamento</button>' +
            '</form>' +
            '<p class="msg" id="dashAgendamentoMsg"></p>') +
        '<div class="dash-lista-cabecalho"><p class="dash-resumo-subtitulo" style="margin:0;">Agenda (clientes que já agendaram)</p>' +
        (linhas.length ? '<button type="button" class="btn btn-ghost" id="dashAgendaExportar" style="padding:0.3rem 0.7rem; font-size:0.78rem;">Exportar PDF</button>' : '') +
        '</div>' +
        '<div id="dashAgendaLista">' + (linhas.length ? linhas.map(function (a) {
          return '<div class="painel-lista-item"><span><span class="principal">' + escapeHtml(a.cliente_nome) + '</span><br>' +
            '<span class="secundario">' + escapeHtml(a.servico || '') + (a.staff_nome ? ' · ' + escapeHtml(a.staff_nome) : '') + ' · ' + escapeHtml(a.dia_label || a.dia) + ' ' + escapeHtml(a.horario) + '</span></span>' +
            '<span class="dash-agenda-acoes">' +
            '<span class="painel-status-badge ' + a.status + '">' + (STATUS_LABEL[a.status] || a.status) + '</span>' +
            (a.status === 'pendente' ? '<button type="button" class="btn btn-ghost" data-status-agendamento-id="' + a.id + '" data-status-novo="confirmado" style="padding:0.2rem 0.5rem; font-size:0.72rem;">Confirmar</button>' : '') +
            (a.status === 'confirmado' ? '<button type="button" class="btn btn-ghost" data-status-agendamento-id="' + a.id + '" data-status-novo="concluido" style="padding:0.2rem 0.5rem; font-size:0.72rem;">Concluir</button>' : '') +
            ((a.status === 'pendente' || a.status === 'confirmado') ? '<button type="button" class="btn btn-ghost" data-status-agendamento-id="' + a.id + '" data-status-novo="cancelado" style="padding:0.2rem 0.5rem; font-size:0.72rem; color:var(--erro); border-color:var(--erro);">Cancelar</button>' : '') +
            '</span></div>';
        }).join('') : blocoVazio(ICONE_VAZIO_AGENDA, 'Nenhum agendamento ainda', 'Todo agendamento feito pelo site (ou criado manualmente aqui em cima) aparece nesta lista, com o status de cada um.')) + '</div>';

      if (window.VBSelect) window.VBSelect.enhanceTodos(dashboardCorpo);
      var profSelect = document.getElementById('dashAgProfissional');
      var formAgendamento = document.getElementById('dashAgendamentoForm');
      if (formAgendamento) formAgendamento.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = document.getElementById('dashAgendamentoMsg');
        var dataInput = document.getElementById('dashAgData').value;
        if (!dataInput) return;
        var dataObj = new Date(dataInput + 'T00:00:00');
        var diaLabel = DIAS_ABREV[dataObj.getDay()] + ' ' + String(dataObj.getDate()).padStart(2, '0') + '/' + String(dataObj.getMonth() + 1).padStart(2, '0');
        var profOpt = profSelect.options[profSelect.selectedIndex];
        msg.className = 'msg';
        msg.textContent = 'Criando…';
        var clienteNome = document.getElementById('dashAgCliente').value.trim();
        chamarComFila('tenant_admin_criar_agendamento', {
          p_estabelecimento_id: estabId,
          p_cliente_nome: clienteNome,
          p_cliente_telefone: document.getElementById('dashAgTelefone').value.trim(),
          p_staff_id: profSelect.value || null,
          p_staff_nome: profSelect.value ? profOpt.getAttribute('data-nome') : null,
          p_servico: document.getElementById('dashAgServico').value,
          p_dia: dataInput,
          p_dia_label: diaLabel,
          p_horario: document.getElementById('dashAgHorario').value
        }, 'Agendamento novo: ' + clienteNome).then(function (resultado) {
          // renderizarDashAgenda() troca todo o innerHTML da aba (inclusive
          // esse próprio <p class="msg">), então a confirmação precisa
          // vir por fora desse re-render — VBDialogo, não o <p>.
          if (resultado.offline) {
            renderizarDashAgenda();
            carregarEstabelecimentos();
            window.VBDialogo.alert('Sem internet agora — agendamento salvo neste aparelho e sobe sozinho assim que a conexão voltar.');
            return;
          }
          if (resultado.res.error) { msg.className = 'msg msg-erro'; msg.textContent = resultado.res.error.message; return; }
          renderizarDashAgenda();
          carregarEstabelecimentos();
          window.VBDialogo.alert('Agendamento criado!');
        });
      });

      document.getElementById('dashAgendaLista').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-status-agendamento-id]');
        if (!btn) return;
        btn.disabled = true;
        var novoStatus = btn.getAttribute('data-status-novo');
        chamarComFila('tenant_admin_atualizar_agendamento', {
          p_estabelecimento_id: estabId,
          p_id: btn.getAttribute('data-status-agendamento-id'),
          p_status: novoStatus
        }, 'Agendamento: ' + (STATUS_LABEL[novoStatus] || novoStatus)).then(function (resultado) {
          renderizarDashAgenda();
          carregarEstabelecimentos();
          if (resultado.offline && window.VBDialogo) {
            window.VBDialogo.alert('Sem internet agora — a mudança foi salva neste aparelho e sobe sozinha assim que a conexão voltar.');
          }
        });
      });

      var exportarBtn = document.getElementById('dashAgendaExportar');
      if (exportarBtn) exportarBtn.addEventListener('click', function () {
        baixarPdf('Agenda', 'agenda.pdf', ['Cliente', 'Telefone', 'Serviço', 'Profissional', 'Dia', 'Horário', 'Status'], linhas.map(function (a) {
          return [a.cliente_nome, a.cliente_telefone, a.servico, a.staff_nome, a.dia_label || a.dia, a.horario, STATUS_LABEL[a.status] || a.status];
        }));
      });
    }, function () { dashboardCorpo.classList.remove('dash-carregando'); dashboardCorpo.innerHTML = '<p class="msg msg-erro">Sem conexão agora.</p>'; });
  }

  var ICONE_WHATSAPP = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.36a9.9 9.9 0 004.62 1.14h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.12c-.24.68-1.4 1.3-1.93 1.35-.5.05-1.03.24-3.46-.73-2.93-1.17-4.8-4.16-4.94-4.35-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36l.55.01c.18 0 .42-.07.65.5.24.58.83 2 .9 2.14.07.15.12.32.02.51-.1.19-.14.31-.28.47-.14.17-.3.37-.42.5-.14.15-.29.31-.13.6.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.45.29.14.46.12.62-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.64-.14.26.1 1.66.78 1.94.93.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/></svg>';
  function formatarTelefone(tel) {
    var d = (tel || '').replace(/\D/g, '');
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return tel || '';
  }
  function linkWhatsapp(tel, msg) {
    return 'https://wa.me/55' + (tel || '').replace(/\D/g, '') + (msg ? '?text=' + encodeURIComponent(msg) : '');
  }
  function formatarDataHora(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderizarDashClientes() {
    var estabId = dashEstabId;
    db.rpc('tenant_admin_listar_clientes', { p_estabelecimento_id: estabId }).then(function (res) {
      if (dashEstabId !== estabId) return;
      var linhas = res.data || [];
      dashboardCorpo.classList.remove('dash-carregando');
      dashboardCorpo.innerHTML =
        '<p class="dash-secao-intro" style="margin-top:0;">Todo cliente que agenda pelo site — ou é cadastrado na aba Agenda — entra aqui automaticamente. Toque num cliente pra ver dados completos, chamar no WhatsApp e o histórico de visitas.</p>' +
        '<div class="dash-lista-cabecalho"><p class="dash-resumo-subtitulo" style="margin:0;">Clientes cadastrados</p>' +
        (linhas.length ? '<button type="button" class="btn btn-ghost" id="dashClientesExportar" style="padding:0.3rem 0.7rem; font-size:0.78rem;">Exportar PDF</button>' : '') +
        '</div>' +
        (linhas.length ? '<div id="dashClientesLista">' + linhas.map(function (c, i) {
          return '<div class="dash-cliente-item">' +
            '<button type="button" class="dash-cliente-cabecalho" data-cliente-toggle="' + i + '">' +
            '<span><span class="principal">' + escapeHtml(c.nome) + '</span><br><span class="secundario">' + escapeHtml(formatarTelefone(c.telefone)) + '</span></span>' +
            '<span class="valor">' + c.total_visitas + ' visita(s)' + ICONE_MENU_CHEVRON + '</span>' +
            '</button>' +
            '<div class="dash-cliente-detalhe oculto" id="clienteDetalhe-' + i + '">' +
            '<div class="dash-cliente-info">' +
            '<span><strong>Primeira visita:</strong> ' + (c.primeira_visita ? new Date(c.primeira_visita).toLocaleDateString('pt-BR') : '—') + '</span>' +
            '<span><strong>Última visita:</strong> ' + (c.ultima_visita ? new Date(c.ultima_visita).toLocaleDateString('pt-BR') : '—') + '</span>' +
            '</div>' +
            '<a class="btn btn-ghost dash-cliente-whatsapp" href="' + linkWhatsapp(c.telefone, 'Olá, ' + c.nome + '! Tudo bem?') + '" target="_blank" rel="noopener">' + ICONE_WHATSAPP + ' Chamar no WhatsApp</a>' +
            '<p class="dash-card-menu-titulo" style="margin-top:1rem;">Histórico</p>' +
            '<div class="dash-cliente-historico" data-historico-container="' + i + '"><p class="topbar-dropdown-vazio">Carregando…</p></div>' +
            '</div>' +
            '</div>';
        }).join('') + '</div>' : blocoVazio(ICONE_VAZIO_CLIENTES, 'Nenhum cliente ainda', 'Assim que alguém agendar pelo seu site — ou você cadastrar um agendamento manual na aba Agenda — o cliente aparece aqui, com o total de visitas atualizado a cada nova vinda.'));
      var exportarBtn = document.getElementById('dashClientesExportar');
      if (exportarBtn) exportarBtn.addEventListener('click', function () {
        baixarPdf('Clientes', 'clientes.pdf', ['Nome', 'Telefone', 'Visitas', 'Primeira visita', 'Última visita'], linhas.map(function (c) {
          return [c.nome, c.telefone, c.total_visitas, c.primeira_visita, c.ultima_visita];
        }));
      });
      var historicoCarregado = {};
      var lista = document.getElementById('dashClientesLista');
      if (lista) lista.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-cliente-toggle]');
        if (!btn) return;
        var i = btn.getAttribute('data-cliente-toggle');
        var detalhe = document.getElementById('clienteDetalhe-' + i);
        detalhe.classList.toggle('oculto');
        if (detalhe.classList.contains('oculto') || historicoCarregado[i]) return;
        historicoCarregado[i] = true;
        var cliente = linhas[i];
        db.rpc('tenant_admin_historico_cliente', { p_estabelecimento_id: estabId, p_telefone: cliente.telefone }).then(function (res) {
          var container = document.querySelector('[data-historico-container="' + i + '"]');
          if (!container) return;
          var itens = res.data || [];
          container.innerHTML = itens.length ? itens.map(function (h) {
            var detalheTexto = [h.detalhe];
            if (h.staff_nome) detalheTexto.push(h.staff_nome);
            return '<div class="painel-lista-item"><span><span class="principal">' + escapeHtml(h.titulo || '—') + '</span><br>' +
              '<span class="secundario">' + escapeHtml(formatarDataHora(h.data)) + ' · ' + escapeHtml(detalheTexto.join(' · ')) + '</span></span>' +
              '<span class="secundario">' + (h.tipo === 'venda' ? 'Venda' : 'Agendamento') + '</span></div>';
          }).join('') : '<p class="topbar-dropdown-vazio">Nenhum histórico registrado ainda.</p>';
        }, function () {
          var container = document.querySelector('[data-historico-container="' + i + '"]');
          if (container) container.innerHTML = '<p class="msg msg-erro">Não deu pra carregar o histórico agora.</p>';
        });
      });
    }, function () { dashboardCorpo.classList.remove('dash-carregando'); dashboardCorpo.innerHTML = '<p class="msg msg-erro">Sem conexão agora.</p>'; });
  }

  // ---- Comunidade: Status (24h, tipo Stories) e Promoções — antes o
  // Status só existia como botão solto na barra de edição do próprio
  // site; agora os dois moram aqui, junto com quem cuida do resto do
  // negócio. Toda promoção ativa também entra na vitrine de promoções
  // do catálogo (promocoes_vitrine_publica). ----
  function horasRestantes(iso) {
    var ms = new Date(iso).getTime() - Date.now();
    return ms > 0 ? Math.max(1, Math.round(ms / 3600000)) : 0;
  }

  function abrirComposerStatus(estabId) {
    function publicar(fotoUrl) {
      window.VBDialogo.prompt('Escreva uma legenda' + (fotoUrl ? ' (opcional)' : ''), '').then(function (texto) {
        if (!fotoUrl && !texto) return;
        chamarComFila('tenant_admin_publicar_status', { p_estabelecimento_id: estabId, p_foto_url: fotoUrl || null, p_texto: texto || null }, 'Status novo').then(function (resultado) {
          if (!resultado.offline && resultado.res.error) { window.VBDialogo.alert('Não deu pra publicar: ' + resultado.res.error.message); return; }
          if (window.VBSalvo) window.VBSalvo.mostrar(resultado.offline ? 'Vai publicar ao reconectar' : 'Publicado');
          if (dashAbaAtual === 'comunidade') renderizarDashComunidade();
        });
      });
    }
    window.VBDialogo.confirm('Publicar status com uma foto?').then(function (comFoto) {
      if (!comFoto) { publicar(null); return; }
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', function (e) {
        var file = e.target.files[0];
        input.remove();
        if (!file || !window.VBUpload) { publicar(null); return; }
        window.VBUpload.uploadFoto(file, estabId, 'status').then(publicar, function (err) {
          window.VBDialogo.alert(err.message || 'Falha ao enviar a foto — sem internet? Tenta de novo, ou publique só com legenda.');
        });
      });
      input.click();
    });
  }

  function ligarEventosComunidade(estabId) {
    var publicarStatusBtn = document.getElementById('dashPublicarStatusBtn');
    if (publicarStatusBtn) publicarStatusBtn.addEventListener('click', function () { abrirComposerStatus(estabId); });

    var listaStatus = document.getElementById('dashListaStatus');
    if (listaStatus) listaStatus.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-apagar-status]');
      if (!btn) return;
      window.VBDialogo.confirm('Apagar esse status?').then(function (ok) {
        if (!ok) return;
        db.rpc('tenant_admin_apagar_status', { p_id: btn.getAttribute('data-apagar-status') }).then(function () {
          if (dashAbaAtual === 'comunidade') renderizarDashComunidade();
        });
      });
    });

    var criarPromoBtn = document.getElementById('dashCriarPromocaoBtn');
    var formPromo = document.getElementById('dashPromocaoForm');
    if (criarPromoBtn && formPromo) criarPromoBtn.addEventListener('click', function () {
      formPromo.classList.toggle('oculto');
    });
    var cancelarPromoBtn = document.getElementById('dashPromocaoCancelar');
    var msgPromo = document.getElementById('dashPromocaoMsg');
    if (cancelarPromoBtn && formPromo) cancelarPromoBtn.addEventListener('click', function () {
      formPromo.reset();
      formPromo.classList.add('oculto');
      if (msgPromo) msgPromo.textContent = '';
    });
    if (formPromo) formPromo.addEventListener('submit', function (e) {
      e.preventDefault();
      var titulo = document.getElementById('dashPromoTitulo').value.trim();
      var texto = document.getElementById('dashPromoTexto').value.trim();
      var dias = document.getElementById('dashPromoValidade').value;
      var file = document.getElementById('dashPromoFoto').files[0];
      if (!titulo) { msgPromo.className = 'msg msg-erro'; msgPromo.textContent = 'Escreva um título pra promoção.'; return; }
      var botaoSubmit = formPromo.querySelector('button[type="submit"]');
      botaoSubmit.disabled = true;
      msgPromo.className = 'msg';
      msgPromo.textContent = 'Publicando…';

      function publicar(fotoUrl) {
        chamarComFila('tenant_admin_publicar_promocao', {
          p_estabelecimento_id: estabId, p_titulo: titulo, p_foto_url: fotoUrl || null,
          p_texto: texto || null, p_dias_validade: Number(dias)
        }, 'Promoção: ' + titulo).then(function (resultado) {
          botaoSubmit.disabled = false;
          if (!resultado.offline && resultado.res.error) { msgPromo.className = 'msg msg-erro'; msgPromo.textContent = resultado.res.error.message; return; }
          if (window.VBSalvo) window.VBSalvo.mostrar(resultado.offline ? 'Vai publicar ao reconectar' : 'Publicado');
          formPromo.reset();
          formPromo.classList.add('oculto');
          msgPromo.textContent = '';
          if (dashAbaAtual === 'comunidade') renderizarDashComunidade();
        });
      }
      if (!file || !window.VBUpload) { publicar(null); return; }
      window.VBUpload.uploadFoto(file, estabId, 'promocao').then(publicar, function (err) {
        botaoSubmit.disabled = false;
        msgPromo.className = 'msg msg-erro';
        msgPromo.textContent = err.message || 'Falha ao enviar a foto — sem internet? Tenta sem foto, ou espera a conexão voltar.';
      });
    });

    var listaPromocoes = document.getElementById('dashListaPromocoes');
    if (listaPromocoes) listaPromocoes.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-apagar-promocao]');
      if (!btn) return;
      window.VBDialogo.confirm('Apagar essa promoção?').then(function (ok) {
        if (!ok) return;
        db.rpc('tenant_admin_apagar_promocao', { p_id: btn.getAttribute('data-apagar-promocao') }).then(function () {
          if (dashAbaAtual === 'comunidade') renderizarDashComunidade();
        });
      });
    });
  }

  function renderizarDashComunidade() {
    var estabId = dashEstabId;
    Promise.all([
      db.rpc('tenant_admin_listar_status', { p_estabelecimento_id: estabId }),
      db.rpc('tenant_admin_listar_promocoes', { p_estabelecimento_id: estabId })
    ]).then(function (resultados) {
      if (dashEstabId !== estabId) return;
      var statusRes = resultados[0], promoRes = resultados[1];
      if (statusRes.error || promoRes.error) {
        dashboardCorpo.classList.remove('dash-carregando');
        dashboardCorpo.innerHTML = '<p class="msg msg-erro">' + escapeHtml((statusRes.error || promoRes.error).message) + '</p>';
        return;
      }
      var statusLista = statusRes.data || [];
      var promoLista = promoRes.data || [];
      dashboardCorpo.classList.remove('dash-carregando');
      dashboardCorpo.innerHTML =
        '<p class="dash-secao-intro" style="margin-top:0;">Status e promoções ajudam seu estabelecimento a aparecer ativo pra quem visita o VB Agenda. Status some sozinho em 24h; promoções ficam no ar pelo prazo que você escolher — e toda promoção ativa também entra na vitrine de promoções do catálogo, pra quem ainda não te conhece.</p>' +

        '<div class="dash-lista-cabecalho"><p class="dash-resumo-subtitulo" style="margin:0;">Status (24h)</p>' +
        '<button type="button" class="btn btn-primario" id="dashPublicarStatusBtn" style="padding:0.4rem 0.9rem; font-size:0.8rem;">+ Publicar</button></div>' +
        (statusLista.length ? '<div id="dashListaStatus">' + statusLista.map(function (s) {
          return '<div class="painel-lista-item">' +
            '<span class="dash-comunidade-thumb' + (s.foto_url ? '' : ' dash-comunidade-thumb-vazia') + '"' + (s.foto_url ? ' style="background-image:url(\'' + s.foto_url + '\')"' : '') + '></span>' +
            '<span style="flex:1; min-width:0;"><span class="principal">' + (s.texto ? escapeHtml(s.texto) : '<em>Sem legenda</em>') + '</span><br>' +
            '<span class="secundario">' + (horasRestantes(s.expira_em) > 0 ? 'expira em ' + horasRestantes(s.expira_em) + 'h' : 'expirado') + '</span></span>' +
            '<button type="button" class="dash-comunidade-apagar" data-apagar-status="' + s.id + '" aria-label="Apagar status">×</button>' +
            '</div>';
        }).join('') + '</div>' : blocoVazio(ICONE_VAZIO_COMUNIDADE, 'Nenhum status no ar', 'Publique uma foto do dia a dia — corte pronto, cliente satisfeito, bastidor — e ela fica visível por 24 horas no seu perfil, como Stories.')) +

        '<div class="dash-lista-cabecalho" style="margin-top:1.6rem;"><p class="dash-resumo-subtitulo" style="margin:0;">Promoções</p>' +
        '<button type="button" class="btn btn-primario" id="dashCriarPromocaoBtn" style="padding:0.4rem 0.9rem; font-size:0.8rem;">+ Criar</button></div>' +
        '<form id="dashPromocaoForm" class="dash-campos-grid oculto" style="margin-bottom:1rem;">' +
        '<div class="field field-full"><label for="dashPromoTitulo">Título da promoção</label><input type="text" id="dashPromoTitulo" placeholder="Ex: Corte + barba 20% OFF" maxlength="80"></div>' +
        '<div class="field field-full"><label for="dashPromoTexto">Detalhes (opcional)</label><input type="text" id="dashPromoTexto" placeholder="Ex: Só às terças, sem agendamento prévio" maxlength="140"></div>' +
        '<div class="field"><label for="dashPromoValidade">Fica no ar por</label><select id="dashPromoValidade"><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option></select></div>' +
        '<div class="field"><label for="dashPromoFoto">Foto (opcional)</label><input type="file" id="dashPromoFoto" accept="image/*"></div>' +
        '<div class="field field-full" style="display:flex; gap:0.6rem;">' +
        '<button type="submit" class="btn btn-primario" style="flex:1;">Publicar promoção</button>' +
        '<button type="button" class="btn btn-ghost" id="dashPromocaoCancelar">Cancelar</button>' +
        '</div>' +
        '<p class="msg" id="dashPromocaoMsg" style="grid-column:1/-1;"></p>' +
        '</form>' +
        (promoLista.length ? '<div id="dashListaPromocoes">' + promoLista.map(function (p) {
          var ativa = horasRestantes(p.expira_em) > 0;
          return '<div class="painel-lista-item">' +
            '<span class="dash-comunidade-thumb' + (p.foto_url ? '' : ' dash-comunidade-thumb-vazia') + '"' + (p.foto_url ? ' style="background-image:url(\'' + p.foto_url + '\')"' : '') + '></span>' +
            '<span style="flex:1; min-width:0;"><span class="principal">' + escapeHtml(p.titulo) + '</span><br>' +
            '<span class="secundario">' + (ativa ? 'válida até ' + new Date(p.expira_em).toLocaleDateString('pt-BR') : 'expirada em ' + new Date(p.expira_em).toLocaleDateString('pt-BR')) + '</span></span>' +
            '<button type="button" class="dash-comunidade-apagar" data-apagar-promocao="' + p.id + '" aria-label="Apagar promoção">×</button>' +
            '</div>';
        }).join('') + '</div>' : blocoVazio(ICONE_VAZIO_COMUNIDADE, 'Nenhuma promoção ativa', 'Crie uma promoção com prazo — ela fica visível no seu site e também na vitrine de promoções do catálogo do VB Agenda, pra atrair gente nova.'));

      if (window.VBSelect) window.VBSelect.enhanceTodos(dashboardCorpo);
      ligarEventosComunidade(estabId);
    }, function () { dashboardCorpo.classList.remove('dash-carregando'); dashboardCorpo.innerHTML = '<p class="msg msg-erro">Sem conexão agora.</p>'; });
  }

  function renderizarDashCaixa() {
    var estabId = dashEstabId;
    Promise.all([
      db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }),
      db.rpc('tenant_admin_listar_vendas_hoje', { p_estabelecimento_id: estabId }),
      db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId })
    ]).then(function (resultados) {
      if (dashEstabId !== estabId) return;
      var servicos = resultados[0].data || [];
      var vendas = resultados[1].data || [];
      var equipe = resultados[2].data || [];
      var total = vendas.reduce(function (soma, v) { return soma + Number(v.valor); }, 0);
      var porForma = {};
      FORMAS_PAGAMENTO.forEach(function (f) { porForma[f.chave] = 0; });
      vendas.forEach(function (v) { porForma[v.forma_pagamento] = (porForma[v.forma_pagamento] || 0) + Number(v.valor); });

      // carrinho: vários itens por venda (antes só dava pra marcar 1
      // serviço por vez). Cada toque num serviço soma +1 na quantidade;
      // "item avulso" abre um painel próprio pra descrição+valor livres.
      var carrinho = [];
      var avulsoSeq = 0;
      var splitAtivo = false;

      dashboardCorpo.classList.remove('dash-carregando');
      dashboardCorpo.innerHTML =
        '<p class="dash-secao-intro" style="margin-top:0;">Toque nos serviços vendidos — pode adicionar quantos precisar. Ajuste o carrinho e a forma de pagamento antes de registrar.</p>' +
        '<div class="dash-caixa-servicos" id="caixaServicos">' +
        servicos.map(function (s) {
          return '<button type="button" class="dash-caixa-servico-btn" data-caixa-servico-id="' + s.id + '" data-preco="' + s.preco + '" data-nome="' + escapeHtml(s.nome) + '">' +
            '<span class="dash-caixa-servico-nome">' + escapeHtml(s.nome) + '</span>' +
            '<span class="dash-caixa-servico-preco">' + formatarPreco(s.preco) + '</span>' +
            '<span class="dash-caixa-servico-qtd oculto" data-caixa-qtd-badge></span>' +
            '</button>';
        }).join('') +
        '<button type="button" class="dash-caixa-servico-btn is-avulso" data-caixa-avulso>' +
        '<span class="dash-caixa-servico-nome">Item avulso</span><span class="dash-caixa-servico-preco">outro valor</span>' +
        '</button>' +
        '</div>' +
        '<div class="vb-servico-novo-painel oculto" id="caixaAvulsoPainel">' +
        '<p class="vb-servico-novo-legenda">Descrição e valor do item:</p>' +
        '<div class="vb-servico-manual">' +
        '<input type="text" id="caixaAvulsoDescricao" placeholder="Ex: Produto avulso">' +
        '<input type="number" id="caixaAvulsoValor" min="0" step="0.01" placeholder="Valor (R$)">' +
        '<button type="button" class="btn btn-primario" id="caixaAvulsoAdicionar">Adicionar ao carrinho</button>' +
        '</div></div>' +
        (equipe.length ? '<p class="dash-resumo-subtitulo" style="margin-top:0;">Quem atendeu</p><div class="dash-forma-pagamento" id="caixaProfissionalBotoes" style="margin-bottom:1rem;">' +
          '<button type="button" class="dash-forma-btn is-selecionada" data-staff-id="" data-staff-nome="">Sem informar</button>' +
          equipe.map(function (p) { return '<button type="button" class="dash-forma-btn" data-staff-id="' + p.id + '" data-staff-nome="' + escapeHtml(p.nome) + '">' + escapeHtml(p.nome) + '</button>'; }).join('') +
          '</div>' : '') +
        '<p class="dash-resumo-subtitulo" style="margin-top:0;">Carrinho</p>' +
        '<div class="dash-caixa-carrinho" id="caixaCarrinhoLista"></div>' +
        '<div class="caixa-total"><span>Total do carrinho</span><span id="caixaCarrinhoTotalValor">' + formatarPreco(0) + '</span></div>' +
        '<div class="dash-campos-grid" style="margin-top:0.8rem;">' +
        '<div class="field"><label for="caixaClienteNome">Nome do cliente (opcional)</label><input type="text" id="caixaClienteNome" placeholder="Ex: Maria Silva"></div>' +
        '<div class="field"><label for="caixaClienteTelefone">Telefone do cliente (opcional)</label><input type="text" id="caixaClienteTelefone" placeholder="Ex: 15999998888"></div>' +
        '</div>' +
        '<div id="caixaPagamentoBox"></div>' +
        '<button class="btn btn-primario" type="button" id="caixaRegistrarBtn" style="width:100%; margin-top:0.8rem;" disabled>Registrar venda</button>' +
        '<p class="msg" id="caixaMsg"></p>' +
        '<p class="dash-resumo-subtitulo">Recebido hoje por forma de pagamento</p>' +
        '<div class="dash-resumo-cards">' +
        FORMAS_PAGAMENTO.map(function (f) {
          return '<div class="dash-resumo-card"><span class="dash-resumo-numero">' + formatarPreco(porForma[f.chave] || 0) + '</span><span class="dash-resumo-label">' + f.nome + '</span></div>';
        }).join('') +
        '</div>' +
        '<div class="caixa-total"><span>Total de hoje</span><span>' + formatarPreco(total) + '</span></div>' +
        '<div class="dash-lista-cabecalho">' +
        '<p class="dash-resumo-subtitulo" style="margin:0;">Vendas de hoje</p>' +
        (vendas.length ? '<button type="button" class="btn btn-ghost" id="caixaExportar" style="padding:0.3rem 0.7rem; font-size:0.78rem;">Exportar PDF</button>' : '') +
        '</div>' +
        '<div id="caixaLista">' + (vendas.length ? vendas.map(function (v) {
          var detalhes = [FORMAS_PAGAMENTO.filter(function (f) { return f.chave === v.forma_pagamento; }).map(function (f) { return f.nome; })[0]];
          if (v.staff_nome) detalhes.push(v.staff_nome);
          if (v.cliente_nome) detalhes.push(v.cliente_nome);
          return '<div class="painel-lista-item"><span><span class="principal">' + escapeHtml(v.descricao) + '</span><br>' +
            '<span class="secundario">' + escapeHtml(detalhes.join(' · ')) + '</span></span>' +
            '<span><strong>' + formatarPreco(v.valor) + '</strong> <button type="button" class="btn btn-ghost" style="padding:0.25rem 0.5rem; font-size:0.72rem;" data-remover-venda="' + v.id + '">✕</button></span></div>';
        }).join('') : blocoVazio(ICONE_VAZIO_CAIXA, 'Nenhuma venda hoje ainda', 'Toda venda registrada aqui entra no faturamento do dia e também alimenta o gráfico da aba Resumo.')) + '</div>';

      var carrinhoListaEl = document.getElementById('caixaCarrinhoLista');
      var carrinhoTotalEl = document.getElementById('caixaCarrinhoTotalValor');
      var pagamentoBox = document.getElementById('caixaPagamentoBox');
      var registrarBtn = document.getElementById('caixaRegistrarBtn');
      var profissionalBotoes = document.getElementById('caixaProfissionalBotoes');

      function totalCarrinho() {
        return carrinho.reduce(function (soma, item) { return soma + item.precoUnit * item.qtd; }, 0);
      }

      function atualizarBadgesServico() {
        document.querySelectorAll('#caixaServicos .dash-caixa-servico-btn[data-caixa-servico-id]').forEach(function (btn) {
          var id = btn.getAttribute('data-caixa-servico-id');
          var item = carrinho.filter(function (i) { return i.key === id; })[0];
          var badge = btn.querySelector('[data-caixa-qtd-badge]');
          if (item && item.qtd > 0) {
            badge.textContent = item.qtd;
            badge.classList.remove('oculto');
            btn.classList.add('is-selecionada');
          } else {
            badge.classList.add('oculto');
            btn.classList.remove('is-selecionada');
          }
        });
      }

      function renderizarCarrinho() {
        carrinhoListaEl.innerHTML = carrinho.length
          ? carrinho.map(function (item) {
            return '<div class="dash-caixa-carrinho-item">' +
              '<div class="dash-caixa-carrinho-info"><span class="nome">' + escapeHtml(item.nome) + '</span><span class="preco-unit">' + formatarPreco(item.precoUnit) + ' cada</span></div>' +
              '<div class="dash-caixa-stepper">' +
              '<button type="button" data-carrinho-dec="' + item.key + '">−</button>' +
              '<span>' + item.qtd + '</span>' +
              '<button type="button" data-carrinho-inc="' + item.key + '">+</button>' +
              '</div>' +
              '<span class="dash-caixa-carrinho-subtotal">' + formatarPreco(item.precoUnit * item.qtd) + '</span>' +
              '<button type="button" class="vb-remover-x" data-carrinho-remover="' + item.key + '">×</button>' +
              '</div>';
          }).join('')
          : '<p class="dash-caixa-carrinho-vazio">Nenhum item ainda — toque em um serviço acima ou adicione um item avulso.</p>';
        carrinhoTotalEl.textContent = formatarPreco(totalCarrinho());
        atualizarBadgesServico();
        atualizarPagamentoResumo();
        registrarBtn.disabled = carrinho.length === 0;
      }

      function adicionarItem(key, nome, precoUnit, servicoId) {
        var existente = carrinho.filter(function (i) { return i.key === key; })[0];
        if (existente) { existente.qtd += 1; } else { carrinho.push({ key: key, nome: nome, precoUnit: precoUnit, qtd: 1, servicoId: servicoId }); }
        renderizarCarrinho();
      }

      document.getElementById('caixaServicos').addEventListener('click', function (e) {
        var avulsoBtn = e.target.closest('[data-caixa-avulso]');
        if (avulsoBtn) {
          var painel = document.getElementById('caixaAvulsoPainel');
          painel.classList.toggle('oculto');
          if (!painel.classList.contains('oculto')) document.getElementById('caixaAvulsoDescricao').focus();
          return;
        }
        var btn = e.target.closest('.dash-caixa-servico-btn[data-caixa-servico-id]');
        if (!btn) return;
        adicionarItem(btn.getAttribute('data-caixa-servico-id'), btn.getAttribute('data-nome'), Number(btn.getAttribute('data-preco')), btn.getAttribute('data-caixa-servico-id'));
      });
      document.getElementById('caixaAvulsoAdicionar').addEventListener('click', function () {
        var descInput = document.getElementById('caixaAvulsoDescricao');
        var valInput = document.getElementById('caixaAvulsoValor');
        var descricao = descInput.value.trim();
        var valor = parseFloat(valInput.value);
        if (!descricao || !(valor > 0)) { descInput.focus(); return; }
        adicionarItem('avulso-' + (++avulsoSeq), descricao, valor, null);
        descInput.value = '';
        valInput.value = '';
        descInput.focus();
      });
      carrinhoListaEl.addEventListener('click', function (e) {
        var incBtn = e.target.closest('[data-carrinho-inc]');
        var decBtn = e.target.closest('[data-carrinho-dec]');
        var remBtn = e.target.closest('[data-carrinho-remover]');
        var key = null;
        if (incBtn) key = incBtn.getAttribute('data-carrinho-inc');
        else if (decBtn) key = decBtn.getAttribute('data-carrinho-dec');
        else if (remBtn) key = remBtn.getAttribute('data-carrinho-remover');
        if (!key) return;
        var item = carrinho.filter(function (i) { return i.key === key; })[0];
        if (!item) return;
        if (incBtn) item.qtd += 1;
        else if (decBtn) item.qtd -= 1;
        if (remBtn || item.qtd <= 0) carrinho = carrinho.filter(function (i) { return i.key !== key; });
        renderizarCarrinho();
      });

      if (profissionalBotoes) profissionalBotoes.addEventListener('click', function (e) {
        var btn = e.target.closest('.dash-forma-btn');
        if (!btn) return;
        profissionalBotoes.querySelectorAll('.dash-forma-btn').forEach(function (b) { b.classList.remove('is-selecionada'); });
        btn.classList.add('is-selecionada');
      });

      // ---- pagamento: modo único (com troco quando é dinheiro) ou
      // fracionado entre várias formas (split), como um PDV de verdade. ----
      function renderizarPagamentoUnico() {
        pagamentoBox.innerHTML =
          '<div class="field"><label>Forma de pagamento</label><div class="dash-forma-pagamento" id="caixaFormaBotoes">' +
          FORMAS_PAGAMENTO.map(function (f, i) { return '<button type="button" class="dash-forma-btn' + (i === 0 ? ' is-selecionada' : '') + '" data-forma="' + f.chave + '">' + f.nome + '</button>'; }).join('') +
          '</div></div>' +
          '<div class="field oculto" id="caixaTrocoWrap"><label for="caixaValorRecebido">Valor recebido em dinheiro (opcional)</label><input type="number" id="caixaValorRecebido" min="0" step="0.01" placeholder="0,00"></div>' +
          '<p class="dash-caixa-troco oculto" id="caixaTrocoResultado"></p>' +
          '<button type="button" class="btn btn-ghost" id="caixaAtivarSplit" style="width:100%; margin-top:0.4rem;">Dividir entre mais de uma forma de pagamento</button>';
        document.getElementById('caixaFormaBotoes').addEventListener('click', function (e) {
          var btn = e.target.closest('.dash-forma-btn');
          if (!btn) return;
          document.querySelectorAll('#caixaFormaBotoes .dash-forma-btn').forEach(function (b) { b.classList.remove('is-selecionada'); });
          btn.classList.add('is-selecionada');
          atualizarPagamentoResumo();
        });
        document.getElementById('caixaValorRecebido').addEventListener('input', atualizarPagamentoResumo);
        document.getElementById('caixaAtivarSplit').addEventListener('click', function () {
          splitAtivo = true;
          renderizarPagamentoSplit();
        });
      }

      function linhaSplitHtml(forma) {
        return '<div class="dash-caixa-split-linha">' +
          '<div class="dash-forma-pagamento">' +
          FORMAS_PAGAMENTO.map(function (f) { return '<button type="button" class="dash-forma-btn' + (f.chave === forma ? ' is-selecionada' : '') + '" data-split-forma="' + f.chave + '">' + f.nome + '</button>'; }).join('') +
          '</div>' +
          '<input type="number" class="dash-caixa-split-valor" min="0" step="0.01" placeholder="Valor (R$)">' +
          '<button type="button" class="vb-remover-x" data-split-remover>×</button>' +
          '</div>';
      }

      function renderizarPagamentoSplit() {
        pagamentoBox.innerHTML =
          '<p class="dash-resumo-subtitulo" style="margin-top:0;">Pagamento dividido</p>' +
          '<div id="caixaSplitLinhas">' + linhaSplitHtml('pix') + linhaSplitHtml('dinheiro') + '</div>' +
          '<button type="button" class="btn btn-ghost" id="caixaSplitAdicionarLinha" style="width:100%; margin:0.5rem 0;">+ Adicionar forma de pagamento</button>' +
          '<p class="dash-caixa-troco" id="caixaSplitResumo"></p>' +
          '<button type="button" class="btn btn-ghost" id="caixaDesativarSplit" style="width:100%;">Voltar pra uma forma só</button>';
        document.getElementById('caixaSplitLinhas').addEventListener('click', function (e) {
          var formaBtn = e.target.closest('[data-split-forma]');
          if (formaBtn) {
            formaBtn.parentElement.querySelectorAll('.dash-forma-btn').forEach(function (b) { b.classList.remove('is-selecionada'); });
            formaBtn.classList.add('is-selecionada');
            atualizarPagamentoResumo();
            return;
          }
          var remBtn = e.target.closest('[data-split-remover]');
          if (remBtn) {
            remBtn.closest('.dash-caixa-split-linha').remove();
            atualizarPagamentoResumo();
          }
        });
        document.getElementById('caixaSplitLinhas').addEventListener('input', function (e) {
          if (e.target.classList.contains('dash-caixa-split-valor')) atualizarPagamentoResumo();
        });
        document.getElementById('caixaSplitAdicionarLinha').addEventListener('click', function () {
          document.getElementById('caixaSplitLinhas').insertAdjacentHTML('beforeend', linhaSplitHtml('cartao'));
          atualizarPagamentoResumo();
        });
        document.getElementById('caixaDesativarSplit').addEventListener('click', function () {
          splitAtivo = false;
          renderizarPagamentoUnico();
          atualizarPagamentoResumo();
        });
        atualizarPagamentoResumo();
      }

      function lerSplitTenders() {
        return Array.prototype.slice.call(document.querySelectorAll('#caixaSplitLinhas .dash-caixa-split-linha')).map(function (linha) {
          var formaBtn = linha.querySelector('.dash-forma-btn.is-selecionada');
          var valorInput = linha.querySelector('.dash-caixa-split-valor');
          return { forma: formaBtn ? formaBtn.getAttribute('data-split-forma') : FORMAS_PAGAMENTO[0].chave, valor: parseFloat(valorInput.value) || 0 };
        });
      }

      function atualizarPagamentoResumo() {
        var totalAtual = totalCarrinho();
        if (!splitAtivo) {
          var formaBtn = document.querySelector('#caixaFormaBotoes .dash-forma-btn.is-selecionada');
          var trocoWrap = document.getElementById('caixaTrocoWrap');
          var trocoResultado = document.getElementById('caixaTrocoResultado');
          if (!formaBtn || !trocoWrap || !trocoResultado) return;
          var ehDinheiro = formaBtn.getAttribute('data-forma') === 'dinheiro';
          trocoWrap.classList.toggle('oculto', !ehDinheiro);
          if (ehDinheiro) {
            var recebido = parseFloat(document.getElementById('caixaValorRecebido').value);
            if (recebido > 0) {
              var diferenca = recebido - totalAtual;
              trocoResultado.classList.remove('oculto');
              trocoResultado.textContent = diferenca >= 0 ? 'Troco: ' + formatarPreco(diferenca) : 'Faltam ' + formatarPreco(-diferenca);
              trocoResultado.classList.toggle('dash-caixa-troco-alerta', diferenca < 0);
            } else {
              trocoResultado.classList.add('oculto');
            }
          } else {
            trocoResultado.classList.add('oculto');
          }
          registrarBtn.disabled = carrinho.length === 0;
        } else {
          var resumo = document.getElementById('caixaSplitResumo');
          if (!resumo) return;
          var alocado = lerSplitTenders().reduce(function (soma, t) { return soma + t.valor; }, 0);
          var diff = Math.round((totalAtual - alocado) * 100) / 100;
          if (Math.abs(diff) < 0.01) {
            resumo.textContent = 'Total alocado: ' + formatarPreco(alocado) + ' — confere com o carrinho.';
            resumo.classList.remove('dash-caixa-troco-alerta');
          } else if (diff > 0) {
            resumo.textContent = 'Falta alocar ' + formatarPreco(diff) + ' (carrinho: ' + formatarPreco(totalAtual) + ').';
            resumo.classList.add('dash-caixa-troco-alerta');
          } else {
            resumo.textContent = 'Passou ' + formatarPreco(-diff) + ' do total do carrinho.';
            resumo.classList.add('dash-caixa-troco-alerta');
          }
          registrarBtn.disabled = carrinho.length === 0 || Math.abs(diff) >= 0.01;
        }
      }

      renderizarPagamentoUnico();
      renderizarCarrinho();

      registrarBtn.addEventListener('click', function () {
        var msg = document.getElementById('caixaMsg');
        if (!carrinho.length) { msg.className = 'msg msg-erro'; msg.textContent = 'Adicione ao menos um item ao carrinho.'; return; }
        var staffBtn = profissionalBotoes ? profissionalBotoes.querySelector('.dash-forma-btn.is-selecionada') : null;
        var dadosComuns = {
          p_estabelecimento_id: estabId,
          p_staff_id: staffBtn ? (staffBtn.getAttribute('data-staff-id') || null) : null,
          p_staff_nome: staffBtn ? (staffBtn.getAttribute('data-staff-nome') || null) : null,
          p_cliente_nome: document.getElementById('caixaClienteNome').value.trim() || null,
          p_cliente_telefone: document.getElementById('caixaClienteTelefone').value.trim() || null
        };
        var chamadas;
        if (!splitAtivo) {
          var formaBtn = document.querySelector('#caixaFormaBotoes .dash-forma-btn.is-selecionada');
          var forma = formaBtn ? formaBtn.getAttribute('data-forma') : FORMAS_PAGAMENTO[0].chave;
          chamadas = carrinho.map(function (item) {
            var params = Object.assign({}, dadosComuns, {
              p_descricao: item.qtd > 1 ? (item.qtd + 'x ' + item.nome) : item.nome,
              p_valor: Math.round(item.precoUnit * item.qtd * 100) / 100,
              p_forma_pagamento: forma,
              p_servico_id: item.servicoId
            });
            return function () { return chamarVendaComFila(params); };
          });
        } else {
          var tenders = lerSplitTenders().filter(function (t) { return t.valor > 0; });
          var alocado = tenders.reduce(function (soma, t) { return soma + t.valor; }, 0);
          if (Math.abs(alocado - totalCarrinho()) >= 0.01) {
            msg.className = 'msg msg-erro';
            msg.textContent = 'A soma das formas de pagamento precisa bater com o total do carrinho.';
            return;
          }
          var descricaoConjunta = carrinho.map(function (item) { return item.qtd > 1 ? (item.qtd + 'x ' + item.nome) : item.nome; }).join(', ');
          chamadas = tenders.map(function (t) {
            var params = Object.assign({}, dadosComuns, {
              p_descricao: descricaoConjunta,
              p_valor: t.valor,
              p_forma_pagamento: t.forma,
              p_servico_id: null
            });
            return function () { return chamarVendaComFila(params); };
          });
        }
        msg.className = 'msg';
        msg.textContent = 'Registrando…';
        registrarBtn.disabled = true;
        var algumOffline = false;
        chamadas.reduce(function (promessa, chamar) {
          return promessa.then(function (erroAnterior) {
            if (erroAnterior) return erroAnterior;
            return chamar().then(function (resultado) {
              if (resultado.offline) { algumOffline = true; return null; }
              return resultado.res.error || null;
            });
          });
        }, Promise.resolve(null)).then(function (erro) {
          if (erro) { msg.className = 'msg msg-erro'; msg.textContent = erro.message; registrarBtn.disabled = false; return; }
          renderizarDashCaixa();
          carregarEstabelecimentos();
          if (algumOffline && window.VBDialogo) {
            window.VBDialogo.alert('Sem internet agora — a venda foi salva neste aparelho e sobe sozinha assim que a conexão voltar.');
          }
        }, function () { msg.className = 'msg msg-erro'; msg.textContent = 'Não deu pra registrar.'; registrarBtn.disabled = false; });
      });

      document.getElementById('caixaLista').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-remover-venda]');
        if (!btn) return;
        db.rpc('tenant_admin_remover_venda', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-venda') }).then(renderizarDashCaixa);
      });
      var exportarBtn = document.getElementById('caixaExportar');
      if (exportarBtn) exportarBtn.addEventListener('click', function () {
        baixarPdf('Vendas de hoje', 'vendas.pdf', ['Descrição', 'Valor', 'Forma de pagamento', 'Profissional', 'Cliente', 'Telefone do cliente', 'Data'], vendas.map(function (v) {
          return [v.descricao, formatarPreco(v.valor), FORMAS_PAGAMENTO.filter(function (f) { return f.chave === v.forma_pagamento; }).map(function (f) { return f.nome; })[0], v.staff_nome, v.cliente_nome, v.cliente_telefone, new Date(v.criado_em).toLocaleString('pt-BR')];
        }));
      });
    });
  }

  document.getElementById('dashboardFechar').addEventListener('click', fecharDashboard);
  document.getElementById('dashboardAbas').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-dash-aba]');
    if (!btn) return;
    mostrarAbaDashboard(btn.getAttribute('data-dash-aba'));
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-abrir-dashboard-id]');
    if (!btn) return;
    abrirDashboard(btn.getAttribute('data-abrir-dashboard-id'), btn.getAttribute('data-abrir-dashboard-nome'), btn.getAttribute('data-abrir-dashboard-aba'));
  });

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

  function mostrarPainel(email) {
    if (email) topbarMenuEmail.textContent = email;
    // onAuthStateChange dispara de novo (com uma sessão válida) toda vez
    // que a aba volta a ficar visível — o supabase-js reconfere/renova o
    // token nesse momento — não só num login de verdade. Sem essa trava,
    // cada volta pra aba recarregava a lista do zero (some e aparece):
    // já com o painel na tela, não tem o que fazer de novo aqui.
    if (!painelBox.classList.contains('oculto')) return;
    authBox.classList.add('oculto');
    painelBox.classList.remove('oculto');
    topbarIcones.classList.remove('oculto');
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
  } else {
    db.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (session) mostrarPainel(session.user && session.user.email);
    });
    // cobre o retorno do login do Google (a sessão só fica pronta
    // depois que o supabase-js processa o redirect) e o logout.
    db.auth.onAuthStateChange(function (evento, session) {
      if (session) mostrarPainel(session.user && session.user.email);
      else if (evento === 'SIGNED_OUT') window.location.reload();
    });
  }
})();
