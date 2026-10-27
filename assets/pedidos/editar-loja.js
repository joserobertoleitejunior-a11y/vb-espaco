/* Editar o site de Pedir/Chamar pelo passo a passo — o mesmo padrão da
   Agenda (perfil.js): o site fica ao vivo atrás e uma bolha embaixo leva
   etapa por etapa, com atalhos pra pular, Voltar, Próximo e Concluir.
   Abre com ?editar=1 (painel → "Editar meu site"); o dono visitando o
   próprio site sem esse parâmetro vê só a barrinha "Este site é seu".
   Visual da bolha: .vb-tutorial-* em styles.css. */
(function () {
  'use strict';
  var U = window.VB;
  var db = window.db;
  var api = null;
  var esc = function (t) { return U ? U.escapeHtml(t) : String(t || ''); };

  var CORES = ['#b23a28', '#9b2d20', '#d9822b', '#2f6a35', '#1f7a6d', '#23395b', '#5a1f66', '#6b4226', '#1d1c1a'];
  var DIAS = [1, 2, 3, 4, 5, 6, 0];
  var NOME_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var ICONE_CAMERA = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>';

  function estab() { return api.estab(); }
  function ident() { return api.ident(); }
  function $(id) { return document.getElementById(id); }

  /* ---------- salvar ---------- */
  function avisar(texto, erro) {
    var m = $('vbEdMsg');
    if (!m) return;
    m.className = 'msg ' + (erro ? 'msg-erro' : 'msg-ok');
    m.textContent = texto;
  }
  function rpc(nome, params) {
    return db.rpc(nome, params).then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function salvarLoja(campos) {
    avisar('Salvando…');
    return rpc('delivery_admin_atualizar_estabelecimento', { p_id: estab().id, p_campos: campos })
      .then(function () { return api.recarregar(); })
      .then(function () { avisar('Salvo ✓'); }, function (e) { avisar((e && e.message) || 'Não deu pra salvar.', true); });
  }
  function salvarIdent(nome, params) {
    avisar('Salvando…');
    params.p_estabelecimento_id = estab().id;
    return rpc(nome, params)
      .then(function () { return api.recarregar(); })
      .then(function () { avisar('Salvo ✓'); }, function (e) { avisar((e && e.message) || 'Não deu pra salvar.', true); });
  }
  function comprimir(arquivo, maxLado, quadrado) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
        if (quadrado) { var lado = Math.min(w, h); sx = (w - lado) / 2; sy = (h - lado) / 2; sw = sh = lado; w = h = lado; }
        var escala = Math.min(1, maxLado / Math.max(w, h));
        var cv = document.createElement('canvas');
        cv.width = Math.round(w * escala); cv.height = Math.round(h * escala);
        cv.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { if (b) resolve(b); else reject(new Error('Não consegui processar a imagem')); }, 'image/jpeg', 0.84);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Arquivo de imagem inválido')); };
      img.src = url;
    });
  }
  function enviarFoto(arquivo, tipo) {
    if (!/^image\//.test(arquivo.type)) return Promise.reject(new Error('Escolha um arquivo de imagem.'));
    return comprimir(arquivo, tipo === 'logo' ? 600 : 1600, tipo === 'logo').then(function (blob) {
      var f = new File([blob], tipo + '.jpg', { type: 'image/jpeg' });
      return window.VBUpload.uploadFoto(f, estab().id, tipo);
    });
  }

  /* ---------- etapas ---------- */
  function passoFoto(caixa) {
    var atual = ident().foto_hero_url || estab().foto_capa_url;
    var fotos = window.estoqueFotosPara ? window.estoqueFotosPara(estab().segmento) : [];
    caixa.innerHTML =
      '<label class="vb-btn-upload" style="width:100%; justify-content:center; margin-bottom:0.7rem; box-sizing:border-box;"><span class="vb-btn-upload-icone">' + ICONE_CAMERA + '</span> Escolher foto do celular<input type="file" id="vbEdFotoUp" accept="image/*"></label>' +
      '<p class="vb-ed-rotulo">ou toque numa foto pronta:</p>' +
      '<div class="vb-ed-grade">' + fotos.map(function (f) {
        return '<button type="button" class="vb-ed-foto' + (f.url === atual ? ' ativo' : '') + '" data-foto="' + esc(f.url) + '" title="' + esc(f.legenda) + '"><img src="' + esc(f.url) + '" alt="" loading="lazy"></button>';
      }).join('') + '</div>';
    function usar(url) {
      return salvarIdent('tenant_admin_atualizar_hero', { p_foto_hero_url: url, p_foto_hero_feminino_url: ident().foto_hero_feminino_url || null })
        .then(function () { mostrar(atualIdx); });
    }
    caixa.querySelector('.vb-ed-grade').addEventListener('click', function (e) {
      var b = e.target.closest('[data-foto]');
      if (b) usar(b.getAttribute('data-foto'));
    });
    $('vbEdFotoUp').addEventListener('change', function () {
      if (!this.files[0]) return;
      avisar('Enviando…');
      enviarFoto(this.files[0], 'hero').then(usar, function (e) { avisar(e.message || 'Falha ao enviar.', true); });
    });
  }

  function passoLogo(caixa) {
    var atual = estab().foto_perfil_url || ident().foto_perfil_url;
    caixa.innerHTML =
      '<div class="vb-ed-logo">' + (atual ? '<img src="' + esc(atual) + '" alt="">' : '<span>Sem logo</span>') + '</div>' +
      '<label class="vb-btn-upload" style="width:100%; justify-content:center; box-sizing:border-box;"><span class="vb-btn-upload-icone">' + ICONE_CAMERA + '</span> Escolher logo<input type="file" id="vbEdLogoUp" accept="image/*"></label>' +
      (atual ? '<button type="button" class="btn btn-ghost vb-ed-sec" id="vbEdLogoTirar" style="width:100%; margin-top:0.5rem;">Tirar a logo</button>' : '');
    $('vbEdLogoUp').addEventListener('change', function () {
      if (!this.files[0]) return;
      avisar('Enviando…');
      enviarFoto(this.files[0], 'logo').then(function (url) {
        return salvarLoja({ foto_perfil_url: url });
      }, function (e) { avisar(e.message || 'Falha ao enviar.', true); }).then(function () { mostrar(atualIdx); });
    });
    var tirar = $('vbEdLogoTirar');
    if (tirar) tirar.addEventListener('click', function () { salvarLoja({ foto_perfil_url: null }).then(function () { mostrar(atualIdx); }); });
  }

  function campo(id, rotulo, valor, tipo, extra) {
    var t = tipo === 'area'
      ? '<textarea id="' + id + '" rows="2"' + (extra || '') + '>' + esc(valor || '') + '</textarea>'
      : '<input id="' + id + '" type="' + (tipo || 'text') + '" value="' + esc(valor == null ? '' : valor) + '"' + (extra || '') + '>';
    return '<div class="field"><label for="' + id + '">' + rotulo + '</label>' + t + '</div>';
  }

  function passoTextos(caixa) {
    var e = estab();
    caixa.innerHTML =
      campo('vbEdNome', 'Nome do negócio', ident().nome || e.nome) +
      campo('vbEdDesc', 'Frase curta (o que você faz de melhor)', e.descricao, 'area', ' maxlength="300"') +
      campo('vbEdAviso', 'Aviso no topo (promoção, recado)', e.aviso, 'text', ' maxlength="140"') +
      campo('vbEdWhats', 'WhatsApp que recebe os ' + (api.servico() ? 'chamados' : 'pedidos'), e.telefone_whatsapp, 'tel', ' inputmode="tel"');
    $('vbEdNome').addEventListener('input', function () { api.prever({ nome: this.value }); });
    $('vbEdNome').addEventListener('change', function () {
      var nome = this.value.trim();
      if (nome.length < 2) return avisar('O nome precisa ter pelo menos 2 letras.', true);
      rpc('tenant_admin_atualizar_nome', { p_estabelecimento_id: e.id, p_nome: nome }).catch(function () {});
      salvarLoja({ nome: nome });
    });
    $('vbEdDesc').addEventListener('change', function () { salvarLoja({ descricao: this.value }); });
    $('vbEdAviso').addEventListener('change', function () { salvarLoja({ aviso: this.value }); });
    $('vbEdWhats').addEventListener('change', function () {
      var n = this.value.replace(/\D/g, '');
      if (n.length < 10) return avisar('WhatsApp com DDD, por favor.', true);
      salvarLoja({ telefone_whatsapp: n });
    });
  }

  function passoEfeito(caixa) {
    // o título fica embaixo da foto no celular: traz ele pro topo da tela, acima da bolha
    var tituloVivo = document.getElementById('tplHeadline');
    if (tituloVivo) window.scrollTo({ top: Math.max(0, tituloVivo.getBoundingClientRect().top + window.scrollY - 70), behavior: 'smooth' });
    var bloco = document.createElement('div');
    caixa.appendChild(bloco);
    window.VBTituloEfeitos.montarEscolha(bloco, api.efeitoTitulo(), function (cfg) {
      api.definirEfeitoTitulo(cfg);
      avisar('Salvando…');
      window.VBTituloEfeitos.salvar(estab().id, cfg).then(function () { avisar('Salvo ✓'); }, function (e) { avisar((e && e.message) || 'Não deu pra salvar.', true); });
    });
  }

  function passoEstilo(caixa) {
    var T = window.VibeTemplates;
    var tplAtual = ident().template || 'classico-boiserie';
    var corAtual = ident().cor_destaque || '';
    caixa.innerHTML =
      '<p class="vb-ed-rotulo">Estilo do site (vale pra Agendar, Pedir e Chamar):</p>' +
      '<div class="vb-ed-estilos">' + (T ? T.LISTA : []).map(function (t) {
        return '<button type="button" class="vb-ed-estilo' + (t.chave === tplAtual ? ' ativo' : '') + '" data-tpl="' + t.chave + '"><img src="' + t.print + '" alt="" loading="lazy"><span>' + esc(t.nome) + '</span></button>';
      }).join('') + '</div>' +
      '<p class="vb-ed-rotulo" style="margin-top:0.9rem;">Cor de destaque:</p>' +
      '<div class="vb-ed-cores"><button type="button" class="vb-ed-cor padrao' + (!corAtual ? ' ativo' : '') + '" data-cor="" title="Cor do estilo">auto</button>' +
      CORES.map(function (c) { return '<button type="button" class="vb-ed-cor' + (c === corAtual ? ' ativo' : '') + '" data-cor="' + c + '" style="background:' + c + '" aria-label="Cor ' + c + '"></button>'; }).join('') +
      '<input type="color" id="vbEdCorLivre" value="' + (corAtual || '#0F6B5C') + '" aria-label="Outra cor"></div>';
    caixa.querySelector('.vb-ed-estilos').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tpl]');
      if (!b) return;
      var chave = b.getAttribute('data-tpl');
      api.prever({ template: chave });
      salvarIdent('tenant_admin_atualizar_template', { p_template: chave }).then(function () { mostrar(atualIdx); });
    });
    function usarCor(c) {
      api.prever({ cor_destaque: c || null });
      salvarIdent('tenant_admin_atualizar_cor', { p_cor_destaque: c || null, p_cor_secundaria: null }).then(function () { mostrar(atualIdx); });
    }
    caixa.querySelector('.vb-ed-cores').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cor]');
      if (b) usarCor(b.getAttribute('data-cor'));
    });
    $('vbEdCorLivre').addEventListener('input', function () { api.prever({ cor_destaque: this.value }); });
    $('vbEdCorLivre').addEventListener('change', function () { usarCor(this.value); });
  }

  var itensAdmin = [], categoriasAdmin = [];
  function carregarItens() {
    return Promise.all([
      rpc('delivery_admin_listar_categorias', { p_estabelecimento_id: estab().id }),
      rpc('delivery_admin_listar_itens', { p_estabelecimento_id: estab().id })
    ]).then(function (r) { categoriasAdmin = r[0] || []; itensAdmin = r[1] || []; });
  }
  function passoItens(caixa) {
    var palavra = api.servico() ? 'serviço' : 'item';
    caixa.innerHTML = '<p class="vb-ed-rotulo">Carregando…</p>';
    carregarItens().then(function () {
      caixa.innerHTML =
        (itensAdmin.length ? '<ul class="vb-tutorial-lista">' + itensAdmin.map(function (i) {
          return '<li><span>' + esc(i.nome) + ' · ' + (Number(i.preco) > 0 ? 'R$ ' + Number(i.preco).toFixed(2).replace('.', ',') : 'a combinar') + (i.ativo ? '' : ' <em style="opacity:.6">(desligado)</em>') + '</span>' +
            '<button type="button" class="vb-remover-x" data-remover="' + i.id + '" aria-label="Remover">×</button></li>';
        }).join('') + '</ul>' : '<p class="vb-ed-rotulo">Nenhum ' + palavra + ' ainda.</p>') +
        '<div class="vb-ed-novo">' +
        campo('vbEdItemNome', 'Novo ' + palavra, '', 'text', ' placeholder="Nome"') +
        campo('vbEdItemPreco', 'Preço (R$)', '', 'text', ' inputmode="decimal" placeholder="0 = a combinar"') +
        (categoriasAdmin.length > 1 ? '<div class="field"><label for="vbEdItemCat">Categoria</label><select id="vbEdItemCat">' + categoriasAdmin.map(function (c) { return '<option value="' + c.id + '">' + esc(c.nome) + '</option>'; }).join('') + '</select></div>' : '') +
        '<button type="button" class="btn btn-primario" id="vbEdItemAdd" style="width:100%;">Adicionar</button></div>' +
        '<p class="vb-ed-rotulo" style="margin-top:0.7rem;">Fotos dos ' + palavra + 's, ' + (api.servico() ? 'categorias' : 'bordas, combos e categorias') + ' ficam no painel → ' + (api.servico() ? 'Serviços' : 'Cardápio') + '.</p>';
      caixa.querySelector('.vb-tutorial-lista') && caixa.querySelector('.vb-tutorial-lista').addEventListener('click', function (e) {
        var b = e.target.closest('[data-remover]');
        if (!b) return;
        avisar('Removendo…');
        rpc('delivery_admin_remover_item', { p_id: b.getAttribute('data-remover'), p_estabelecimento_id: estab().id })
          .then(function () { return api.recarregar(); }).then(function () { avisar('Removido ✓'); mostrar(atualIdx); }, function (er) { avisar(er.message, true); });
      });
      $('vbEdItemAdd').addEventListener('click', function () {
        var nome = $('vbEdItemNome').value.trim();
        if (nome.length < 2) return avisar('Escreva o nome do ' + palavra + '.', true);
        var preco = parseFloat(($('vbEdItemPreco').value || '0').replace(',', '.')) || 0;
        var cat = $('vbEdItemCat') ? $('vbEdItemCat').value : (categoriasAdmin[0] && categoriasAdmin[0].id);
        avisar('Salvando…');
        var comCategoria = cat ? Promise.resolve(cat) : rpc('delivery_admin_salvar_categoria', { p_id: null, p_estabelecimento_id: estab().id, p_nome: api.servico() ? 'Serviços' : 'Cardápio', p_ordem: 0 }).then(function (c) { return c && c.id; });
        comCategoria.then(function (catId) {
          return rpc('delivery_admin_salvar_item', {
            p_id: null, p_estabelecimento_id: estab().id, p_categoria_id: catId || null, p_nome: nome, p_descricao: null, p_preco: preco,
            p_foto_url: null, p_permite_meio_a_meio: false, p_ativo: true, p_ordem: itensAdmin.length, p_aceita_borda: false
          });
        }).then(function () { return api.recarregar(); }).then(function () { avisar('Adicionado ✓'); mostrar(atualIdx); }, function (er) { avisar(er.message || 'Não deu pra salvar.', true); });
      });
    });
  }

  function interruptor(id, rotulo, ligado) {
    return '<label class="vb-ed-switch"><input type="checkbox" id="' + id + '"' + (ligado ? ' checked' : '') + '><span>' + rotulo + '</span></label>';
  }
  function passoAtendimento(caixa) {
    var e = estab(), S = api.servico(), UR = api.urgente();
    caixa.innerHTML =
      interruptor('vbEdEntrega', S ? (UR ? 'Atendo no local do cliente (socorro)' : 'Vou até o cliente') : 'Faço entrega', e.aceita_entrega) +
      interruptor('vbEdRetirada', S ? 'Cliente pode vir até a loja' : 'Cliente pode retirar na loja', e.aceita_retirada) +
      '<div class="vb-ed-dupla">' +
      campo('vbEdTaxa', S ? (UR ? 'Taxa de deslocamento (R$)' : 'Taxa de visita (R$)') : 'Taxa de entrega (R$)', e.taxa_entrega, 'text', ' inputmode="decimal" placeholder="0 = grátis"') +
      (S ? '' : campo('vbEdMinimo', 'Pedido mínimo (R$)', e.pedido_minimo, 'text', ' inputmode="decimal" placeholder="Sem mínimo"')) +
      '</div><div class="vb-ed-dupla">' +
      campo('vbEdTMin', !S ? 'Tempo mín. (min)' : UR ? 'Chega em (mín., min)' : 'Visita em (mín., dias)', e.tempo_entrega_min, 'number', ' inputmode="numeric" min="0"') +
      campo('vbEdTMax', !S ? 'Tempo máx. (min)' : UR ? 'Chega em (máx., min)' : 'Visita em (máx., dias)', e.tempo_entrega_max, 'number', ' inputmode="numeric" min="0"') +
      '</div>';
    $('vbEdEntrega').addEventListener('change', function () { salvarLoja({ aceita_entrega: this.checked }); });
    $('vbEdRetirada').addEventListener('change', function () { salvarLoja({ aceita_retirada: this.checked }); });
    var num = function (v) { return String(v || '').replace(',', '.'); };
    $('vbEdTaxa').addEventListener('change', function () { salvarLoja({ taxa_entrega: num(this.value) }); });
    if ($('vbEdMinimo')) $('vbEdMinimo').addEventListener('change', function () { salvarLoja({ pedido_minimo: num(this.value) }); });
    $('vbEdTMin').addEventListener('change', function () { salvarLoja({ tempo_entrega_min: this.value }); });
    $('vbEdTMax').addEventListener('change', function () { salvarLoja({ tempo_entrega_max: this.value }); });
  }

  function passoPagamento(caixa) {
    var e = estab(), formas = e.formas_pagamento || [];
    caixa.innerHTML =
      interruptor('vbEdPgPix', 'Pix', formas.indexOf('pix') > -1) +
      interruptor('vbEdPgCartao', 'Cartão na entrega/retirada', formas.indexOf('cartao') > -1) +
      interruptor('vbEdPgDinheiro', 'Dinheiro', formas.indexOf('dinheiro') > -1) +
      campo('vbEdPix', 'Chave Pix (aparece pro cliente copiar)', e.chave_pix, 'text', ' maxlength="120"');
    function salvarFormas() {
      var f = [];
      if ($('vbEdPgPix').checked) f.push('pix');
      if ($('vbEdPgCartao').checked) f.push('cartao');
      if ($('vbEdPgDinheiro').checked) f.push('dinheiro');
      salvarLoja({ formas_pagamento: f });
    }
    ['vbEdPgPix', 'vbEdPgCartao', 'vbEdPgDinheiro'].forEach(function (id) { $(id).addEventListener('change', salvarFormas); });
    $('vbEdPix').addEventListener('change', function () { salvarLoja({ chave_pix: this.value }); });
  }

  function passoHorario(caixa) {
    var h = estab().horarios || {};
    caixa.innerHTML = '<div class="vb-ed-horarios">' + DIAS.map(function (d) {
      var faixa = (h[String(d)] || [])[0];
      return '<div class="vb-ed-hor" data-dia="' + d + '">' +
        '<label class="vb-ed-switch"><input type="checkbox" data-aberto' + (faixa ? ' checked' : '') + '><span>' + NOME_DIA[d] + '</span></label>' +
        '<input type="time" data-abre value="' + (faixa ? faixa[0] : '08:00') + '"' + (faixa ? '' : ' disabled') + ' aria-label="Abre às">' +
        '<input type="time" data-fecha value="' + (faixa ? faixa[1] : '18:00') + '"' + (faixa ? '' : ' disabled') + ' aria-label="Fecha às"></div>';
    }).join('') + '</div><button type="button" class="btn btn-ghost vb-ed-sec" id="vbEdCopiarHor" style="width:100%; margin-top:0.6rem;">Usar o horário de segunda em todos</button>';
    function ler() {
      var r = {};
      caixa.querySelectorAll('.vb-ed-hor').forEach(function (l) {
        var on = l.querySelector('[data-aberto]').checked;
        l.querySelectorAll('input[type="time"]').forEach(function (t) { t.disabled = !on; });
        var a = l.querySelector('[data-abre]').value, f = l.querySelector('[data-fecha]').value;
        if (on && a && f) r[l.getAttribute('data-dia')] = [[a, f]];
      });
      return r;
    }
    caixa.addEventListener('change', function (e) { if (e.target.closest('.vb-ed-hor')) salvarLoja({ horarios: ler() }); });
    $('vbEdCopiarHor').addEventListener('click', function () {
      var seg = caixa.querySelector('.vb-ed-hor[data-dia="1"]');
      var on = seg.querySelector('[data-aberto]').checked, a = seg.querySelector('[data-abre]').value, f = seg.querySelector('[data-fecha]').value;
      caixa.querySelectorAll('.vb-ed-hor').forEach(function (l) {
        l.querySelector('[data-aberto]').checked = on; l.querySelector('[data-abre]').value = a; l.querySelector('[data-fecha]').value = f;
      });
      salvarLoja({ horarios: ler() });
    });
  }

  function passoEndereco(caixa) {
    var e = estab();
    caixa.innerHTML =
      campo('vbEdEndereco', 'Endereço (rua, número, bairro)', e.endereco, 'text', ' maxlength="200"') +
      campo('vbEdInsta', 'Instagram', e.instagram_url, 'text', ' maxlength="200" placeholder="@sualoja"');
    $('vbEdEndereco').addEventListener('change', function () { salvarLoja({ endereco: this.value }); });
    $('vbEdInsta').addEventListener('change', function () { salvarLoja({ instagram_url: this.value.trim() }); });
  }

  function montarPassos() {
    var S = api.servico();
    return [
      { id: 'foto', titulo: 'Foto principal', texto: 'A foto grande do topo do site.', render: passoFoto },
      { id: 'logo', titulo: 'Logo', texto: 'Aparece redondinha ao lado do nome.', render: passoLogo },
      { id: 'textos', titulo: 'Nome e frases', texto: 'O que aparece escrito no site. Salva quando você sai do campo.', render: passoTextos },
      { id: 'efeito', titulo: 'Efeito do título', texto: 'Faça a frase grande do topo se mexer, trocar de letra ou ganhar brilho.', render: passoEfeito },
      { id: 'estilo', titulo: 'Cores e estilo', texto: 'O visual do site inteiro — muda ao vivo aqui atrás.', render: passoEstilo },
      { id: 'itens', titulo: S ? 'Serviços e preços' : 'Cardápio', texto: S ? 'O que o cliente pode pedir.' : 'O que o cliente pode pedir.', render: passoItens },
      { id: 'atendimento', titulo: S ? 'Atendimento' : 'Entrega e retirada', texto: S ? 'Onde você atende, taxa e prazo.' : 'Como o pedido chega no cliente.', render: passoAtendimento },
      { id: 'pagamento', titulo: 'Pagamento', texto: 'Como o cliente pode pagar.', render: passoPagamento },
      { id: 'horario', titulo: 'Horário', texto: 'Fora do horário o site mostra "Fechado".', render: passoHorario },
      { id: 'endereco', titulo: 'Endereço e Instagram', texto: 'Aparecem no site pro cliente achar você.', render: passoEndereco }
    ];
  }

  /* ---------- a bolha ---------- */
  var passos = [], atualIdx = 0;
  function montarBolha() {
    var ov = document.createElement('div');
    ov.className = 'vb-tutorial-overlay vb-editando';
    ov.id = 'vbEdOverlay';
    ov.innerHTML =
      '<div class="vb-tutorial-bolha">' +
      '<button type="button" class="vb-tutorial-sair" id="vbEdSair" aria-label="Sair da edição">×</button>' +
      '<div class="vb-tutorial-atalhos" id="vbEdAtalhos" role="tablist" aria-label="Etapas">' +
      passos.map(function (p, i) { return '<button type="button" data-ir="' + i + '">' + esc(p.titulo) + '</button>'; }).join('') + '</div>' +
      '<p class="vb-tutorial-contador" id="vbEdContador"></p>' +
      '<h3 id="vbEdTitulo"></h3><p id="vbEdTexto"></p>' +
      '<div class="vb-tutorial-campos" id="vbEdCampos"></div>' +
      '<p class="msg" id="vbEdMsg"></p>' +
      '<div class="vb-tutorial-acoes"><button type="button" class="btn btn-ghost" id="vbEdVoltar">Voltar</button><button type="button" class="btn btn-primario" id="vbEdProximo">Próximo</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    $('vbEdAtalhos').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ir]');
      if (b) mostrar(Number(b.getAttribute('data-ir')));
    });
    $('vbEdVoltar').addEventListener('click', function () { if (atualIdx > 0) mostrar(atualIdx - 1); });
    $('vbEdProximo').addEventListener('click', function () { if (atualIdx < passos.length - 1) mostrar(atualIdx + 1); else concluir(); });
    $('vbEdSair').addEventListener('click', concluir);
  }
  function mostrar(i) {
    atualIdx = i;
    var p = passos[i];
    $('vbEdContador').textContent = 'Editando · ' + (i + 1) + ' de ' + passos.length;
    $('vbEdTitulo').textContent = p.titulo;
    $('vbEdTexto').textContent = p.texto;
    $('vbEdProximo').textContent = i === passos.length - 1 ? 'Concluir' : 'Próximo';
    $('vbEdVoltar').classList.toggle('oculto', i === 0);
    document.querySelectorAll('#vbEdAtalhos [data-ir]').forEach(function (b) {
      var ativo = Number(b.getAttribute('data-ir')) === i;
      b.classList.toggle('ativo', ativo);
      if (ativo && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    var msg = $('vbEdMsg'); msg.className = 'msg'; msg.textContent = '';
    var caixa = $('vbEdCampos');
    caixa.innerHTML = '';
    p.render(caixa);
  }
  function concluir() { window.location.href = '/painel-area.html'; }

  // dono visitando sem ?editar=1: vê como o cliente, com o atalho pra editar
  function atalhoDono() {
    if ($('vbDonoAtalho')) return;
    var barra = document.createElement('div');
    barra.id = 'vbDonoAtalho';
    barra.className = 'vb-dono-atalho';
    barra.innerHTML = '<span>Este site é seu</span><a href="' + location.pathname + '?editar=1">Editar meu site</a><a href="/painel-area.html" class="vb-dono-atalho-painel">Painel</a>';
    document.body.appendChild(barra);
  }

  window.VBEditarLoja = {
    iniciar: function (apiLoja) {
      api = apiLoja;
      if (!db || !db.auth) return;
      db.auth.getSession().then(function (r) {
        var s = r.data && r.data.session;
        var id = ident();
        if (!s || !id || s.user.id !== id.dono_user_id) return;
        var q = new URLSearchParams(location.search);
        if (q.get('editar') !== '1') { atalhoDono(); return; }
        passos = montarPassos();
        montarBolha();
        var ini = 0;
        passos.forEach(function (p, i) { if (p.id === q.get('passo')) ini = i; });
        mostrar(ini);
      });
    }
  };
})();
