/* Toggle das áreas do negócio (Agendar · Pedir · Chamar/Orçamento).

   Peça central da troca entre os sistemas do mesmo estabelecimento:
   - trilho em cápsula translúcida com uma "bolha" que desliza até a
     opção escolhida esticando como líquido (a borda da frente sai
     primeiro, a de trás alcança depois — dá a sensação de puxar);
   - ícones de linha desenhados em SVG que se "desenham" ao ativar
     (stroke-dashoffset), cada um com um gesto próprio: o calendário
     marca o check, a sacola balança a alça, o pino cai e quica;
   - cubo do logo (CSS 3D, só arestas douradas) dá um quarto de volta
     a cada troca;
   - troca de tela deslizando pro lado (View Transitions entre páginas;
     sem suporte, a página nova entra deslizando por CSS) e também por
     gesto: arrastar a tela pro lado troca de área.

   Uso:
     VibeToggle.montar(elemento, {
       opcoes: [{ chave: 'agenda', rotulo: 'Agendar', href: '/x/y' }, ...],
       atual: 'agenda',
       tema: 'escuro' | 'claro',          // escuro = faixa do site público
       swipe: true,                         // arrastar a tela troca de área
       extra: { rotulo: 'Ativar', aoClicar: fn },   // botão "+" opcional
       aoTrocar: function (chave, opcao) {} // padrão: navega pro href
     }); */
(function (global) {
  'use strict';

  var reduz = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CHAVE_DIRECAO = 'vibe-vt-direcao';

  // ícones de linha (24×24) — cada traço tem pathLength=1 pra animação de desenho
  var ICONES = {
    agenda: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" pathLength="1"/><path d="M3.5 10h17" pathLength="1"/><path d="M8.5 3v4M15.5 3v4" pathLength="1" class="vt-aneis"/><path d="M9 15l2 2 4-4" pathLength="1" class="vt-check"/></svg>',
    delivery: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.3a1.5 1.5 0 0 1-1.5 1.2H7.7a1.5 1.5 0 0 1-1.5-1.2z" pathLength="1"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" pathLength="1" class="vt-alca"/></svg>',
    servicos: '<svg viewBox="0 0 24 24" aria-hidden="true"><g class="vt-pino"><path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z" pathLength="1"/><circle cx="12" cy="10" r="2.4" pathLength="1"/></g><path d="M8.5 21.5h7" pathLength="1" class="vt-chao"/></svg>',
    mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" pathLength="1"/></svg>'
  };

  var CUBO = '<span class="vt-cubo" aria-hidden="true"><span class="vt-cubo-3d">' +
    '<i class="f1"></i><i class="f2"></i><i class="f3"></i><i class="f4"></i><i class="f5"></i><i class="f6"></i></span></span>';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- transição de página (deslizar pro lado) ---------- */
  function marcarDirecao(dir) {
    try { sessionStorage.setItem(CHAVE_DIRECAO, dir); } catch (e) {}
  }
  // roda o mais cedo possível na página nova: diz pro View Transition
  // pra que lado deslizar; sem suporte, anima a entrada por CSS
  function prepararEntrada() {
    var dir = null;
    try { dir = sessionStorage.getItem(CHAVE_DIRECAO); sessionStorage.removeItem(CHAVE_DIRECAO); } catch (e) {}
    if (!dir) return;
    var suportaVT = 'onpagereveal' in global && CSS.supports && CSS.supports('view-transition-name: a');
    if (suportaVT) {
      global.addEventListener('pagereveal', function (e) {
        if (e.viewTransition && e.viewTransition.types) e.viewTransition.types.add(dir);
      }, { once: true });
    } else if (!reduz) {
      document.documentElement.classList.add('vt-entrando', 'vt-entrando-' + dir);
      global.addEventListener('load', function () {
        requestAnimationFrame(function () { document.documentElement.classList.add('vt-entrou'); });
        setTimeout(function () { document.documentElement.classList.remove('vt-entrando', 'vt-entrando-' + dir, 'vt-entrou'); }, 700);
      });
    }
  }
  prepararEntrada();
  global.addEventListener('pageswap', function (e) {
    var dir = null;
    try { dir = sessionStorage.getItem(CHAVE_DIRECAO); } catch (er) {}
    if (e.viewTransition && e.viewTransition.types && dir) e.viewTransition.types.add(dir);
  });

  /* ---------- componente ---------- */
  function montar(el, opts) {
    if (!el) return null;
    var opcoes = (opts.opcoes || []).filter(function (o) { return o && o.chave; });
    var idx = Math.max(0, opcoes.findIndex(function (o) { return o.chave === opts.atual; }));
    var extra = opts.extra || null;
    var n = opcoes.length;

    el.classList.add('vt', 'vt-' + (opts.tema || 'claro'));
    el.innerHTML =
      (opts.semCubo ? '' : CUBO) +
      '<div class="vt-trilho" role="tablist" aria-label="' + esc(opts.rotulo || 'Áreas') + '" style="--n:' + n + '">' +
        '<span class="vt-bolha" aria-hidden="true"></span>' +
        opcoes.map(function (o, i) {
          return '<a class="vt-op' + (i === idx ? ' ativo' : '') + '" role="tab" aria-selected="' + (i === idx) + '" data-i="' + i + '" data-area="' + esc(o.chave) + '"' +
            (o.href ? ' href="' + esc(o.href) + '"' : ' href="#"') + '>' +
            '<span class="vt-ic vt-ic-' + esc(o.icone || o.chave) + '">' + (ICONES[o.icone || o.chave] || '') + '</span>' +
            '<span class="vt-txt">' + esc(o.rotulo) + '</span>' + (o.selo ? '<em class="vt-selo">' + esc(o.selo) + '</em>' : '') + '</a>';
        }).join('') +
      '</div>' +
      (extra ? '<button type="button" class="vt-mais" aria-label="' + esc(extra.rotulo || 'Ativar área') + '" title="' + esc(extra.rotulo || 'Ativar área') + '">' + ICONES.mais + '</button>' : '');

    var trilho = el.querySelector('.vt-trilho');
    var bolha = el.querySelector('.vt-bolha');
    var cubo = el.querySelector('.vt-cubo-3d');
    var ops = el.querySelectorAll('.vt-op');
    var giro = 0;

    function posicionar(i, animar) {
      // bolha: left/right em % do trilho; a borda que vai na frente anda
      // primeiro (sem atraso) e a de trás espera um pouco → estica e recolhe
      var esq = (i / n) * 100, dir = ((n - 1 - i) / n) * 100;
      var indo = i > idx ? 'direita' : i < idx ? 'esquerda' : null;
      // ordem das transições no CSS: left, right, background-color, box-shadow, translate
      bolha.style.transitionDelay = !animar || reduz ? '0s'
        : indo === 'direita' ? '0.1s, 0s, 0s, 0s, 0s'
        : indo === 'esquerda' ? '0s, 0.1s, 0s, 0s, 0s' : '0s';
      bolha.classList.toggle('sem-anim', !animar);
      bolha.style.left = 'calc(' + esq + '% + 3px)';
      bolha.style.right = 'calc(' + dir + '% + 3px)';
      el.style.setProperty('--area-rgb', 'var(--vt-rgb-' + opcoes[i].chave + ')');
    }

    function ativar(i, animar) {
      var anterior = idx;
      posicionar(i, animar);
      idx = i;
      ops.forEach(function (op, k) {
        op.classList.toggle('ativo', k === i);
        op.setAttribute('aria-selected', String(k === i));
        op.classList.remove('desenhando');
      });
      if (animar && !reduz) {
        void ops[i].offsetWidth;
        ops[i].classList.add('desenhando');
        if (cubo) { giro += (i > anterior ? 90 : -90); cubo.style.setProperty('--giro', giro + 'deg'); }
      }
    }

    function escolher(i, viaGesto) {
      if (i < 0 || i >= n || i === idx) return;
      var dir = i > idx ? 'avanca' : 'volta';
      ativar(i, true);
      var o = opcoes[i];
      if (!opts.aoTrocar) marcarDirecao(dir); // troca dentro da mesma página não precisa
      // deixa a bolha chegar antes de trocar de tela
      setTimeout(function () {
        if (opts.aoTrocar) opts.aoTrocar(o.chave, o, dir);
        else if (o.href) global.location.href = o.href;
      }, reduz ? 0 : (viaGesto ? 260 : 380));
    }

    trilho.addEventListener('click', function (e) {
      var op = e.target.closest('.vt-op');
      if (!op) return;
      e.preventDefault();
      escolher(Number(op.getAttribute('data-i')));
    });
    trilho.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); ops[Math.min(n - 1, idx + 1)].focus(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); ops[Math.max(0, idx - 1)].focus(); }
    });
    if (extra) el.querySelector('.vt-mais').addEventListener('click', function () { if (extra.aoClicar) extra.aoClicar(); });

    // posição inicial sem animação; os ícones ativos já aparecem desenhados
    posicionar(idx, false);
    requestAnimationFrame(function () { bolha.classList.remove('sem-anim'); });

    if (opts.swipe && n > 1) ligarGesto(escolher, function () { return idx; }, n, bolha, opts.gestoAtivo);

    // definir: muda a opção ativa sem disparar a troca (ex.: voltar do histórico)
    function definir(chave, animar) {
      var i = opcoes.findIndex(function (o) { return o.chave === chave; });
      if (i > -1 && i !== idx) ativar(i, animar !== false);
    }
    return { escolher: escolher, definir: definir, atual: function () { return opcoes[idx].chave; } };
  }

  /* ---------- gesto: arrastar a tela pro lado ---------- */
  function rolaNaHorizontal(el) {
    for (var no = el; no && no !== document.body; no = no.parentElement) {
      if (no.scrollWidth > no.clientWidth + 4) {
        var ox = getComputedStyle(no).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
    }
    return false;
  }
  function ligarGesto(escolher, atual, n, bolha, ativo) {
    var x0 = null, y0 = 0, t0 = 0, cancelado = false;
    document.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1 || (ativo && !ativo())) { x0 = null; return; }
      var alvo = e.target;
      if (alvo.closest('input, textarea, select, [data-sem-gesto], .sheet.aberto, .admin-painel-overlay:not(.oculto) .dash-abas') || rolaNaHorizontal(alvo) || document.body.classList.contains('travado')) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); cancelado = false;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (x0 === null || cancelado) return;
      var dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) { cancelado = true; bolha.style.translate = ''; return; }
      // a bolha "sente" o dedo: puxa um pouquinho pro lado do gesto
      var pode = (dx < 0 && atual() < n - 1) || (dx > 0 && atual() > 0);
      bolha.style.translate = pode ? (Math.max(-14, Math.min(14, -dx / 8)) + 'px 0') : '';
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      bolha.style.translate = '';
      if (x0 === null || cancelado) { x0 = null; return; }
      var t = e.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0, dt = Date.now() - t0;
      x0 = null;
      if (Math.abs(dx) < 70 || Math.abs(dy) > 50 || dt > 700) return;
      escolher(atual() + (dx < 0 ? 1 : -1), true);
    }, { passive: true });
  }

  // nome de cada área no painel do dono (trocar aqui troca no app todo)
  var NOMES = { agenda: 'Agenda', delivery: 'Delivery', servicos: 'No local' };

  // tinge a página (ou um painel) com a cor sutil da área
  var RGB = { agenda: '15, 107, 92', delivery: '196, 85, 58', servicos: '47, 93, 124' };
  function tingir(area, alvo) {
    var el = alvo || document.documentElement;
    el.style.setProperty('--area-rgb', RGB[area] || RGB.agenda);
    el.setAttribute('data-area', RGB[area] ? area : 'agenda');
  }

  global.VibeToggle = { montar: montar, marcarDirecao: marcarDirecao, tingir: tingir, NOMES: NOMES, ICONES: ICONES, RGB: RGB };
})(window);
