/* O funcionário digital do estabelecimento: um botão com o cubo da marca girando;
   o dono fala (ou escreve) e ele faz — confirma horário, avança pedido, lança venda,
   abre a tela certa, responde os números do dia.

   Quem entende o pedido é a função "assistente" (Gemini, no servidor). Quem executa
   é sempre esta página, com as mesmas RPCs que o dono já usa nos botões — nada de
   poder novo. Toda ação que muda alguma coisa pede um "sim" antes.

   VBFuncionario.montar({ estabId, negocio, areas, acoes: { ... } })
     acoes: o que esta página sabe fazer (cada painel passa as suas). */
(function (global) {
  'use strict';
  var CHAVE_NOME = 'vbFuncionarioNome_';
  var st = { estabId: null, nome: 'Vitó', cfg: null, caixa: null, hist: [], ouvindo: null, pendente: null };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lerNome(id) { try { return localStorage.getItem(CHAVE_NOME + id) || 'Vitó'; } catch (e) { return 'Vitó'; } }
  function gravarNome(id, n) { try { localStorage.setItem(CHAVE_NOME + id, n); } catch (e) {} }

  var CUBO = '<span class="fn-cubo" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>';

  function montar(cfg) {
    st.cfg = cfg;
    st.estabId = cfg.estabId;
    st.nome = lerNome(cfg.estabId);
    if (document.getElementById('fnBtn')) { atualizarBotao(); return; }
    var b = document.createElement('button');
    b.id = 'fnBtn';
    b.type = 'button';
    b.className = 'fn-btn';
    b.setAttribute('aria-label', 'Falar com ' + st.nome);
    b.innerHTML = CUBO + '<span class="fn-btn-txt">' + esc(st.nome) + '</span>';
    b.addEventListener('click', abrir);
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('on'); });
  }
  function atualizarBotao() {
    var b = document.getElementById('fnBtn');
    if (!b) return;
    b.setAttribute('aria-label', 'Falar com ' + st.nome);
    b.querySelector('.fn-btn-txt').textContent = st.nome;
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
          '<div class="fn-quem"><strong id="fnNome">' + esc(st.nome) + '</strong><small>seu funcionário · é só pedir</small></div>' +
          '<button type="button" class="fn-x" data-fn-fechar aria-label="Fechar">✕</button>' +
        '</header>' +
        '<div class="fn-conversa" id="fnConversa"></div>' +
        '<div class="fn-atalhos" id="fnAtalhos"></div>' +
        '<form class="fn-barra" id="fnForm">' +
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
    c.addEventListener('click', function (e) { if (e.target.closest('[data-fn-fechar]')) fechar(); });
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
    atalhos();
    if (!st.hist.length) dizer('ele', 'Oi! Sou ' + st.nome + '. Me peça o que precisar: confirmar um horário, lançar uma venda, ver quanto entrou hoje…');
    requestAnimationFrame(function () { c.classList.add('aberta'); focar(); });
  }
  function fechar() { if (st.caixa) st.caixa.classList.remove('aberta'); document.documentElement.classList.remove('fn-travado'); pararMic(); }
  function focar() { var i = document.getElementById('fnTexto'); if (i && !('ontouchstart' in window)) i.focus(); }

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
      try { r.start(); } catch (e) { pararMic(); }
    });
  }
  function pararMic() {
    var b = document.getElementById('fnMic');
    if (b) b.classList.remove('ouvindo');
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
    var c = { nome_assistente: st.nome, negocio: st.cfg.negocio, areas: st.cfg.areas || [] };
    if (st.cfg.resumo) { try { c.resumo = st.cfg.resumo(); } catch (e) {} }
    return c;
  }

  // ações que mexem em alguma coisa pedem confirmação antes
  var PRECISA_SIM = ['confirmar_agendamento', 'concluir_agendamento', 'cancelar_agendamento', 'avancar_pedido', 'cancelar_pedido', 'lancar_venda'];
  function executar(nome, args, jaConfirmou) {
    if (nome === 'mudar_nome_funcionario') {
      var novo = String(args.nome || '').trim().slice(0, 20);
      if (!novo) return;
      st.nome = novo; gravarNome(st.estabId, novo);
      atualizarBotao();
      var n = document.getElementById('fnNome'); if (n) n.textContent = novo;
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
