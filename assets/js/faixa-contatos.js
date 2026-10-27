/* Faixa de ícones de contato no topo da foto do site do negócio (Agenda e
   Pedir/Chamar): anda sozinha e também dá pra arrastar com o dedo/mouse,
   com inércia; os ícones se repetem pra parecer infinita nos dois
   sentidos. Só entram os contatos que o negócio preencheu (WhatsApp,
   telefone, redes, mapa) + o atalho de agendar/pedir. Estilo em
   assets/css/faixa-contatos.css. */
(function (global) {
  'use strict';

  var SVG = {
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.83 9.83 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.36.101 11.943c0 2.105.55 4.16 1.595 5.986L0 24l6.335-1.652a11.86 11.86 0 0 0 5.71 1.451h.006c6.598 0 11.972-5.339 11.977-11.958a11.94 11.94 0 0 0-3.508-8.392"/></svg>',
    telefone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v4a2 2 0 0 1-2 2C9.5 21 3 14.5 3 6a2 2 0 0 1 1-2z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 9h3V6h-3a4 4 0 0 0-4 4v2H7v3h3v6h3v-6h3l1-3h-4v-2a1 1 0 0 1 1-1z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.8 2.4 4.6 5 4.8"/></svg>',
    mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    agendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/></svg>',
    pedir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    chamar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><path d="M9.5 9l2 2 3-3"/></svg>'
  };

  function linkRede(v, base) {
    v = String(v || '').trim();
    if (!v) return null;
    return /^https?:\/\//i.test(v) ? v : base + v.replace(/^@/, '');
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // dados: { whatsapp, instagram, facebook, tiktok, endereco, cidade, acao: { tipo, rotulo, aoTocar } }
  function itensDe(d) {
    var itens = [];
    var fone = String(d.whatsapp || '').replace(/\D/g, '');
    if (fone.length >= 10) {
      itens.push({ icone: 'whatsapp', rotulo: 'WhatsApp', href: 'https://wa.me/55' + fone });
      itens.push({ icone: 'telefone', rotulo: 'Ligar', href: 'tel:+55' + fone });
    }
    var ig = linkRede(d.instagram, 'https://instagram.com/');
    if (ig) itens.push({ icone: 'instagram', rotulo: 'Instagram', href: ig });
    var fb = linkRede(d.facebook, 'https://facebook.com/');
    if (fb) itens.push({ icone: 'facebook', rotulo: 'Facebook', href: fb });
    var tt = linkRede(d.tiktok, 'https://tiktok.com/@');
    if (tt) itens.push({ icone: 'tiktok', rotulo: 'TikTok', href: tt });
    if (d.endereco && String(d.endereco).trim()) {
      itens.push({ icone: 'mapa', rotulo: 'Ver no mapa', href: 'https://www.google.com/maps?q=' + encodeURIComponent(d.endereco + (d.cidade ? ', ' + d.cidade : '')) });
    }
    if (d.acao) itens.push({ icone: d.acao.tipo, rotulo: d.acao.rotulo, acao: d.acao.aoTocar });
    return itens;
  }

  function htmlItem(it, copia) {
    var extra = copia ? ' aria-hidden="true" tabindex="-1"' : ' aria-label="' + esc(it.rotulo) + '"';
    if (it.acao) return '<button type="button" class="faixa-icone" data-faixa-acao' + extra + '>' + SVG[it.icone] + '</button>';
    var externo = /^https?:/.test(it.href) ? ' target="_blank" rel="noopener"' : '';
    return '<a class="faixa-icone" href="' + esc(it.href) + '"' + externo + extra + '>' + SVG[it.icone] + '</a>';
  }

  function montar(alvo, dados, tentativa) {
    if (!alvo) return;
    // página ainda escondida (carregando): mede errado — espera aparecer
    if (!alvo.offsetWidth) {
      if ((tentativa || 0) < 50) setTimeout(function () { montar(alvo, dados, (tentativa || 0) + 1); }, 120);
      return;
    }
    var antiga = alvo.querySelector('.faixa-contatos');
    if (antiga && antiga.__parar) antiga.__parar();
    if (antiga) antiga.remove();
    var itens = itensDe(dados || {});
    // só faz sentido com pelo menos 2 jeitos de falar com o negócio
    if (itens.length < 2) return;
    var faixa = document.createElement('div');
    faixa.className = 'faixa-contatos';
    faixa.setAttribute('aria-label', 'Contatos e redes sociais');
    var trilha = document.createElement('div');
    trilha.className = 'faixa-trilha';
    faixa.appendChild(trilha);
    alvo.appendChild(faixa);
    posicionar(alvo, faixa);
    var acao = (dados.acao && dados.acao.aoTocar) || null;

    // um "conjunto" tem que ser mais largo que a faixa, senão aparece buraco
    // no loop: repete os ícones até passar da largura, e duplica o conjunto
    var conjunto = itens.map(function (it) { return htmlItem(it, false); }).join('');
    var copia = itens.map(function (it) { return htmlItem(it, true); }).join('');
    trilha.innerHTML = conjunto;
    var largura = faixa.clientWidth || alvo.clientWidth || 360;
    var umaVolta = Math.max(trilha.scrollWidth, itens.length * 50);
    var vezes = Math.min(8, Math.max(1, Math.ceil(largura / umaVolta)));
    var meio = conjunto;
    for (var i = 1; i < vezes; i++) meio += copia;
    var resto = '';
    for (var k = 0; k < vezes; k++) resto += copia;
    trilha.innerHTML = meio + resto;

    trilha.addEventListener('click', function (e) {
      var b = e.target.closest('[data-faixa-acao]');
      if (b && acao) { e.preventDefault(); acao(); }
    });
    faixa.__parar = ligarMovimento(trilha);
  }

  // fica logo abaixo do cabeçalho do site (que flutua por cima da foto)
  function posicionar(alvo, faixa) {
    var topo = document.querySelector('.site-topbar');
    var t = 14;
    if (topo) {
      var dif = topo.getBoundingClientRect().bottom - alvo.getBoundingClientRect().top;
      if (dif > 0 && dif < alvo.clientHeight / 2) t = Math.round(dif + 10);
    }
    faixa.style.top = t + 'px';
  }

  // anda sozinha + arrasta com inércia (do componente original, sem mudanças de comportamento)
  function ligarMovimento(trilha) {
    var reduz = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var VELOCIDADE = 0.035, ATRITO = 0.94, LIMIAR_CLIQUE = 6;
    var larguraConjunto = trilha.scrollWidth / 2;
    function medir() { larguraConjunto = trilha.scrollWidth / 2; }
    global.addEventListener('resize', medir);
    var posicao = 0, arrastando = false, moveu = false, soma = 0, px = 0, pt = 0, vel = 0;
    var quadro = null, ultAuto = null, ultMomento = null, visivel = true, parado = false;
    var obs = null;
    if ('IntersectionObserver' in global) {
      obs = new IntersectionObserver(function (en) {
        var antes = visivel;
        visivel = en[0].isIntersecting;
        if (visivel && !antes && !arrastando && !quadro && !parado) quadro = requestAnimationFrame(auto);
      });
      obs.observe(trilha);
    }
    function normalizar() {
      if (larguraConjunto <= 0) return;
      while (posicao <= -larguraConjunto) posicao += larguraConjunto;
      while (posicao > 0) posicao -= larguraConjunto;
    }
    function desenhar() { normalizar(); trilha.style.transform = 'translate3d(' + posicao + 'px,0,0)'; }
    function cancelar() { if (quadro) cancelAnimationFrame(quadro); quadro = null; }
    function auto(agora) {
      if (!visivel || parado) { quadro = null; ultAuto = null; return; }
      if (ultAuto === null) ultAuto = agora;
      var passo = agora - ultAuto;
      ultAuto = agora;
      if (!arrastando && !reduz) { posicao -= VELOCIDADE * passo; desenhar(); }
      quadro = requestAnimationFrame(auto);
    }
    function momento(agora) {
      if (ultMomento === null) ultMomento = agora;
      var passo = agora - ultMomento;
      ultMomento = agora;
      posicao += vel * passo;
      vel *= ATRITO;
      desenhar();
      if (Math.abs(vel) > 0.01) quadro = requestAnimationFrame(momento);
      else { ultMomento = null; ultAuto = null; quadro = requestAnimationFrame(auto); }
    }
    trilha.addEventListener('pointerdown', function (e) {
      arrastando = true; moveu = false; soma = 0; cancelar();
      px = e.clientX; pt = performance.now(); vel = 0;
      trilha.classList.add('arrastando');
      try { trilha.setPointerCapture(e.pointerId); } catch (er) {}
    });
    trilha.addEventListener('pointermove', function (e) {
      if (!arrastando) return;
      var agora = performance.now(), dx = e.clientX - px, dt = Math.max(agora - pt, 1);
      posicao += dx; vel = dx / dt; soma += Math.abs(dx);
      if (soma > LIMIAR_CLIQUE) moveu = true;
      px = e.clientX; pt = agora;
      desenhar();
    });
    function soltar() {
      if (!arrastando) return;
      arrastando = false;
      trilha.classList.remove('arrastando');
      cancelar(); ultMomento = null;
      if (Math.abs(vel) > 0.02 && !reduz) quadro = requestAnimationFrame(momento);
      else { ultAuto = null; quadro = requestAnimationFrame(auto); }
    }
    trilha.addEventListener('pointerup', soltar);
    trilha.addEventListener('pointercancel', soltar);
    trilha.addEventListener('pointerleave', function (e) { if (arrastando && e.buttons === 0) soltar(); });
    // depois de arrastar, o clique que sobra não abre o link
    trilha.addEventListener('click', function (e) { if (moveu) { e.preventDefault(); e.stopPropagation(); } }, true);
    quadro = requestAnimationFrame(auto);
    return function () {
      parado = true; cancelar();
      global.removeEventListener('resize', medir);
      if (obs) obs.disconnect();
    };
  }

  global.VBFaixaContatos = { montar: montar };
})(window);
