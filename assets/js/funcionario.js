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
  var st = { estabId: null, nome: '', cfg: null, caixa: null, hist: [], ouvindo: null, pendente: null, pronto: false, usos: null, notaT: null };

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


  /* ---------- curiosidades da tela de carregamento ---------- */
  var PAREDE_HTML = '<div class="fn-parede esq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="fn-parede dir" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
  var BOOT_HTML = '<div class="fn-boot" id="fnBoot" role="status" aria-live="polite">' +
    '<div class="fn-boot-moldura"><div class="fn-boot-topo"><span>MATRIZ // TERMINAL</span><span class="fn-boot-ver">v1.0</span></div>' +
    '<pre class="fn-boot-log" id="fnBootLog"></pre>' +
    '<div class="fn-boot-barra"><i></i></div><div class="fn-boot-num" id="fnBootNum">0%</div>' +
    '<div class="fn-boot-dica"><small>VOCÊ SABIA?</small><p id="fnBootDica"></p></div>' +
    '<button type="button" class="fn-boot-pular" id="fnBootPular">toque pra entrar</button></div></div>';
  var CURIOSIDADES = [
    'Mande a foto do cardápio aqui no terminal: a IA lê tudo e você só confere antes de publicar.',
    'No meio a meio, o cliente paga só o sabor mais caro — e escolhe os dois sabores na tela.',
    'O Pix cai direto na sua chave, sem intermediário: o cliente paga pelo QR Code dentro do app.',
    'Digite /dashboard 7 e veja o faturamento dos últimos 7 dias, em gráfico, aqui mesmo.',
    'Tudo o que você pede aqui pode ser desfeito: a conversa fica salva e cada ação tem um botão Desfazer.',
    'Pode fechar esta conversa enquanto eu trabalho. A resposta fica salva e eu aviso quando chegar.',
    'Cliente que só olha o seu site, entrando com a conta da Matriz, também fica salvo na aba Clientes.',
    'No Caixa, uma venda sai em poucos toques: o que vendeu, quem atendeu e como pagou.',
    'Marcou um item como esgotado? Ele some do site na mesma hora. Peça: "esgota a calabresa".',
    'Ligue o som na aba Pedidos para ser avisado a cada pedido novo, mesmo em outra tela.',
    'Suas promoções aparecem na busca de estabelecimentos, num cartão que o cliente toca pra ver.',
    'Digite /tour e eu mostro cada botão do app, passo a passo, em um minuto.',
    'Seu site tem link próprio e QR Code para colar no balcão e nas embalagens.',
    'Peça em português normal: "muda o preço da 4 queijos pra 42" — eu entendo e faço.'
  ];
  var COMANDOS_AJUDA = [
    ['/dashboard 7', 'gráfico e números do período (1, 3, 5, 7, 15 ou 30 dias)'],
    ['/foto', 'mandar fotos do cardápio ou de uma promoção'],
    ['/cardapio', 'abrir o cardápio'],
    ['/desfazer', 'desfaz a última coisa que eu fiz'],
    ['/uso', 'quanto você já usou hoje'],
    ['/tour', 'tour do app, passo a passo'],
    ['/limpar', 'limpa a tela (o histórico continua salvo)']
  ];

  /* ---------- histórico: banco quando existir, senão o próprio aparelho ----------
     A conversa de cada estabelecimento fica salva; cada ação que dá pra reverter
     guarda os passos do "Desfazer". Se a tabela ainda não existe no banco, o
     histórico vale só neste aparelho (nada quebra). */
  var Hist = {
    remoto: null,
    chave: function () { return 'vbFnHist_' + st.estabId; },
    localLer: function () { try { return JSON.parse(localStorage.getItem(Hist.chave()) || '[]'); } catch (e) { return []; } },
    localGravar: function (l) { try { localStorage.setItem(Hist.chave(), JSON.stringify(l.slice(-120))); } catch (e) {} },
    rpc: function (nome, args) {
      if (!global.db || !global.db.rpc) return Promise.reject(new Error('sem banco'));
      return global.db.rpc(nome, Object.assign({ p_estabelecimento_id: st.estabId }, args)).then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    carregar: function () {
      return Hist.rpc('assistente_historico_listar', { p_limite: 80 }).then(function (rows) { Hist.remoto = true; return rows || []; },
        function () { Hist.remoto = false; return Hist.localLer(); });
    },
    salvar: function (m) {
      var linha = { id: 'l' + Date.now() + Math.random().toString(36).slice(2, 6), papel: m.papel, texto: m.texto, acao: m.acao || null, desfazer: m.desfazer || null, desfeito_em: null, criado_em: new Date().toISOString() };
      var local = function () { var l = Hist.localLer(); l.push(linha); Hist.localGravar(l); return linha.id; };
      if (Hist.remoto === false) return Promise.resolve(local());
      return Hist.rpc('assistente_historico_salvar', { p_papel: m.papel, p_texto: String(m.texto || '').slice(0, 2000), p_acao: m.acao || null, p_desfazer: m.desfazer || null })
        .then(function (id) { Hist.remoto = true; return id; }, function () { Hist.remoto = false; return local(); });
    },
    desfeito: function (id) {
      if (String(id).charAt(0) === 'l') { var l = Hist.localLer(); l.forEach(function (x) { if (x.id === id) x.desfeito_em = new Date().toISOString(); }); Hist.localGravar(l); return Promise.resolve(); }
      return Hist.rpc('assistente_historico_desfeito', { p_id: id }).then(function () {}, function () {});
    }
  };
  // quanto já usou hoje (limite justo por estabelecimento); sem a função no banco, simplesmente não mostra
  function usoHoje() {
    return Hist.rpc('assistente_uso_hoje', {}).then(function (u) { st.usos = u; return u; }, function () { return null; });
  }
  function mostrarUso() {
    var el = document.getElementById('fnUso');
    if (!el) return;
    if (!st.usos) { el.textContent = ''; return; }
    var m = Number(st.usos.mensagens) || 0, lim = Number(st.usos.limite_mensagens) || 0;
    el.textContent = lim ? m + '/' + lim : '';
    el.classList.toggle('fn-uso-alto', lim > 0 && m / lim >= 0.85);
    el.title = 'Mensagens de hoje: ' + m + ' de ' + lim + ' · Fotos: ' + (st.usos.fotos || 0) + ' de ' + (st.usos.limite_fotos || 0);
  }
  function norm(t) { return String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }

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
    if (st.caixa) { st.caixa.classList.add('aberta'); limparAviso(); focar(); var cv = document.getElementById('fnConversa'); if (cv) cv.scrollTop = cv.scrollHeight; return; }
    var c = document.createElement('div');
    c.className = 'fn';
    c.setAttribute('role', 'dialog');
    c.setAttribute('aria-modal', 'true');
    c.innerHTML =
      '<div class="fn-fundo" data-fn-fechar></div>' +
      '<div class="fn-folha fn-term">' + PAREDE_HTML + '<div class="fn-miolo">' +
        '<header class="fn-topo">' + CUBO +
          '<div class="fn-quem"><strong id="fnNome">' + esc(comoChamar()) + '</strong><small id="fnStatus">terminal · matriz</small></div>' +
          '<span class="fn-uso" id="fnUso" aria-live="polite"></span>' +
          '<button type="button" class="fn-x" data-fn-fechar aria-label="Fechar">✕</button>' +
        '</header>' +
        '<div class="fn-conversa" id="fnConversa"></div>' +
        '<div class="fn-atalhos" id="fnAtalhos"></div>' +
        '<form class="fn-barra" id="fnForm"><span class="fn-prompt" aria-hidden="true">❯</span>' +
          '<button type="button" class="fn-anexo" id="fnAnexo" aria-label="Mandar foto do cardápio">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg></button>' +
          '<input type="file" accept="image/*" id="fnArquivo" multiple hidden>' +
          '<button type="button" class="fn-mic" id="fnMic" aria-label="Falar">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg></button>' +
          '<input id="fnTexto" type="text" autocomplete="off" placeholder="comando ou peça em português…" aria-label="Comando ou pedido" autocapitalize="none" spellcheck="false">' +
          '<button type="submit" class="fn-enviar" aria-label="Enviar">' +
            '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h14M13 6l6 6-6 6"/></svg></button>' +
        '</form>' +
      '</div></div>' + BOOT_HTML;
    document.body.appendChild(c);
    st.caixa = c;
    document.documentElement.classList.add('fn-travado');
    c.addEventListener('click', function (e) {
      if (e.target.closest('[data-fn-fechar]')) { fechar(); return; }
      if (e.target.closest('[data-fn-cardapio-cancelar]')) {
        var cx = e.target.closest('.fn-cardapio'); if (cx) cx.remove();
        dizer('ele', 'Tudo bem, não pus nada. Quando quiser, é só mandar a foto de novo.');
        return;
      }
      var salvar = e.target.closest('[data-fn-cardapio-salvar]');
      if (salvar && !salvar.disabled) finalizarCardapio(salvar.closest('.fn-cardapio'));
      var cmd = e.target.closest('[data-fn-cmd]');
      if (cmd) { var t = cmd.getAttribute('data-fn-cmd'); mandar(t); return; }
      var per = e.target.closest('[data-fn-dias]');
      if (per) { mostrarDashboard(Number(per.getAttribute('data-fn-dias'))); return; }
      var expl = e.target.closest('[data-fn-explicar]');
      if (expl) { var res = expl.getAttribute('data-fn-explicar'); mandar('Me explica esses números', 'Explique de forma simples e curta o que estes números do meu negócio mostram e dê 2 dicas práticas. Dados: ' + res); return; }
      var ab = e.target.closest('[data-fn-abrir-ganhos]');
      if (ab && st.cfg.acoes && st.cfg.acoes.abrir_aba) { fechar(); st.cfg.acoes.abrir_aba({ aba: 'ganhos' }); return; }
      var rep = e.target.closest('[data-fn-repetir]');
      if (rep) { var tx = rep.getAttribute('data-fn-repetir'); rep.closest('.fn-msg').remove(); mandar(tx); return; }
      var des = e.target.closest('[data-fn-desfazer]');
      if (des && !des.disabled) desfazerDaMensagem(des);
    });
    // os interruptores: um por item e um por categoria
    c.addEventListener('change', function (e) {
      var cartao = e.target.closest && e.target.closest('.fn-cardapio');
      if (!cartao) return;
      if (e.target.hasAttribute('data-fn-cat')) {
        var ligar = e.target.checked;
        e.target.closest('.fn-pz-cat').querySelectorAll('.fn-pz .fn-tg input').forEach(function (i) { i.checked = ligar; });
      }
      contarMarcados(cartao);
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
    if (!st.nome) { var bt = document.getElementById('fnBoot'); if (bt) bt.remove(); batizar(); }
    else iniciarSessao();
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
        dizer('ele', 'Prazer, patrão! Sou ' + st.nome + '. Terminal pronto: digite /ajuda ou peça em português.');
        usoHoje().then(mostrarUso);
      });
    });
  }

  function atalhos() {
    var alvo = document.getElementById('fnAtalhos');
    if (!alvo) return;
    var l = ['/dashboard 7', 'Quanto entrou hoje?', '/foto', '/cardapio', '/ajuda'];
    alvo.innerHTML = l.map(function (t) { return '<button type="button" class="fn-atalho">' + esc(t) + '</button>'; }).join('');
    alvo.addEventListener('click', function (e) { var b = e.target.closest('.fn-atalho'); if (b) mandar(b.textContent); });
  }

  // op: { restaurar, acao, desfazer, id, desfeito, semSalvar, aviso }
  function dizer(de, texto, extra, op) {
    op = op || {};
    st.hist.push({ de: de === 'eu' ? 'eu' : 'ele', texto: texto });
    var c = document.getElementById('fnConversa');
    var aberta = !!(st.caixa && st.caixa.classList.contains('aberta'));
    if (de !== 'eu' && !op.restaurar && !aberta) notificar(texto);
    if (!c) {
      if (!op.restaurar && !op.semSalvar) Hist.salvar({ papel: de === 'eu' ? 'eu' : 'ele', texto: texto, acao: op.acao, desfazer: op.desfazer });
      return null;
    }
    var el = document.createElement('div');
    el.className = 'fn-msg fn-' + (de === 'eu' ? 'eu' : 'ele') + (op.sistema ? ' fn-sis' : '');
    var desf = '';
    if (op.desfazer && op.desfazer.passos) desf = op.desfeito ? '<div class="fn-desf"><span class="fn-desfeito">↩ desfeito</span></div>'
      : '<div class="fn-desf"><button type="button" class="fn-desf-btn" data-fn-desfazer>↩ Desfazer: ' + esc(String(op.desfazer.texto || 'voltar como estava').slice(0, 60)) + '</button></div>';
    el.innerHTML = '<p></p>' + (extra || '') + desf;
    if (op.desfazer && op.desfazer.passos) el._desf = op.desfazer;
    if (op.id) el.setAttribute('data-id', op.id);
    if (op.criado) el.setAttribute('data-quando', op.criado);
    c.appendChild(el);
    var p = el.querySelector('p');
    if (op.restaurar) { p.textContent = texto; return el; }
    c.scrollTop = c.scrollHeight;
    // ao terminar de digitar, só desce se a pessoa já estava no pé da conversa.
    if (de !== 'eu' && global.VBDigita && !op.semDigitar) global.VBDigita.em(p, texto, { vel: 140, aoFim: function () {
      if (c.scrollHeight - c.scrollTop - c.clientHeight < 120) c.scrollTop = c.scrollHeight;
    } });
    else p.textContent = texto;
    if (!op.semSalvar) {
      Hist.salvar({ papel: de === 'eu' ? 'eu' : 'ele', texto: texto, acao: op.acao, desfazer: op.desfazer }).then(function (id) { el.setAttribute('data-id', id); });
    }
    return el;
  }
  // a resposta chegou com a conversa fechada: avisa no botão e num balãozinho (a conversa continua salva)
  function notificar(texto) {
    var b = document.getElementById('fnBtn');
    if (b) b.classList.add('fn-novo');
    var antigo = document.getElementById('fnAviso'); if (antigo) antigo.remove();
    var a = document.createElement('button');
    a.type = 'button'; a.id = 'fnAviso'; a.className = 'fn-aviso';
    a.innerHTML = '<strong>' + esc(comoChamar()) + ' respondeu</strong><span>' + esc(String(texto || '').slice(0, 90)) + '</span>';
    a.addEventListener('click', function () { a.remove(); abrir(); });
    document.body.appendChild(a);
    requestAnimationFrame(function () { a.classList.add('on'); });
    setTimeout(function () { if (a.parentNode) { a.classList.remove('on'); setTimeout(function () { a.remove(); }, 300); } }, 9000);
  }
  function limparAviso() {
    var b = document.getElementById('fnBtn'); if (b) b.classList.remove('fn-novo');
    var a = document.getElementById('fnAviso'); if (a) a.remove();
  }
  function pensando(sim) {
    girar(sim);
    clearTimeout(st.notaT);
    var c = document.getElementById('fnConversa');
    if (!c) return;
    var velho = c.querySelector('.fn-pensando');
    if (velho) velho.remove();
    var st1 = document.getElementById('fnStatus'); if (st1) st1.textContent = sim ? 'processando…' : 'terminal · matriz';
    if (!sim) return;
    var el = document.createElement('div');
    el.className = 'fn-msg fn-ele fn-pensando';
    el.innerHTML = '<p><i></i><i></i><i></i></p>';
    c.appendChild(el);
    c.scrollTop = c.scrollHeight;
    // demorou: avisa que dá pra fechar a conversa — a resposta fica salva
    st.notaT = setTimeout(function () {
      if (!el.parentNode) return;
      var n = document.createElement('p');
      n.className = 'fn-nota';
      n.textContent = 'Pode fechar a conversa: eu continuo trabalhando e a resposta fica salva aqui.';
      el.appendChild(n);
      c.scrollTop = c.scrollHeight;
    }, 1800);
  }

  /* ---------- foto do cardápio pelo chat ----------
     O dono manda a foto aqui mesmo em vez de ir procurar a tela do cardápio.
     Quem lê é a função 'ler-cardapio' (a mesma do painel); o que ela devolve
     NUNCA entra no site sozinho: o funcionário mostra o que leu e espera o
     dono mandar salvar — ou abrir a lista pra corrigir antes. */
  var lido = null, lidoPromos = [];

  /* A foto sai do celular já menor: 1600px no lado maior, em JPEG. Foto de
     câmera de celular passa fácil de 4 MB, e em base64 ainda cresce um terço
     — iria grande demais pela rede do cliente. Se mesmo assim passar do
     limite, encolhe de novo até caber, em vez de tentar mandar e falhar. */
  var TETO_ENVIO = 3.5 * 1024 * 1024; // o data URL, já em base64

  function comprimir(arquivo, maxLado) {
    return new Promise(function (ok, falha) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () {
        var lado = maxLado, qualidade = 0.84, saida = '';
        for (var tentativa = 0; tentativa < 4; tentativa++) {
          var escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.naturalWidth * escala));
          cv.height = Math.max(1, Math.round(img.naturalHeight * escala));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          saida = cv.toDataURL('image/jpeg', qualidade);
          if (saida.length <= TETO_ENVIO) break;
          lado = Math.round(lado * 0.75);
          qualidade = Math.max(0.6, qualidade - 0.08);
        }
        URL.revokeObjectURL(url);
        if (!saida || saida.indexOf('data:image/jpeg') !== 0) { falha(new Error('Não consegui preparar essa foto no seu aparelho.')); return; }
        ok(saida);
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('Não consegui abrir essa foto. Tente outra.')); };
      img.src = url;
    });
  }

  function ligarFoto() {
    var b = document.getElementById('fnAnexo'), inp = document.getElementById('fnArquivo');
    if (!b || !inp) return;
    b.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () {
      var arqs = Array.prototype.slice.call(inp.files || [], 0, 6); // até 6 fotos por vez
      inp.value = '';
      if (arqs.length) mandarFotos(arqs);
    });
  }

  /* A foto que o dono mandou aparece na conversa, como numa mensagem de verdade.
     Enquanto a IA lê, um feixe de luz varre a imagem de cima a baixo — o mesmo
     gesto da sessão da IA na primeira tela. Sai sozinho quando a leitura acaba. */
  function dizerFoto(arquivo) {
    var c = document.getElementById('fnConversa');
    if (!c) return null;
    st.hist.push({ de: 'eu', texto: 'Foto do cardápio' });
    var url = URL.createObjectURL(arquivo);
    var el = document.createElement('div');
    el.className = 'fn-msg fn-eu fn-msg-foto';
    el.innerHTML = '<figure class="fn-foto lendo"><img alt="A foto que você mandou" src="' + url + '"><i class="fn-feixe" aria-hidden="true"></i></figure>';
    c.appendChild(el);
    c.scrollTop = c.scrollHeight;
    var img = el.querySelector('img');
    // a foto carrega depois de entrar na tela: rola de novo quando tiver altura
    img.addEventListener('load', function () { c.scrollTop = c.scrollHeight; });
    return el.querySelector('.fn-foto');
  }

  function mandarFoto(arquivo) { mandarFotos([arquivo]); }
  function mandarFotos(arquivos) {
    var validos = arquivos.filter(function (a) { return /^image\//.test(a.type); });
    if (!validos.length) { dizer('ele', 'Isso não parece uma foto. Mande uma imagem do cardápio.'); return; }
    var servico = (st.cfg.areas || []).indexOf('servicos') !== -1 && (st.cfg.areas || []).indexOf('delivery') === -1;
    var juntos = { categorias: [], promocoes: [], extras: [], aviso: '' }, falhas = 0;
    // junta o que cada foto trouxe: categoria com o mesmo nome vira uma só
    var juntar = function (d) {
      (d.categorias || []).forEach(function (cat) {
        var ja = juntos.categorias.filter(function (x) { return norm(x.nome) === norm(cat.nome); })[0];
        if (ja) ja.itens = ja.itens.concat(cat.itens || []); else juntos.categorias.push({ nome: cat.nome, itens: (cat.itens || []).slice() });
      });
      juntos.promocoes = juntos.promocoes.concat(d.promocoes || []);
      juntos.extras = juntos.extras.concat(d.extras || []);
      if (d.aviso) juntos.aviso = d.aviso;
    };
    pensando(true);
    // uma por vez: é mais leve pro servidor e a ordem das fotos é a ordem do cardápio
    validos.reduce(function (fila, arquivo, i) {
      return fila.then(function () {
        var fig = dizerFoto(arquivo);
        var st1 = document.getElementById('fnStatus'); if (st1) st1.textContent = 'lendo foto ' + (i + 1) + ' de ' + validos.length + '…';
        return comprimir(arquivo, 1600).then(function (dataUrl) {
          return global.db.functions.invoke('ler-cardapio', { body: { imagem: dataUrl, tipo: servico ? 'servicos' : 'cardapio', estabId: st.estabId } });
        }).then(function (r) {
          if (fig) fig.classList.remove('lendo');
          if (r.error) { falhas++; explicarFalha(r.error, true); return; }
          juntar(r.data || {});
        }, function (e) { if (fig) fig.classList.remove('lendo'); falhas++; dizer('ele', (e && e.message) || 'Não consegui ler essa foto agora.', null, { sistema: true }); });
      });
    }, Promise.resolve()).then(function () {
      pensando(false);
      if (st.usos) { st.usos.fotos = (Number(st.usos.fotos) || 0) + validos.length - falhas; }
      var total = juntos.categorias.reduce(function (n, c) { return n + c.itens.length; }, 0);
      if (!total && !juntos.promocoes.length) { if (!falhas) dizer('ele', juntos.aviso || 'Não achei nenhum item nessas fotos. Tente com mais luz, mais perto ou sem cortar as bordas.', null, { sistema: true }); return; }
      mostrarLido(juntos, servico);
      // bordas e adicionais não viram item: só avisa onde cadastrar
      if (juntos.extras.length) dizer('ele', 'Vi também: ' + juntos.extras.slice(0, 6).map(function (x) { return x.nome + (x.preco ? ' (+R$ ' + Number(x.preco).toFixed(2).replace('.', ',') + ')' : ''); }).join(', ') + '. Isso você cadastra em Cardápio → Bordas — ou peça aqui: "adiciona a borda catupiry por 8".', null, { semSalvar: true, sistema: true });
    });
  }

  /* Antes, qualquer tropeço virava "Não consegui ler essa foto" — e aí não
     dava pra saber se foi a foto, a conexão, a fila do Google ou a conta.
     Agora cada caso diz o que é, e o que fazer. */
  function explicarFalha(erro, jaTratou) {
    var ctx = erro && erro.context;
    var status = (ctx && ctx.status) || 0;
    var fechar = function (msg) { dizer('ele', msg); };
    var porStatus = function (recado) {
      if (status === 503) return fechar(recado || 'A IA está congestionada neste momento. Espere uns segundos e mande a foto de novo.');
      if (status === 401) return fechar('Sua sessão caiu. Entre de novo e mande a foto.');
      if (status === 413) return fechar('Essa foto é pesada demais pro envio. Tire de mais perto, ou em partes.');
      if (status === 504 || status === 502) return fechar('A leitura demorou demais e caiu. Tente de novo em um instante.');
      if (status) return fechar(recado || ('Não consegui ler essa foto agora (erro ' + status + ').'));
      return fechar('Não cheguei a mandar a foto — parece falta de conexão. Confere a internet e tenta de novo.');
    };
    // o servidor manda o motivo em JSON; quando não vier, o status já diz muito
    if (ctx && typeof ctx.json === 'function') {
      ctx.json().then(function (j) { porStatus(j && j.erro); }, function () { porStatus(null); });
      return;
    }
    porStatus(null);
  }

  /* O que a IA leu vira um cartão: cada item é uma linha com um interruptor,
     desenhado em código, tudo ligado de partida. O dono desliga o que não é do
     cardápio, toca no nome ou no preço pra corrigir, e só então manda pôr no
     site. Nada entra sozinho. */
  var brl = function (v) { return Number(v) ? Number(v).toFixed(2).replace('.', ',') : ''; };

  function mostrarLido(dados, servico) {
    var pegar = st.cfg.nomesDoCardapio ? st.cfg.nomesDoCardapio() : Promise.resolve([]);
    pegar.then(function (nomes) { renderLido(dados, servico, (nomes || []).map(norm)); }, function () { renderLido(dados, servico, []); });
  }
  function renderLido(dados, servico, existentes) {
    var cats = dados.categorias || [];
    var promos = servico ? [] : (dados.promocoes || []);
    lidoPromos = promos;
    var total = cats.reduce(function (n, c) { return n + (c.itens || []).length; }, 0);
    if (!total && !promos.length) { dizer('ele', dados.aviso || 'Não achei nenhum item nessa foto. Tente com mais luz, mais perto ou sem cortar as bordas.'); return; }
    lido = cats;
    var o = servico ? 'serviço' : 'item';
    var textoPromo = promos.length ? (promos.length === 1 ? 'Achei 1 promoção' : 'Achei ' + promos.length + ' promoções') : '';
    var jaConta = cats.reduce(function (n, c) { return n + (c.itens || []).filter(function (it) { return existentes.indexOf(norm(it.nome)) !== -1; }).length; }, 0);
    var semPreco = cats.reduce(function (n, c) { return n + (c.itens || []).filter(function (it) { return !Number(it.preco); }).length; }, 0);
    var aviso = dizer('ele', (total ? 'Li ' + total + (total === 1 ? ' ' + o : ' ' + (servico ? 'serviços' : 'itens')) + ' em ' + cats.length + (cats.length === 1 ? ' categoria' : ' categorias') + (textoPromo ? ' e ' + textoPromo.toLowerCase() : '') : textoPromo) +
      '. Deixe ligado o que entra no ' + (servico ? 'catálogo' : 'cardápio') + ' — e toque no nome ou no preço pra corrigir.' +
      (jaConta ? ' ' + jaConta + (jaConta === 1 ? ' já existe e veio desligado' : ' já existem e vieram desligados') + ', pra não duplicar.' : '') +
      (semPreco ? ' ' + semPreco + (semPreco === 1 ? ' está' : ' estão') + ' sem preço (em destaque).' : ''), null, { semSalvar: true });

    var i = 0;
    var corpo = cats.map(function (cat, ci) {
      var linhas = (cat.itens || []).map(function (it, ii) {
        var delay = Math.min(i++, 14) * 38; // só os primeiros entram em sequência: o resto já está lá
        var jaTem = existentes.indexOf(norm(it.nome)) !== -1; // já está no cardápio: começa desligado, pra não duplicar
        return '<div class="fn-pz' + (jaTem ? ' fn-pz-ja' : '') + '" data-ci="' + ci + '" data-ii="' + ii + '" style="--d:' + delay + 'ms">' +
          '<label class="fn-tg" aria-label="Usar ' + esc(it.nome) + '"><input type="checkbox"' + (jaTem ? '' : ' checked') + '><i></i></label>' +
          '<div class="fn-pz-meio">' +
            '<input class="fn-pz-nome" type="text" value="' + esc(it.nome) + '" maxlength="80" aria-label="Nome">' +
            (jaTem ? '<span class="fn-pz-tag">já está no cardápio</span>' : '') +
            (it.descricao ? '<span class="fn-pz-desc">' + esc(it.descricao) + '</span>' : '') +
          '</div>' +
          '<span class="fn-pz-moeda"><em>R$</em><input class="fn-pz-preco' + (Number(it.preco) ? '' : ' vazio') + '" type="text" inputmode="decimal" value="' + brl(it.preco) + '" placeholder="preço" aria-label="Preço"></span>' +
          '</div>';
      }).join('');
      return '<section class="fn-pz-cat" data-cat="' + ci + '">' +
        '<header><label class="fn-tg fn-tg-cat" aria-label="Ligar ou desligar toda a categoria ' + esc(cat.nome) + '"><input type="checkbox" checked data-fn-cat><i></i></label>' +
        '<h4>' + esc(cat.nome) + '</h4><small data-fn-cat-conta>' + (cat.itens || []).length + '</small></header>' + linhas + '</section>';
    }).join('');

    if (promos.length) {
      corpo += '<section class="fn-pz-cat fn-pz-promos" data-cat="promo"><header><label class="fn-tg fn-tg-cat" aria-label="Ligar ou desligar todas as promoções"><input type="checkbox" checked data-fn-cat><i></i></label>' +
        '<h4>Promoções</h4><small data-fn-cat-conta>' + promos.length + '</small></header>' +
        promos.map(function (pr, pi) {
          var q = Number(pr.qtd_sabores) || 1;
          return '<div class="fn-pz fn-pr" data-pi="' + pi + '" style="--d:' + Math.min(i++, 14) * 38 + 'ms">' +
            '<label class="fn-tg" aria-label="Usar ' + esc(pr.nome) + '"><input type="checkbox" checked><i></i></label>' +
            '<div class="fn-pz-meio"><input class="fn-pz-nome" type="text" value="' + esc(pr.nome) + '" maxlength="80" aria-label="Nome da promoção">' +
            '<span class="fn-pz-desc">' + (q > 1 ? 'cliente escolhe ' + q + ' sabores' : 'combo') + (pr.descricao ? ' · ' + esc(pr.descricao) : '') + '</span></div>' +
            '<span class="fn-pz-moeda"><em>R$</em><input class="fn-pz-preco' + (Number(pr.preco) ? '' : ' vazio') + '" type="text" inputmode="decimal" value="' + brl(pr.preco) + '" placeholder="preço" aria-label="Preço da promoção"></span></div>';
        }).join('') + '</section>';
    }

    var c = document.getElementById('fnConversa');
    if (!c) return;
    var cartao = document.createElement('div');
    cartao.className = 'fn-cardapio';
    cartao.innerHTML = corpo +
      '<footer class="fn-cardapio-pe">' +
        '<button type="button" class="fn-cardapio-cancelar" data-fn-cardapio-cancelar>Agora não</button>' +
        '<button type="button" class="fn-cardapio-salvar" data-fn-cardapio-salvar><span data-fn-cardapio-txt></span></button>' +
      '</footer>';
    c.appendChild(cartao);
    contarMarcados(cartao);
    // abre no COMEÇO: a frase do bot e as primeiras linhas (são muitos itens, não dá pra ir até o fim).
    // Mede pela tela — offsetTop contava a partir da folha inteira e jogava a rolagem lá pra baixo.
    setTimeout(function () {
      var alvo = aviso || cartao;
      c.scrollTop += alvo.getBoundingClientRect().top - c.getBoundingClientRect().top - 10;
    }, 80);
  }

  // quantos estão ligados: o botão diz "Pôr 31 no cardápio" e acompanha cada toque
  function contarMarcados(cartao) {
    var itens = cartao.querySelectorAll('.fn-pz');
    var ligados = 0;
    itens.forEach(function (l) {
      var on = l.querySelector('.fn-tg input').checked;
      l.classList.toggle('fn-pz-off', !on);
      if (on) ligados++;
    });
    cartao.querySelectorAll('.fn-pz-cat').forEach(function (sec) {
      var linhas = sec.querySelectorAll('.fn-pz'), on = 0;
      linhas.forEach(function (l) { if (l.querySelector('.fn-tg input').checked) on++; });
      sec.querySelector('[data-fn-cat]').checked = on === linhas.length;
      sec.querySelector('[data-fn-cat-conta]').textContent = on === linhas.length ? linhas.length : on + ' de ' + linhas.length;
    });
    var b = cartao.querySelector('[data-fn-cardapio-salvar]');
    b.disabled = ligados === 0;
    b.querySelector('[data-fn-cardapio-txt]').textContent = ligados === 0 ? 'Nada ligado' : 'Pôr ' + ligados + (ligados === 1 ? ' item' : ' itens') + ' no site';
  }

  function finalizarCardapio(cartao) {
    if (!cartao || !lido) return;
    var saida = [];
    lido.forEach(function (cat, ci) {
      var itens = [];
      cartao.querySelectorAll('.fn-pz[data-ci="' + ci + '"]').forEach(function (l) {
        if (!l.querySelector('.fn-tg input').checked) return;
        var nome = l.querySelector('.fn-pz-nome').value.trim();
        if (!nome) return;
        var preco = parseFloat(l.querySelector('.fn-pz-preco').value.replace(/\./g, '').replace(',', '.')) || 0;
        var original = (cat.itens || [])[Number(l.getAttribute('data-ii'))] || {};
        itens.push({ nome: nome, descricao: original.descricao || '', preco: preco });
      });
      if (itens.length) saida.push({ nome: cat.nome, itens: itens });
    });
    var promocoes = [];
    cartao.querySelectorAll('.fn-pr').forEach(function (l) {
      if (!l.querySelector('.fn-tg input').checked) return;
      var nome = l.querySelector('.fn-pz-nome').value.trim();
      if (!nome) return;
      var original = (lidoPromos || [])[Number(l.getAttribute('data-pi'))] || {};
      promocoes.push({ nome: nome, descricao: original.descricao || '', qtd_sabores: original.qtd_sabores || 1,
        preco: parseFloat(l.querySelector('.fn-pz-preco').value.replace(/\./g, '').replace(',', '.')) || 0 });
    });
    var n = saida.reduce(function (t, c) { return t + c.itens.length; }, 0) + promocoes.length;
    if (!n) { dizer('ele', 'Não tem nada ligado, então não tenho o que pôr.'); return; }
    cartao.remove();
    dizer('eu', 'Pôr ' + n + (n === 1 ? ' item' : ' itens') + ' no site');
    executar('salvar_cardapio_lido', { categorias: saida, promocoes: promocoes }, true);
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
  var CHAVE_PEND = 'vbFnPend_';
  function marcarPend(texto) { try { localStorage.setItem(CHAVE_PEND + st.estabId, JSON.stringify({ texto: texto, ts: Date.now() })); } catch (e) {} }
  function limparPend() { try { localStorage.removeItem(CHAVE_PEND + st.estabId); } catch (e) {} }
  function lerPend() { try { return JSON.parse(localStorage.getItem(CHAVE_PEND + st.estabId) || 'null'); } catch (e) { return null; } }

  // comandos que começam com "/" rodam aqui mesmo: rápidos e sem gastar a IA
  function comandoLocal(texto) {
    var m = /^\/([a-zçã]+)\s*(.*)$/i.exec(texto.trim());
    if (!m) return false;
    var cmd = norm(m[1]), arg = norm(m[2]);
    var abrirAba = function (aba) { if (st.cfg.acoes && st.cfg.acoes.abrir_aba) { fechar(); st.cfg.acoes.abrir_aba({ aba: aba }); } };
    if (cmd === 'ajuda' || cmd === 'help') {
      dizer('ele', 'Comandos disponíveis (ou peça em português normal):', '<ul class="fn-cmds">' + COMANDOS_AJUDA.map(function (x) { return '<li><button type="button" data-fn-cmd="' + esc(x[0]) + '">' + esc(x[0]) + '</button><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul>', { semSalvar: true, semDigitar: true });
      return true;
    }
    if (cmd === 'dashboard' || cmd === 'ganhos' || cmd === 'grafico') { mostrarDashboard(diasDe(arg)); return true; }
    if (cmd === 'foto' || cmd === 'cardapio-foto') { var f = document.getElementById('fnArquivo'); if (f) f.click(); return true; }
    if (cmd === 'cardapio') { abrirAba('cardapio'); return true; }
    if (cmd === 'caixa') { abrirAba('caixa'); return true; }
    if (cmd === 'pedidos') { abrirAba('pedidos'); return true; }
    if (cmd === 'clientes') { abrirAba('clientes'); return true; }
    if (cmd === 'tour') { if (st.cfg.acoes && st.cfg.acoes.abrir_tour) { fechar(); st.cfg.acoes.abrir_tour({}); } return true; }
    if (cmd === 'desfazer') {
      var btns = document.querySelectorAll('#fnConversa [data-fn-desfazer]');
      if (!btns.length) dizer('ele', 'Não tenho nada para desfazer agora.', null, { semSalvar: true });
      else btns[btns.length - 1].click();
      return true;
    }
    if (cmd === 'uso') {
      usoHoje().then(function (u) {
        mostrarUso();
        if (!u) dizer('ele', 'O contador de uso ainda não está ligado neste app.', null, { semSalvar: true });
        else dizer('ele', 'Hoje você usou ' + (u.mensagens || 0) + ' de ' + u.limite_mensagens + ' mensagens e ' + (u.fotos || 0) + ' de ' + u.limite_fotos + ' fotos. O limite zera à meia-noite.', null, { semSalvar: true });
      });
      return true;
    }
    if (cmd === 'limpar' || cmd === 'clear') {
      var cv = document.getElementById('fnConversa'); if (cv) cv.innerHTML = '';
      dizer('ele', 'Tela limpa. O histórico continua salvo — ele volta quando você abrir de novo.', null, { semSalvar: true, semDigitar: true });
      return true;
    }
    dizer('ele', 'Não conheço o comando /' + m[1] + '. Digite /ajuda.', null, { semSalvar: true, semDigitar: true });
    return true;
  }
  function diasDe(arg) {
    if (/mens|mes|30/.test(arg)) return 30;
    var n = parseInt(arg, 10);
    return [1, 3, 5, 7, 15, 30].indexOf(n) !== -1 ? n : 7;
  }

  function contexto() {
    var c = { nome_assistente: st.nome || null, negocio: st.cfg.negocio, areas: st.cfg.areas || [] };
    if (st.cfg.resumo) { try { c.resumo = st.cfg.resumo(); } catch (e) {} }
    return c;
  }

  // paraIA: o que vai de verdade pra IA (quando o que aparece na tela é um resumo, ex.: "Me explica esses números")
  function mandar(texto, paraIA) {
    dizer('eu', texto);
    // o dono respondendo a um "tem certeza?"
    if (st.pendente) {
      var sim = /^(s|sim|isso|pode|confirma|manda|vai|ok|claro|uhum|certo)\b/i.test(texto.trim());
      var p = st.pendente; st.pendente = null;
      if (sim) { executar(p.nome, p.args, true); return; }
      dizer('ele', 'Tudo bem, deixei como estava.');
      return;
    }
    if (/^\//.test(texto.trim())) { comandoLocal(texto); return; }
    marcarPend(texto);
    pensando(true);
    global.db.functions.invoke('assistente', {
      body: { texto: paraIA || texto, contexto: contexto(), historico: st.hist.slice(-7), estabId: st.estabId }
    }).then(function (r) {
      pensando(false); limparPend();
      if (r.error) {
        var ctx = r.error.context;
        var fala = function (t) { dizer('ele', t || 'Não consegui agora.', null, { sistema: true }); };
        if (ctx && ctx.json) return ctx.json().then(function (j) { fala((j && j.erro) || 'Não consegui agora.'); }, function () { fala(); });
        fala();
        return;
      }
      var d = r.data || {};
      if (st.usos) { st.usos.mensagens = (Number(st.usos.mensagens) || 0) + 1; mostrarUso(); }
      if (d.fala) dizer('ele', d.fala);
      if (d.acao) executar(d.acao.nome, d.acao.args || {});
    }, function () { pensando(false); dizer('ele', 'Sem conexão agora. Tente de novo em instantes.', null, { sistema: true }); });
  }

  // ações que mexem em alguma coisa pedem confirmação antes
  var PRECISA_SIM = ['confirmar_agendamento', 'concluir_agendamento', 'cancelar_agendamento', 'avancar_pedido', 'cancelar_pedido', 'lancar_venda',
    'limpar_cardapio', 'remover_item', 'remover_categoria', 'remover_borda', 'remover_combo', 'remover_servico', 'remover_profissional', 'remover_venda', 'apagar_promocao'];
  // o que o bot vai fazer, dito claramente, antes do "sim" (sobretudo o que apaga e não dá pra desfazer)
  function textoConfirma(nome, a) {
    a = a || {};
    var q = function (v) { return '"' + String(v || '').slice(0, 40) + '"'; };
    var t = {
      limpar_cardapio: 'Vou apagar TODOS os itens e categorias do cardápio. Isso não dá pra desfazer. Responda sim pra eu apagar tudo.',
      remover_item: 'Vou apagar ' + q(a.nome) + ' do cardápio. Responda sim pra eu seguir.',
      remover_categoria: 'Vou apagar a categoria ' + q(a.nome) + '. Responda sim pra eu seguir.',
      remover_borda: 'Vou apagar a borda ' + q(a.nome) + '. Responda sim pra eu seguir.',
      remover_combo: 'Vou apagar o combo ' + q(a.nome) + '. Responda sim pra eu seguir.',
      remover_servico: 'Vou apagar o serviço ' + q(a.nome) + '. Responda sim pra eu seguir.',
      remover_profissional: 'Vou tirar ' + q(a.nome) + ' da equipe. Responda sim pra eu seguir.',
      remover_venda: 'Vou apagar essa venda do caixa de hoje. Responda sim pra eu seguir.',
      apagar_promocao: 'Vou apagar a promoção ' + q(a.titulo || a.nome) + '. Responda sim pra eu seguir.'
    };
    return t[nome] || 'Posso fazer? Responda sim pra eu seguir.';
  }
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
    if (nome === 'mostrar_dashboard') { mostrarDashboard(diasDe(norm(String(args.dias || '')))); return; }
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
      dizer('ele', textoConfirma(nome, args));
      return;
    }
    // salvar um cardápio inteiro leva um tempo: mostra o "pensando…" até acabar
    var demora = nome === 'salvar_cardapio_lido';
    if (demora) pensando(true);
    Promise.resolve().then(function () { return fn(args); }).then(function (txt) {
      if (demora) pensando(false);
      // se a ação dá pra reverter, a mensagem leva o botão "Desfazer" (e fica salva com os passos)
      var d = st.cfg.pegarDesfazer ? st.cfg.pegarDesfazer() : null;
      if (txt) dizer('ele', String(txt), null, { acao: nome, desfazer: d });
    }, function (e) {
      if (demora) pensando(false);
      dizer('ele', (e && e.message) || 'Não deu certo dessa vez.');
    });
  }


  /* ---------- a sessão: tela de carregamento, histórico, aviso do que ficou pendente ---------- */
  function boot() {
    return new Promise(function (ok) {
      var el = document.getElementById('fnBoot');
      var dados = { rows: [], uso: null }, real = false;
      Promise.all([Hist.carregar(), usoHoje()]).then(function (x) { dados.rows = x[0] || []; dados.uso = x[1]; real = true; }, function () { real = true; });
      if (!el) { var espera = setInterval(function () { if (real) { clearInterval(espera); ok(dados); } }, 60); return; }
      var reduz = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var MIN = reduz ? 900 : 3000;
      var log = el.querySelector('#fnBootLog'), dica = el.querySelector('#fnBootDica'), barra = el.querySelector('.fn-boot-barra i'), num = el.querySelector('#fnBootNum'), pular = el.querySelector('#fnBootPular');
      var script = ['> iniciando terminal matriz v1.0', '> abrindo a sessão de ' + comoChamar().toLowerCase(), '> carregando o histórico da conversa', '> conferindo o seu limite de hoje', '> conectando com a IA', '> pronto.'];
      var t0 = Date.now(), fim = false, linha = 0, iDica = Math.floor(Math.random() * CURIOSIDADES.length), tick, roda;
      function terminar() {
        if (fim) return; fim = true;
        clearInterval(tick); clearInterval(roda);
        el.classList.add('saindo');
        setTimeout(function () { if (el.parentNode) el.remove(); ok(dados); }, 380);
      }
      tick = setInterval(function () {
        var dt = Date.now() - t0, prog = Math.min(1, dt / MIN);
        var alvo = Math.min(script.length, Math.floor(prog * script.length) + 1);
        while (linha < alvo) { log.textContent += script[linha] + '\n'; linha++; }
        barra.style.width = Math.round(prog * 100) + '%'; num.textContent = Math.round(prog * 100) + '%';
        if (prog >= 1 && real) terminar();
        if (dt > 1200 && real) pular.classList.add('on');
      }, 80);
      function mostrarDica() {
        dica.classList.remove('on');
        setTimeout(function () { dica.textContent = CURIOSIDADES[iDica % CURIOSIDADES.length]; iDica++; dica.classList.add('on'); }, 200);
      }
      mostrarDica(); roda = setInterval(mostrarDica, 2400);
      pular.addEventListener('click', function () { if (real) terminar(); });
      // se o banco demorar demais, entra do mesmo jeito (o histórico do aparelho vale)
      setTimeout(function () { real = true; }, 8000);
    });
  }
  function nomeDoDia(iso) {
    var d = new Date(iso), h = new Date(), ontem = new Date(Date.now() - 86400000);
    var igual = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
    if (igual(d, h)) return 'hoje'; if (igual(d, ontem)) return 'ontem';
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  }
  function renderHistorico(rows) {
    var c = document.getElementById('fnConversa'); if (!c) return;
    var ultimoDia = '';
    (rows || []).forEach(function (r) {
      var dia = nomeDoDia(r.criado_em);
      if (dia !== ultimoDia) { ultimoDia = dia; var sep = document.createElement('div'); sep.className = 'fn-dia'; sep.textContent = dia; c.appendChild(sep); }
      var extra = '';
      var m = /^mostrar_dashboard:(\d+)$/.exec(r.acao || '');
      if (m) extra = '<div class="fn-desf"><button type="button" class="fn-desf-btn" data-fn-dias="' + m[1] + '">▤ ver o dashboard de novo</button></div>';
      dizer(r.papel, r.texto, extra, { restaurar: true, id: r.id, acao: r.acao, desfazer: r.desfazer, desfeito: !!r.desfeito_em, criado: r.criado_em });
    });
    if ((rows || []).length) { var fimSep = document.createElement('div'); fimSep.className = 'fn-dia'; fimSep.textContent = 'agora'; c.appendChild(fimSep); }
  }
  function verificarPendente(rows) {
    var pend = lerPend();
    if (!pend) return;
    limparPend();
    var ultima = (rows || [])[(rows || []).length - 1];
    if (Date.now() - pend.ts > 20 * 60000) return;
    if (ultima && ultima.papel === 'ele' && new Date(ultima.criado_em).getTime() > pend.ts) return; // já foi respondido
    dizer('ele', 'A página fechou enquanto eu respondia "' + String(pend.texto).slice(0, 60) + '". Quer que eu tente de novo?',
      '<div class="fn-desf"><button type="button" class="fn-desf-btn" data-fn-repetir="' + esc(pend.texto) + '">↻ tentar de novo</button></div>', { semSalvar: true, semDigitar: true, sistema: true });
  }
  function iniciarSessao() {
    return boot().then(function (d) {
      st.usos = d.uso; mostrarUso();
      var cv = document.getElementById('fnConversa'); if (!cv) return;
      renderHistorico(d.rows);
      if (!(d.rows || []).length) dizer('ele', 'Oi! Sou ' + st.nome + '. Terminal pronto: digite /ajuda ou peça em português — confirmar horário, lançar venda, mexer no cardápio, mostrar o dashboard…', null, { sistema: true });
      else dizer('ele', 'Conversa anterior restaurada. Digite /ajuda para ver os comandos.', null, { semSalvar: true, semDigitar: true, sistema: true });
      verificarPendente(d.rows);
      st.pronto = true;
      cv.scrollTop = cv.scrollHeight;
      focar();
    });
  }

  /* ---------- dashboard dentro do chat: números + gráfico, e a IA explica se pedir ---------- */
  function rotuloDias(d) { return d === 1 ? 'hoje' : d === 30 ? 'mensal (30 dias)' : d + ' dias'; }
  function blocoDashboard(d) {
    var r = d.r || {}, f = d.formatar || function (v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); };
    var total = Number(r.total_periodo) || 0, serie = r.faturamento_por_dia || [];
    var delta = '';
    if (d.anterior != null) {
      if (d.anterior > 0) { var pct = Math.round(((total - d.anterior) / d.anterior) * 100); delta = '<span class="fn-delta ' + (pct > 0 ? 'sobe' : pct < 0 ? 'desce' : '') + '">' + (pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '= ') + Math.abs(pct) + '% vs período anterior</span>'; }
      else if (total > 0) delta = '<span class="fn-delta sobe">▲ período anterior sem vendas</span>';
    }
    var mov = (Number(r.pedidos_periodo) || 0) + (Number(r.agendamentos_periodo) || 0);
    var melhor = serie.reduce(function (m, x) { return Number(x.total) > Number(m.total || 0) ? x : m; }, {});
    var kpis = [['hoje', f(r.total_hoje || 0)], ['média/dia', f(d.dias ? total / d.dias : 0)]];
    if (d.temPedidos) kpis.push(['pedidos', String(r.pedidos_periodo || 0)]);
    if (d.temAgenda) kpis.push(['agendamentos', String(r.agendamentos_periodo || 0)]);
    if (mov) kpis.push(['ticket médio', f(total / mov)]);
    kpis.push(['clientes novos', String(r.clientes_novos_periodo || 0)]);
    if (melhor.dia && Number(melhor.total) > 0) kpis.push(['melhor dia', esc(melhor.dia) + ' · ' + f(melhor.total)]);
    var top = (r.top_servicos || []).slice(0, 3);
    var resumo = JSON.stringify({ periodo_dias: d.dias, faturado: total, periodo_anterior: d.anterior, faturado_hoje: r.total_hoje, pedidos: r.pedidos_periodo, agendamentos: r.agendamentos_periodo, clientes_novos: r.clientes_novos_periodo, ticket_medio: mov ? Math.round(total / mov * 100) / 100 : null, melhor_dia: melhor.dia || null, mais_vendidos: top.map(function (t) { return t.nome + ' (' + t.qtd + ')'; }) });
    return '<div class="fn-dash">' +
      '<div class="fn-dash-topo"><span>DASHBOARD</span><span>' + esc(rotuloDias(d.dias)) + '</span></div>' +
      '<div class="fn-dash-big"><small>FATURADO</small><b>' + esc(f(total)) + '</b>' + delta + '</div>' +
      '<div class="fn-dash-kpis">' + kpis.map(function (k) { return '<div><span>' + esc(k[0]) + '</span><b>' + k[1] + '</b></div>'; }).join('') + '</div>' +
      (global.VBGrafico && serie.some(function (x) { return Number(x.total) > 0; }) ? global.VBGrafico.barras(serie, { tema: 'terminal', formatar: f }) : '<p class="fn-dash-vazio">Sem vendas neste período.</p>') +
      (top.length ? '<ol class="fn-dash-top">' + top.map(function (t) { return '<li><span>' + esc(t.nome) + '</span><b>' + esc(f(t.total)) + '</b></li>'; }).join('') + '</ol>' : '') +
      '<div class="fn-dash-per">' + [1, 3, 5, 7, 15, 30].map(function (n) { return '<button type="button" class="' + (n === d.dias ? 'on' : '') + '" data-fn-dias="' + n + '">' + (n === 30 ? 'mensal' : n + 'd') + '</button>'; }).join('') + '</div>' +
      '<div class="fn-dash-acoes"><button type="button" data-fn-explicar="' + esc(resumo) + '">✦ Me explica esses números</button><button type="button" data-fn-abrir-ganhos>Abrir Ganhos</button></div>' +
      '</div>';
  }
  function mostrarDashboard(dias) {
    if (!st.cfg || !st.cfg.dashboard) { dizer('ele', 'O dashboard não está disponível aqui.', null, { semSalvar: true, sistema: true }); return; }
    pensando(true);
    st.cfg.dashboard(dias).then(function (d) {
      pensando(false);
      dizer('ele', 'Dashboard · ' + rotuloDias(dias), blocoDashboard(d), { acao: 'mostrar_dashboard:' + dias, semDigitar: true });
    }, function (e) { pensando(false); dizer('ele', (e && e.message) || 'Não consegui ler os números agora.', null, { sistema: true }); });
  }

  // o botão "Desfazer" de uma mensagem: roda os passos guardados e marca como desfeito (também no histórico)
  function desfazerDaMensagem(btn) {
    var msg = btn.closest('.fn-msg'), d = msg && msg._desf;
    if (!d || !st.cfg.desfazer) return;
    var rot = btn.textContent;
    btn.disabled = true; btn.textContent = '↩ desfazendo…';
    st.cfg.desfazer(d.passos).then(function () {
      var id = msg.getAttribute('data-id'); if (id) Hist.desfeito(id);
      msg._desf = null;
      if (btn.parentNode) btn.parentNode.innerHTML = '<span class="fn-desfeito">↩ desfeito</span>';
      dizer('ele', 'Desfeito: ' + (d.texto || 'voltei como estava') + '.', null, { sistema: true });
    }, function (e) { btn.disabled = false; btn.textContent = rot; dizer('ele', 'Não consegui desfazer: ' + ((e && e.message) || 'tente de novo') + '.', null, { sistema: true }); });
  }

  global.VBFuncionario = { montar: montar, abrir: abrir, nome: function () { return st.nome; }, dizer: dizer, _cfg: function () { return st.cfg; } };
})(window);
