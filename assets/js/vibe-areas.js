/* Botão-cubo das áreas do negócio (Agenda · Delivery · Serviços).
   O logotipo do app (cubo de arestas douradas) vira o seletor: cada face
   lateral do cubo tem a cor translúcida de uma área. Tocar gira o cubo
   e abre a lista das áreas; escolher uma gira até a face dela e troca o
   painel. Área que o negócio ainda não tem aparece como "Ativar".

   Uso:
     VibeAreas.montar(elemento, {
       negocio: { id, areas: ['agenda','delivery'], segmento },
       atual: 'agenda',
       aoEscolher: function (area) { ... },        // área já ativa
       aoAtivar:   function (area) { ... }         // área nova
     });

   Sem three.js (CDN fora), cai num cubo desenhado em SVG, parado. */
(function (global) {
  'use strict';

  var AREAS = {
    agenda:   { nome: 'Agenda',   desc: 'Horários, clientes e caixa', cor: 0x0F6B5C, css: '15, 107, 92', face: 0 },
    delivery: { nome: 'Delivery', desc: 'Pedidos, cardápio e entregas', cor: 0xC4553A, css: '196, 85, 58', face: 1 },
    servicos: { nome: 'Serviços', desc: 'Chamados e orçamentos no local', cor: 0x2F5D7C, css: '47, 93, 124', face: 2 }
  };
  var ORDEM = ['agenda', 'delivery', 'servicos'];
  var reduz = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SVG_CUBO = '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="#C9A227" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M16 3l11 6v14l-11 6-11-6V9z"/><path d="M5 9l11 6 11-6M16 15v14"/></svg>';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // tinge a página/painel com a cor sutil da área
  function aplicarTinta(area, alvo) {
    var a = AREAS[area] || AREAS.agenda;
    (alvo || document.documentElement).style.setProperty('--area-rgb', a.css);
    (alvo || document.documentElement).setAttribute('data-area', area);
  }

  function criarCubo(canvasBox, faceInicial) {
    var api = { girarPara: function () {}, pulso: function () {} };
    import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js').then(function (THREE) {
      var tam = canvasBox.clientWidth || 34;
      var canvas = document.createElement('canvas');
      canvasBox.innerHTML = '';
      canvasBox.appendChild(canvas);
      var scene = new THREE.Scene();
      var f = 2.5;
      var camera = new THREE.OrthographicCamera(-f / 2, f / 2, f / 2, -f / 2, 0.1, 20);
      camera.position.z = 5;
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      renderer.setSize(tam, tam);
      renderer.setClearColor(0x000000, 0);

      var geo = new THREE.BoxGeometry(1.15, 1.15, 1.15);
      // ordem das faces do BoxGeometry: +x, -x, +y, -y, +z, -z
      // frente (+z) = agenda; direita (+x) = delivery; trás (-z) = serviços
      var faceCor = [AREAS.delivery.cor, 0xffffff, 0xffffff, 0xffffff, AREAS.agenda.cor, AREAS.servicos.cor];
      var mats = faceCor.map(function (c) {
        return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: c === 0xffffff ? 0 : 0.2, side: THREE.DoubleSide, depthWrite: false });
      });
      var grupo = new THREE.Group();
      grupo.add(new THREE.Mesh(geo, mats));
      grupo.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xC9A227 })));
      scene.add(grupo);

      // cada área = um quarto de volta no eixo Y (a face dela vem pra frente)
      function anguloDaFace(i) { return i === 0 ? 0 : i === 1 ? -Math.PI / 2 : -Math.PI; }
      var alvoY = anguloDaFace(faceInicial || 0);
      grupo.rotation.x = 0.38;
      grupo.rotation.y = alvoY + 0.5;
      var girando = 0;

      function quadro() {
        var dy = alvoY - grupo.rotation.y;
        if (girando > 0) { grupo.rotation.y += 0.22; girando -= 0.22; }
        else if (Math.abs(dy) > 0.002) grupo.rotation.y += dy * (reduz ? 1 : 0.12);
        else if (!reduz) grupo.rotation.x = 0.38 + Math.sin(Date.now() / 1400) * 0.05;
        renderer.render(scene, camera);
        requestAnimationFrame(quadro);
      }
      quadro();

      api.girarPara = function (i) {
        // sempre gira pra frente (nunca "volta" o cubo)
        var destino = anguloDaFace(i);
        while (destino > grupo.rotation.y - 0.01) destino -= Math.PI * 2;
        while (destino < grupo.rotation.y - Math.PI * 2) destino += Math.PI * 2;
        alvoY = destino;
      };
      api.pulso = function () { if (!reduz) girando = Math.PI / 2; alvoY -= Math.PI / 2; };
    }).catch(function () { canvasBox.innerHTML = SVG_CUBO; });
    return api;
  }

  function montar(el, opts) {
    if (!el) return null;
    var negocio = opts.negocio || { areas: ['agenda'] };
    var areas = negocio.areas || ['agenda'];
    var atual = AREAS[opts.atual] ? opts.atual : areas[0];
    aplicarTinta(atual, opts.alvoTinta);

    el.classList.add('vibe-areas');
    el.innerHTML =
      '<button type="button" class="vibe-areas-btn" aria-haspopup="true" aria-expanded="false" aria-label="Trocar de área: ' + esc(AREAS[atual].nome) + '">' +
        '<span class="vibe-areas-cubo">' + SVG_CUBO + '</span>' +
        '<span class="vibe-areas-rotulo"><small>Área</small><strong>' + esc(AREAS[atual].nome) + '</strong></span>' +
        '<svg class="vibe-areas-seta" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
      '</button>' +
      '<div class="vibe-areas-menu" role="menu" hidden></div>';

    var btn = el.querySelector('.vibe-areas-btn');
    var menu = el.querySelector('.vibe-areas-menu');
    var cubo = criarCubo(el.querySelector('.vibe-areas-cubo'), AREAS[atual].face);

    // Delivery e Serviços dividem o mesmo motor: o negócio tem um dos dois
    function opcoes() {
      var temPedidos = areas.indexOf('delivery') !== -1 || areas.indexOf('servicos') !== -1;
      return ORDEM.filter(function (a) {
        if (areas.indexOf(a) !== -1) return true;
        if (a === 'agenda') return true;
        return !temPedidos; // oferece ativar Delivery/Serviços só se não tiver nenhum
      });
    }

    function desenharMenu() {
      menu.innerHTML = '<p class="vibe-areas-titulo">Áreas do seu negócio</p>' + opcoes().map(function (a) {
        var ativa = areas.indexOf(a) !== -1;
        var info = AREAS[a];
        var extra = opts.contagens && opts.contagens[a] ? '<em>' + esc(opts.contagens[a]) + '</em>' : '';
        return '<button type="button" role="menuitem" class="vibe-areas-op' + (a === atual ? ' atual' : '') + (ativa ? '' : ' nova') + '" data-area="' + a + '" style="--op-rgb:' + info.css + '">' +
          '<span class="vibe-areas-bolinha"></span>' +
          '<span class="vibe-areas-op-txt"><strong>' + (ativa ? '' : 'Ativar ') + esc(info.nome) + extra + '</strong><small>' + esc(info.desc) + '</small></span>' +
          (a === atual ? '<span class="vibe-areas-aqui">aqui</span>' : '') +
        '</button>';
      }).join('');
    }

    function abrir() {
      desenharMenu();
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      el.classList.add('aberto');
      cubo.pulso();
    }
    function fechar() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      el.classList.remove('aberto');
      cubo.girarPara(AREAS[atual].face);
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.hidden) abrir(); else fechar();
    });
    menu.addEventListener('click', function (e) {
      var op = e.target.closest('[data-area]');
      if (!op) return;
      var area = op.getAttribute('data-area');
      if (area === atual) { fechar(); return; }
      cubo.girarPara(AREAS[area].face);
      aplicarTinta(area, opts.alvoTinta);
      el.querySelector('.vibe-areas-rotulo strong').textContent = AREAS[area].nome;
      menu.hidden = true;
      el.classList.remove('aberto');
      // deixa o cubo terminar de girar antes de trocar de tela
      setTimeout(function () {
        if (areas.indexOf(area) !== -1) { if (opts.aoEscolher) opts.aoEscolher(area); }
        else if (opts.aoAtivar) opts.aoAtivar(area);
      }, reduz ? 0 : 420);
    });
    document.addEventListener('click', function (e) { if (!el.contains(e.target) && !menu.hidden) fechar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) fechar(); });

    return { fechar: fechar, abrir: abrir };
  }

  global.VibeAreas = { AREAS: AREAS, montar: montar, aplicarTinta: aplicarTinta };
})(window);
