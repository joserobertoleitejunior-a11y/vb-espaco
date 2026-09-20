/* Passo a passo de criação de site — substitui o formulário único de
   antes. Cada passo pergunta uma coisa, atualiza a pré-visualização ao
   vivo (iframe rodando preview-embutido.html) e salva no backend assim
   que dá pra salvar (o estabelecimento nasce de verdade já no passo
   "Nome e dados básicos", os passos seguintes só completam ele). */
(function () {
  if (!window.db) return;

  // precisa estar logado (e-mail/senha ou Google) pra criar um site — a
  // conta é quem vira dona do estabelecimento (criar_estabelecimento usa
  // auth.uid()), e é ela que depois abre o modo admin sem PIN no site.
  // Só é permitido 1 estabelecimento por conta — se a conta já tem um,
  // nem começa o passo a passo (evita responder tudo pra descobrir isso
  // só no fim).
  db.auth.getSession().then(function (res) {
    if (!res.data || !res.data.session) {
      window.location.href = 'cadastro.html';
      return;
    }
    db.rpc('meus_estabelecimentos_com_stats').then(function (r) {
      if (r.data && r.data.length > 0) {
        window.location.href = 'cadastro.html';
        return;
      }
      iniciarPassoAPasso();
    }, function () {
      iniciarPassoAPasso();
    });
  }, function () {
    window.location.href = 'cadastro.html';
  });

  function iniciarPassoAPasso() {
  var params = new URLSearchParams(window.location.search);

  var SEGMENTOS_LABEL = {
    barbearia: 'Barbearia',
    salao: 'Salão de beleza',
    manicure_pedicure: 'Manicure e pedicure',
    estetica: 'Estética',
    estetica_automotiva: 'Estética automotiva',
    outro: 'Estabelecimento'
  };
  // mesmos ícones de linha do catálogo (index.html) — nada de emoji, pra
  // ficar consistente com o resto do app e com aparência mais séria/profissional
  var SEGMENTOS_ICONE = {
    barbearia: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8.1" y1="7.5" x2="20" y2="19"/><line x1="8.1" y1="16.5" x2="20" y2="5"/></svg>',
    salao: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 18c2-4 2-8 0-12"/><path d="M9 18c2-4 2-8 0-12"/><path d="M14 18c2-4 2-8 0-12"/><path d="M19 18c2-4 2-8 0-12"/></svg>',
    manicure_pedicure: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2h6v3l1.5 2v13a1 1 0 01-1 1h-7a1 1 0 01-1-1V7L9 5V2z"/><path d="M9 2h6"/></svg>',
    estetica: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M12 2L14.3 7.7L20 10L14.3 12.3L12 18L9.7 12.3L4 10L9.7 7.7z"/></svg>',
    estetica_automotiva: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12l1.5-4.5A2 2 0 0 1 6.4 6h11.2a2 2 0 0 1 1.9 1.5L21 12"/><path d="M3 12h18v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4z"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></svg>',
    outro: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1-5h16l1 5"/><path d="M3 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0"/><path d="M5 9v10h14V9"/><path d="M9 19v-6h6v6"/></svg>'
  };
  // exemplo de nome mostrado no campo — sempre do MESMO nicho escolhido,
  // pra nunca sugerir "Rafael Cabeleireiros" (barbearia) pra quem está
  // criando um site de estética automotiva, por exemplo
  var NOME_EXEMPLO_POR_SEGMENTO = {
    barbearia: 'Ex: Rafael Cabeleireiros',
    salao: 'Ex: Studio Bella Hair',
    manicure_pedicure: 'Ex: Espaço Unhas & Cia',
    estetica: 'Ex: Clínica Estética Renove',
    estetica_automotiva: 'Ex: Auto Estética Prime',
    outro: 'Ex: Nome do seu negócio'
  };

  var MAPA_ACENTOS = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c', 'ñ': 'n'
  };
  function removerAcentos(texto) {
    var resultado = '';
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      resultado += MAPA_ACENTOS[c] || c;
    }
    return resultado;
  }
  function slugificar(texto) {
    return removerAcentos((texto || '').toLowerCase())
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function formatarPreco(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }
  function hexParaRgbNums(hex) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16) || 0, parseInt(h.substr(2, 2), 16) || 0, parseInt(h.substr(4, 2), 16) || 0];
  }
  function misturarRgb(rgb, alvo, quantidade) {
    return rgb.map(function (c, i) { return Math.round(c + (alvo[i] - c) * quantidade); });
  }
  function rgbParaHex(rgb) {
    return '#' + rgb.map(function (c) {
      return Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
    }).join('');
  }

  var estado = {
    template: params.get('template') || 'classico-boiserie',
    genero_atendimento: 'ambos',
    nome: '', slug: '', cidade: 'Itapetininga', segmento: 'barbearia', telefone_whatsapp: '',
    foto_perfil_url: null,
    foto_hero_url: null, foto_hero_feminino_url: null,
    cor_destaque: null, cor_secundaria: null,
    texto_cta: 'Agendar horário',
    instagram_url: '', facebook_url: '', tiktok_url: '',
    total_servicos: 0, total_equipe: 0
  };
  var estabId = null;
  var pastaTemp = window.VBUpload ? window.VBUpload.novaPastaTemporaria() : 'novo-' + Date.now();

  // ---- pré-visualização ao vivo (iframe isolado, sem Supabase) ----
  var previewFrame = document.getElementById('wizardPreviewFrame');
  var previewPronto = false;
  function postEstado() {
    if (!previewPronto || !previewFrame.contentWindow) return;
    previewFrame.contentWindow.postMessage({ tipo: 'vb-preview-estado', estado: estado }, '*');
  }
  window.addEventListener('message', function (e) {
    if (e.data && e.data.tipo === 'vb-preview-pronto') {
      previewPronto = true;
      postEstado();
    }
  });


  // ---- passo 1: template ----
  // mini-mockup de cada template com as cores/raio reais dele (nada de
  // caixinha lisa com gradiente — o dono precisa reconhecer o site aqui)
  // ---- prints reais de cada template (gerados a partir do próprio
  // preview-embutido.html, não mockups em CSS) — o dono escolhe olhando
  // pro site de verdade, não pra uma representação abstrata dele. ----
  var TEMPLATES_DISPONIVEIS = [
    { chave: 'classico-boiserie', nome: 'Clássico', print: '/assets/img/templates/classico.jpg' },
    { chave: 'claro-minimal', nome: 'Claro', print: '/assets/img/templates/claro.jpg' },
    { chave: 'escuro-premium', nome: 'Escuro', print: '/assets/img/templates/escuro.jpg' },
    { chave: 'automotivo-carbono', nome: 'Automotivo', print: '/assets/img/templates/automotivo.jpg' },
    { chave: 'boho-terracota', nome: 'Boho', print: '/assets/img/templates/boho.jpg' },
    { chave: 'vidro-fosco', nome: 'Vidro', print: '/assets/img/templates/vidro.jpg' }
  ];
  function renderPassoTemplate(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Escolha o estilo visual do seu site. Você acompanha o resultado ao lado, e dá pra trocar depois.</p>' +
      '<div id="criarTemplateEscolha" class="criar-template-grid"></div>';
    function desenhar() {
      document.getElementById('criarTemplateEscolha').innerHTML = TEMPLATES_DISPONIVEIS.map(function (t) {
        return '<button type="button" class="tpl-print-card' + (t.chave === estado.template ? ' is-selecionado' : '') + '" data-template="' + t.chave + '">' +
          '<img src="' + t.print + '" alt="Prévia do template ' + t.nome + '" loading="lazy">' +
          '<span class="tpl-swatch-nome">' + t.nome + '</span>' +
          '</button>';
      }).join('');
    }
    desenhar();
    document.getElementById('criarTemplateEscolha').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-template]');
      if (!btn) return;
      estado.template = btn.getAttribute('data-template');
      desenhar();
      postEstado();
    });
  }

  // ---- passo (novo): segmento — qual tipo de negócio é, escolhido
  // visualmente (não mais um <select> escondido no meio dos outros
  // campos), pra já refletir no preview (rótulo do site) e decidir mais
  // pra frente quais serviços/fotos sugerir ----
  function renderPassoSegmento(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Qual desses combina mais com o seu negócio?</p>' +
      '<div id="criarOpcoesSegmento" class="criar-opcoes-segmento"></div>';
    function desenhar() {
      document.getElementById('criarOpcoesSegmento').innerHTML = Object.keys(SEGMENTOS_LABEL).map(function (k) {
        return '<button type="button" class="criar-opcao-card' + (k === estado.segmento ? ' is-selecionado' : '') + '" data-segmento="' + k + '">' +
          '<span class="criar-opcao-icone">' + SEGMENTOS_ICONE[k] + '</span>' +
          '<span class="criar-opcao-nome">' + SEGMENTOS_LABEL[k] + '</span></button>';
      }).join('');
    }
    desenhar();
    document.getElementById('criarOpcoesSegmento').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-segmento]');
      if (!btn) return;
      estado.segmento = btn.getAttribute('data-segmento');
      // estética automotiva não tem sentido de atendimento
      // masculino/feminino — pula essa pergunta pra esse nicho
      if (estado.segmento === 'estetica_automotiva') estado.genero_atendimento = 'ambos';
      desenhar();
      postEstado();
    });
  }

  // ---- passo 2: atendimento (gênero) ----
  var OPCOES_GENERO = [
    { chave: 'ambos', nome: 'Ambos', desc: 'O cliente escolhe masculino ou feminino ao entrar no site.' },
    { chave: 'masculino', nome: 'Só masculino', desc: 'Vai direto pro site, sem tela de escolha.' },
    { chave: 'feminino', nome: 'Só feminino', desc: 'Vai direto pro site, sem tela de escolha.' }
  ];
  function renderPassoAtendimento(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Seu estabelecimento atende só um público, ou os dois?</p>' +
      '<div id="criarOpcoesGenero" class="criar-opcoes-genero"></div>';
    function desenhar() {
      document.getElementById('criarOpcoesGenero').innerHTML = OPCOES_GENERO.map(function (o) {
        return '<button type="button" class="criar-opcao-card' + (o.chave === estado.genero_atendimento ? ' is-selecionado' : '') + '" data-genero="' + o.chave + '">' +
          '<span class="criar-opcao-nome">' + o.nome + '</span><span class="criar-opcao-desc">' + o.desc + '</span></button>';
      }).join('');
    }
    desenhar();
    document.getElementById('criarOpcoesGenero').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-genero]');
      if (!btn) return;
      estado.genero_atendimento = btn.getAttribute('data-genero');
      desenhar();
      postEstado();
    });
  }

  // ---- passos seguintes: cada um pergunta UMA coisa só (funil), não um
  // formulário inteiro de uma vez — nome+link seguem juntos porque são a
  // mesma ideia (o link nasce do nome), o resto vem em telas separadas ----
  function renderPassoNome(container) {
    var exemplo = NOME_EXEMPLO_POR_SEGMENTO[estado.segmento] || NOME_EXEMPLO_POR_SEGMENTO.outro;
    container.innerHTML =
      '<div class="field"><label for="criarNome">Nome do estabelecimento</label>' +
      '<input type="text" id="criarNome" placeholder="' + escapeHtml(exemplo) + '" value="' + escapeHtml(estado.nome) + '"></div>' +
      '<div class="field"><label for="criarSlug">Link (gerado a partir do nome, pode editar)</label>' +
      '<div class="prefixo"><span>vbagenda.com.br/</span><input type="text" id="criarSlug" value="' + escapeHtml(estado.slug) + '"></div>' +
      '<span class="criar-slug-status" id="criarSlugStatus"></span></div>';

    var slugTocadoManualmente = !!estado.slug;
    var slugStatusEl = document.getElementById('criarSlugStatus');
    var timerCheckSlug = null;
    function checarSlugDisponivel() {
      clearTimeout(timerCheckSlug);
      var slug = estado.slug.trim();
      var cidade = estado.cidade.trim().toLowerCase();
      if (!slug || !cidade) { slugStatusEl.className = 'criar-slug-status'; slugStatusEl.textContent = ''; return; }
      slugStatusEl.className = 'criar-slug-status checando';
      slugStatusEl.textContent = 'verificando…';
      timerCheckSlug = setTimeout(function () {
        db.rpc('buscar_estabelecimento', { p_slug: slug, p_cidade: cidade }).then(function (res) {
          if (estado.slug.trim() !== slug || estado.cidade.trim().toLowerCase() !== cidade) return;
          var ocupado = res.data && res.data.length > 0;
          slugStatusEl.className = 'criar-slug-status ' + (ocupado ? 'ocupado' : 'ok');
          slugStatusEl.textContent = ocupado ? '✕ esse link já está em uso nessa cidade' : '✓ link disponível';
        }, function () {
          slugStatusEl.className = 'criar-slug-status'; slugStatusEl.textContent = '';
        });
      }, 500);
    }
    document.getElementById('criarNome').addEventListener('input', function () {
      estado.nome = this.value;
      if (!slugTocadoManualmente) {
        estado.slug = slugificar(this.value);
        document.getElementById('criarSlug').value = estado.slug;
        checarSlugDisponivel();
      }
      postEstado();
    });
    document.getElementById('criarSlug').addEventListener('input', function () {
      slugTocadoManualmente = true;
      estado.slug = this.value;
      checarSlugDisponivel();
    });
    checarSlugDisponivel();
  }
  function validarNome() {
    var msg = document.getElementById('criarMsg');
    if (!estado.nome.trim()) { msg.className = 'msg msg-erro'; msg.textContent = 'Digite o nome do estabelecimento.'; return false; }
    if (!estado.slug.trim()) { msg.className = 'msg msg-erro'; msg.textContent = 'O link não pode ficar vazio.'; return false; }
    var slugStatusEl = document.getElementById('criarSlugStatus');
    if (slugStatusEl && slugStatusEl.classList.contains('ocupado')) {
      msg.className = 'msg msg-erro'; msg.textContent = 'Esse link já está em uso nessa cidade — muda o nome ou o link.'; return false;
    }
    return true;
  }

  var CIDADES_DISPONIVEIS = ['Itapetininga', 'Tatuí', 'Boituva', 'Itu', 'Sorocaba'];
  function renderPassoCidade(container) {
    var atual = estado.cidade || 'Itapetininga';
    container.innerHTML = '<div class="field"><label for="criarCidade">Em qual cidade fica?</label>' +
      '<select id="criarCidade">' +
      CIDADES_DISPONIVEIS.map(function (c) {
        return '<option value="' + escapeHtml(c) + '"' + (c.toLowerCase() === atual.toLowerCase() ? ' selected' : '') + '>' + escapeHtml(c) + '</option>';
      }).join('') +
      '</select></div>';
    estado.cidade = document.getElementById('criarCidade').value;
    postEstado();
    document.getElementById('criarCidade').addEventListener('change', function () {
      estado.cidade = this.value;
      postEstado();
    });
  }
  function validarCidade() {
    var msg = document.getElementById('criarMsg');
    if (!estado.cidade.trim()) { msg.className = 'msg msg-erro'; msg.textContent = 'Digite a cidade.'; return false; }
    return true;
  }

  function renderPassoWhatsapp(container) {
    container.innerHTML = '<div class="field"><label for="criarWhatsapp">WhatsApp pra receber os agendamentos (com DDD)</label><input type="tel" id="criarWhatsapp" placeholder="15999999999" value="' + escapeHtml(estado.telefone_whatsapp) + '"></div>';
    document.getElementById('criarWhatsapp').addEventListener('input', function () {
      estado.telefone_whatsapp = this.value;
    });
  }
  function aoAvancarFinal() {
    var msg = document.getElementById('criarMsg');
    msg.className = 'msg';
    msg.textContent = 'Salvando…';
    if (!estabId) {
      return db.rpc('criar_estabelecimento', {
        p_nome: estado.nome.trim(),
        p_slug: estado.slug.trim(),
        p_cidade: estado.cidade.trim(),
        p_segmento: estado.segmento,
        p_telefone_whatsapp: estado.telefone_whatsapp.trim() || null,
        p_template: estado.template,
        p_genero_atendimento: estado.genero_atendimento
      }).then(function (res) {
        if (res.error) {
          var texto = res.error.message.indexOf('duplicate') > -1 || res.error.message.indexOf('unique') > -1
            ? 'Já existe um estabelecimento com esse link nessa cidade — muda o nome ou o link.'
            : res.error.message;
          throw new Error(texto);
        }
        estabId = res.data.id;
        msg.textContent = '';
      });
    }
    return db.rpc('tenant_admin_atualizar_identidade', {
      p_estabelecimento_id: estabId,
      p_nome: estado.nome.trim(),
      p_slug: estado.slug.trim(),
      p_cidade: estado.cidade.trim(),
      p_segmento: estado.segmento,
      p_telefone_whatsapp: estado.telefone_whatsapp.trim() || null
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      msg.textContent = '';
    });
  }

  // ---- engine dos passos ----
  // Só o essencial pra nascer o site (template, nicho, atendimento e
  // identidade) acontece aqui — o resto (fotos, cores, serviços, equipe,
  // redes) agora é preenchido ao vivo, direto no site real, no tutorial
  // guiado que começa assim que o site é criado (ver perfil.js, modo
  // ?tutorial=1). A lista é montada de novo a cada navegação porque o
  // nicho escolhido decide se a pergunta de atendimento aparece ou não
  // (funil: só pergunta o que faz sentido pro negócio escolhido).
  function obterPassos() {
    var passos = [
      { chave: 'template', titulo: 'Estilo do site', render: renderPassoTemplate },
      { chave: 'segmento', titulo: 'Tipo de negócio', render: renderPassoSegmento }
    ];
    if (estado.segmento !== 'estetica_automotiva') {
      passos.push({ chave: 'atendimento', titulo: 'Atendimento', render: renderPassoAtendimento });
    }
    passos.push(
      { chave: 'nome', titulo: 'Nome do site', render: renderPassoNome, validar: validarNome },
      { chave: 'cidade', titulo: 'Cidade', render: renderPassoCidade, validar: validarCidade },
      { chave: 'whatsapp', titulo: 'WhatsApp', render: renderPassoWhatsapp, aoAvancar: aoAvancarFinal }
    );
    return passos;
  }
  var passoAtual = 0;

  function mostrarPasso(indice) {
    passoAtual = indice;
    var passos = obterPassos();
    var passo = passos[indice];
    document.getElementById('criarTituloPasso').textContent = passo.titulo;
    document.getElementById('criarPassoLabel').textContent = 'Passo ' + (indice + 1) + ' de ' + passos.length + ': ' + passo.titulo;
    document.getElementById('criarProgressoFill').style.width = (((indice + 1) / passos.length) * 100) + '%';
    document.getElementById('criarVoltarBtn').style.visibility = indice === 0 ? 'hidden' : 'visible';
    document.getElementById('criarProximoBtn').textContent = indice === passos.length - 1 ? 'Ir para o meu site ✓' : 'Próximo →';
    var msg = document.getElementById('criarMsg');
    msg.textContent = '';
    msg.className = 'msg';
    var container = document.getElementById('criarStepContainer');
    container.classList.remove('criar-step-anim');
    void container.offsetWidth; // força reflow pra reanimar mesmo repetindo a classe
    container.innerHTML = '';
    passo.render(container);
    container.classList.add('criar-step-anim');
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
      if (passoAtual === passos.length - 1) {
        // "tutorial=1" continua a MESMA criação do site no site real (não é
        // um tutorial à parte) — "desde" avisa quantos passos já foram
        // dados aqui, pra numeração continuar contando (Passo 7, 8, 9...)
        // em vez de reiniciar do 1.
        window.location.href = '/' + encodeURIComponent(estado.slug) + '/' + encodeURIComponent(estado.cidade.trim().toLowerCase()) + '?tutorial=1&desde=' + passos.length;
        return;
      }
      mostrarPasso(passoAtual + 1);
    }
    function falhou(err) {
      btn.disabled = false;
      var msg = document.getElementById('criarMsg');
      msg.className = 'msg msg-erro';
      msg.textContent = (err && err.message) || 'Algo deu errado — tenta de novo.';
    }
    if (passo.aoAvancar) {
      passo.aoAvancar().then(prosseguir, falhou);
    } else {
      prosseguir();
    }
  });
  document.getElementById('criarVoltarBtn').addEventListener('click', function () {
    if (passoAtual === 0) return;
    mostrarPasso(passoAtual - 1);
  });

  mostrarPasso(0);
  }
})();
