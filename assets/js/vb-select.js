/* Select customizado — troca o <select> nativo (que renderiza cru,
   diferente em cada navegador/sistema) por um botão + lista estilizados
   iguais ao resto do app, sem precisar reescrever a lógica de quem já
   lê/escuta esse <select>: ele continua no DOM (só escondido), com o
   mesmo id, mesmo .value e disparando 'change' normalmente — só a
   aparência muda. */
(function () {
  function fecharTodos(excetoEl) {
    document.querySelectorAll('.vb-select.is-aberto').forEach(function (el) {
      if (el !== excetoEl) el.classList.remove('is-aberto');
    });
  }

  function enhance(select) {
    if (!select || select.dataset.vbSelectPronto) return;
    select.dataset.vbSelectPronto = '1';

    var wrap = document.createElement('div');
    wrap.className = 'vb-select';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('vb-select-nativo');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vb-select-btn';
    btn.innerHTML = '<span class="vb-select-valor"></span>' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
    if (select.disabled) btn.disabled = true;

    var lista = document.createElement('div');
    lista.className = 'vb-select-lista';
    lista.setAttribute('role', 'listbox');

    function opcoes() { return Array.prototype.slice.call(select.options); }

    function renderLista() {
      lista.innerHTML = '';
      opcoes().forEach(function (opt) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'vb-select-opcao' + (opt.value === select.value ? ' is-selecionada' : '');
        item.setAttribute('role', 'option');
        item.textContent = opt.textContent;
        item.addEventListener('click', function () {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          atualizarLabel();
          fechar();
        });
        lista.appendChild(item);
      });
    }

    function atualizarLabel() {
      var atual = select.options[select.selectedIndex];
      btn.querySelector('.vb-select-valor').textContent = atual ? atual.textContent : '';
      lista.querySelectorAll('.vb-select-opcao').forEach(function (item, i) {
        item.classList.toggle('is-selecionada', opcoes()[i] && opcoes()[i].value === select.value);
      });
    }

    function abrir() {
      renderLista();
      fecharTodos(wrap);
      wrap.classList.add('is-aberto');
    }
    function fechar() { wrap.classList.remove('is-aberto'); }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (btn.disabled) return;
      if (wrap.classList.contains('is-aberto')) fechar(); else abrir();
    });

    // o resto do app (ex: trocar o preço ao escolher um serviço no
    // Caixa) já escuta 'change' no <select> original — reagir aqui
    // também garante que uma mudança feita por código (select.value=x)
    // sem passar pela nossa lista também atualiza o rótulo visível.
    select.addEventListener('change', atualizarLabel);

    // MutationObserver: se as <option> forem substituídas depois (o app
    // sempre re-renderiza a caixa toda, então isso é só um reforço),
    // mantém rótulo e lista em dia.
    new MutationObserver(atualizarLabel).observe(select, { childList: true, subtree: true });

    wrap.appendChild(btn);
    wrap.appendChild(lista);
    atualizarLabel();
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.vb-select')) fecharTodos(null);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') fecharTodos(null);
  });

  window.VBSelect = {
    enhance: enhance,
    enhanceTodos: function (container) {
      (container || document).querySelectorAll('select').forEach(enhance);
    }
  };
})();
