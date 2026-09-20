/* Identidade do cliente na VB Agenda — guardada uma única vez por
   telefone (não por estabelecimento), pra a mesma pessoa ser reconhecida
   em qualquer site da plataforma. Como todos os estabelecimentos vivem
   na mesma origem (vb-espaco...workers.dev/:slug/:cidade), um único
   localStorage global já basta — sem precisar de cookie entre domínios. */
(function () {
  var CHAVE = 'vbClienteGlobal';

  function normalizarTelefone(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function obter() {
    try {
      var bruto = localStorage.getItem(CHAVE);
      if (!bruto) return null;
      var dados = JSON.parse(bruto);
      if (!dados || !dados.telefone || !dados.nome) return null;
      return dados;
    } catch (e) {
      return null;
    }
  }

  function salvar(telefone, nome) {
    try { localStorage.setItem(CHAVE, JSON.stringify({ telefone: telefone, nome: nome })); } catch (e) {}
  }

  function limpar() {
    try { localStorage.removeItem(CHAVE); } catch (e) {}
  }

  window.VBClienteGlobal = {
    normalizarTelefone: normalizarTelefone,
    obter: obter,
    salvar: salvar,
    limpar: limpar
  };
})();
