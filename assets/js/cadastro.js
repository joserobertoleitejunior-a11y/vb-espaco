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
  var notificacoesEl = document.getElementById('notificacoesBarra');

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
  var ICONE_ACAO_GESTAO = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:0.35rem; vertical-align:-3px;"><rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M2.5 11h19"/><path d="M7 7V5.5A2.5 2.5 0 0 1 9.5 3h5A2.5 2.5 0 0 1 17 5.5V7"/><circle cx="12" cy="14.5" r="1.8"/></svg>';
  var ICONE_ACAO_VER = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:0.35rem; vertical-align:-3px;"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICONE_ACAO_EDITAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:0.35rem; vertical-align:-3px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var ICONE_ACAO_APAGAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:0.35rem; vertical-align:-3px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

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
          '<span class="nome">' + escapeHtml(e.nome) + '</span><span class="cidade">' + escapeHtml(e.cidade) + '</span>' +
          '<div class="dash-card-stats">' +
          '<div class="dash-card-stat">' + ICONE_STAT_AGENDA + '<strong>' + (e.total_agendamentos || 0) + '</strong><span>agendamento(s)</span></div>' +
          '<div class="dash-card-stat">' + ICONE_STAT_SERVICO + '<strong>' + (e.total_servicos || 0) + '</strong><span>serviço(s)</span></div>' +
          '<div class="dash-card-stat">' + ICONE_STAT_EQUIPE + '<strong>' + (e.total_equipe || 0) + '</strong><span>profissional(is)</span></div>' +
          '</div>' +
          '<div class="dash-card-acessos">' +
          '<span><svg class="icone-inline" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg> <strong>' + (e.total_acessos || 0) + '</strong> acesso(s) ao site</span>' +
          '<label class="dash-card-acessos-toggle"><input type="checkbox" data-toggle-contador-id="' + e.id + '"' + (e.mostrar_contador_publico ? ' checked' : '') + '> Mostrar pro público</label>' +
          '</div>' +
          configPendenteHtml +
          pagamentoHtml +
          '<div class="dash-card-acoes">' +
          '<button class="btn btn-primario" type="button" data-abrir-dashboard-id="' + e.id + '" data-abrir-dashboard-nome="' + escapeHtml(e.nome) + '" style="position:relative;">' + ICONE_ACAO_GESTAO + 'Gestão' +
          (e.total_pendentes ? ' <span class="dash-badge-pendente">' + e.total_pendentes + '</span>' : '') +
          '</button>' +
          '<a class="btn btn-ghost" href="' + link + '" target="_blank" rel="noopener">' + ICONE_ACAO_VER + 'Ver site</a>' +
          '<a class="btn btn-ghost" href="' + link + '">' + ICONE_ACAO_EDITAR + 'Editar site</a>' +
          '<button class="btn btn-ghost btn-apagar" type="button" data-apagar-id="' + e.id + '" data-apagar-nome="' + escapeHtml(e.nome) + '">' + ICONE_ACAO_APAGAR + 'Apagar site</button>' +
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
  function formatarPreco(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }
  function baixarCsv(nomeArquivo, cabecalho, linhas) {
    var csv = [cabecalho].concat(linhas).map(function (linha) {
      return linha.map(function (campo) {
        var texto = String(campo == null ? '' : campo).replace(/"/g, '""');
        return '"' + texto + '"';
      }).join(';');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- barra de notificação (agendamentos aguardando confirmação
  // em qualquer um dos estabelecimentos do dono) — texto puro, sem emoji. ----------
  function atualizarNotificacoesBarra(linhas) {
    if (!notificacoesEl) return;
    var comPendentes = (linhas || []).filter(function (e) { return e.total_pendentes > 0; });
    if (!comPendentes.length) {
      notificacoesEl.classList.add('oculto');
      notificacoesEl.innerHTML = '';
      return;
    }
    var totalGeral = comPendentes.reduce(function (soma, e) { return soma + Number(e.total_pendentes); }, 0);
    var resumoTexto = comPendentes.length === 1
      ? 'Você tem ' + totalGeral + ' agendamento(s) aguardando confirmação em ' + escapeHtml(comPendentes[0].nome) + '.'
      : 'Você tem ' + totalGeral + ' agendamento(s) aguardando confirmação, em ' + comPendentes.length + ' estabelecimentos.';
    notificacoesEl.innerHTML =
      '<p>' + resumoTexto + '</p>' +
      '<div class="dash-notificacoes-chips">' +
      comPendentes.map(function (e) {
        return '<button type="button" class="dash-notificacao-chip" data-abrir-dashboard-id="' + e.id + '" data-abrir-dashboard-nome="' + escapeHtml(e.nome) + '" data-abrir-dashboard-aba="agenda">' +
          escapeHtml(e.nome) + ' (' + e.total_pendentes + ')</button>';
      }).join('') +
      '</div>';
    notificacoesEl.classList.remove('oculto');
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
        (linhas.length ? '<button type="button" class="btn btn-ghost" id="dashAgendaExportar" style="padding:0.3rem 0.7rem; font-size:0.78rem;">Exportar planilha (CSV)</button>' : '') +
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
        db.rpc('tenant_admin_criar_agendamento', {
          p_estabelecimento_id: estabId,
          p_cliente_nome: document.getElementById('dashAgCliente').value.trim(),
          p_cliente_telefone: document.getElementById('dashAgTelefone').value.trim(),
          p_staff_id: profSelect.value || null,
          p_staff_nome: profSelect.value ? profOpt.getAttribute('data-nome') : null,
          p_servico: document.getElementById('dashAgServico').value,
          p_dia: dataInput,
          p_dia_label: diaLabel,
          p_horario: document.getElementById('dashAgHorario').value
        }).then(function (res) {
          if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
          // renderizarDashAgenda() troca todo o innerHTML da aba (inclusive
          // esse próprio <p class="msg">), então a confirmação precisa
          // vir por fora desse re-render — VBDialogo, não o <p>.
          renderizarDashAgenda();
          carregarEstabelecimentos();
          window.VBDialogo.alert('Agendamento criado!');
        }, function () { msg.className = 'msg msg-erro'; msg.textContent = 'Sem conexão agora.'; });
      });

      document.getElementById('dashAgendaLista').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-status-agendamento-id]');
        if (!btn) return;
        btn.disabled = true;
        db.rpc('tenant_admin_atualizar_agendamento', {
          p_estabelecimento_id: estabId,
          p_id: btn.getAttribute('data-status-agendamento-id'),
          p_status: btn.getAttribute('data-status-novo')
        }).then(function () {
          renderizarDashAgenda();
          carregarEstabelecimentos();
        });
      });

      var exportarBtn = document.getElementById('dashAgendaExportar');
      if (exportarBtn) exportarBtn.addEventListener('click', function () {
        baixarCsv('agenda.csv', ['Cliente', 'Telefone', 'Serviço', 'Profissional', 'Dia', 'Horário', 'Status'], linhas.map(function (a) {
          return [a.cliente_nome, a.cliente_telefone, a.servico, a.staff_nome, a.dia_label || a.dia, a.horario, STATUS_LABEL[a.status] || a.status];
        }));
      });
    }, function () { dashboardCorpo.classList.remove('dash-carregando'); dashboardCorpo.innerHTML = '<p class="msg msg-erro">Sem conexão agora.</p>'; });
  }

  function renderizarDashClientes() {
    var estabId = dashEstabId;
    db.rpc('tenant_admin_listar_clientes', { p_estabelecimento_id: estabId }).then(function (res) {
      if (dashEstabId !== estabId) return;
      var linhas = res.data || [];
      dashboardCorpo.classList.remove('dash-carregando');
      dashboardCorpo.innerHTML =
        '<p class="dash-secao-intro" style="margin-top:0;">Todo cliente que agenda pelo site — ou é cadastrado na aba Agenda — entra aqui automaticamente, com quantas vezes já voltou.</p>' +
        '<div class="dash-lista-cabecalho"><p class="dash-resumo-subtitulo" style="margin:0;">Clientes cadastrados</p>' +
        (linhas.length ? '<button type="button" class="btn btn-ghost" id="dashClientesExportar" style="padding:0.3rem 0.7rem; font-size:0.78rem;">Exportar planilha (CSV)</button>' : '') +
        '</div>' +
        (linhas.length ? linhas.map(function (c) {
          return '<div class="painel-lista-item"><span><span class="principal">' + escapeHtml(c.nome) + '</span><br>' +
            '<span class="secundario">' + escapeHtml(c.telefone) + '</span></span>' +
            '<span class="secundario">' + c.total_visitas + ' visita(s)</span></div>';
        }).join('') : blocoVazio(ICONE_VAZIO_CLIENTES, 'Nenhum cliente ainda', 'Assim que alguém agendar pelo seu site — ou você cadastrar um agendamento manual na aba Agenda — o cliente aparece aqui, com o total de visitas atualizado a cada nova vinda.'));
      var exportarBtn = document.getElementById('dashClientesExportar');
      if (exportarBtn) exportarBtn.addEventListener('click', function () {
        baixarCsv('clientes.csv', ['Nome', 'Telefone', 'Visitas', 'Primeira visita', 'Última visita'], linhas.map(function (c) {
          return [c.nome, c.telefone, c.total_visitas, c.primeira_visita, c.ultima_visita];
        }));
      });
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

      dashboardCorpo.classList.remove('dash-carregando');
      dashboardCorpo.innerHTML =
        '<p class="dash-secao-intro" style="margin-top:0;">Toque no serviço vendido — o valor já vem preenchido, é só confirmar a forma de pagamento e registrar.</p>' +
        '<div class="dash-caixa-servicos" id="caixaServicos">' +
        servicos.map(function (s) {
          return '<button type="button" class="dash-caixa-servico-btn" data-caixa-servico-id="' + s.id + '" data-preco="' + s.preco + '" data-nome="' + escapeHtml(s.nome) + '">' +
            '<span class="dash-caixa-servico-nome">' + escapeHtml(s.nome) + '</span>' +
            '<span class="dash-caixa-servico-preco">' + formatarPreco(s.preco) + '</span>' +
            '</button>';
        }).join('') +
        '<button type="button" class="dash-caixa-servico-btn is-avulso is-selecionada" data-caixa-servico-id="">' +
        '<span class="dash-caixa-servico-nome">Item avulso</span><span class="dash-caixa-servico-preco">outro valor</span>' +
        '</button>' +
        '</div>' +
        (equipe.length ? '<p class="dash-resumo-subtitulo" style="margin-top:0;">Quem atendeu</p><div class="dash-forma-pagamento" id="caixaProfissionalBotoes" style="margin-bottom:1rem;">' +
          '<button type="button" class="dash-forma-btn is-selecionada" data-staff-id="" data-staff-nome="">Sem informar</button>' +
          equipe.map(function (p) { return '<button type="button" class="dash-forma-btn" data-staff-id="' + p.id + '" data-staff-nome="' + escapeHtml(p.nome) + '">' + escapeHtml(p.nome) + '</button>'; }).join('') +
          '</div>' : '') +
        '<form id="caixaForm" class="dash-campos-grid">' +
        '<div class="field field-full" id="caixaDescricaoWrap"><label for="caixaDescricao">Descrição</label><input type="text" id="caixaDescricao" placeholder="Ex: Produto avulso"></div>' +
        '<div class="field"><label for="caixaClienteNome">Nome do cliente (opcional)</label><input type="text" id="caixaClienteNome" placeholder="Ex: Maria Silva"></div>' +
        '<div class="field"><label for="caixaClienteTelefone">Telefone do cliente (opcional)</label><input type="text" id="caixaClienteTelefone" placeholder="Ex: 15999998888"></div>' +
        '<div class="field"><label for="caixaValor">Valor (R$)</label><input type="number" id="caixaValor" min="0" step="0.01" placeholder="0,00" required></div>' +
        '<div class="field"><label>Forma de pagamento</label><div class="dash-forma-pagamento" id="caixaFormaBotoes">' +
        FORMAS_PAGAMENTO.map(function (f, i) { return '<button type="button" class="dash-forma-btn' + (i === 0 ? ' is-selecionada' : '') + '" data-forma="' + f.chave + '">' + f.nome + '</button>'; }).join('') +
        '</div></div>' +
        '<button class="btn btn-primario field-full" type="submit">Registrar venda</button>' +
        '</form>' +
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
        (vendas.length ? '<button type="button" class="btn btn-ghost" id="caixaExportar" style="padding:0.3rem 0.7rem; font-size:0.78rem;">Exportar planilha (CSV)</button>' : '') +
        '</div>' +
        '<div id="caixaLista">' + (vendas.length ? vendas.map(function (v) {
          var detalhes = [FORMAS_PAGAMENTO.filter(function (f) { return f.chave === v.forma_pagamento; }).map(function (f) { return f.nome; })[0]];
          if (v.staff_nome) detalhes.push(v.staff_nome);
          if (v.cliente_nome) detalhes.push(v.cliente_nome);
          return '<div class="painel-lista-item"><span><span class="principal">' + escapeHtml(v.descricao) + '</span><br>' +
            '<span class="secundario">' + escapeHtml(detalhes.join(' · ')) + '</span></span>' +
            '<span><strong>' + formatarPreco(v.valor) + '</strong> <button type="button" class="btn btn-ghost" style="padding:0.25rem 0.5rem; font-size:0.72rem;" data-remover-venda="' + v.id + '">✕</button></span></div>';
        }).join('') : blocoVazio(ICONE_VAZIO_CAIXA, 'Nenhuma venda hoje ainda', 'Toda venda registrada aqui entra no faturamento do dia e também alimenta o gráfico da aba Resumo.')) + '</div>';

      var servicoIdSelecionado = null;
      var nomeSelecionado = null;
      var descricaoInput = document.getElementById('caixaDescricao');
      var valorInput = document.getElementById('caixaValor');
      var descricaoWrap = document.getElementById('caixaDescricaoWrap');

      function selecionarServicoBtn(btn) {
        document.querySelectorAll('#caixaServicos .dash-caixa-servico-btn').forEach(function (b) { b.classList.remove('is-selecionada'); });
        btn.classList.add('is-selecionada');
        servicoIdSelecionado = btn.getAttribute('data-caixa-servico-id') || null;
        nomeSelecionado = btn.getAttribute('data-nome') || null;
        if (servicoIdSelecionado) {
          valorInput.value = btn.getAttribute('data-preco') || '';
          descricaoInput.value = nomeSelecionado;
          descricaoWrap.classList.add('oculto');
        } else {
          valorInput.value = '';
          descricaoInput.value = '';
          descricaoWrap.classList.remove('oculto');
          descricaoInput.focus();
        }
      }
      document.getElementById('caixaServicos').addEventListener('click', function (e) {
        var btn = e.target.closest('.dash-caixa-servico-btn');
        if (!btn) return;
        selecionarServicoBtn(btn);
      });
      // "Item avulso" já começa selecionado (nenhum serviço cadastrado
      // ainda, ou dono quer lançar algo fora da lista) — mostra a
      // descrição livre desde o início.
      descricaoWrap.classList.remove('oculto');

      document.getElementById('caixaFormaBotoes').addEventListener('click', function (e) {
        var btn = e.target.closest('.dash-forma-btn');
        if (!btn) return;
        document.querySelectorAll('#caixaFormaBotoes .dash-forma-btn').forEach(function (b) { b.classList.remove('is-selecionada'); });
        btn.classList.add('is-selecionada');
      });
      var profissionalBotoes = document.getElementById('caixaProfissionalBotoes');
      if (profissionalBotoes) profissionalBotoes.addEventListener('click', function (e) {
        var btn = e.target.closest('.dash-forma-btn');
        if (!btn) return;
        profissionalBotoes.querySelectorAll('.dash-forma-btn').forEach(function (b) { b.classList.remove('is-selecionada'); });
        btn.classList.add('is-selecionada');
      });

      document.getElementById('caixaForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = document.getElementById('caixaMsg');
        var descricao = descricaoInput.value.trim() || nomeSelecionado;
        if (!descricao) { msg.className = 'msg msg-erro'; msg.textContent = 'Descreva o que foi vendido.'; return; }
        var formaBtn = document.querySelector('#caixaFormaBotoes .dash-forma-btn.is-selecionada');
        var staffBtn = profissionalBotoes ? profissionalBotoes.querySelector('.dash-forma-btn.is-selecionada') : null;
        msg.className = 'msg';
        msg.textContent = 'Registrando…';
        db.rpc('tenant_admin_registrar_venda', {
          p_estabelecimento_id: estabId,
          p_descricao: descricao,
          p_valor: parseFloat(valorInput.value) || 0,
          p_forma_pagamento: formaBtn ? formaBtn.getAttribute('data-forma') : FORMAS_PAGAMENTO[0].chave,
          p_servico_id: servicoIdSelecionado,
          p_staff_id: staffBtn ? (staffBtn.getAttribute('data-staff-id') || null) : null,
          p_staff_nome: staffBtn ? (staffBtn.getAttribute('data-staff-nome') || null) : null,
          p_cliente_nome: document.getElementById('caixaClienteNome').value.trim() || null,
          p_cliente_telefone: document.getElementById('caixaClienteTelefone').value.trim() || null
        }).then(function (res) {
          if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
          renderizarDashCaixa();
          carregarEstabelecimentos();
        }, function () { msg.className = 'msg msg-erro'; msg.textContent = 'Sem conexão agora.'; });
      });
      document.getElementById('caixaLista').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-remover-venda]');
        if (!btn) return;
        db.rpc('tenant_admin_remover_venda', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-venda') }).then(renderizarDashCaixa);
      });
      var exportarBtn = document.getElementById('caixaExportar');
      if (exportarBtn) exportarBtn.addEventListener('click', function () {
        baixarCsv('vendas.csv', ['Descrição', 'Valor', 'Forma de pagamento', 'Profissional', 'Cliente', 'Telefone do cliente', 'Data'], vendas.map(function (v) {
          return [v.descricao, v.valor, FORMAS_PAGAMENTO.filter(function (f) { return f.chave === v.forma_pagamento; }).map(function (f) { return f.nome; })[0], v.staff_nome, v.cliente_nome, v.cliente_telefone, v.criado_em];
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
