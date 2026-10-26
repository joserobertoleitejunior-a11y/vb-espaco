/* Passo a passo da busca (tela Explorar): em vez de jogar uma lista na
   cara de quem chega, faz poucas perguntas, uma de cada vez, e cada
   resposta afunila a próxima (só pergunta o que ainda faz diferença
   entre os lugares que sobraram). No fim indica o lugar mais favorável
   e diz o porquê (mais perto, menor preço, promoção, nota dos clientes).

   Dos dois lados da pergunta ficam os painéis de destaque ("Anuncie
   aqui" quando não tem ninguém), com os comentários de clientes
   embaixo. Comentários vêm de avaliacoes_publicas (supabase/sql/
   2026-10-avaliacoes.sql); enquanto essa função não existir no banco,
   os painéis seguem sem comentário.

   API: window.VBGuia.iniciar(area) — chamado pelo catalogo.js ao abrir
   ou trocar de área. */
(function () {
  if (!window.db) return;
  var raiz = document.getElementById('guia');
  if (!raiz) return;

  var NOMES_SEG = {
    barbearia: 'Barbearia', salao: 'Salão de beleza', manicure_pedicure: 'Unhas', estetica: 'Estética',
    estetica_automotiva: 'Estética automotiva', petshop: 'Petshop', pizzaria: 'Pizza', hamburgueria: 'Hambúrguer',
    lanchonete: 'Lanche', restaurante: 'Restaurante', japonesa: 'Comida japonesa', marmitaria: 'Marmita',
    acaiteria: 'Açaí', sorveteria: 'Sorvete', doceria: 'Doces', padaria: 'Padaria', mercado: 'Mercado', adega: 'Bebidas',
    borracharia: 'Borracheiro', chaveiro: 'Chaveiro', guincho: 'Guincho', eletricista: 'Eletricista', encanador: 'Encanador',
    pedreiro: 'Pedreiro e reformas', vidraceiro: 'Vidraceiro', ar_condicionado: 'Ar-condicionado', dedetizacao: 'Dedetização',
    montador: 'Montador de móveis', diarista: 'Diarista', jardinagem: 'Jardinagem', assistencia_tecnica: 'Assistência técnica'
  };
  var VERBO = { agenda: 'agendar', delivery: 'pedir', servicos: 'chamar' };
  var PERGUNTA_SEG = {
    agenda: ['O que você quer cuidar hoje?', 'Escolha um e eu já separo os lugares.'],
    delivery: ['O que bateu vontade?', 'Escolha um e eu já separo as lojas.'],
    servicos: ['Que tipo de ajuda você precisa?', 'Escolha um e eu já separo quem atende.']
  };
  var ANUNCIE = [
    ['Seu negócio aqui', 'bem na hora em que o cliente está escolhendo.'],
    ['Este espaço é seu', 'apareça pra quem está procurando exatamente o que você faz.'],
    ['Anuncie aqui', 'quem chega neste passo já sabe o que quer.']
  ];

  var st = null; // estado da área aberta

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function chave(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  }
  function reais(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(',00', ''); }
  function km(v) { return (v < 1 ? Math.round(v * 1000) + ' m' : String(Math.round(v * 10) / 10).replace('.', ',') + ' km'); }
  function distancia(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function temCoord(e) { return e.endereco_lat != null && e.endereco_lng != null; }
  function link(e) {
    var base = '/' + encodeURIComponent(e.slug) + '/' + encodeURIComponent(e.cidade);
    if (st.area !== 'agenda') return base + '/pedir';
    var s = servicoDoLugar(e);
    return base + '#agendar' + (s ? '=' + encodeURIComponent(s.nome) : '');
  }

  // ---------- dados ----------
  function iniciar(area) {
    st = { area: area, todos: [], servicos: {}, servicosProntos: false, r: {}, local: null, notas: {}, semNotas: false, comentarios: {}, carregando: true };
    desenhar();
    db.rpc('listar_estabelecimentos', { p_cidade: null, p_segmento: null, p_area: area }).then(function (res) {
      if (!st || st.area !== area) return;
      st.todos = (res && res.data) || [];
      st.carregando = false;
      desenhar();
      carregarServicos(area);
      carregarNotas(area);
    }, function () {
      if (!st || st.area !== area) return;
      st.carregando = false; st.erro = true; desenhar();
    });
  }

  function carregarServicos(area) {
    if (area !== 'agenda') { st.servicosProntos = true; return; }
    var lista = st.todos.slice(0, 40);
    Promise.all(lista.map(function (e) {
      return db.rpc('tenant_listar_servicos', { p_estabelecimento_id: e.id }).then(function (r) {
        st.servicos[e.id] = ((r && r.data) || []).filter(function (s) { return s.ativo !== false; });
      }, function () { st.servicos[e.id] = []; });
    })).then(function () {
      if (!st || st.area !== area) return;
      st.servicosProntos = true;
      desenhar();
    });
  }

  function carregarNotas(area) {
    var ids = st.todos.map(function (e) { return e.id; });
    if (!ids.length) return;
    db.rpc('avaliacoes_resumo', { p_ids: ids }).then(function (r) {
      if (!st || st.area !== area) return;
      if (!r || r.error) { st.semNotas = true; return; }
      (r.data || []).forEach(function (n) { st.notas[n.estabelecimento_id] = n; });
      desenhar();
    }, function () { st.semNotas = true; });
  }

  // ---------- funil ----------
  function servicoDoLugar(e) {
    var alvo = st.r.servico;
    if (!alvo || alvo === '*') return null;
    var lista = st.servicos[e.id] || [];
    return lista.filter(function (s) { return chave(s.nome) === alvo; })[0] ||
      lista.filter(function (s) { return chave(s.nome).indexOf(alvo) > -1 || alvo.indexOf(chave(s.nome)) > -1; })[0] || null;
  }
  function precoNoLugar(e) {
    var s = servicoDoLugar(e);
    if (s && s.preco != null) return Number(s.preco);
    if (st.r.servico && st.r.servico !== '*') return null;
    var precos = (st.servicos[e.id] || []).map(function (x) { return Number(x.preco); }).filter(function (p) { return p > 0; });
    return precos.length ? Math.min.apply(null, precos) : null;
  }

  function candidatos() {
    return st.todos.filter(function (e) {
      if (st.r.segmento && e.segmento !== st.r.segmento) return false;
      if (st.r.servico && st.r.servico !== '*' && !servicoDoLugar(e)) return false;
      if (st.r.receber === 'entrega' && e.aceita_entrega === false) return false;
      if (st.r.receber === 'retirada' && e.aceita_retirada === false) return false;
      if (st.r.onde === 'cliente' && e.servico_onde === 'loja') return false;
      if (st.r.onde === 'loja' && e.servico_onde === 'cliente') return false;
      return true;
    });
  }

  // cada passo sabe montar as próprias opções a partir de quem sobrou;
  // se não sobrar escolha de verdade (0 ou 1 opção), ele nem aparece
  var PASSOS = [
    {
      chave: 'segmento', frase: function (v) { return NOMES_SEG[v] || v; },
      pergunta: function () { return PERGUNTA_SEG[st.area]; },
      opcoes: function (lista) {
        var cont = {};
        lista.forEach(function (e) { cont[e.segmento] = (cont[e.segmento] || 0) + 1; });
        return Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a]; }).map(function (s) {
          return { valor: s, rotulo: NOMES_SEG[s] || s, detalhe: cont[s] + (cont[s] > 1 ? ' lugares' : ' lugar') };
        });
      }
    },
    {
      chave: 'servico', frase: function (v) { return v === '*' ? 'qualquer serviço' : st.rotuloServico; },
      pergunta: function () { return ['E qual serviço?', 'Assim eu comparo o preço certo.']; },
      pronto: function () { return st.area !== 'agenda' || st.servicosProntos; },
      opcoes: function (lista) {
        if (st.area !== 'agenda') return [];
        var grupos = {};
        lista.forEach(function (e) {
          var vistos = {};
          (st.servicos[e.id] || []).forEach(function (s) {
            var k = chave(s.nome);
            if (!k || vistos[k]) return;
            vistos[k] = true;
            if (!grupos[k]) grupos[k] = { rotulo: s.nome, lugares: 0, menor: null };
            grupos[k].lugares++;
            if (s.preco > 0 && (grupos[k].menor == null || Number(s.preco) < grupos[k].menor)) grupos[k].menor = Number(s.preco);
          });
        });
        var ops = Object.keys(grupos).sort(function (a, b) { return grupos[b].lugares - grupos[a].lugares || a.localeCompare(b); })
          .slice(0, 6).map(function (k) {
            var g = grupos[k];
            return { valor: k, rotulo: g.rotulo, detalhe: g.menor != null ? 'a partir de ' + reais(g.menor) : (g.lugares + (g.lugares > 1 ? ' lugares' : ' lugar')) };
          });
        if (ops.length > 1) ops.push({ valor: '*', rotulo: 'Ainda não sei', detalhe: 'vejo lá na hora' });
        return ops;
      },
      aoEscolher: function (v, op) { st.rotuloServico = op.rotulo; }
    },
    {
      chave: 'receber', frase: function (v) { return v === 'entrega' ? 'com entrega' : 'pra retirar'; },
      pergunta: function () { return ['Como prefere receber?', 'Tem loja que só entrega, tem loja que só retira.']; },
      opcoes: function (lista) {
        if (st.area !== 'delivery') return [];
        var ent = lista.filter(function (e) { return e.aceita_entrega !== false; }).length;
        var ret = lista.filter(function (e) { return e.aceita_retirada !== false; }).length;
        if (!lista.some(function (e) { return e.aceita_entrega != null || e.aceita_retirada != null; })) return [];
        return [
          ent ? { valor: 'entrega', rotulo: 'Que entregue em casa', detalhe: ent + (ent > 1 ? ' lojas' : ' loja') } : null,
          ret ? { valor: 'retirada', rotulo: 'Eu passo pra buscar', detalhe: ret + (ret > 1 ? ' lojas' : ' loja') } : null
        ].filter(Boolean);
      }
    },
    {
      chave: 'onde', frase: function (v) { return v === 'cliente' ? 'que venha até mim' : 'eu vou até lá'; },
      pergunta: function () { return ['Onde vai ser?', 'Uns vão até você, outros atendem no próprio lugar.']; },
      opcoes: function (lista) {
        if (st.area !== 'servicos' || !lista.some(function (e) { return e.servico_onde; })) return [];
        var vem = lista.filter(function (e) { return e.servico_onde !== 'loja'; }).length;
        var vou = lista.filter(function (e) { return e.servico_onde !== 'cliente'; }).length;
        return [
          vem ? { valor: 'cliente', rotulo: 'Que venha até mim', detalhe: vem + (vem > 1 ? ' profissionais' : ' profissional') } : null,
          vou ? { valor: 'loja', rotulo: 'Eu vou até lá', detalhe: vou + (vou > 1 ? ' lugares' : ' lugar') } : null
        ].filter(Boolean);
      }
    },
    {
      chave: 'prioridade',
      frase: function (v) { return { perto: 'o mais perto', preco: 'pagando menos', promo: 'com promoção', nota: 'o mais bem avaliado', tanto: 'o melhor pra mim' }[v]; },
      pergunta: function () { return ['O que pesa mais pra você?', 'É por isso que eu vou escolher.']; },
      opcoes: function (lista) {
        if (lista.length < 2) return [];
        var ops = [];
        if (lista.some(temCoord) && navigator.geolocation) ops.push({ valor: 'perto', rotulo: 'Ficar perto de mim', detalhe: 'uso sua localização só agora' });
        var comPreco = lista.filter(function (e) { return precoNoLugar(e) != null; }).length;
        if (comPreco > 1) ops.push({ valor: 'preco', rotulo: 'Pagar menos', detalhe: 'comparo ' + comPreco + ' preços' });
        if (lista.some(function (e) { return e.tem_promocao_ativa; })) ops.push({ valor: 'promo', rotulo: 'Aproveitar promoção', detalhe: 'quem está com oferta agora' });
        if (lista.filter(function (e) { return st.notas[e.id]; }).length > 1) ops.push({ valor: 'nota', rotulo: 'O mais bem avaliado', detalhe: 'pelo que os clientes dizem' });
        if (!ops.length) return [];
        ops.push({ valor: 'tanto', rotulo: 'Tanto faz, me indica um', detalhe: 'junto tudo e escolho' });
        return ops;
      }
    }
  ];

  // próximo passo que ainda faz diferença; responde sozinho os que não fazem
  function proximoPasso() {
    for (var i = 0; i < PASSOS.length; i++) {
      var p = PASSOS[i];
      if (st.r[p.chave] !== undefined) continue;
      if (p.pronto && !p.pronto()) return { passo: p, esperando: true };
      var ops = p.opcoes(candidatos());
      if (ops.length < 2) { st.r[p.chave] = ops.length === 1 && p.chave !== 'prioridade' ? ops[0].valor : null; if (ops.length === 1 && p.aoEscolher) p.aoEscolher(ops[0].valor, ops[0]); continue; }
      return { passo: p, opcoes: ops };
    }
    return null;
  }

  function ranking() {
    var lista = candidatos();
    var pri = st.r.prioridade || 'tanto';
    var precos = lista.map(precoNoLugar).filter(function (p) { return p != null; });
    var menor = precos.length ? Math.min.apply(null, precos) : null, maior = precos.length ? Math.max.apply(null, precos) : null;
    var dists = st.local ? lista.filter(temCoord).map(function (e) { return distancia(st.local, { lat: e.endereco_lat, lng: e.endereco_lng }); }) : [];
    var longe = dists.length ? Math.max.apply(null, dists) : null;
    return lista.map(function (e) {
      var preco = precoNoLugar(e);
      var dist = st.local && temCoord(e) ? distancia(st.local, { lat: e.endereco_lat, lng: e.endereco_lng }) : null;
      var nota = st.notas[e.id];
      // cada critério vira 0..1 (1 = melhor); a prioridade escolhida pesa muito mais
      var c = {
        preco: preco == null || maior === menor ? 0.5 : 1 - (preco - menor) / (maior - menor),
        perto: dist == null || !longe ? 0.4 : 1 - dist / longe,
        promo: e.tem_promocao_ativa ? 1 : 0,
        nota: nota ? (Number(nota.media) - 1) / 4 * Math.min(1, nota.total / 5) : 0.3
      };
      var pesos = { preco: 1, perto: 1, promo: 0.6, nota: 1 };
      if (pesos[pri] != null) pesos[pri] = 20;
      var total = 0;
      Object.keys(c).forEach(function (k) { total += c[k] * pesos[k]; });
      return { e: e, preco: preco, dist: dist, nota: nota, pontos: total, menor: preco != null && preco === menor && precos.length > 1 };
    }).sort(function (a, b) { return b.pontos - a.pontos || a.e.nome.localeCompare(b.e.nome); });
  }

  // ---------- desenho ----------
  function fraseHtml() {
    var partes = ['<span class="guia-frase-fixa">Quero ' + VERBO[st.area] + '</span>'];
    PASSOS.forEach(function (p, i) {
      var v = st.r[p.chave];
      if (v === undefined || v === null) return;
      partes.push('<button type="button" class="guia-frase-peca" data-voltar="' + i + '" title="Trocar">' + esc(p.frase(v)) + '</button>');
    });
    return '<p class="guia-frase">' + partes.join('<span class="guia-frase-sep" aria-hidden="true">·</span>') + '</p>';
  }

  function degrausHtml(feitos, total) {
    var h = '';
    for (var i = 0; i < total; i++) h += '<i class="' + (i < feitos ? 'feito' : i === feitos ? 'agora' : '') + '" style="--d:' + i + '"></i>';
    return '<span class="guia-degraus" aria-hidden="true">' + h + '</span>';
  }

  function respondidos() {
    return PASSOS.filter(function (p) { return st.r[p.chave] !== undefined && st.r[p.chave] !== null; }).length;
  }

  function desenhar() {
    if (!st) return;
    var centro;
    var prox = st.carregando ? null : proximoPasso();
    var feitos = respondidos();
    if (st.carregando || (prox && prox.esperando)) {
      centro = '<div class="guia-pergunta"><p class="guia-contador">' + degrausHtml(feitos, feitos + 2) + 'um instante</p>' +
        '<h2 class="guia-titulo guia-titulo-espera">Separando os lugares…</h2></div>';
    } else if (st.erro) {
      centro = '<div class="guia-pergunta"><h2 class="guia-titulo">Sem conexão agora.</h2><p class="guia-ajuda">Assim que a internet voltar, o passo a passo continua daqui.</p></div>';
    } else if (!st.todos.length) {
      centro = '<div class="guia-pergunta"><h2 class="guia-titulo">Ainda não tem ninguém por aqui.</h2>' +
        '<p class="guia-ajuda">Tem um negócio? Seja o primeiro — <a href="criar.html?area=' + st.area + '">crie seu site grátis</a>.</p></div>';
    } else if (st.localizando) {
      centro = '<div class="guia-pergunta"><p class="guia-contador">' + degrausHtml(feitos, feitos + 1) + 'quase lá</p><h2 class="guia-titulo guia-titulo-espera">Vendo onde você está…</h2></div>';
    } else if (prox) {
      var p = prox.passo, txt = p.pergunta();
      var restantes = PASSOS.slice(PASSOS.indexOf(p) + 1).filter(function (x) { return st.r[x.chave] === undefined; }).length;
      centro = '<div class="guia-pergunta">' +
        '<p class="guia-contador">' + degrausHtml(feitos, feitos + 1 + Math.min(restantes, 2)) + 'passo ' + (feitos + 1) + '</p>' +
        '<h2 class="guia-titulo">' + esc(txt[0]) + '</h2>' +
        '<p class="guia-ajuda">' + esc(txt[1]) + '</p>' +
        '<ol class="guia-opcoes">' + prox.opcoes.map(function (o, i) {
          return '<li style="--i:' + i + '"><button type="button" class="guia-op" data-passo="' + p.chave + '" data-valor="' + esc(o.valor) + '">' +
            '<span class="guia-op-num">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<span class="guia-op-txt">' + esc(o.rotulo) + '</span>' +
            '<span class="guia-op-det">' + esc(o.detalhe || '') + '</span>' +
            '<span class="guia-op-seta" aria-hidden="true">→</span></button></li>';
        }).join('') + '</ol></div>';
    } else {
      centro = resultadoHtml();
    }
    raiz.innerHTML =
      fraseHtml() +
      '<div class="guia-palco">' +
      '<aside class="guia-painel guia-painel-esq" data-painel="0"></aside>' +
      '<div class="guia-centro" id="guiaCentro">' + centro + '</div>' +
      '<aside class="guia-painel guia-painel-dir" data-painel="1"></aside>' +
      '</div>';
    desenharPaineis();
  }

  function resultadoHtml() {
    var lista = ranking();
    if (!lista.length) {
      return '<div class="guia-pergunta"><h2 class="guia-titulo">Com tudo isso junto, não achei ninguém.</h2>' +
        '<p class="guia-ajuda"><button type="button" class="guia-link" data-reiniciar>Começar de novo</button> ou veja todos os lugares aqui embaixo.</p></div>';
    }
    var top = lista[0], e = top.e;
    var motivos = [];
    if (top.dist != null) motivos.push('a ' + km(top.dist) + ' de você');
    if (top.preco != null) motivos.push((servicoDoLugar(e) ? esc(servicoDoLugar(e).nome) + ' por ' : 'a partir de ') + reais(top.preco) + (top.menor ? ' — o menor preço' : ''));
    if (e.tem_promocao_ativa) motivos.push('com promoção agora');
    if (top.nota) motivos.push('★ ' + String(top.nota.media).replace('.', ',') + ' de ' + top.nota.total + (top.nota.total > 1 ? ' clientes' : ' cliente'));
    if (st.r.receber === 'entrega') motivos.push('entrega em casa');
    if (st.r.onde === 'cliente') motivos.push('vai até você');
    var foto = e.foto_capa_url || e.foto_hero_url;
    var cor = e.cor_destaque || '#0F6B5C';
    var acao = st.area === 'agenda' ? (servicoDoLugar(e) ? 'Agendar ' + servicoDoLugar(e).nome.toLowerCase() : 'Agendar horário') : st.area === 'delivery' ? 'Fazer meu pedido' : 'Chamar agora';
    var outros = lista.slice(1, 4);
    return '<div class="guia-resultado">' +
      '<p class="guia-contador">' + degrausHtml(respondidos(), respondidos()) + 'pronto</p>' +
      '<h2 class="guia-titulo">O mais indicado pra você</h2>' +
      '<a class="guia-top" href="' + link(e) + '" style="--cor:' + esc(cor) + ';">' +
      '<span class="guia-top-capa"' + (foto ? ' style="background-image:url(\'' + esc(foto) + '\')"' : '') + '></span>' +
      '<span class="guia-top-corpo">' +
      '<span class="guia-top-nome">' + esc(e.nome) + '</span>' +
      '<span class="guia-top-seg">' + esc(NOMES_SEG[e.segmento] || '') + (e.endereco ? ' · ' + esc(e.endereco) : '') + '</span>' +
      (motivos.length ? '<span class="guia-motivos">' + motivos.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</span>' : '') +
      '<span class="guia-top-cta">' + esc(acao) + ' <span aria-hidden="true">→</span></span>' +
      '<span class="guia-top-sub">o próximo passo a um clique</span>' +
      '</span></a>' +
      (outros.length ? '<p class="guia-outros-titulo">Também combinam com você</p><ul class="guia-outros">' + outros.map(function (o) {
        var extra = [];
        if (o.dist != null) extra.push(km(o.dist));
        if (o.preco != null) extra.push(reais(o.preco));
        if (o.e.tem_promocao_ativa) extra.push('promoção');
        if (o.nota) extra.push('★ ' + String(o.nota.media).replace('.', ','));
        return '<li><a href="' + link(o.e) + '"><span>' + esc(o.e.nome) + '</span><small>' + esc(extra.join(' · ')) + '</small><span aria-hidden="true">→</span></a></li>';
      }).join('') + '</ul>' : '') +
      '<p class="guia-rodape"><button type="button" class="guia-link" data-reiniciar>Começar de novo</button></p>' +
      '</div>';
  }

  // ---------- painéis dos lados ----------
  function destaques() {
    var lista = candidatos().filter(function (e) { return e.tem_promocao_ativa; });
    if (!lista.length) lista = st.todos.filter(function (e) { return e.tem_promocao_ativa; });
    return lista;
  }
  function desenharPaineis() {
    var pool = destaques();
    var passo = respondidos();
    var paineis = raiz.querySelectorAll('[data-painel]');
    for (var i = 0; i < paineis.length; i++) {
      // painel da esquerda mostra quem está em destaque (se tiver); o da
      // direita fica sempre à venda, com um texto diferente a cada passo
      var e = i === 0 && pool.length ? pool[passo % pool.length] : null;
      paineis[i].innerHTML = e ? destaqueHtml(e) : anuncieHtml((passo + i) % ANUNCIE.length);
      if (e) carregarComentarios(e, paineis[i]);
    }
  }
  function destaqueHtml(e) {
    var foto = e.foto_capa_url || e.foto_hero_url;
    var base = '/' + encodeURIComponent(e.slug) + '/' + encodeURIComponent(e.cidade) + (st.area === 'agenda' ? '' : '/pedir');
    return '<a class="guia-anuncio" href="' + base + '" style="--cor:' + esc(e.cor_destaque || '#0F6B5C') + ';">' +
      '<span class="guia-anuncio-rotulo">Em destaque</span>' +
      '<span class="guia-anuncio-capa"' + (foto ? ' style="background-image:url(\'' + esc(foto) + '\')"' : '') + '></span>' +
      '<span class="guia-anuncio-nome">' + esc(e.nome) + '</span>' +
      '<span class="guia-anuncio-txt">Com promoção agora →</span>' +
      '</a><div class="guia-comentarios" data-comentarios="' + esc(e.id) + '"></div>';
  }
  function anuncieHtml(i) {
    var t = ANUNCIE[i];
    return '<a class="guia-anuncio guia-anuncio-vago" href="/parceiros.html">' +
      '<span class="guia-anuncio-rotulo">Anuncie aqui</span>' +
      '<span class="guia-anuncio-nome">' + esc(t[0]) + '</span>' +
      '<span class="guia-anuncio-txt">' + esc(t[1]) + '</span>' +
      '</a><p class="guia-comentarios-vago">Os comentários dos seus clientes aparecem aqui embaixo.</p>';
  }
  function carregarComentarios(e, painel) {
    if (st.semNotas) return;
    var pronto = st.comentarios[e.id];
    function pintar(lista) {
      var alvo = painel.querySelector('[data-comentarios="' + e.id + '"]');
      if (!alvo || !lista.length) return;
      alvo.innerHTML = lista.slice(0, 2).map(function (c) {
        return '<blockquote class="guia-comentario"><p>“' + esc(c.comentario) + '”</p>' +
          '<footer>' + esc(c.cliente_nome) + ' <span aria-label="' + c.nota + ' de 5">' + '★★★★★'.slice(0, c.nota) + '</span></footer></blockquote>';
      }).join('');
    }
    if (pronto) { pintar(pronto); return; }
    db.rpc('avaliacoes_publicas', { p_estabelecimento_id: e.id, p_limite: 2 }).then(function (r) {
      if (!r || r.error) { st.semNotas = true; return; }
      st.comentarios[e.id] = r.data || [];
      pintar(st.comentarios[e.id]);
    }, function () {});
  }

  // ---------- cliques ----------
  raiz.addEventListener('click', function (ev) {
    var op = ev.target.closest('.guia-op');
    if (op) {
      var passo = PASSOS.filter(function (p) { return p.chave === op.getAttribute('data-passo'); })[0];
      var valor = op.getAttribute('data-valor');
      var opcao = passo.opcoes(candidatos()).filter(function (o) { return String(o.valor) === valor; })[0] || { rotulo: valor };
      op.classList.add('escolhida');
      setTimeout(function () {
        st.r[passo.chave] = valor;
        if (passo.aoEscolher) passo.aoEscolher(valor, opcao);
        if (passo.chave === 'prioridade' && valor === 'perto') { pedirLocal(); return; }
        desenhar();
        rolarProTopo();
      }, 180);
      return;
    }
    var voltar = ev.target.closest('[data-voltar]');
    if (voltar) {
      var i = Number(voltar.getAttribute('data-voltar'));
      PASSOS.slice(i).forEach(function (p) { delete st.r[p.chave]; });
      st.local = null;
      desenhar();
      return;
    }
    if (ev.target.closest('[data-reiniciar]')) { st.r = {}; st.local = null; desenhar(); rolarProTopo(); }
  });

  function pedirLocal() {
    st.localizando = true; desenhar();
    navigator.geolocation.getCurrentPosition(function (pos) {
      st.localizando = false;
      st.local = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      desenhar(); rolarProTopo();
    }, function () {
      // sem permissão: segue escolhendo pelo resto (preço, promoção, nota)
      st.localizando = false;
      st.r.prioridade = 'tanto';
      desenhar(); rolarProTopo();
    }, { timeout: 10000, maximumAge: 300000 });
  }

  function rolarProTopo() {
    var topo = raiz.getBoundingClientRect().top + window.scrollY - 70;
    if (window.scrollY > topo) window.scrollTo({ top: Math.max(0, topo), behavior: 'smooth' });
  }

  window.VBGuia = { iniciar: iniciar };
})();
