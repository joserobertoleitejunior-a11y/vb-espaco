/* Visual do site do negócio (white-label) fora do perfil.html: aplica o
   estilo escolhido (templates.js), a cor do dono e — pras partes que não
   são do template (carrinho, folhas de pedido, avisos) — copia as cores,
   a letra e os cantos do estilo pra variáveis próprias. Assim Pedir e
   Chamar ficam com a MESMA cara da Agenda; só mudam botões e funções.
   Mesma regra de cor do perfil.js (contraste garantido). */
(function (global) {
  'use strict';

  function hexParaRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function misturar(rgb, alvo, q) { return rgb.map(function (c, i) { return Math.round(c + (alvo[i] - c) * q); }); }
  function rgbParaHex(rgb) { return '#' + rgb.map(function (c) { return Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'); }).join(''); }
  function luminancia(rgb) {
    var l = rgb.map(function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  }
  // cor clara demais some com texto branco por cima: escurece até ter contraste
  function garantirContraste(rgb) {
    for (var i = 0; i < 20 && luminancia(rgb) > 0.6; i++) rgb = rgb.map(function (c) { return Math.round(c * 0.88); });
    return rgb;
  }
  // qualquer cor CSS (hex, rgb, nome) → [r,g,b]
  var sonda = null;
  function paraRgb(cor) {
    var hex = hexParaRgb(cor);
    if (hex) return hex;
    if (!sonda) { sonda = document.createElement('span'); sonda.style.display = 'none'; document.body.appendChild(sonda); }
    sonda.style.color = '';
    sonda.style.color = cor;
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(sonda).color);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  var templateAtual = 'classico-boiserie';

  // cor do dono por cima dos tokens de destaque do estilo
  function aplicarCor(cor, corSecundaria) {
    var rgb = hexParaRgb(cor);
    if (!rgb) return;
    rgb = garantirContraste(rgb);
    var principal = rgbParaHex(rgb);
    var sec = hexParaRgb(corSecundaria);
    var escuro = sec ? rgbParaHex(garantirContraste(sec)) : rgbParaHex(misturar(rgb, [0, 0, 0], 0.28));
    var claro = rgbParaHex(misturar(rgb, [255, 255, 255], 0.42));
    var estilo = document.getElementById('tplCorDinamica');
    if (!estilo) { estilo = document.createElement('style'); estilo.id = 'tplCorDinamica'; document.head.appendChild(estilo); }
    var terracotta = '--terracotta:' + principal + '; --terracotta-deep:' + escuro + '; --terracotta-claro:' + claro + '; --terracotta-rgb:' + rgb.join(',') + ';';
    estilo.textContent = ':root{' + (global.VibeTemplates && global.VibeTemplates.usaTerracotta(templateAtual) ? terracotta
      : '--dourado:' + principal + '; --dourado-escuro:' + escuro + '; --dourado-claro:' + claro + '; --dourado-rgb:' + rgb.join(',') + ';' + terracotta) + '}';
  }

  // troca o CSS do estilo e resolve quando ele terminou de carregar
  function aplicarEstilo(chave) {
    return new Promise(function (ok) {
      if (!global.VibeTemplates) { ok(); return; }
      var ids = ['tplBase', 'tplWidget', 'tplExtra'];
      var antes = ids.map(function (id) { var el = document.getElementById(id); return el ? el.getAttribute('href') : null; });
      var t = global.VibeTemplates.aplicar(chave);
      templateAtual = t.chave;
      var pendentes = 0;
      var feito = false;
      function fim() { if (!feito && --pendentes <= 0) { feito = true; ok(); } }
      ids.forEach(function (id, i) {
        var el = document.getElementById(id);
        if (!el || el.disabled || el.getAttribute('href') === antes[i]) return;
        pendentes++;
        el.addEventListener('load', fim, { once: true });
        el.addEventListener('error', fim, { once: true });
      });
      if (!pendentes) { feito = true; ok(); }
      setTimeout(function () { if (!feito) { feito = true; ok(); } }, 3000);
    });
  }

  // copia cor de fundo, texto, destaque, letra e cantos do estilo pras
  // variáveis das partes de pedido (.loja-ui) — elas "vestem" o estilo
  function herdarTokens(alvos) {
    var raiz = getComputedStyle(document.documentElement);
    function v(n) { return raiz.getPropertyValue(n).trim(); }
    var fundo = paraRgb(v('--linen') || '#ffffff') || [255, 255, 255];
    var escuro = luminancia(fundo) < 0.3;
    var tinta = v('--ink') || (escuro ? '#f3eedf' : '#1f2024');
    var tintaSuave = v('--ink-soft') || (escuro ? 'rgba(255,255,255,.66)' : '#6b6d76');
    var destaque = paraRgb((global.VibeTemplates && !global.VibeTemplates.usaTerracotta(templateAtual) ? v('--dourado') : v('--terracotta')) || '#C9A227') || [201, 162, 39];
    var destaqueTexto = escuro ? rgbParaHex(misturar(destaque, [255, 255, 255], 0.25)) : rgbParaHex(garantirContraste(destaque.slice()));
    var cartao = escuro ? rgbParaHex(misturar(fundo, [255, 255, 255], 0.07)) : '#ffffff';
    var h1 = document.querySelector('.hero-split-copy h1') || document.querySelector('h1');
    var csH1 = h1 ? getComputedStyle(h1) : null;
    var tokens = {
      '--bg': rgbParaHex(fundo),
      '--surface': escuro ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.86)',
      '--surface-solida': cartao,
      '--surface-2': escuro ? 'rgba(255,255,255,0.06)' : 'rgba(31,32,36,0.045)',
      '--line': escuro ? 'rgba(255,255,255,0.12)' : (v('--stone') || 'rgba(31,32,36,0.09)'),
      '--ink': tinta,
      '--ink-soft': tintaSuave,
      '--ink-faint': escuro ? 'rgba(255,255,255,0.45)' : '#9a9ca4',
      '--price': tinta,
      '--accent': rgbParaHex(destaque),
      '--accent-rgb': destaque.join(', '),
      '--accent-texto': destaqueTexto,
      '--on-accent': luminancia(destaque) > 0.5 ? '#1f2024' : '#ffffff',
      '--font-body': getComputedStyle(document.body).fontFamily,
      '--font-display': csH1 ? csH1.fontFamily : 'inherit',
      '--display-weight': csH1 ? csH1.fontWeight : '700',
      '--display-transform': csH1 ? csH1.textTransform : 'none',
      '--display-spacing': csH1 ? csH1.letterSpacing : 'normal',
      '--radius': v('--radius') || '14px'
    };
    (alvos || []).forEach(function (el) {
      if (!el) return;
      Object.keys(tokens).forEach(function (k) { el.style.setProperty(k, tokens[k]); });
      el.classList.toggle('tom-escuro', escuro);
    });
    return tokens;
  }

  // gradiente dos botões redondos (igual à lista de serviços da Agenda)
  function corBotaoRedondo(cor, i) {
    var base = garantirContraste(hexParaRgb(cor) || [201, 162, 39]);
    var ponta = misturar(base, i % 2 === 0 ? [0, 0, 0] : [255, 255, 255], i % 2 === 0 ? 0.22 : 0.16);
    return 'linear-gradient(135deg, ' + rgbParaHex(base) + ', ' + rgbParaHex(ponta) + ')';
  }

  global.VBSiteVisual = {
    aplicarEstilo: aplicarEstilo, aplicarCor: aplicarCor, herdarTokens: herdarTokens,
    corBotaoRedondo: corBotaoRedondo, templateAtual: function () { return templateAtual; }
  };
})(window);
