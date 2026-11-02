/* Efeito de digitação leve: um requestAnimationFrame só por texto, revelando por
   tempo (não um timer por letra). O cursor é um ::after do CSS, então nada entra
   nem sai do DOM enquanto digita.

   VBDigita.em(el, texto, { vel, aoFim })  → pular()      vel = letras por segundo
   VBDigita.fila([[el, texto], …], aoFim)  → pular()      um depois do outro
   VBDigita.laco(el, [t1, t2, …], { vel, apaga, pausa }) → parar()
       digita, segura, apaga e passa pro próximo, pra sempre. Dorme sozinho
       quando sai da tela ou a aba vai pro fundo.

   Com "prefers-reduced-motion" o texto aparece inteiro, na hora. */
(function (global) {
  'use strict';
  var reduz = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = global.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
  var cancel = global.cancelAnimationFrame || clearTimeout;

  function em(el, texto, op) {
    op = op || {};
    texto = String(texto == null ? '' : texto);
    if (!el) return function () {};
    var fim = function () { el.classList.remove('vbd-on'); if (op.aoFim) op.aoFim(); };
    if (reduz || !texto) { el.textContent = texto; fim(); return function () {}; }
    var vel = op.vel || 55, id = 0, t0 = 0, vivo = true;
    el.textContent = '';
    el.classList.add('vbd-on');
    (function passo(t) {
      if (!vivo) return;
      if (!t0) t0 = t || 0;
      var n = Math.min(texto.length, Math.round(((t || 0) - t0) / 1000 * vel));
      el.textContent = texto.slice(0, n);
      if (n >= texto.length) { vivo = false; fim(); return; }
      id = raf(passo);
    })(0);
    return function () { if (!vivo) return; vivo = false; cancel(id); el.textContent = texto; fim(); };
  }

  function fila(itens, aoFim) {
    var i = 0, parar = null, vivo = true;
    (function proximo() {
      if (!vivo) return;
      if (i >= itens.length) { if (aoFim) aoFim(); return; }
      var par = itens[i++];
      parar = em(par[0], par[1], { vel: par[2] || 55, aoFim: proximo });
    })();
    return function () {
      vivo = false;
      if (parar) parar();
      for (; i < itens.length; i++) itens[i][0].textContent = itens[i][1];
      if (aoFim) aoFim();
    };
  }

  /* Laço: digita um texto, segura, apaga e vai pro próximo, sem fim.
     Mesmo cursor e mesma velocidade do título do index — a diferença é que
     aqui ele não para no fim. Só gasta quadro quando está visível: fora da
     tela ou com a aba no fundo, o laço dorme. */
  function laco(el, textos, op) {
    op = op || {};
    if (!el || !textos || !textos.length) return function () {};
    var vel = op.vel || 42, apaga = op.apaga || 95, pausa = op.pausa || 1500, saida = op.saida || 520;
    if (reduz) { el.textContent = textos[0]; return function () {}; }

    var i = 0, n = 0, escrevendo = true, esperaAte = 0, vivo = true, id = 0, ultimo = 0, visivel = true;

    function passo(t) {
      if (!vivo) return;
      id = raf(passo);
      if (!visivel || document.hidden) { ultimo = t; return; }
      if (!ultimo) ultimo = t;
      var dt = t - ultimo;
      ultimo = t;
      if (esperaAte > 0) { esperaAte -= dt; return; }
      var texto = textos[i];
      // "n" é sempre quantas letras estão na tela: sobe escrevendo, desce
      // apagando. Conta por tempo, não por letra, pra um quadro perdido não
      // descompassar o texto.
      n += (escrevendo ? vel : -(1000 / apaga)) * dt / 1000;
      if (escrevendo && n >= texto.length) {
        n = texto.length; escrevendo = false; esperaAte = pausa;
      } else if (!escrevendo && n <= 0) {
        n = 0; escrevendo = true; i = (i + 1) % textos.length; esperaAte = saida;
      }
      el.textContent = texto.slice(0, Math.max(0, Math.min(texto.length, Math.round(n))));
    }

    el.classList.add('vbd-on');
    // fora da tela o laço nem roda: nada de quadro gasto onde ninguém vê
    var obs = global.IntersectionObserver && new global.IntersectionObserver(function (es) {
      es.forEach(function (e) { visivel = e.isIntersecting; });
    }, { rootMargin: '40px' });
    if (obs) obs.observe(el);
    id = raf(passo);

    return function () {
      vivo = false; cancel(id);
      if (obs) obs.disconnect();
      el.classList.remove('vbd-on');
    };
  }

  // Qualquer [data-digita] da página é digitado quando entra na tela, uma vez só.
  // É um observador só por página e nenhum quadro é gasto fora da tela.
  function aoAparecer(raiz) {
    var alvos = (raiz || document).querySelectorAll('[data-digita]:not([data-digitado])');
    if (!alvos.length) return;
    if (reduz || !global.IntersectionObserver) {
      alvos.forEach(function (el) { el.setAttribute('data-digitado', '1'); });
      return;
    }
    if (!observador) {
      observador = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          observador.unobserve(e.target);
          e.target.setAttribute('data-digitado', '1');
          em(e.target, e.target.textContent, { vel: Number(e.target.getAttribute('data-digita')) || 48 });
        });
      }, { rootMargin: '0px 0px -10% 0px' });
    }
    alvos.forEach(function (el) { observador.observe(el); });
  }
  var observador = null;

  // o cursor é do módulo (uma regra só, injetada uma vez)
  var est = document.createElement('style');
  est.textContent = ".vbd-on::after{content:'';display:inline-block;width:.5ch;height:1em;margin-left:2px;vertical-align:-.12em;background:var(--destaque,#C9A227);animation:vbd-pisca .75s steps(1) infinite}@keyframes vbd-pisca{50%{opacity:0}}";
  document.head.appendChild(est);

  global.VBDigita = { em: em, fila: fila, laco: laco, aoAparecer: aoAparecer };

  // o HTML da página só precisa marcar o que quer digitado: data-digita
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { aoAparecer(document); });
  else aoAparecer(document);
})(window);
