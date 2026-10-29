/* Fotos que o CLIENTE manda junto com um pedido de orçamento, um chamado
   ou a ideia da tatuagem — o profissional já vê o problema (ou a
   referência) e responde com um valor mais certo.

   Cada foto é diminuída no próprio celular (no máximo 1600 px, JPEG) antes
   de subir: fica leve pra rede ruim e perde os dados escondidos da câmera
   (inclusive a localização de onde foi tirada). Sobe pro bucket público
   "cliente-anexos", na pasta do estabelecimento, e vira um link que vai no
   pedido e na mensagem do WhatsApp.

   Uso (a lista é o estado: sobrevive a redesenhar a tela):
     html = VBAnexoFotos.bloco(lista, { titulo, ajuda })
     VBAnexoFotos.ligar(raiz, lista, estabId, aoMudar)
     await VBAnexoFotos.esperar(lista)   // antes de enviar
     VBAnexoFotos.urls(lista)            // links prontos */
(function (global) {
  'use strict';
  var MAX = 3;
  var LADO = 1600;
  var BUCKET = 'cliente-anexos';

  var ICONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // redesenha a foto num canvas: tamanho menor e sem EXIF (GPS da câmera)
  function comprimir(arquivo) {
    return new Promise(function (ok, falha) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () {
        var fator = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * fator);
        c.height = Math.round(img.naturalHeight * fator);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : falha(new Error('Não deu pra ler essa foto.')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('Esse arquivo não parece uma foto.')); };
      img.src = url;
    });
  }

  function enviar(blob, estabId) {
    if (!global.db || !global.db.storage) return Promise.reject(new Error('Sem conexão agora.'));
    var caminho = estabId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.jpg';
    var balde = global.db.storage.from(BUCKET);
    return balde.upload(caminho, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }).then(function (res) {
      if (res.error) throw res.error;
      return balde.getPublicUrl(caminho).data.publicUrl;
    });
  }

  function bloco(lista, opts) {
    opts = opts || {};
    var cheio = lista.length >= MAX;
    return '<div class="anexo-fotos" data-anexo-fotos>' +
      (opts.titulo ? '<p class="anexo-titulo">' + esc(opts.titulo) + '</p>' : '') +
      (opts.ajuda ? '<p class="anexo-ajuda">' + esc(opts.ajuda) + '</p>' : '') +
      '<div class="anexo-linha">' +
      lista.map(function (f, i) {
        return '<div class="anexo-foto' + (f.status === 'enviando' ? ' enviando' : f.status === 'erro' ? ' erro' : '') + '">' +
          '<img src="' + esc(f.previa || f.url) + '" alt="Foto ' + (i + 1) + '">' +
          (f.status === 'enviando' ? '<span class="anexo-spin" aria-label="Enviando"></span>' : '') +
          (f.status === 'erro' ? '<span class="anexo-erro-txt">não foi</span>' : '') +
          '<button type="button" class="anexo-tirar" data-anexo-tirar="' + i + '" aria-label="Tirar foto ' + (i + 1) + '">×</button></div>';
      }).join('') +
      (cheio ? '' : '<label class="anexo-botao">' + ICONE + '<span>' + (lista.length ? 'Mais uma' : 'Enviar foto') + '</span>' +
        '<input type="file" accept="image/*" multiple data-anexo-input></label>') +
      '</div></div>';
  }

  function ligar(raiz, lista, estabId, aoMudar) {
    if (!raiz) return;
    var input = raiz.querySelector('[data-anexo-input]');
    if (input) input.addEventListener('change', function () {
      var arquivos = Array.prototype.slice.call(input.files || []).slice(0, MAX - lista.length);
      arquivos.forEach(function (arq) {
        var item = { previa: URL.createObjectURL(arq), status: 'enviando', url: null };
        lista.push(item);
        item.promessa = comprimir(arq).then(function (b) { return enviar(b, estabId); }).then(function (url) {
          item.url = url; item.status = 'ok';
        }, function () { item.status = 'erro'; }).then(function () { aoMudar && aoMudar(); });
      });
      if (arquivos.length && aoMudar) aoMudar();
    });
    raiz.querySelectorAll('[data-anexo-tirar]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-anexo-tirar'));
        var tirada = lista.splice(i, 1)[0];
        if (tirada && tirada.previa) { try { URL.revokeObjectURL(tirada.previa); } catch (e) {} }
        if (aoMudar) aoMudar();
      });
    });
  }

  function esperar(lista) {
    return Promise.all(lista.map(function (f) { return f.promessa || Promise.resolve(); }));
  }
  function urls(lista) {
    return lista.filter(function (f) { return f.status === 'ok' && f.url; }).map(function (f) { return f.url; });
  }
  function enviando(lista) { return lista.some(function (f) { return f.status === 'enviando'; }); }

  global.VBAnexoFotos = { bloco: bloco, ligar: ligar, esperar: esperar, urls: urls, enviando: enviando, MAX: MAX };
})(window);
