/* Loja / chamado público do estabelecimento (rota /:slug/:cidade/pedir).
   É a área Delivery ou Serviços do MESMO estabelecimento da agenda —
   mesmo app, mesmo link, mesmo login. Fluxo de pedido: cardápio, sheet
   do item (meio a meio, borda, observação), combo, sacola, checkout e
   acompanhamento. Na área Serviços vira "chamado" (urgência, com GPS)
   ou "pedido de orçamento" (visita marcada), conforme o segmento.
   O preço mostrado aqui é só pra pessoa ver — o banco recalcula tudo.

   Modos extras:
   ?demo=<segmento>                  → cardápio de exemplo, sem rede
   ?preview=1                        → recebe cor/layout/tom ao vivo do painel
   ?mini=1                           → miniatura (esconde sacola/toast) */
(function () {
  'use strict';

  var U = window.VB;
  var Tema = window.VBTema;
  var $ = function (id) { return document.getElementById(id); };
  var esc = U.escapeHtml;

  var q = new URLSearchParams(location.search);
  var MODO_DEMO = q.get('demo');
  var MODO_PREVIEW = q.get('preview') === '1';
  var partes = location.pathname.split('/').filter(Boolean).map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
  var slug = partes[0];
  var cidade = partes[1];

  var estab = null;
  var cardapio = { categorias: [], itens: [], bordas: [], combos: [] };
  var carrinho = [];
  var aberta = true;
  var V = U.vocab('pizzaria');
  var SERVICO = false;
  var URGENTE = false;   // serviço de socorro (borracharia, chaveiro…)
  var VEICULO = false;   // pergunta o veículo (borracharia, guincho)
  var AREA = 'delivery';
  var CART_KEY = null;
  var PEDIDOS_KEY = 'vbdelivery_meus_pedidos';
  var CLIENTE_KEY = 'vbdelivery_cliente';

  function itemPorId(id) { return cardapio.itens.find(function (i) { return i.id === id; }); }
  function bordaPorId(id) { return cardapio.bordas.find(function (b) { return b.id === id; }); }
  function comboPorId(id) { return cardapio.combos.find(function (c) { return c.id === id; }); }
  function elegiveisMeio() { return cardapio.itens.filter(function (i) { return i.permite_meio_a_meio; }); }
  function aceitaBorda(item) { return !!item && (item.aceita_borda || item.permite_meio_a_meio) && cardapio.bordas.length > 0; }
  function temOpcoes(item) { return (item.permite_meio_a_meio && elegiveisMeio().length > 1) || aceitaBorda(item); }

  function mostrarEstado(nome) {
    ['estadoCarregando', 'estadoNaoEncontrado', 'estadoPronto'].forEach(function (id) {
      $(id).classList.toggle('oculto', id !== nome);
    });
    if (nome === 'estadoPronto') {
      $('heroSecao').classList.add('anim-entra');
      $('cardapioConteudo').classList.add('anim-entra-2');
    }
  }

  /* ===================== carga ===================== */
  async function iniciar() {
    $('tbMenuBtn').innerHTML = U.ICONES.menu;
    $('buscaIcone').outerHTML = U.ICONES.busca;

    if (MODO_DEMO) {
      var d = window.VBDemo.montar(MODO_DEMO);
      estab = d.estabelecimento;
      cardapio = d.cardapio;
    } else {
      if (!slug || !cidade || !window.db) { mostrarEstado('estadoNaoEncontrado'); return; }
      var resp = await window.db.rpc('delivery_buscar_estabelecimento', { p_slug: slug, p_cidade: cidade });
      if (resp.error || !resp.data) { mostrarEstado('estadoNaoEncontrado'); return; }
      estab = resp.data;
      var cResp = await window.db.rpc('delivery_cardapio_publico', { p_estabelecimento_id: estab.id });
      if (!cResp.error && cResp.data) cardapio = cResp.data;
      if (!MODO_PREVIEW) window.db.rpc('delivery_registrar_acesso', { p_estabelecimento_id: estab.id });
    }

    V = U.vocab(estab.segmento, estab.modo);
    SERVICO = U.modoDoSegmento(estab.segmento, estab.modo) === 'servico';
    URGENTE = SERVICO && U.tipoServico(estab.segmento) === 'chamado';
    VEICULO = SERVICO && U.usaVeiculo(estab.segmento);
    AREA = SERVICO ? 'servicos' : 'delivery';
    aplicarVisual(q.get('cor') ? '#' + q.get('cor').replace('#', '') : estab.cor_destaque, q.get('layout') || estab.layout, q.get('tom') || estab.template);
    if (!MODO_DEMO && !MODO_PREVIEW) {
      try { localStorage.setItem('vb_visual_' + location.pathname, JSON.stringify({ a: AREA, c: estab.cor_destaque, l: estab.layout, t: estab.template })); } catch (e) {}
    }

    CART_KEY = 'vbdelivery_carrinho_' + estab.id;
    carregarCarrinho();
    renderizarLoja();
    renderizarCardapio();
    renderizarCarrinhoBar();
    ligarEventos();
    atualizarStatus();
    setInterval(atualizarStatus, 60000);
    mostrarEstado('estadoPronto');
    atualizarBadgePedidos();

    if (q.get('pedidos') === '1') abrirMeusPedidos();
  }

  function aplicarVisual(cor, layout, tom) {
    Tema.aplicar({ area: AREA, cor: cor, layout: layout, tom: tom });
  }

  // o mesmo estabelecimento pode ter Agenda + (Delivery ou Serviços): o toggle
  // da faixa (espaço da plataforma, fora da área da loja) troca de área
  function montarToggleAreas() {
    var areas = estab.areas || [];
    if (areas.indexOf('agenda') === -1 || MODO_DEMO || !window.VibeToggle) return;
    var base = '/' + encodeURIComponent(estab.slug) + '/' + encodeURIComponent(estab.cidade);
    window.VibeToggle.montar($('faixaAreas'), {
      tema: 'escuro', atual: AREA, swipe: true, semCubo: true, rotulo: 'O que você quer fazer',
      opcoes: [
        { chave: 'agenda', rotulo: 'Agendar', href: base },
        { chave: AREA, rotulo: SERVICO ? (URGENTE ? 'Chamar' : 'Orçamento') : 'Pedir', href: base + '/pedir' }
      ]
    });
  }

  /* ===================== loja (topo) ===================== */
  function renderizarLoja() {
    document.title = estab.nome + ' · Cardápio e pedidos';
    var meta = document.querySelector('meta[name="description"]');
    if (meta && estab.descricao) meta.content = estab.descricao;

    $('tbNome').textContent = estab.nome;
    $('drawerNome').textContent = estab.nome;
    $('heroTitulo').textContent = estab.nome;
    $('heroEyebrow').textContent = (U.SEGMENTOS[estab.segmento] || 'Delivery') + ' · ' + U.cidadeLegivel(estab.cidade);
    $('heroSub').textContent = estab.descricao || V.subHero;
    $('buscaBox').placeholder = V.buscar;
    document.querySelector('.cart-rotulo').textContent = V.verPedido;
    document.querySelector('[data-abrir="meusPedidos"] span').textContent = V.meusPedidos;
    document.querySelector('#drawer .drawer-rotulo').textContent = V.itens;

    if (estab.foto_capa_url) {
      $('heroCapa').style.backgroundImage = 'url("' + encodeURI(estab.foto_capa_url) + '")';
      $('heroSecao').classList.add('com-capa');
      document.body.classList.add('topo-sobre-capa');
    }
    if (estab.foto_perfil_url) {
      ['heroLogo', 'tbLogo', 'drawerLogo'].forEach(function (id) {
        $(id).style.backgroundImage = 'url("' + encodeURI(estab.foto_perfil_url) + '")';
        $(id).classList.add('tem');
      });
    } else {
      $('drawerLogo').style.display = 'none';
    }
    if (!estab.descricao) $('heroSub').classList.add('oculto');

    // fatos do cabeçalho: rótulo pequeno em cima, valor embaixo
    var fatos = [];
    var tempo = estab.tempo_entrega_min ? estab.tempo_entrega_min + (estab.tempo_entrega_max && estab.tempo_entrega_max !== estab.tempo_entrega_min ? '–' + estab.tempo_entrega_max : '') + (SERVICO && !URGENTE ? ' dias' : ' min') : null;
    if (SERVICO && U.aberto24h(estab.horarios)) fatos.push(['Atende', '24 horas']);
    if (estab.aceita_entrega) {
      if (tempo) fatos.push([!SERVICO ? 'Entrega' : URGENTE ? 'Chega em' : 'Visita em', tempo]);
      if (estab.taxa_entrega != null) fatos.push([!SERVICO ? 'Taxa' : URGENTE ? 'Deslocamento' : 'Visita', Number(estab.taxa_entrega) === 0 ? 'Grátis' : U.preco(estab.taxa_entrega)]);
      if (!SERVICO && estab.pedido_minimo) fatos.push(['Mínimo', U.preco(estab.pedido_minimo)]);
    }
    if (estab.aceita_retirada && fatos.length < 3) fatos.push([SERVICO ? 'Na loja' : 'Retirada', estab.aceita_entrega ? (SERVICO ? 'Também' : 'Pode retirar') : 'Só retirada']);
    $('heroInfo').innerHTML = fatos.slice(0, 3).map(function (f) {
      return '<div class="fato"><span>' + f[0] + '</span><strong>' + esc(f[1]) + '</strong></div>';
    }).join('');
    if (SERVICO && cardapio.itens.length && !document.getElementById('btnSocorro')) {
      var textoBtn = !URGENTE ? 'Pedir orçamento'
        : estab.segmento === 'borracharia' ? 'Pneu furou? Chamar agora'
        : estab.segmento === 'chaveiro' ? 'Ficou trancado? Chamar agora'
        : estab.segmento === 'guincho' ? 'Carro parado? Chamar agora' : 'Chamar agora';
      $('heroInfo').insertAdjacentHTML('afterend', '<button type="button" class="hero-socorro" id="btnSocorro">' + (URGENTE ? U.ICONES.alerta : U.ICONES.pedidos) + textoBtn + '</button>');
    }
    montarToggleAreas();
    if (!Object.keys(estab.horarios || {}).length && !estab.endereco && !(estab.formas_pagamento || []).length) $('heroMais').textContent = 'Sobre a loja';

    if (estab.aviso) {
      $('promoBanner').textContent = estab.aviso;
      $('promoBanner').classList.remove('oculto');
    }

    $('drawerWhats').href = linkWhats('Olá! Vim pelo cardápio digital.');
    $('rodapeLoja').innerHTML =
      '<div>' + esc(estab.nome) + (estab.endereco ? ' · ' + esc(estab.endereco) : '') + '</div>' +
      '<div>Feito com <a href="/"><strong>VB</strong></a></div>';

    injetarDadosEstruturados();
  }

  function injetarDadosEstruturados() {
    if (MODO_DEMO) return;
    var ld = {
      '@context': 'https://schema.org',
      '@type': estab.segmento === 'petshop' || estab.segmento === 'mercado' ? 'Store' : 'Restaurant',
      name: estab.nome,
      description: estab.descricao || undefined,
      telephone: '+55' + U.soDigitos(estab.telefone_whatsapp),
      address: estab.endereco ? { '@type': 'PostalAddress', streetAddress: estab.endereco, addressLocality: U.cidadeLegivel(estab.cidade), addressCountry: 'BR' } : undefined,
      image: estab.foto_capa_url || estab.foto_perfil_url || undefined,
      url: location.origin + location.pathname
    };
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

  function atualizarStatus() {
    aberta = MODO_DEMO ? true : U.lojaAberta(estab);
    var st = $('tbStatus');
    st.classList.remove('oculto');
    st.classList.toggle('fechado', !aberta);
    st.textContent = aberta ? 'Aberto' : 'Fechado';
    var hs = $('heroStatus');
    hs.classList.toggle('fechado', !aberta);
    if (aberta) {
      var ate = MODO_DEMO ? null : U.fechaAs(estab);
      hs.innerHTML = '<strong>Aberto agora</strong>' + (SERVICO && U.aberto24h(estab.horarios) ? ' · 24 horas' : ate ? ' · até ' + esc(ate) : '');
    } else {
      var abre = U.proximaAbertura(estab);
      hs.innerHTML = '<strong>Fechado</strong>' + (abre ? ' · ' + esc(abre.charAt(0).toLowerCase() + abre.slice(1)) : '');
    }
    var aviso = $('avisoFechado');
    if (!aberta) {
      var prox = U.proximaAbertura(estab);
      aviso.innerHTML = U.ICONES.info.replace('<svg', '<svg width="20" height="20" style="flex-shrink:0;margin-top:1px"') +
        '<div><strong>Fechado agora.</strong> ' + (prox ? esc(prox) + '. ' : '') + 'Dá pra olhar o cardápio e montar o pedido — o envio libera quando a loja abrir.</div>';
      aviso.classList.remove('oculto');
    } else {
      aviso.classList.add('oculto');
    }
  }

  /* ===================== cardápio ===================== */
  function agrupar() {
    var comItem = cardapio.categorias.filter(function (c) {
      return cardapio.itens.some(function (i) { return i.categoria_id === c.id; });
    });
    var sem = cardapio.itens.filter(function (i) {
      return !cardapio.categorias.some(function (c) { return c.id === i.categoria_id; });
    });
    var grupos = comItem.map(function (c) {
      return { id: c.id, nome: c.nome, lista: cardapio.itens.filter(function (i) { return i.categoria_id === c.id; }) };
    });
    if (sem.length) grupos.push({ id: 'outros', nome: grupos.length ? 'Outros' : 'Cardápio', lista: sem });
    return grupos;
  }

  function fotoOuMono(item, classe) {
    if (!item.foto_url) return '';
    return '<img class="' + classe + '" data-carregando loading="lazy" src="' + esc(item.foto_url) + '" alt="">';
  }

  function cartaoItem(attrs, nome, preco, desc, extra, foto, busca, botao) {
    return '<article class="item-card' + (foto ? ' com-foto' : '') + '" ' + attrs + ' tabindex="0"' + (busca ? ' data-busca="' + esc(busca.toLowerCase()) + '"' : '') + '>' +
      (foto ? '<div class="item-img">' + foto + '</div>' : '') +
      '<div class="item-corpo">' +
        '<div class="item-topo"><h3 class="item-nome">' + esc(nome) + '</h3><span class="item-leader"></span>' +
          (preco ? '<span class="item-preco">' + preco + '</span>' : '') + '</div>' +
        (desc ? '<p class="item-desc">' + esc(desc) + '</p>' : '') +
        (extra ? '<p class="item-extra">' + extra + '</p>' : '') +
      '</div>' + (botao || '') + '</article>';
  }

  function extrasDoItem(item) {
    var extras = [];
    if (item.permite_meio_a_meio && elegiveisMeio().length > 1) extras.push('Aceita meio a meio');
    if (aceitaBorda(item)) extras.push(extras.length ? 'borda recheada' : 'Borda recheada');
    return extras.join(' · ');
  }

  function renderItemCard(item, semExtras) {
    return cartaoItem('data-item="' + item.id + '"', item.nome, U.precoOuCombinar(item.preco), item.descricao, semExtras ? '' : extrasDoItem(item),
      fotoOuMono(item, 'item-foto'), item.nome + ' ' + (item.descricao || ''),
      '<button type="button" class="item-add" data-add="' + item.id + '" aria-label="Adicionar ' + esc(item.nome) + '">Adicionar</button>');
  }

  function renderizarEspeciais() {
    var html = '';
    if (elegiveisMeio().length > 1) {
      html += cartaoItem('data-meio="1" role="button"', 'Monte sua meio a meio', '', 'Dois sabores na mesma pizza. Você paga pelo mais caro.', '', '', '', '').replace('item-card', 'item-card especial');
    }
    cardapio.combos.forEach(function (co) {
      html += cartaoItem('data-combo="' + co.id + '" role="button"', co.nome, U.preco(co.preco), 'Escolha ' + co.qtd_sabores + ' ' + (co.qtd_sabores > 1 ? 'sabores' : 'sabor') + '.', '', '', '', '').replace('item-card', 'item-card especial');
    });
    return html ? '<section class="secao-especial" id="secaoEspeciais"><h2 class="cardapio-categoria-titulo" id="catg-especiais">Combos e montagem</h2><div class="item-lista">' + html + '</div></section>' : '';
  }

  function renderizarCardapio() {
    var grupos = agrupar();
    var temEspeciais = elegiveisMeio().length > 1 || cardapio.combos.length > 0;
    var ancoras = (temEspeciais ? [{ id: 'especiais', nome: 'Combos' }] : []).concat(grupos);

    var pills = $('navPills');
    if (ancoras.length > 1) {
      pills.classList.remove('oculto');
      pills.innerHTML = ancoras.map(function (g) {
        return '<a href="#catg-' + g.id + '" class="nav-pill">' + esc(g.nome) + '</a>';
      }).join('');
    } else {
      pills.classList.add('oculto');
    }
    $('drawerLinks').innerHTML = ancoras.map(function (g) {
      return '<a href="#catg-' + g.id + '" class="drawer-link"><span>' + esc(g.nome) + '</span></a>';
    }).join('');

    if (!cardapio.itens.length) {
      $('cardapioConteudo').innerHTML = '<div class="estado-vazio" style="padding-top:2rem"><p class="hero-sub">' + V.vazio + '</p></div>';
      return;
    }

    var html = renderizarEspeciais();
    html += grupos.map(function (g) {
      // se todo item da categoria aceita a mesma coisa, avisa uma vez só
      var comum = extrasDoItem(g.lista[0]);
      var todos = g.lista.length > 1 && comum && g.lista.every(function (i) { return extrasDoItem(i) === comum; });
      var nota = todos ? (comum === 'Aceita meio a meio · borda recheada' ? 'Todas aceitam meio a meio e borda recheada' : comum) : '';
      return '<section class="grupo-cardapio" data-grupo="' + g.id + '">' +
        '<h2 class="cardapio-categoria-titulo" id="catg-' + g.id + '">' + esc(g.nome) + '</h2>' +
        (nota ? '<p class="categoria-nota">' + nota + '</p>' : '') +
        '<div class="item-lista">' + g.lista.map(function (i) { return renderItemCard(i, todos); }).join('') + '</div></section>';
    }).join('');
    $('cardapioConteudo').innerHTML = html;

    document.querySelectorAll('.item-foto[data-carregando]').forEach(function (img) {
      var tirar = function () { img.removeAttribute('data-carregando'); };
      if (img.complete) tirar(); else { img.addEventListener('load', tirar); img.addEventListener('error', tirar); }
    });
    marcarItensNoCarrinho();
  }

  function marcarItensNoCarrinho() {
    var contagem = {};
    carrinho.forEach(function (l) {
      if (l.tipo === 'item') contagem[l.item_id] = (contagem[l.item_id] || 0) + l.qtd;
    });
    document.querySelectorAll('.item-card[data-item]').forEach(function (card) {
      var n = contagem[card.getAttribute('data-item')] || 0;
      card.classList.toggle('no-carrinho', n > 0);
      var marca = card.querySelector('.item-qtd');
      if (n > 0) {
        if (!marca) { marca = document.createElement('span'); marca.className = 'item-qtd'; card.querySelector('.item-nome').prepend(marca); }
        marca.textContent = n + '×';
      } else if (marca) {
        marca.remove();
      }
    });
  }

  /* ===================== sheet (gerenciador) ===================== */
  var sheetAberto = false;
  var sheetNome = null;

  function abrirSheet(nome, html) {
    $('sheetConteudo').innerHTML = html;
    sheetNome = nome;
    var corpo = $('sheetConteudo').querySelector('.sheet-corpo');
    if (corpo) corpo.scrollTop = 0;
    if (!sheetAberto) {
      sheetAberto = true;
      $('sheet').classList.add('aberto');
      $('sheet').setAttribute('aria-hidden', 'false');
      document.body.classList.add('travado');
      try { history.pushState({ vbSheet: true }, ''); } catch (e) {}
    }
  }

  function fecharSheet(viaHistorico) {
    if (!sheetAberto) return;
    sheetAberto = false;
    sheetNome = null;
    pararPollingPedidos();
    $('sheet').classList.remove('aberto');
    $('sheet').setAttribute('aria-hidden', 'true');
    $('sheet').style.removeProperty('--arrasto');
    document.body.classList.remove('travado');
    if (!viaHistorico && history.state && history.state.vbSheet) {
      try { history.back(); } catch (e) {}
    }
  }

  function cabecaSheet(titulo, voltar) {
    return '<div class="sheet-cabeca">' +
      (voltar ? '<button type="button" class="sheet-voltar" data-voltar="' + voltar + '" aria-label="Voltar">' + U.ICONES.voltar + '</button>' : '') +
      '<h2 class="sheet-titulo" id="sheetTitulo">' + esc(titulo) + '</h2>' +
      '<button type="button" class="sheet-x" data-fechar-sheet aria-label="Fechar">' + U.ICONES.x + '</button></div>';
  }

  function ligarArrasto() {
    var inicioY = null, dy = 0;
    var painel = document.querySelector('.sheet-painel');
    painel.addEventListener('touchstart', function (e) {
      var alvo = e.target;
      var noTopo = alvo.closest('#sheetAlca, .sheet-cabeca');
      var corpo = alvo.closest('.sheet-corpo');
      if (!noTopo && !(corpo && corpo.scrollTop <= 0)) return;
      if (alvo.closest('input, textarea, select, button')) return;
      inicioY = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    painel.addEventListener('touchmove', function (e) {
      if (inicioY == null) return;
      dy = Math.max(0, e.touches[0].clientY - inicioY);
      if (dy > 6) {
        $('sheet').classList.add('arrastando');
        $('sheet').style.setProperty('--arrasto', dy + 'px');
      }
    }, { passive: true });
    painel.addEventListener('touchend', function () {
      if (inicioY == null) return;
      $('sheet').classList.remove('arrastando');
      if (dy > 110) fecharSheet(); else $('sheet').style.removeProperty('--arrasto');
      inicioY = null; dy = 0;
    });
  }

  /* ===================== sheet do item ===================== */
  var estadoItem = null;

  function abrirItem(id, opts) {
    var item = itemPorId(id);
    if (!item) return;
    estadoItem = { item: item, meio: !!(opts && opts.meio && item.permite_meio_a_meio), metadeId: null, bordaId: null, qtd: 1, obs: '' };
    renderItemSheet(true);
  }

  function precoItemAtual() {
    var s = estadoItem;
    var base = Number(s.item.preco);
    if (s.meio && s.metadeId) {
      var m = itemPorId(s.metadeId);
      if (m) base = Math.max(base, Number(m.preco));
    }
    var b = s.bordaId ? bordaPorId(s.bordaId) : null;
    return base + (b ? Number(b.preco) : 0);
  }

  function renderItemSheet(primeiraVez) {
    var s = estadoItem, it = s.item;
    var corpo = '';
    corpo += fotoOuMono(it, 'sheet-foto');
    if (it.descricao) corpo += '<p class="sheet-desc">' + esc(it.descricao) + '</p>';
    corpo += '<p class="sheet-preco-base">' + U.precoOuCombinar(it.preco) + '</p>';

    var outras = elegiveisMeio().filter(function (i) { return i.id !== it.id; });
    if (it.permite_meio_a_meio && outras.length) {
      corpo += '<div class="grupo"><div class="grupo-titulo">Como você quer?</div>' +
        '<div class="seg" role="tablist"><button type="button" data-meio-op="0" class="' + (s.meio ? '' : 'ativo') + '">Inteira</button>' +
        '<button type="button" data-meio-op="1" class="' + (s.meio ? 'ativo' : '') + '">Meio a meio</button></div></div>';
      if (s.meio) {
        corpo += '<div class="grupo"><div class="grupo-titulo">Outra metade <em class="' + (s.metadeId ? 'ok' : '') + '">' + (s.metadeId ? 'Escolhida' : 'Obrigatório') + '</em></div>' +
          '<p class="sheet-desc" style="font-size:.8rem;margin-bottom:.6rem">Cobramos pelo sabor mais caro das duas metades.</p><div class="opcoes">' +
          outras.map(function (o) {
            return '<button type="button" class="opcao' + (s.metadeId === o.id ? ' ativo' : '') + '" data-metade="' + o.id + '">' +
              '<span class="marca">' + U.ICONES.check + '</span><span class="opcao-nome">' + esc(o.nome) + '</span>' +
              '<span class="opcao-extra">' + U.preco(o.preco) + '</span></button>';
          }).join('') + '</div></div>';
      }
    }

    if (aceitaBorda(it)) {
      corpo += '<div class="grupo"><div class="grupo-titulo">Borda <em>Opcional</em></div><div class="opcoes">' +
        '<button type="button" class="opcao' + (!s.bordaId ? ' ativo' : '') + '" data-borda=""><span class="marca">' + U.ICONES.check + '</span><span class="opcao-nome">Sem borda</span></button>' +
        cardapio.bordas.map(function (b) {
          return '<button type="button" class="opcao' + (s.bordaId === b.id ? ' ativo' : '') + '" data-borda="' + b.id + '">' +
            '<span class="marca">' + U.ICONES.check + '</span><span class="opcao-nome">' + esc(b.nome) + '</span>' +
            '<span class="opcao-extra">+ ' + U.preco(b.preco) + '</span></button>';
        }).join('') + '</div></div>';
    }

    corpo += '<div class="grupo"><div class="grupo-titulo">Alguma observação? <em>Opcional</em></div>' +
      '<div class="campo"><textarea id="itemObs" maxlength="140" rows="2" placeholder="Ex.: sem cebola, bem passada, cortar em 8">' + esc(s.obs) + '</textarea></div></div>';

    var falta = s.meio && !s.metadeId;
    var total = precoItemAtual() * s.qtd;
    var rodape = '<div class="qtd" aria-label="Quantidade"><button type="button" data-qtd-item="-1" ' + (s.qtd <= 1 ? 'disabled' : '') + ' aria-label="Menos">−</button>' +
      '<span>' + s.qtd + '</span><button type="button" data-qtd-item="1" aria-label="Mais">+</button></div>' +
      '<button type="button" class="btn cheio" id="itemAddBtn" ' + (falta ? 'disabled' : '') + '>' +
      (falta ? 'Escolha a outra metade' : (SERVICO ? 'Solicitar' : 'Adicionar') + '<span class="valor">' + U.precoOuCombinar(total) + '</span>') + '</button>';

    var corpoAtual = primeiraVez ? null : $('sheetConteudo').querySelector('.sheet-corpo');
    var scroll = corpoAtual ? corpoAtual.scrollTop : 0;
    abrirSheet('item', cabecaSheet(it.nome) + '<div class="sheet-corpo">' + corpo + '</div><div class="sheet-rodape">' + rodape + '</div>');
    var novoCorpo = $('sheetConteudo').querySelector('.sheet-corpo');
    if (novoCorpo) novoCorpo.scrollTop = scroll;
    var img = $('sheetConteudo').querySelector('img[data-carregando]');
    if (img) { var t = function () { img.removeAttribute('data-carregando'); }; if (img.complete) t(); else img.addEventListener('load', t); }
  }

  function adicionarItemDaSheet() {
    var s = estadoItem, it = s.item;
    if (s.meio && !s.metadeId) return;
    var metade = s.meio ? itemPorId(s.metadeId) : null;
    var borda = s.bordaId ? bordaPorId(s.bordaId) : null;
    var desc = metade ? 'Meio a meio: ' + it.nome + ' / ' + metade.nome : it.nome;
    if (borda) desc += ' — borda ' + borda.nome;
    adicionarAoCarrinho({
      tipo: 'item', item_id: it.id, meio_item_id: metade ? metade.id : null, borda_id: borda ? borda.id : null,
      qtd: s.qtd, obs: (s.obs || '').trim(), descricao: desc, preco: precoItemAtual()
    });
    fecharSheet();
    U.toast(s.qtd > 1 ? s.qtd + '× — ' + V.adicionado.toLowerCase() : V.adicionado);
  }

  /* ===================== sheet do combo ===================== */
  var estadoCombo = null;

  function abrirCombo(id) {
    var co = comboPorId(id);
    if (!co) return;
    estadoCombo = { combo: co, sel: [], qtd: 1, obs: '' };
    renderComboSheet(true);
  }

  function renderComboSheet(primeiraVez) {
    var s = estadoCombo, co = s.combo;
    var permitidos = cardapio.itens.filter(function (i) { return (co.itens_permitidos || []).indexOf(i.id) !== -1; });
    var cheio = s.sel.length >= co.qtd_sabores;
    var corpo = '<p class="sheet-preco-base">' + U.preco(co.preco) + '</p>' +
      '<div class="grupo"><div class="grupo-titulo">Escolha ' + co.qtd_sabores + ' ' + (co.qtd_sabores > 1 ? 'sabores' : 'sabor') +
      ' <em class="' + (cheio ? 'ok' : '') + '">' + s.sel.length + ' de ' + co.qtd_sabores + '</em></div><div class="opcoes">' +
      permitidos.map(function (i) {
        var ativo = s.sel.indexOf(i.id) !== -1;
        return '<button type="button" class="opcao quadrada' + (ativo ? ' ativo' : '') + '" data-sabor="' + i.id + '" ' + (!ativo && cheio ? 'disabled' : '') + '>' +
          '<span class="marca">' + U.ICONES.check + '</span><span class="opcao-nome">' + esc(i.nome) + '</span></button>';
      }).join('') + '</div></div>' +
      '<div class="grupo"><div class="grupo-titulo">Alguma observação? <em>Opcional</em></div>' +
      '<div class="campo"><textarea id="comboObs" maxlength="140" rows="2" placeholder="Ex.: uma sem cebola">' + esc(s.obs) + '</textarea></div></div>';

    var rodape = '<div class="qtd"><button type="button" data-qtd-combo="-1" ' + (s.qtd <= 1 ? 'disabled' : '') + ' aria-label="Menos">−</button>' +
      '<span>' + s.qtd + '</span><button type="button" data-qtd-combo="1" aria-label="Mais">+</button></div>' +
      '<button type="button" class="btn cheio" id="comboAddBtn" ' + (cheio ? '' : 'disabled') + '>' +
      (cheio ? 'Adicionar<span class="valor">' + U.preco(co.preco * s.qtd) + '</span>' : 'Faltam ' + (co.qtd_sabores - s.sel.length)) + '</button>';

    var corpoAtual = primeiraVez ? null : $('sheetConteudo').querySelector('.sheet-corpo');
    var scroll = corpoAtual ? corpoAtual.scrollTop : 0;
    abrirSheet('combo', cabecaSheet(co.nome) + '<div class="sheet-corpo">' + corpo + '</div><div class="sheet-rodape">' + rodape + '</div>');
    var novo = $('sheetConteudo').querySelector('.sheet-corpo');
    if (novo) novo.scrollTop = scroll;
  }

  function adicionarComboDaSheet() {
    var s = estadoCombo, co = s.combo;
    if (s.sel.length !== co.qtd_sabores) return;
    var nomes = s.sel.map(function (id) { var i = itemPorId(id); return i ? i.nome : '?'; });
    adicionarAoCarrinho({
      tipo: 'combo', combo_id: co.id, sabores: s.sel.slice(), qtd: s.qtd, obs: (s.obs || '').trim(),
      descricao: co.nome + ': ' + nomes.join(' + '), preco: Number(co.preco)
    });
    fecharSheet();
    U.toast('Combo adicionado ao pedido');
  }

  /* ===================== carrinho ===================== */
  function chaveLinha(l) {
    return [l.tipo, l.item_id || l.combo_id, l.meio_item_id || '', l.borda_id || '', (l.sabores || []).join(','), l.obs || ''].join('|');
  }

  function carregarCarrinho() {
    var salvo = U.lerLocal(CART_KEY, []);
    // descarta o que saiu do cardápio desde a última visita
    carrinho = (Array.isArray(salvo) ? salvo : []).filter(function (l) {
      if (l.tipo === 'combo') {
        var co = comboPorId(l.combo_id);
        return co && (l.sabores || []).every(function (id) { return !!itemPorId(id); });
      }
      return !!itemPorId(l.item_id) && (!l.meio_item_id || !!itemPorId(l.meio_item_id)) && (!l.borda_id || !!bordaPorId(l.borda_id));
    });
  }

  function salvarCarrinho() { if (!MODO_DEMO) U.gravarLocal(CART_KEY, carrinho); }

  function adicionarAoCarrinho(linha) {
    var chave = chaveLinha(linha);
    var existente = carrinho.find(function (l) { return chaveLinha(l) === chave; });
    if (existente) existente.qtd = Math.min(50, existente.qtd + linha.qtd);
    else carrinho.push(linha);
    salvarCarrinho();
    renderizarCarrinhoBar();
    marcarItensNoCarrinho();
  }

  function subtotal() { return carrinho.reduce(function (s, l) { return s + l.preco * l.qtd; }, 0); }
  function qtdTotal() { return carrinho.reduce(function (s, l) { return s + l.qtd; }, 0); }

  function renderizarCarrinhoBar() {
    var bar = $('cartBar');
    var estavaVazio = bar.classList.contains('vazio');
    bar.classList.toggle('vazio', carrinho.length === 0);
    if (estavaVazio && carrinho.length) {
      bar.classList.remove('surgiu'); void bar.offsetWidth; bar.classList.add('surgiu');
    }
    $('cartQtd').textContent = qtdTotal();
    var tot = $('cartTotal');
    tot.textContent = U.preco(subtotal());
    tot.classList.remove('bump'); void tot.offsetWidth; tot.classList.add('bump');
  }

  function abrirCarrinho() {
    if (!carrinho.length) { fecharSheet(); return; }
    var sub = subtotal();
    var corpo = carrinho.map(function (l, idx) {
      return '<div class="carrinho-linha">' +
        '<div class="carrinho-info"><strong>' + esc(l.descricao) + '</strong>' +
        (l.obs ? '<div class="obs">“' + esc(l.obs) + '”</div>' : '') +
        '<div class="valor">' + U.precoOuCombinar(l.preco * l.qtd) + '</div></div>' +
        '<div class="qtd mini"><button type="button" data-linha-qtd="' + idx + '" data-d="-1" aria-label="Menos">' + (l.qtd <= 1 ? U.ICONES.lixo : '−') + '</button>' +
        '<span>' + l.qtd + '</span><button type="button" data-linha-qtd="' + idx + '" data-d="1" aria-label="Mais">+</button></div></div>';
    }).join('');

    var taxa = estab.aceita_entrega ? Number(estab.taxa_entrega || 0) : 0;
    corpo += '<button type="button" class="link-acao" data-fechar-sheet>' + V.maisItens + '</button>';
    if (sub + taxa === 0 && temACombinar()) {
      corpo += '<p class="sheet-desc" style="margin-top:1rem">O valor vem no orçamento, depois que a loja avaliar.</p>';
    } else {
      corpo += '<div class="totais"><div><span>Subtotal</span><span>' + U.preco(sub) + '</span></div>' +
        (estab.aceita_entrega ? '<div><span>' + V.taxa + '</span><span>' + (taxa ? U.preco(taxa) : 'Grátis') + '</span></div>' : '') +
        '<div class="total"><span>Total' + (estab.aceita_entrega && estab.aceita_retirada ? (SERVICO ? ' no seu local' : ' com entrega') : '') + '</span><span>' + U.preco(sub + taxa) + '</span></div></div>' +
        notaCombinar();
    }
    if (estab.aceita_entrega && estab.pedido_minimo && sub < estab.pedido_minimo) {
      corpo += '<p class="sheet-desc" style="margin-top:.8rem;font-size:.82rem">Faltam <strong>' + U.preco(estab.pedido_minimo - sub) + '</strong> pro pedido mínimo de entrega' +
        (estab.aceita_retirada ? ' (na retirada não tem mínimo)' : '') + '.</p>';
    }
    var rodape = '<button type="button" class="btn cheio" id="irCheckoutBtn" ' + (aberta ? '' : 'disabled') + '>' +
      (aberta ? V.continuar + (sub > 0 ? '<span class="valor">' + U.preco(sub) + '</span>' : '') : 'Loja fechada agora') + '</button>';
    abrirSheet('carrinho', cabecaSheet(V.seuPedido) + '<div class="sheet-corpo">' + corpo + '</div><div class="sheet-rodape">' + rodape + '</div>');
  }

  function temACombinar() { return carrinho.some(function (l) { return !(Number(l.preco) > 0); }); }
  function notaCombinar() {
    return temACombinar() ? '<p class="sheet-desc" style="margin-top:.7rem;font-size:.8rem">Itens "a combinar" têm o valor passado ' + (SERVICO ? 'na hora, depois de ver o veículo' : 'pela loja') + '.</p>' : '';
  }

  function mudarQtdLinha(idx, d) {
    var l = carrinho[idx];
    if (!l) return;
    l.qtd += d;
    if (l.qtd <= 0) carrinho.splice(idx, 1);
    salvarCarrinho();
    renderizarCarrinhoBar();
    marcarItensNoCarrinho();
    abrirCarrinho();
  }

  /* ===================== checkout ===================== */
  var checkout = null;

  function abrirCheckout() {
    var salvo = U.lerLocal(CLIENTE_KEY, {});
    checkout = checkout || {
      nome: salvo.nome || '', telefone: salvo.telefone ? U.formatarTelefone(salvo.telefone) : '',
      forma: estab.aceita_entrega ? 'entrega' : 'retirada',
      endereco: salvo.endereco || '', referencia: salvo.referencia || '',
      pagamento: (estab.formas_pagamento || [])[0] || null, troco: '', obs: '', erro: null, enviando: false,
      gps: null, veiculo: salvo.veiculo || null, modelo: salvo.modelo || '', quando: ''
    };
    if (checkout.forma === 'entrega' && !estab.aceita_entrega) checkout.forma = 'retirada';
    if (checkout.forma === 'retirada' && !estab.aceita_retirada) checkout.forma = 'entrega';
    renderCheckout();
  }

  function renderCheckout(focoErro) {
    var c = checkout;
    var sub = subtotal();
    var taxa = c.forma === 'entrega' ? Number(estab.taxa_entrega || 0) : 0;
    var formas = estab.formas_pagamento || [];

    var corpo = '';
    if (c.erro) corpo += '<div class="aviso-loja" style="margin:0 0 1rem">' + U.ICONES.info.replace('<svg', '<svg width="20" height="20" style="flex-shrink:0"') + '<div>' + esc(c.erro) + '</div></div>';

    corpo += '<div class="grupo" style="margin-top:0"><div class="grupo-titulo">Seus dados</div>' +
      campo('ckNome', 'Seu nome', '<input id="ckNome" autocomplete="name" maxlength="80" value="' + esc(c.nome) + '" placeholder="Como te chamamos?">') +
      campo('ckTel', 'WhatsApp', '<input id="ckTel" type="tel" inputmode="numeric" autocomplete="tel-national" value="' + esc(c.telefone) + '" placeholder="(15) 99999-9999">', 'A loja confirma o pedido por esse número.') +
      '</div>';

    corpo += '<div class="grupo"><div class="grupo-titulo">' + V.comoReceber + '</div>' +
      '<div class="seg"><button type="button" data-forma="entrega" class="' + (c.forma === 'entrega' ? 'ativo' : '') + '" ' + (estab.aceita_entrega ? '' : 'disabled') + '>' + V.entrega + '</button>' +
      '<button type="button" data-forma="retirada" class="' + (c.forma === 'retirada' ? 'ativo' : '') + '" ' + (estab.aceita_retirada ? '' : 'disabled') + '>' + V.retirada + '</button></div>';
    if (c.forma === 'entrega') {
      corpo += '<div style="margin-top:.8rem">';
      if (URGENTE) corpo += blocoGps();
      corpo += campo('ckEnd', URGENTE ? (c.gps && c.gps.status === 'ok' ? 'Endereço ou ponto de referência (opcional)' : V.enderecoRotulo) : V.enderecoRotulo,
          '<input id="ckEnd" autocomplete="street-address" maxlength="200" value="' + esc(c.endereco) + '" placeholder="' + (SERVICO ? 'Rua, número, bairro — ou um ponto de referência' : 'Rua, número, bairro') + '">') +
        campo('ckRef', URGENTE ? 'Como te achar?' : 'Complemento / referência', '<input id="ckRef" maxlength="140" value="' + esc(c.referencia) + '" placeholder="' + (URGENTE ? 'Ex.: carro prata no posto, em frente ao mercado' : 'Apto, bloco, perto de…') + '">') + '</div>';
    } else if (estab.endereco) {
      corpo += '<p class="sheet-desc" style="margin-top:.7rem;font-size:.85rem">' + V.retiradaEm + ': <strong>' + esc(estab.endereco) + '</strong></p>';
    }
    corpo += '</div>';
    if (SERVICO && !URGENTE) {
      corpo += '<div class="grupo"><div class="grupo-titulo">Quando fica bom pra você? <em>Opcional</em></div>' +
        campo('ckQuando', 'Dia e horário de preferência', '<input id="ckQuando" maxlength="60" value="' + esc(c.quando) + '" placeholder="Ex.: sábado de manhã, depois das 18h">') + '</div>';
    }
    if (VEICULO) {
      corpo += '<div class="grupo"><div class="grupo-titulo">Seu veículo</div><div class="chips-escolha">' +
        ['Carro', 'Moto', 'Caminhonete', 'Caminhão', 'Outro'].map(function (v) {
          return '<button type="button" data-veiculo="' + v + '" class="' + (c.veiculo === v ? 'ativo' : '') + '">' + v + '</button>';
        }).join('') + '</div>' +
        campo('ckModelo', 'Modelo e cor <span style="font-weight:500;color:var(--ink-faint)">(ajuda a te achar)</span>', '<input id="ckModelo" maxlength="60" value="' + esc(c.modelo) + '" placeholder="Ex.: Gol prata, CG 160 vermelha">') + '</div>';
    }

    if (formas.length) {
      corpo += '<div class="grupo"><div class="grupo-titulo">Pagamento <em>Na entrega/retirada</em></div><div class="opcoes">' +
        formas.map(function (f) {
          return '<button type="button" class="opcao' + (c.pagamento === f ? ' ativo' : '') + '" data-pag="' + f + '"><span class="marca">' + U.ICONES.check + '</span>' +
            '<span class="opcao-nome">' + esc(U.PAGAMENTOS[f] || f) + '</span></button>';
        }).join('') + '</div>';
      if (c.pagamento === 'dinheiro') {
        corpo += '<div style="margin-top:.7rem">' + campo('ckTroco', 'Troco para quanto?', '<input id="ckTroco" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(c.troco) + '" placeholder="Deixe vazio se não precisar">') + '</div>';
      }
      if (c.pagamento === 'pix' && estab.chave_pix) {
        corpo += '<div class="pix-box">Chave Pix da loja:<code id="pixChave">' + esc(estab.chave_pix) + '</code>' +
          '<button type="button" class="link-acao" data-copiar-pix>Copiar chave</button></div>';
      }
      corpo += '</div>';
    }

    corpo += '<div class="grupo"><div class="grupo-titulo">Observação do pedido <em>Opcional</em></div>' +
      '<div class="campo"><textarea id="ckObs" maxlength="280" rows="2" placeholder="Ex.: campainha não funciona, pode ligar">' + esc(c.obs) + '</textarea></div></div>';

    // tudo "a combinar" (orçamento): sem conta de R$ 0,00 — o valor vem depois
    var semValor = sub + taxa === 0 && temACombinar();
    if (semValor) {
      corpo += '<p class="sheet-desc" style="margin-top:1rem">O valor vem no orçamento, pelo WhatsApp, depois que a loja avaliar.</p>';
    } else {
      corpo += '<div class="totais"><div><span>Subtotal</span><span>' + U.preco(sub) + '</span></div>' +
        (c.forma === 'entrega' ? '<div><span>' + V.taxa + '</span><span>' + (taxa ? U.preco(taxa) : 'Grátis') + '</span></div>' : '') +
        '<div class="total"><span>Total' + (temACombinar() ? ' (fora os itens a combinar)' : '') + '</span><span>' + U.preco(sub + taxa) + '</span></div></div>';
    }

    var abaixoMinimo = c.forma === 'entrega' && estab.pedido_minimo && sub < estab.pedido_minimo;
    var rodape = '<button type="button" class="btn cheio" id="enviarPedidoBtn" ' + (c.enviando || abaixoMinimo || !aberta ? 'disabled' : '') + '>' +
      (c.enviando ? '<span class="spin"></span>Enviando…' : !aberta ? 'Loja fechada agora' : abaixoMinimo ? 'Mínimo p/ entrega: ' + U.preco(estab.pedido_minimo) : V.enviar + (semValor ? '' : '<span class="valor">' + U.preco(sub + taxa) + '</span>')) + '</button>';

    var corpoAtual = $('sheetConteudo').querySelector('.sheet-corpo');
    var scroll = sheetNome === 'checkout' && corpoAtual ? corpoAtual.scrollTop : 0;
    abrirSheet('checkout', cabecaSheet(V.finalizar, 'carrinho') + '<div class="sheet-corpo">' + corpo + '</div><div class="sheet-rodape">' + rodape + '</div>');
    var novo = $('sheetConteudo').querySelector('.sheet-corpo');
    if (novo) novo.scrollTop = c.erro && focoErro ? 0 : scroll;
    var tel = $('ckTel');
    if (tel) {
      U.mascaraTelefone(tel);
      tel.addEventListener('blur', buscarClientePorTelefone);
    }
  }

  function campo(id, rotulo, input, ajuda) {
    return '<div class="campo" data-campo="' + id + '"><label for="' + id + '">' + rotulo + '</label>' + input +
      (ajuda ? '<div class="ajuda">' + ajuda + '</div>' : '') + '</div>';
  }

  function lerCamposCheckout() {
    var c = checkout;
    if ($('ckNome')) c.nome = $('ckNome').value;
    if ($('ckTel')) c.telefone = $('ckTel').value;
    if ($('ckEnd')) c.endereco = $('ckEnd').value;
    if ($('ckRef')) c.referencia = $('ckRef').value;
    if ($('ckTroco')) c.troco = $('ckTroco').value;
    if ($('ckObs')) c.obs = $('ckObs').value;
    if ($('ckModelo')) c.modelo = $('ckModelo').value;
    if ($('ckQuando')) c.quando = $('ckQuando').value;
  }

  function blocoGps() {
    var g = checkout.gps;
    if (g && g.status === 'ok') {
      return '<div class="gps-box ok"><span class="gps-icone">' + U.ICONES.check + '</span><div class="gps-texto"><strong>Localização enviada</strong>' +
        '<small>Precisão de ~' + g.precisao + ' m · <a class="link-acao" style="padding:0" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + g.lat + ',' + g.lng + '">conferir no mapa</a></small></div>' +
        '<button type="button" class="link-acao" data-gps>Atualizar</button></div>';
    }
    if (g && g.status === 'buscando') {
      return '<div class="gps-box buscando"><span class="gps-icone">' + U.ICONES.gps + '</span><div class="gps-texto"><strong>Pegando sua localização…</strong><small>Se o celular perguntar, toque em "Permitir".</small></div></div>';
    }
    return '<div class="gps-box' + (g && g.status === 'erro' ? ' erro' : '') + '"><span class="gps-icone">' + U.ICONES.gps + '</span><div class="gps-texto"><strong>Enviar minha localização</strong>' +
      '<small>' + (g && g.msg ? esc(g.msg) : 'O jeito mais rápido de a gente te achar.') + '</small></div>' +
      '<button type="button" class="btn mini" data-gps>Usar GPS</button></div>';
  }

  function pegarLocalizacao() {
    lerCamposCheckout();
    if (!navigator.geolocation) { checkout.gps = { status: 'erro', msg: 'Seu aparelho não liberou a localização — digite o endereço.' }; renderCheckout(); return; }
    checkout.gps = { status: 'buscando' };
    renderCheckout();
    navigator.geolocation.getCurrentPosition(function (pos) {
      if (sheetNome === 'checkout') lerCamposCheckout();
      checkout.gps = { status: 'ok', lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)), precisao: Math.round(pos.coords.accuracy || 0) };
      if (sheetNome === 'checkout') renderCheckout();
    }, function (err) {
      if (sheetNome === 'checkout') lerCamposCheckout();
      checkout.gps = { status: 'erro', msg: err && err.code === 1 ? 'Você não permitiu a localização. Libere nas configurações do navegador ou digite o endereço.' : 'Não consegui pegar a localização agora. Digite o endereço ou tente de novo.' };
      if (sheetNome === 'checkout') renderCheckout();
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }

  async function buscarClientePorTelefone() {
    if (MODO_DEMO || !window.db) return;
    var d = U.soDigitos($('ckTel').value);
    if (d.length < 10 || $('ckNome').value.trim()) return;
    var r = await window.db.rpc('vb_buscar_cliente_global', { p_telefone: d });
    var achado = r.data && r.data[0];
    if (achado && $('ckNome') && !$('ckNome').value.trim()) {
      $('ckNome').value = achado.nome;
      checkout.nome = achado.nome;
      U.toast('Oi de novo, ' + achado.nome.split(' ')[0] + '!');
    }
  }

  function marcarErro(id, msg) {
    var bloco = document.querySelector('[data-campo="' + id + '"]');
    if (!bloco) return;
    bloco.classList.add('erro');
    var m = document.createElement('div');
    m.className = 'msg-erro';
    m.textContent = msg;
    bloco.appendChild(m);
  }

  function validarCheckout() {
    var c = checkout, erros = [];
    document.querySelectorAll('.campo.erro').forEach(function (el) { el.classList.remove('erro'); var m = el.querySelector('.msg-erro'); if (m) m.remove(); });
    if (c.nome.trim().length < 2) erros.push(['ckNome', 'Digite seu nome']);
    var tel = U.soDigitos(c.telefone);
    if (tel.length < 10 || tel.length > 11) erros.push(['ckTel', 'WhatsApp com DDD, ex.: (15) 99999-9999']);
    var temGps = c.gps && c.gps.status === 'ok';
    if (c.forma === 'entrega' && c.endereco.trim().length < 5 && !temGps) erros.push(['ckEnd', SERVICO ? 'Envie sua localização pelo GPS ou digite onde você está' : 'Informe rua, número e bairro']);
    if (c.pagamento === 'dinheiro' && c.troco && Number(c.troco) < subtotal() + (c.forma === 'entrega' ? Number(estab.taxa_entrega || 0) : 0)) {
      erros.push(['ckTroco', 'O troco precisa ser maior que o total']);
    }
    erros.forEach(function (e) { marcarErro(e[0], e[1]); });
    if (erros.length) {
      var el = $(erros[0][0]);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    return !erros.length;
  }

  function payloadItens() {
    return carrinho.map(function (l) {
      return l.tipo === 'combo'
        ? { tipo: 'combo', combo_id: l.combo_id, sabores: l.sabores, qtd: l.qtd, obs: l.obs || null }
        : { tipo: 'item', item_id: l.item_id, meio_item_id: l.meio_item_id || null, borda_id: l.borda_id || null, qtd: l.qtd, obs: l.obs || null };
    });
  }

  async function enviarPedido() {
    lerCamposCheckout();
    if (!validarCheckout()) return;
    var c = checkout;
    c.erro = null;
    c.enviando = true;
    renderCheckout();

    var resultado;
    if (MODO_DEMO) {
      await new Promise(function (r) { setTimeout(r, 700); });
      var taxa = c.forma === 'entrega' ? Number(estab.taxa_entrega || 0) : 0;
      resultado = {
        id: 'demo', numero: Math.floor(10 + Math.random() * 89), subtotal: subtotal(), taxa_entrega: taxa, total: subtotal() + taxa,
        itens: carrinho.map(function (l) { return { descricao: l.descricao, qtd: l.qtd, preco: l.preco, total: l.preco * l.qtd, obs: l.obs || null }; })
      };
    } else {
      var resp = await window.db.rpc('delivery_criar_pedido', {
        p_estabelecimento_id: estab.id,
        p_cliente_telefone: U.soDigitos(c.telefone),
        p_cliente_nome: c.nome.trim(),
        p_itens: payloadItens(),
        p_forma_entrega: c.forma,
        p_endereco_entrega: c.forma === 'entrega' ? c.endereco.trim() : null,
        p_referencia: c.forma === 'entrega' ? (c.referencia.trim() || null) : null,
        p_forma_pagamento: c.pagamento,
        p_troco_para: c.pagamento === 'dinheiro' && c.troco ? Number(c.troco) : null,
        p_observacao: c.obs.trim() || null,
        p_lat: c.forma === 'entrega' && c.gps && c.gps.status === 'ok' ? c.gps.lat : null,
        p_lng: c.forma === 'entrega' && c.gps && c.gps.status === 'ok' ? c.gps.lng : null,
        p_detalhes: SERVICO ? {
          veiculo: VEICULO ? c.veiculo : null, modelo: VEICULO ? ((c.modelo || '').trim() || null) : null,
          quando: !URGENTE ? ((c.quando || '').trim() || null) : null,
          precisao_m: c.gps && c.gps.status === 'ok' ? c.gps.precisao : null } : null
      });
      if (resp.error) {
        c.enviando = false;
        c.erro = U.mensagemErro(resp.error, 'Não deu pra enviar agora. Tenta de novo em instantes.');
        if (/fechada/i.test(c.erro)) { estab.status_manual = 'fechado'; atualizarStatus(); }
        renderCheckout(true);
        return;
      }
      resultado = resp.data;
    }

    U.gravarLocal(CLIENTE_KEY, { nome: c.nome.trim(), telefone: U.soDigitos(c.telefone), endereco: c.endereco.trim(), referencia: c.referencia.trim(), veiculo: c.veiculo, modelo: (c.modelo || '').trim() });
    if (!MODO_DEMO) {
      var lista = U.lerLocal(PEDIDOS_KEY, []);
      lista.unshift({ id: resultado.id, numero: resultado.numero, loja: estab.nome, slug: estab.slug, cidade: estab.cidade, ts: Date.now() });
      U.gravarLocal(PEDIDOS_KEY, lista.slice(0, 20));
    }
    var dados = { nome: c.nome.trim(), telefone: c.telefone, forma: c.forma, endereco: c.endereco.trim(), referencia: c.referencia.trim(), pagamento: c.pagamento, troco: c.troco, obs: c.obs.trim(),
      gps: c.forma === 'entrega' && c.gps && c.gps.status === 'ok' ? c.gps : null,
      veiculo: VEICULO ? c.veiculo : null, modelo: VEICULO ? (c.modelo || '').trim() : '', quando: !URGENTE && SERVICO ? (c.quando || '').trim() : '' };
    carrinho = [];
    salvarCarrinho();
    renderizarCarrinhoBar();
    marcarItensNoCarrinho();
    checkout.enviando = false;
    checkout.obs = '';
    checkout.troco = '';
    atualizarBadgePedidos();
    abrirSucesso(resultado, dados);
  }

  function linkWhats(texto) {
    var d = U.soDigitos(estab.telefone_whatsapp);
    if (d.length <= 11) d = '55' + d;
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(texto);
  }

  function mensagemPedido(p, d) {
    var L = ['*' + V.pedido + ' #' + p.numero + ' — ' + estab.nome + '*', ''];
    (p.itens || []).forEach(function (l) {
      L.push(l.qtd + 'x ' + l.descricao + ' — ' + U.precoOuCombinar(l.total));
      if (l.obs) L.push('   _' + l.obs + '_');
    });
    L.push('');
    if (Number(p.total) > 0) {
      L.push('Subtotal: ' + U.preco(p.subtotal));
      if (d.forma === 'entrega') L.push(V.taxa + ': ' + (Number(p.taxa_entrega) ? U.preco(p.taxa_entrega) : 'grátis'));
      L.push('*Total: ' + U.preco(p.total) + '*' + ((p.itens || []).some(function (l) { return !(Number(l.total) > 0); }) ? ' + itens a combinar' : ''));
    } else {
      L.push('_Valor a combinar no orçamento_');
    }
    L.push('');
    L.push('Nome: ' + d.nome);
    if (d.forma === 'entrega') {
      if (d.endereco || d.referencia) L.push(V.entregarEm + ': ' + (d.endereco && d.referencia ? d.endereco + ' (' + d.referencia + ')' : (d.endereco || d.referencia)));
      if (d.gps) L.push('Localização: https://maps.google.com/?q=' + d.gps.lat + ',' + d.gps.lng);
    } else {
      L.push(V.voceRetira);
    }
    if (d.veiculo || d.modelo) L.push('Veículo: ' + [d.veiculo, d.modelo].filter(Boolean).join(' — '));
    if (d.quando) L.push('Quando: ' + d.quando);
    if (d.pagamento) L.push('Pagamento: ' + (U.PAGAMENTOS[d.pagamento] || d.pagamento) + (d.pagamento === 'dinheiro' && d.troco ? ' — troco para ' + U.preco(d.troco) : ''));
    if (d.obs) L.push('Obs.: ' + d.obs);
    return L.join('\n');
  }

  function abrirSucesso(p, d) {
    var corpo = '<div class="sucesso"><div class="sucesso-check">' + U.ICONES.check + '</div>' +
      '<h3>' + V.enviado + '</h3><span class="numero-pedido">' + V.pedido + ' #' + p.numero + (Number(p.total) > 0 ? ' · ' + U.preco(p.total) : '') + '</span>' +
      '<p>' + V.recebido + ' Toque abaixo pra mandar a confirmação no WhatsApp — assim vocês conversam por lá se precisar.</p></div>';
    var rodape = '<a class="btn whats cheio" id="sucessoWhats" href="' + esc(linkWhats(mensagemPedido(p, d))) + '" target="_blank" rel="noopener">' + U.ICONES.whats + 'Enviar no WhatsApp</a>';
    abrirSheet('sucesso', cabecaSheet('Tudo certo') + '<div class="sheet-corpo">' + corpo +
      (MODO_DEMO ? '' : '<button type="button" class="btn sec cheio" data-abrir="meusPedidos" style="margin-top:.4rem">Acompanhar ' + V.pedido.toLowerCase() + '</button>') +
      '</div><div class="sheet-rodape">' + rodape + '</div>');
  }

  /* ===================== meus pedidos ===================== */
  var timerPedidos = null;
  function pararPollingPedidos() { clearInterval(timerPedidos); timerPedidos = null; }

  function atualizarBadgePedidos() {
    var lista = U.lerLocal(PEDIDOS_KEY, []);
    var recentes = lista.filter(function (p) { return Date.now() - p.ts < 24 * 3600 * 1000; });
    $('badgePedidos').textContent = recentes.length ? recentes.length : '';
  }

  var ETAPAS = ['novo', 'preparando', 'saiu_entrega', 'concluido'];
  function rotuloStatus(status, forma) {
    if (status === 'saiu_entrega') return forma === 'retirada' ? V.st.saiu_retirada : V.st.saiu_entrega;
    if (status === 'concluido') return forma === 'retirada' ? V.st.concluido_retirada : V.st.concluido;
    return V.st[status] || 'Cancelado';
  }

  async function abrirMeusPedidos() {
    var lista = U.lerLocal(PEDIDOS_KEY, []);
    if (!lista.length || MODO_DEMO) {
      abrirSheet('pedidos', cabecaSheet(V.meusPedidos) + '<div class="sheet-corpo"><p class="sheet-desc" style="text-align:center;padding:2rem 0">Seus pedidos feitos neste aparelho aparecem aqui, com o andamento em tempo real.</p></div>');
      return;
    }
    if (sheetNome !== 'pedidos') {
      abrirSheet('pedidos', cabecaSheet(V.meusPedidos) + '<div class="sheet-corpo"><div class="skeleton-item" style="height:120px;margin-bottom:.8rem"></div><div class="skeleton-item" style="height:120px"></div></div>');
    }
    var r = await window.db.rpc('delivery_pedidos_status_publico', { p_ids: lista.map(function (p) { return p.id; }) });
    if (sheetNome !== 'pedidos') return;
    var pedidos = r.data || [];
    var html = pedidos.map(function (p) {
      var idx = ETAPAS.indexOf(p.status);
      var barras = ETAPAS.map(function (e, i) {
        return '<span class="' + (p.status === 'cancelado' ? '' : i < idx || p.status === 'concluido' ? 'feito' : i === idx ? 'atual' : '') + '"></span>';
      }).join('');
      var quando = new Date(p.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return '<div class="pedido-card"><div class="pedido-card-topo"><strong>#' + p.numero + ' · ' + esc(p.loja) + '</strong><span>' + U.preco(p.total) + '</span></div>' +
        '<small>' + quando + ' · ' + (p.forma_entrega === 'retirada' ? V.retiradaCurta : V.entrega) + '</small>' +
        '<div class="timeline">' + barras + '</div>' +
        '<div class="timeline-rotulo' + (p.status === 'cancelado' ? ' cancelado' : '') + '">' + rotuloStatus(p.status, p.forma_entrega) + '</div></div>';
    }).join('') || '<p class="sheet-desc">Nenhum pedido encontrado.</p>';
    $('sheetConteudo').innerHTML = cabecaSheet(V.meusPedidos) + '<div class="sheet-corpo">' + html +
      '<p class="sheet-desc" style="font-size:.76rem;text-align:center;margin-top:.6rem">Atualiza sozinho a cada 15 segundos.</p></div>';
    if (!timerPedidos) timerPedidos = setInterval(function () { if (sheetNome === 'pedidos') abrirMeusPedidos(); else pararPollingPedidos(); }, 15000);
  }

  /* ===================== socorro rápido (atendimento no local) ===================== */
  function abrirSocorro() {
    var corpo = '<p class="sheet-desc">' + (URGENTE ? 'Escolha o que aconteceu — no próximo passo você manda a localização.' : 'Escolha o serviço — no próximo passo você diz onde e quando fica bom.') + '</p><div class="opcoes" style="margin-top:.8rem">' +
      cardapio.itens.map(function (i) {
        return '<button type="button" class="opcao" data-socorro="' + i.id + '"><span class="marca">' + U.ICONES.check + '</span>' +
          '<span class="opcao-nome">' + esc(i.nome) + (i.descricao ? '<br><small style="font-weight:500;color:var(--ink-faint)">' + esc(i.descricao) + '</small>' : '') + '</span>' +
          '<span class="opcao-extra">' + U.precoOuCombinar(i.preco) + '</span></button>';
      }).join('') + '</div>';
    abrirSheet('socorro', cabecaSheet(URGENTE ? 'Qual é o problema?' : 'Qual serviço você precisa?') + '<div class="sheet-corpo">' + corpo + '</div>');
  }

  /* ===================== sobre a loja ===================== */
  function abrirSobre() {
    var hoje = new Date().toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
    var dowHoje = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(hoje);
    var h = estab.horarios || {};
    var corpo = '';
    if (estab.descricao) corpo += '<p class="sheet-desc">' + esc(estab.descricao) + '</p>';
    if (estab.endereco) {
      corpo += '<div class="grupo"><div class="grupo-titulo">Endereço</div><p class="sheet-desc">' + esc(estab.endereco) + '</p>' +
        '<a class="link-acao" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(estab.endereco + ', ' + U.cidadeLegivel(estab.cidade)) + '">Abrir no mapa</a></div>';
    }
    if (Object.keys(h).length) {
      corpo += '<div class="grupo"><div class="grupo-titulo">Horários</div><table class="horarios-tabela">' +
        [1, 2, 3, 4, 5, 6, 0].map(function (d) {
          return '<tr class="' + (d === dowHoje ? 'hoje' : '') + '"><td>' + U.DIAS[d] + '</td><td>' + esc(U.descreverHorarioDia(h[String(d)])) + '</td></tr>';
        }).join('') + '</table></div>';
    }
    if ((estab.formas_pagamento || []).length) {
      corpo += '<div class="grupo"><div class="grupo-titulo">Pagamento</div><p class="sheet-desc">' +
        estab.formas_pagamento.map(function (f) { return esc(U.PAGAMENTOS[f] || f); }).join(' · ') + '</p></div>';
    }
    var rodape = '<a class="btn whats cheio" href="' + esc(linkWhats('Olá! Vim pelo cardápio digital.')) + '" target="_blank" rel="noopener">' + U.ICONES.whats + 'Falar com a loja</a>';
    if (estab.instagram_url) {
      var ig = /^https?:\/\//.test(estab.instagram_url) ? estab.instagram_url : 'https://instagram.com/' + estab.instagram_url.replace(/^@/, '');
      rodape = '<a class="btn sec" href="' + esc(ig) + '" target="_blank" rel="noopener" aria-label="Instagram">' + U.ICONES.insta.replace('<svg', '<svg width="20" height="20"') + '</a>' + rodape;
    }
    abrirSheet('sobre', cabecaSheet(estab.nome) + '<div class="sheet-corpo">' + corpo + '</div><div class="sheet-rodape">' + rodape + '</div>');
  }

  /* ===================== eventos ===================== */
  function rolarPara(id) {
    var alvo = document.getElementById(id);
    if (!alvo) return;
    var folga = $('topbar').offsetHeight + ($('navPills').classList.contains('oculto') ? 0 : $('navPills').offsetHeight) + 8;
    window.scrollTo({ top: alvo.getBoundingClientRect().top + window.pageYOffset - folga, behavior: 'smooth' });
  }

  var scrollspySuprimido = false;
  function marcarPill(id) {
    var ativa = null;
    document.querySelectorAll('.nav-pill').forEach(function (p) {
      var sim = p.getAttribute('href') === '#' + id;
      p.classList.toggle('ativo', sim);
      if (sim) ativa = p;
    });
    if (ativa) {
      var trilho = $('navPills');
      trilho.scrollTo({ left: ativa.offsetLeft - trilho.clientWidth / 2 + ativa.clientWidth / 2, behavior: 'smooth' });
    }
  }

  function ligarScrollspy() {
    var titulos = document.querySelectorAll('.cardapio-categoria-titulo[id]');
    if (!titulos.length || !('IntersectionObserver' in window)) return;
    var folga = $('topbar').offsetHeight + $('navPills').offsetHeight + 20;
    var obs = new IntersectionObserver(function (entradas) {
      if (scrollspySuprimido) return;
      entradas.forEach(function (e) { if (e.isIntersecting) marcarPill(e.target.id.replace('catg-', 'catg-')); });
    }, { rootMargin: '-' + folga + 'px 0px -60% 0px', threshold: 0 });
    titulos.forEach(function (t) { obs.observe(t); });
  }

  function ligarEventos() {
    $('tbMenuBtn').addEventListener('click', function () { $('drawer').classList.add('aberto'); $('drawer').setAttribute('aria-hidden', 'false'); });
    $('drawerBackdrop').addEventListener('click', function () { $('drawer').classList.remove('aberto'); $('drawer').setAttribute('aria-hidden', 'true'); });

    document.addEventListener('click', function (e) {
      var ancora = e.target.closest('.nav-pill, #drawerLinks .drawer-link');
      if (ancora) {
        e.preventDefault();
        $('drawer').classList.remove('aberto');
        var id = ancora.getAttribute('href').slice(1);
        marcarPill(id);
        scrollspySuprimido = true;
        rolarPara(id);
        clearTimeout(window.__vbSpy);
        window.__vbSpy = setTimeout(function () { scrollspySuprimido = false; }, 800);
        return;
      }

      var abrir = e.target.closest('[data-abrir]');
      if (abrir) {
        $('drawer').classList.remove('aberto');
        var alvo = abrir.getAttribute('data-abrir');
        if (alvo === 'meusPedidos') abrirMeusPedidos();
        if (alvo === 'sobre') abrirSobre();
        return;
      }

      var add = e.target.closest('[data-add]');
      if (add) {
        e.stopPropagation();
        var item = itemPorId(add.getAttribute('data-add'));
        if (!item) return;
        if (temOpcoes(item)) { abrirItem(item.id); return; }
        adicionarAoCarrinho({ tipo: 'item', item_id: item.id, meio_item_id: null, borda_id: null, qtd: 1, obs: '', descricao: item.nome, preco: Number(item.preco) });
        U.toast(item.nome + ' no pedido');
        return;
      }
      var card = e.target.closest('.item-card[data-item]');
      if (card) { abrirItem(card.getAttribute('data-item')); return; }
      if (e.target.closest('[data-meio]')) {
        var eleg = elegiveisMeio();
        if (eleg.length) abrirItem(eleg[0].id, { meio: true });
        return;
      }
      var comboCard = e.target.closest('[data-combo]');
      if (comboCard) { abrirCombo(comboCard.getAttribute('data-combo')); return; }

      if (e.target.closest('[data-fechar-sheet]')) { fecharSheet(); return; }
      if (e.target.closest('#btnSocorro')) { abrirSocorro(); return; }
      var soc = e.target.closest('[data-socorro]');
      if (soc) {
        var escolhido = itemPorId(soc.getAttribute('data-socorro'));
        if (escolhido && !carrinho.some(function (l) { return l.item_id === escolhido.id; })) {
          adicionarAoCarrinho({ tipo: 'item', item_id: escolhido.id, meio_item_id: null, borda_id: null, qtd: 1, obs: '', descricao: escolhido.nome, preco: Number(escolhido.preco) });
        }
        abrirCheckout();
        return;
      }
      var voltar = e.target.closest('[data-voltar]');
      if (voltar) { lerCamposCheckout(); abrirCarrinho(); return; }

      // dentro da sheet do item
      if (sheetNome === 'item') {
        var op = e.target.closest('[data-meio-op]');
        if (op) { lerObs('itemObs', estadoItem); estadoItem.meio = op.getAttribute('data-meio-op') === '1'; if (!estadoItem.meio) estadoItem.metadeId = null; renderItemSheet(); return; }
        var met = e.target.closest('[data-metade]');
        if (met) { lerObs('itemObs', estadoItem); estadoItem.metadeId = met.getAttribute('data-metade'); renderItemSheet(); return; }
        var bo = e.target.closest('[data-borda]');
        if (bo) { lerObs('itemObs', estadoItem); estadoItem.bordaId = bo.getAttribute('data-borda') || null; renderItemSheet(); return; }
        var qi = e.target.closest('[data-qtd-item]');
        if (qi) { lerObs('itemObs', estadoItem); estadoItem.qtd = Math.max(1, Math.min(50, estadoItem.qtd + Number(qi.getAttribute('data-qtd-item')))); renderItemSheet(); return; }
        if (e.target.closest('#itemAddBtn')) { lerObs('itemObs', estadoItem); adicionarItemDaSheet(); return; }
      }
      if (sheetNome === 'combo') {
        var sab = e.target.closest('[data-sabor]');
        if (sab) {
          lerObs('comboObs', estadoCombo);
          var sid = sab.getAttribute('data-sabor');
          var pos = estadoCombo.sel.indexOf(sid);
          if (pos !== -1) estadoCombo.sel.splice(pos, 1);
          else if (estadoCombo.sel.length < estadoCombo.combo.qtd_sabores) estadoCombo.sel.push(sid);
          renderComboSheet();
          return;
        }
        var qc = e.target.closest('[data-qtd-combo]');
        if (qc) { lerObs('comboObs', estadoCombo); estadoCombo.qtd = Math.max(1, Math.min(50, estadoCombo.qtd + Number(qc.getAttribute('data-qtd-combo')))); renderComboSheet(); return; }
        if (e.target.closest('#comboAddBtn')) { lerObs('comboObs', estadoCombo); adicionarComboDaSheet(); return; }
      }
      if (sheetNome === 'carrinho') {
        var lq = e.target.closest('[data-linha-qtd]');
        if (lq) { mudarQtdLinha(Number(lq.getAttribute('data-linha-qtd')), Number(lq.getAttribute('data-d'))); return; }
        if (e.target.closest('#irCheckoutBtn')) { abrirCheckout(); return; }
      }
      if (sheetNome === 'checkout') {
        var fm = e.target.closest('[data-forma]');
        if (fm && !fm.disabled) { lerCamposCheckout(); checkout.forma = fm.getAttribute('data-forma'); renderCheckout(); return; }
        var pg = e.target.closest('[data-pag]');
        if (pg) { lerCamposCheckout(); checkout.pagamento = pg.getAttribute('data-pag'); renderCheckout(); return; }
        if (e.target.closest('[data-copiar-pix]')) {
          if (navigator.clipboard) navigator.clipboard.writeText(estab.chave_pix).then(function () { U.toast('Chave Pix copiada'); });
          return;
        }
        if (e.target.closest('#enviarPedidoBtn')) { enviarPedido(); return; }
        if (e.target.closest('[data-gps]')) { pegarLocalizacao(); return; }
        var vc = e.target.closest('[data-veiculo]');
        if (vc) { lerCamposCheckout(); checkout.veiculo = vc.getAttribute('data-veiculo'); renderCheckout(); return; }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (sheetAberto) fecharSheet();
        else $('drawer').classList.remove('aberto');
      }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.especial-card, .item-card')) { e.preventDefault(); e.target.click(); }
    });

    window.addEventListener('popstate', function () { if (sheetAberto) fecharSheet(true); });
    ligarArrasto();

    $('cartResumo').addEventListener('click', abrirCarrinho);

    var buscaTimer;
    $('buscaBox').addEventListener('input', function () {
      var campoBusca = this;
      clearTimeout(buscaTimer);
      buscaTimer = setTimeout(function () { filtrar(campoBusca.value); }, 90);
    });

    var topbar = $('topbar');
    window.addEventListener('scroll', function () { topbar.classList.toggle('rolou', window.scrollY > 8); }, { passive: true });
    ligarScrollspy();

    if (MODO_PREVIEW) {
      window.addEventListener('message', function (ev) {
        if (ev.origin !== location.origin || !ev.data) return;
        if (ev.data.tipo === 'vb-tpl') aplicarVisual(ev.data.cor, ev.data.layout, ev.data.tom);
        if (ev.data.tipo === 'vb-recarregar') location.reload();
      });
    }
  }

  function lerObs(id, estado) { var el = $(id); if (el && estado) estado.obs = el.value; }

  function filtrar(texto) {
    var termo = U.slugificar(texto).replace(/-/g, ' ');
    var algum = false;
    document.querySelectorAll('.item-card[data-item]').forEach(function (card) {
      var alvo = U.slugificar(card.getAttribute('data-busca')).replace(/-/g, ' ');
      var mostra = !termo || alvo.indexOf(termo) !== -1;
      card.classList.toggle('oculto', !mostra);
      if (mostra) algum = true;
    });
    document.querySelectorAll('.grupo-cardapio').forEach(function (g) {
      g.classList.toggle('oculto', !g.querySelector('.item-card:not(.oculto)'));
    });
    var esp = $('secaoEspeciais');
    if (esp) esp.classList.toggle('oculto', !!termo);
    $('buscaVazia').classList.toggle('oculto', algum || !termo);
  }

  iniciar();
})();
