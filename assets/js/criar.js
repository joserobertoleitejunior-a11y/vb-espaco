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
  db.auth.getSession().then(function (res) {
    if (!res.data || !res.data.session) {
      window.location.href = 'cadastro.html';
      return;
    }
    iniciarPassoAPasso();
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
  var SEGMENTOS_ICONE = {
    barbearia: '💈',
    salao: '💇',
    manicure_pedicure: '💅',
    estetica: '✨',
    estetica_automotiva: '🚗',
    outro: '🏢'
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
    cor_destaque: '#C9A227', cor_secundaria: null,
    texto_cta: 'Agendar horário',
    instagram_url: '', facebook_url: '', tiktok_url: '',
    total_servicos: 0, total_equipe: 0
  };
  var estabId = null;
  var adminPin = null;
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

  document.getElementById('criarPreviewToggle').addEventListener('click', function () {
    document.getElementById('criarPreviewArea').classList.toggle('aberta');
  });

  // ---- passo 1: template ----
  // mini-mockup de cada template com as cores/raio reais dele (nada de
  // caixinha lisa com gradiente — o dono precisa reconhecer o site aqui)
  var TEMPLATES_DISPONIVEIS = [
    { chave: 'classico-boiserie', nome: 'Clássico', bg: '#FAF7F1', texto: '#0A0A0A', accent: '#C9A227', radius: '14px', escuro: false },
    { chave: 'claro-minimal', nome: 'Claro', bg: '#FFFFFF', texto: '#16181B', accent: '#1F8A6E', radius: '18px', escuro: false },
    { chave: 'escuro-premium', nome: 'Escuro', bg: '#121212', texto: '#F3EEDF', accent: '#D9AE55', radius: '14px', escuro: true },
    { chave: 'automotivo-carbono', nome: 'Automotivo', bg: '#15161A', texto: '#F2F2F0', accent: '#D8342A', radius: '6px', escuro: true }
  ];
  function renderPassoTemplate(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Escolha o estilo visual do seu site. Você acompanha o resultado ao lado, e dá pra trocar depois.</p>' +
      '<div id="criarTemplateEscolha" class="criar-template-grid"></div>';
    function desenhar() {
      document.getElementById('criarTemplateEscolha').innerHTML = TEMPLATES_DISPONIVEIS.map(function (t) {
        return '<button type="button" class="tpl-swatch-card' + (t.chave === estado.template ? ' is-selecionado' : '') + '" data-template="' + t.chave + '" style="background:' + t.bg + '; border-radius:' + t.radius + ';">' +
          '<span class="tpl-mock">' +
          '<span class="tpl-mock-topo" style="border-color:' + (t.escuro ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.1)') + ';">' +
          '<span class="tpl-mock-bolinha" style="background:' + t.accent + ';"></span>' +
          '<span class="tpl-mock-linha" style="background:' + t.texto + ';"></span>' +
          '</span>' +
          '<span class="tpl-mock-hero" style="border-color:' + t.accent + '; box-shadow:0 0 12px ' + t.accent + '55; background:' + (t.escuro ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') + '; border-radius:' + t.radius + ';"></span>' +
          '<span class="tpl-mock-titulo" style="background:' + t.texto + ';"></span>' +
          '<span class="tpl-mock-sub" style="background:' + t.texto + ';"></span>' +
          '<span class="tpl-mock-btn" style="background:' + t.accent + '; border-radius:' + t.radius + ';"></span>' +
          '</span>' +
          '<span class="tpl-swatch-nome" style="color:' + t.texto + ';">' + t.nome + '</span>' +
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

  // ---- passo 3: identidade (nome, link, cidade, segmento, whatsapp) ----
  function renderPassoIdentidade(container) {
    container.innerHTML =
      '<div class="field"><label for="criarNome">Nome do estabelecimento</label>' +
      '<input type="text" id="criarNome" placeholder="Ex: Rafael Cabeleireiros" value="' + escapeHtml(estado.nome) + '"></div>' +
      '<div class="field"><label for="criarSlug">Link (gerado a partir do nome, pode editar)</label>' +
      '<div class="prefixo"><span>vbagenda.com.br/</span><input type="text" id="criarSlug" value="' + escapeHtml(estado.slug) + '"></div>' +
      '<span class="criar-slug-status" id="criarSlugStatus"></span></div>' +
      '<div class="field"><label for="criarCidade">Cidade</label><input type="text" id="criarCidade" value="' + escapeHtml(estado.cidade) + '"></div>' +
      '<div class="field"><label for="criarWhatsapp">WhatsApp (com DDD)</label><input type="tel" id="criarWhatsapp" placeholder="15999999999" value="' + escapeHtml(estado.telefone_whatsapp) + '"></div>';

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
    document.getElementById('criarCidade').addEventListener('input', function () {
      estado.cidade = this.value;
      checarSlugDisponivel();
      postEstado();
    });
    document.getElementById('criarWhatsapp').addEventListener('input', function () {
      estado.telefone_whatsapp = this.value;
    });
    checarSlugDisponivel();
  }
  function validarIdentidade() {
    var msg = document.getElementById('criarMsg');
    if (!estado.nome.trim()) { msg.className = 'msg msg-erro'; msg.textContent = 'Digite o nome do estabelecimento.'; return false; }
    if (!estado.slug.trim()) { msg.className = 'msg msg-erro'; msg.textContent = 'O link não pode ficar vazio.'; return false; }
    if (!estado.cidade.trim()) { msg.className = 'msg msg-erro'; msg.textContent = 'Digite a cidade.'; return false; }
    var slugStatusEl = document.getElementById('criarSlugStatus');
    if (slugStatusEl && slugStatusEl.classList.contains('ocupado')) {
      msg.className = 'msg msg-erro'; msg.textContent = 'Esse link já está em uso nessa cidade — muda o nome ou o link.'; return false;
    }
    return true;
  }
  function aoAvancarIdentidade() {
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
        adminPin = res.data.admin_pin;
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
  // Só o essencial pra nascer o site (template, atendimento e identidade)
  // acontece aqui — o resto (fotos, cores, serviços, equipe, redes) agora
  // é preenchido ao vivo, direto no site real, no tutorial guiado que
  // começa assim que o site é criado (ver perfil.js, modo ?tutorial=1).
  var PASSOS = [
    { chave: 'template', titulo: 'Estilo do site', render: renderPassoTemplate },
    { chave: 'segmento', titulo: 'Tipo de negócio', render: renderPassoSegmento },
    { chave: 'atendimento', titulo: 'Atendimento', render: renderPassoAtendimento },
    { chave: 'identidade', titulo: 'Nome e contato', render: renderPassoIdentidade, validar: validarIdentidade, aoAvancar: aoAvancarIdentidade }
  ];
  var passoAtual = 0;

  function mostrarPasso(indice) {
    passoAtual = indice;
    var passo = PASSOS[indice];
    document.getElementById('criarTituloPasso').textContent = passo.titulo;
    document.getElementById('criarPassoLabel').textContent = 'Passo ' + (indice + 1) + ' de ' + PASSOS.length + ': ' + passo.titulo;
    document.getElementById('criarProgressoFill').style.width = (((indice + 1) / PASSOS.length) * 100) + '%';
    document.getElementById('criarVoltarBtn').style.visibility = indice === 0 ? 'hidden' : 'visible';
    document.getElementById('criarProximoBtn').textContent = indice === PASSOS.length - 1 ? 'Ir para o meu site ✓' : 'Próximo →';
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
    var passo = PASSOS[passoAtual];
    if (passo.validar && !passo.validar()) return;
    var btn = this;
    btn.disabled = true;
    function prosseguir() {
      btn.disabled = false;
      if (passoAtual === PASSOS.length - 1) {
        window.location.href = '/' + encodeURIComponent(estado.slug) + '/' + encodeURIComponent(estado.cidade.trim().toLowerCase()) + '?tutorial=1';
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
