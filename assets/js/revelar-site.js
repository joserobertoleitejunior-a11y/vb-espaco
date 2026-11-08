/* Abertura do site público: mostra UMA versão só — a final, já pronta.

   Antes, o visitante via o site "se montando": fundo cinza, depois vários tons de
   cinza até o escuro (uma transição de cor com o site já visível), o estilo antigo
   guardado no aparelho, a foto aparecendo aos pedaços. Agora:

     1. O site fica escondido (só o esqueleto de "carregando" aparece) até estar pronto.
     2. "Pronto" = dados chegaram + estilo do negócio carregado + fontes + foto principal
        decodificada. Nada disso aparece antes da hora.
     3. A tela abre de uma vez, com um desbotar suave por cima (um véu que some),
        sem passar por cores intermediárias. Os efeitos de movimento do site começam
        já com tudo no lugar.

   Este arquivo roda no <head>, logo depois dos links do estilo (precisa disso pra
   o estilo lembrado entrar antes da primeira pintura). Quem termina de montar a
   página chama window.vbRevelarSite().
     vbRevelarSite()                  → espera ficar tudo pronto e abre
     vbRevelarSite({ rapido: true })  → abre já (erro, "não encontramos…") */
(function () {
  'use strict';
  var h = document.documentElement;
  var ok = false;
  try { ok = !!(window.VibeTemplates && window.VibeTemplates.restaurar()); } catch (e) {}
  // primeira visita: fundo neutro (+ véu); já conhece o site: estilo certo desde o início
  h.classList.add(ok ? 'site-esperando' : 'site-carregando');

  var aberto = false;
  function abrir() {
    if (aberto) return;
    aberto = true;
    h.classList.add('site-entrando');
    h.classList.remove('site-carregando', 'site-esperando');
    setTimeout(function () { h.classList.remove('site-entrando'); }, 900);
  }

  // a foto principal do site já baixada e decodificada, pra não "aparecer aos pedaços"
  function fotoPronta() {
    var el = null, sel = ['#tplHeroFoto', '.hero-split-photo', '.loja-hero', '.loja-capa'];
    for (var i = 0; i < sel.length && !el; i++) el = document.querySelector(sel[i]);
    if (!el) return Promise.resolve();
    var img = el.querySelector && el.querySelector('img');
    var url = img ? (img.currentSrc || img.src) : '';
    if (!url) {
      var bg = '';
      try { bg = getComputedStyle(el).backgroundImage || ''; } catch (e) {}
      var m = /url\(["']?([^"')]+)["']?\)/.exec(bg);
      url = m ? m[1] : '';
    }
    if (!url) return Promise.resolve();
    return new Promise(function (fim) {
      var im = new Image();
      im.onload = function () { (im.decode ? im.decode().catch(function () {}) : Promise.resolve()).then(fim); };
      im.onerror = fim;
      im.src = url;
    });
  }

  function frame() { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }

  window.vbRevelarSite = function (op) {
    if (op && op.rapido) { abrir(); return Promise.resolve(); }
    var estilo = Promise.resolve();
    try { if (window.VibeTemplates && window.VibeTemplates.quandoPronto) estilo = window.VibeTemplates.quandoPronto(); } catch (e) {}
    return estilo
      .then(frame)                                   // o navegador monta o layout e pede as fontes
      .then(function () { return document.fonts && document.fonts.ready ? document.fonts.ready : null; })
      .then(function () { return Promise.race([fotoPronta(), new Promise(function (r) { setTimeout(r, 2000); })]); }) // foto lenta não segura o site
      .then(frame).then(frame)                       // dois quadros: a tela já está pintada por baixo do véu
      .then(abrir, abrir);
  };

  // nunca deixa o visitante preso olhando o esqueleto (rede ruim, erro de script)
  setTimeout(abrir, 5000);
})();
