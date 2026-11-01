/* Quem chegou por um anúncio (…/slug/cidade?an=<id>) fica marcado por 1 dia; quando agenda ou pede,
   o site avisa o banco, que confere e conta ("agendaram pelo anúncio" no painel do dono).
   VBAnuncioOrigem.converter('agendamento' | 'pedido', linhaCriada) */
(function (global) {
  'use strict';
  var CHAVE = 'vbAnuncioOrigem', DIA = 24 * 3600 * 1000;
  try {
    var an = new URLSearchParams(location.search).get('an');
    if (an && /^[0-9a-f-]{36}$/i.test(an)) localStorage.setItem(CHAVE, JSON.stringify({ id: an, t: Date.now() }));
  } catch (e) {}
  function lido() {
    try {
      var d = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      return d && d.id && Date.now() - d.t < DIA ? d : null;
    } catch (e) { return null; }
  }
  function converter(tipo, linha) {
    var d = lido(), r = Array.isArray(linha) ? linha[0] : linha;
    if (!d || !r || !r.id || !global.db) return;
    global.db.rpc('anuncio_converter', { p_id: d.id, p_tipo: tipo, p_ref: r.id }).then(function () {}, function () {});
  }
  global.VBAnuncioOrigem = { converter: converter };
})(window);
