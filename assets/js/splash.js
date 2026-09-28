/* Tela inicial do Vibe (splash) + troca de telas sem recarregar.

   A splash e o Explorar moram na mesma página (index.html). Escolher
   Agendar / Pedir / Chamar só desliza a tela pro lado e mostra a lista
   daquela área (View Transitions dentro da página; sem suporte, a tela
   nova entra deslizando por CSS). O endereço acompanha
   (/explorar.html?area=…) e o "voltar" do navegador volta pra splash.

   Também: ícones que se desenham, cumprimento pela hora, selo da última
   escolha, "Meu painel" pro dono logado e "Meus agendamentos" pro cliente. */
(function () {
  'use strict';

  var CHAVE_ULTIMA = 'vibe-ultima-escolha';
  var AREAS = ['agenda', 'delivery', 'servicos'];
  var TITULOS = {
    splash: document.title,
    agenda: 'Agendar horário em Itapetininga — Cadê? Achei!',
    delivery: 'Pedir delivery em Itapetininga — Cadê? Achei!',
    servicos: 'Chamar um profissional em Itapetininga — Cadê? Achei!'
  };
  var T = window.VibeToggle || {};
  var ICONES = T.ICONES || {};
  // "tenho um negócio": uma lojinha, traço por traço
  ICONES.negocio = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4 10.5V20h16v-9.5" pathLength="1"/><path d="M3 10.5l2-5h14l2 5z" pathLength="1"/>' +
    '<path d="M10 20v-4.5h4V20" pathLength="1" class="vt-check"/></svg>';

  var corpo = document.body;
  var ops = Array.prototype.slice.call(document.querySelectorAll('.sp-op'));
  var reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }
  function gravar(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) {} }

  // ---------- conteúdo da splash ----------
  ops.forEach(function (op) {
    var ic = op.querySelector('.sp-ic');
    if (ic && ICONES[ic.getAttribute('data-icone')]) ic.innerHTML = ICONES[ic.getAttribute('data-icone')];
  });
  var h = new Date().getHours();
  var ola = document.getElementById('spOla');
  if (ola) ola.textContent = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';

  // dono já logado (sessão do Supabase salva neste aparelho) → atalho pro painel
  function donoLogado() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-.+-auth-token$/.test(k) && /"access_token"/.test(localStorage.getItem(k) || '')) return true;
      }
    } catch (e) {}
    return false;
  }
  if (donoLogado()) {
    document.getElementById('spNegocio').href = '/cadastro.html';
    document.getElementById('spNegocioTitulo').textContent = 'Meu painel';
    document.getElementById('spNegocioSub').textContent = 'Agenda, pedidos e chamados do seu negócio';
    var entrar = document.getElementById('spEntrar');
    if (entrar) entrar.textContent = 'Minha conta';
  }

  function marcarUltima() {
    var ultima = ler(CHAVE_ULTIMA);
    ops.forEach(function (op) {
      var selo = op.querySelector('.sp-selo');
      if (op.getAttribute('data-area') !== ultima) { if (selo) selo.remove(); return; }
      if (selo) return;
      selo = document.createElement('span');
      selo.className = 'sp-selo';
      selo.textContent = 'Da última vez';
      op.appendChild(selo);
    });
  }
  marcarUltima();

  // passar o dedo/mouse numa opção acende a luz daquela área
  function focar(op) {
    var area = op ? op.getAttribute('data-area') : '';
    ops.forEach(function (o) { o.classList.toggle('sp-foco', o === op); });
    if (area) corpo.setAttribute('data-foco', area); else corpo.removeAttribute('data-foco');
  }
  ops.forEach(function (op) {
    op.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') focar(op); });
    op.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') focar(null); });
    op.addEventListener('focus', function () { focar(op); });
    op.addEventListener('blur', function () { focar(null); });
  });

  // ---------- meus agendamentos (cliente final) ----------
  function cliente() { return window.VBClienteGlobal ? window.VBClienteGlobal.obter() : null; }
  function atualizarCliente() {
    var c = cliente();
    var sub = document.getElementById('spMeusSub');
    if (sub) sub.textContent = c ? 'Olá, ' + String(c.nome || '').split(/\s+/)[0] + ' — ver, remarcar ou cancelar' : 'Entre com seu WhatsApp pra ver, remarcar ou cancelar';
  }
  atualizarCliente();
  var meusBtn = document.getElementById('spMeusAgendamentos');
  function abrirMeus() { if (window.VBMeusAgendamentos) window.VBMeusAgendamentos.abrir(); }
  if (meusBtn) meusBtn.addEventListener('click', function () {
    if (cliente()) { abrirMeus(); return; }
    if (window.VBClienteEntrar) window.VBClienteEntrar(abrirMeus);
  });
  // "Sair da conta" dentro de Meus agendamentos
  var sair = document.getElementById('magSair');
  if (sair) sair.addEventListener('click', function () { setTimeout(atualizarCliente, 400); });

  // ---------- vídeo de fundo: só toca com a splash na tela ----------
  var video = document.getElementById('spVideo');
  var economiza = (navigator.connection && navigator.connection.saveData) ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function videoConforme(tela) {
    if (!video) return;
    if (tela === 'splash' && !economiza) {
      var p = video.play();
      if (p && p.catch) p.catch(function () {}); // navegador bloqueou: fica o quadro parado (poster)
    } else {
      video.pause();
    }
  }
  if (video && economiza) { video.removeAttribute('autoplay'); video.pause(); }
  document.addEventListener('visibilitychange', function () {
    if (!video) return;
    if (document.hidden) video.pause(); else videoConforme(corpo.getAttribute('data-tela'));
  });

  // ---------- qualquer aparelho: a splash cabe inteira na tela, sem rolar ----------
  // Mede o conteúdo e, se passar da altura da tela, reduz tudo por igual
  // (--z, lido pelo splash.css) até caber. Mais larga que a tela na mesma
  // proporção, o texto quebra menos: por isso confere de novo depois.
  var telaSplash = document.getElementById('telaSplash');
  function encaixarSplash() {
    if (!telaSplash) return;
    // altura que está de fato visível (sem barras do navegador/teclado)
    var alturaVisivel = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    document.documentElement.style.setProperty('--altura-tela', Math.round(alturaVisivel) + 'px');
    telaSplash.style.removeProperty('--z');
    if (corpo.getAttribute('data-tela') !== 'splash') return;
    function cabe() { return telaSplash.scrollHeight - telaSplash.clientHeight <= 1; }
    function usar(z) { telaSplash.style.setProperty('--z', z.toFixed(4)); }
    if (cabe()) return;
    // primeiro acha um tamanho que caiba; depois aproxima do maior possível
    var MIN = 0.6, cabeZ = 1, grande = 1;
    for (var i = 0; i < 4 && cabeZ > MIN; i++) {
      grande = cabeZ;
      cabeZ = Math.max(MIN, cabeZ * telaSplash.clientHeight / telaSplash.scrollHeight);
      usar(cabeZ);
      if (cabe()) break;
    }
    for (var j = 0; j < 5; j++) {
      var meio = (cabeZ + grande) / 2;
      usar(meio);
      if (cabe()) cabeZ = meio; else grande = meio;
    }
    usar(cabeZ);
  }
  var encaixePendente = 0;
  function encaixarDepois() {
    cancelAnimationFrame(encaixePendente);
    encaixePendente = requestAnimationFrame(encaixarSplash);
  }
  window.addEventListener('resize', encaixarDepois);
  window.addEventListener('orientationchange', encaixarDepois);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', encaixarDepois);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(encaixarDepois);
  // os textos do "Meus agendamentos"/"Tenho um negócio" mudam depois do login
  if (window.MutationObserver && telaSplash) {
    new MutationObserver(encaixarDepois).observe(telaSplash, { childList: true, characterData: true, subtree: true });
  }

  // ---------- telas: splash ↔ lista da área (sem recarregar) ----------
  var slotHero = document.getElementById('explorarCuboSlot');
  var slotSplash = document.querySelector('.sp-topo');
  var cubo = document.getElementById('pullRefreshCubo');

  function telaDaUrl() {
    var a = new URLSearchParams(location.search).get('area');
    if (AREAS.indexOf(a) > -1) return a;
    return /explorar/.test(location.pathname) ? (ler(CHAVE_ULTIMA) && AREAS.indexOf(ler(CHAVE_ULTIMA)) > -1 ? ler(CHAVE_ULTIMA) : 'agenda') : 'splash';
  }
  function urlDa(tela) { return tela === 'splash' ? '/' : '/explorar.html?area=' + tela; }

  // o cubo que estica ao puxar vai junto pra tela que está aparecendo
  function moverCubo(tela) {
    if (!cubo) return;
    var lugar = tela === 'splash' ? slotSplash : slotHero;
    if (!lugar) return;
    cubo.className = tela === 'splash' ? 'sp-cubo' : 'cubo-no-hero';
    if (cubo.parentNode !== lugar) {
      if (tela === 'splash') lugar.insertBefore(cubo, lugar.firstChild); else lugar.appendChild(cubo);
    }
  }

  function mostrar(tela) {
    var ehSplash = tela === 'splash';
    corpo.setAttribute('data-tela', ehSplash ? 'splash' : 'explorar');
    corpo.className = ehSplash ? 'sp-corpo' : 'com-tabbar tela-catalogo';
    document.title = TITULOS[tela] || TITULOS.splash;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = ehSplash ? '#f4f4f6' : '#ffffff';
    if (!ehSplash && window.VBExplorar) window.VBExplorar.abrir(tela);
    if (ehSplash) { marcarUltima(); focar(null); atualizarCliente(); }
    videoConforme(ehSplash ? 'splash' : 'lista');
    moverCubo(tela);
    window.scrollTo(0, 0);
    encaixarSplash();
  }

  // desliza pro lado: View Transition dentro da página, ou CSS como reserva
  function trocar(tela, dir) {
    var aplicar = function () { mostrar(tela); };
    var html = document.documentElement;
    if (reduz) { aplicar(); return; }
    if (document.startViewTransition) {
      html.classList.add('vt-dir-' + dir);
      var vt = document.startViewTransition(aplicar);
      vt.finished.then(limpar, limpar);
    } else {
      aplicar();
      var alvo = tela === 'splash' ? document.getElementById('telaSplash') : document.getElementById('telaExplorar');
      alvo.classList.remove('vt-entra-avanca', 'vt-entra-volta');
      void alvo.offsetWidth;
      alvo.classList.add('vt-entra-' + dir);
    }
    function limpar() { html.classList.remove('vt-dir-avanca', 'vt-dir-volta'); }
  }

  var telaAtual = telaDaUrl();
  // vai pra uma tela: 'splash' ou uma área. Splash → área empilha no
  // histórico (o "voltar" do celular retorna pra splash); área → área só
  // troca o endereço.
  function irPara(tela, dir) {
    if (tela === telaAtual) return;
    var ordem = ['splash'].concat(AREAS);
    dir = dir || (ordem.indexOf(tela) > ordem.indexOf(telaAtual) ? 'avanca' : 'volta');
    if (tela === 'splash') {
      if (history.state && history.state.veioDaSplash) { history.back(); return; } // o popstate faz a troca
      history.pushState({ vibe: 'splash' }, '', urlDa('splash'));
    } else {
      gravar(CHAVE_ULTIMA, tela);
      if (telaAtual === 'splash') history.pushState({ vibe: 'area', veioDaSplash: true }, '', urlDa(tela));
      else history.replaceState({ vibe: 'area', veioDaSplash: !!(history.state && history.state.veioDaSplash) }, '', urlDa(tela));
    }
    telaAtual = tela;
    trocar(tela, dir);
  }
  window.addEventListener('popstate', function () {
    var tela = telaDaUrl();
    if (tela === telaAtual) return;
    var dir = tela === 'splash' ? 'volta' : 'avanca';
    telaAtual = tela;
    trocar(tela, dir);
  });
  window.VBInicio = { irPara: irPara, atualizarCliente: atualizarCliente };

  // cards da splash: áreas trocam na mesma página; "negócio" navega normal
  ops.forEach(function (op) {
    op.addEventListener('click', function (e) {
      var area = op.getAttribute('data-area');
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // nova aba: segue normal
      gravar(CHAVE_ULTIMA, area);
      if (AREAS.indexOf(area) === -1) { if (T.marcarDirecao) T.marcarDirecao('avanca'); return; }
      e.preventDefault();
      irPara(area, 'avanca');
    });
  });
  // "Início" e a marca, dentro da lista, voltam pra splash sem recarregar
  document.querySelectorAll('#telaExplorar a[href="/"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      irPara('splash', 'volta');
    });
  });
  var tabExplorar = document.querySelector('#telaExplorar .tabbar-item.is-ativo');
  if (tabExplorar) tabExplorar.addEventListener('click', function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  // estado inicial (a tela já foi escolhida antes de pintar, no próprio HTML)
  history.replaceState({ vibe: telaAtual === 'splash' ? 'splash' : 'area' }, '', location.href);
  mostrar(telaAtual);
  // enquanto a pessoa lê a splash, as três listas já vão sendo buscadas
  if (telaAtual === 'splash' && window.VBExplorar) {
    (window.requestIdleCallback || function (f) { setTimeout(f, 700); })(function () { window.VBExplorar.prebuscar(); });
  }

  // voltou pelo "voltar" do navegador vindo de outra página (bfcache)
  window.addEventListener('pageshow', function () { focar(null); });
})();
