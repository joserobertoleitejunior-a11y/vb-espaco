/* Cubo do hero, sempre visível, girando devagar sozinho (igual o do
   topo, só que maior e dentro do hero, acima do "VB Agenda" dourado).
   Puxar a página pra baixo (só quando já está no topo do scroll) estica
   as LINHAS do cubo feito elástico, sem mexer em mais nada do layout —
   nada de área branca aparecendo, nada de site "sumindo e voltando".
   Soltando depois de passar o ponto de virada, o cubo gira o mais
   rápido possível, perdendo força, e a página recarrega de verdade.
   Não é clicável de propósito: só reage a arrastar o dedo (touch). */
(function () {
  var alvo = document.getElementById('pullRefreshCubo');
  if (!alvo || !window.requestAnimationFrame) return;
  if (!('ontouchstart' in window)) return; // gesto de puxar só faz sentido em touch

  var reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var PUXAO_MAX_PX = 130; // quanto de dedo (em px) equivale ao esticão máximo
  var LIMIAR_PX = 96;
  var ESTICAR_MAX = 2.0;

  var cuboApi = null;

  import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js')
    .then(iniciarCubo)
    .catch(function () { /* sem three.js: o cubo simplesmente não aparece, o resto do site segue normal */ });

  function iniciarCubo(THREE) {
    var tam = 40;
    var canvas = document.createElement('canvas');
    alvo.appendChild(canvas);

    var scene = new THREE.Scene();
    // frustum vertical cresce junto com o esticão (recalculado em
    // esticar()) — sem isso, o cubo esticado passa da "janela" da câmera
    // ortográfica e as linhas de cima/baixo saem cortadas no meio do
    // esticão, em vez de esticar inteiras e suaves.
    var frustumBase = 2.6;
    var camera = new THREE.OrthographicCamera(-frustumBase / 2, frustumBase / 2, frustumBase / 2, -frustumBase / 2, 0.1, 20);
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
    // reforço: uma segunda cópia, um pouco maior e mais fraca, por cima
    // — uma linha de 1px girando muito rápido "some" em vários celulares
    // (o WebGL não desenha linha grossa de verdade nesses aparelhos).
    var reforco = new THREE.LineSegments(arestas, new THREE.LineBasicMaterial({ color: 0xC9A227, transparent: true, opacity: 0.55 }));
    reforco.scale.set(1.12, 1.12, 1.12);
    cubo.add(reforco);

    var velocidadeIdle = 0.0016;
    var girandoRapido = false;
    var velocidadeRapida = 0;

    function loop() {
      requestAnimationFrame(loop);
      if (girandoRapido) {
        cubo.rotation.y += velocidadeRapida;
        cubo.rotation.x += velocidadeRapida * 0.6;
        velocidadeRapida *= 0.94;
        if (velocidadeRapida < 0.002) girandoRapido = false;
      } else if (!reduzMovimento) {
        cubo.rotation.y += velocidadeIdle;
        cubo.rotation.x += velocidadeIdle * 0.6;
      }
      renderer.render(scene, camera);
    }
    loop();

    function ajustarJanela(escalaY) {
      var fatorJanela = 1 + Math.max(0, escalaY - 1) * 0.8;
      var metadeV = (frustumBase / 2) * fatorJanela;
      camera.top = metadeV;
      camera.bottom = -metadeV;
      camera.updateProjectionMatrix();
    }

    cuboApi = {
      esticar: function (progresso) {
        // elástico de verdade: alonga bastante no eixo vertical e afina
        // um pouco nos outros dois — igual uma borracha sendo puxada.
        // Só mexe no cubo (dentro do canvas dele) — nada do resto da
        // página muda de tamanho ou posição por causa disso.
        var escalaY = 1 + progresso * ESTICAR_MAX;
        cubo.scale.y = escalaY;
        cubo.scale.x = 1 - progresso * 0.22;
        cubo.scale.z = 1 - progresso * 0.22;
        ajustarJanela(escalaY);
      },
      girarRapido: function () {
        girandoRapido = true;
        velocidadeRapida = 0.48;
      },
      resetar: function () {
        cubo.scale.set(1, 1, 1);
        ajustarJanela(1);
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
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!arrastando) return;
    var dy = e.touches[0].clientY - inicioY;
    if (dy <= 0 || window.scrollY > 0) {
      // dedo voltou ou a pagina rolou de verdade nesse meio tempo: cancela
      puxadoPx = 0;
      if (cuboApi) cuboApi.resetar();
      return;
    }
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
