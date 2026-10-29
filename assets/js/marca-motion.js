/* Motion do nome na splash: "Matriz" nasce de uma matriz de pontos. Uma
   grade fina de pontos acende dentro da pastilha de vidro, do centro pra
   fora; uma linha dourada varre da esquerda pra direita e, por onde ela
   passa, os pontos que caem dentro das letras crescem, brilham dourados e
   esfriam na cor da letra — os outros apagam. Quando a linha termina, a
   letra nítida do DOM entra no lugar dos pontos e o pingo do "i" (o losango
   dourado) cai por último. Tocar no nome refaz.

   Desenhado em canvas 2D puro, com as mesmas contas do efeito antigo em
   three.js (que baixava ≈1 MB e ligava um motor 3D só pra isso). Só roda no
   logotipo grande ([data-vibe-marca-logo="hero"]); depois que termina, o
   laço de desenho para. Com "reduzir movimento", fica o aparecer devagar
   do CSS. */
(function () {
  var el = document.querySelector('[data-vibe-marca-logo="hero"]');
  if (!el || !window.requestAnimationFrame) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var raiz = document.documentElement;
  raiz.classList.add('pt-motion');
  // rede de segurança: se algo travar, o nome nunca fica escondido
  var seguranca = setTimeout(revelar, 5000);
  function revelar() { raiz.classList.remove('pt-motion'); raiz.classList.add('pt-motion-fim'); }

  var fontePronta = new Promise(function (ok) {
    if (raiz.classList.contains('pt-marca-pronta')) return ok();
    var obs = new MutationObserver(function () {
      if (raiz.classList.contains('pt-marca-pronta')) { obs.disconnect(); ok(); }
    });
    obs.observe(raiz, { attributes: true, attributeFilter: ['class'] });
  });
  // espera a splash terminar de subir (spSobe) pra medir no lugar final
  fontePronta.then(function () { setTimeout(iniciar, 200); });

  var PASSO = 2.3;                    // distância entre pontos da grade (px)
  var T_VARRE = 0.55, D_VARRE = 1.35; // a linha dourada: quando começa e quanto dura

  // máscara das letras: cada letra desenhada no lugar exato em que o DOM a pôs
  function mascara(palavra, larg, alt) {
    var escala = 2;
    var c = document.createElement('canvas');
    c.width = larg * escala; c.height = alt * escala;
    var g = c.getContext('2d');
    g.scale(escala, escala);
    var caixa = el.getBoundingClientRect();
    var andar = document.createTreeWalker(palavra, NodeFilter.SHOW_TEXT);
    var no, faixa = document.createRange();
    while ((no = andar.nextNode())) {
      var est = getComputedStyle(no.parentNode);
      var tam = parseFloat(est.fontSize);
      g.font = est.fontWeight + ' ' + est.fontSize + ' ' + est.fontFamily;
      for (var i = 0; i < no.length; i++) {
        if (!no.data[i].trim()) continue;
        faixa.setStart(no, i); faixa.setEnd(no, i + 1);
        var r = faixa.getBoundingClientRect();
        g.fillText(no.data[i], r.left - caixa.left, r.top - caixa.top + r.height / 2 + tam * 0.29);
      }
    }
    var px = g.getImageData(0, 0, c.width, c.height).data;
    return function (x, y) {
      var xi = Math.round(x * escala), yi = Math.round(y * escala), soma = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var xx = xi + dx, yy = yi + dy;
        if (xx >= 0 && yy >= 0 && xx < c.width && yy < c.height) soma += px[(yy * c.width + xx) * 4 + 3];
      }
      return soma / (9 * 255);
    };
  }

  function suave(a, b, x) { var t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); }

  function iniciar() {
    var palavra = el.querySelector('.pt-word');
    if (!palavra) return revelar();
    var caixa = el.getBoundingClientRect();
    if (!caixa.width) return revelar();
    var larg = Math.ceil(caixa.width), alt = Math.ceil(caixa.height);
    var cobre = mascara(palavra, larg, alt);

    // grade dentro da pastilha (cápsula: some nos cantos arredondados)
    var raio = alt / 2, P = [];
    for (var y = PASSO / 2 + 1; y < alt - 1; y += PASSO) {
      for (var x = PASSO / 2 + 1; x < larg - 1; x += PASSO) {
        var cxp = Math.min(Math.max(x, raio), larg - raio);
        if (Math.hypot(x - cxp, y - raio) > raio - 1.5) continue;
        P.push({ x: x, y: y, letra: cobre(x, y) > 0.42 ? 1 : 0, dist: Math.hypot((x - larg / 2) / larg, (y - alt / 2) / alt) * 1.4, xn: x / larg });
      }
    }
    if (P.length < 100 || !P.some(function (p) { return p.letra; })) return revelar();

    var canvas = document.createElement('canvas');
    canvas.className = 'pt-motion-tela';
    canvas.setAttribute('aria-hidden', 'true');
    var g = canvas.getContext('2d');
    if (!g) return revelar();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = larg * dpr; canvas.height = alt * dpr;
    el.appendChild(canvas);
    g.scale(dpr, dpr);

    var tinta = getComputedStyle(el).color, OURO = '#C9A227';
    var FIM = T_VARRE + D_VARRE;
    var t0 = 0, rodando = false, quadro = 0;

    function desenhar(agora) {
      if (!t0) t0 = agora;
      var t = (agora - t0) / 1000;
      var v = (t - T_VARRE) / D_VARRE;                    // 0..1 durante a varrida
      var ve = v <= 0 ? 0 : v >= 1 ? 1 : 1 - Math.pow(1 - v, 2.2);
      var varre = v <= 0 ? -1 : -0.06 + ve * 1.18;
      // a letra nítida entra por baixo enquanto os pontos somem
      var troca = Math.min(Math.max((t - FIM + 0.1) / 0.7, 0), 1);
      var some = 1 - troca;
      if (troca > 0 && raiz.classList.contains('pt-motion')) { clearTimeout(seguranca); revelar(); }

      g.clearRect(0, 0, larg, alt);
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        // 1) a grade acende do centro pra fora
        var acende = suave(0, 0.4, t - p.dist * 0.5);
        // 2) a linha passa: d > 0 depois que ela passou pelo ponto
        var d = varre - p.xn;
        var perto = Math.exp(-d * d / 0.0012);
        var passou = suave(0, 0.05, d);
        var fica = p.letra * passou;
        var apaga = (1 - p.letra) * suave(0, 0.18, d);
        var alfa = (acende * (0.2 * (1 - apaga) * (1 - fica) + fica) + perto * 0.9) * some;
        if (alfa < 0.01) continue;
        // as letras chegam douradas e esfriam na cor da tinta
        var ouro = Math.max(perto, p.letra * passou * (1 - suave(0.05, 0.35, d)));
        var lado = 1.05 + fica * 0.9 + perto * 1.1;
        var px = p.x - lado / 2, py = p.y - perto * 1.6 * p.letra - lado / 2;
        if (ouro < 0.99) { g.globalAlpha = Math.min(1, alfa * (1 - ouro)); g.fillStyle = tinta; g.fillRect(px, py, lado, lado); }
        if (ouro > 0.01) { g.globalAlpha = Math.min(1, alfa * ouro); g.fillStyle = OURO; g.fillRect(px, py, lado, lado); }
      }
      // a linha dourada que varre (um fio vertical, mais forte no meio)
      var forca = v <= 0 || v >= 1 ? 0 : Math.sin(Math.min(v * 1.15, 1) * Math.PI);
      if (forca > 0.01) {
        var fx = varre * larg, grad = g.createLinearGradient(0, 0, 0, alt);
        grad.addColorStop(0, 'rgba(201,162,39,0)');
        grad.addColorStop(0.5, 'rgba(201,162,39,' + (0.85 * forca).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(201,162,39,0)');
        g.globalAlpha = 1; g.fillStyle = grad; g.fillRect(fx - 0.7, 0, 1.4, alt);
      }
      g.globalAlpha = 1;
      if (troca < 1) quadro = requestAnimationFrame(desenhar);
      else { rodando = false; canvas.style.visibility = 'hidden'; }
    }
    function tocar() {
      cancelAnimationFrame(quadro);
      t0 = 0; rodando = true;
      canvas.style.visibility = '';
      quadro = requestAnimationFrame(desenhar);
    }
    tocar();

    el.addEventListener('click', function () {
      if (rodando) return;
      raiz.classList.remove('pt-motion-fim');
      raiz.classList.add('pt-motion');
      seguranca = setTimeout(revelar, 5000);
      tocar();
    });
  }
})();
