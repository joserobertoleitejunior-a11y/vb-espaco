/* Aviso da fase gratuita num lugar só — com a mesma cara de código do
   nome (letra monoespaçada, dourado, motion de "decodificar").

   Enquanto o app está em finalização, tudo é grátis. É por tempo
   limitado: quando a mensalidade começar, vai ser MENSALIDADE por mês
   (≈ POR_DIA por dia) — praticamente de graça. Pra quem agenda, pede ou
   chama, continua sempre grátis.

   Marca um elemento com data-aviso-gratis:
   - ="curto": uma linha em pílula (splash, criar);
   - ="convite": "Você é ___?" com os profissionais do app trocando,
     chamando quem tem negócio ou trabalha por conta;
   - vazio (""): o cartão completo (parceiros, painéis).

   O motion: cada letra passa por caracteres de código (0 1 / < > …)
   antes de assentar, da esquerda pra direita — só quando aparece na
   tela, uma vez. Com "reduzir movimento", o texto já aparece pronto. */
(function (global) {
  'use strict';
  var MENSALIDADE = 'R$ 19,90';
  var POR_DIA = 'R$ 0,66';
  global.VB_AVISO_GRATIS = { mensalidade: MENSALIDADE, porDia: POR_DIA };

  // quem o app chama — um por tipo de negócio que existe na Matriz
  var PROFISSIONAIS = ['barbeiro', 'tatuador', 'manicure', 'cabeleireira', 'esteticista', 'pizzaiolo',
    'eletricista', 'chaveiro', 'confeiteira', 'borracheiro', 'encanador', 'diarista', 'padeiro',
    'jardineiro', 'pedreiro', 'hamburgueiro', 'dono de petshop', 'técnico de celular', 'vidraceiro', 'montador'];

  var reduz = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GLIFOS = '01<>/{}[]#*+=_:;';

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // decodifica o texto do elemento: letras "embaralhadas" que assentam
  // uma a uma; devolve uma promessa que resolve quando terminou
  function decodificar(el, texto, atrasoInicial) {
    texto = texto == null ? el.textContent : texto;
    if (reduz) { el.textContent = texto; return Promise.resolve(); }
    var n = texto.length, t0 = null, passo = 26, giro = 170;
    el.setAttribute('aria-label', texto);
    return new Promise(function (ok) {
      function quadro(agora) {
        if (t0 === null) t0 = agora + (atrasoInicial || 0);
        var t = agora - t0, saida = '', fim = true;
        for (var i = 0; i < n; i++) {
          var ch = texto[i];
          var pronto = t - i * passo;
          if (ch === ' ' || pronto >= giro) saida += ch;
          else if (pronto < 0) { saida += ' '; fim = false; }
          else { saida += GLIFOS[(Math.random() * GLIFOS.length) | 0]; fim = false; }
        }
        el.textContent = saida;
        if (fim) { el.textContent = texto; ok(); } else requestAnimationFrame(quadro);
      }
      requestAnimationFrame(quadro);
    });
  }

  // roda quando o elemento entra na tela (uma vez)
  function quandoVisivel(el, fn) {
    if (!('IntersectionObserver' in global)) { fn(); return; }
    var io = new IntersectionObserver(function (entradas) {
      if (entradas.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { threshold: 0.3 });
    io.observe(el);
  }

  var PONTO = '<span class="ag-ponto" aria-hidden="true"></span>';

  function html(tipo) {
    if (tipo === 'curto') {
      return PONTO + '<span class="ag-linha"><span data-ag-decode>grátis por tempo limitado</span>' +
        '<span class="ag-sep" aria-hidden="true">·</span>' +
        '<span class="ag-depois" data-ag-decode>depois, ' + POR_DIA + '/dia</span></span>';
    }
    if (tipo === 'convite') {
      return '<span class="ag-convite-linha">Você é <span class="ag-giro" data-ag-giro>' + esc(PROFISSIONAIS[0]) + '</span><span class="ag-cursor" aria-hidden="true">_</span>?</span>' +
        '<span class="ag-convite-sub">Crie seu perfil grátis — enquanto dura.</span>';
    }
    return '<button type="button" class="ag-cab" aria-expanded="false">' + PONTO +
        '<span class="ag-cab-txt">grátis por tempo limitado</span><span class="ag-cab-seta" aria-hidden="true">&gt;_</span></button>' +
      '<div class="ag-corpo" hidden>' +
      '<p class="ag-rotulo">' + PONTO + '<span>fase de finalização</span></p>' +
      '<p class="ag-titulo">Entrada liberada. Por pouco tempo.</p>' +
      '<p class="ag-texto">Enquanto a Matriz termina os últimos ajustes, tudo é grátis — sem taxa e sem cartão. ' +
      'Quando a mensalidade começar, vai ser <strong>' + MENSALIDADE + ' por mês</strong>: <strong>' + POR_DIA + ' por dia</strong>, menos que um cafezinho. ' +
      'E você é avisado antes de qualquer cobrança.</p>' +
      '<p class="ag-corre">Quem entra agora já sai na frente.</p></div>';
  }

  // digita o conteúdo de um bloco, letra por letra (mantendo negrito e o resto do HTML)
  function digitarBloco(corpo) {
    var elementos = Array.prototype.slice.call(corpo.querySelectorAll('.ag-rotulo, .ag-titulo, .ag-texto, .ag-corre'));
    if (reduz) return { parar: function () {} };
    var parado = false, cursor = document.createElement('span');
    cursor.className = 'ag-cursor'; cursor.setAttribute('aria-hidden', 'true'); cursor.textContent = '▌';
    var fila = [];
    elementos.forEach(function (el) {
      var andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), no;
      while ((no = andar.nextNode())) { if (no.data.length) fila.push({ no: no, texto: no.data, el: el }); }
    });
    fila.forEach(function (f) { f.no.data = ''; });
    corpo.setAttribute('aria-label', elementos.map(function (e) { return fila.filter(function (f) { return f.el === e; }).map(function (f) { return f.texto; }).join(''); }).join('. '));
    var i = 0, c = 0, ultimo = 0;
    function passo(agora) {
      if (parado) return;
      // ~34 letras por segundo (a primeira linha mais rápida, o texto longo mais)
      var por = agora - ultimo; if (por < 24) return requestAnimationFrame(passo);
      ultimo = agora;
      var f = fila[i];
      if (!f) { cursor.remove(); return; }
      var n = f.texto.length > 60 ? 2 : 1;
      c = Math.min(f.texto.length, c + n);
      f.no.data = f.texto.slice(0, c);
      if (f.no.nextSibling !== cursor) f.no.parentNode.insertBefore(cursor, f.no.nextSibling);
      if (c >= f.texto.length) { i++; c = 0; if (fila[i] && fila[i].el !== f.el) ultimo += 160; }
      requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
    return { parar: function () { parado = true; fila.forEach(function (f) { f.no.data = f.texto; }); cursor.remove(); } };
  }

  // cartão: recolhido; toque abre e digita, toque de novo recolhe
  function ligarCartao(el) {
    var cab = el.querySelector('.ag-cab'), corpo = el.querySelector('.ag-corpo'), digitando = null;
    cab.addEventListener('click', function () {
      var abrir = corpo.hidden;
      if (digitando) { digitando.parar(); digitando = null; }
      corpo.hidden = !abrir;
      cab.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      el.classList.toggle('ag-aberto', abrir);
      if (abrir) digitando = digitarBloco(corpo);
    });
  }

  // "Você é ___?": o profissional vai sendo trocado, em código
  function girar(el) {
    var i = 0;
    if (reduz) return;
    setInterval(function () {
      if (document.hidden) return;
      i = (i + 1) % PROFISSIONAIS.length;
      decodificar(el, PROFISSIONAIS[i]);
    }, 2600);
  }

  function aplicar() {
    document.querySelectorAll('[data-aviso-gratis]').forEach(function (el) {
      if (el.getAttribute('data-ag-pronto')) return;
      el.setAttribute('data-ag-pronto', '1');
      var tipo = el.getAttribute('data-aviso-gratis');
      el.classList.add('aviso-gratis', 'ag-' + (tipo || 'cartao'));
      el.setAttribute('role', 'note');
      el.innerHTML = html(tipo);
      if (el.querySelector('.ag-cab')) { ligarCartao(el); return; }
      var partes = Array.prototype.slice.call(el.querySelectorAll('[data-ag-decode]'));
      var textos = partes.map(function (p) { return p.textContent; });
      // guarda o espaço do texto (letra monoespaçada: nada pula quando decodifica)
      if (!reduz) partes.forEach(function (p) { p.textContent = p.textContent.replace(/[^ ]/g, '\u00a0'); });
      quandoVisivel(el, function () {
        el.classList.add('ag-visivel');
        partes.reduce(function (anterior, p, k) {
          return anterior.then(function () { return decodificar(p, textos[k], k ? 60 : 250); });
        }, Promise.resolve());
        var g = el.querySelector('[data-ag-giro]');
        if (g) girar(g);
      });
    });
  }
  global.VBAvisoGratis = { aplicar: aplicar, html: html, decodificar: decodificar, PROFISSIONAIS: PROFISSIONAIS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})(window);
