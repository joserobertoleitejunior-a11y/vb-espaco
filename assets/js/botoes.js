/* Campo de arquivo desenhado: troca o "Escolher arquivo / Nenhum arquivo"
   do navegador por um botão com ícone e o nome da foto escolhida. Vale pra
   todo <input type="file"> solto na página (os que já estão dentro de um
   label próprio ou escondidos ficam como estão). Estilo em botoes.css. */
(function () {
  'use strict';
  var ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>';

  function rotulo(input) {
    if (input.getAttribute('data-rotulo')) return input.getAttribute('data-rotulo');
    var foto = /image/.test(input.accept || '');
    if (input.multiple) return foto ? 'Escolher fotos' : 'Escolher arquivos';
    return foto ? 'Escolher foto' : 'Escolher arquivo';
  }

  function vestir(input) {
    if (input.__vestido || input.closest('label') || input.style.display === 'none' || input.hidden) return;
    input.__vestido = true;
    var caixa = document.createElement('label');
    caixa.className = 'arquivo-btn';
    if (input.style.flex) caixa.style.flex = input.style.flex;
    input.parentNode.insertBefore(caixa, input);
    caixa.innerHTML = '<span class="arquivo-btn-icone">' + ICONE + '</span><span class="arquivo-btn-texto"></span><span class="arquivo-btn-nome"></span>';
    caixa.querySelector('.arquivo-btn-texto').textContent = rotulo(input);
    caixa.appendChild(input);
    var nome = caixa.querySelector('.arquivo-btn-nome');
    function mostrar() {
      var n = input.files ? input.files.length : 0;
      nome.textContent = n > 1 ? n + ' fotos' : n === 1 ? input.files[0].name : '';
      caixa.classList.toggle('tem', n > 0);
    }
    input.addEventListener('change', mostrar);
    // formulário limpo por código (form.reset) volta ao estado vazio
    if (input.form) input.form.addEventListener('reset', function () { setTimeout(mostrar, 0); });
  }

  function varrer(raiz) {
    (raiz.querySelectorAll ? raiz : document).querySelectorAll('input[type="file"]').forEach(vestir);
  }

  function iniciar() {
    varrer(document);
    new MutationObserver(function (lista) {
      lista.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches('input[type="file"]')) vestir(n); else varrer(n);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
