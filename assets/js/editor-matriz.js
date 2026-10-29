/* Editor da Matriz — o ÚNICO jeito de editar um site na plataforma, igual
   pra Agendar, Pedir e Chamar (e pra criação também).

   Como funciona pro dono:
   - o site fica ao vivo atrás; embaixo, uma pergunta por vez, em
     linguagem de gente ("Qual foto mostra melhor o seu negócio?");
   - cada resposta salva sozinha (sem botão "Salvar") e já aparece no site;
   - as perguntas vêm em capítulos (Primeira impressão, O que você
     oferece, Como funciona, Onde te achar, Sobre o seu negócio…);
   - o "Mapa" mostra todos os capítulos com o que já está pronto (✓) e o
     que falta, e a porcentagem do perfil completo — dá pra pular pra
     qualquer pergunta;
   - "Ver o site" recolhe o editor numa pílula, pra olhar o resultado.

   Quem usa monta a lista de passos (perfil.js pra Agenda, editar-loja.js
   pra Pedir/Chamar) — cada tipo de negócio com as suas perguntas:

     var ed = VBEditor.abrir({
       modo: 'editar' | 'criar',
       passos: [{ id, capitulo, pergunta, ajuda, render(caixa, ctx), completo(), obrigatorio, aviso }],
       inicial: 'foto',              // id do passo pra começar (opcional)
       contagem: { desde: 0, total }, // criação que continua de outra tela
       rotuloConcluir: 'Concluir',
       aoTrocar: function () {},      // antes de sair de um passo
       aoConcluir: function () {}
     });
     ed.atualizar()   // redesenha o passo atual (depois de salvar algo)
     ed.estado()      // reavalia "completo" (libera o Próximo, % do mapa)
     ed.salvo(texto, erro)  // selo "Salvo ✓" / mensagem de erro
     ed.ir(idOuIndice)

   O ctx de cada render tem: atualizar, estado, salvo, proximo. Visual em
   assets/css/editor-matriz.css. */
(function (global) {
  'use strict';

  var CAPITULOS = {
    impressao: 'Primeira impressão',
    oferta: 'O que você oferece',
    funciona: 'Como funciona',
    achar: 'Onde te achar',
    sobre: 'Sobre o seu negócio'
  };

  var ICONES = {
    mapa: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    olho: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    fechar: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    seta: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var atual = null; // um editor por página

  function abrir(cfg) {
    if (atual) atual.fechar();
    var passos = (cfg.passos || []).filter(Boolean);
    if (!passos.length) return null;
    var criar = cfg.modo === 'criar';
    var idx = 0;
    passos.forEach(function (p, i) { if (p.id === cfg.inicial) idx = i; });
    var desde = (cfg.contagem && cfg.contagem.desde) || 0;
    var total = (cfg.contagem && cfg.contagem.total) || (desde + passos.length);
    var seloTimer = null;

    var raiz = document.createElement('div');
    raiz.className = 'vbe' + (criar ? ' vbe-criar' : '');
    raiz.setAttribute('role', 'dialog');
    raiz.setAttribute('aria-label', criar ? 'Criando seu site' : 'Editando seu site');
    raiz.innerHTML =
      '<div class="vbe-dock">' +
        '<div class="vbe-topo">' +
          '<button type="button" class="vbe-anel" data-vbe-mapa aria-label="Ver todas as perguntas">' +
            '<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="vbe-anel-fundo" cx="18" cy="18" r="15.5"/><circle class="vbe-anel-valor" cx="18" cy="18" r="15.5"/></svg>' +
            '<span class="vbe-anel-num" data-vbe-pct>0</span></button>' +
          '<div class="vbe-onde"><span class="vbe-capitulo" data-vbe-capitulo></span><span class="vbe-contador" data-vbe-contador></span></div>' +
          '<span class="vbe-selo" data-vbe-selo aria-live="polite"></span>' +
          '<button type="button" class="vbe-ic" data-vbe-mapa title="Todas as perguntas" aria-label="Todas as perguntas">' + ICONES.mapa + '</button>' +
          '<button type="button" class="vbe-ic" data-vbe-recolher title="Ver o site" aria-label="Ver o site">' + ICONES.olho + '</button>' +
          (criar ? '' : '<button type="button" class="vbe-ic" data-vbe-sair title="Sair da edição" aria-label="Sair da edição">' + ICONES.fechar + '</button>') +
        '</div>' +
        '<div class="vbe-barras" data-vbe-barras></div>' +
        '<div class="vbe-palco" data-vbe-palco>' +
          '<h3 class="vbe-pergunta" data-vbe-pergunta></h3>' +
          '<p class="vbe-ajuda" data-vbe-ajuda></p>' +
          '<div class="vbe-campos" data-vbe-campos></div>' +
        '</div>' +
        '<p class="vbe-aviso oculto" data-vbe-aviso></p>' +
        '<div class="vbe-acoes">' +
          '<button type="button" class="vbe-voltar" data-vbe-voltar>Voltar</button>' +
          '<button type="button" class="vbe-proximo" data-vbe-proximo><span data-vbe-proximo-txt>Próximo</span>' + ICONES.seta + '</button>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="vbe-pilula" data-vbe-expandir>' + ICONES.olho + '<span>Continuar editando</span></button>' +
      '<div class="vbe-mapa oculto" data-vbe-mapa-tela role="dialog" aria-label="Todas as perguntas">' +
        '<div class="vbe-mapa-caixa">' +
          '<div class="vbe-mapa-topo"><div><p class="vbe-mapa-rotulo">Seu site</p><p class="vbe-mapa-titulo" data-vbe-mapa-titulo></p></div>' +
          '<button type="button" class="vbe-ic" data-vbe-mapa-fechar aria-label="Fechar">' + ICONES.fechar + '</button></div>' +
          '<div class="vbe-mapa-lista" data-vbe-mapa-lista></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(raiz);
    document.body.classList.add('vbe-aberto');
    var $ = function (sel) { return raiz.querySelector(sel); };

    function completo(p) { try { return !!(p.completo && p.completo()); } catch (e) { return false; } }
    function porcentagem() {
      var contam = passos.filter(function (p) { return p.completo; });
      if (!contam.length) return 0;
      return Math.round(contam.filter(completo).length / contam.length * 100);
    }

    function estado() {
      var p = passos[idx];
      var ok = !p.obrigatorio || completo(p);
      var btn = $('[data-vbe-proximo]');
      btn.disabled = !ok;
      var aviso = $('[data-vbe-aviso]');
      aviso.textContent = ok ? '' : (p.aviso || 'Responda essa pra continuar.');
      aviso.classList.toggle('oculto', ok);
      var pct = porcentagem();
      $('[data-vbe-pct]').textContent = pct;
      $('.vbe-anel-valor').style.strokeDashoffset = String(97.4 - 97.4 * pct / 100);
      raiz.querySelectorAll('[data-vbe-barras] i').forEach(function (b, i) {
        var p2 = passos[i - desde];
        b.classList.toggle('feito', i < desde || (p2 && completo(p2)));
      });
      if (!$('[data-vbe-mapa-tela]').classList.contains('oculto')) desenharMapa();
    }

    function desenhar(direcao) {
      var p = passos[idx];
      var palco = $('[data-vbe-palco]');
      palco.classList.remove('vbe-entra-dir', 'vbe-entra-esq');
      void palco.offsetWidth;
      if (direcao) palco.classList.add(direcao > 0 ? 'vbe-entra-dir' : 'vbe-entra-esq');
      $('[data-vbe-capitulo]').textContent = CAPITULOS[p.capitulo] || p.capitulo || (criar ? 'Criando seu site' : 'Editando');
      $('[data-vbe-contador]').textContent = (desde + idx + 1) + ' de ' + total;
      $('[data-vbe-pergunta]').textContent = p.pergunta || p.titulo || '';
      var ajuda = $('[data-vbe-ajuda]');
      ajuda.textContent = p.ajuda || p.texto || '';
      ajuda.classList.toggle('oculto', !(p.ajuda || p.texto));
      $('[data-vbe-voltar]').classList.toggle('vbe-invisivel', idx === 0);
      $('[data-vbe-proximo-txt]').textContent = idx === passos.length - 1 ? (cfg.rotuloConcluir || (criar ? 'Pronto, ver meu site' : 'Concluir')) : 'Próximo';
      var barras = '';
      for (var b = 0; b < total; b++) barras += '<i' + (b === desde + idx ? ' class="agora"' : '') + '></i>';
      $('[data-vbe-barras]').innerHTML = barras;
      var campos = $('[data-vbe-campos]');
      campos.innerHTML = '';
      if (p.render) p.render(campos, ctx);
      $('[data-vbe-campos]').scrollTop = 0;
      estado();
    }

    function ir(alvo, direcao) {
      var novo = typeof alvo === 'number' ? alvo : passos.findIndex(function (p) { return p.id === alvo; });
      if (novo < 0 || novo >= passos.length) return;
      if (cfg.aoTrocar) cfg.aoTrocar(passos[idx]);
      var dir = direcao != null ? direcao : (novo > idx ? 1 : novo < idx ? -1 : 0);
      idx = novo;
      fecharMapa();
      desenhar(dir);
      try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])passo=[^&]*/, '$1passo=' + encodeURIComponent(passos[idx].id)) + location.hash); } catch (e) {}
    }

    function salvo(texto, erro) {
      var s = $('[data-vbe-selo]');
      s.textContent = texto || 'Salvo';
      s.className = 'vbe-selo vbe-selo-on' + (erro ? ' vbe-selo-erro' : '');
      clearTimeout(seloTimer);
      if (!erro && texto !== 'Salvando…') seloTimer = setTimeout(function () { s.className = 'vbe-selo'; }, 1800);
      estado();
    }

    /* ---------- mapa ---------- */
    function desenharMapa() {
      $('[data-vbe-mapa-titulo]').textContent = porcentagem() + '% completo';
      var porCap = [], vistos = {};
      passos.forEach(function (p, i) {
        var c = p.capitulo || 'outros';
        if (!vistos[c]) { vistos[c] = { nome: CAPITULOS[c] || c, itens: [] }; porCap.push(vistos[c]); }
        vistos[c].itens.push({ p: p, i: i });
      });
      $('[data-vbe-mapa-lista]').innerHTML = porCap.map(function (cap) {
        return '<section class="vbe-mapa-cap"><p class="vbe-mapa-cap-nome">' + esc(cap.nome) + '</p>' +
          cap.itens.map(function (it) {
            var ok = completo(it.p);
            return '<button type="button" class="vbe-mapa-item' + (it.i === idx ? ' agora' : '') + (ok ? ' feito' : '') + '" data-vbe-ir="' + it.i + '">' +
              '<span class="vbe-mapa-marca">' + (ok ? ICONES.check : '') + '</span>' +
              '<span class="vbe-mapa-txt">' + esc(it.p.titulo || it.p.pergunta) + '</span>' +
              '<span class="vbe-mapa-acao">' + (ok ? 'Mudar' : it.p.completo ? 'Responder' : 'Abrir') + '</span></button>';
          }).join('') + '</section>';
      }).join('');
    }
    function abrirMapa() { desenharMapa(); $('[data-vbe-mapa-tela]').classList.remove('oculto'); }
    function fecharMapa() { $('[data-vbe-mapa-tela]').classList.add('oculto'); }

    /* ---------- eventos ---------- */
    raiz.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-vbe-mapa]')) { abrirMapa(); return; }
      if (t.closest('[data-vbe-mapa-fechar]') || t === $('[data-vbe-mapa-tela]')) { fecharMapa(); return; }
      var irPara = t.closest('[data-vbe-ir]');
      if (irPara) { ir(Number(irPara.getAttribute('data-vbe-ir'))); return; }
      if (t.closest('[data-vbe-recolher]')) { raiz.classList.add('vbe-recolhido'); return; }
      if (t.closest('[data-vbe-expandir]')) { raiz.classList.remove('vbe-recolhido'); return; }
      if (t.closest('[data-vbe-sair]')) { concluir(); return; }
      if (t.closest('[data-vbe-voltar]')) { if (idx > 0) ir(idx - 1, -1); return; }
      if (t.closest('[data-vbe-proximo]')) {
        var b = $('[data-vbe-proximo]');
        if (b.disabled) return;
        if (idx >= passos.length - 1) { concluir(); return; }
        ir(idx + 1, 1);
      }
    });
    raiz.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('[data-vbe-mapa-tela]').classList.contains('oculto')) fecharMapa();
    });

    function concluir() {
      if (cfg.aoTrocar) cfg.aoTrocar(passos[idx]);
      if (cfg.aoConcluir) cfg.aoConcluir();
    }
    function fechar() {
      raiz.remove();
      document.body.classList.remove('vbe-aberto');
      if (atual === api) atual = null;
    }

    var ctx = {
      atualizar: function () { desenhar(0); },
      estado: estado,
      salvo: salvo,
      proximo: function () { if (idx < passos.length - 1) ir(idx + 1, 1); }
    };
    var api = {
      atualizar: ctx.atualizar, estado: estado, salvo: salvo, ir: ir, fechar: fechar,
      indice: function () { return idx; }, passoAtual: function () { return passos[idx]; }
    };
    atual = api;
    desenhar(0);
    return api;
  }

  global.VBEditor = { abrir: abrir, CAPITULOS: CAPITULOS, atual: function () { return atual; } };
})(window);
