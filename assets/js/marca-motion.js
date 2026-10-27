/* Motion do nome na splash (three.js): o "Passo a passo" nasce de uma
   nuvem de pontos — cada ponto sai espalhado em volta da pastilha de
   vidro, viaja em curva e pousa no pixel exato da letra, da esquerda pra
   direita (como código sendo escrito). Os pontos chegam dourados e
   esfriam na cor da letra; quando todos pousaram, a letra de verdade
   (nítida, do DOM) aparece por baixo e a nuvem some, deixando só um
   cursor de código piscando. Tocar no nome desfaz e refaz.

   Só roda no logotipo grande ([data-vibe-marca-logo="hero"]); os pequenos
   ficam no CSS. Depois que pousa, o laço de desenho para — não gasta
   bateria parado. Sem WebGL, sem three.js (CDN fora) ou com "reduzir
   movimento", fica o aparecer devagar do CSS de sempre. */
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
    setTimeout(function () { iniciar(r[0]); }, 220);
  }).catch(revelar);

  var MARGEM_X = 70, MARGEM_Y = 46;   // a nuvem nasce além da pastilha

  // pixels de cada letra, desenhados no lugar exato em que o DOM pôs cada uma
  function amostrar(palavra, larg, alt) {
    var escala = 2;
    var c = document.createElement('canvas');
    c.width = larg * escala; c.height = alt * escala;
    var g = c.getContext('2d');
    g.scale(escala, escala);
    g.textBaseline = 'alphabetic';
    var caixa = el.getBoundingClientRect();
    var ox = caixa.left - MARGEM_X, oy = caixa.top - MARGEM_Y;
    var andar = document.createTreeWalker(palavra, NodeFilter.SHOW_TEXT);
    var no, faixa = document.createRange();
    while ((no = andar.nextNode())) {
      var est = getComputedStyle(no.parentNode);
      g.font = est.fontWeight + ' ' + est.fontSize + ' ' + est.fontFamily;
      g.globalAlpha = parseFloat(est.opacity) || 1;
      var linhaBase = parseFloat(est.fontSize) * 0.8;
      for (var i = 0; i < no.length; i++) {
        var ch = no.data[i];
        if (!ch.trim()) continue;
        faixa.setStart(no, i); faixa.setEnd(no, i + 1);
        var r = faixa.getBoundingClientRect();
        var meio = r.top + r.height / 2;
        g.fillText(ch, r.left - ox, meio - oy + linhaBase * 0.36);
      }
    }
    var px = g.getImageData(0, 0, c.width, c.height).data;
    var pontos = [];
    for (var y = 0; y < c.height; y += 2) {
      for (var x = 0; x < c.width; x += 2) {
        var a = px[(y * c.width + x) * 4 + 3];
        if (a > 90) pontos.push(x / escala, y / escala, a / 255);
      }
    }
    return pontos;
  }

  function iniciar(THREE) {
    var palavra = el.querySelector('.pt-word');
    if (!palavra) return revelar();
    var caixa = el.getBoundingClientRect();
    if (!caixa.width) return revelar();
    var larg = Math.ceil(caixa.width + MARGEM_X * 2), alt = Math.ceil(caixa.height + MARGEM_Y * 2);

    var pts = amostrar(palavra, larg, alt);
    var n = pts.length / 3;
    if (n < 50) return revelar();

    var canvas = document.createElement('canvas');
    canvas.className = 'pt-motion-tela';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'left:' + (-MARGEM_X) + 'px;top:' + (-MARGEM_Y) + 'px;width:' + larg + 'px;height:' + alt + 'px';
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
    var camera = new THREE.OrthographicCamera(0, larg, 0, -alt, -1000, 1000);
    var cena = new THREE.Scene();

    var alvo = new Float32Array(n * 3), inicio = new Float32Array(n * 3);
    var semente = new Float32Array(n), atraso = new Float32Array(n), forca = new Float32Array(n);
    var cx = larg / 2, cy = alt / 2;
    function espalhar() {
      for (var i = 0; i < n; i++) {
        var ang = Math.random() * Math.PI * 2;
        var raio = 0.55 + Math.random() * 0.6;
        inicio[i * 3] = cx + Math.cos(ang) * raio * larg * 0.55;
        inicio[i * 3 + 1] = -(cy + Math.sin(ang) * raio * alt * 0.6);
        inicio[i * 3 + 2] = (Math.random() - 0.5) * 400;
      }
    }
    for (var i = 0; i < n; i++) {
      alvo[i * 3] = pts[i * 3];
      alvo[i * 3 + 1] = -pts[i * 3 + 1];
      alvo[i * 3 + 2] = 0;
      semente[i] = Math.random() * 100;
      forca[i] = pts[i * 3 + 2];
      // da esquerda pra direita, com um pouco de acaso pra não virar fila
      atraso[i] = ((pts[i * 3] - MARGEM_X) / caixa.width) * 0.9 + Math.random() * 0.35;
    }
    espalhar();

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(alvo, 3));
    geo.setAttribute('aInicio', new THREE.BufferAttribute(inicio, 3));
    geo.setAttribute('aSemente', new THREE.BufferAttribute(semente, 1));
    geo.setAttribute('aAtraso', new THREE.BufferAttribute(atraso, 1));
    geo.setAttribute('aForca', new THREE.BufferAttribute(forca, 1));

    var tinta = new THREE.Color(getComputedStyle(el).color);
    var mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        uT: { value: 0 }, uSome: { value: 1 }, uDpr: { value: dpr },
        uTinta: { value: tinta }, uOuro: { value: new THREE.Color(0xC9A227) }
      },
      vertexShader: [
        'attribute vec3 aInicio; attribute float aSemente, aAtraso, aForca;',
        'uniform float uT, uDpr;',
        'varying float vP; varying float vForca; varying float vBrilho;',
        'float suave(float x){ return x < .5 ? 4.*x*x*x : 1. - pow(-2.*x + 2., 3.) / 2.; }',
        'void main(){',
        '  float p = clamp((uT - aAtraso) / 1.5, 0., 1.);',
        '  float e = suave(p);',
        '  vec3 pos = mix(aInicio, position, e);',
        // curva no caminho: um redemoinho que perde força ao chegar
        '  float giro = (1. - e);',
        '  pos.x += sin(aSemente + uT * 2.1) * 26. * giro;',
        '  pos.y += cos(aSemente * 1.3 + uT * 1.7) * 18. * giro;',
        '  vP = e; vForca = aForca;',
        '  vBrilho = step(.86, fract(aSemente * 7.31));',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos.xy, 0., 1.);',
        '  float perto = 1. + clamp(pos.z / 200., -.6, 1.) * giro;',
        '  gl_PointSize = (1.35 + vBrilho * .9 * giro) * perto * uDpr;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uTinta, uOuro; uniform float uSome;',
        'varying float vP; varying float vForca; varying float vBrilho;',
        'void main(){',
        '  vec2 d = gl_PointCoord - .5;',
        '  float a = smoothstep(.5, .15, length(d));',
        // chegam dourados, esfriam na cor da letra
        '  vec3 cor = mix(uOuro, uTinta, smoothstep(.55, 1., vP) * (1. - vBrilho * .5));',
        '  float alfa = a * mix(.6, 1., vP) * mix(1., vForca, vP) * uSome;',
        '  gl_FragColor = vec4(cor, alfa);',
        '}'
      ].join('\n')
    });
    cena.add(new THREE.Points(geo, mat));

    var DURACAO = 1.5 + 1.25;        // último ponto pousa
    var t0 = 0, rodando = false, quadro = 0;

    function desenhar(agora) {
      if (!t0) t0 = agora;
      var t = (agora - t0) / 1000;
      mat.uniforms.uT.value = t;
      // a letra nítida entra por baixo enquanto os pontos somem
      var troca = Math.min(Math.max((t - DURACAO + 0.15) / 0.6, 0), 1);
      mat.uniforms.uSome.value = 1 - troca;
      if (troca > 0 && raiz.classList.contains('pt-motion')) {
        clearTimeout(seguranca);
        revelar();
      }
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

    // tocar no nome: desfaz e refaz (com novo espalhar)
    el.addEventListener('click', function () {
      if (rodando) return;
      espalhar();
      geo.attributes.aInicio.needsUpdate = true;
      raiz.classList.remove('pt-motion-fim');
      raiz.classList.add('pt-motion');
      seguranca = setTimeout(revelar, 5000);
      tocar();
    });
  }
})();
