/* Logo 3D da Matriz — o cubo dentro do relógio da torre (marca.js): só as
   arestas douradas, sem preenchimento, em projeção ortográfica (nenhuma
   ponta sai do quadro em ângulo nenhum). Gira sozinho bem devagar e
   responde a arrastar o dedo/mouse, sem parecer botão.
   Desenhado em canvas 2D puro: antes usava three.js (≈1 MB baixado e um
   motor 3D ligado só pra 12 linhas). Para de desenhar quando sai da tela
   ou a aba fica em segundo plano. */
(function () {
  var container = document.getElementById('cube3d');
  if (!container || !window.requestAnimationFrame) return;

  var reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.createElement('canvas');
  container.appendChild(canvas);
  var g = canvas.getContext('2d');
  if (!g) { container.remove(); return; }

  var L = 1.15 / 2; // meia aresta (mesmo cubo de antes: 1,15 numa janela de 2,6)
  var VERT = [[-L, -L, -L], [L, -L, -L], [L, L, -L], [-L, L, -L], [-L, -L, L], [L, -L, L], [L, L, L], [-L, L, L]];
  var ARESTAS = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  var JANELA = 2.6;

  var rotX = 0.5, rotY = 0.7, velX = 0.0016, velY = 0.0026;
  var w = 0, h = 0, dpr = 1;
  function medir() {
    w = container.clientWidth || 30; h = container.clientHeight || 30;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  }
  function desenhar() {
    var escala = Math.min(w, h) / JANELA * dpr, cx = canvas.width / 2, cy = canvas.height / 2;
    var cX = Math.cos(rotX), sX = Math.sin(rotX), cY = Math.cos(rotY), sY = Math.sin(rotY);
    var p = VERT.map(function (v) {
      // mesma conta do three.js (Euler XYZ = Rx·Ry): o ponto gira em Y, depois em X
      var x1 = v[0] * cY + v[2] * sY, z1 = -v[0] * sY + v[2] * cY;
      var y2 = v[1] * cX - z1 * sX;
      return [cx + x1 * escala, cy - y2 * escala];
    });
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = '#C9A227';
    g.lineWidth = Math.max(1, dpr);
    g.lineJoin = 'round';
    g.beginPath();
    ARESTAS.forEach(function (a) { g.moveTo(p[a[0]][0], p[a[0]][1]); g.lineTo(p[a[1]][0], p[a[1]][1]); });
    g.stroke();
  }

  var arrastando = false, moveu = false, ultimoX = 0, ultimoY = 0;
  container.addEventListener('pointerdown', function (e) {
    arrastando = true; moveu = false; ultimoX = e.clientX; ultimoY = e.clientY;
    if (container.setPointerCapture) container.setPointerCapture(e.pointerId);
    ligar();
  });
  container.addEventListener('pointermove', function (e) {
    if (!arrastando) return;
    var dx = e.clientX - ultimoX, dy = e.clientY - ultimoY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moveu = true;
    ultimoX = e.clientX; ultimoY = e.clientY;
    rotY += dx * 0.012; rotX += dy * 0.012;
    if (reduzMovimento) desenhar();
  });
  container.addEventListener('pointerup', function (e) {
    arrastando = false;
    // foi arrasto de verdade: o clique não navega pro link do logo
    if (moveu) { e.preventDefault(); e.stopPropagation(); }
  });
  container.addEventListener('pointercancel', function () { arrastando = false; });

  // só gira enquanto aparece na tela
  var visivel = true, quadro = 0;
  function laco() {
    quadro = 0;
    if (!arrastando && !reduzMovimento) { rotY += velY; rotX += velX; }
    desenhar();
    if (visivel && !document.hidden && !reduzMovimento) quadro = requestAnimationFrame(laco);
  }
  function ligar() { if (!quadro) quadro = requestAnimationFrame(laco); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; if (visivel) ligar(); }).observe(container);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ligar(); });
  window.addEventListener('resize', function () { medir(); desenhar(); });
  medir();
  desenhar();
  ligar();
})();
