/* Passo a passo de criação do negócio (funil). Cada passo pergunta uma
   coisa só e as perguntas mudam conforme as respostas:

   1. O que seu negócio faz? → Agenda (horário marcado), Delivery (vende e
      entrega) ou No local (vai até o cliente / orçamento), com a opção de
      juntar a Agenda com uma das outras duas.
   2. Tipo de negócio → só os segmentos daquela área.
   3. Perguntas da área → atendimento (masc./fem.) na Agenda, como o
      cliente recebe no Delivery, onde atende no No local.
   4. Aparência → estilos do site (Agenda) ou jeito da loja (lista,
      grade, cardápio, vitrine; claro ou vibrante).
   5. Nome e link, cidade e WhatsApp → o negócio nasce aqui.

   A pré-visualização ao fundo troca sozinha: site da Agenda
   (preview-embutido.html) ou a loja/chamado de exemplo (pedir.html?demo). */
(function () {
  if (!window.db) return;

  var CHAVE_RETOMAR = 'vibe-criar-params';
  var SEG = window.VibeSegmentos;

  // precisa estar logado — a conta vira dona do negócio (criar_estabelecimento
  // usa auth.uid()). Sem login: guarda o que já veio escolhido (?area,
  // ?segmento, ?template) e volta pra cá depois de entrar (ver cadastro.js).
  db.auth.getSession().then(function (res) {
    if (!res.data || !res.data.session) {
      try { sessionStorage.setItem(CHAVE_RETOMAR, location.search || '?'); } catch (e) {}
      window.location.href = 'cadastro.html';
      return;
    }
    db.rpc('meus_estabelecimentos_com_stats').then(function (r) {
      if (r.data && r.data.length > 0) { window.location.href = 'cadastro.html'; return; }
      iniciarPassoAPasso();
    }, iniciarPassoAPasso);
  }, function () { window.location.href = 'cadastro.html'; });

  function iniciarPassoAPasso() {
  var salvo = null;
  try { salvo = sessionStorage.getItem(CHAVE_RETOMAR); sessionStorage.removeItem(CHAVE_RETOMAR); } catch (e) {}
  var params = new URLSearchParams(location.search || salvo || '');

  var AREAS = {
    agenda: { nome: 'Agenda', frase: 'Atendo com horário marcado', desc: 'O cliente escolhe o serviço, o profissional, o dia e a hora.' },
    delivery: { nome: 'Delivery', frase: 'Vendo e entrego', desc: 'Cardápio ou catálogo; o pedido chega no seu WhatsApp e no painel.' },
    servicos: { nome: 'No local', frase: 'Vou até o cliente', desc: 'Chamado na hora, com a localização, ou pedido de orçamento.' }
  };
  var ICONE_AREA = (window.VibeToggle && window.VibeToggle.ICONES) || {};

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var MAPA_ACENTOS = { 'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a', 'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o', 'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ç': 'c', 'ñ': 'n' };
  function slugificar(texto) {
    return String(texto || '').toLowerCase().replace(/[^\x00-\x7f]/g, function (c) { return MAPA_ACENTOS[c] || ''; })
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
  }
  // o banco guarda a cidade em minúsculas (lower(trim())) — o link usa igual
  function cidadeDoLink() { return estado.cidade.trim().toLowerCase(); }

  // ---- estado (o que veio pela URL já chega escolhido) ----
  var areaUrl = params.get('area');
  var estado = {
    area: AREAS[areaUrl] ? areaUrl : 'agenda',
    extra: null,                    // segunda área opcional (agenda + delivery/servicos)
    segmento: null,
    genero_atendimento: 'ambos',
    servico_onde: 'cliente',
    recebe: 'ambos',                // entrega | retirada | ambos
    template: params.get('template') || 'classico-boiserie',
    layout: 'lista', tom: 'claro',
    nome: '', slug: '', cidade: 'Itapetininga', telefone_whatsapp: '',
    foto_perfil_url: null, foto_hero_url: null, foto_hero_feminino_url: null,
    cor_destaque: null, cor_secundaria: null, texto_cta: 'Agendar horário',
    instagram_url: '', facebook_url: '', tiktok_url: '', total_servicos: 0, total_equipe: 0
  };
  var segUrl = params.get('segmento');
  estado.segmento = SEG.daArea(segUrl, estado.area) ? segUrl : SEG.POR_AREA[estado.area][0];
  var estabId = null;

  function areasEscolhidas() {
    var a = [estado.area];
    if (estado.extra && estado.extra !== estado.area) a.push(estado.extra);
    return a.sort(function (x, y) { return x === 'agenda' ? -1 : y === 'agenda' ? 1 : 0; });
  }
  function tem(area) { return areasEscolhidas().indexOf(area) > -1; }
  function areaDePedidos() { return tem('delivery') ? 'delivery' : tem('servicos') ? 'servicos' : null; }
  function tingir() { if (window.VibeToggle) window.VibeToggle.tingir(estado.area); }

  // ---- pré-visualização ao vivo ----
  var frame = document.getElementById('wizardPreviewFrame');
  var previewPronto = false;
  function srcDesejado() {
    return tem('agenda') ? 'preview-embutido.html?v=1'
      : '/pedir.html?demo=' + encodeURIComponent(estado.segmento) + '&preview=1';
  }
  function trocarPreview(forcar) {
    var alvo = srcDesejado();
    if (!forcar && frame.getAttribute('src') === alvo) return;
    previewPronto = false;
    frame.setAttribute('src', alvo);
  }
  frame.addEventListener('load', function () {
    if (!tem('agenda')) { previewPronto = true; postEstado(); }
  });
  function postEstado() {
    if (!previewPronto || !frame.contentWindow) return;
    if (tem('agenda')) {
      frame.contentWindow.postMessage({ tipo: 'vb-preview-estado', estado: estado }, '*');
    } else {
      frame.contentWindow.postMessage({ tipo: 'vb-tpl', cor: null, layout: estado.layout, tom: estado.tom }, location.origin);
      if (estado.nome.trim()) frame.contentWindow.postMessage({ tipo: 'vb-nome', nome: estado.nome.trim() }, location.origin);
    }
  }
  window.addEventListener('message', function (e) {
    if (e.data && e.data.tipo === 'vb-preview-pronto') { previewPronto = true; postEstado(); }
  });

  function cartoes(lista, selecionado, atributo) {
    return lista.map(function (o) {
      var sel = o.chave === selecionado;
      return '<button type="button" class="criar-opcao-card' + (sel ? ' is-selecionado' : '') + '" data-' + atributo + '="' + o.chave + '" aria-pressed="' + sel + '">' +
        (o.icone ? '<span class="criar-opcao-icone">' + o.icone + '</span>' : '') +
        '<span class="criar-opcao-nome">' + escapeHtml(o.nome) + '</span>' +
        (o.desc ? '<span class="criar-opcao-desc">' + escapeHtml(o.desc) + '</span>' : '') + '</button>';
    }).join('');
  }
  function aoEscolher(el, atributo, fn) {
    el.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-' + atributo + ']');
      if (btn) fn(btn.getAttribute('data-' + atributo));
    });
  }

  // ---- 1. o que seu negócio faz ----
  var ROTULO_EXTRA = { agenda: 'Também atendo com horário marcado', delivery: 'Também vendo com entrega', servicos: 'Também vou até o cliente' };
  function renderPassoArea(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Escolha o principal. Dá pra juntar a Agenda com uma das outras — e mudar depois no painel.</p>' +
      '<div class="criar-areas" id="criarAreas"></div>' +
      '<div class="criar-extra" id="criarExtra"></div>';
    function desenhar() {
      document.getElementById('criarAreas').innerHTML = Object.keys(AREAS).map(function (k) {
        var a = AREAS[k];
        var sel = k === estado.area;
        return '<button type="button" class="criar-area-card' + (sel ? ' is-selecionado' : '') + '" data-area="' + k + '" aria-pressed="' + sel + '">' +
          '<span class="criar-area-ic">' + (ICONE_AREA[k] || '') + '</span>' +
          '<span class="criar-area-txt"><strong>' + a.frase + '</strong><small>' + a.desc + '</small></span>' +
          '<span class="criar-area-tag">' + a.nome + '</span></button>';
      }).join('');
      var extras = estado.area === 'agenda' ? ['delivery', 'servicos'] : ['agenda'];
      document.getElementById('criarExtra').innerHTML = '<p class="criar-extra-titulo">Quer outra área junto? <span>(opcional)</span></p>' +
        extras.map(function (k) {
          var on = estado.extra === k;
          return '<button type="button" class="criar-extra-chip' + (on ? ' is-on' : '') + '" data-extra="' + k + '" aria-pressed="' + on + '">' +
            '<span class="criar-extra-caixa" aria-hidden="true"></span>' + ROTULO_EXTRA[k] + ' <em>' + AREAS[k].nome + '</em></button>';
        }).join('');
    }
    desenhar();
    aoEscolher(container.querySelector('#criarAreas'), 'area', function (k) {
      estado.area = k;
      if (estado.extra === k || (k !== 'agenda' && estado.extra !== 'agenda')) estado.extra = null;
      if (!SEG.daArea(estado.segmento, k)) estado.segmento = SEG.POR_AREA[k][0];
      tingir(); desenhar(); trocarPreview(); postEstado(); atualizarCabecalho();
    });
    aoEscolher(container.querySelector('#criarExtra'), 'extra', function (k) {
      estado.extra = estado.extra === k ? null : k;
      desenhar(); trocarPreview(); postEstado(); atualizarCabecalho();
    });
  }

  // ---- 2. tipo de negócio (só os da área) ----
  function renderPassoSegmento(container) {
    container.innerHTML = '<p class="criar-passo-intro">Qual desses combina mais com o seu negócio?</p>' +
      '<div id="criarOpcoesSegmento" class="criar-opcoes-segmento criar-opcoes-3"></div>';
    function desenhar() {
      document.getElementById('criarOpcoesSegmento').innerHTML = cartoes(SEG.POR_AREA[estado.area].map(function (k) {
        return { chave: k, nome: SEG.nome(k), icone: SEG.icone(k, 24, 1.8) };
      }), estado.segmento, 'segmento');
    }
    desenhar();
    aoEscolher(container.querySelector('#criarOpcoesSegmento'), 'segmento', function (k) {
      estado.segmento = k;
      desenhar();
      if (tem('agenda')) postEstado(); else trocarPreview();
      atualizarCabecalho();
    });
  }

  // ---- 3a. atendimento (Agenda de beleza) ----
  var OPCOES_GENERO = [
    { chave: 'ambos', nome: 'Os dois', desc: 'O cliente escolhe masculino ou feminino ao entrar.' },
    { chave: 'masculino', nome: 'Só masculino', desc: 'Vai direto pro site, sem tela de escolha.' },
    { chave: 'feminino', nome: 'Só feminino', desc: 'Vai direto pro site, sem tela de escolha.' }
  ];
  function perguntaGenero() {
    return tem('agenda') && ['barbearia', 'salao', 'manicure_pedicure', 'estetica', 'outro'].indexOf(estado.segmento) > -1;
  }
  function renderPassoAtendimento(container) {
    container.innerHTML = '<p class="criar-passo-intro">Você atende só um público, ou os dois?</p><div id="criarOpcoesGenero" class="criar-opcoes-genero"></div>';
    function desenhar() { document.getElementById('criarOpcoesGenero').innerHTML = cartoes(OPCOES_GENERO, estado.genero_atendimento, 'genero'); }
    desenhar();
    aoEscolher(container.querySelector('#criarOpcoesGenero'), 'genero', function (k) { estado.genero_atendimento = k; desenhar(); postEstado(); });
  }

  // ---- 3b. onde atende (No local) ----
  var OPCOES_ONDE = [
    { chave: 'cliente', nome: 'Vou até o cliente', desc: 'Atendimento móvel: o cliente manda a localização.' },
    { chave: 'loja', nome: 'O cliente vem até mim', desc: 'Loja ou oficina, com endereço no site.' },
    { chave: 'ambos', nome: 'Os dois', desc: 'Tenho endereço e também saio pra atender.' }
  ];
  function renderPassoOnde(container) {
    container.innerHTML = '<p class="criar-passo-intro">Onde acontece o serviço?</p><div id="criarOpcoesOnde" class="criar-opcoes-genero"></div>';
    function desenhar() { document.getElementById('criarOpcoesOnde').innerHTML = cartoes(OPCOES_ONDE, estado.servico_onde, 'onde'); }
    desenhar();
    aoEscolher(container.querySelector('#criarOpcoesOnde'), 'onde', function (k) { estado.servico_onde = k; desenhar(); });
  }

  // ---- 3c. como o cliente recebe (Delivery) ----
  var OPCOES_RECEBE = [
    { chave: 'ambos', nome: 'Entrega e retirada', desc: 'O cliente escolhe na hora de pedir.' },
    { chave: 'entrega', nome: 'Só entrega', desc: 'Sempre levo até o endereço do cliente.' },
    { chave: 'retirada', nome: 'Só retirada', desc: 'O cliente pede e busca no balcão.' }
  ];
  function renderPassoRecebe(container) {
    container.innerHTML = '<p class="criar-passo-intro">Como o pedido chega no cliente?</p><div id="criarOpcoesRecebe" class="criar-opcoes-genero"></div>';
    function desenhar() { document.getElementById('criarOpcoesRecebe').innerHTML = cartoes(OPCOES_RECEBE, estado.recebe, 'recebe'); }
    desenhar();
    aoEscolher(container.querySelector('#criarOpcoesRecebe'), 'recebe', function (k) { estado.recebe = k; desenhar(); });
  }

  // ---- 4a. estilo do site (Agenda) — prints reais de cada estilo ----
  function renderPassoTemplate(container) {
    var T = window.VibeTemplates || { LISTA: [], GRUPOS: [] };
    container.innerHTML = '<p class="criar-passo-intro">Escolha o visual. Você vê o resultado ao fundo e pode trocar quando quiser.</p>' +
      '<div class="criar-tpl-filtros" id="criarTplFiltros" role="group" aria-label="Filtrar estilos"></div>' +
      '<div id="criarTemplateEscolha" class="criar-template-grid"></div>';
    var grupoAtual = '';
    function desenhar() {
      document.getElementById('criarTplFiltros').innerHTML = T.GRUPOS.filter(function (g) {
        return !g.chave || T.LISTA.some(function (t) { return t.grupo === g.chave; });
      }).map(function (g) {
        return '<button type="button" class="chip' + (g.chave === grupoAtual ? ' is-ativo' : '') + '" data-grupo="' + g.chave + '" aria-pressed="' + (g.chave === grupoAtual) + '">' + escapeHtml(g.nome) + '</button>';
      }).join('');
      document.getElementById('criarTemplateEscolha').innerHTML = T.LISTA.filter(function (t) {
        return !grupoAtual || t.grupo === grupoAtual;
      }).map(function (t) {
        var sel = t.chave === estado.template;
        return '<button type="button" class="tpl-print-card' + (sel ? ' is-selecionado' : '') + '" data-template="' + t.chave + '" aria-pressed="' + sel + '">' +
          '<img src="' + t.print + '" alt="Prévia do estilo ' + escapeHtml(t.nome) + '" loading="lazy">' +
          '<span class="tpl-swatch-nome">' + escapeHtml(t.nome) + (t.segueFoto ? '<em>segue sua foto</em>' : '') + '</span></button>';
      }).join('');
    }
    desenhar();
    aoEscolher(container.querySelector('#criarTplFiltros'), 'grupo', function (g) { grupoAtual = g; desenhar(); });
    aoEscolher(container.querySelector('#criarTemplateEscolha'), 'template', function (k) { estado.template = k; desenhar(); postEstado(); });
  }

  // ---- 4b. jeito da loja (Delivery / No local) ----
  var LAYOUTS = [
    { chave: 'lista', nome: 'Lista', desc: 'Foto pequena ao lado. O jeito mais rápido.' },
    { chave: 'grade', nome: 'Grade', desc: 'Dois por linha, foto em cima.' },
    { chave: 'cardapio', nome: 'Cardápio', desc: 'Como o impresso: nome, pontilhado e preço.' },
    { chave: 'vitrine', nome: 'Vitrine', desc: 'Capa e fotos grandes.' }
  ];
  var TONS = [
    { chave: 'claro', nome: 'Claro', desc: 'Fundo claro com um toque da cor.' },
    { chave: 'vibrante', nome: 'Vibrante', desc: 'Faixa na sua cor, cartões translúcidos.' }
  ];
  function renderPassoLoja(container) {
    container.innerHTML = '<p class="criar-passo-intro">Como os itens aparecem pro cliente. Cor, fotos e logo você ajusta no painel.</p>' +
      '<div id="criarLayouts" class="criar-opcoes-segmento"></div>' +
      '<p class="criar-extra-titulo">Tom</p><div id="criarTons" class="criar-opcoes-segmento"></div>';
    function desenhar() {
      document.getElementById('criarLayouts').innerHTML = cartoes(LAYOUTS, estado.layout, 'layout');
      document.getElementById('criarTons').innerHTML = cartoes(TONS, estado.tom, 'tom');
    }
    desenhar();
    aoEscolher(container.querySelector('#criarLayouts'), 'layout', function (k) { estado.layout = k; desenhar(); postEstado(); });
    aoEscolher(container.querySelector('#criarTons'), 'tom', function (k) { estado.tom = k; desenhar(); postEstado(); });
  }

  // ---- 5. nome e link ----
  function renderPassoNome(container) {
    container.innerHTML =
      '<div class="field"><label for="criarNome">Nome do seu negócio</label>' +
      '<input type="text" id="criarNome" autocomplete="organization" placeholder="' + escapeHtml(SEG.exemplo(estado.segmento)) + '" value="' + escapeHtml(estado.nome) + '"></div>' +
      '<div class="field"><label for="criarSlug">Link (sai do nome, pode editar)</label>' +
      '<div class="prefixo"><span>/</span><input type="text" id="criarSlug" autocapitalize="off" spellcheck="false" value="' + escapeHtml(estado.slug) + '"></div>' +
      '<span class="criar-slug-status" id="criarSlugStatus"></span>' +
      '<span class="criar-slug-endereco" id="criarSlugEndereco"></span></div>';

    var slugManual = !!estado.slug;
    var statusEl = document.getElementById('criarSlugStatus');
    var timer = null;
    function mostrarEndereco() {
      document.getElementById('criarSlugEndereco').textContent =
        location.host + '/' + (estado.slug || 'seu-negocio') + '/' + cidadeDoLink() + (tem('agenda') ? '' : '/pedir');
    }
    function checar() {
      clearTimeout(timer);
      mostrarEndereco();
      var slug = estado.slug;
      if (!slug) { statusEl.className = 'criar-slug-status'; statusEl.textContent = ''; return; }
      statusEl.className = 'criar-slug-status checando';
      statusEl.textContent = 'verificando…';
      timer = setTimeout(function () {
        db.rpc('buscar_estabelecimento', { p_slug: slug, p_cidade: cidadeDoLink() }).then(function (res) {
          if (estado.slug !== slug) return;
          var ocupado = !!(res.data && res.data.length > 0 && res.data[0].id !== estabId);
          statusEl.className = 'criar-slug-status ' + (ocupado ? 'ocupado' : 'ok');
          statusEl.textContent = ocupado ? '✕ esse link já está em uso nessa cidade' : '✓ link disponível';
        }, function () { statusEl.className = 'criar-slug-status'; statusEl.textContent = ''; });
      }, 450);
    }
    document.getElementById('criarNome').addEventListener('input', function () {
      estado.nome = this.value;
      if (!slugManual) { estado.slug = slugificar(this.value); document.getElementById('criarSlug').value = estado.slug; checar(); }
      postEstado();
    });
    document.getElementById('criarSlug').addEventListener('input', function () {
      slugManual = true;
      estado.slug = slugificar(this.value);
      checar();
    });
    document.getElementById('criarSlug').addEventListener('blur', function () { this.value = estado.slug; });
    checar();
  }
  function erro(texto) {
    var msg = document.getElementById('criarMsg');
    msg.className = 'msg msg-erro';
    msg.textContent = texto;
    return false;
  }
  function validarNome() {
    if (estado.nome.trim().length < 2) return erro('Digite o nome do seu negócio.');
    if (!estado.slug) return erro('O link não pode ficar vazio.');
    var st = document.getElementById('criarSlugStatus');
    if (st && st.classList.contains('ocupado')) return erro('Esse link já está em uso nessa cidade — muda o nome ou o link.');
    return true;
  }

  // ---- 6. cidade ----
  var CIDADES = ['Itapetininga', 'Tatuí', 'Boituva', 'Itu', 'Sorocaba'];
  function renderPassoCidade(container) {
    container.innerHTML = '<div class="field"><label for="criarCidade">Em qual cidade fica?</label><select id="criarCidade">' +
      CIDADES.map(function (c) {
        return '<option value="' + escapeHtml(c) + '"' + (c.toLowerCase() === cidadeDoLink() ? ' selected' : '') + '>' + escapeHtml(c) + '</option>';
      }).join('') + '</select></div>';
    estado.cidade = document.getElementById('criarCidade').value;
    document.getElementById('criarCidade').addEventListener('change', function () { estado.cidade = this.value; postEstado(); });
  }

  // ---- 7. WhatsApp e criação ----
  function renderPassoWhatsapp(container) {
    var oQue = tem('agenda') ? 'os agendamentos' : tem('delivery') ? 'os pedidos' : 'os chamados e orçamentos';
    container.innerHTML = '<div class="field"><label for="criarWhatsapp">WhatsApp pra receber ' + oQue + ' (com DDD)</label>' +
      '<input type="tel" id="criarWhatsapp" inputmode="tel" autocomplete="tel" placeholder="15999999999" value="' + escapeHtml(estado.telefone_whatsapp) + '"></div>';
    document.getElementById('criarWhatsapp').addEventListener('input', function () { estado.telefone_whatsapp = this.value; });
  }
  function validarWhatsapp() {
    var n = estado.telefone_whatsapp.replace(/\D/g, '');
    if (n && (n.length < 10 || n.length > 13)) return erro('Confere o número: DDD + número, só os dígitos.');
    return true;
  }
  function camposDaLoja() {
    var c = { layout: estado.layout, template: estado.tom };
    if (tem('delivery')) { c.aceita_entrega = estado.recebe !== 'retirada'; c.aceita_retirada = estado.recebe !== 'entrega'; }
    return c;
  }
  function salvarNegocio() {
    var msg = document.getElementById('criarMsg');
    msg.className = 'msg';
    msg.textContent = 'Criando seu negócio…';
    var areas = areasEscolhidas();
    var onde = tem('servicos') ? estado.servico_onde : null;
    var fone = estado.telefone_whatsapp.replace(/\D/g, '') || null;
    var passo = !estabId
      ? db.rpc('criar_estabelecimento', {
          p_nome: estado.nome.trim(), p_slug: estado.slug, p_cidade: estado.cidade.trim(), p_segmento: estado.segmento,
          p_telefone_whatsapp: fone, p_template: estado.template, p_genero_atendimento: perguntaGenero() ? estado.genero_atendimento : 'ambos',
          p_areas: areas, p_servico_onde: onde
        }).then(function (res) {
          if (res.error) {
            var m = res.error.message || '';
            throw new Error(/duplicate|unique/.test(m) ? 'Já existe um negócio com esse link nessa cidade — muda o nome ou o link.' : m);
          }
          estabId = res.data.id;
        })
      : db.rpc('tenant_admin_atualizar_identidade', {
          p_estabelecimento_id: estabId, p_nome: estado.nome.trim(), p_slug: estado.slug, p_cidade: estado.cidade.trim(),
          p_segmento: estado.segmento, p_telefone_whatsapp: fone
        }).then(function (res) {
          if (res.error) throw new Error(res.error.message);
          return db.rpc('estabelecimento_definir_areas', { p_estabelecimento_id: estabId, p_areas: areas, p_servico_onde: onde });
        }).then(function (res) { if (res && res.error) throw new Error(res.error.message); });
    // o jeito da loja é um extra: se falhar, o negócio já existe e ajusta no painel
    return passo.then(function () {
      if (!areaDePedidos()) return null;
      return db.rpc('delivery_admin_atualizar_estabelecimento', { p_id: estabId, p_campos: camposDaLoja() }).then(null, function () {});
    }).then(function () { msg.textContent = ''; });
  }

  // ---- engine: a lista de passos é refeita a cada navegação (funil) ----
  function obterPassos() {
    var p = [
      { chave: 'area', titulo: 'O que seu negócio faz?', render: renderPassoArea },
      { chave: 'segmento', titulo: 'Tipo de negócio', render: renderPassoSegmento }
    ];
    if (perguntaGenero()) p.push({ chave: 'atendimento', titulo: 'Atendimento', render: renderPassoAtendimento });
    if (tem('servicos')) p.push({ chave: 'onde', titulo: 'Onde você atende?', render: renderPassoOnde });
    if (tem('delivery')) p.push({ chave: 'recebe', titulo: 'Entrega ou retirada?', render: renderPassoRecebe });
    p.push(tem('agenda')
      ? { chave: 'template', titulo: 'Estilo do site', render: renderPassoTemplate }
      : { chave: 'loja', titulo: 'Jeito da loja', render: renderPassoLoja });
    p.push(
      { chave: 'nome', titulo: 'Nome e link', render: renderPassoNome, validar: validarNome },
      { chave: 'cidade', titulo: 'Cidade', render: renderPassoCidade },
      { chave: 'whatsapp', titulo: 'WhatsApp', render: renderPassoWhatsapp, validar: validarWhatsapp, aoAvancar: salvarNegocio }
    );
    return p;
  }
  var passoAtual = 0;

  function atualizarCabecalho() {
    var passos = obterPassos();
    var passo = passos[passoAtual];
    document.getElementById('criarPassoLabel').textContent = 'Passo ' + (passoAtual + 1) + ' de ' + passos.length + ': ' + passo.titulo;
    document.getElementById('criarProgressoFill').style.width = (((passoAtual + 1) / passos.length) * 100) + '%';
    document.getElementById('criarProximoBtn').textContent = passoAtual === passos.length - 1
      ? (tem('agenda') ? 'Criar e abrir meu site ✓' : 'Criar e abrir meu painel ✓') : 'Próximo →';
  }
  function mostrarPasso(indice, direcao) {
    passoAtual = indice;
    var passo = obterPassos()[indice];
    document.getElementById('criarTituloPasso').textContent = passo.titulo;
    document.getElementById('criarVoltarBtn').style.visibility = indice === 0 ? 'hidden' : 'visible';
    atualizarCabecalho();
    var msg = document.getElementById('criarMsg');
    msg.textContent = ''; msg.className = 'msg';
    var container = document.getElementById('criarStepContainer');
    container.classList.remove('criar-step-anim', 'criar-step-volta');
    void container.offsetWidth; // reflow pra reanimar
    container.innerHTML = '';
    passo.render(container);
    container.classList.add('criar-step-anim');
    if (direcao === 'volta') container.classList.add('criar-step-volta');
    postEstado();
  }

  document.getElementById('criarProximoBtn').addEventListener('click', function () {
    var passos = obterPassos();
    var passo = passos[passoAtual];
    if (passo.validar && !passo.validar()) return;
    var btn = this;
    btn.disabled = true;
    function prosseguir() {
      btn.disabled = false;
      if (passoAtual < passos.length - 1) { mostrarPasso(passoAtual + 1); return; }
      if (window.VibeToggle) window.VibeToggle.marcarDirecao('avanca');
      var base = '/' + encodeURIComponent(estado.slug) + '/' + encodeURIComponent(cidadeDoLink());
      // Agenda: a criação continua no site real (tutorial guiado; a numeração segue)
      window.location.href = tem('agenda') ? base + '?tutorial=1&desde=' + passos.length : '/painel-area.html?nova=1';
    }
    function falhou(err) {
      btn.disabled = false;
      erro((err && err.message) || 'Algo deu errado — tenta de novo.');
    }
    if (passo.aoAvancar) passo.aoAvancar().then(prosseguir, falhou); else prosseguir();
  });
  document.getElementById('criarVoltarBtn').addEventListener('click', function () {
    if (passoAtual > 0) mostrarPasso(passoAtual - 1, 'volta');
  });

  tingir();
  trocarPreview(true);
  mostrarPasso(0);
  }
})();
