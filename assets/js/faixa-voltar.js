/* Faixa fina fixa no topo do site do estabelecimento (voltar pro VB
   Agenda) — some ao descer o scroll, volta ao subir, pra nunca ficar
   no caminho do conteúdo ou dos botões da página. */
(function () {
  var el = document.getElementById('faixaVoltar');
  if (!el) return;
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
