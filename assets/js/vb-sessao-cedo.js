/* Roda no <head>, antes de pintar: este aparelho já tem a sessão do dono
   salva? Então a tela de login nem aparece (html.vb-dono-sessao esconde o
   formulário e mostra o esqueleto do painel até o Supabase confirmar).
   E quem só tem Pedir/Chamar vai direto pro painel da área, sem passar
   pelo cadastro.html primeiro (vbPainelDono, gravado pelos painéis). */
(function () {
  var temSessao = false;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (/^sb-.+-auth-token$/.test(k) && /"access_token"/.test(localStorage.getItem(k) || '')) { temSessao = true; break; }
    }
  } catch (e) {}
  if (!temSessao) return;
  var raiz = document.documentElement;
  raiz.classList.add('vb-dono-sessao');
  // cadastro.html "puro" (sem ?abrir, ?depois, ?excluir…) de quem usa o painel da área
  if (/\/cadastro\.html$/.test(location.pathname) && !location.search && !location.hash) {
    var destino = null;
    try { destino = localStorage.getItem('vbPainelDono'); } catch (e) {}
    if (destino && /^\/painel-area\.html\?id=[\w-]+$/.test(destino)) location.replace(destino);
  }
})();
