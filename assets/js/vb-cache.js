/* Cache local (localStorage) de listas já carregadas — pra quem ficar
   sem internet ainda ver o que já tinha aberto antes (tipo o feed do
   Facebook), em vez de uma tela vazia ou um erro. Só guarda o que já
   veio do servidor com sucesso; nunca inventa dado, e nunca é usado
   pra decidir nada sensível (preço, agenda, saldo) — só pra manter a
   tela com conteúdo enquanto a rede não volta. */
(function () {
  var PREFIXO = 'vbCache:';

  function salvar(chave, dados) {
    try {
      localStorage.setItem(PREFIXO + chave, JSON.stringify({ dados: dados, quando: Date.now() }));
    } catch (e) { /* localStorage cheio/bloqueado — segue sem cache */ }
  }

  function carregar(chave) {
    try {
      var bruto = localStorage.getItem(PREFIXO + chave);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      return null;
    }
  }

  window.VBCache = { salvar: salvar, carregar: carregar };
})();
