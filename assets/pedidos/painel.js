/* Painel da área Delivery / Serviços do estabelecimento (painel-area.html).
   Mesmo login e mesmo negócio da Agenda — o cubo do topo troca de área.
   Abas: Pedidos/Chamados/Orçamentos (chega na hora, som, impressão,
   andamento), Cardápio/Serviços, Loja (dados, entrega, pagamento,
   horários, fotos, visual) e Resumo. */
(function () {
  'use strict';

  var U = window.VB;
  var Tema = window.VBTema;
  var IMP = window.VBImpressora;
  var db = window.db;
  var $ = function (id) { return document.getElementById(id); };
  var esc = U.escapeHtml;
  var q = new URLSearchParams(location.search);

  var LOJA_KEY = 'vbdelivery_loja_atual';
  var SOM_KEY = 'vbdelivery_som';
  var POLL_MS = 12000;

  var sessao = null;
  var lojas = [];
  var loja = null;
  var categorias = [], itens = [], bordas = [], combos = [];
  var pedidos = [];
  var conhecidos = null;
  var filtro = 'ativos';
  var somLigado = !!U.lerLocal(SOM_KEY, false);
  var audioCtx = null;
  var modoLogin = 'entrar';
  var rascunho = {};
  var timerPoll = null;
  var diasResumo = 30;
  var tituloOriginal = document.title;
  var V = U.vocab('pizzaria');
  var SERVICO = false;
  var URGENTE = false;
  var negocio = null;

  /* ===================== utilidades ===================== */
  function mostrarTela(id) {
    ['telaCarregando', 'telaAtivar', 'app'].forEach(function (x) { $(x).classList.toggle('oculto', x !== id); });
  }

  function preencherIcones(raiz) {
    (raiz || document).querySelectorAll('[data-icone]').forEach(function (el) {
      el.outerHTML = U.ICONES[el.getAttribute('data-icone')] || '';
    });
  }

  function tempoAtras(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'agora';
    if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function confirmar(texto) { return window.confirm(texto); }

  async function rpc(nome, params, msgErro) {
    var r = await db.rpc(nome, params || {});
    if (r.error) {
      U.toast(U.mensagemErro(r.error, msgErro || 'Não deu certo, tenta de novo.'), 3200);
      throw r.error;
    }
    return r.data;
  }

  /* ===================== sheet ===================== */
  var sheetAberto = false;
  function abrirSheet(titulo, corpo, rodape) {
    $('sheetConteudo').innerHTML =
      '<div class="sheet-cabeca"><h2 class="sheet-titulo" id="sheetTitulo">' + esc(titulo) + '</h2>' +
      '<button type="button" class="sheet-x" data-fechar-sheet aria-label="Fechar">' + U.ICONES.x + '</button></div>' +
      '<div class="sheet-corpo">' + corpo + '</div>' + (rodape ? '<div class="sheet-rodape">' + rodape + '</div>' : '');
    if (!sheetAberto) {
      sheetAberto = true;
      $('sheet').classList.add('aberto');
      $('sheet').setAttribute('aria-hidden', 'false');
      document.body.classList.add('travado');
      try { history.pushState({ vbSheet: true }, ''); } catch (e) {}
    }
  }
  function fecharSheet(viaHistorico) {
    if (!sheetAberto) return;
    sheetAberto = false;
    $('sheet').classList.remove('aberto');
    $('sheet').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('travado');
    if (!viaHistorico && history.state && history.state.vbSheet) { try { history.back(); } catch (e) {} }
  }

  document.addEventListener('click', async function (e) {
    if (e.target.closest('[data-sair]')) {
      await db.auth.signOut();
      location.href = '/cadastro.html';
    }
  });

  /* ===================== lojas ===================== */
  async function carregarLojas() {
    var rn = await db.rpc('vibe_meu_negocio');
    negocio = rn.data || null;
    if (!negocio) { location.href = '/criar.html'; return; }
    var areas = negocio.areas || [];
    if (areas.indexOf('delivery') === -1 && areas.indexOf('servicos') === -1) { mostrarTelaAtivar(); return; }
    var r = await db.rpc('delivery_admin_meus_estabelecimentos');
    lojas = r.data || [];
    loja = lojas.find(function (l) { return l.id === negocio.id; });
    if (!loja) { mostrarTelaAtivar(); return; }
    loja.areas = areas;
    mostrarTela('app');
    montarCubo();
    await abrirLoja();
    if (q.get('nova') === '1') abrirBoasVindas();
  }

  function areaAtual() { return (negocio.areas || []).indexOf('servicos') !== -1 ? 'servicos' : 'delivery'; }

  function montarCubo() {
    var N = VibeToggle.NOMES;
    var temAgenda = (negocio.areas || []).indexOf('agenda') !== -1;
    var opcoes = [{ chave: areaAtual(), rotulo: N[areaAtual()] }];
    if (temAgenda) opcoes.unshift({ chave: 'agenda', rotulo: N.agenda });
    VibeToggle.montar($('pAreas'), {
      tema: 'claro', atual: areaAtual(), swipe: temAgenda, rotulo: 'Áreas do negócio', opcoes: opcoes,
      aoTrocar: function (area) { if (area === 'agenda') location.href = '/cadastro.html?abrir=' + encodeURIComponent(negocio.id); },
      extra: temAgenda ? null : { rotulo: 'Ativar a Agenda', aoClicar: function () {
        if (!confirmar('Ativar a Agenda (horários online) neste negócio?')) return;
        definirAreas(negocio.areas.concat(['agenda'])).then(function (ok) {
          if (ok) { VibeToggle.marcarDirecao('volta'); location.href = '/cadastro.html?abrir=' + encodeURIComponent(negocio.id); }
        });
      } }
    });
    VibeToggle.tingir(areaAtual());
  }

  async function definirAreas(areas, onde) {
    var r = await db.rpc('estabelecimento_definir_areas', { p_estabelecimento_id: negocio.id, p_areas: areas, p_servico_onde: onde || null });
    if (r.error) { U.toast(U.mensagemErro(r.error), 3500); return false; }
    return true;
  }

  // negócio ainda sem Delivery/Serviços: escolhe qual ativar (e onde atende)
  var ativarEscolha = null, ativarOnde = 'cliente';
  function mostrarTelaAtivar() {
    mostrarTela('telaAtivar');
    VibeToggle.tingir('delivery');
    $('ativarOpcoes').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ativar]');
      if (!b) return;
      ativarEscolha = b.getAttribute('data-ativar');
      document.querySelectorAll('[data-ativar]').forEach(function (x) { x.classList.toggle('ativo', x === b); });
      $('ativarOnde').classList.toggle('oculto', ativarEscolha !== 'servicos');
      VibeToggle.tingir(ativarEscolha);
      $('ativarBtn').disabled = false;
      $('ativarBtn').textContent = 'Ativar ' + (ativarEscolha === 'delivery' ? 'Delivery' : 'Serviços');
    });
    $('segOnde').addEventListener('click', function (e) {
      var b = e.target.closest('[data-onde]');
      if (!b) return;
      ativarOnde = b.getAttribute('data-onde');
      document.querySelectorAll('[data-onde]').forEach(function (x) { x.classList.toggle('ativo', x === b); });
    });
    $('ativarBtn').addEventListener('click', async function () {
      if (!ativarEscolha) return;
      this.disabled = true;
      var areas = (negocio.areas || []).filter(function (a) { return a === 'agenda'; }).concat([ativarEscolha]);
      if (await definirAreas(areas, ativarEscolha === 'servicos' ? ativarOnde : null)) location.href = '/painel-area.html?nova=1';
      else this.disabled = false;
    });
  }

  function aplicarVocabulario() {
    V = U.vocab(loja.segmento, loja.modo);
    SERVICO = U.modoDoSegmento(loja.segmento, loja.modo) === 'servico';
    URGENTE = SERVICO && U.tipoServico(loja.segmento) === 'chamado';
    document.title = V.pedidos + ' · ' + loja.nome;
    var abaPed = document.querySelector('[data-aba="pedidos"]');
    abaPed.childNodes.forEach(function (n) { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = V.pedidos; });
    var abaCar = document.querySelector('[data-aba="cardapio"]');
    abaCar.childNodes.forEach(function (n) { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = V.itens; });
    var t = function (id, txt) { var el = $(id); if (el) el.textContent = txt; };
    t('rotuloEntrega', SERVICO ? (URGENTE ? 'Atendo no local do cliente (socorro)' : 'Vou até o cliente') : 'Faço entrega');
    t('rotuloRetirada', SERVICO ? 'Cliente pode vir até a loja' : 'Cliente pode retirar na loja');
    t('rotuloTaxa', SERVICO ? (URGENTE ? 'Taxa de deslocamento (R$)' : 'Taxa de visita (R$)') : 'Taxa de entrega (R$)');
    t('rotuloTempoMin', !SERVICO ? 'Tempo mín. (min)' : URGENTE ? 'Chega em (mín., min)' : 'Visita em (mín., dias)');
    t('rotuloTempoMax', !SERVICO ? 'Tempo máx. (min)' : URGENTE ? 'Chega em (máx., min)' : 'Visita em (máx., dias)');
    t('tituloLayouts', SERVICO ? 'Como os serviços aparecem' : 'Como o cardápio aparece');
    t('tituloEntrega', SERVICO ? 'Atendimento' : 'Entrega e retirada');
    t('tituloItens', V.itens === 'Cardápio' ? 'Itens' : 'Serviços');
    t('novoItemBtn', SERVICO ? '+ Novo serviço' : '+ Novo item');
    document.querySelectorAll('[data-so-cardapio]').forEach(function (el) { el.classList.toggle('oculto', SERVICO); });
  }

  async function abrirLoja() {
    try { localStorage.setItem(LOJA_KEY, loja.id); } catch (e) {}
    aplicarVocabulario();
    rascunho = {};
    atualizarBarraSalvar();
    renderizarTopo();
    renderizarStatusLoja();
    preencherFormLoja();
    montarAparencia(true);
    conhecidos = null;
    await Promise.all([carregarCardapio(), carregarPedidos(true)]);
    iniciarPolling();
    trocarAba((location.hash || '#pedidos').slice(1), true);
  }

  function urlSite() { return location.origin + '/' + loja.slug + '/' + loja.cidade + '/pedir'; }

  function renderizarTopo() {
    $('pNome').textContent = loja.nome;
    $('pSegmento').textContent = U.SEGMENTOS[loja.segmento] || 'Estabelecimento';
    $('pMenuSite').href = urlSite();
    var logo = $('pLogo');
    if (loja.foto_perfil_url) { logo.style.backgroundImage = 'url("' + encodeURI(loja.foto_perfil_url) + '")'; logo.textContent = ''; }
    else { logo.style.backgroundImage = ''; logo.textContent = loja.nome.charAt(0).toUpperCase(); }
    $('pVerSite').href = urlSite();
    $('linkSite').textContent = urlSite().replace(/^https?:\/\//, '');
    $('abrirSiteBtn').href = urlSite();
  }

  /* ===================== abas ===================== */
  function trocarAba(nome, semHistorico) {
    if (['pedidos', 'cardapio', 'loja', 'resumo'].indexOf(nome) === -1) nome = 'pedidos';
    document.querySelectorAll('.p-aba-btn').forEach(function (b) { b.classList.toggle('ativa', b.getAttribute('data-aba') === nome); });
    ['pedidos', 'cardapio', 'loja', 'resumo'].forEach(function (a) {
      $('aba' + a.charAt(0).toUpperCase() + a.slice(1)).classList.toggle('oculto', a !== nome);
    });
    if (!semHistorico) { try { history.replaceState(history.state, '', '#' + nome); } catch (e) {} }
    window.scrollTo(0, 0);
    if (nome === 'resumo') carregarResumo();
    if (nome === 'loja') { montarAparencia(); gerarQr(); }
  }

  /* ===================== pedidos (caixa) ===================== */
  var ORDEM_STATUS = { novo: 0, preparando: 1, saiu_entrega: 2, concluido: 3, cancelado: 4 };
  var ROTULO_STATUS = { novo: 'Novo', preparando: 'Preparando', saiu_entrega: 'Saiu', concluido: 'Concluído', cancelado: 'Cancelado' };
  function rotuloStatusAdmin(p) {
    if (SERVICO && p.status === 'preparando') return 'Confirmado';
    if (p.status === 'saiu_entrega') return p.forma_entrega === 'retirada' ? (SERVICO ? 'Pode vir' : 'Pronto') : (SERVICO ? 'A caminho' : 'Saiu');
    return ROTULO_STATUS[p.status];
  }

  function iniciarPolling() {
    clearInterval(timerPoll);
    timerPoll = setInterval(function () { if (document.visibilityState === 'visible') carregarPedidos(true); }, POLL_MS);
  }

  async function carregarPedidos(silencioso) {
    if (!loja) return;
    var r = await db.rpc('delivery_admin_listar_pedidos', { p_estabelecimento_id: loja.id, p_status: null, p_limite: 150 });
    if (r.error) { if (!silencioso) U.toast('Não consegui atualizar os pedidos'); return; }
    var lista = r.data || [];
    var novos = [];
    if (conhecidos) lista.forEach(function (p) { if (!conhecidos.has(p.id) && p.status === 'novo') novos.push(p); });
    conhecidos = new Set(lista.map(function (p) { return p.id; }));
    pedidos = lista;
    renderizarPedidos(novos.map(function (p) { return p.id; }));
    atualizarBadges();
    if (novos.length) alertarNovos(novos);
  }

  function atualizarBadges() {
    var nNovos = pedidos.filter(function (p) { return p.status === 'novo'; }).length;
    var nAtivos = pedidos.filter(function (p) { return ORDEM_STATUS[p.status] < 3; }).length;
    $('badgeNovos').textContent = nNovos || '';
    $('nNovos').textContent = nNovos ? ' ' + nNovos : '';
    $('nAtivos').textContent = nAtivos ? ' ' + nAtivos : '';
    document.title = nNovos ? '(' + nNovos + ') Novo ' + V.pedido.toLowerCase() + ' · VB Delivery' : tituloOriginal;
  }

  function bip() {
    if (!somLigado) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.22, 0.44].forEach(function (t, i) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = i === 2 ? 1320 : 880;
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.18);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
      });
    } catch (e) {}
  }

  function alertarNovos(novos) {
    bip();
    if (navigator.vibrate) navigator.vibrate([220, 120, 220]);
    U.toast(novos.length > 1 ? novos.length + ' ' + V.pedidos.toLowerCase() + ' novos!' : 'Novo ' + V.pedido.toLowerCase() + ' #' + novos[0].numero + '!', 3500);
    var est = IMP.estado();
    if (est.autoImprimir && est.conectada) {
      novos.slice().reverse().forEach(function (p) {
        IMP.imprimirPedido(p, loja).catch(function (err) { U.toast(U.mensagemErro(err, 'Falha ao imprimir'), 3500); });
      });
    }
  }

  function filtrarPedidos() {
    var lista = pedidos.filter(function (p) {
      if (filtro === 'ativos') return ORDEM_STATUS[p.status] < 3;
      if (filtro === 'todos') return true;
      return p.status === filtro;
    });
    if (filtro === 'ativos' || filtro === 'novo') {
      lista.sort(function (a, b) { return (ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]) || (new Date(a.criado_em) - new Date(b.criado_em)); });
    }
    return lista;
  }

  function proximoPasso(p) {
    if (p.status === 'novo') return { status: 'preparando', rotulo: 'Aceitar' };
    if (p.status === 'preparando') return { status: 'saiu_entrega', rotulo: p.forma_entrega === 'retirada' ? (SERVICO ? 'Pode vir' : 'Pronto p/ retirar') : (SERVICO ? 'Estou a caminho' : 'Saiu p/ entrega') };
    if (p.status === 'saiu_entrega') return { status: 'concluido', rotulo: 'Concluir' };
    return null;
  }

  function renderizarPedidos(recemIds) {
    var lista = filtrarPedidos();
    if (!lista.length) {
      var vazio = filtro === 'ativos'
        ? 'Nenhum ' + V.pedido.toLowerCase() + ' em andamento.<br>Quando chegar um, ele aparece aqui na hora' + (somLigado ? ' com som.' : ' — ative o som pra ser avisado.')
        : 'Nada por aqui.';
      $('listaPedidos').innerHTML = '<div class="pa-vazio">' + U.ICONES.pedidos + vazio + '</div>';
      return;
    }
    $('listaPedidos').innerHTML = lista.map(function (p) {
      var passo = proximoPasso(p);
      var entrega = p.forma_entrega === 'entrega';
      var tags = [entrega ? (SERVICO ? 'No local do cliente' : 'Entrega') : (SERVICO ? 'Vem até a loja' : 'Retirada')];
      var det = p.detalhes || {};
      if (det.veiculo || det.modelo) tags.push([det.veiculo, det.modelo].filter(Boolean).join(' · '));
      if (p.forma_pagamento) tags.push((U.PAGAMENTOS[p.forma_pagamento] || p.forma_pagamento) + (p.troco_para ? ' · troco p/ ' + U.preco(p.troco_para) : ''));
      return '<article class="pa-card status-' + p.status + ((recemIds || []).indexOf(p.id) !== -1 ? ' recem' : '') + '" data-pedido="' + p.id + '">' +
        '<div class="pa-topo"><div><strong>#' + (p.numero || '—') + '</strong><span class="pa-tempo">' + tempoAtras(p.criado_em) + '</span></div>' +
        '<span class="pa-status">' + rotuloStatusAdmin(p) + '</span></div>' +
        '<div class="pa-cliente"><strong>' + esc(p.cliente_nome) + '</strong> · ' + esc(U.formatarTelefone(p.cliente_telefone)) + '</div>' +
        '<div class="pa-tags">' + tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
        (entrega && (p.endereco_entrega || p.referencia) ? '<div class="pa-end">' + esc(p.endereco_entrega || '') + (p.referencia ? (p.endereco_entrega ? ' — ' : '') + esc(p.referencia) : '') + '</div>' : '') +
        (entrega && p.localizacao_lat != null ? '<div class="pa-mapa">' +
          '<a class="btn mini sec" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + p.localizacao_lat + ',' + p.localizacao_lng + '">' + U.ICONES.local.replace('<svg', '<svg width="16" height="16"') + 'Ver no mapa</a>' +
          '<a class="btn mini" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + p.localizacao_lat + ',' + p.localizacao_lng + '">' + U.ICONES.rota.replace('<svg', '<svg width="16" height="16"') + 'Rota</a>' +
          (det.precisao_m ? '<small>GPS ±' + det.precisao_m + ' m</small>' : '') + '</div>' : '') +
        '<ul class="pa-itens">' + (p.itens || []).map(function (l) {
          return '<li><b>' + l.qtd + 'x</b><span>' + esc(l.descricao) + '</span><em>' + U.precoOuCombinar(l.total != null ? l.total : l.preco * l.qtd) + '</em>' +
            (l.obs ? '<small>“' + esc(l.obs) + '”</small>' : '') + '</li>';
        }).join('') + '</ul>' +
        (p.observacao ? '<div class="pa-obs"><strong>Obs.:</strong> ' + esc(p.observacao) + '</div>' : '') +
        '<div class="pa-rodape"><span class="pa-total">' + U.preco(p.total) + '</span><div class="pa-acoes">' +
          '<button type="button" class="icon-btn" data-imprimir="' + p.id + '" aria-label="Imprimir" title="Imprimir">' + U.ICONES.impressora + '</button>' +
          '<a class="icon-btn" data-whats-cliente="' + p.id + '" target="_blank" rel="noopener" aria-label="WhatsApp do cliente" title="WhatsApp do cliente" href="' + esc(linkWhatsCliente(p)) + '">' + U.ICONES.whats + '</a>' +
          (ORDEM_STATUS[p.status] < 3 ? '<button type="button" class="icon-btn" data-cancelar="' + p.id + '" aria-label="Cancelar pedido" title="Cancelar pedido">' + U.ICONES.x + '</button>' : '') +
          (passo ? '<button type="button" class="btn mini" data-avancar="' + p.id + '" data-para="' + passo.status + '">' + passo.rotulo + '</button>' : '') +
        '</div></div></article>';
    }).join('');
  }

  function linkWhatsCliente(p) {
    var d = U.soDigitos(p.cliente_telefone);
    if (d.length <= 11) d = '55' + d;
    var primeiro = (p.cliente_nome || '').split(' ')[0];
    var textos = {
      novo: 'Olá ' + primeiro + '! Recebemos seu pedido #' + p.numero + ' na ' + loja.nome + '. Já já começamos a preparar!',
      preparando: SERVICO ? 'Olá ' + primeiro + '! Aqui é da ' + loja.nome + ', recebemos seu chamado #' + p.numero + ' e já vamos sair.' : 'Olá ' + primeiro + '! Seu pedido #' + p.numero + ' da ' + loja.nome + ' já está sendo preparado.',
      saiu_entrega: SERVICO
        ? (p.forma_entrega === 'retirada' ? 'Olá ' + primeiro + '! Pode vir até a ' + loja.nome + ' que já estamos te esperando.' : 'Olá ' + primeiro + '! Aqui é da ' + loja.nome + ', estou a caminho do seu local. Qualquer coisa me chama aqui.')
        : p.forma_entrega === 'retirada'
          ? 'Olá ' + primeiro + '! Seu pedido #' + p.numero + ' da ' + loja.nome + ' está pronto pra retirar.'
          : 'Olá ' + primeiro + '! Seu pedido #' + p.numero + ' da ' + loja.nome + ' saiu pra entrega e já está a caminho.',
      concluido: 'Olá ' + primeiro + '! Obrigado ' + (SERVICO ? 'pela confiança' : 'pelo pedido #' + p.numero) + '. Volte sempre!',
      cancelado: 'Olá ' + primeiro + ', sobre seu pedido #' + p.numero + ' na ' + loja.nome + ':'
    };
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(textos[p.status] || '');
  }

  async function mudarStatus(id, status) {
    var p = pedidos.find(function (x) { return x.id === id; });
    if (!p) return;
    var anterior = p.status;
    p.status = status;
    renderizarPedidos();
    atualizarBadges();
    try {
      await rpc('delivery_admin_atualizar_status_pedido', { p_id: id, p_estabelecimento_id: loja.id, p_status: status });
      if (status === 'preparando') U.toast('Pedido #' + p.numero + ' aceito');
    } catch (e) {
      p.status = anterior;
      renderizarPedidos();
      atualizarBadges();
    }
  }

  function ligarPedidos() {
    $('filtrosPedidos').addEventListener('click', function (e) {
      var b = e.target.closest('[data-filtro]');
      if (!b) return;
      filtro = b.getAttribute('data-filtro');
      document.querySelectorAll('#filtrosPedidos .p-filtro').forEach(function (x) { x.classList.toggle('ativo', x === b); });
      renderizarPedidos();
    });
    $('listaPedidos').addEventListener('click', function (e) {
      var av = e.target.closest('[data-avancar]');
      if (av) { mudarStatus(av.getAttribute('data-avancar'), av.getAttribute('data-para')); return; }
      var ca = e.target.closest('[data-cancelar]');
      if (ca) {
        var p = pedidos.find(function (x) { return x.id === ca.getAttribute('data-cancelar'); });
        if (p && confirmar('Cancelar o pedido #' + p.numero + ' de ' + p.cliente_nome + '?')) mudarStatus(p.id, 'cancelado');
        return;
      }
      var im = e.target.closest('[data-imprimir]');
      if (im) {
        var ped = pedidos.find(function (x) { return x.id === im.getAttribute('data-imprimir'); });
        if (!IMP.estado().conectada) { abrirImpressora(ped); return; }
        IMP.imprimirPedido(ped, loja).then(function () { U.toast('Enviado pra impressora'); })
          .catch(function (err) { U.toast(U.mensagemErro(err, 'Falha ao imprimir'), 3500); });
      }
    });
    $('segStatus').addEventListener('click', async function (e) {
      var b = e.target.closest('[data-status-manual]');
      if (!b) return;
      var novo = b.getAttribute('data-status-manual');
      var anterior = loja.status_manual;
      loja.status_manual = novo;
      renderizarStatusLoja();
      try {
        var atualizada = await rpc('delivery_admin_atualizar_estabelecimento', { p_id: loja.id, p_campos: { status_manual: novo } });
        Object.assign(loja, atualizada);
        U.toast(novo === 'fechado' ? 'Loja fechada — o site não aceita pedidos' : novo === 'aberto' ? 'Loja aberta agora' : 'Seguindo o horário de funcionamento');
      } catch (err) { loja.status_manual = anterior; renderizarStatusLoja(); }
    });
    $('btnSom').addEventListener('click', function () {
      somLigado = !somLigado;
      U.gravarLocal(SOM_KEY, somLigado);
      if (somLigado) {
        try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) {}
        bip();
      }
      renderizarSom();
      renderizarPedidos();
    });
    $('btnImpressora').addEventListener('click', function () { abrirImpressora(); });
    IMP.aoMudar(renderizarImpressoraChip);
    renderizarSom();
    renderizarImpressoraChip();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && loja) carregarPedidos(true); });
    // som só toca depois de um toque na página (regra dos navegadores)
    document.addEventListener('pointerdown', function destravar() {
      if (somLigado) { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) {} }
      document.removeEventListener('pointerdown', destravar);
    });
    setInterval(function () {
      if (loja) renderizarStatusLoja();
      document.querySelectorAll('.pa-card').forEach(function (card) {
        var p = pedidos.find(function (x) { return x.id === card.getAttribute('data-pedido'); });
        var t = card.querySelector('.pa-tempo');
        if (p && t) t.textContent = tempoAtras(p.criado_em);
      });
    }, 30000);
  }

  function renderizarSom() {
    $('btnSom').classList.toggle('ligado', somLigado);
    $('somTxt').textContent = somLigado ? 'Som ligado' : 'Ativar som';
    $('somIcone').innerHTML = somLigado
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 16V11a6 6 0 0 1 9.5-4.9"/><path d="M18 11v5l1.5 2h-15"/><path d="M10 20a2 2 0 0 0 4 0"/><line x1="3" y1="3" x2="21" y2="21"/></svg>';
  }

  function renderizarImpressoraChip() {
    var est = IMP.estado();
    $('btnImpressora').classList.toggle('ligado', est.conectada);
    $('impTxt').textContent = est.conectada ? est.nome + (est.autoImprimir ? ' · automática' : '') : 'Conectar impressora';
  }

  function renderizarStatusLoja() {
    var aberta = U.lojaAberta(loja);
    $('stLoja').classList.toggle('fechada', !aberta);
    $('stLojaTxt').textContent = aberta ? 'Loja aberta' : 'Loja fechada';
    var temHorario = loja.horarios && Object.keys(loja.horarios).length;
    $('stLojaSub').textContent = loja.status_manual === 'auto'
      ? (temHorario ? 'Seguindo o horário de funcionamento' + (!aberta && U.proximaAbertura(loja) ? ' · ' + U.proximaAbertura(loja).toLowerCase() : '') : 'Sem horário definido — aberta sempre')
      : loja.status_manual === 'aberto' ? 'Aberta manualmente' : 'Fechada manualmente — não recebe pedidos';
    document.querySelectorAll('[data-status-manual]').forEach(function (b) { b.classList.toggle('ativo', b.getAttribute('data-status-manual') === loja.status_manual); });
  }

  /* ---------- impressora ---------- */
  function abrirImpressora(pedidoPendente) {
    var sup = IMP.suporte();
    var est = IMP.estado();
    var op = function (id, titulo, sub, ok) {
      return '<button type="button" class="opcao" data-imp="' + id + '" ' + (ok ? '' : 'disabled') + '>' +
        '<span class="opcao-nome">' + titulo + '<br><small style="font-weight:500;color:var(--ink-faint)">' + sub + '</small></span>' +
        (est.modo === id && est.conectada ? '<span class="opcao-extra" style="color:var(--ok)">Conectada</span>' : '') + '</button>';
    };
    var corpo =
      '<p class="sheet-desc">Escolha como sua impressora térmica está ligada. Fica salvo neste aparelho.</p>' +
      '<div class="opcoes" style="margin-top:.8rem">' +
      op('bluetooth', 'Bluetooth', sup.bluetooth ? 'Impressoras com Bluetooth LE — Chrome no Android ou no PC' : 'Indisponível neste navegador (use o Chrome)', sup.bluetooth) +
      op('rawbt', 'Bluetooth pelo app RawBT', sup.rawbt ? 'Pra impressoras Bluetooth comuns no Android (instale o RawBT na Play Store)' : 'Só no Android', sup.rawbt) +
      op('usb', 'Cabo USB / serial', sup.usb ? 'Chrome no computador, impressora ligada no cabo' : 'Indisponível aqui — use a opção abaixo', sup.usb) +
      op('navegador', 'Qualquer impressora (pelo navegador)', 'Abre a janela de impressão — funciona com cabo, Wi-Fi ou a impressora padrão do PC', true) +
      '</div>' +
      '<div class="grupo"><div class="grupo-titulo">Largura do papel</div><div class="seg">' +
      '<button type="button" data-largura="32" class="' + (est.largura === 32 ? 'ativo' : '') + '">58 mm</button>' +
      '<button type="button" data-largura="48" class="' + (est.largura === 48 ? 'ativo' : '') + '">80 mm</button></div></div>' +
      '<div class="grupo"><label class="switch"><input type="checkbox" id="impAuto" ' + (est.autoImprimir ? 'checked' : '') + '><span class="trilho"></span>Imprimir sozinho quando chegar pedido</label>' +
      '<p class="sheet-desc" style="font-size:.78rem;margin-top:.5rem">Deixe o painel aberto no aparelho ligado à impressora.</p></div>' +
      '<p class="p-msg" id="impMsg"></p>';
    var rodape = (est.conectada ? '<button type="button" class="btn sec" id="impDesconectar">Desconectar</button>' : '') +
      '<button type="button" class="btn cheio" id="impTeste" ' + (est.conectada ? '' : 'disabled') + '>' + (pedidoPendente ? 'Imprimir pedido #' + pedidoPendente.numero : 'Imprimir teste') + '</button>';
    abrirSheet('Impressora', corpo, rodape);

    var msg = function (t, tipo) { $('impMsg').textContent = t; $('impMsg').className = 'p-msg ' + (tipo || ''); };
    document.querySelectorAll('[data-imp]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var modo = b.getAttribute('data-imp');
        msg('Conectando…');
        try {
          if (modo === 'bluetooth') await IMP.conectarBluetooth();
          if (modo === 'usb') await IMP.conectarUSB();
          if (modo === 'rawbt') IMP.usarRawbt();
          if (modo === 'navegador') IMP.usarNavegador();
          abrirImpressora(pedidoPendente);
          U.toast('Impressora pronta');
        } catch (err) {
          if (err && err.name === 'NotFoundError') msg('Nenhuma impressora escolhida.', 'erro');
          else msg(U.mensagemErro(err, 'Não conectou'), 'erro');
        }
      });
    });
    document.querySelectorAll('[data-largura]').forEach(function (b) {
      b.addEventListener('click', function () { IMP.definirLargura(Number(b.getAttribute('data-largura'))); abrirImpressora(pedidoPendente); });
    });
    $('impAuto').addEventListener('change', function () { IMP.definirAuto(this.checked); });
    if ($('impDesconectar')) $('impDesconectar').addEventListener('click', function () { IMP.desconectar(); abrirImpressora(pedidoPendente); });
    $('impTeste').addEventListener('click', function () {
      var ped = pedidoPendente || {
        numero: 0, criado_em: new Date().toISOString(), cliente_nome: 'Teste de impressão', cliente_telefone: loja.telefone_whatsapp,
        forma_entrega: 'entrega', endereco_entrega: 'Rua Exemplo, 123 - Centro', referencia: 'portão azul',
        itens: [{ qtd: 1, descricao: 'Meio a meio: Calabresa / Portuguesa — borda Catupiry', total: 58.9, obs: 'sem cebola' }, { qtd: 2, descricao: 'Refrigerante 2L', total: 28 }],
        subtotal: 86.9, taxa_entrega: 6, total: 92.9, forma_pagamento: 'dinheiro', troco_para: 100, observacao: 'Campainha não funciona'
      };
      IMP.imprimirPedido(ped, loja).then(function () { msg('Enviado pra impressora.', 'ok'); })
        .catch(function (err) { msg(U.mensagemErro(err, 'Falha ao imprimir'), 'erro'); });
    });
  }

  /* ===================== cardápio ===================== */
  async function carregarCardapio() {
    var r = await Promise.all([
      db.rpc('delivery_admin_listar_categorias', { p_estabelecimento_id: loja.id }),
      db.rpc('delivery_admin_listar_itens', { p_estabelecimento_id: loja.id }),
      db.rpc('delivery_admin_listar_bordas', { p_estabelecimento_id: loja.id }),
      db.rpc('delivery_admin_listar_combos', { p_estabelecimento_id: loja.id })
    ]);
    categorias = r[0].data || [];
    itens = r[1].data || [];
    bordas = r[2].data || [];
    combos = r[3].data || [];
    renderizarCardapio();
  }

  function thumb(it) {
    return it.foto_url
      ? '<span class="ca-thumb" style="background-image:url(&quot;' + esc(encodeURI(it.foto_url)) + '&quot;)"></span>'
      : '<span class="ca-thumb">' + esc(it.nome.charAt(0).toUpperCase()) + '</span>';
  }

  function renderizarCardapio() {
    var grupos = categorias.map(function (c) { return { nome: c.nome, lista: itens.filter(function (i) { return i.categoria_id === c.id; }) }; });
    var sem = itens.filter(function (i) { return !categorias.some(function (c) { return c.id === i.categoria_id; }); });
    if (sem.length) grupos.push({ nome: 'Sem categoria', lista: sem });
    $('listaItens').innerHTML = itens.length ? grupos.filter(function (g) { return g.lista.length; }).map(function (g) {
      return '<p class="ca-grupo-titulo">' + esc(g.nome) + '</p>' + g.lista.map(function (i) {
        var flags = [];
        if (i.permite_meio_a_meio) flags.push('meio a meio');
        if (i.aceita_borda) flags.push('borda');
        return '<div class="ca-item' + (i.ativo ? '' : ' inativo') + '" data-editar-item="' + i.id + '">' + thumb(i) +
          '<div class="ca-info"><strong>' + esc(i.nome) + '</strong><small>' + U.precoOuCombinar(i.preco) + (flags.length ? ' · ' + flags.join(' · ') : '') + (i.ativo ? '' : (SERVICO ? ' · indisponível' : ' · esgotado')) + '</small></div>' +
          '<label class="switch" data-parar title="' + (i.ativo ? 'Disponível' : 'Esgotado') + '"><input type="checkbox" data-alternar="' + i.id + '" ' + (i.ativo ? 'checked' : '') + ' aria-label="Disponível"><span class="trilho"></span></label></div>';
      }).join('');
    }).join('') : '<p class="ca-vazio">Nenhum item ainda. Toque em "+ Novo item" pra começar — dá pra pôr foto, descrição e preço.</p>';

    $('listaCategorias').innerHTML = categorias.length ? categorias.map(function (c, idx) {
      var n = itens.filter(function (i) { return i.categoria_id === c.id; }).length;
      return '<div class="ca-linha"><span><strong>' + esc(c.nome) + '</strong> <small style="color:var(--ink-faint)">' + n + ' ' + (n === 1 ? 'item' : 'itens') + '</small></span>' +
        '<button type="button" data-mover-cat="' + idx + '" data-d="-1" aria-label="Subir" ' + (idx === 0 ? 'disabled' : '') + '>↑</button>' +
        '<button type="button" data-mover-cat="' + idx + '" data-d="1" aria-label="Descer" ' + (idx === categorias.length - 1 ? 'disabled' : '') + '>↓</button>' +
        '<button type="button" data-renomear-cat="' + c.id + '" aria-label="Renomear">✎</button>' +
        '<button type="button" data-remover-cat="' + c.id + '" aria-label="Remover">' + U.ICONES.lixo + '</button></div>';
    }).join('') : '<p class="ca-vazio">Crie categorias como "Tradicionais", "Bebidas"… elas viram as abas do seu cardápio.</p>';

    $('listaBordas').innerHTML = bordas.length ? bordas.map(function (b) {
      return '<div class="ca-linha"><span>' + esc(b.nome) + ' · <strong>+ ' + U.preco(b.preco) + '</strong></span>' +
        '<button type="button" data-remover-borda="' + b.id + '" aria-label="Remover">' + U.ICONES.lixo + '</button></div>';
    }).join('') : '<p class="ca-vazio">Sem bordas cadastradas.</p>';

    $('listaCombos').innerHTML = combos.length ? combos.map(function (c) {
      return '<div class="ca-item' + (c.ativo ? '' : ' inativo') + '" data-editar-combo="' + c.id + '"><span class="ca-thumb">' + U.ICONES.combo.replace('<svg', '<svg width="22" height="22"') + '</span>' +
        '<div class="ca-info"><strong>' + esc(c.nome) + '</strong><small>' + U.preco(c.preco) + ' · ' + c.qtd_sabores + ' sabor' + (c.qtd_sabores > 1 ? 'es' : '') + ' entre ' + (c.itens_permitidos || []).length + ' opções</small></div></div>';
    }).join('') : '<p class="ca-vazio">Nenhum combo ainda.</p>';
  }

  function ligarCardapio() {
    $('novoItemBtn').addEventListener('click', function () { abrirFormItem(null); });
    $('novoComboBtn').addEventListener('click', function () {
      if (!itens.length) { U.toast('Cadastre os itens primeiro'); return; }
      abrirFormCombo(null);
    });
    $('listaItens').addEventListener('click', function (e) {
      if (e.target.closest('[data-parar]')) return;
      var row = e.target.closest('[data-editar-item]');
      if (row) abrirFormItem(itens.find(function (i) { return i.id === row.getAttribute('data-editar-item'); }));
    });
    $('listaItens').addEventListener('change', async function (e) {
      var sw = e.target.closest('[data-alternar]');
      if (!sw) return;
      var it = itens.find(function (i) { return i.id === sw.getAttribute('data-alternar'); });
      it.ativo = sw.checked;
      try {
        await rpc('delivery_admin_alternar_item', { p_id: it.id, p_estabelecimento_id: loja.id, p_ativo: sw.checked });
        U.toast(sw.checked ? it.nome + ' disponível' : it.nome + ' marcado como esgotado');
      } catch (err) { it.ativo = !sw.checked; }
      renderizarCardapio();
    });
    $('listaCombos').addEventListener('click', function (e) {
      var row = e.target.closest('[data-editar-combo]');
      if (row) abrirFormCombo(combos.find(function (c) { return c.id === row.getAttribute('data-editar-combo'); }));
    });
    $('formCategoria').addEventListener('submit', async function (e) {
      e.preventDefault();
      var nome = $('catNome').value.trim();
      if (!nome) return;
      await rpc('delivery_admin_salvar_categoria', { p_id: null, p_estabelecimento_id: loja.id, p_nome: nome, p_ordem: categorias.length });
      $('catNome').value = '';
      await carregarCardapio();
      U.toast('Categoria criada');
    });
    $('listaCategorias').addEventListener('click', async function (e) {
      var rem = e.target.closest('[data-remover-cat]');
      if (rem) {
        var c = categorias.find(function (x) { return x.id === rem.getAttribute('data-remover-cat'); });
        if (!confirmar('Remover a categoria "' + c.nome + '"? Os itens dela ficam sem categoria (não são apagados).')) return;
        await rpc('delivery_admin_remover_categoria', { p_id: c.id, p_estabelecimento_id: loja.id });
        await carregarCardapio();
        return;
      }
      var ren = e.target.closest('[data-renomear-cat]');
      if (ren) {
        var cat = categorias.find(function (x) { return x.id === ren.getAttribute('data-renomear-cat'); });
        var novo = window.prompt('Novo nome da categoria:', cat.nome);
        if (!novo || !novo.trim()) return;
        await rpc('delivery_admin_salvar_categoria', { p_id: cat.id, p_estabelecimento_id: loja.id, p_nome: novo.trim(), p_ordem: cat.ordem });
        await carregarCardapio();
        return;
      }
      var mv = e.target.closest('[data-mover-cat]');
      if (mv && !mv.disabled) {
        var idx = Number(mv.getAttribute('data-mover-cat')), d = Number(mv.getAttribute('data-d'));
        var lista = categorias.slice();
        var tmp = lista[idx]; lista[idx] = lista[idx + d]; lista[idx + d] = tmp;
        await Promise.all(lista.map(function (cc, i) {
          return cc.ordem === i ? null : rpc('delivery_admin_salvar_categoria', { p_id: cc.id, p_estabelecimento_id: loja.id, p_nome: cc.nome, p_ordem: i });
        }));
        await carregarCardapio();
      }
    });
    $('formBorda').addEventListener('submit', async function (e) {
      e.preventDefault();
      var nome = $('bordaNome').value.trim();
      var preco = parseFloat($('bordaPreco').value || '0');
      if (!nome) return;
      await rpc('delivery_admin_salvar_borda', { p_id: null, p_estabelecimento_id: loja.id, p_nome: nome, p_preco: isNaN(preco) ? 0 : preco, p_ativo: true, p_ordem: bordas.length });
      $('bordaNome').value = ''; $('bordaPreco').value = '';
      await carregarCardapio();
      U.toast('Borda adicionada');
    });
    $('listaBordas').addEventListener('click', async function (e) {
      var rem = e.target.closest('[data-remover-borda]');
      if (!rem) return;
      await rpc('delivery_admin_remover_borda', { p_id: rem.getAttribute('data-remover-borda'), p_estabelecimento_id: loja.id });
      await carregarCardapio();
    });
  }

  /* ---------- formulário do item ---------- */
  function abrirFormItem(it) {
    var f = it ? Object.assign({}, it) : { id: null, nome: '', descricao: '', preco: '', categoria_id: categorias[0] ? categorias[0].id : null, foto_url: null, permite_meio_a_meio: false, aceita_borda: false, ativo: true, ordem: itens.length };
    var opcoesCat = '<option value="">Sem categoria</option>' + categorias.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === f.categoria_id ? ' selected' : '') + '>' + esc(c.nome) + '</option>';
    }).join('');
    var corpo =
      '<label class="foto-upload' + (f.foto_url ? ' tem' : '') + '" id="fiFoto" style="' + (f.foto_url ? 'background-image:url(&quot;' + esc(encodeURI(f.foto_url)) + '&quot;)' : '') + '">' +
        U.ICONES.mais.replace('<svg', '<svg width="28" height="28"') + 'Foto do item (opcional)<input type="file" accept="image/*" id="fiArquivo"></label>' +
      '<button type="button" class="link-acao' + (f.foto_url ? '' : ' oculto') + '" id="fiTirarFoto">Tirar foto</button>' +
      '<div class="campo" style="margin-top:.8rem"><label for="fiNome">Nome</label><input id="fiNome" maxlength="80" value="' + esc(f.nome) + '" placeholder="Ex.: Calabresa"></div>' +
      '<div class="campo"><label for="fiDesc">Descrição</label><textarea id="fiDesc" maxlength="300" rows="2" placeholder="Ingredientes, tamanho, o que vem…">' + esc(f.descricao || '') + '</textarea></div>' +
      '<div class="linha-campos"><div class="campo"><label for="fiPreco">Preço (R$)</label><input id="fiPreco" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(f.preco) + '"><div class="ajuda">0 = "a combinar"</div></div>' +
      '<div class="campo"><label for="fiCat">Categoria</label><select id="fiCat">' + opcoesCat + '</select></div></div>' +
      '<div class="switches">' +
        '<label class="switch' + (SERVICO ? ' oculto' : '') + '"><input type="checkbox" id="fiMeio" ' + (f.permite_meio_a_meio ? 'checked' : '') + '><span class="trilho"></span>Pode ser meio a meio</label>' +
        '<label class="switch' + (SERVICO ? ' oculto' : '') + '"><input type="checkbox" id="fiBorda" ' + (f.aceita_borda ? 'checked' : '') + '><span class="trilho"></span>Aceita borda recheada</label>' +
        '<label class="switch"><input type="checkbox" id="fiAtivo" ' + (f.ativo ? 'checked' : '') + '><span class="trilho"></span>Disponível no cardápio</label>' +
      '</div><p class="p-msg" id="fiMsg"></p>';
    var rodape = (f.id ? '<button type="button" class="btn perigo" id="fiExcluir">Excluir</button>' : '') + '<button type="button" class="btn cheio" id="fiSalvar">Salvar item</button>';
    abrirSheet(f.id ? (SERVICO ? 'Editar serviço' : 'Editar item') : (SERVICO ? 'Novo serviço' : 'Novo item'), corpo, rodape);

    $('fiArquivo').addEventListener('change', async function () {
      var arq = this.files[0];
      if (!arq) return;
      var area = $('fiFoto');
      area.insertAdjacentHTML('beforeend', '<span class="carregando"><span class="btn" style="background:none"><span class="spin"></span></span></span>');
      try {
        f.foto_url = await enviarFoto(arq, 'item', 1000, false);
        area.style.backgroundImage = 'url("' + encodeURI(f.foto_url) + '")';
        area.classList.add('tem');
        $('fiTirarFoto').classList.remove('oculto');
      } catch (err) { U.toast(U.mensagemErro(err, 'Não consegui enviar a foto'), 3500); }
      var c = area.querySelector('.carregando'); if (c) c.remove();
    });
    $('fiTirarFoto').addEventListener('click', function () {
      f.foto_url = null;
      $('fiFoto').style.backgroundImage = '';
      $('fiFoto').classList.remove('tem');
      this.classList.add('oculto');
    });
    $('fiSalvar').addEventListener('click', async function () {
      var nome = $('fiNome').value.trim();
      var preco = parseFloat(String($('fiPreco').value).replace(',', '.'));
      if (nome.length < 2) { $('fiMsg').textContent = 'Dá um nome pro item.'; $('fiMsg').className = 'p-msg erro'; return; }
      if (isNaN(preco) || preco < 0) { $('fiMsg').textContent = 'Informe o preço.'; $('fiMsg').className = 'p-msg erro'; return; }
      this.disabled = true;
      try {
        await rpc('delivery_admin_salvar_item', {
          p_id: f.id, p_estabelecimento_id: loja.id, p_categoria_id: $('fiCat').value || null,
          p_nome: nome, p_descricao: $('fiDesc').value.trim() || null, p_preco: preco, p_foto_url: f.foto_url || null,
          p_permite_meio_a_meio: $('fiMeio').checked, p_ativo: $('fiAtivo').checked, p_ordem: f.ordem || 0, p_aceita_borda: $('fiBorda').checked
        });
        fecharSheet();
        await carregarCardapio();
        U.toast(f.id ? 'Item atualizado' : 'Item criado');
      } catch (err) { this.disabled = false; }
    });
    if ($('fiExcluir')) $('fiExcluir').addEventListener('click', async function () {
      if (!confirmar('Excluir "' + f.nome + '" do cardápio? Se for só por hoje, prefira desligar a chave de disponível.')) return;
      await rpc('delivery_admin_remover_item', { p_id: f.id, p_estabelecimento_id: loja.id });
      fecharSheet();
      await carregarCardapio();
      U.toast('Item excluído');
    });
  }

  /* ---------- formulário do combo ---------- */
  function abrirFormCombo(co) {
    var f = co ? { id: co.id, nome: co.nome, preco: co.preco, qtd: co.qtd_sabores, sel: (co.itens_permitidos || []).slice(), ativo: co.ativo, ordem: co.ordem }
      : { id: null, nome: '', preco: '', qtd: 2, sel: [], ativo: true, ordem: combos.length };
    function render() {
      var corpo =
        '<div class="campo"><label for="fcNome">Nome do combo</label><input id="fcNome" maxlength="80" value="' + esc(f.nome) + '" placeholder="Ex.: 2 pizzas grandes"></div>' +
        '<div class="campo"><label for="fcPreco">Preço fixo (R$)</label><input id="fcPreco" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(f.preco) + '"></div>' +
        '<div class="grupo"><div class="grupo-titulo">Quantos sabores o cliente escolhe</div><div class="seg">' +
        [1, 2, 3, 4].map(function (n) { return '<button type="button" data-fc-qtd="' + n + '" class="' + (f.qtd === n ? 'ativo' : '') + '">' + n + '</button>'; }).join('') + '</div></div>' +
        '<div class="grupo"><div class="grupo-titulo">Itens que podem entrar <em class="' + (f.sel.length >= f.qtd ? 'ok' : '') + '">' + f.sel.length + ' marcados</em></div><div class="opcoes">' +
        itens.map(function (i) {
          var on = f.sel.indexOf(i.id) !== -1;
          return '<button type="button" class="opcao quadrada' + (on ? ' ativo' : '') + '" data-fc-item="' + i.id + '"><span class="marca">' + U.ICONES.check + '</span><span class="opcao-nome">' + esc(i.nome) + '</span><span class="opcao-extra">' + U.preco(i.preco) + '</span></button>';
        }).join('') + '</div></div>' +
        '<div class="switches" style="margin-top:1rem"><label class="switch"><input type="checkbox" id="fcAtivo" ' + (f.ativo ? 'checked' : '') + '><span class="trilho"></span>Combo ativo no cardápio</label></div>' +
        '<p class="p-msg" id="fcMsg"></p>';
      var rodape = (f.id ? '<button type="button" class="btn perigo" id="fcExcluir">Excluir</button>' : '') + '<button type="button" class="btn cheio" id="fcSalvar">Salvar combo</button>';
      var corpoAtual = document.querySelector('#sheetConteudo .sheet-corpo');
      var rolagem = corpoAtual ? corpoAtual.scrollTop : 0;
      abrirSheet(f.id ? 'Editar combo' : 'Novo combo', corpo, rodape);
      var novo = document.querySelector('#sheetConteudo .sheet-corpo');
      if (novo) novo.scrollTop = rolagem;
      var guardar = function () { f.nome = $('fcNome').value; f.preco = $('fcPreco').value; f.ativo = $('fcAtivo').checked; };
      document.querySelectorAll('[data-fc-qtd]').forEach(function (b) { b.addEventListener('click', function () { guardar(); f.qtd = Number(b.getAttribute('data-fc-qtd')); render(); }); });
      document.querySelectorAll('[data-fc-item]').forEach(function (b) {
        b.addEventListener('click', function () {
          guardar();
          var id = b.getAttribute('data-fc-item'), pos = f.sel.indexOf(id);
          if (pos === -1) f.sel.push(id); else f.sel.splice(pos, 1);
          render();
        });
      });
      $('fcSalvar').addEventListener('click', async function () {
        guardar();
        var preco = parseFloat(String(f.preco).replace(',', '.'));
        var msg = function (t) { $('fcMsg').textContent = t; $('fcMsg').className = 'p-msg erro'; };
        if (f.nome.trim().length < 2) return msg('Dá um nome pro combo.');
        if (isNaN(preco) || preco <= 0) return msg('Informe o preço do combo.');
        if (f.sel.length < f.qtd) return msg('Marque pelo menos ' + f.qtd + ' itens.');
        this.disabled = true;
        try {
          await rpc('delivery_admin_salvar_combo', { p_id: f.id, p_estabelecimento_id: loja.id, p_nome: f.nome.trim(), p_preco: preco, p_itens_permitidos: f.sel, p_qtd_sabores: f.qtd, p_ativo: f.ativo, p_ordem: f.ordem || 0 });
          fecharSheet();
          await carregarCardapio();
          U.toast('Combo salvo');
        } catch (err) { this.disabled = false; }
      });
      if ($('fcExcluir')) $('fcExcluir').addEventListener('click', async function () {
        if (!confirmar('Excluir o combo "' + f.nome + '"?')) return;
        await rpc('delivery_admin_remover_combo', { p_id: f.id, p_estabelecimento_id: loja.id });
        fecharSheet();
        await carregarCardapio();
      });
    }
    render();
  }

  /* ===================== fotos (upload com compressão) ===================== */
  function comprimir(arquivo, maxLado, quadrado) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
        if (quadrado) { var lado = Math.min(w, h); sx = (w - lado) / 2; sy = (h - lado) / 2; sw = sh = lado; w = h = lado; }
        var escala = Math.min(1, maxLado / Math.max(w, h));
        var cv = document.createElement('canvas');
        cv.width = Math.round(w * escala); cv.height = Math.round(h * escala);
        cv.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { if (b) resolve(b); else reject(new Error('Não consegui processar a imagem')); }, 'image/jpeg', 0.84);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Arquivo de imagem inválido')); };
      img.src = url;
    });
  }

  async function enviarFoto(arquivo, tipo, maxLado, quadrado) {
    if (!/^image\//.test(arquivo.type)) throw new Error('Escolha um arquivo de imagem.');
    var blob = await comprimir(arquivo, maxLado, quadrado);
    var caminho = sessao.user.id + '/' + loja.id + '/' + tipo + '-' + Date.now() + '.jpg';
    var r = await db.storage.from('delivery-fotos').upload(caminho, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    if (r.error) throw r.error;
    return db.storage.from('delivery-fotos').getPublicUrl(caminho).data.publicUrl;
  }

  function renderizarFotosLoja() {
    [['capa', 'upCapa', 'foto_capa_url'], ['logo', 'upLogo', 'foto_perfil_url']].forEach(function (x) {
      var el = $(x[1]), url = loja[x[2]];
      el.style.backgroundImage = url ? 'url("' + encodeURI(url) + '")' : '';
      el.classList.toggle('tem', !!url);
      document.querySelector('[data-remover-foto="' + x[0] + '"]').classList.toggle('oculto', !url);
    });
  }

  function ligarFotosLoja() {
    document.querySelectorAll('[data-upload]').forEach(function (input) {
      input.addEventListener('change', async function () {
        var arq = this.files[0];
        if (!arq) return;
        var tipo = this.getAttribute('data-upload');
        var area = this.closest('.foto-upload');
        area.insertAdjacentHTML('beforeend', '<span class="carregando"><span class="btn" style="background:none"><span class="spin"></span></span></span>');
        try {
          var url = await enviarFoto(arq, tipo, tipo === 'capa' ? 1600 : 600, tipo === 'logo');
          var campos = {}; campos[tipo === 'capa' ? 'foto_capa_url' : 'foto_perfil_url'] = url;
          Object.assign(loja, await rpc('delivery_admin_atualizar_estabelecimento', { p_id: loja.id, p_campos: campos }));
          renderizarFotosLoja(); renderizarTopo(); recarregarPreview();
          U.toast(tipo === 'capa' ? 'Capa atualizada' : 'Logo atualizada');
        } catch (err) { U.toast(U.mensagemErro(err, 'Não consegui enviar a foto'), 3500); }
        var c = area.querySelector('.carregando'); if (c) c.remove();
        this.value = '';
      });
    });
    document.querySelectorAll('[data-remover-foto]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var campo = b.getAttribute('data-remover-foto') === 'capa' ? 'foto_capa_url' : 'foto_perfil_url';
        var campos = {}; campos[campo] = null;
        Object.assign(loja, await rpc('delivery_admin_atualizar_estabelecimento', { p_id: loja.id, p_campos: campos }));
        renderizarFotosLoja(); renderizarTopo(); recarregarPreview();
      });
    });
  }

  /* ===================== loja (formulário) ===================== */
  function preencherFormLoja() {
    $('lSegmento').innerHTML = Object.keys(U.SEGMENTOS).map(function (k) { return '<option value="' + k + '">' + esc(U.SEGMENTOS[k]) + '</option>'; }).join('');
    document.querySelectorAll('[data-campo-loja]').forEach(function (el) {
      var campo = el.getAttribute('data-campo-loja');
      var v = loja[campo];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (campo === 'telefone_whatsapp') el.value = U.formatarTelefone(v);
      else el.value = v == null ? '' : v;
    });
    document.querySelectorAll('[data-pagamento]').forEach(function (el) { el.checked = (loja.formas_pagamento || []).indexOf(el.value) !== -1; });
    renderizarHorarios(loja.horarios || {});
    renderizarFotosLoja();
  }

  function renderizarHorarios(h) {
    $('gradeHorarios').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      var faixa = (h[String(d)] || [])[0];
      return '<div class="hor-linha" data-dia="' + d + '"><span class="dia">' + U.DIAS[d] + '</span>' +
        '<label class="switch"><input type="checkbox" data-hor-aberto ' + (faixa ? 'checked' : '') + ' aria-label="Abre na ' + U.DIAS[d] + '"><span class="trilho"></span></label>' +
        '<input type="time" data-hor-abre value="' + (faixa ? faixa[0] : '18:00') + '" ' + (faixa ? '' : 'disabled') + ' aria-label="Abre às">' +
        '<input type="time" data-hor-fecha value="' + (faixa ? faixa[1] : '23:00') + '" ' + (faixa ? '' : 'disabled') + ' aria-label="Fecha às"></div>';
    }).join('');
  }

  function lerHorarios() {
    var h = {};
    document.querySelectorAll('.hor-linha').forEach(function (l) {
      if (l.querySelector('[data-hor-aberto]').checked) {
        var a = l.querySelector('[data-hor-abre]').value, f = l.querySelector('[data-hor-fecha]').value;
        if (a && f) h[l.getAttribute('data-dia')] = [[a, f]];
      }
    });
    return h;
  }

  function marcarRascunho(campo, valor) {
    rascunho[campo] = valor;
    atualizarBarraSalvar();
  }

  function atualizarBarraSalvar() {
    $('barraSalvar').classList.toggle('mostra', Object.keys(rascunho).length > 0);
  }

  function ligarFormLoja() {
    $('formLoja').addEventListener('input', function (e) {
      var el = e.target;
      var campo = el.getAttribute('data-campo-loja');
      if (campo) {
        var v = el.type === 'checkbox' ? el.checked : el.value;
        if (campo === 'slug') { v = U.slugificar(v); }
        marcarRascunho(campo, v);
      } else if (el.hasAttribute('data-pagamento')) {
        marcarRascunho('formas_pagamento', Array.prototype.map.call(document.querySelectorAll('[data-pagamento]:checked'), function (x) { return x.value; }));
      } else if (el.closest('.hor-linha')) {
        var linha = el.closest('.hor-linha');
        var on = linha.querySelector('[data-hor-aberto]').checked;
        linha.querySelectorAll('input[type="time"]').forEach(function (t) { t.disabled = !on; });
        marcarRascunho('horarios', lerHorarios());
      }
    });
    U.mascaraTelefone($('lWhats'));
    $('copiarHorarioBtn').addEventListener('click', function () {
      var seg = document.querySelector('.hor-linha[data-dia="1"]');
      var on = seg.querySelector('[data-hor-aberto]').checked, a = seg.querySelector('[data-hor-abre]').value, f = seg.querySelector('[data-hor-fecha]').value;
      document.querySelectorAll('.hor-linha').forEach(function (l) {
        l.querySelector('[data-hor-aberto]').checked = on;
        l.querySelector('[data-hor-abre]').value = a; l.querySelector('[data-hor-fecha]').value = f;
        l.querySelectorAll('input[type="time"]').forEach(function (t) { t.disabled = !on; });
      });
      marcarRascunho('horarios', lerHorarios());
    });
    $('descartarBtn').addEventListener('click', function () {
      rascunho = {};
      atualizarBarraSalvar();
      preencherFormLoja();
      montarAparencia(true);
      enviarPreview();
    });
    $('salvarLojaBtn').addEventListener('click', salvarLoja);
  }

  async function salvarLoja() {
    var campos = Object.assign({}, rascunho);
    if ('telefone_whatsapp' in campos && U.soDigitos(campos.telefone_whatsapp).length < 10) { U.toast('WhatsApp com DDD, por favor', 3000); return; }
    if ('slug' in campos && !campos.slug) { U.toast('O endereço do site não pode ficar vazio', 3000); return; }
    ['taxa_entrega', 'pedido_minimo'].forEach(function (k) { if (k in campos && campos[k] !== '') campos[k] = String(campos[k]).replace(',', '.'); });
    if ('instagram_url' in campos) campos.instagram_url = String(campos.instagram_url || '').trim();
    $('salvarLojaBtn').disabled = true;
    try {
      var slugAntes = loja.slug;
      var atualizada = await rpc('delivery_admin_atualizar_estabelecimento', { p_id: loja.id, p_campos: campos }, 'Não consegui salvar');
      Object.assign(loja, atualizada);
      rascunho = {};
      atualizarBarraSalvar();
      preencherFormLoja();
      renderizarTopo();
      renderizarStatusLoja();
      if (loja.slug !== slugAntes) { qrGerado = null; gerarQr(); montarAparencia(true); }
      recarregarPreview();
      U.toast('Alterações salvas');
    } catch (e) {
      /* toast já mostrado */
    }
    $('salvarLojaBtn').disabled = false;
  }

  /* ---------- aparência ---------- */
  // cores de marca reais (tijolo, molho, âmbar, folha, verde-água, marinho, açaí, café, preto)
  var CORES = ['#b23a28', '#9b2d20', '#d9822b', '#2f6a35', '#1f7a6d', '#23395b', '#5a1f66', '#6b4226', '#1d1c1a'];
  var aparenciaMontada = false;

  function tomAtual() { return Tema.tomValido('template' in rascunho ? rascunho.template : loja.template) || 'claro'; }
  function corAtual() { return 'cor_destaque' in rascunho ? rascunho.cor_destaque : loja.cor_destaque; }
  function layoutAtual() { return Tema.layoutValido('layout' in rascunho ? rascunho.layout : loja.layout) || 'lista'; }

  function opcaoHtml(attr, chave, nome, desc, ativo, extra) {
    return '<button type="button" class="layout-op' + (ativo ? ' ativo' : '') + '" ' + attr + '="' + chave + '">' + (extra || '') +
      '<span><strong>' + esc(nome) + '</strong><small>' + esc(desc) + '</small></span></button>';
  }
  function renderizarLayouts() {
    $('gradeLayouts').innerHTML = Tema.LAYOUTS.map(function (l) { return opcaoHtml('data-layout', l.chave, l.nome, l.descricao, l.chave === layoutAtual()); }).join('');
    $('gradeTons').innerHTML = Tema.TONS.map(function (t) {
      return opcaoHtml('data-tom', t.chave, t.nome, t.descricao, t.chave === tomAtual(),
        '<span class="tom-amostra tom-' + t.chave + '" style="--c:' + (corAtual() || Tema.AREAS[areaAtual()].cor) + '"></span>');
    }).join('');
  }

  function montarAparencia(forcar) {
    if (aparenciaMontada && !forcar) return;
    if ($('abaLoja').classList.contains('oculto') && !forcar) return;
    aparenciaMontada = true;
    renderizarLayouts();
    renderizarCores();
    var prev = $('previewReal');
    if (!$('abaLoja').classList.contains('oculto')) {
      prev.src = urlSite() + '?preview=1';
      prev.onload = enviarPreview;
    } else {
      aparenciaMontada = false;
    }
  }

  function ajustarMiniaturas() {
    document.querySelectorAll('.tpl-janela').forEach(function (j) {
      var f = j.querySelector('iframe');
      var escala = j.clientWidth / 390;
      if (escala > 0) { f.style.transform = 'scale(' + escala + ')'; f.style.height = Math.ceil(j.clientHeight / escala) + 'px'; }
    });
  }

  function renderizarCores() {
    var atual = corAtual();
    var padrao = Tema.AREAS[areaAtual()].cor;
    $('cores').innerHTML =
      '<button type="button" class="cor-opcao padrao' + (!atual ? ' ativo' : '') + '" data-cor="" style="background:' + padrao + '" title="Cor da área" aria-label="Cor padrão da área"><span>padrão</span></button>' +
      CORES.map(function (c) { return '<button type="button" class="cor-opcao' + (atual === c ? ' ativo' : '') + '" data-cor="' + c + '" style="background:' + c + '" aria-label="Cor ' + c + '"></button>'; }).join('') +
      '<input type="color" class="cor-custom" id="corCustom" value="' + (atual || padrao) + '" aria-label="Escolher outra cor" title="Escolher outra cor">';
  }

  function enviarPreview() {
    var f = $('previewReal');
    if (f && f.contentWindow) f.contentWindow.postMessage({ tipo: 'vb-tpl', cor: corAtual(), layout: layoutAtual(), tom: tomAtual() }, location.origin);
  }
  function recarregarPreview() {
    var f = $('previewReal');
    if (f && f.src) f.contentWindow && f.contentWindow.postMessage({ tipo: 'vb-recarregar' }, location.origin);
  }

  function ligarAparencia() {
    $('gradeTons').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tom]');
      if (!b) return;
      var chave = b.getAttribute('data-tom');
      if (chave === (loja.template || 'claro')) delete rascunho.template; else rascunho.template = chave;
      atualizarBarraSalvar();
      renderizarLayouts();
      enviarPreview();
    });
    $('gradeLayouts').addEventListener('click', function (e) {
      var b = e.target.closest('[data-layout]');
      if (!b) return;
      var chave = b.getAttribute('data-layout');
      if (chave === (loja.layout || 'lista')) delete rascunho.layout; else rascunho.layout = chave;
      atualizarBarraSalvar();
      renderizarLayouts();
      enviarPreview();
    });
    $('cores').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cor]');
      if (!b) return;
      escolherCor(b.getAttribute('data-cor') || null);
    });
    $('cores').addEventListener('input', function (e) { if (e.target.id === 'corCustom') escolherCor(e.target.value); });
    window.addEventListener('resize', ajustarMiniaturas);
  }

  function escolherCor(cor) {
    if ((cor || null) === (loja.cor_destaque || null)) delete rascunho.cor_destaque; else rascunho.cor_destaque = cor;
    atualizarBarraSalvar();
    document.querySelectorAll('.cor-opcao').forEach(function (c) { c.classList.toggle('ativo', (c.getAttribute('data-cor') || null) === (cor || null)); });
    renderizarLayouts();
    enviarPreview();
  }

  /* ---------- link / QR ---------- */
  var qrGerado = null;
  function gerarQr() {
    var url = urlSite();
    if (qrGerado === url) return;
    var alvo = $('qrCodigo');
    var desenhar = function () {
      alvo.innerHTML = '';
      try { new window.QRCode(alvo, { text: url, width: 224, height: 224, correctLevel: window.QRCode.CorrectLevel.M }); qrGerado = url; }
      catch (e) { alvo.parentNode.classList.add('oculto'); }
    };
    if (window.QRCode) { desenhar(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = desenhar;
    s.onerror = function () { alvo.closest('.qr-box').classList.add('oculto'); };
    document.head.appendChild(s);
  }

  function ligarLink() {
    $('copiarLinkBtn').addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(urlSite()).then(function () { U.toast('Link copiado!'); });
    });
    $('compartilharBtn').addEventListener('click', function () {
      var dados = { title: loja.nome, text: 'Faça seu pedido na ' + loja.nome + ':', url: urlSite() };
      if (navigator.share) navigator.share(dados).catch(function () {});
      else window.open('https://wa.me/?text=' + encodeURIComponent(dados.text + ' ' + dados.url), '_blank');
    });
    $('baixarQrBtn').addEventListener('click', function () {
      var c = document.querySelector('#qrCodigo canvas');
      if (!c) { U.toast('QR Code ainda carregando'); return; }
      var a = document.createElement('a');
      a.download = 'qrcode-' + loja.slug + '.png';
      a.href = c.toDataURL('image/png');
      a.click();
    });
  }

  /* ===================== resumo ===================== */
  async function carregarResumo() {
    $('conteudoResumo').innerHTML = '<div class="kpis">' + '<div class="skeleton-item" style="height:84px"></div>'.repeat(4) + '</div><div class="skeleton-item" style="height:220px"></div>';
    var r = await db.rpc('delivery_admin_resumo', { p_estabelecimento_id: loja.id, p_dias: diasResumo });
    if (r.error || !r.data) { $('conteudoResumo').innerHTML = '<p class="pa-vazio">Não consegui carregar o resumo agora.</p>'; return; }
    var d = r.data;
    var porDia = d.por_dia || [];
    var max = Math.max.apply(null, porDia.map(function (x) { return Number(x.faturamento); }).concat([1]));
    var fmtDia = function (s) { var p = s.split('-'); return p[2] + '/' + p[1]; };
    var ent = (d.entrega_vs_retirada || {}).entrega || 0, ret = (d.entrega_vs_retirada || {}).retirada || 0;
    var totalFormas = ent + ret || 1;
    var html =
      '<div class="kpis">' +
        '<div class="kpi destaque"><small>Hoje</small><strong>' + U.preco(d.hoje.faturamento) + '</strong><span>' + d.hoje.pedidos + ' pedido' + (d.hoje.pedidos === 1 ? '' : 's') + '</span></div>' +
        '<div class="kpi"><small>' + diasResumo + ' dias</small><strong>' + U.preco(d.periodo.faturamento) + '</strong><span>' + d.periodo.pedidos + ' pedidos</span></div>' +
        '<div class="kpi"><small>Ticket médio</small><strong>' + U.preco(d.periodo.ticket_medio) + '</strong><span>por pedido</span></div>' +
        '<div class="kpi"><small>Clientes</small><strong>' + d.periodo.clientes + '</strong><span>diferentes</span></div>' +
      '</div>' +
      '<div class="p-secao"><div class="p-secao-topo"><h2>Faturamento por dia</h2></div>' +
        '<div class="grafico" id="grafico">' + porDia.map(function (x, i) {
          var h = Math.max(2, Math.round(Number(x.faturamento) / max * 100));
          return '<div class="barra' + (i === porDia.length - 1 ? ' hoje' : '') + '" style="height:' + h + '%" data-dica="' + fmtDia(x.dia) + ': ' + x.pedidos + ' pedido' + (x.pedidos === 1 ? '' : 's') + ' · ' + U.preco(x.faturamento) + '" tabindex="0"></div>';
        }).join('') + '</div>' +
        '<div class="grafico-eixo"><span>' + (porDia[0] ? fmtDia(porDia[0].dia) : '') + '</span><span>hoje</span></div>' +
        '<p class="grafico-dica" id="graficoDica">Toque numa barra pra ver o dia.</p></div>' +
      '<div class="p-secao"><div class="p-secao-topo"><h2>Mais vendidos</h2></div>' +
        ((d.top_itens || []).length ? d.top_itens.map(function (t, i) {
          return '<div class="top-item"><span class="pos">' + (i + 1) + '</span><span>' + esc(t.descricao) + '</span><b>' + t.qtd + ' un.</b></div>';
        }).join('') : '<p class="ca-vazio">Sem vendas no período.</p>') + '</div>' +
      '<div class="p-secao"><div class="p-secao-topo"><h2>Entrega × retirada</h2></div>' +
        '<div class="divisao"><i style="width:' + (ent / totalFormas * 100) + '%"></i><i style="width:' + (ret / totalFormas * 100) + '%"></i></div>' +
        '<div class="legenda"><b>Entrega ' + ent + '</b><b>Retirada ' + ret + '</b></div></div>';
    $('conteudoResumo').innerHTML = html;
    $('grafico').addEventListener('click', function (e) { var b = e.target.closest('.barra'); if (b) $('graficoDica').textContent = b.getAttribute('data-dica'); });
    $('grafico').addEventListener('mouseover', function (e) { var b = e.target.closest('.barra'); if (b) $('graficoDica').textContent = b.getAttribute('data-dica'); });
  }

  function ligarResumo() {
    $('filtroPeriodo').addEventListener('click', function (e) {
      var b = e.target.closest('[data-dias]');
      if (!b) return;
      diasResumo = Number(b.getAttribute('data-dias'));
      document.querySelectorAll('#filtroPeriodo .p-filtro').forEach(function (x) { x.classList.toggle('ativo', x === b); });
      carregarResumo();
    });
  }

  /* ===================== boas-vindas ===================== */
  function abrirBoasVindas() {
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    var passos = [
      [SERVICO ? 'Cadastre seus serviços' : 'Monte o cardápio', SERVICO ? 'Nome, descrição e preço (ou "a combinar").' : 'Crie categorias e itens com foto e preço.', 'cardapio'],
      [SERVICO ? 'Onde e quando você atende' : 'Configure entrega e horários', SERVICO ? 'Local do cliente, na loja ou os dois, taxa e horários.' : 'Taxa, pedido mínimo, formas de pagamento e quando abre.', 'loja'],
      ['Escolha o visual', 'Tom claro ou vibrante, 4 jeitos de mostrar os itens e a cor da sua marca.', 'loja'],
      ['Divulgue o link', 'Copie, compartilhe ou imprima o QR Code.', 'loja']
    ];
    abrirSheet(SERVICO ? 'Serviços ativados!' : 'Delivery ativado!',
      '<p class="sheet-desc">Faltam só uns passos pra receber o primeiro pedido:</p><div class="opcoes" style="margin-top:.8rem">' +
      passos.map(function (p, i) {
        return '<button type="button" class="opcao" data-ir-aba="' + p[2] + '"><span class="marca" style="border-color:var(--accent);color:var(--accent);font-weight:800;font-size:.75rem">' + (i + 1) + '</span>' +
          '<span class="opcao-nome">' + p[0] + '<br><small style="font-weight:500;color:var(--ink-faint)">' + p[1] + '</small></span></button>';
      }).join('') + '</div>',
      '<button type="button" class="btn cheio" data-ir-aba="cardapio">' + (SERVICO ? 'Começar pelos serviços' : 'Começar pelo cardápio') + '</button>');
    document.querySelectorAll('[data-ir-aba]').forEach(function (b) {
      b.addEventListener('click', function () { fecharSheet(); trocarAba(b.getAttribute('data-ir-aba')); });
    });
  }

  /* ===================== geral ===================== */
  function ligarGeral() {
    $('pVerSite').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
    $('pMenuBtn').innerHTML = U.ICONES.menu;
    $('pAbas').addEventListener('click', function (e) { var b = e.target.closest('[data-aba]'); if (b) trocarAba(b.getAttribute('data-aba')); });
    $('pMenuBtn').addEventListener('click', function (e) { e.stopPropagation(); $('pMenu').classList.toggle('aberto'); });
    $('pDesativarArea').addEventListener('click', async function () {
      var ficam = (negocio.areas || []).filter(function (a) { return a === 'agenda'; });
      if (!ficam.length) { U.toast('É a única área do negócio — ative a Agenda antes de desligar esta.', 3500); return; }
      if (!confirmar('Desligar ' + (SERVICO ? 'Serviços' : 'Delivery') + '? O site para de receber pedidos por aqui (nada é apagado).')) return;
      if (await definirAreas(ficam)) location.href = '/cadastro.html?abrir=' + encodeURIComponent(negocio.id);
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('#pMenu')) $('pMenu').classList.remove('aberto'); });
    document.addEventListener('click', function (e) { if (e.target.closest('[data-fechar-sheet]')) fecharSheet(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { fecharSheet(); $('pMenu').classList.remove('aberto'); } });
    window.addEventListener('popstate', function () { if (sheetAberto) fecharSheet(true); });
    window.addEventListener('beforeunload', function (e) { if (Object.keys(rascunho).length) { e.preventDefault(); e.returnValue = ''; } });
  }

  async function iniciar() {
    preencherIcones();
    if (!db) { $('telaCarregando').innerHTML = '<div class="p-secao"><p class="p-msg erro">Sem conexão com o servidor. Confere a internet.</p></div>'; return; }
    ligarGeral();
    ligarPedidos();
    ligarCardapio();
    ligarFormLoja();
    ligarFotosLoja();
    ligarAparencia();
    ligarLink();
    ligarResumo();
    var s = await db.auth.getSession();
    sessao = s.data && s.data.session;
    if (!sessao) { location.href = '/cadastro.html'; return; }
    carregarLojas();
  }

  iniciar();
})();
