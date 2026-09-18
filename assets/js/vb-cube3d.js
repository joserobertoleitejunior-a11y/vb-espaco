/* Logo 3D do VB Agenda — selo pequeno ao lado do nome: só as arestas
   douradas (sem preenchimento, 100% transparente por dentro), câmera
   ortográfica pra nunca "perder ponta" do cubo em nenhum ângulo (numa
   câmera comum de perspectiva, o vértice mais próximo cresce e pode
   sair do quadro ao girar — ortográfica não tem esse problema).
   Gira sozinho bem devagar e responde a arrastar o dedo/mouse, mas
   sem parecer um botão: sem cursor de link, sem destaque ao tocar —
   só o logotipo se mexendo. Depois do primeiro quadro renderizado,
   usa o próprio cubo como favicon da aba. Carregado via import()
   dinâmico: se o CDN falhar, o elemento some sozinho e o site segue
   normal. */
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

    // câmera ortográfica: frustum bem maior que o "raio" do cubo
    // (metade da diagonal, s*sqrt(3)/2) garante que nenhum vértice
    // saia do quadro, em qualquer rotação.
    var frustum = 2.6;
    var aspecto = largura / altura;
    var camera = new THREE.OrthographicCamera(
      -frustum * aspecto / 2, frustum * aspecto / 2,
      frustum / 2, -frustum / 2,
      0.1, 20
    );
    camera.position.z = 5;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(largura, altura);
    renderer.setClearColor(0x000000, 0);

    var geometria = new THREE.BoxGeometry(1.15, 1.15, 1.15);
    var arestas = new THREE.EdgesGeometry(geometria);
    var cubo = new THREE.LineSegments(arestas, new THREE.LineBasicMaterial({ color: 0xC9A227 }));
    scene.add(cubo);

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
      var a = w / h;
      camera.left = -frustum * a / 2;
      camera.right = frustum * a / 2;
      camera.top = frustum / 2;
      camera.bottom = -frustum / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    var faviconGerado = false;
    function atualizarFavicon() {
      if (faviconGerado) return;
      faviconGerado = true;
      try {
        var dataUrl = renderer.domElement.toDataURL('image/png');
        ['icon', 'apple-touch-icon'].forEach(function (rel) {
          var link = document.querySelector('link[rel="' + rel + '"]');
          if (link) { link.type = 'image/png'; link.href = dataUrl; }
        });
      } catch (e) { /* canvas tainted ou navegador sem suporte — mantém o favicon padrão */ }
    }

    function animar() {
      requestAnimationFrame(animar);
      if (!arrastando && !reduzMovimento) {
        cubo.rotation.y += velY;
        cubo.rotation.x += velX;
      }
      renderer.render(scene, camera);
      if (!faviconGerado) atualizarFavicon();
    }
    animar();
  }
})();
