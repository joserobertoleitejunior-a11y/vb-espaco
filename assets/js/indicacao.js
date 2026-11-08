/* Indicação de criadores: guarda o código do link (?ref=abc1234) por 60 dias, em qualquer página.
   Quando a pessoa cria o negócio (criar.js), o código é enviado ao banco e o criador passa a
   ganhar a comissão mensal desse negócio. */
(function (global) {
  var CHAVE = 'vbRef', DIAS = 60;
  function ler() {
    try { var o = JSON.parse(localStorage.getItem(CHAVE) || 'null'); if (o && o.c && o.ate > Date.now()) return o.c; } catch (e) {}
    return null;
  }
  try {
    var m = /[?&]ref=([a-zA-Z0-9]{4,12})(?:&|$)/.exec(location.search);
    if (m) localStorage.setItem(CHAVE, JSON.stringify({ c: m[1].toLowerCase(), ate: Date.now() + DIAS * 864e5 }));
  } catch (e) {}
  global.VBIndicacao = {
    codigo: ler,
    // chamado depois de criar o negócio; esquece o código só quando o banco respondeu
    enviar: function (db, estabId) {
      var c = ler();
      if (!c || !db || !estabId) return Promise.resolve(false);
      return db.rpc('indicacao_registrar', { p_estabelecimento_id: estabId, p_codigo: c }).then(function (r) {
        if (!r.error) { try { localStorage.removeItem(CHAVE); } catch (e) {} }
        return !r.error && r.data === true;
      }, function () { return false; });
    }
  };
})(window);
