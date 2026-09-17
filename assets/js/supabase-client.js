/* Cliente Supabase compartilhado — chave pública (anon), protegida pelo
   RLS + funções RPC no banco. Diferente do Rafael Cabeleireiros: aqui a
   sessão do dono FICA salva (persistSession: true), porque o login é de
   verdade (e-mail/senha ou Google), não um token avulso por link. */
(function (global) {
  var SUPABASE_URL = 'https://oeracgvnuomcaydmizzj.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_KB-UG2jA0BS6o61VoFwZKA_ZpYm-LQp';

  if (typeof global.supabase === 'undefined' || !global.supabase.createClient) {
    console.error('Supabase JS não carregou (CDN bloqueado ou offline).');
    global.db = null;
    return;
  }

  global.db = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
})(window);
