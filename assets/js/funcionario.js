/* O funcionário digital do estabelecimento: um botão com o cubo da marca (o
   MESMO do logotipo — .vt-cubo de vibe-toggle.css, só as arestas douradas,
   flutuando de leve; ele só gira quando o funcionário está pensando ou
   ouvindo). O dono fala (ou escreve) e ele faz — confirma horário, avança
   pedido, lança venda, abre a tela certa, responde os números do dia.

   O NOME é do dono: na primeira vez o funcionário não tem nome nenhum e a
   primeira tela é só pra batizar. O nome fica no banco (assistente_nome /
   assistente_definir_nome), então segue o dono em qualquer aparelho.

   Quem entende o pedido é a função "assistente" (Gemini, no servidor). Quem executa
   é sempre esta página, com as mesmas RPCs que o dono já usa nos botões — nada de
   poder novo. Toda ação que muda alguma coisa pede um "sim" antes.

   VBFuncionario.montar({ estabId, negocio, areas, acoes: { ... } })
     acoes: o que esta página sabe fazer (cada painel passa as suas). */
(function (global) {
  'use strict';
  var CHAVE_NOME = 'vbFuncionarioNome_';
  // sem nome = o dono ainda não batizou. Nunca inventamos um nome por ele.
  var st = { estabId: null, nome: '', cfg: null, caixa: null, hist: [], ouvindo: null, pendente: null };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // o banco é a verdade; o aparelho só guarda uma cópia pra pintar na hora
  function lerCache(id) { try { return localStorage.getItem(CHAVE_NOME + id) || ''; } catch (e) { return ''; } }
  function gravarCache(id, n) { try { if (n) localStorage.setItem(CHAVE_NOME + id, n); else localStorage.removeItem(CHAVE_NOME + id); } catch (e) {} }
  function carregarNome(id) {
    if (!global.db || !global.db.rpc) return Promise.resolve(lerCache(id));
    return global.db.rpc('assistente_nome', { p_estabelecimento_id: id })
      .then(function (r) { return (!r.error && r.data) ? String(r.data) : lerCache(id); }, function () { return lerCache(id); });
  }
  function gravarNome(id, n) {
    gravarCache(id, n);
    if (!global.db || !global.db.rpc) return Promise.resolve(n);
    return global.db.rpc('assistente_definir_nome', { p_estabelecimento_id: id, p_nome: n })
      .then(function (r) { return (!r.error && r.data) ? String(r.data) : n; }, function () { return n; });
  }
  var SEM_NOME = 'Funcionário';
  function comoChamar() { return st.nome || SEM_NOME; }

  // o cubo do logotipo, igualzinho: .vt-cubo + as 6 faces f1..f6 de
  // vibe-toggle.css. Nada de animação própria aqui.
  var CUBO = '<span class="vt-cubo fn-cubo" aria-hidden="true"><span class="vt-cubo-3d">' +
    '<i class="f1"></i><i class="f2"></i><i class="f3"></i><i class="f4"></i><i class="f5"></i><i class="f6"></i>' +
    '</span></span>';

  function montar(cfg) {
    st.cfg = cfg;
    st.estabId = cfg.estabId;
    st.nome = lerCache(cfg.estabId); // pinta já, confere com o banco em seguida
    carregarNome(cfg.estabId).then(function (n) {
      st.nome = n || '';
      gravarCache(cfg.estabId, st.nome);
      atualizarBotao();
      var t2 = document.getElementById('fnNome'); if (t2) t2.textContent = comoChamar();
    });
    if (document.getElementById('fnBtn')) { atualizarBotao(); return; }
    var b = document.createElement('button');
    b.id = 'fnBtn';
    b.type = 'button';
    b.className = 'fn-btn';
    b.innerHTML = CUBO + '<span class="fn-btn-txt"></span>';
    b.addEventListener('click', abrir);
    document.body.appendChild(b);
    atualizarBotao();
    requestAnimationFrame(function () { b.classList.add('on'); });
  }
  function atualizarBotao() {
    var b = document.getElementById('fnBtn');
    if (!b) return;
    b.setAttribute('aria-label', st.nome ? 'Falar com ' + st.nome : 'Criar o seu funcionário');
    b.querySelector('.fn-btn-txt').textContent = comoChamar();
  }
  // o cubo só gira enquanto ele trabalha — parado, flutua como no logotipo
  function girar(sim) {
    (document.querySelectorAll('.fn-cubo') || []).forEach(function (c) { c.classList.toggle('fn-girando', !!sim); });
  }

  function abrir() {
    if (st.caixa) { st.caixa.classList.add('aberta'); focar(); return; }
    var c = document.createElement('div');
    c.className = 'fn';
    c.setAttribute('role', 'dialog');
    c.setAttribute('aria-modal', 'true');
    c.innerHTML =
      '<div class="fn-fundo" data-fn-fechar></div>' +
      '<div class="fn-folha">' +
        '<header class="fn-topo">' + CUBO +
          '<div class="fn-quem"><strong id="fnNome">' + esc(comoChamar()) + '</strong><small>seu funcionário · é só pedir</small></div>' +
          '<button type="button" class="fn-x" data-fn-fechar aria-label="Fechar">✕</button>' +
        '</header>' +
        '<div class="fn-conversa" id="fnConversa"></div>' +
        '<div class="fn-atalhos" id="fnAtalhos"></div>' +
        '<form class="fn-barra" id="fnForm">' +
          '<button type="button" class="fn-anexo" id="fnAnexo" aria-label="Mandar foto do cardápio">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg></button>' +
          '<input type="file" accept="image/*" id="fnArquivo" hidden>' +
          '<button type="button" class="fn-mic" id="fnMic" aria-label="Falar">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg></button>' +
          '<input id="fnTexto" type="text" autocomplete="off" placeholder="Fale ou escreva o que precisa" aria-label="O que você precisa">' +
          '<button type="submit" class="fn-enviar" aria-label="Enviar">' +
            '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h14M13 6l6 6-6 6"/></svg></button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(c);
    st.caixa = c;
    document.documentElement.classList.add('fn-travado');
    c.addEventListener('click', function (e) {
      if (e.target.closest('[data-fn-fechar]')) { fechar(); return; }
      var esc = e.target.closest('[data-fn-lido]');
      if (esc && lido) {
        esc.closest('.fn-escolhas').remove();
        executar(esc.getAttribute('data-fn-lido') === 'salvar' ? 'salvar_cardapio_lido' : 'conferir_cardapio_lido', { categorias: lido }, true);
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.caixa && st.caixa.classList.contains('aberta')) fechar(); });
    document.getElementById('fnForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = document.getElementById('fnTexto');
      var t = inp.value.trim();
      if (!t) return;
      inp.value = '';
      mandar(t);
    });
    ligarMicrofone();
    ligarFoto();
    atalhos();
    if (!st.nome) batizar();
    else if (!st.hist.length) dizer('ele', 'Oi! Sou ' + st.nome + '. Me peça o que precisar: confirmar um horário, lançar uma venda, ver quanto entrou hoje…');
    requestAnimationFrame(function () { c.classList.add('aberta'); focar(); });
  }
  function fechar() { if (st.caixa) st.caixa.classList.remove('aberta'); document.documentElement.classList.remove('fn-travado'); pararMic(); }
  function focar() { var i = document.getElementById('fnTexto'); if (i && !('ontouchstart' in window)) i.focus(); }

  /* ---------- batizar: a PRIMEIRA coisa que o dono faz é dar o nome ---------- */
  function batizar() {
    var c = document.getElementById('fnConversa');
    if (!c) return;
    c.innerHTML = '';
    var cx = document.createElement('div');
    cx.className = 'fn-batismo';
    cx.innerHTML =
      '<p class="fn-bat-tit">Dê um nome ao seu funcionário</p>' +
      '<p class="fn-bat-sub">Ele é seu: escolha o nome que quiser. É assim que você vai chamar ele no dia a dia.</p>' +
      '<form class="fn-bat-form" id="fnBatForm">' +
        '<input id="fnBatNome" type="text" maxlength="20" autocomplete="off" placeholder="Digite o nome" aria-label="Nome do seu funcionário">' +
        '<button type="submit" class="fn-bat-ok">Pronto</button>' +
      '</form>' +
      '<p class="fn-bat-aviso" id="fnBatAviso"></p>' +
      '<p class="fn-bat-nota">Depois você troca quando quiser: só pedir "troca o seu nome pra…".</p>';
    c.appendChild(cx);
    document.getElementById('fnAtalhos').innerHTML = '';
    var form = document.getElementById('fnBatForm');
    var inp = document.getElementById('fnBatNome');
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 220);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = inp.value.trim().slice(0, 20);
      var av = document.getElementById('fnBatAviso');
      if (n.length < 2) { av.textContent = 'Escreva um nome com pelo menos 2 letras.'; return; }
      av.textContent = 'Guardando…';
      gravarNome(st.estabId, n).then(function (salvo) {
        st.nome = salvo || n;
        atualizarBotao();
        var t2 = document.getElementById('fnNome'); if (t2) t2.textContent = st.nome;
        st.hist = [];
        c.innerHTML = '';
        atalhos();
        dizer('ele', 'Prazer, patrão! Sou ' + st.nome + '. Me peça o que precisar: confirmar um horário, lançar uma venda, ver quanto entrou hoje…');
      });
    });
  }

  function atalhos() {
    var alvo = document.getElementById('fnAtalhos');
    if (!alvo) return;
    var l = ['Quanto entrou hoje?', 'Tem horário pra confirmar?', 'Lançar uma venda', 'Abrir meu site'];
    alvo.innerHTML = l.map(function (t) { return '<button type="button" class="fn-atalho">' + esc(t) + '</button>'; }).join('');
    alvo.addEventListener('click', function (e) { var b = e.target.closest('.fn-atalho'); if (b) mandar(b.textContent); });
  }

  function dizer(de, texto, extra) {
    st.hist.push({ de: de === 'eu' ? 'eu' : 'ele', texto: texto });
    var c = document.getElementById('fnConversa');
    if (!c) return null;
    var el = document.createElement('div');
    el.className = 'fn-msg fn-' + (de === 'eu' ? 'eu' : 'ele');
    el.innerHTML = '<p></p>' + (extra || '');
    c.appendChild(el);
    c.scrollTop = c.scrollHeight;
    var p = el.querySelector('p');
    if (de !== 'eu' && global.VBDigita) global.VBDigita.em(p, texto, { vel: 62, aoFim: function () { c.scrollTop = c.scrollHeight; } });
    else p.textContent = texto;
    return el;
  }
  function pensando(sim) {
    girar(sim);
    var c = document.getElementById('fnConversa');
    if (!c) return;
    var velho = c.querySelector('.fn-pensando');
    if (velho) velho.remove();
    if (!sim) return;
    var el = document.createElement('div');
    el.className = 'fn-msg fn-ele fn-pensando';
    el.innerHTML = '<p><i></i><i></i><i></i></p>';
    c.appendChild(el);
    c.scrollTop = c.scrollHeight;
  }

  /* ---------- foto do cardápio pelo chat ----------
     O dono manda a foto aqui mesmo em vez de ir procurar a tela do cardápio.
     Quem lê é a função 'ler-cardapio' (a mesma do painel); o que ela devolve
     NUNCA entra no site sozinho: o funcionário mostra o que leu e espera o
     dono mandar salvar — ou abrir a lista pra corrigir antes. */
  var lido = null;

  // a foto sai do celular já menor: 1600px e JPEG, senão a leitura demora
  function comprimir(arquivo, maxLado) {
    return new Promise(function (ok, falha) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () {
        var escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * escala);
        cv.height = Math.round(img.naturalHeight * escala);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        ok(cv.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('Não consegui abrir essa foto.')); };
      img.src = url;
    });
  }

  function ligarFoto() {
    var b = document.getElementById('fnAnexo'), inp = document.getElementById('fnArquivo');
    if (!b || !inp) return;
    b.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () {
      var arq = inp.files && inp.files[0];
      inp.value = '';
      if (arq) mandarFoto(arq);
    });
  }

  function mandarFoto(arquivo) {
    if (!/^image\//.test(arquivo.type)) { dizer('ele', 'Isso não parece uma foto. Mande uma imagem do cardápio.'); return; }
    var servico = (st.cfg.areas || []).indexOf('servicos') !== -1 && (st.cfg.areas || []).indexOf('delivery') === -1;
    dizer('eu', servico ? 'Foto da tabela de serviços' : 'Foto do cardápio');
    pensando(true);
    comprimir(arquivo, 1600).then(function (dataUrl) {
      return global.db.functions.invoke('ler-cardapio', { body: { imagem: dataUrl, tipo: servico ? 'servicos' : 'cardapio' } });
    }).then(function (r) {
      pensando(false);
      if (r.error) {
        var ctx = r.error.context;
        if (ctx && ctx.json) return ctx.json().then(function (j) { dizer('ele', (j && j.erro) || 'Não consegui ler essa foto.'); }, function () { dizer('ele', 'Não consegui ler essa foto.'); });
        dizer('ele', 'Não consegui ler essa foto.');
        return;
      }
      mostrarLido(r.data || {});
    }, function (e) {
      pensando(false);
      dizer('ele', (e && e.message) || 'Não consegui ler essa foto agora.');
    });
  }

  function mostrarLido(dados) {
    var cats = dados.categorias || [];
    var total = cats.reduce(function (n, c) { return n + (c.itens || []).length; }, 0);
    if (!total) { dizer('ele', dados.aviso || 'Não achei nenhum item nessa foto. Tente com mais luz, mais perto ou sem cortar as bordas.'); return; }
    lido = cats;
    // uma amostra: o dono reconhece o cardápio dele sem precisar abrir nada
    var amostra = [];
    cats.forEach(function (c) { (c.itens || []).forEach(function (i) { if (amostra.length < 6) amostra.push(i.nome + (i.preco ? ' — R$ ' + i.preco.toFixed(2).replace('.', ',') : ' — sem preço')); }); });
    dizer('ele', 'Li ' + total + (total === 1 ? ' item' : ' itens') + ' em ' + cats.length + (cats.length === 1 ? ' categoria' : ' categorias') + ':\n• ' +
      amostra.join('\n• ') + (total > amostra.length ? '\n…e mais ' + (total - amostra.length) + '.' : '') +
      '\n\nConfira os preços: a leitura da foto pode errar.',
      '<div class="fn-escolhas">' +
        '<button type="button" class="fn-esc fn-esc-forte" data-fn-lido="conferir">Conferir e corrigir</button>' +
        '<button type="button" class="fn-esc" data-fn-lido="salvar">Pôr tudo do jeito que está</button>' +
      '</div>');
  }

  /* ---------- microfone (do próprio navegador, sem mandar áudio pra lugar nenhum) ---------- */
  var Rec = global.SpeechRecognition || global.webkitSpeechRecognition;
  function ligarMicrofone() {
    var b = document.getElementById('fnMic');
    if (!b) return;
    if (!Rec) { b.classList.add('fn-sem'); b.title = 'Este navegador não ouve — escreva o pedido'; return; }
    b.addEventListener('click', function () {
      if (st.ouvindo) { pararMic(); return; }
      var r = new Rec();
      r.lang = 'pt-BR'; r.interimResults = true; r.maxAlternatives = 1;
      var inp = document.getElementById('fnTexto');
      r.onresult = function (e) {
        var t = '';
        for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        inp.value = t;
        if (e.results[e.results.length - 1].isFinal) { pararMic(); mandar(t.trim()); inp.value = ''; }
      };
      r.onerror = function () { pararMic(); };
      r.onend = function () { pararMic(); };
      st.ouvindo = r;
      b.classList.add('ouvindo');
      girar(true);
      try { r.start(); } catch (e) { pararMic(); }
    });
  }
  function pararMic() {
    var b = document.getElementById('fnMic');
    if (b) b.classList.remove('ouvindo');
    girar(false);
    if (st.ouvindo) { try { st.ouvindo.stop(); } catch (e) {} st.ouvindo = null; }
  }

  /* ---------- conversa ---------- */
  function mandar(texto) {
    dizer('eu', texto);
    // o dono respondendo a um "tem certeza?"
    if (st.pendente) {
      var sim = /^(s|sim|isso|pode|confirma|manda|vai|ok|claro|uhum|certo)\b/i.test(texto.trim());
      var p = st.pendente; st.pendente = null;
      if (sim) { executar(p.nome, p.args, true); return; }
      dizer('ele', 'Tudo bem, deixei como estava.');
      return;
    }
    pensando(true);
    global.db.functions.invoke('assistente', {
      body: { texto: texto, contexto: contexto(), historico: st.hist.slice(-7) }
    }).then(function (r) {
      pensando(false);
      if (r.error) {
        var ctx = r.error.context;
        if (ctx && ctx.json) return ctx.json().then(function (j) { dizer('ele', (j && j.erro) || 'Não consegui agora.'); }, function () { dizer('ele', 'Não consegui agora.'); });
        dizer('ele', 'Não consegui agora.');
        return;
      }
      var d = r.data || {};
      if (d.fala) dizer('ele', d.fala);
      if (d.acao) executar(d.acao.nome, d.acao.args || {});
    }, function () { pensando(false); dizer('ele', 'Sem conexão agora. Tente de novo em instantes.'); });
  }

  function contexto() {
    var c = { nome_assistente: st.nome || null, negocio: st.cfg.negocio, areas: st.cfg.areas || [] };
    if (st.cfg.resumo) { try { c.resumo = st.cfg.resumo(); } catch (e) {} }
    return c;
  }

  // ações que mexem em alguma coisa pedem confirmação antes
  var PRECISA_SIM = ['confirmar_agendamento', 'concluir_agendamento', 'cancelar_agendamento', 'avancar_pedido', 'cancelar_pedido', 'lancar_venda'];
  function executar(nome, args, jaConfirmou) {
    if (nome === 'mudar_nome_funcionario') {
      var novo = String(args.nome || '').trim().slice(0, 20);
      if (novo.length < 2) { batizar(); return; }
      gravarNome(st.estabId, novo).then(function (salvo) {
        st.nome = salvo || novo;
        atualizarBotao();
        var n = document.getElementById('fnNome'); if (n) n.textContent = st.nome;
      });
      return;
    }
    // a IA pediu a foto: quem abre a câmera é o próprio chat, aqui
    if (nome === 'pedir_foto_cardapio') {
      var bAnexo = document.getElementById('fnAnexo');
      if (bAnexo) { bAnexo.classList.add('fn-pisca'); setTimeout(function () { bAnexo.classList.remove('fn-pisca'); }, 4000); }
      return;
    }
    var fn = (st.cfg.acoes || {})[nome];
    if (!fn) { dizer('ele', 'Isso eu ainda não faço por aqui.'); return; }
    if (PRECISA_SIM.indexOf(nome) !== -1 && !jaConfirmou) {
      st.pendente = { nome: nome, args: args };
      dizer('ele', 'Posso fazer? Responda sim pra eu seguir.');
      return;
    }
    Promise.resolve().then(function () { return fn(args); }).then(function (txt) {
      if (txt) dizer('ele', String(txt));
    }, function (e) { dizer('ele', (e && e.message) || 'Não deu certo dessa vez.'); });
  }

  global.VBFuncionario = { montar: montar, abrir: abrir, nome: function () { return st.nome; }, dizer: dizer };
})(window);
