/* Caixas de diálogo 100% nossas (prompt/confirm/alert) — nunca a caixinha
   nativa do navegador/Android, que mostra a URL do site e quebra
   completamente a identidade visual do app. Cada função devolve uma
   Promise (o nativo é síncrono, o nosso overlay não pode ser). */
(function () {
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function criarOverlay(conteudoHtml) {
    var overlay = document.createElement('div');
    overlay.className = 'vb-dialogo-overlay';
    overlay.innerHTML = '<div class="vb-dialogo-box">' + conteudoHtml + '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function prompt(mensagem, valorAtual) {
    return new Promise(function (resolve) {
      var overlay = criarOverlay(
        '<p class="vb-dialogo-msg">' + escapeHtml(mensagem) + '</p>' +
        '<input type="text" class="vb-dialogo-input" id="vbDialogoInput">' +
        '<div class="vb-dialogo-acoes">' +
        '<button type="button" class="btn btn-ghost" id="vbDialogoCancelar">Cancelar</button>' +
        '<button type="button" class="btn btn-primario" id="vbDialogoOk">OK</button>' +
        '</div>'
      );
      var input = overlay.querySelector('#vbDialogoInput');
      input.value = valorAtual || '';
      setTimeout(function () { input.focus(); input.select(); }, 30);
      function concluir(valor) { overlay.remove(); resolve(valor); }
      overlay.querySelector('#vbDialogoOk').addEventListener('click', function () { concluir(input.value); });
      overlay.querySelector('#vbDialogoCancelar').addEventListener('click', function () { concluir(null); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') concluir(input.value);
        if (e.key === 'Escape') concluir(null);
      });
    });
  }

  function confirmar(mensagem) {
    return new Promise(function (resolve) {
      var overlay = criarOverlay(
        '<p class="vb-dialogo-msg">' + escapeHtml(mensagem) + '</p>' +
        '<div class="vb-dialogo-acoes">' +
        '<button type="button" class="btn btn-ghost" id="vbDialogoCancelar">Cancelar</button>' +
        '<button type="button" class="btn btn-primario" id="vbDialogoOk">Confirmar</button>' +
        '</div>'
      );
      function concluir(valor) { overlay.remove(); resolve(valor); }
      overlay.querySelector('#vbDialogoOk').addEventListener('click', function () { concluir(true); });
      overlay.querySelector('#vbDialogoCancelar').addEventListener('click', function () { concluir(false); });
    });
  }

  function avisar(mensagem) {
    return new Promise(function (resolve) {
      var overlay = criarOverlay(
        '<p class="vb-dialogo-msg">' + escapeHtml(mensagem) + '</p>' +
        '<div class="vb-dialogo-acoes">' +
        '<button type="button" class="btn btn-primario" id="vbDialogoOk">OK</button>' +
        '</div>'
      );
      overlay.querySelector('#vbDialogoOk').addEventListener('click', function () { overlay.remove(); resolve(); });
    });
  }

  window.VBDialogo = { prompt: prompt, confirm: confirmar, alert: avisar };
})();
