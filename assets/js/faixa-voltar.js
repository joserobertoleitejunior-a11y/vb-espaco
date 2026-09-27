/* Faixa da plataforma no topo do site do estabelecimento: cubo + nome
   (volta pro início) e o toggle das áreas do negócio. É o único espaço
   nosso na página — o resto é do estabelecimento. Some ao descer o
   scroll e volta ao subir, pra nunca ficar no caminho do conteúdo. */
(function () {
  var el = document.getElementById('faixaVoltar');
  if (!el) return;
  var ultimoY = window.scrollY;
  window.addEventListener('scroll', function () {
    var atual = window.scrollY;
    var some = atual > ultimoY && atual > 60;
    el.classList.toggle('escondida', some);
    document.body.classList.toggle('faixa-sumiu', some); // topo da página sobe junto
    ultimoY = atual;
  }, { passive: true });
})();
