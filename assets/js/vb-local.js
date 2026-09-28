/* Escolher a localização do negócio, do jeito dos apps de hoje:
   busca com sugestões enquanto digita (endereço, nome do lugar ou CEP),
   botão "usar minha localização" e mapa claro com o pino fixo no centro
   — o dono arrasta o mapa até o pino ficar em cima da porta.

   VBLocal.montar(elemento, {
     endereco, lat, lng, cidade,
     aoMudar: function ({ endereco, lat, lng }) {}  // lat/lng null enquanto
   })                                                // o ponto não foi marcado
   → { valor(), destruir() }

   Serviços gratuitos e sem chave: Photon (busca e endereço do ponto),
   ViaCEP (CEP) e mapa da CARTO sobre o OpenStreetMap. */
(function (global) {
  'use strict';

  var LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  var TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  var PHOTON = 'https://photon.komoot.io/';
  var BRASIL = '&bbox=-74.1,-33.8,-34.7,5.3';
  var PADRAO = { lat: -23.5917, lng: -48.0531 }; // Itapetininga, só até ter algo melhor

  var ICONE_BUSCA = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  var ICONE_GPS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/></svg>';
  var ICONE_PINO = '<svg viewBox="0 0 36 46" width="36" height="46" aria-hidden="true"><path d="M18 1C8.6 1 1 8.5 1 17.8 1 30 18 45 18 45s17-15 17-27.2C35 8.5 27.4 1 18 1Z" fill="currentColor" stroke="#fff" stroke-width="2"/><circle cx="18" cy="17.5" r="6" fill="#fff"/></svg>';
  var ICONE_LUGAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.4"/></svg>';

  var carregando = null;
  function carregarLeaflet() {
    if (global.L && global.L.map) return Promise.resolve(global.L);
    if (carregando) return carregando;
    carregando = new Promise(function (ok, falha) {
      if (!document.querySelector('link[href*="leaflet"]')) {
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = LEAFLET + 'leaflet.min.css';
        document.head.appendChild(css);
      }
      var s = document.createElement('script');
      s.src = LEAFLET + 'leaflet.min.js';
      s.onload = function () { ok(global.L); };
      s.onerror = function () { carregando = null; falha(new Error('mapa')); };
      document.head.appendChild(s);
    });
    return carregando;
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function json(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  // Um resultado do Photon vira { titulo, sub, endereco, lat, lng }. O
  // "endereco" segue o formato que o site mostra no rodapé:
  // "Rua, número — bairro, cidade".
  function montarEndereco(rua, numero, bairro, cidade, alternativo) {
    var linha = rua ? [rua, numero].filter(Boolean).join(', ') : (alternativo || '');
    var resto = [bairro, cidade].filter(Boolean);
    if (!linha) return resto.join(', ');
    if (bairro) return linha + ' — ' + [bairro, cidade].filter(Boolean).join(', ');
    return [linha, cidade].filter(Boolean).join(', ');
  }
  function doPhoton(f) {
    var p = f.properties || {};
    var c = (f.geometry && f.geometry.coordinates) || [];
    var ehRua = p.osm_key === 'highway';
    var rua = p.street || (ehRua ? p.name : '');
    var bairro = p.district || p.locality || '';
    var cidade = p.city || p.town || p.village || p.county || '';
    var titulo = (!ehRua && p.name && p.name !== rua) ? p.name : [rua || p.name, p.housenumber].filter(Boolean).join(', ');
    var sub = [(!ehRua && p.name && rua) ? [rua, p.housenumber].filter(Boolean).join(', ') : '', bairro, cidade, p.state]
      .filter(Boolean).join(' · ');
    return {
      titulo: titulo || cidade, sub: sub,
      endereco: montarEndereco(rua, p.housenumber, bairro, cidade, p.name),
      temNumero: !!p.housenumber, lat: c[1], lng: c[0]
    };
  }
  function buscarLugares(q, perto) {
    var url = PHOTON + 'api/?limit=7&q=' + encodeURIComponent(q) + BRASIL +
      (perto ? '&lat=' + perto.lat.toFixed(4) + '&lon=' + perto.lng.toFixed(4) : '');
    return json(url).then(function (d) {
      var vistos = {};
      return (d.features || []).filter(function (f) {
        return String((f.properties || {}).countrycode || '').toUpperCase() === 'BR';
      }).map(doPhoton).filter(function (s) {
        var chave = s.titulo + '|' + s.sub;
        if (!s.titulo || vistos[chave]) return false;
        vistos[chave] = true;
        return true;
      }).slice(0, 5);
    });
  }
  function enderecoDoPonto(lat, lng) {
    return json(PHOTON + 'reverse?limit=1&lat=' + lat + '&lon=' + lng).then(function (d) {
      var f = d.features && d.features[0];
      return f ? doPhoton(f) : null;
    });
  }
  function buscarCep(cep) {
    return json('https://viacep.com.br/ws/' + cep + '/json/').then(function (d) {
      if (!d || d.erro) return null;
      var cidade = d.localidade + (d.uf ? '/' + d.uf : '');
      return {
        titulo: d.logradouro || d.localidade, sub: [d.bairro, cidade, 'CEP ' + d.cep].filter(Boolean).join(' · '),
        endereco: montarEndereco(d.logradouro, '', d.bairro, d.localidade),
        consulta: [d.logradouro, d.bairro, d.localidade, d.uf].filter(Boolean).join(', '),
        temNumero: false, lat: null, lng: null
      };
    });
  }

  function montar(el, op) {
    op = op || {};
    var temPonto = op.lat != null && op.lng != null && op.lat !== '' && op.lng !== '';
    var pos = temPonto ? { lat: Number(op.lat), lng: Number(op.lng) } : { lat: PADRAO.lat, lng: PADRAO.lng };
    var marcado = temPonto;
    var mapa = null;
    var lista = [];
    var destaque = -1;
    var seq = 0;
    var tempoBusca = null;
    var tempoAviso = null;
    var vivo = true;

    el.innerHTML =
      '<div class="vbl">' +
        '<div class="vbl-campo">' +
          '<span class="vbl-lupa">' + ICONE_BUSCA + '</span>' +
          '<input type="text" class="vbl-input" autocomplete="off" autocapitalize="words" enterkeyhint="search" ' +
            'placeholder="Rua e número, nome do lugar ou CEP" aria-label="Endereço do estabelecimento" ' +
            'role="combobox" aria-autocomplete="list" aria-expanded="false" value="' + esc(op.endereco || '') + '">' +
          (navigator.geolocation ? '<button type="button" class="vbl-gps" aria-label="Usar minha localização" title="Usar minha localização">' + ICONE_GPS + '</button>' : '') +
        '</div>' +
        '<ul class="vbl-sugestoes" role="listbox" hidden></ul>' +
        '<div class="vbl-mapa">' +
          '<div class="vbl-mapa-leaflet"></div>' +
          '<span class="vbl-sombra" aria-hidden="true"></span>' +
          '<span class="vbl-pino">' + ICONE_PINO + '</span>' +
        '</div>' +
        '<p class="vbl-status" aria-live="polite"></p>' +
      '</div>';

    var raiz = el.querySelector('.vbl');
    var input = raiz.querySelector('.vbl-input');
    var ul = raiz.querySelector('.vbl-sugestoes');
    var gps = raiz.querySelector('.vbl-gps');
    var status = raiz.querySelector('.vbl-status');
    var caixaMapa = raiz.querySelector('.vbl-mapa');

    function dizer(texto, tipo) {
      status.textContent = texto || '';
      status.className = 'vbl-status' + (tipo ? ' vbl-' + tipo : '');
    }
    function dicaPadrao() {
      dizer(marcado ? 'Arraste o mapa se o pino não estiver em cima da porta.' : 'Busque o endereço ou arraste o mapa até o pino ficar no lugar certo.');
    }
    function valor() {
      return { endereco: input.value.trim(), lat: marcado ? pos.lat : null, lng: marcado ? pos.lng : null };
    }
    function avisar() {
      clearTimeout(tempoAviso);
      if (op.aoMudar) op.aoMudar(valor());
    }
    function avisarDepois() {
      clearTimeout(tempoAviso);
      tempoAviso = setTimeout(avisar, 500);
    }

    // ---- mapa ----
    function irPara(lat, lng, zoom) {
      pos = { lat: lat, lng: lng };
      if (mapa) mapa.flyTo([lat, lng], zoom || 18, { duration: 0.6 });
    }
    carregarLeaflet().then(function (L) {
      if (!vivo) return;
      mapa = L.map(raiz.querySelector('.vbl-mapa-leaflet'), {
        zoomControl: false, attributionControl: true,
        scrollWheelZoom: 'center', touchZoom: 'center', doubleClickZoom: 'center'
      }).setView([pos.lat, pos.lng], marcado ? 17 : 14);
      mapa.attributionControl.setPrefix(false);
      L.tileLayer(TILES, { subdomains: 'abcd', maxZoom: 20, attribution: '© OpenStreetMap · © CARTO' }).addTo(mapa);
      L.control.zoom({ position: 'bottomright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(mapa);
      // só o arrasto do dono marca o ponto; o que o código move, não
      var soltou = false;
      mapa.on('movestart', function () { caixaMapa.classList.add('movendo'); });
      mapa.on('dragstart', function () { soltou = false; fecharLista(); });
      mapa.on('dragend', function () { soltou = true; });
      mapa.on('moveend', function () {
        caixaMapa.classList.remove('movendo');
        if (!soltou) return;
        soltou = false;
        var c = mapa.getCenter();
        pos = { lat: c.lat, lng: c.lng };
        marcado = true;
        dicaPadrao();
        avisar();
      });
      setTimeout(function () { if (mapa) mapa.invalidateSize(); }, 200);
      // sem ponto salvo, começa pelo centro da cidade (sem marcar nada)
      if (!marcado && op.cidade) {
        buscarLugares(op.cidade, null).then(function (r) {
          if (!vivo || marcado || !r[0] || r[0].lat == null) return;
          pos = { lat: r[0].lat, lng: r[0].lng };
          mapa.setView([pos.lat, pos.lng], 14);
        }).catch(function () {});
      }
    }, function () {
      caixaMapa.hidden = true;
    });

    // ---- sugestões ----
    function fecharLista() {
      ul.hidden = true;
      ul.innerHTML = '';
      destaque = -1;
      input.setAttribute('aria-expanded', 'false');
    }
    function mostrarLista() {
      if (!lista.length) { fecharLista(); return; }
      ul.innerHTML = lista.map(function (s, i) {
        return '<li role="option" data-i="' + i + '"' + (i === destaque ? ' class="ativo" aria-selected="true"' : '') + '>' +
          '<span class="vbl-sug-icone">' + ICONE_LUGAR + '</span>' +
          '<span class="vbl-sug-texto"><strong>' + esc(s.titulo) + '</strong>' + (s.sub ? '<small>' + esc(s.sub) + '</small>' : '') + '</span></li>';
      }).join('');
      ul.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function numeroDigitado() {
      var m = input.value.match(/(?:,|\s)\s*(\d{1,5})\s*(?:$|[,\-–—])/);
      return m ? m[1] : '';
    }
    function escolher(s, manterTexto) {
      fecharLista();
      if (!manterTexto) {
        var endereco = s.endereco;
        // a rua achada não tem número, mas o dono já digitou um: mantém
        var num = !s.temNumero && numeroDigitado();
        if (num && endereco.indexOf(', ' + num) < 0) {
          endereco = endereco.replace(/^([^—,]+?)(\s*(?:—|,|$))/, '$1, ' + num + '$2');
        }
        input.value = endereco;
      }
      if (s.lat != null) {
        marcado = true;
        irPara(s.lat, s.lng, s.temNumero || numeroDigitado() ? 18 : 17);
        dizer('Pronto! Confira o pino e arraste o mapa se precisar.', 'ok');
        avisar();
        return;
      }
      // CEP: acha o ponto pela rua do CEP
      if (s.consulta) {
        dizer('Achando no mapa…');
        buscarLugares(s.consulta, pos).then(function (r) {
          if (!vivo) return;
          if (r[0] && r[0].lat != null) {
            marcado = true;
            irPara(r[0].lat, r[0].lng, 17);
            dizer('Agora coloque o número depois da rua e confira o pino.', 'ok');
          } else dicaPadrao();
          avisar();
        }).catch(function () { dicaPadrao(); avisar(); });
      } else avisar();
      if (!manterTexto) {
        // CEP escolhido: cursor logo depois da rua, pronto pro número
        var fimRua = input.value.indexOf(' — ');
        if (fimRua > 0) {
          input.value = input.value.slice(0, fimRua) + ', ' + input.value.slice(fimRua);
          try { input.focus(); input.setSelectionRange(fimRua + 2, fimRua + 2); } catch (e) {}
        }
      }
    }
    function buscar() {
      var q = input.value.trim();
      var meu = ++seq;
      var cep = q.replace(/\D/g, '');
      if (/^\d{5}-?\d{3}$/.test(q) && cep.length === 8) {
        buscarCep(cep).then(function (s) {
          if (meu !== seq || !vivo) return;
          lista = s ? [s] : [];
          destaque = -1;
          if (s) mostrarLista(); else { fecharLista(); dizer('Não achamos esse CEP. Confira os números.', 'erro'); }
        }).catch(function () { if (meu === seq) fecharLista(); });
        return;
      }
      if (q.length < 3) { lista = []; fecharLista(); return; }
      buscarLugares(q, pos).then(function (r) {
        if (meu !== seq || !vivo) return;
        lista = r;
        destaque = -1;
        mostrarLista();
      }).catch(function () { if (meu === seq) fecharLista(); });
    }

    input.addEventListener('input', function () {
      clearTimeout(tempoBusca);
      tempoBusca = setTimeout(buscar, 300);
      avisarDepois();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (ul.hidden || !lista.length) return;
        e.preventDefault();
        destaque = (destaque + (e.key === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length;
        mostrarLista();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!ul.hidden && lista.length) escolher(lista[Math.max(destaque, 0)]);
      } else if (e.key === 'Escape') {
        fecharLista();
      }
    });
    // pointerdown (e não click) pra escolher antes do blur fechar a lista
    ul.addEventListener('pointerdown', function (e) {
      var li = e.target.closest('li[data-i]');
      if (!li) return;
      e.preventDefault();
      escolher(lista[Number(li.getAttribute('data-i'))]);
    });
    input.addEventListener('blur', function () {
      setTimeout(function () {
        if (!vivo || document.activeElement === input) return;
        // digitou e saiu sem escolher: marca o primeiro resultado no mapa,
        // sem mexer no texto que ele escreveu
        if (!marcado && lista[0] && lista[0].lat != null && input.value.trim()) escolher(lista[0], true);
        else fecharLista();
        avisar();
      }, 150);
    });

    // ---- usar minha localização ----
    if (gps) gps.addEventListener('click', function () {
      gps.classList.add('buscando');
      gps.disabled = true;
      dizer('Pegando sua localização…');
      navigator.geolocation.getCurrentPosition(function (p) {
        if (!vivo) return;
        gps.classList.remove('buscando');
        gps.disabled = false;
        marcado = true;
        irPara(p.coords.latitude, p.coords.longitude, 18);
        dizer('Achamos você! Confira o endereço e o pino.', 'ok');
        avisar();
        enderecoDoPonto(p.coords.latitude, p.coords.longitude).then(function (s) {
          if (!vivo || !s || !s.endereco) return;
          input.value = s.endereco;
          avisar();
        }).catch(function () {});
      }, function (erro) {
        if (!vivo) return;
        gps.classList.remove('buscando');
        gps.disabled = false;
        dizer(erro && erro.code === 1
          ? 'Libere a localização pro site no navegador, ou busque o endereço.'
          : 'Não deu pra pegar sua localização agora. Busque o endereço.', 'erro');
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    });

    dicaPadrao();

    return {
      valor: valor,
      destruir: function () {
        vivo = false;
        clearTimeout(tempoBusca);
        clearTimeout(tempoAviso);
        if (mapa) { mapa.remove(); mapa = null; }
      }
    };
  }

  global.VBLocal = { montar: montar };
})(window);
