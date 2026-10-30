/* Cubo do hero, sempre visível, girando devagar sozinho (igual o do
   topo, só que maior e dentro do hero, acima do "Vibe" dourado).
   Puxar a página pra baixo (só quando já está no topo do scroll) estica
   as LINHAS do cubo feito elástico, sem mexer em mais nada do layout —
   nada de área branca aparecendo, nada de site "sumindo e voltando".
   Soltando depois de passar o ponto de virada, o cubo gira o mais
   rápido possível, perdendo força, e a página recarrega de verdade.
   Não é clicável de propósito: só reage a arrastar o dedo (touch). */
(function () {
  var alvo = document.getElementById('pullRefreshCubo');
  if (!alvo || !window.requestAnimationFrame || /[?&]embed=1/.test(location.search)) return;
  var temToque = 'ontouchstart' in window; // o cubo aparece sempre; o gesto de puxar só em touch

  var reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var PUXAO_MAX_PX = 130; // quanto de dedo (em px) equivale ao esticão máximo
  var LIMIAR_PX = 96;
  var ESTICAR_MAX = 2.0;

  var cuboApi = iniciarCubo();

  // cubo em canvas 2D (antes three.js: ≈1 MB e um motor 3D só pra 12 linhas)
  function iniciarCubo() {
    // desenha em 64px e o CSS encaixa no lugar (40px no hero, 58px na splash)
    var TAM = 64, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var canvas = document.createElement('canvas');
    canvas.width = TAM * dpr; canvas.height = TAM * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    var g = canvas.getContext('2d');
    if (!g) return null;
    alvo.appendChild(canvas);

    var L = 1.15 / 2;
    var VERT = [[-L, -L, -L], [L, -L, -L], [L, L, -L], [-L, L, -L], [-L, -L, L], [L, -L, L], [L, L, L], [-L, L, L]];
    var ARESTAS = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    var frustumBase = 2.6;
    var rotX = 0.4, rotY = 0.5, esc = [1, 1, 1], metadeV = frustumBase / 2;

    function linhas(fator, alfa) {
      var cX = Math.cos(rotX), sX = Math.sin(rotX), cY = Math.cos(rotY), sY = Math.sin(rotY);
      var meio = canvas.width / 2, porX = meio / (frustumBase / 2), porY = meio / metadeV;
      var p = VERT.map(function (v) {
        // escala (esticão) e depois o giro, igual ao three.js (Rx·Ry·S)
        var x = v[0] * esc[0] * fator, y = v[1] * esc[1] * fator, z = v[2] * esc[2] * fator;
        var x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
        var y2 = y * cX - z1 * sX;
        return [meio + x1 * porX, meio - y2 * porY];
      });
      g.globalAlpha = alfa;
      g.beginPath();
      ARESTAS.forEach(function (a) { g.moveTo(p[a[0]][0], p[a[0]][1]); g.lineTo(p[a[1]][0], p[a[1]][1]); });
      g.stroke();
    }
    function desenhar() {
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.strokeStyle = '#C9A227';
      g.lineWidth = 1.4 * dpr;
      g.lineJoin = 'round';
      linhas(1, 1);
      // reforço um pouco maior e mais fraco: girando rápido a linha fina não some
      linhas(1.12, 0.55);
      g.globalAlpha = 1;
    }

    var velocidadeIdle = 0.0016, girandoRapido = false, velocidadeRapida = 0;
    var visivel = true, quadro = 0;
    function loop() {
      quadro = 0;
      if (girandoRapido) {
        rotY += velocidadeRapida;
        rotX += velocidadeRapida * 0.6;
        velocidadeRapida *= 0.94;
        if (velocidadeRapida < 0.002) girandoRapido = false;
      } else if (!reduzMovimento) {
        rotY += velocidadeIdle;
        rotX += velocidadeIdle * 0.6;
      }
      desenhar();
      // parado fora da tela ou com a aba escondida: não gasta bateria
      if ((visivel && !document.hidden && !reduzMovimento) || girandoRapido) quadro = requestAnimationFrame(loop);
    }
    function ligar() { if (!quadro) quadro = requestAnimationFrame(loop); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; if (visivel) ligar(); }).observe(alvo);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ligar(); });
    desenhar();
    ligar();

    function ajustarJanela(escalaY) {
      // a janela cresce junto com o esticão: as linhas esticam inteiras, sem cortar
      metadeV = (frustumBase / 2) * (1 + Math.max(0, escalaY - 1) * 0.8);
    }
    return {
      esticar: function (progresso) {
        // elástico: alonga no vertical e afina um pouco nos outros dois
        var escalaY = 1 + progresso * ESTICAR_MAX;
        esc = [1 - progresso * 0.22, escalaY, 1 - progresso * 0.22];
        ajustarJanela(escalaY);
        desenhar();
      },
      girarRapido: function () { girandoRapido = true; velocidadeRapida = 0.48; ligar(); },
      resetar: function () { esc = [1, 1, 1]; ajustarJanela(1); desenhar(); }
    };
  }

  var arrastando = false;
  var carregando = false;
  var inicioY = 0;
  var puxadoPx = 0;

  function podeComecarArrasto() {
    // só com o cubo na tela e sem nenhuma janela aberta por cima
    return temToque && window.scrollY <= 0 && !carregando && alvo.offsetParent !== null &&
      !document.querySelector('.admin-pin-overlay:not(.oculto), .admin-painel-overlay:not(.oculto)');
  }

  document.addEventListener('touchstart', function (e) {
    if (!podeComecarArrasto()) return;
    arrastando = true;
    inicioY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!arrastando) return;
    var dy = e.touches[0].clientY - inicioY;
    // o dedo subiu (quer rolar a página pra baixo): solta o gesto de vez —
    // no iPhone, travar o primeiro movimento cancela a rolagem inteira
    if (dy < -4 || window.scrollY > 0) {
      arrastando = false;
      puxadoPx = 0;
      if (cuboApi) cuboApi.resetar();
      return;
    }
    // tremidinho do dedo ainda não é puxão: deixa o navegador decidir
    if (dy < 10) return;
    e.preventDefault();
    puxadoPx = Math.min(PUXAO_MAX_PX, dy);
    if (cuboApi) cuboApi.esticar(puxadoPx / PUXAO_MAX_PX);
  }, { passive: false });

  function finalizarArrasto() {
    if (!arrastando) return;
    arrastando = false;
    if (puxadoPx >= LIMIAR_PX && !carregando) {
      carregando = true;
      if (cuboApi) {
        cuboApi.resetar();
        cuboApi.girarRapido();
      }
      setTimeout(function () { window.location.reload(); }, 900);
    } else if (cuboApi) {
      cuboApi.resetar();
    }
    puxadoPx = 0;
  }

  document.addEventListener('touchend', finalizarArrasto);
  document.addEventListener('touchcancel', finalizarArrasto);
})();
