/* Puxar-pra-atualizar do nosso jeito: só ativa quando a página já está
   bem no topo do scroll. Puxando o dedo pra baixo, a área acima do
   cabeçalho abre e o cubo estica feito elástico (junto com o dedo).
   Soltando depois de passar o ponto de virada, a área trava numa
   altura de "carregando", o cubo gira o mais rápido possível e vai
   perdendo força — e a página recarrega de verdade logo em seguida.
   Solta antes do ponto de virada? a área fecha de novo, sem recarregar.
   Não é clicável de propósito: não tem nenhum listener de click/tap,
   só reage a arrastar o dedo (touch), igual ao cubo do topo que só
   gira ao arrastar e não parece um botão. */
(function () {
  var zona = document.getElementById('pullRefreshZona');
  var alvo = document.getElementById('pullRefreshCubo');
  if (!zona || !alvo || !window.requestAnimationFrame) return;
  if (!('ontouchstart' in window)) return; // gesto de puxar só faz sentido em touch

  var reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduzMovimento) return;

  var ALTURA_MAX = 76;
  var ALTURA_CARREGANDO = 58;
  var LIMIAR = 58;
  var RESISTENCIA = 0.5;

  var cuboApi = null;

  import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js')
    .then(iniciarCubo)
    .catch(function () { /* sem three.js: o gesto de puxar/recarregar ainda funciona, só sem o cubo */ });

  function iniciarCubo(THREE) {
    var tam = 40;
    var canvas = document.createElement('canvas');
    alvo.appendChild(canvas);

    var scene = new THREE.Scene();
    var frustum = 2.6;
    var camera = new THREE.OrthographicCamera(-frustum / 2, frustum / 2, frustum / 2, -frustum / 2, 0.1, 20);
    camera.position.z = 5;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(tam, tam);
    renderer.setClearColor(0x000000, 0);

    var geometria = new THREE.BoxGeometry(1.15, 1.15, 1.15);
    var arestas = new THREE.EdgesGeometry(geometria);
    var cubo = new THREE.LineSegments(arestas, new THREE.LineBasicMaterial({ color: 0xC9A227 }));
    cubo.rotation.x = 0.4;
    cubo.rotation.y = 0.5;
    scene.add(cubo);

    var girando = false;
    var velocidade = 0;

    function loop() {
      requestAnimationFrame(loop);
      if (girando) {
        cubo.rotation.y += velocidade;
        cubo.rotation.x += velocidade * 0.6;
        velocidade *= 0.94; // perdendo força aos poucos
        if (velocidade < 0.002) girando = false;
      }
      renderer.render(scene, camera);
    }
    loop();

    cuboApi = {
      esticar: function (progresso) {
        // "elástico": estica mais no eixo vertical do que no horizontal,
        // como se o cubo tivesse sido puxado pra baixo de verdade.
        cubo.scale.y = 1 + progresso * 0.9;
        cubo.scale.x = 1 + progresso * 0.15;
        cubo.scale.z = 1 + progresso * 0.15;
      },
      girarRapido: function () {
        girando = true;
        velocidade = 0.6;
      },
      resetar: function () {
        cubo.scale.set(1, 1, 1);
      }
    };
  }

  var arrastando = false;
  var carregando = false;
  var inicioY = 0;
  var puxadoPx = 0;

  function podeComecarArrasto() {
    return window.scrollY <= 0 && !carregando;
  }

  document.addEventListener('touchstart', function (e) {
    if (!podeComecarArrasto()) return;
    arrastando = true;
    inicioY = e.touches[0].clientY;
    zona.classList.add('sem-transicao');
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!arrastando) return;
    var dy = e.touches[0].clientY - inicioY;
    if (dy <= 0 || window.scrollY > 0) {
      // dedo voltou ou a pagina rolou de verdade nesse meio tempo: cancela
      puxadoPx = 0;
      zona.style.height = '0px';
      if (cuboApi) cuboApi.resetar();
      return;
    }
    e.preventDefault();
    puxadoPx = Math.min(ALTURA_MAX, dy * RESISTENCIA);
    zona.style.height = puxadoPx + 'px';
    if (cuboApi) cuboApi.esticar(puxadoPx / ALTURA_MAX);
  }, { passive: false });

  function finalizarArrasto() {
    if (!arrastando) return;
    arrastando = false;
    zona.classList.remove('sem-transicao');
    if (puxadoPx >= LIMIAR && !carregando) {
      carregando = true;
      zona.style.height = ALTURA_CARREGANDO + 'px';
      if (cuboApi) {
        cuboApi.resetar();
        cuboApi.girarRapido();
      }
      setTimeout(function () { window.location.reload(); }, 900);
    } else {
      zona.style.height = '0px';
      if (cuboApi) cuboApi.resetar();
    }
    puxadoPx = 0;
  }

  document.addEventListener('touchend', finalizarArrasto);
  document.addEventListener('touchcancel', finalizarArrasto);
})();
