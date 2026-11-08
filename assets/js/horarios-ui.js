/* Editor de horários de funcionamento — um só componente para a Agenda e para o
   Delivery. Antes eram sete linhas de "relógio do navegador" (o seletor feio de
   horas), sem resumo, sem turnos e sem atalhos.

     VBHorarios.montar(caixa, {
       valor:     { "1": [["08:00","18:00"]], "2": [["11:00","14:00"],["18:00","23:00"]], … },
       multiplos: true,            // permite 2–3 turnos no dia (almoço + jantar). Agenda: false
       aoMudar:   function (valor, mudouDias) { … }   // chamado ~0,4 s depois da última mudança
     }) → { valor(), definir(v) }

   O formato do valor é o mesmo do Delivery (estabelecimento.horarios): dia 0 = domingo
   … 6 = sábado; dia fechado = sem chave. Fechar às 00:00 (ou antes da abertura) quer
   dizer "vira a noite"; o banco já entende isso. */
(function (global) {
  'use strict';

  var ORDEM = [1, 2, 3, 4, 5, 6, 0];
  var NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var PASSO = 30;             // minutos por toque nos botões − e +
  var MAX_TURNOS = 3;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function min(h) { var p = String(h || '').split(':'); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); }
  function hh(m) { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function copiar(v) { return JSON.parse(JSON.stringify(v || {})); }
  function limpar(v) {
    var r = {};
    Object.keys(v || {}).forEach(function (d) {
      var l = (v[d] || []).filter(function (t) { return t && t[0] && t[1]; }).map(function (t) { return [String(t[0]).slice(0, 5), String(t[1]).slice(0, 5)]; });
      if (l.length) r[d] = l;
    });
    return r;
  }
  // "bonito": 18:00 → 18h, 18:30 → 18h30, 00:00 → meia-noite
  function bonita(h) {
    if (h === '00:00') return 'meia-noite';
    var p = h.split(':'); return Number(p[0]) + 'h' + (p[1] === '00' ? '' : p[1]);
  }
  function faixaTexto(t) { return bonita(t[0]) + ' às ' + bonita(t[1]); }
  function turnosTexto(l) { return l.map(faixaTexto).join(' e '); }
  function invalido(t) { return t[0] === t[1]; }

  // "Seg a Qui · 18h às 23h" — dias seguidos com o mesmo horário viram uma frase só
  function resumo(v) {
    var grupos = [], ult = null;
    ORDEM.forEach(function (d) {
      var l = v[d], chave = l ? JSON.stringify(l) : '';
      if (ult && ult.chave === chave) ult.dias.push(d);
      else { ult = { chave: chave, dias: [d], l: l }; grupos.push(ult); }
    });
    var abertos = grupos.filter(function (g) { return g.l; });
    if (!abertos.length) return 'Nenhum dia aberto ainda.';
    return abertos.map(function (g) {
      var a = g.dias[0], b = g.dias[g.dias.length - 1];
      var dias = g.dias.length === 1 ? NOME[a] : g.dias.length === 2 ? CURTO[a] + ' e ' + CURTO[b] : CURTO[a] + ' a ' + CURTO[b];
      return dias + ': ' + turnosTexto(g.l);
    }).join(' · ');
  }

  // aberto agora? (usa o relógio do aparelho)
  function situacao(v) {
    var agora = new Date(), d = agora.getDay(), m = agora.getHours() * 60 + agora.getMinutes();
    var ontem = (d + 6) % 7;
    var l = v[d] || [], i, a, f;
    for (i = 0; i < l.length; i++) {
      a = min(l[i][0]); f = min(l[i][1]);
      if (f > a ? (m >= a && m < f) : m >= a) return { aberto: true, texto: 'Aberto agora · fecha ' + (f > a || l[i][1] === '00:00' ? 'às ' : 'às ') + bonita(l[i][1]) };
    }
    var lo = v[ontem] || [];
    for (i = 0; i < lo.length; i++) { a = min(lo[i][0]); f = min(lo[i][1]); if (f <= a && m < f) return { aberto: true, texto: 'Aberto agora · fecha às ' + bonita(lo[i][1]) }; }
    for (i = 0; i < l.length; i++) if (min(l[i][0]) > m) return { aberto: false, texto: 'Fechado agora · abre hoje às ' + bonita(l[i][0]) };
    for (var k = 1; k <= 7; k++) {
      var dd = (d + k) % 7, ll = v[dd];
      if (ll && ll.length) return { aberto: false, texto: 'Fechado agora · abre ' + (k === 1 ? 'amanhã' : NOME[dd].toLowerCase()) + ' às ' + bonita(ll[0][0]) };
    }
    return { aberto: false, texto: 'Fechado — marque os dias que você atende' };
  }

  function montar(caixa, opc) {
    opc = opc || {};
    var multiplos = opc.multiplos !== false;
    var v = limpar(opc.valor);
    var aberto = null;            // dia com o editor aberto (um por vez)
    var timer = null, mudouDias = {};

    var ICONE_REL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

    function hora(dia, ti, qual, valorH) {
      return '<div class="vbh2-hora"><span class="vbh2-rot">' + (qual === 0 ? 'Abre' : 'Fecha') + '</span>' +
        '<div class="vbh2-passo">' +
          '<button type="button" class="vbh2-mm" data-ajusta="-1" data-dia="' + dia + '" data-t="' + ti + '" data-q="' + qual + '" aria-label="Menos meia hora">−</button>' +
          '<label class="vbh2-valor"><span>' + esc(valorH) + '</span><input type="time" step="300" value="' + esc(valorH) + '" data-digita data-dia="' + dia + '" data-t="' + ti + '" data-q="' + qual + '" aria-label="' + (qual === 0 ? 'Abre às' : 'Fecha às') + '"></label>' +
          '<button type="button" class="vbh2-mm" data-ajusta="1" data-dia="' + dia + '" data-t="' + ti + '" data-q="' + qual + '" aria-label="Mais meia hora">+</button>' +
        '</div></div>';
    }

    function cartao(d) {
      var l = v[d], on = !!(l && l.length), abertoAqui = on && aberto === d;
      var ruim = on && l.some(invalido);
      var h = '<div class="vbh2-dia' + (on ? ' on' : '') + (abertoAqui ? ' aberto' : '') + (ruim ? ' ruim' : '') + '" data-dia="' + d + '">' +
        '<div class="vbh2-topo">' +
          '<label class="vbh2-chave"><input type="checkbox" data-liga data-dia="' + d + '"' + (on ? ' checked' : '') + ' aria-label="' + NOME[d] + ' aberto"><i></i></label>' +
          '<button type="button" class="vbh2-nome" data-abre-dia="' + d + '"' + (on ? '' : ' tabindex="-1"') + '>' +
            '<b>' + NOME[d] + '</b>' +
            '<span>' + (on ? esc(ruim ? 'Abre e fecha na mesma hora — ajuste' : turnosTexto(l)) : 'Fechado') + '</span>' +
          '</button>' +
          (on ? '<button type="button" class="vbh2-seta" data-abre-dia="' + d + '" aria-label="' + (abertoAqui ? 'Fechar' : 'Ajustar') + ' ' + NOME[d] + '"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>' : '') +
        '</div>';
      if (abertoAqui) {
        h += '<div class="vbh2-corpo">';
        l.forEach(function (t, ti) {
          h += '<div class="vbh2-turno">' +
            (l.length > 1 ? '<div class="vbh2-turno-topo"><b>Turno ' + (ti + 1) + '</b><button type="button" class="vbh2-x" data-tira-turno data-dia="' + d + '" data-t="' + ti + '" aria-label="Tirar este turno">Tirar</button></div>' : '') +
            '<div class="vbh2-par">' + hora(d, ti, 0, t[0]) + hora(d, ti, 1, t[1]) + '</div>' +
            (min(t[1]) <= min(t[0]) && !invalido(t) ? '<p class="vbh2-nota">' + (t[1] === '00:00' ? 'Fecha à meia-noite.' : 'Fecha de madrugada, já no dia seguinte.') + '</p>' : '') +
          '</div>';
        });
        h += '<div class="vbh2-acoes">' +
          (multiplos && l.length < MAX_TURNOS ? '<button type="button" class="vbh2-link" data-turno data-dia="' + d + '">+ Outro turno <small>(ex.: almoço e jantar)</small></button>' : '') +
          '<button type="button" class="vbh2-link" data-todos data-dia="' + d + '">Copiar para todos os dias abertos</button>' +
        '</div></div>';
      }
      return h + '</div>';
    }

    function desenhar() {
      var s = situacao(v), r = resumo(v);
      var scroll = caixa.querySelector('.vbh2-dias') ? caixa.querySelector('.vbh2-dias').scrollTop : 0;
      caixa.innerHTML =
        '<div class="vbh2">' +
          '<div class="vbh2-cab ' + (s.aberto ? 'aberto' : 'fechado') + '">' +
            '<span class="vbh2-ico">' + ICONE_REL + '</span>' +
            '<div><b>' + esc(s.texto) + '</b><p>' + esc(r) + '</p></div>' +
          '</div>' +
          '<div class="vbh2-presets" role="group" aria-label="Atalhos">' +
            '<span>Atalhos</span>' +
            '<button type="button" data-preset="seg-sex">Seg a Sex</button>' +
            '<button type="button" data-preset="seg-sab">Seg a Sáb</button>' +
            '<button type="button" data-preset="todos">Todos os dias</button>' +
            '<button type="button" data-preset="fds">Fim de semana</button>' +
          '</div>' +
          '<div class="vbh2-dias">' + ORDEM.map(cartao).join('') + '</div>' +
          '<p class="vbh2-dica">Toque num dia para ajustar o horário. Dá pra tocar na hora e digitar.</p>' +
        '</div>';
      var nova = caixa.querySelector('.vbh2-dias'); if (nova && scroll) nova.scrollTop = scroll;
    }

    function avisar(dias) {
      (dias || []).forEach(function (d) { mudouDias[d] = true; });
      clearTimeout(timer);
      timer = setTimeout(function () {
        var m = Object.keys(mudouDias).map(Number); mudouDias = {};
        // horário igual (abre = fecha) não é horário: não salva até a pessoa acertar
        var semErro = copiar(v); Object.keys(semErro).forEach(function (d) { if (semErro[d].some(invalido)) delete semErro[d]; });
        if (opc.aoMudar) opc.aoMudar(limpar(semErro), m);
      }, 400);
    }

    function turnoPadrao(d) {
      // sugere um horário que faça sentido: almoço se o turno atual é à noite, noite se é de dia
      var l = v[d] || [], ult = l[l.length - 1];
      if (!ult) return ['08:00', '18:00'];
      var a0 = min(ult[0]), f0 = min(ult[1]);
      if (f0 <= a0 || f0 >= 21 * 60) return a0 >= 15 * 60 ? ['11:00', '14:00'] : ['18:00', '23:00'];
      var a = Math.min(f0 + 120, 22 * 60), f = Math.min(a + 180, 23 * 60 + 30);
      return [hh(a), hh(f)];
    }

    function aplicarPreset(nome) {
      var base = null; ORDEM.forEach(function (d) { if (!base && v[d] && v[d].length) base = copiar(v[d]); });
      base = base || [['08:00', '18:00']];
      var dias = { 'seg-sex': [1, 2, 3, 4, 5], 'seg-sab': [1, 2, 3, 4, 5, 6], 'todos': [0, 1, 2, 3, 4, 5, 6], 'fds': [6, 0] }[nome] || [];
      var nv = {}; dias.forEach(function (d) { nv[d] = (v[d] && v[d].length) ? v[d] : copiar(base); });
      var tocados = ORDEM.filter(function (d) { return !!v[d] !== !!nv[d]; });
      v = nv; aberto = null; desenhar(); avisar(tocados);
    }

    caixa.addEventListener('click', function (e) {
      var el;
      if ((el = e.target.closest('[data-abre-dia]'))) {
        var d = Number(el.getAttribute('data-abre-dia'));
        if (!v[d]) return;
        aberto = aberto === d ? null : d; desenhar(); return;
      }
      if ((el = e.target.closest('[data-ajusta]'))) {
        var dia = Number(el.getAttribute('data-dia')), t = Number(el.getAttribute('data-t')), q = Number(el.getAttribute('data-q'));
        var passo = Number(el.getAttribute('data-ajusta')) * PASSO;
        var atual = min(v[dia][t][q]);
        // com o relógio num horário "quebrado" (18:10), o primeiro toque vai pro meio-hora mais próximo
        var alvo = passo > 0 ? Math.floor(atual / PASSO) * PASSO + PASSO : Math.ceil(atual / PASSO) * PASSO - PASSO;
        v[dia][t][q] = hh(alvo); desenhar(); avisar([dia]); return;
      }
      if ((el = e.target.closest('[data-turno]'))) {
        var d2 = Number(el.getAttribute('data-dia'));
        if (v[d2] && v[d2].length < MAX_TURNOS) { v[d2].push(turnoPadrao(d2)); v[d2].sort(function (x, y) { return min(x[0]) - min(y[0]); }); desenhar(); avisar([d2]); }
        return;
      }
      if ((el = e.target.closest('[data-tira-turno]'))) {
        var d3 = Number(el.getAttribute('data-dia')), t3 = Number(el.getAttribute('data-t'));
        if (v[d3] && v[d3].length > 1) { v[d3].splice(t3, 1); desenhar(); avisar([d3]); }
        return;
      }
      if ((el = e.target.closest('[data-todos]'))) {
        var d4 = Number(el.getAttribute('data-dia')), modelo = copiar(v[d4]), tocados = [];
        ORDEM.forEach(function (x) { if (x !== d4 && v[x] && v[x].length) { v[x] = copiar(modelo); tocados.push(x); } });
        desenhar(); avisar(tocados); return;
      }
      if ((el = e.target.closest('[data-preset]'))) { aplicarPreset(el.getAttribute('data-preset')); }
    });

    caixa.addEventListener('change', function (e) {
      var el = e.target;
      if (el.matches('[data-liga]')) {
        var d = Number(el.getAttribute('data-dia'));
        if (el.checked) {
          // abre o dia com o horário do primeiro dia aberto (ou 08–18)
          var base = null; ORDEM.forEach(function (x) { if (!base && v[x] && v[x].length) base = v[x]; });
          v[d] = copiar(base || [['08:00', '18:00']]); aberto = d;
        } else { delete v[d]; if (aberto === d) aberto = null; }
        desenhar(); avisar([d]); return;
      }
      if (el.matches('[data-digita]')) {
        var dia = Number(el.getAttribute('data-dia')), t = Number(el.getAttribute('data-t')), q = Number(el.getAttribute('data-q'));
        if (el.value && v[dia] && v[dia][t]) { v[dia][t][q] = el.value.slice(0, 5); desenhar(); avisar([dia]); }
      }
    });

    desenhar();
    var relogio = setInterval(function () { if (!document.body.contains(caixa)) { clearInterval(relogio); return; } var c = caixa.querySelector('.vbh2-cab'); if (c) { var s = situacao(v); c.className = 'vbh2-cab ' + (s.aberto ? 'aberto' : 'fechado'); c.querySelector('b').textContent = s.texto; } }, 30000);

    return {
      valor: function () { return limpar(v); },
      definir: function (novo) { v = limpar(novo); desenhar(); }
    };
  }

  global.VBHorarios = { montar: montar, resumo: function (v) { return resumo(limpar(v)); }, situacao: function (v) { return situacao(limpar(v)); } };
})(window);
