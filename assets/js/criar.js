/* Passo a passo de criação de site — substitui o formulário único de
   antes. Cada passo pergunta uma coisa, atualiza a pré-visualização ao
   vivo (iframe rodando preview-embutido.html) e salva no backend assim
   que dá pra salvar (o estabelecimento nasce de verdade já no passo
   "Nome e dados básicos", os passos seguintes só completam ele). */
(function () {
  if (!window.db) return;

  var params = new URLSearchParams(window.location.search);

  var SEGMENTOS_LABEL = {
    barbearia: 'Barbearia',
    salao: 'Salão de beleza',
    manicure_pedicure: 'Manicure e pedicure',
    estetica: 'Estética',
    estetica_automotiva: 'Estética automotiva',
    outro: 'Estabelecimento'
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

  var estado = {
    template: params.get('template') || 'classico-boiserie',
    genero_atendimento: 'ambos',
    nome: '', slug: '', cidade: 'Itapetininga', segmento: 'barbearia', telefone_whatsapp: '',
    foto_perfil_url: null,
    foto_hero_url: null, foto_hero_feminino_url: null,
    cor_destaque: '#C9A227',
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
  var TEMPLATES_DISPONIVEIS = [
    { chave: 'classico-boiserie', nome: 'Clássico', preview: 'linear-gradient(135deg,#FAF7F1,#C9A227)' },
    { chave: 'claro-minimal', nome: 'Claro', preview: 'linear-gradient(135deg,#FFFFFF,#1F8A6E)' },
    { chave: 'escuro-premium', nome: 'Escuro', preview: 'linear-gradient(135deg,#121212,#D9AE55)' },
    { chave: 'automotivo-carbono', nome: 'Automotivo', preview: 'linear-gradient(135deg,#15161A,#D8342A)' }
  ];
  function renderPassoTemplate(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Escolha o estilo visual do seu site. Você acompanha o resultado ao lado, e dá pra trocar depois.</p>' +
      '<div id="criarTemplateEscolha" class="criar-template-grid"></div>';
    function desenhar() {
      document.getElementById('criarTemplateEscolha').innerHTML = TEMPLATES_DISPONIVEIS.map(function (t) {
        return '<button type="button" class="tpl-swatch-card' + (t.chave === estado.template ? ' is-selecionado' : '') + '" data-template="' + t.chave + '">' +
          '<div class="tpl-swatch-preview" style="background:' + t.preview + ';"></div>' +
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
      '<div class="prefixo"><span>vbagenda.com.br/</span><input type="text" id="criarSlug" value="' + escapeHtml(estado.slug) + '"></div></div>' +
      '<div class="field"><label for="criarCidade">Cidade</label><input type="text" id="criarCidade" value="' + escapeHtml(estado.cidade) + '"></div>' +
      '<div class="field"><label for="criarSegmento">Segmento</label><select id="criarSegmento">' +
      Object.keys(SEGMENTOS_LABEL).map(function (k) {
        return '<option value="' + k + '"' + (k === estado.segmento ? ' selected' : '') + '>' + SEGMENTOS_LABEL[k] + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="field"><label for="criarWhatsapp">WhatsApp (com DDD)</label><input type="tel" id="criarWhatsapp" placeholder="15999999999" value="' + escapeHtml(estado.telefone_whatsapp) + '"></div>';

    var slugTocadoManualmente = !!estado.slug;
    document.getElementById('criarNome').addEventListener('input', function () {
      estado.nome = this.value;
      if (!slugTocadoManualmente) {
        estado.slug = slugificar(this.value);
        document.getElementById('criarSlug').value = estado.slug;
      }
      postEstado();
    });
    document.getElementById('criarSlug').addEventListener('input', function () {
      slugTocadoManualmente = true;
      estado.slug = this.value;
    });
    document.getElementById('criarCidade').addEventListener('input', function () {
      estado.cidade = this.value;
      postEstado();
    });
    document.getElementById('criarSegmento').addEventListener('change', function () {
      estado.segmento = this.value;
      postEstado();
    });
    document.getElementById('criarWhatsapp').addEventListener('input', function () {
      estado.telefone_whatsapp = this.value;
    });
  }
  function validarIdentidade() {
    var msg = document.getElementById('criarMsg');
    if (!estado.nome.trim()) { msg.className = 'msg msg-erro'; msg.textContent = 'Digite o nome do estabelecimento.'; return false; }
    if (!estado.slug.trim()) { msg.className = 'msg msg-erro'; msg.textContent = 'O link não pode ficar vazio.'; return false; }
    if (!estado.cidade.trim()) { msg.className = 'msg msg-erro'; msg.textContent = 'Digite a cidade.'; return false; }
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

  // ---- passo 4: logotipo (foto de perfil do card) ----
  var PERSONAGENS_CORES = ['#C9A227', '#B5638C', '#4A90A4', '#D8342A', '#1F8A6E', '#6b5f4f'];
  function personagemPlaceholder(cor) {
    var c = cor.replace('#', '');
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Ccircle cx='60' cy='60' r='60' fill='%23" + c + "'/%3E%3Ccircle cx='60' cy='46' r='20' fill='white' fill-opacity='0.9'/%3E%3Cpath d='M20 110c6-28 26-42 40-42s34 14 40 42' fill='white' fill-opacity='0.9'/%3E%3C/svg%3E";
  }
  function renderPassoLogotipo(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Tem uma foto de perfil ou logotipo? Envie aqui. Se não tiver, escolha um dos personagens abaixo — dá pra trocar depois.</p>' +
      '<div id="criarLogoPreview" class="criar-logo-preview"></div>' +
      '<div class="field"><input type="file" id="criarLogoUpload" accept="image/*"></div>' +
      '<p class="cidade" style="margin:0.8rem 0 0.5rem;">ou escolha um personagem:</p>' +
      '<div id="criarPersonagens" class="criar-personagens"></div>';
    function desenharPreview() {
      document.getElementById('criarLogoPreview').style.backgroundImage = estado.foto_perfil_url ? "url('" + estado.foto_perfil_url + "')" : 'none';
    }
    desenharPreview();
    document.getElementById('criarPersonagens').innerHTML = PERSONAGENS_CORES.map(function (c) {
      return '<img src="' + personagemPlaceholder(c) + '" data-personagem="' + c + '" alt="Personagem" style="width:52px; height:52px; border-radius:50%; cursor:pointer; border:2px solid transparent;">';
    }).join('');
    document.getElementById('criarPersonagens').addEventListener('click', function (e) {
      var img = e.target.closest('[data-personagem]');
      if (!img) return;
      estado.foto_perfil_url = img.src;
      desenharPreview();
    });
    document.getElementById('criarLogoUpload').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file || !window.VBUpload) return;
      var msg = document.getElementById('criarMsg');
      msg.className = 'msg';
      msg.textContent = 'Enviando foto…';
      window.VBUpload.uploadFoto(file, estabId || pastaTemp, 'perfil').then(function (url) {
        estado.foto_perfil_url = url;
        desenharPreview();
        msg.textContent = '';
      }, function (err) {
        msg.className = 'msg msg-erro';
        msg.textContent = err.message || 'Falha ao enviar a foto.';
      });
    });
  }
  function aoAvancarLogotipo() {
    if (!estado.foto_perfil_url) return Promise.resolve();
    return db.rpc('tenant_admin_atualizar_perfil_capa', {
      p_estabelecimento_id: estabId,
      p_foto_perfil_url: estado.foto_perfil_url,
      p_foto_capa_url: null
    }).then(function (res) { if (res.error) throw new Error(res.error.message); });
  }

  // ---- passo 5: foto de fundo (hero) ----
  var ESTOQUE_FOTOS = [
    { url: '/assets/tpl-classico/img/estoque/hero-masculino-1.jpg', legenda: 'Studio dourado' },
    { url: '/assets/tpl-classico/img/estoque/hero-feminino-1.jpg', legenda: 'Salão rosé' },
    { url: '/assets/tpl-classico/img/estoque/fachada-1.jpg', legenda: 'Fachada clássica' }
  ];
  function renderPassoCapa(container) {
    var mostrarFeminino = estado.genero_atendimento === 'ambos';
    container.innerHTML =
      '<p class="criar-passo-intro">Essa foto aparece de fundo na entrada do seu site.</p>' +
      '<div id="criarCapaPreview" class="criar-capa-preview"></div>' +
      '<div class="field"><input type="file" id="criarCapaUpload" accept="image/*"></div>' +
      '<p class="cidade" style="margin:0.8rem 0 0.5rem;">ou escolha uma pronta:</p>' +
      '<div id="criarCapaEstoque" class="criar-capa-estoque"></div>' +
      (mostrarFeminino ? '<div class="field" style="margin-top:1rem;"><label>Foto pro lado feminino (opcional)</label><input type="file" id="criarCapaFemUpload" accept="image/*"></div>' : '');
    function desenhar() {
      document.getElementById('criarCapaPreview').style.backgroundImage = estado.foto_hero_url ? "url('" + estado.foto_hero_url + "')" : 'none';
    }
    desenhar();
    document.getElementById('criarCapaEstoque').innerHTML = ESTOQUE_FOTOS.map(function (f) {
      return '<img src="' + f.url + '" data-estoque-url="' + f.url + '" title="' + f.legenda + '" alt="' + f.legenda + '" style="width:72px; height:72px; object-fit:cover; border-radius:8px; cursor:pointer; border:2px solid transparent;">';
    }).join('');
    document.getElementById('criarCapaEstoque').addEventListener('click', function (e) {
      var img = e.target.closest('[data-estoque-url]');
      if (!img) return;
      estado.foto_hero_url = img.getAttribute('data-estoque-url');
      desenhar();
      postEstado();
    });
    document.getElementById('criarCapaUpload').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file || !window.VBUpload) return;
      var msg = document.getElementById('criarMsg');
      msg.className = 'msg';
      msg.textContent = 'Enviando foto…';
      window.VBUpload.uploadFoto(file, estabId || pastaTemp, 'hero').then(function (url) {
        estado.foto_hero_url = url;
        desenhar();
        postEstado();
        msg.textContent = '';
      }, function (err) {
        msg.className = 'msg msg-erro';
        msg.textContent = err.message || 'Falha ao enviar a foto.';
      });
    });
    if (mostrarFeminino) {
      document.getElementById('criarCapaFemUpload').addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file || !window.VBUpload) return;
        window.VBUpload.uploadFoto(file, estabId || pastaTemp, 'hero-feminino').then(function (url) {
          estado.foto_hero_feminino_url = url;
          postEstado();
        });
      });
    }
  }
  function aoAvancarCapa() {
    if (!estado.foto_hero_url && !estado.foto_hero_feminino_url) return Promise.resolve();
    return db.rpc('tenant_admin_atualizar_hero', {
      p_estabelecimento_id: estabId,
      p_foto_hero_url: estado.foto_hero_url,
      p_foto_hero_feminino_url: estado.foto_hero_feminino_url
    }).then(function (res) { if (res.error) throw new Error(res.error.message); });
  }

  // ---- passo 6: paleta de cores ----
  var CORES_SUGESTOES = ['#C9A227', '#1F8A6E', '#D9AE55', '#D8342A', '#B5638C', '#4A90A4'];
  function renderPassoCor(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Escolha a cor de destaque do seu site — usada em botões, bordas e detalhes.</p>' +
      '<input type="color" id="criarCorInput" value="' + estado.cor_destaque + '" class="criar-cor-input">' +
      '<div id="criarCorSugestoes" class="criar-cor-sugestoes"></div>';
    document.getElementById('criarCorSugestoes').innerHTML = CORES_SUGESTOES.map(function (c) {
      return '<button type="button" class="criar-cor-swatch" data-cor="' + c + '" style="background:' + c + ';" aria-label="Usar essa cor"></button>';
    }).join('');
    document.getElementById('criarCorInput').addEventListener('input', function () {
      estado.cor_destaque = this.value;
      postEstado();
    });
    document.getElementById('criarCorSugestoes').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cor]');
      if (!btn) return;
      estado.cor_destaque = btn.getAttribute('data-cor');
      document.getElementById('criarCorInput').value = estado.cor_destaque;
      postEstado();
    });
  }
  function aoAvancarCor() {
    return db.rpc('tenant_admin_atualizar_cor', {
      p_estabelecimento_id: estabId,
      p_cor_destaque: estado.cor_destaque
    }).then(function (res) { if (res.error) throw new Error(res.error.message); });
  }

  // ---- passo 7: serviços e valores ----
  var SEGMENTO_CATEGORIA_LABEL = { masculino: 'Masculino', feminino: 'Feminino', unissex: 'Unissex' };
  function renderPassoServicos(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Cadastre pelo menos um serviço com o preço — sem isso o site não fica visível pros clientes.</p>' +
      '<ul class="lista-estabelecimentos" id="criarListaServicos" style="margin-bottom:1rem;"></ul>' +
      '<form id="criarFormServico" style="display:grid; gap:0.75rem; grid-template-columns:2fr 1fr; align-items:end;">' +
      '<div class="field" style="margin:0;"><label>Nome do serviço</label><input type="text" id="criarServNome" required placeholder="Ex: Corte masculino"></div>' +
      '<div class="field" style="margin:0;"><label>Preço (R$)</label><input type="number" id="criarServPreco" required min="0" step="0.01" placeholder="45"></div>' +
      '<div class="field" style="margin:0; grid-column:1/2;"><label>Categoria</label><select id="criarServCategoria"><option value="unissex">Unissex</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></div>' +
      '<button class="btn btn-primario" type="submit" style="grid-column:2/3;">Adicionar</button>' +
      '</form>';

    function carregarListaServicos() {
      var lista = document.getElementById('criarListaServicos');
      lista.innerHTML = '<li><span class="skeleton" style="width:60%;"></span></li>';
      db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
        var linhas = res.data || [];
        estado.total_servicos = linhas.length;
        if (!linhas.length) { lista.innerHTML = '<li style="border:none;">Nenhum serviço ainda.</li>'; return; }
        lista.innerHTML = linhas.map(function (s) {
          return '<li><span><span class="nome">' + escapeHtml(s.nome) + '</span><br>' +
            '<span class="cidade">' + formatarPreco(s.preco) + ' · ' + SEGMENTO_CATEGORIA_LABEL[s.categoria] + '</span></span>' +
            '<button class="btn btn-ghost" type="button" style="padding:0.4rem 0.7rem; font-size:0.8rem;" data-remover-servico="' + s.id + '">Remover</button></li>';
        }).join('');
      });
    }
    document.getElementById('criarFormServico').addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('criarMsg');
      msg.className = 'msg';
      msg.textContent = 'Salvando…';
      db.rpc('tenant_admin_salvar_servico', {
        p_estabelecimento_id: estabId, p_id: null,
        p_nome: document.getElementById('criarServNome').value.trim(),
        p_preco: parseFloat(document.getElementById('criarServPreco').value) || 0,
        p_categoria: document.getElementById('criarServCategoria').value
      }).then(function (res) {
        if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
        msg.textContent = '';
        document.getElementById('criarFormServico').reset();
        carregarListaServicos();
      }, function () { msg.className = 'msg msg-erro'; msg.textContent = 'Sem conexão agora.'; });
    });
    document.getElementById('criarListaServicos').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remover-servico]');
      if (!btn) return;
      db.rpc('tenant_admin_remover_servico', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-servico') }).then(carregarListaServicos);
    });
    carregarListaServicos();
  }
  function validarServicos() {
    if (!estado.total_servicos) {
      var msg = document.getElementById('criarMsg');
      msg.className = 'msg msg-erro';
      msg.textContent = 'Cadastre pelo menos um serviço antes de continuar.';
      return false;
    }
    return true;
  }

  // ---- passo 8: equipe ----
  function renderPassoEquipe(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Quem vai atender? Cadastre pelo menos uma pessoa — sem isso o site não fica visível pros clientes.</p>' +
      '<ul class="lista-estabelecimentos" id="criarListaEquipe" style="margin-bottom:1rem;"></ul>' +
      '<form id="criarFormEquipe" style="display:grid; gap:0.75rem; grid-template-columns:1fr 1fr; align-items:end;">' +
      '<div class="field" style="margin:0;"><label>Nome</label><input type="text" id="criarEqNome" required placeholder="Ex: Rafael"></div>' +
      '<div class="field" style="margin:0;"><label>Especialidade</label><input type="text" id="criarEqEspecialidade" placeholder="Ex: Cortes e barba"></div>' +
      '<div class="field" style="margin:0; grid-column:1/3;"><label>Foto (opcional)</label><input type="file" id="criarEqFoto" accept="image/*"></div>' +
      '<button class="btn btn-primario" type="submit" style="grid-column:1/3;">Adicionar à equipe</button>' +
      '</form>';

    function carregarListaEquipe() {
      var lista = document.getElementById('criarListaEquipe');
      lista.innerHTML = '<li><span class="skeleton" style="width:60%;"></span></li>';
      db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId }).then(function (res) {
        var linhas = res.data || [];
        estado.total_equipe = linhas.length;
        if (!linhas.length) { lista.innerHTML = '<li style="border:none;">Nenhum membro cadastrado ainda.</li>'; return; }
        lista.innerHTML = linhas.map(function (p) {
          return '<li><span><span class="nome">' + escapeHtml(p.nome) + '</span><br>' +
            '<span class="cidade">' + escapeHtml(p.especialidade || '—') + '</span></span>' +
            '<button class="btn btn-ghost" type="button" style="padding:0.4rem 0.7rem; font-size:0.8rem;" data-remover-membro="' + p.id + '">Remover</button></li>';
        }).join('');
      });
    }
    document.getElementById('criarFormEquipe').addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('criarMsg');
      msg.className = 'msg';
      msg.textContent = 'Salvando…';
      var arquivo = document.getElementById('criarEqFoto').files[0];
      var comFoto = (arquivo && window.VBUpload) ? window.VBUpload.uploadFoto(arquivo, estabId, 'equipe') : Promise.resolve(null);
      comFoto.then(function (fotoUrl) {
        return db.rpc('tenant_admin_salvar_membro', {
          p_estabelecimento_id: estabId, p_id: null,
          p_nome: document.getElementById('criarEqNome').value.trim(),
          p_especialidade: document.getElementById('criarEqEspecialidade').value.trim() || null,
          p_foto_url: fotoUrl
        });
      }).then(function (res) {
        if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
        msg.textContent = '';
        document.getElementById('criarFormEquipe').reset();
        carregarListaEquipe();
      }, function (err) { msg.className = 'msg msg-erro'; msg.textContent = (err && err.message) || 'Sem conexão agora.'; });
    });
    document.getElementById('criarListaEquipe').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remover-membro]');
      if (!btn) return;
      db.rpc('tenant_admin_remover_membro', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-membro') }).then(carregarListaEquipe);
    });
    carregarListaEquipe();
  }
  function validarEquipe() {
    if (!estado.total_equipe) {
      var msg = document.getElementById('criarMsg');
      msg.className = 'msg msg-erro';
      msg.textContent = 'Cadastre pelo menos uma pessoa na equipe antes de continuar.';
      return false;
    }
    return true;
  }

  // ---- passo 9: horário de funcionamento ----
  var DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  function carregarHorariosWizard() {
    var wrap = document.getElementById('criarListaHorarios');
    wrap.innerHTML = '<div class="skeleton" style="height:2rem;"></div>';
    db.rpc('tenant_listar_horarios', { p_estabelecimento_id: estabId }).then(function (res) {
      var porDia = {};
      (res.data || []).forEach(function (h) { porDia[h.dia_semana] = h; });
      wrap.innerHTML = DIAS.map(function (nomeDia, i) {
        var h = porDia[i] || { abre: '08:00', fecha: '18:00', fechado: i === 0 };
        return '<div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;" data-linha-horario="' + i + '">' +
          '<span style="width:90px; font-weight:600; font-size:0.9rem;">' + nomeDia + '</span>' +
          '<input type="time" class="field-abre" value="' + String(h.abre).slice(0, 5) + '" style="padding:0.4rem; border:1px solid var(--borda); border-radius:8px;">' +
          '<span style="color:var(--tinta-suave);">às</span>' +
          '<input type="time" class="field-fecha" value="' + String(h.fecha).slice(0, 5) + '" style="padding:0.4rem; border:1px solid var(--borda); border-radius:8px;">' +
          '<label style="display:flex; align-items:center; gap:0.3rem; font-size:0.85rem;"><input type="checkbox" class="field-fechado"' + (h.fechado ? ' checked' : '') + '> Fechado</label>' +
          '<button class="btn btn-ghost" type="button" style="padding:0.35rem 0.7rem; font-size:0.78rem;" data-salvar-horario="' + i + '">Salvar</button>' +
          '</div>';
      }).join('');
    }, function () { wrap.innerHTML = 'Sem conexão agora.'; });
  }
  function renderPassoHorarios(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Defina o horário de funcionamento — os horários já vêm com um padrão (8h às 18h, fechado domingo), então pode só continuar se estiver bom.</p>' +
      '<div id="criarListaHorarios" style="display:flex; flex-direction:column; gap:0.6rem;"></div>';
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-salvar-horario]');
      if (!btn) return;
      var linha = btn.closest('[data-linha-horario]');
      var msg = document.getElementById('criarMsg');
      db.rpc('tenant_admin_salvar_horario', {
        p_estabelecimento_id: estabId,
        p_dia_semana: parseInt(btn.getAttribute('data-salvar-horario'), 10),
        p_abre: linha.querySelector('.field-abre').value || '08:00',
        p_fecha: linha.querySelector('.field-fecha').value || '18:00',
        p_fechado: linha.querySelector('.field-fechado').checked
      }).then(function (res) {
        msg.className = res.error ? 'msg msg-erro' : 'msg msg-ok';
        msg.textContent = res.error ? res.error.message : 'Horário salvo!';
      }, function () { msg.className = 'msg msg-erro'; msg.textContent = 'Sem conexão agora.'; });
    });
    carregarHorariosWizard();
  }

  // ---- passo 10: redes sociais ----
  function renderPassoRedes(container) {
    container.innerHTML =
      '<p class="criar-passo-intro">Redes sociais (opcional) — pode preencher depois também.</p>' +
      '<div class="field"><label for="criarInstagram">Instagram</label><input type="url" id="criarInstagram" placeholder="https://instagram.com/..." value="' + escapeHtml(estado.instagram_url) + '"></div>' +
      '<div class="field"><label for="criarFacebook">Facebook</label><input type="url" id="criarFacebook" placeholder="https://facebook.com/..." value="' + escapeHtml(estado.facebook_url) + '"></div>' +
      '<div class="field"><label for="criarTiktok">TikTok</label><input type="url" id="criarTiktok" placeholder="https://tiktok.com/@..." value="' + escapeHtml(estado.tiktok_url) + '"></div>';
    document.getElementById('criarInstagram').addEventListener('input', function () { estado.instagram_url = this.value; });
    document.getElementById('criarFacebook').addEventListener('input', function () { estado.facebook_url = this.value; });
    document.getElementById('criarTiktok').addEventListener('input', function () { estado.tiktok_url = this.value; });
  }
  function aoAvancarRedes() {
    return db.rpc('tenant_admin_atualizar_redes', {
      p_estabelecimento_id: estabId,
      p_instagram_url: estado.instagram_url.trim() || null,
      p_facebook_url: estado.facebook_url.trim() || null,
      p_tiktok_url: estado.tiktok_url.trim() || null
    }).then(function (res) { if (res.error) throw new Error(res.error.message); });
  }

  // ---- passo 11: revisão final ----
  function renderPassoRevisao(container) {
    var link = '/' + encodeURIComponent(estado.slug) + '/' + encodeURIComponent(estado.cidade.trim().toLowerCase());
    container.innerHTML =
      '<p class="criar-passo-intro">Tudo pronto! Confira o resumo antes de publicar.</p>' +
      '<ul class="lista-estabelecimentos">' +
      '<li><span class="nome">Nome</span><span class="cidade">' + escapeHtml(estado.nome) + '</span></li>' +
      '<li><span class="nome">Endereço do site</span><span class="cidade">vbagenda.com.br' + escapeHtml(link) + '</span></li>' +
      '<li><span class="nome">PIN de admin</span><span class="cidade"><strong>' + escapeHtml(adminPin || '----') + '</strong> — guarde bem, é ele que abre a edição no site (menu ☰ → Admin)</span></li>' +
      '</ul>' +
      '<p class="msg msg-ok" style="margin-top:1rem;">Seu site já está no ar! Você pode continuar editando tudo direto nele quando quiser.</p>';
  }

  // ---- engine dos passos ----
  var PASSOS = [
    { chave: 'template', titulo: 'Estilo do site', render: renderPassoTemplate },
    { chave: 'atendimento', titulo: 'Atendimento', render: renderPassoAtendimento },
    { chave: 'identidade', titulo: 'Nome e dados básicos', render: renderPassoIdentidade, validar: validarIdentidade, aoAvancar: aoAvancarIdentidade },
    { chave: 'logotipo', titulo: 'Logotipo', render: renderPassoLogotipo, aoAvancar: aoAvancarLogotipo },
    { chave: 'capa', titulo: 'Foto de fundo', render: renderPassoCapa, aoAvancar: aoAvancarCapa },
    { chave: 'cor', titulo: 'Paleta de cores', render: renderPassoCor, aoAvancar: aoAvancarCor },
    { chave: 'servicos', titulo: 'Serviços e valores', render: renderPassoServicos, validar: validarServicos },
    { chave: 'equipe', titulo: 'Equipe', render: renderPassoEquipe, validar: validarEquipe },
    { chave: 'horarios', titulo: 'Horário de funcionamento', render: renderPassoHorarios },
    { chave: 'redes', titulo: 'Redes sociais', render: renderPassoRedes, aoAvancar: aoAvancarRedes },
    { chave: 'revisao', titulo: 'Revisão final', render: renderPassoRevisao }
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
    container.innerHTML = '';
    passo.render(container);
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
        window.location.href = '/' + encodeURIComponent(estado.slug) + '/' + encodeURIComponent(estado.cidade.trim().toLowerCase());
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
})();
