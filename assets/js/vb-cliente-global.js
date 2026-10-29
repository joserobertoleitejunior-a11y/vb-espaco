/* Identidade do cliente no Vibe — guardada uma única vez por
   telefone (não por estabelecimento), pra a mesma pessoa ser reconhecida
   em qualquer site da plataforma. Como todos os estabelecimentos vivem
   na mesma origem (vb-espaco...workers.dev/:slug/:cidade), um único
   localStorage global já basta — sem precisar de cookie entre domínios. */
(function () {
  // a identidade agora só vale com a sessão da senha de 6 números
  // (cliente-conta.js grava 'vbClienteConta' = { token, telefone, nome });
  // o antigo 'vbClienteGlobal' (só telefone) não abre mais nada
  var CHAVE = 'vbClienteConta';

  function normalizarTelefone(v) {
    return String(v || '').replace(/\D/g, '');
  }
  function ler() {
    try { var d = JSON.parse(localStorage.getItem(CHAVE) || 'null'); return d && d.token && d.telefone ? d : null; } catch (e) { return null; }
  }
  function obter() {
    var d = ler();
    return d ? { telefone: d.telefone, nome: d.nome } : null;
  }
  function token() { var d = ler(); return d ? d.token : null; }
  // só atualiza o nome mostrado da conta já aberta (não cria conta sem senha)
  function salvar(telefone, nome) {
    var d = ler();
    if (!d || normalizarTelefone(telefone) !== d.telefone) return;
    d.nome = nome;
    try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch (e) {}
  }
  function limpar() {
    if (window.VBConta) { window.VBConta.sair(); return; }
    try { localStorage.removeItem(CHAVE); localStorage.removeItem('vbClienteGlobal'); } catch (e) {}
  }

  window.VBClienteGlobal = {
    normalizarTelefone: normalizarTelefone,
    obter: obter,
    token: token,
    salvar: salvar,
    limpar: limpar
  };
})();
