/* Dono do estabelecimento já logado (conta Supabase, não o login de
   cliente por WhatsApp) navegando pelo catálogo/página de vendas? Troca
   os convites de "vira cliente da plataforma" por um caminho direto pro
   próprio painel — pedir pra ele se cadastrar de novo não faz sentido. */
(function () {
  if (!window.db) return;
  db.auth.getSession().then(function (res) {
    var logado = !!(res && res.data && res.data.session);
    if (!logado) return;
    var criarBtn = document.getElementById('tabbarCriarSite');
    if (criarBtn) criarBtn.remove();
    var cadastrarBtn = document.getElementById('tabbarCadastrar');
    var texto = document.getElementById('tabbarCadastrarTexto');
    if (cadastrarBtn) cadastrarBtn.href = 'cadastro.html';
    if (texto) texto.textContent = 'Minha conta';
  });
})();
