/* Nome da plataforma num lugar só: "Matriz". Pra trocar, muda aqui (e
   nos <title>/meta das páginas).

   Três jeitos de marcar um elemento:
   - data-vibe-marca: recebe o nome como texto puro (menus, rodapés,
     legendas — qualquer menção ao nome que não seja o logotipo).
   - data-vibe-marca-logo: recebe o logotipo de verdade — a letra de
     código (JetBrains Mono) numa pastilha de vidro, com o pingo do "i"
     virando um losango dourado (o cubo visto de quina). Vazio ("") é a
     versão pequena; ="hero" é a grande da splash (que ainda ganha o
     motion de marca-motion.js).
   - o símbolo: a silhueta da torre da Igreja Matriz de Itapetininga, em
     preto, com o cubo que gira no lugar do relógio. Não precisa marcar
     nada: todo cubo do logotipo (#cube3d, #pullRefreshCubo e o .vt-cubo
     de .brand/.faixa-marca) é posto dentro da torre por montarSimbolos().
   A fonte é carregada aqui mesmo (carregarFonte). */
(function (global) {
  'use strict';
  var MARCA = { nome: 'Matriz', slogan: 'Tudo começa na Matriz.' };
  global.VIBE_MARCA = MARCA;

  function escapeHtml(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // torre da Matriz (viewBox 0 26 100 137): telhado de quatro águas com
  // beiral, campanário com três arcos, o relógio (onde mora o cubo), três
  // janelas altas e a base. Os arcos e as janelas são vazados de verdade
  // (evenodd), então mostram o fundo, claro ou escuro.
  var TORRE = 'M46.5 27H53.5L89 45.5H91V49.5H82V77H86.5V81.5H82V125H86.5V129.5H82V156H87V163H13V156H18V129.5H13.5V125H18V81.5H13.5V77H18V49.5H9V45.5H11L46.5 27Z' +
    'M27.25 72V59.75A4.75 4.75 0 0 1 36.75 59.75V72ZM45.25 72V59.75A4.75 4.75 0 0 1 54.75 59.75V72ZM63.25 72V59.75A4.75 4.75 0 0 1 72.75 59.75V72Z';
  var TORRE_BAIXO = 'M33.5 152V137.5A3.5 3.5 0 0 1 40.5 137.5V152ZM46.5 152V137.5A3.5 3.5 0 0 1 53.5 137.5V152ZM59.5 152V137.5A3.5 3.5 0 0 1 66.5 137.5V152Z';
  // o cubo gira direto na silhueta, onde fica o relógio (sem aro nem
  // mostrador): no preto, o dourado do cubo é que desenha o relógio
  function torreSvg() {
    return '<svg class="mz-torre" viewBox="0 26 100 137" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="' + TORRE + TORRE_BAIXO + '"/></svg>';
  }
  MARCA.torreSvg = torreSvg;

  function montarSimbolos() {
    document.querySelectorAll('#cube3d, #pullRefreshCubo, .brand > .vt-cubo, .faixa-marca > .vt-cubo').forEach(function (cubo) {
      if (cubo.closest('.mz-simbolo')) return;
      var escuro = !!cubo.closest('.faixa-vibe');
      var simbolo = document.createElement('span');
      simbolo.className = 'mz-simbolo' + (escuro ? ' mz-escuro' : '') + (cubo.id ? ' mz-' + cubo.id : '');
      simbolo.setAttribute('aria-hidden', 'true');
      simbolo.innerHTML = torreSvg() + '<span class="mz-relogio"></span>';
      cubo.parentNode.insertBefore(simbolo, cubo);
      simbolo.lastChild.appendChild(cubo);
    });
  }

  // o pingo do "i" vira um losango dourado — o cubo visto de quina
  function palavraHtml(nome) {
    var idx = nome.lastIndexOf('i');
    if (idx === -1) return escapeHtml(nome);
    return escapeHtml(nome.slice(0, idx)) +
      '<span class="pt-idot">ı<i class="mz-ponto" aria-hidden="true"></i></span>' +
      escapeHtml(nome.slice(idx + 1));
  }

  function logoHtml(nome) {
    return '<span class="pt-word">' + palavraHtml(nome) + '</span>';
  }

  function aplicar() {
    document.querySelectorAll('[data-vibe-marca]').forEach(function (el) { el.textContent = MARCA.nome; });
    document.querySelectorAll('[data-vibe-slogan]').forEach(function (el) { el.textContent = MARCA.slogan; });
    document.querySelectorAll('[data-vibe-marca-logo]').forEach(function (el) {
      el.innerHTML = logoHtml(MARCA.nome);
      el.setAttribute('aria-label', MARCA.nome);
    });
    montarSimbolos();
  }
  // letra "de código" (monoespaçada) só pro logotipo; o nome aparece
  // devagar quando a letra já chegou — sem trocar de fonte na frente da pessoa
  function carregarFonte() {
    if (!document.getElementById('ptFonteCodigo')) {
      var l = document.createElement('link');
      l.id = 'ptFonteCodigo';
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap';
      document.head.appendChild(l);
    }
    var mostrar = function () { document.documentElement.classList.add('pt-marca-pronta'); };
    if (document.fonts && document.fonts.load) {
      Promise.race([
        document.fonts.load('600 1em "JetBrains Mono"'),
        new Promise(function (r) { setTimeout(r, 1200); })
      ]).then(mostrar, mostrar);
    } else mostrar();
  }

  function iniciar() { carregarFonte(); aplicar(); }
  // a torre entra já (o script fica no fim do <body>), antes dos cubos
  // em three.js medirem o lugar deles
  montarSimbolos();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
