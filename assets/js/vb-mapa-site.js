/* O mapa no site do estabelecimento, pro cliente ver onde fica.

   Só aparece quando o dono marcou o ponto no editor (lat/lng). Endereço só
   escrito não vira mapa: sem coordenada não dá pra pôr o pino no lugar certo,
   e mapa errado é pior que mapa nenhum.

   Leve de propósito: o Leaflet (≈140 KB) só é baixado quando o mapa entra na
   tela. Quem nunca rola até o rodapé não paga nada por isso. Se o Leaflet não
   vier, fica o endereço e o botão "Como chegar", que é o que importa.

     VBMapaSite.montar(elemento, { lat, lng, endereco, nome })

   Mapa do OpenStreetMap, sem chave e sem cadastro. */
(function (global) {
  'use strict';

  var LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  var TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var carregando = null;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function carregarLeaflet() {
    if (global.L && global.L.map) return Promise.resolve();
    if (carregando) return carregando;
    carregando = new Promise(function (ok, falha) {
      if (!document.querySelector('link[href*="leaflet"]')) {
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = LEAFLET + 'leaflet.min.css';
        document.head.appendChild(css);
      }
      var s = document.querySelector('script[data-leaflet]');
      if (!s) {
        s = document.createElement('script');
        s.src = LEAFLET + 'leaflet.min.js';
        s.setAttribute('data-leaflet', '');
        document.head.appendChild(s);
      }
      s.addEventListener('load', function () { ok(); });
      s.addEventListener('error', function () { falha(new Error('mapa')); });
      // biblioteca que nunca responde também é falha
      setTimeout(function () { if (!global.L) falha(new Error('demorou')); }, 9000);
    });
    return carregando;
  }

  function comoChegar(lat, lng, endereco) {
    // o app de mapas do próprio celular resolve melhor que qualquer link nosso
    return 'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(lat != null && lng != null ? lat + ',' + lng : (endereco || ''));
  }

  function montar(caixa, cfg) {
    if (!caixa || !cfg) return;
    var lat = Number(cfg.lat), lng = Number(cfg.lng);
    var temPonto = isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0);
    if (!temPonto) { caixa.hidden = true; return; }
    caixa.hidden = false;

    caixa.innerHTML =
      '<div class="vms-tela" data-vms-tela><span class="vms-espera">abrindo o mapa…</span></div>' +
      '<div class="vms-pe">' +
        '<p class="vms-end">' + esc(cfg.endereco || 'Veja no mapa onde a gente fica') + '</p>' +
        '<a class="vms-btn" href="' + esc(comoChegar(lat, lng, cfg.endereco)) + '" target="_blank" rel="noopener">Como chegar</a>' +
      '</div>';

    var tela = caixa.querySelector('[data-vms-tela]');
    var desenhado = false;
    var desenhar = function () {
      if (desenhado) return;
      desenhado = true;
      carregarLeaflet().then(function () {
        tela.innerHTML = '';
        var mapa = global.L.map(tela, {
          center: [lat, lng], zoom: 16,
          zoomControl: false, attributionControl: true,
          // é um mapa pra olhar, não pra navegar: sem rolagem roubada do dedo
          scrollWheelZoom: false, dragging: false, touchZoom: false,
          doubleClickZoom: false, keyboard: false, tap: false
        });
        global.L.tileLayer(TILES, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
        global.L.marker([lat, lng]).addTo(mapa);
        setTimeout(function () { mapa.invalidateSize(); }, 60);
      }, function () {
        // sem mapa, o endereço e o botão continuam lá: ninguém fica sem saber onde é
        tela.remove();
        caixa.setAttribute('data-sem-mapa', '1');
      });
    };

    if (!global.IntersectionObserver) { desenhar(); return; }
    var obs = new global.IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { obs.disconnect(); desenhar(); } });
    }, { rootMargin: '200px' });
    obs.observe(caixa);
  }

  global.VBMapaSite = { montar: montar, comoChegar: comoChegar };
})(window);
