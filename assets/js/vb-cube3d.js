/* Logo 3D do VB Agenda — cubo giratório em vidro preto/dourado, fino e
   transparente, fixo atrás do conteúdo (o site continua 100% legível
   por cima, cards/topbar/tabbar são opacos e cobrem ele normalmente).
   Gira sozinho devagar e responde a arrastar o dedo/mouse, igual o
   mecanismo do site da Vibe Coding Process — carregado via import()
   dinâmico: se o CDN falhar ou o navegador não suportar, o site
   continua funcionando normalmente, só sem o fundo decorativo. */
(function () {
  var container = document.getElementById('cube3d');
  if (!container || !window.requestAnimationFrame) return;

  var reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js')
    .then(iniciar)
    .catch(function () { container.remove(); });

  function texturaFace(linha1, linha2) {
    var tam = 512;
    var canvas = document.createElement('canvas');
    canvas.width = tam;
    canvas.height = tam;
    var ctx = canvas.getContext('2d');

    // painel de "vidro" bem sutil — quase transparente, só uma borda dourada fina
    ctx.fillStyle = 'rgba(10,9,8,0.16)';
    ctx.fillRect(0, 0, tam, tam);
    ctx.strokeStyle = 'rgba(201,162,39,0.85)';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, tam - 20, tam - 20);

    ctx.fillStyle = 'rgba(201,162,39,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (linha2) {
      ctx.font = '700 64px -apple-system, Arial, sans-serif';
      ctx.fillText(linha1, tam / 2, tam / 2 - 34);
      ctx.font = '600 34px -apple-system, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillText(linha2, tam / 2, tam / 2 + 34);
    } else {
      ctx.font = '700 72px -apple-system, Arial, sans-serif';
      ctx.fillText(linha1, tam / 2, tam / 2);
    }
    return canvas;
  }

  function iniciar(THREE) {
    var largura = container.clientWidth;
    var altura = container.clientHeight;

    var canvas = document.createElement('canvas');
    container.appendChild(canvas);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, largura / altura, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(largura, altura);
    renderer.setClearColor(0x000000, 0);

    var faces = [
      texturaFace('VB', 'AGENDA'),
      texturaFace('AGENDA', null),
      texturaFace('ITAPETININGA', 'SP'),
      texturaFace('SALÕES', null),
      texturaFace('BARBEARIAS', null),
      texturaFace('VB', 'AGENDA')
    ];
    var materiais = faces.map(function (canvasFace) {
      var tex = new THREE.CanvasTexture(canvasFace);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9 });
    });

    var tamanhoCubo = 3.4;
    var geometria = new THREE.BoxGeometry(tamanhoCubo, tamanhoCubo, tamanhoCubo);
    var cubo = new THREE.Mesh(geometria, materiais);
    scene.add(cubo);

    var arestas = new THREE.EdgesGeometry(geometria);
    var linhas = new THREE.LineSegments(arestas, new THREE.LineBasicMaterial({ color: 0xC9A227, transparent: true, opacity: 0.9 }));
    cubo.add(linhas);

    cubo.rotation.x = 0.5;
    cubo.rotation.y = 0.7;

    var arrastando = false;
    var ultimoX = 0, ultimoY = 0;
    var velX = 0.0022, velY = 0.0032;

    function aoPressionar(e) {
      arrastando = true;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
    }
    function aoMover(e) {
      if (!arrastando) return;
      var dx = e.clientX - ultimoX;
      var dy = e.clientY - ultimoY;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      cubo.rotation.y += dx * 0.008;
      cubo.rotation.x += dy * 0.008;
    }
    function aoSoltar() { arrastando = false; }

    container.style.touchAction = 'pan-y';
    container.addEventListener('pointerdown', aoPressionar);
    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoSoltar);
    window.addEventListener('pointercancel', aoSoltar);

    window.addEventListener('resize', function () {
      var w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    function animar() {
      requestAnimationFrame(animar);
      if (!arrastando && !reduzMovimento) {
        cubo.rotation.y += velY;
        cubo.rotation.x += velX;
      }
      renderer.render(scene, camera);
    }
    animar();
  }
})();
