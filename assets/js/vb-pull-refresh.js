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

  var ALTURA_MAX = 84;
  var ALTURA_CARREGANDO = 62;
  var LIMIAR = 62;
  var RESISTENCIA = 0.5;
  var ESTICAR_MAX = 2.0; // quanto o cubo alonga no eixo vertical, no pico do puxão

  var cuboApi = null;

  import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js')
    .then(iniciarCubo)
    .catch(function () { /* sem three.js: o gesto de puxar/recarregar ainda funciona, só sem o cubo */ });

  function iniciarCubo(THREE) {
    var tam = 46;
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
    // uma segunda cópia, um pouco maior e mais fraca, exatamente por
    // cima — sozinha, uma linha de 1px girando muito rápido "some" na
    // tela de muito celular (o WebGL não desenha linha grossa de
    // verdade); com esse reforço o cubo continua visível mesmo girando
    // no talo.
    var reforco = new THREE.LineSegments(arestas, new THREE.LineBasicMaterial({ color: 0xC9A227, transparent: true, opacity: 0.55 }));
    reforco.scale.set(1.12, 1.12, 1.12);
    cubo.add(reforco);

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
        // elástico de verdade: alonga bastante no eixo vertical e afina
        // um pouco nos outros dois — igual uma borracha sendo puxada.
        var escalaY = 1 + progresso * ESTICAR_MAX;
        cubo.scale.y = escalaY;
        cubo.scale.x = 1 - progresso * 0.22;
        cubo.scale.z = 1 - progresso * 0.22;
        // aumenta a "janela" vertical da câmera na mesma proporção do
        // esticão (com folga de sobra), pra nenhuma linha sair cortada
        // durante o alongamento — no repouso (escalaY=1) fica idêntico
        // ao frustum original, sem pulo nenhum de tamanho.
        var fatorJanela = 1 + Math.max(0, escalaY - 1) * 0.8;
        var metadeV = (frustumBase / 2) * fatorJanela;
        camera.top = metadeV;
        camera.bottom = -metadeV;
        camera.updateProjectionMatrix();
      },
      girarRapido: function () {
        girando = true;
        velocidade = 0.48;
      },
      resetar: function () {
        cubo.scale.set(1, 1, 1);
        camera.top = frustumBase / 2;
        camera.bottom = -frustumBase / 2;
        camera.updateProjectionMatrix();
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
    if (puxadoPx >= LIMIAR && !carregando) {
      carregando = true;
      // trava na altura de carregando NA HORA, sem transição — se
      // deixar animar (encolher) enquanto o cubo já está girando rápido,
      // o cubo parece "fugir" do lugar durante o giro em vez de ficar
      // parado exatamente onde puxamos ele.
      zona.classList.add('sem-transicao');
      zona.style.height = ALTURA_CARREGANDO + 'px';
      if (cuboApi) {
        cuboApi.resetar();
        cuboApi.girarRapido();
      }
      setTimeout(function () { window.location.reload(); }, 900);
    } else {
      zona.classList.remove('sem-transicao');
      zona.style.height = '0px';
      if (cuboApi) cuboApi.resetar();
    }
    puxadoPx = 0;
  }

  document.addEventListener('touchend', finalizarArrasto);
  document.addEventListener('touchcancel', finalizarArrasto);
})();
