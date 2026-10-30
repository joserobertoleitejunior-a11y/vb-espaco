/* Foto de perfil do cliente, estilo Facebook: redondinha, sempre ao lado do nome.
   Sem foto, aparece a inicial do nome numa cor própria dele.

   VBAvatar.html(nome, telefone, tam)  → <span> pronto pra por antes do nome (tam: 'p' | 'm' | 'g')
   VBAvatar.hidratar(estabId, raiz)    → (painel do dono) busca as fotos dos telefones que estão na tela
   VBAvatar.pintar(el, foto)           → põe a foto num avatar já desenhado
   VBAvatar.reduzir(arquivo)           → Promise<dataURL> (quadrada, 256px, JPEG leve) */
(function (global) {
  'use strict';
  var CORES = ['#0f6b5c', '#c4553a', '#2f5d7c', '#8a5a9e', '#b8860b', '#3d7a3a', '#a63d5c', '#4a5568'];
  var cache = {}; // telefone (só dígitos) -> foto | null

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function digitos(t) { return String(t || '').replace(/\D/g, ''); }
  function iniciais(nome) {
    var p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }
  function cor(nome) { var h = 0, s = String(nome || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return CORES[h % CORES.length]; }

  function html(nome, telefone, tam, foto) {
    var t = digitos(telefone);
    var f = foto || (t && cache[t]) || '';
    return '<span class="vb-av vb-av-' + (tam || 'm') + '" style="--av:' + cor(nome) + '"' + (t ? ' data-av-tel="' + t + '"' : '') + ' aria-hidden="true">' +
      (f ? '<img src="' + esc(f) + '" alt="" decoding="async">' : '<b>' + esc(iniciais(nome)) + '</b>') + '</span>';
  }
  function pintar(el, foto) {
    if (!el || !foto || el.querySelector('img')) return;
    var img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; img.src = foto;
    el.appendChild(img);
  }
  function aplicar(raiz) {
    (raiz || document).querySelectorAll('[data-av-tel]').forEach(function (el) {
      var f = cache[el.getAttribute('data-av-tel')];
      if (f) pintar(el, f);
    });
  }

  // painel do dono: pede de uma vez só as fotos dos telefones que aparecem na tela
  function hidratar(estabId, raiz) {
    raiz = raiz || document;
    var faltam = {};
    raiz.querySelectorAll('[data-av-tel]').forEach(function (el) {
      var t = el.getAttribute('data-av-tel');
      if (t && !(t in cache)) faltam[t] = 1;
    });
    var lista = Object.keys(faltam);
    if (!lista.length || !global.db) { aplicar(raiz); return Promise.resolve(); }
    return global.db.rpc('tenant_admin_fotos_clientes', { p_estabelecimento_id: estabId, p_telefones: lista }).then(function (r) {
      lista.forEach(function (t) { cache[t] = null; });
      ((r && r.data) || []).forEach(function (x) { cache[digitos(x.telefone)] = x.foto; });
      aplicar(raiz);
    }, function () { aplicar(raiz); });
  }

  // recorta no centro, 256x256, JPEG ~15-30 KB
  function reduzir(arquivo) {
    return new Promise(function (ok, erro) {
      var url = URL.createObjectURL(arquivo), img = new Image();
      img.onload = function () {
        var lado = Math.min(img.width, img.height), c = document.createElement('canvas');
        c.width = c.height = 256;
        c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
        URL.revokeObjectURL(url);
        var d = c.toDataURL('image/jpeg', 0.82);
        if (d.length > 80000) d = c.toDataURL('image/jpeg', 0.6);
        ok(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); erro(new Error('Não consegui abrir essa foto.')); };
      img.src = url;
    });
  }

  global.VBAvatar = { html: html, hidratar: hidratar, pintar: pintar, reduzir: reduzir, aplicar: aplicar, iniciais: iniciais, cor: cor, guardar: function (tel, foto) { cache[digitos(tel)] = foto || null; } };
})(window);
