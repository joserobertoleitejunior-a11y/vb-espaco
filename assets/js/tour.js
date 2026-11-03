/* Tour clicável do app: escurece a tela, destaca UM botão de verdade e explica
   em uma frase. O dono pode tocar em "Próximo" ou no próprio botão destacado —
   os dois fazem a mesma coisa (abrem a tela e passam pro próximo passo).
   Funciona com o dedo e com o teclado (→ ← Esc).

     VBTour.iniciar({
       passos: [
         { titulo, texto },                                   // sem alvo: cartão no meio da tela
         { alvo: '#botao' | fn, titulo, texto, antes?: fn }   // alvo: seletor ou função que devolve o elemento
       ],
       aoFim: fn(concluiu)                                    // true = chegou ao último passo
     });
     VBTour.oferecer({ chave, aoAceitar })   // convite discreto, só uma vez por aparelho
*/
(function (global) {
  'use strict';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  var ativo = null;

  function achar(alvo) {
    if (!alvo) return null;
    var el = typeof alvo === 'function' ? alvo() : document.querySelector(alvo);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? el : null;
  }

  function iniciar(cfg) {
    if (ativo) ativo.fechar(false);
    var passos = cfg.passos || [];
    if (!passos.length) return null;
    var i = -1, alvoEl = null, fechado = false, esperando = 0;

    var raiz = document.createElement('div');
    raiz.className = 'vbt';
    raiz.setAttribute('role', 'dialog');
    raiz.setAttribute('aria-modal', 'true');
    raiz.setAttribute('aria-label', 'Tour do app');
    raiz.innerHTML =
      '<div class="vbt-bloq" data-vbt-bloq></div>' +
      '<div class="vbt-foco" data-vbt-foco></div>' +
      '<div class="vbt-cartao" data-vbt-cartao>' +
        '<div class="vbt-topo"><span class="vbt-conta" data-vbt-conta></span><button type="button" class="vbt-pular" data-vbt-pular>Pular tour</button></div>' +
        '<h3 data-vbt-titulo></h3><p data-vbt-texto></p>' +
        '<div class="vbt-dica" data-vbt-dica></div>' +
        '<div class="vbt-pontos" data-vbt-pontos></div>' +
        '<div class="vbt-botoes"><button type="button" class="vbt-sec" data-vbt-voltar>Voltar</button><button type="button" class="vbt-prim" data-vbt-prox>Próximo</button></div>' +
      '</div>';
    document.body.appendChild(raiz);
    requestAnimationFrame(function () { raiz.classList.add('on'); });

    var foco = raiz.querySelector('[data-vbt-foco]');
    var cartao = raiz.querySelector('[data-vbt-cartao]');
    var q = function (s) { return raiz.querySelector(s); };
    q('[data-vbt-pontos]').innerHTML = passos.map(function () { return '<i></i>'; }).join('');

    function posicionar() {
      if (fechado) return;
      var p = passos[i];
      var vw = window.innerWidth, vh = window.innerHeight, m = 12;
      if (!alvoEl) {
        foco.classList.add('sem');
        foco.style.cssText = 'left:' + vw / 2 + 'px;top:' + vh / 2 + 'px;width:0;height:0';
        cartao.style.left = '50%'; cartao.style.top = '50%'; cartao.style.transform = 'translate(-50%,-50%)';
        return;
      }
      var r = alvoEl.getBoundingClientRect(), pad = 6;
      foco.classList.remove('sem');
      foco.style.left = (r.left - pad) + 'px'; foco.style.top = (r.top - pad) + 'px';
      foco.style.width = (r.width + pad * 2) + 'px'; foco.style.height = (r.height + pad * 2) + 'px';
      // o cartão vai pro lado que tem mais espaço (em cima ou embaixo do botão destacado)
      cartao.style.transform = 'none';
      var altura = cartao.offsetHeight, largura = Math.min(cartao.offsetWidth || 340, vw - m * 2);
      var embaixo = vh - r.bottom, emcima = r.top;
      var top = embaixo >= altura + 20 || embaixo >= emcima ? Math.min(r.bottom + 14, vh - altura - m) : Math.max(r.top - altura - 14, m);
      var left = Math.max(m, Math.min(r.left + r.width / 2 - largura / 2, vw - largura - m));
      cartao.style.top = top + 'px'; cartao.style.left = left + 'px';
    }

    function mostrar(n, sentido) {
      if (fechado) return;
      i = n;
      var p = passos[i];
      var token = ++esperando;
      if (typeof p.antes === 'function') { try { p.antes(); } catch (e) {} }
      raiz.classList.add('troca');
      // o botão pode ainda nascer (a tela acabou de abrir): espera um pouco por ele
      var tentativas = 0;
      (function procurar() {
        if (fechado || token !== esperando) return;
        var el = p.alvo ? achar(p.alvo) : null;
        if (p.alvo && !el && tentativas++ < 25) { setTimeout(procurar, 100); return; }
        if (p.alvo && !el) { // não achou: pula esse passo em vez de travar o tour
          if (sentido < 0 ? i > 0 : i < passos.length - 1) { mostrar(i + (sentido < 0 ? -1 : 1), sentido); return; }
        }
        alvoEl = el;
        if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
        q('[data-vbt-conta]').textContent = (i + 1) + ' de ' + passos.length;
        q('[data-vbt-titulo]').textContent = p.titulo || '';
        q('[data-vbt-texto]').innerHTML = esc(p.texto || '');
        q('[data-vbt-dica]').textContent = el ? 'Toque no botão em destaque ou em "' + (i === passos.length - 1 ? 'Começar' : 'Próximo') + '".' : '';
        q('[data-vbt-dica]').style.display = el ? '' : 'none';
        q('[data-vbt-voltar]').style.visibility = i === 0 ? 'hidden' : 'visible';
        q('[data-vbt-prox]').textContent = i === passos.length - 1 ? (p.botao || 'Começar a usar') : (p.botao || 'Próximo');
        raiz.querySelectorAll('[data-vbt-pontos] i').forEach(function (d, k) { d.classList.toggle('on', k === i); d.classList.toggle('feito', k < i); });
        raiz.classList.remove('troca');
        requestAnimationFrame(posicionar);
        setTimeout(posicionar, 220);
      })();
    }

    // avançar = tocar de verdade no botão destacado (abre a tela) e ir pro próximo
    function proximo() {
      var p = passos[i];
      if (i >= passos.length - 1) return fechar(true);
      if (alvoEl && p.tocar !== false) { try { alvoEl.click(); } catch (e) {} }
      mostrar(i + 1, 1);
    }
    function voltar() { if (i > 0) mostrar(i - 1, -1); }
    function fechar(concluiu) {
      if (fechado) return;
      fechado = true; ativo = null;
      raiz.classList.remove('on');
      window.removeEventListener('resize', posicionar);
      document.removeEventListener('keydown', teclas, true);
      setTimeout(function () { raiz.remove(); }, 220);
      if (cfg.aoFim) cfg.aoFim(!!concluiu);
    }
    function teclas(e) {
      if (e.key === 'Escape') { e.stopPropagation(); fechar(false); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); proximo(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); voltar(); }
    }

    raiz.addEventListener('click', function (e) {
      if (e.target.closest('[data-vbt-prox]')) return proximo();
      if (e.target.closest('[data-vbt-voltar]')) return voltar();
      if (e.target.closest('[data-vbt-pular]')) return fechar(false);
      // tocar em cima do botão destacado vale como "Próximo"
      if (alvoEl && e.target.closest('[data-vbt-bloq], [data-vbt-foco]')) {
        var r = alvoEl.getBoundingClientRect();
        if (e.clientX >= r.left - 6 && e.clientX <= r.right + 6 && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6) return proximo();
        cartao.classList.remove('balanca'); void cartao.offsetWidth; cartao.classList.add('balanca');
      }
    });
    window.addEventListener('resize', posicionar);
    document.addEventListener('keydown', teclas, true);

    ativo = { fechar: fechar };
    mostrar(0, 1);
    return ativo;
  }

  // convite pequeno, uma vez só: não atrapalha quem já conhece o app
  function oferecer(cfg) {
    if (ler(cfg.chave)) return;
    var el = document.createElement('div');
    el.className = 'vbt-convite';
    el.innerHTML = '<div><strong>Quer um tour de 1 minuto?</strong><span>Eu mostro cada botão do app, passo a passo.</span></div>' +
      '<button type="button" class="vbt-prim" data-vbt-sim>Vamos</button><button type="button" class="vbt-x" data-vbt-nao aria-label="Agora não">×</button>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('on'); });
    var fechar = function (aceitou) {
      guardar(cfg.chave, '1');
      el.classList.remove('on');
      setTimeout(function () { el.remove(); }, 250);
      if (aceitou && cfg.aoAceitar) cfg.aoAceitar();
    };
    el.querySelector('[data-vbt-sim]').addEventListener('click', function () { fechar(true); });
    el.querySelector('[data-vbt-nao]').addEventListener('click', function () { fechar(false); });
    setTimeout(function () { if (el.parentNode) fechar(false); }, 20000);
  }

  global.VBTour = { iniciar: iniciar, oferecer: oferecer };
})(window);
