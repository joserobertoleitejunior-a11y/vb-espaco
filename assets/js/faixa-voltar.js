/* Faixa fina fixa no topo do site do estabelecimento (voltar pro VB
   Agenda) — some ao descer o scroll, volta ao subir, pra nunca ficar
   no caminho do conteúdo ou dos botões da página. */
(function () {
  var el = document.getElementById('faixaVoltar');
  if (!el) return;

  // sorteia uma textura por carregamento de página (tema visual da
  // faixa) — se o arquivo não existir ainda, o fundo escuro sólido de
  // sempre continua valendo, então isso é seguro adicionar antes das
  // imagens existirem. Recortadas de uma folha única gerada por IA.
  var TOTAL_TEMAS = 6;
  var tema = 1 + Math.floor(Math.random() * TOTAL_TEMAS);
  var img = new Image();
  img.onload = function () {
    el.style.backgroundImage = 'linear-gradient(rgba(20,20,24,0.55), rgba(20,20,24,0.55)), url("/assets/img/faixa/faixa-' + tema + '.png")';
    el.classList.add('com-textura');
  };
  img.src = '/assets/img/faixa/faixa-' + tema + '.png';

  el.classList.add('faixa-entrando');
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { el.classList.add('faixa-entrou'); });
  });

  var ultimoY = window.scrollY;
  window.addEventListener('scroll', function () {
    var atual = window.scrollY;
    if (atual > ultimoY && atual > 40) {
      el.classList.add('escondida');
    } else {
      el.classList.remove('escondida');
    }
    ultimoY = atual;
  }, { passive: true });
})();
