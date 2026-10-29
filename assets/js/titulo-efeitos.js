/* Efeitos do título do site: movimento, fonte e estilo escolhidos pelo
   dono no passo a passo de edição (Agenda e Pedir/Chamar). O desenho é CSS
   (assets/css/titulo-efeitos.css) — aqui só monta as peças que o efeito
   precisa (letras/palavras soltas, faixas duplicadas), liga as classes e,
   nos efeitos "ao rolar", passa o quanto a página já rolou (--te-p, 0 a 1).

   Gravado em estabelecimentos.titulo_efeito:
     { movimento, fonte, estilo,
       alvo: 'nome' | 'frase' | 'ambos'   (onde o efeito vale; padrão: nome)
       foco: '50 30' }                     (ponto da foto do topo, em %)
   (supabase/sql/2026-10-titulo-efeito-v2.sql) */
(function (global) {
  'use strict';

  var MOVIMENTOS = [
    { titulo: 'Entrada e brilho', lista: [
      { chave: '', nome: 'Parado' },
      { chave: 'surgir', nome: 'Surgir' },
      { chave: 'digitar', nome: 'Digitando' },
      { chave: 'onda', nome: 'Onda' },
      { chave: 'brilho', nome: 'Brilho' },
      { chave: 'pulsar', nome: 'Pulsar' }
    ] },
    { titulo: 'Horizontal ↔', lista: [
      { chave: 'faixa', nome: 'Faixa ←' },
      { chave: 'faixa-direita', nome: 'Faixa →' },
      { chave: 'vaivem', nome: 'Vai e volta' },
      { chave: 'dupla', nome: 'Faixa dupla' },
      { chave: 'rolar-h', nome: 'Desliza ao rolar' }
    ] },
    { titulo: 'Vertical ↕', lista: [
      { chave: 'girar', nome: 'Subindo' },
      { chave: 'roleta', nome: 'Roleta' },
      { chave: 'cascata', nome: 'Cascata' },
      { chave: 'rolar-v', nome: 'Espalha ao rolar' }
    ] }
  ];
  var OPCOES = {
    alvo: [
      { chave: '', nome: 'Nome do negócio' },
      { chave: 'frase', nome: 'Frase' },
      { chave: 'ambos', nome: 'Os dois' }
    ],
    movimento: MOVIMENTOS.reduce(function (a, g) { return a.concat(g.lista); }, []),
    fonte: [
      { chave: '', nome: 'Do estilo' },
      { chave: 'classica', nome: 'Clássica' },
      { chave: 'elegante', nome: 'Elegante' },
      { chave: 'moderna', nome: 'Moderna' },
      { chave: 'impacto', nome: 'Impacto' },
      { chave: 'manuscrita', nome: 'Manuscrita' }
    ],
    estilo: [
      { chave: '', nome: 'Normal' },
      { chave: 'degrade', nome: 'Degradê' },
      { chave: 'contorno', nome: 'Contorno' },
      { chave: 'neon', nome: 'Neon' },
      { chave: 'sombra', nome: 'Sombra 3D' },
      { chave: 'caixa', nome: 'Caixa alta' }
    ]
  };

  var fonteCarregada = false;
  function carregarFonteManuscrita() {
    if (fonteCarregada) return;
    fonteCarregada = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap';
    document.head.appendChild(l);
  }

  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // texto → palavras (porPalavra) ou letras; cada letra recebe --i e, pros
  // efeitos que espalham, um deslocamento "sorteado" fixo (--te-d, --te-r)
  function pedacos(texto, porPalavra, letra) {
    var i = 0;
    return texto.split(/(\s+)/).map(function (parte) {
      if (/^\s+$/.test(parte)) return parte;
      if (porPalavra) return '<span class="te-p" style="--i:' + (i++) + '">' + esc(parte) + '</span>';
      // letras de uma palavra ficam juntas (não quebram no meio)
      return '<span class="te-palavra">' + Array.prototype.map.call(parte, function (c) {
        var n = i++;
        var estilo = '--i:' + n + ';--te-d:' + (0.25 + ((n * 53) % 10) / 10).toFixed(2) + ';--te-r:' + (((n * 29) % 21) - 10);
        return '<span class="te-l" style="' + estilo + '">' + (letra ? letra(c) : esc(c)) + '</span>';
      }).join('') + '</span>';
    }).join('');
  }
  function trilho(texto) {
    return '<span class="te-trilho"><span>' + esc(texto) + '</span><span aria-hidden="true">' + esc(texto) + '</span></span>';
  }

  /* ---- efeitos que dependem da rolagem (rolar-h, rolar-v) e do tamanho (vaivem) ---- */
  var rolando = [], medindo = [], ligado = false, quadro = 0;
  function progresso(el) {
    var r = el.getBoundingClientRect();
    var curso = Math.max(1, r.top + global.scrollY + r.height); // rola até o título sair por cima
    return Math.min(1, Math.max(0, global.scrollY / curso));
  }
  function atualizar() {
    quadro = 0;
    rolando = rolando.filter(function (el) { return el.isConnected && /te-m-rolar/.test(el.className); });
    rolando.forEach(function (el) { el.style.setProperty('--te-p', progresso(el).toFixed(4)); });
  }
  function medir() {
    medindo = medindo.filter(function (el) { return el.isConnected && /te-m-vaivem/.test(el.className); });
    medindo.forEach(function (el) {
      var dentro = el.querySelector('.te-vai');
      if (!dentro) return;
      // não cabe: anda o que sobra pra mostrar o fim; cabe: sai deslizando
      // pela direita e volta pro lugar
      var sobra = el.clientWidth - dentro.scrollWidth;
      var dist = (sobra < 0 ? sobra : el.clientWidth + 20) + 'px';
      if (el.style.getPropertyValue('--te-dist') === dist) return;
      el.style.setProperty('--te-dist', dist);
      // a animação já rodando guarda a distância antiga: recomeça com a nova
      dentro.style.animation = 'none';
      void dentro.offsetWidth;
      dentro.style.animation = '';
    });
  }
  function ligar() {
    if (ligado) return;
    ligado = true;
    global.addEventListener('scroll', function () { if (!quadro) quadro = requestAnimationFrame(atualizar); }, { passive: true });
    global.addEventListener('resize', function () { medir(); atualizar(); });
  }

  // aplica no elemento; texto = o texto puro (o elemento é refeito)
  function aplicar(el, cfg, texto) {
    if (!el) return;
    cfg = cfg || {};
    if (texto == null) texto = el.getAttribute('data-te-texto') != null ? el.getAttribute('data-te-texto') : el.textContent;
    el.setAttribute('data-te-texto', texto);
    el.className = el.className.split(/\s+/).filter(function (c) { return c && c !== 'te' && c.indexOf('te-') !== 0; }).join(' ');
    ['--te-altura', '--te-p', '--te-dist'].forEach(function (v) { el.style.removeProperty(v); });
    el.removeAttribute('aria-label');
    var m = cfg.movimento || '', f = cfg.fonte || '', s = cfg.estilo || '';
    if (f === 'manuscrita') carregarFonteManuscrita();
    if (m === 'surgir') el.innerHTML = pedacos(texto, true);
    else if (m === 'digitar' || m === 'onda' || m === 'cascata' || m === 'rolar-v') el.innerHTML = pedacos(texto, false);
    else if (m === 'roleta') el.innerHTML = pedacos(texto, false, function (c) { return '<span class="te-slot"><span>' + esc(c) + '</span><span aria-hidden="true">' + esc(c) + '</span></span>'; });
    else if (m === 'faixa' || m === 'faixa-direita' || m === 'rolar-h') el.innerHTML = trilho(texto);
    else if (m === 'dupla') el.innerHTML = '<span class="te-linha">' + trilho(texto) + '</span><span class="te-linha te-linha-2" aria-hidden="true">' + trilho(texto) + '</span>';
    else if (m === 'vaivem') el.innerHTML = '<span class="te-vai">' + esc(texto) + '</span>';
    else if (m === 'girar') el.innerHTML = '<span class="te-janela">' + trilho(texto) + '</span>';
    else el.textContent = texto;
    // letras soltas e cópias: o leitor de tela lê o texto inteiro uma vez só
    if (m && m !== 'brilho' && m !== 'pulsar') el.setAttribute('aria-label', texto);
    if (m) el.classList.add('te-m-' + m);
    if (f) el.classList.add('te-f-' + f);
    if (s) el.classList.add('te-s-' + s);
    if (m || f || s) el.classList.add('te');
    if (m === 'girar') {
      // a janela mostra o tamanho de um título; o trilho sobe e repete
      var copia = el.querySelector('.te-trilho > span');
      requestAnimationFrame(function () { el.style.setProperty('--te-altura', copia.offsetHeight + 'px'); });
    }
    if (m === 'rolar-h' || m === 'rolar-v') {
      ligar();
      if (rolando.indexOf(el) === -1) rolando.push(el);
      el.style.setProperty('--te-p', progresso(el).toFixed(4));
    }
    if (m === 'vaivem') {
      ligar();
      if (medindo.indexOf(el) === -1) medindo.push(el);
      requestAnimationFrame(medir);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    }
  }

  // ponto de foco da foto: '50 30' → background-position 50% 30%
  function aplicarFoco(el, foco) {
    if (!el) return;
    var m = /^(\d{1,3}) (\d{1,3})$/.exec(foco || '');
    el.style.backgroundPosition = m ? m[1] + '% ' + m[2] + '%' : '';
  }

  // o topo inteiro: nome do negócio, frase e foto
  function aplicarTopo(alvos, cfg, textos) {
    cfg = cfg || {};
    textos = textos || {};
    var alvo = cfg.alvo || 'nome';
    if (alvos.nome) aplicar(alvos.nome, alvo === 'frase' ? {} : cfg, textos.nome);
    if (alvos.frase) aplicar(alvos.frase, alvo === 'nome' ? {} : cfg, textos.frase);
    if (alvos.foto) aplicarFoco(alvos.foto, cfg.foco);
  }

  function carregar(estabId) {
    if (!global.db || !estabId) return Promise.resolve({});
    return global.db.rpc('titulo_efeito_publico', { p_estabelecimento_id: estabId }).then(function (r) {
      return (r && !r.error && r.data) || {};
    }, function () { return {}; });
  }
  function salvar(estabId, cfg) {
    return global.db.rpc('tenant_admin_atualizar_titulo_efeito', { p_estabelecimento_id: estabId, p_efeito: cfg || {} }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }

  // bloco de escolha usado pelos dois editores (perfil.js e editar-loja.js)
  function montarEscolha(caixa, cfg, aoMudar) {
    cfg = Object.assign({}, cfg || {});
    function linha(chave, lista) {
      return '<div class="te-opcoes" data-grupo="' + chave + '">' +
        lista.map(function (o) {
          return '<button type="button" class="te-opcao' + ((cfg[chave] || '') === o.chave ? ' ativo' : '') + '" data-valor="' + o.chave + '">' + o.nome + '</button>';
        }).join('') + '</div>';
    }
    caixa.innerHTML =
      '<p class="vb-ed-rotulo">Onde</p>' + linha('alvo', OPCOES.alvo) +
      MOVIMENTOS.map(function (g) { return '<p class="vb-ed-rotulo">' + g.titulo + '</p>' + linha('movimento', g.lista); }).join('') +
      '<p class="vb-ed-rotulo">Letra</p>' + linha('fonte', OPCOES.fonte) +
      '<p class="vb-ed-rotulo">Estilo</p>' + linha('estilo', OPCOES.estilo);
    caixa.addEventListener('click', function (e) {
      var b = e.target.closest('[data-valor]');
      if (!b) return;
      var g = b.closest('[data-grupo]').getAttribute('data-grupo');
      cfg[g] = b.getAttribute('data-valor');
      if (!cfg[g]) delete cfg[g];
      caixa.querySelectorAll('[data-grupo="' + g + '"] .te-opcao').forEach(function (x) { x.classList.toggle('ativo', x === b); });
      aoMudar(Object.assign({}, cfg));
    });
  }

  // escolher o ponto de foco: toca na foto onde está o que importa
  function montarFoco(caixa, url, cfg, aoMudar) {
    cfg = Object.assign({}, cfg || {});
    if (!url) { caixa.innerHTML = ''; return; }
    var m = /^(\d{1,3}) (\d{1,3})$/.exec(cfg.foco || '') || [0, 50, 40];
    caixa.innerHTML =
      '<p class="vb-ed-rotulo">Enquadrar a foto</p>' +
      '<p class="te-foco-ajuda">Toque no que mais importa na foto: o site corta em volta desse ponto, no celular e no computador.</p>' +
      '<div class="te-foco"><div class="te-foco-quadro" data-te-foco><img src="' + esc(url) + '" alt=""><span class="te-foco-ponto" style="left:' + m[1] + '%; top:' + m[2] + '%"></span></div></div>' +
      '<div class="te-opcoes te-foco-rapido">' +
        [['50 15', 'Em cima'], ['50 40', 'Centro'], ['50 80', 'Embaixo'], ['20 50', 'Esquerda'], ['80 50', 'Direita']].map(function (o) {
          return '<button type="button" class="te-opcao" data-foco="' + o[0] + '">' + o[1] + '</button>';
        }).join('') +
      '</div>';
    var ponto = caixa.querySelector('.te-foco-ponto');
    function escolher(foco) {
      var p = foco.split(' ');
      ponto.style.left = p[0] + '%'; ponto.style.top = p[1] + '%';
      cfg.foco = foco;
      aoMudar(Object.assign({}, cfg));
    }
    caixa.querySelector('[data-te-foco]').addEventListener('click', function (e) {
      var r = this.getBoundingClientRect();
      var x = Math.round(Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)));
      var y = Math.round(Math.min(100, Math.max(0, (e.clientY - r.top) / r.height * 100)));
      escolher(x + ' ' + y);
    });
    caixa.querySelectorAll('[data-foco]').forEach(function (b) {
      b.addEventListener('click', function () { escolher(b.getAttribute('data-foco')); });
    });
  }

  global.VBTituloEfeitos = {
    OPCOES: OPCOES, MOVIMENTOS: MOVIMENTOS,
    aplicar: aplicar, aplicarTopo: aplicarTopo, aplicarFoco: aplicarFoco,
    carregar: carregar, salvar: salvar, montarEscolha: montarEscolha, montarFoco: montarFoco
  };
})(window);
