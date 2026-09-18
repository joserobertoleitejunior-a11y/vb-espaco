/* Logo 3D do VB Agenda — selo pequeno ao lado do nome, cubo de aresta
   fina dourada. Gira sozinho bem devagar mostrando todos os ângulos, e
   responde a arrastar o dedo/mouse — mas fica contido no próprio
   tamanho (30x30px), nunca cobre nem atrapalha o resto do app.
   Carregado via import() dinâmico: se o CDN falhar, o elemento some
   sozinho e o site segue normal. */
(function () {
  var container = document.getElementById('cube3d');
  if (!container || !window.requestAnimationFrame) return;

  var reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js')
    .then(iniciar)
    .catch(function () { container.remove(); });

  function iniciar(THREE) {
    var largura = container.clientWidth || 30;
    var altura = container.clientHeight || 30;

    var canvas = document.createElement('canvas');
    container.appendChild(canvas);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, largura / altura, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(largura, altura);
    renderer.setClearColor(0x000000, 0);

    var geometria = new THREE.BoxGeometry(2.6, 2.6, 2.6);
    var material = new THREE.MeshBasicMaterial({ color: 0x14120f, transparent: true, opacity: 0.18 });
    var cubo = new THREE.Mesh(geometria, material);
    scene.add(cubo);

    var arestas = new THREE.EdgesGeometry(geometria);
    var linhas = new THREE.LineSegments(arestas, new THREE.LineBasicMaterial({ color: 0xC9A227 }));
    cubo.add(linhas);

    cubo.rotation.x = 0.5;
    cubo.rotation.y = 0.7;

    var arrastando = false;
    var moveu = false;
    var ultimoX = 0, ultimoY = 0;
    var velX = 0.0016, velY = 0.0026;

    function aoPressionar(e) {
      arrastando = true;
      moveu = false;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      // segura o clique do link (o selo fica dentro de <a class="brand">)
      // só quando a pessoa de fato arrastar, não quando for só um toque/clique normal
      container.setPointerCapture && container.setPointerCapture(e.pointerId);
    }
    function aoMover(e) {
      if (!arrastando) return;
      var dx = e.clientX - ultimoX;
      var dy = e.clientY - ultimoY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moveu = true;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      cubo.rotation.y += dx * 0.012;
      cubo.rotation.x += dy * 0.012;
    }
    function aoSoltar(e) {
      arrastando = false;
      if (moveu) {
        // foi arrasto de verdade: evita que o clique navegue pro link do logo
        e.preventDefault();
        e.stopPropagation();
      }
    }

    container.addEventListener('pointerdown', aoPressionar);
    container.addEventListener('pointermove', aoMover);
    container.addEventListener('pointerup', aoSoltar);
    container.addEventListener('pointercancel', function () { arrastando = false; });

    window.addEventListener('resize', function () {
      var w = container.clientWidth || 30, h = container.clientHeight || 30;
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
