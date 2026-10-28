/* Motion do nome na splash (three.js): "Matriz" nasce de uma matriz de
   pontos. Uma grade fina de pontos acende dentro da pastilha de vidro, do
   centro pra fora; uma linha dourada varre da esquerda pra direita e, por
   onde ela passa, os pontos que caem dentro das letras crescem, brilham
   dourados e esfriam na cor da letra — os outros apagam. Quando a linha
   termina, a letra nítida do DOM entra no lugar dos pontos e o pingo do
   "i" (o losango dourado) cai por último. Tocar no nome refaz.

   Só roda no logotipo grande ([data-vibe-marca-logo="hero"]); depois que
   termina, o laço de desenho para — não gasta bateria parado. Sem WebGL,
   sem three.js (CDN fora) ou com "reduzir movimento", fica o aparecer
   devagar do CSS. */
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

  Promise.all([
    import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js'),
    fontePronta
  ]).then(function (r) {
    // espera a splash terminar de subir (spSobe) pra medir no lugar final
    setTimeout(function () { iniciar(r[0]); }, 200);
  }).catch(revelar);

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

  function iniciar(THREE) {
    var palavra = el.querySelector('.pt-word');
    if (!palavra) return revelar();
    var caixa = el.getBoundingClientRect();
    if (!caixa.width) return revelar();
    var larg = Math.ceil(caixa.width), alt = Math.ceil(caixa.height);
    var cobre = mascara(palavra, larg, alt);

    // grade dentro da pastilha (cápsula: some nos cantos arredondados)
    var raio = alt / 2, pos = [], letra = [], dist = [], xn = [];
    for (var y = PASSO / 2 + 1; y < alt - 1; y += PASSO) {
      for (var x = PASSO / 2 + 1; x < larg - 1; x += PASSO) {
        var cxp = Math.min(Math.max(x, raio), larg - raio);
        if (Math.hypot(x - cxp, y - raio) > raio - 1.5) continue;
        var k = cobre(x, y);
        pos.push(x, -y, 0);
        letra.push(k > 0.42 ? 1 : 0);
        dist.push(Math.hypot((x - larg / 2) / larg, (y - alt / 2) / alt) * 1.4);
        xn.push(x / larg);
      }
    }
    var n = letra.length;
    if (n < 100 || letra.indexOf(1) === -1) return revelar();

    var canvas = document.createElement('canvas');
    canvas.className = 'pt-motion-tela';
    canvas.setAttribute('aria-hidden', 'true');
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    } catch (e) { return revelar(); }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(larg, alt, false);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(canvas);

    // câmera em pixels: (0,0) no canto de cima, y pra baixo, igual ao DOM
    var camera = new THREE.OrthographicCamera(0, larg, 0, -alt, -10, 10);
    var cena = new THREE.Scene();

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aLetra', new THREE.Float32BufferAttribute(letra, 1));
    geo.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
    geo.setAttribute('aX', new THREE.Float32BufferAttribute(xn, 1));

    var tinta = new THREE.Color(getComputedStyle(el).color);
    var uniformes = {
      uT: { value: 0 }, uSome: { value: 1 }, uDpr: { value: dpr },
      uTinta: { value: tinta }, uOuro: { value: new THREE.Color(0xC9A227) },
      uVarre: { value: -1 }
    };
    var pontos = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, uniforms: uniformes,
      vertexShader: [
        'attribute float aLetra, aDist, aX;',
        'uniform float uT, uDpr, uVarre;',
        'varying float vAlfa, vOuro;',
        'void main(){',
        // 1) a grade acende do centro pra fora
        '  float acende = smoothstep(0., .4, uT - aDist * .5);',
        // 2) a linha passa: d > 0 depois que ela passou pelo ponto
        '  float d = uVarre - aX;',
        '  float perto = exp(-d * d / .0012);',
        '  float passou = smoothstep(0., .05, d);',
        '  float fica = aLetra * passou;',
        '  float apaga = (1. - aLetra) * smoothstep(0., .18, d);',
        '  vAlfa = acende * (.2 * (1. - apaga) * (1. - fica) + fica) + perto * .9;',
        // as letras chegam douradas e esfriam na cor da tinta
        '  vOuro = max(perto, aLetra * passou * (1. - smoothstep(.05, .35, d)));',
        '  vec3 p = position;',
        '  p.y += perto * 1.6 * aLetra;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);',
        '  gl_PointSize = (1.05 + fica * .9 + perto * 1.1) * uDpr;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uTinta, uOuro; uniform float uSome;',
        'varying float vAlfa, vOuro;',
        'void main(){',
        '  float a = smoothstep(.5, .2, length(gl_PointCoord - .5));',
        '  gl_FragColor = vec4(mix(uTinta, uOuro, vOuro), a * vAlfa * uSome);',
        '}'
      ].join('\n')
    }));
    cena.add(pontos);

    // a linha dourada que varre (um fio vertical, mais forte no meio)
    var fio = new THREE.Mesh(new THREE.PlaneGeometry(1.4, alt), new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uOuro: uniformes.uOuro, uForca: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 uOuro; uniform float uForca; varying vec2 vUv; void main(){ float m = sin(vUv.y * 3.14159); gl_FragColor = vec4(uOuro, m * m * .85 * uForca); }'
    }));
    fio.position.y = -alt / 2;
    cena.add(fio);

    var FIM = T_VARRE + D_VARRE;
    var t0 = 0, rodando = false, quadro = 0;
    function desenhar(agora) {
      if (!t0) t0 = agora;
      var t = (agora - t0) / 1000;
      var v = (t - T_VARRE) / D_VARRE;                    // 0..1 durante a varrida
      var ve = v <= 0 ? 0 : v >= 1 ? 1 : 1 - Math.pow(1 - v, 2.2);
      uniformes.uT.value = t;
      uniformes.uVarre.value = v <= 0 ? -1 : -0.06 + ve * 1.18;
      fio.position.x = uniformes.uVarre.value * larg;
      fio.material.uniforms.uForca.value = v <= 0 || v >= 1 ? 0 : Math.sin(Math.min(v * 1.15, 1) * Math.PI);
      // a letra nítida entra por baixo enquanto os pontos somem
      var troca = Math.min(Math.max((t - FIM + 0.1) / 0.7, 0), 1);
      uniformes.uSome.value = 1 - troca;
      if (troca > 0 && raiz.classList.contains('pt-motion')) { clearTimeout(seguranca); revelar(); }
      renderer.render(cena, camera);
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
