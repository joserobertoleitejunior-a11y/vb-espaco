/* Anunciar (anunciar.html): o dono publica um anúncio que aparece nos
   painéis "Anuncie aqui" da busca (guia.js). Um passo de cada vez, com a
   prévia do painel do jeitinho que o cliente vai ver:
     1. qual negócio (se tiver mais de um)
     2. onde aparece: Agendar / Pedir / Chamar, pra todos ou só pra quem
        procura o seu tipo de negócio
     3. título, texto e foto
     4. quantos dias
   Na fase de finalização é grátis (aviso-gratis.js). Embaixo, os anúncios
   já publicados, com quantas vezes apareceram e quantos tocaram. */
(function () {
  'use strict';
  var db = window.db;
  var raiz = document.getElementById('anuConteudo');
  if (!db || !raiz) return;
  var SEG = window.VibeSegmentos;

  var AREAS = {
    agenda: { rotulo: 'Agendar', onde: 'quem está procurando onde agendar' },
    delivery: { rotulo: 'Pedir', onde: 'quem está escolhendo o que pedir' },
    servicos: { rotulo: 'Chamar', onde: 'quem precisa chamar um profissional' }
  };
  var DIAS = [7, 15, 30];

  var negocios = [], neg = null, areasNeg = [];
  var f = { area: null, soSegmento: true, titulo: '', texto: '', foto: null, dias: 15 };
  var enviandoFoto = false, publicando = false;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dataBr(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1]; }
  function fimPrevisto(dias) { var d = new Date(); d.setDate(d.getDate() + dias - 1); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }

  /* ---------- sem login / sem negócio ---------- */
  function semLogin() {
    raiz.innerHTML = '<div class="anu-card anu-centro">' +
      '<p class="anu-card-titulo">Entre com a conta do seu negócio</p>' +
      '<p class="anu-ajuda">O anúncio fica ligado ao seu site — por isso precisa entrar primeiro. Depois de entrar, você volta direto pra cá.</p>' +
      '<a class="btn btn-primario anu-largo" href="/cadastro.html?depois=anunciar">Entrar pra anunciar</a>' +
      '<a class="btn btn-ghost anu-largo" href="/criar.html">Ainda não tenho site — criar grátis</a></div>';
  }
  function semNegocio() {
    raiz.innerHTML = '<div class="anu-card anu-centro">' +
      '<p class="anu-card-titulo">Primeiro, o seu site</p>' +
      '<p class="anu-ajuda">O anúncio leva o cliente pro seu site na Matriz. Crie o seu (é grátis e leva poucos minutos) e volte pra anunciar.</p>' +
      '<a class="btn btn-primario anu-largo" href="/criar.html">Criar meu site grátis</a></div>';
  }

  /* ---------- prévia: o mesmo painel que aparece na busca ---------- */
  function previaHtml() {
    var foto = f.foto || (neg && (neg.foto_capa_url || neg.foto_hero_url));
    return '<div class="anu-previa-moldura"><p class="anu-previa-legenda">Assim aparece na busca</p>' +
      '<a class="guia-anuncio" style="--cor:' + esc((neg && neg.cor_destaque) || '#0F6B5C') + ';" tabindex="-1" aria-hidden="true">' +
      '<span class="guia-anuncio-rotulo">Patrocinado</span>' +
      '<span class="guia-anuncio-capa"' + (foto ? ' style="background-image:url(\'' + esc(foto) + '\')"' : '') + '></span>' +
      '<span class="guia-anuncio-nome">' + esc(f.titulo || (neg && neg.nome) || 'Seu negócio') + '</span>' +
      '<span class="guia-anuncio-txt">' + esc(f.texto || 'Uma frase que faça o cliente tocar.') + ' →</span>' +
      '</a></div>';
  }

  function chips(nome, opcoes, atual) {
    return '<div class="anu-chips" data-campo="' + nome + '">' + opcoes.map(function (o) {
      return '<button type="button" class="anu-chip' + (String(o[0]) === String(atual) ? ' ativo' : '') + '" data-v="' + esc(o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  function desenhar() {
    var segNome = SEG ? SEG.nome(neg.segmento) : 'seu tipo de negócio';
    var pronto = f.area && f.titulo.trim().length >= 2 && f.texto.trim().length >= 2 && !enviandoFoto;
    raiz.innerHTML =
      (negocios.length > 1 ? '<section class="anu-passo"><p class="anu-passo-n">1</p><div class="anu-passo-corpo"><p class="anu-pergunta">Qual negócio?</p>' +
        chips('negocio', negocios.map(function (n) { return [n.id, esc(n.nome)]; }), neg.id) + '</div></section>' : '') +

      '<section class="anu-passo"><p class="anu-passo-n">' + (negocios.length > 1 ? 2 : 1) + '</p><div class="anu-passo-corpo"><p class="anu-pergunta">Onde aparece?</p>' +
      chips('area', areasNeg.map(function (a) { return [a, AREAS[a].rotulo]; }), f.area) +
      (f.area ? '<p class="anu-ajuda">Na busca de <strong>' + AREAS[f.area].rotulo + '</strong>, pra ' + AREAS[f.area].onde + '.</p>' +
        chips('soSegmento', [['1', 'Só quem procura ' + esc(segNome.toLowerCase())], ['0', 'Todo mundo em ' + AREAS[f.area].rotulo]], f.soSegmento ? '1' : '0') : '') +
      '</div></section>' +

      '<section class="anu-passo"><p class="anu-passo-n">' + (negocios.length > 1 ? 3 : 2) + '</p><div class="anu-passo-corpo"><p class="anu-pergunta">O que o anúncio diz?</p>' +
      '<label class="anu-campo"><span>Título <small id="anuContaTitulo">' + f.titulo.length + '/40</small></span><input id="anuTitulo" maxlength="40" value="' + esc(f.titulo) + '"></label>' +
      '<label class="anu-campo"><span>Texto <small id="anuContaTexto">' + f.texto.length + '/90</small></span><input id="anuTexto" maxlength="90" value="' + esc(f.texto) + '" placeholder="Ex.: corte + barba com 20% off essa semana"></label>' +
      '<div class="anu-foto-linha"><label class="anu-foto-btn">' + (enviandoFoto ? 'Enviando…' : f.foto ? 'Trocar foto' : 'Usar outra foto') + '<input type="file" accept="image/*" id="anuFoto"></label>' +
      (f.foto ? '<button type="button" class="anu-link" data-foto-padrao>Voltar pra foto do site</button>' : '<span class="anu-ajuda" style="margin:0">Sem escolher, vai a foto do seu site.</span>') + '</div>' +
      '</div></section>' +

      '<section class="anu-passo"><p class="anu-passo-n">' + (negocios.length > 1 ? 4 : 3) + '</p><div class="anu-passo-corpo"><p class="anu-pergunta">Por quantos dias?</p>' +
      chips('dias', DIAS.map(function (d) { return [d, d + ' dias']; }), f.dias) +
      '<p class="anu-ajuda">No ar de hoje até <strong>' + fimPrevisto(f.dias) + '</strong>.</p></div></section>' +

      previaHtml() +
      '<button type="button" class="btn btn-primario anu-largo anu-publicar" id="anuPublicar"' + (pronto && !publicando ? '' : ' disabled') + '>' +
      (publicando ? 'Publicando…' : 'Publicar anúncio · grátis agora') + '</button>' +
      '<p class="msg" id="anuMsg"></p>' +
      '<section class="anu-meus" id="anuMeus"></section>';
    ligar();
    carregarMeus();
  }

  function ligar() {
    raiz.querySelectorAll('[data-campo]').forEach(function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('[data-v]');
        if (!b) return;
        var campo = g.getAttribute('data-campo'), v = b.getAttribute('data-v');
        if (campo === 'negocio') { escolherNegocio(v); return; }
        if (campo === 'area') f.area = v;
        if (campo === 'soSegmento') f.soSegmento = v === '1';
        if (campo === 'dias') f.dias = Number(v);
        desenhar();
      });
    });
    var t = document.getElementById('anuTitulo'), x = document.getElementById('anuTexto');
    function aoDigitar() {
      f.titulo = t.value; f.texto = x.value;
      document.getElementById('anuContaTitulo').textContent = f.titulo.length + '/40';
      document.getElementById('anuContaTexto').textContent = f.texto.length + '/90';
      var moldura = raiz.querySelector('.anu-previa-moldura');
      moldura.outerHTML = previaHtml();
      var pronto = f.area && f.titulo.trim().length >= 2 && f.texto.trim().length >= 2 && !enviandoFoto;
      document.getElementById('anuPublicar').disabled = !pronto || publicando;
    }
    t.addEventListener('input', aoDigitar);
    x.addEventListener('input', aoDigitar);
    var foto = document.getElementById('anuFoto');
    foto.addEventListener('change', function () {
      var arq = foto.files && foto.files[0];
      if (!arq || !window.VBUpload) return;
      enviandoFoto = true; desenhar();
      window.VBUpload.uploadFoto(arq, neg.id, 'anuncio').then(function (url) {
        f.foto = url; enviandoFoto = false; desenhar();
      }, function (err) {
        enviandoFoto = false; desenhar();
        window.VBDialogo.alert((err && err.message) || 'Não deu pra enviar a foto agora.');
      });
    });
    var padrao = raiz.querySelector('[data-foto-padrao]');
    if (padrao) padrao.addEventListener('click', function () { f.foto = null; desenhar(); });
    document.getElementById('anuPublicar').addEventListener('click', publicar);
  }

  function publicar() {
    if (publicando) return;
    publicando = true; desenhar();
    db.rpc('tenant_admin_criar_anuncio', {
      p_estabelecimento_id: neg.id, p_area: f.area, p_segmento: f.soSegmento ? neg.segmento : null,
      p_titulo: f.titulo.trim(), p_texto: f.texto.trim(), p_foto_url: f.foto, p_dias: f.dias
    }).then(function (r) {
      publicando = false;
      if (r.error) { desenhar(); var m = document.getElementById('anuMsg'); m.className = 'msg msg-erro'; m.textContent = r.error.message; return; }
      desenhar();
      var m2 = document.getElementById('anuMsg');
      m2.className = 'msg msg-ok';
      m2.textContent = 'Anúncio no ar até ' + dataBr(r.data.fim) + '! Ele já aparece na busca de ' + AREAS[f.area].rotulo + '.';
    }, function () {
      publicando = false; desenhar();
      var m = document.getElementById('anuMsg'); m.className = 'msg msg-erro'; m.textContent = 'Sem conexão agora — tente de novo em instantes.';
    });
  }

  /* ---------- meus anúncios ---------- */
  function carregarMeus() {
    var caixa = document.getElementById('anuMeus');
    db.rpc('tenant_admin_meus_anuncios', { p_estabelecimento_id: neg.id }).then(function (r) {
      var lista = (r && r.data) || [];
      if (!lista.length) { caixa.innerHTML = ''; return; }
      var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      caixa.innerHTML = '<p class="anu-pergunta">Seus anúncios</p>' + lista.map(function (a) {
        var fim = new Date(a.fim + 'T00:00:00');
        var noAr = a.ativo && fim >= hoje;
        var estado = noAr ? 'No ar até ' + dataBr(a.fim) : (fim < hoje ? 'Terminou em ' + dataBr(a.fim) : 'Pausado');
        return '<div class="anu-meu"><div><strong>' + esc(a.titulo) + '</strong><small>' + esc(AREAS[a.area].rotulo) + ' · ' + estado + '</small>' +
          '<small>' + a.vistos + (a.vistos === 1 ? ' vez na tela' : ' vezes na tela') + ' · ' + a.cliques + (a.cliques === 1 ? ' toque' : ' toques') + '</small></div>' +
          (fim >= hoje ? '<button type="button" class="anu-link" data-pausar="' + a.id + '" data-ativo="' + (a.ativo ? '0' : '1') + '">' + (a.ativo ? 'Pausar' : 'Voltar ao ar') + '</button>' : '') +
          '</div>';
      }).join('');
      caixa.querySelectorAll('[data-pausar]').forEach(function (b) {
        b.addEventListener('click', function () {
          db.rpc('tenant_admin_pausar_anuncio', { p_estabelecimento_id: neg.id, p_id: b.getAttribute('data-pausar'), p_ativo: b.getAttribute('data-ativo') === '1' }).then(function (r) {
            if (r.error) window.VBDialogo.alert(r.error.message);
            carregarMeus();
          });
        });
      });
    });
  }

  /* ---------- começo ---------- */
  function escolherNegocio(id) {
    neg = negocios.filter(function (n) { return n.id === id; })[0] || negocios[0];
    f.titulo = neg.nome.slice(0, 40); f.texto = ''; f.foto = null; f.area = null;
    // as áreas que esse negócio tem (Agenda e/ou Pedir/Chamar)
    db.rpc('buscar_estabelecimento', { p_slug: neg.slug, p_cidade: neg.cidade }).then(function (r) {
      var linha = r && r.data && r.data[0];
      areasNeg = (linha && linha.areas) || ['agenda'];
      if (linha) { neg.cor_destaque = linha.cor_destaque; neg.foto_hero_url = neg.foto_hero_url || linha.foto_hero_url; }
      f.area = areasNeg[0];
      desenhar();
    }, function () { areasNeg = ['agenda']; f.area = 'agenda'; desenhar(); });
  }

  db.auth.getSession().then(function (r) {
    if (!r.data || !r.data.session) { semLogin(); return; }
    db.rpc('meus_estabelecimentos_com_stats').then(function (res) {
      negocios = (res && res.data) || [];
      if (!negocios.length) { semNegocio(); return; }
      escolherNegocio(negocios[0].id);
    }, semLogin);
  });
})();
