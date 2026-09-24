/* Página pública /:slug/:cidade — template "classico-boiserie", cópia
   fiel do design do Rafael Cabeleireiros (mesmo CSS dele, ver
   assets/tpl-classico/), com dados de verdade (serviços, galeria,
   agenda) por estabelecimento. */
(function () {
  if (!window.db) return;

  var partes = window.location.pathname.split('/').filter(Boolean);
  var slug = partes[0];
  var cidade = partes[1];

  var carregando = document.getElementById('carregando');
  var naoEncontrado = document.getElementById('naoEncontrado');
  var tpl = document.getElementById('tplClassico');
  var estabId = null;
  var generoAtual = null;
  var linhaAtual = null;

  // ---------- template visual: cada estabelecimento escolhe uma pasta
  // de CSS (mesma estrutura de HTML/classes, só trocam tokens/fonte) ----------
  var TEMPLATE_PASTAS = {
    'classico-boiserie': 'tpl-classico',
    'claro-minimal': 'tpl-claro',
    'escuro-premium': 'tpl-escuro',
    'automotivo-carbono': 'tpl-automotivo',
    'boho-terracota': 'tpl-boho',
    'vidro-fosco': 'tpl-vidro'
  };
  var templateAtualParaCor = 'classico-boiserie';
  var TEMPLATES_COM_TERRACOTTA = ['claro-minimal', 'escuro-premium', 'automotivo-carbono', 'boho-terracota', 'vidro-fosco'];
  function aplicarTemplateCss(templateKey) {
    templateAtualParaCor = templateKey || 'classico-boiserie';
    var pasta = TEMPLATE_PASTAS[templateKey] || 'tpl-classico';
    document.getElementById('tplBase').href = '/assets/' + pasta + '/css/base.css?v=4';
    document.getElementById('tplFeminino').href = '/assets/' + pasta + '/css/feminino.css?v=3';
    var widget = document.getElementById('tplWidget');
    if (widget) widget.href = '/assets/' + pasta + '/css/widget.css?v=5';
  }

  // ---- cor de destaque: sobrescreve os tokens de acento do template ativo
  // (--dourado* no classico-boiserie, --terracotta* nos outros 3, que já
  // usavam essa variável como cor única de marca). ----
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
  // essa cor vira o FUNDO de botões (.btn) e a cor do texto/borda dos
  // chips de serviço com TEXTO BRANCO por cima em ambos os casos — se o
  // dono escolher branco (ou qualquer tom muito claro), o texto some por
  // cima dela. Nunca deixa isso acontecer: escurece progressivamente até
  // garantir contraste mínimo, não importa a cor escolhida.
  function luminanciaRelativa(rgb) {
    var lin = rgb.map(function (c) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }
  function garantirContraste(rgb) {
    var tentativas = 0;
    while (luminanciaRelativa(rgb) > 0.6 && tentativas < 20) {
      rgb = rgb.map(function (c) { return Math.round(c * 0.88); });
      tentativas++;
    }
    return rgb;
  }
  // segunda cor da paleta: quando o dono escolhe uma, ela vira o tom
  // "profundo" usado nos degradês (botões, hero) no lugar do escurecimento
  // automático — as duas cores predominantes do site ficam nas mãos dele.
  function aplicarCorDinamica(cor, corSecundaria) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(cor || '')) return;
    var rgb = garantirContraste(hexParaRgbNums(cor));
    cor = rgbParaHex(rgb);
    var corSecundariaValida = /^#[0-9A-Fa-f]{6}$/.test(corSecundaria || '');
    var escuro = corSecundariaValida ? rgbParaHex(garantirContraste(hexParaRgbNums(corSecundaria))) : rgbParaHex(misturarRgb(rgb, [0, 0, 0], 0.28));
    var claro = rgbParaHex(misturarRgb(rgb, [255, 255, 255], 0.42));
    var estilo = document.getElementById('tplCorDinamica');
    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = 'tplCorDinamica';
      document.head.appendChild(estilo);
    }
    if (TEMPLATES_COM_TERRACOTTA.indexOf(templateAtualParaCor) > -1) {
      estilo.textContent = ':root{--terracotta:' + cor + '; --terracotta-deep:' + escuro + '; --terracotta-claro:' + claro + '; --terracotta-rgb:' + rgb.join(',') + ';}';
    } else {
      // classico-boiserie usa --dourado nos detalhes (borda, canto, rodapé)
      // E --terracotta no botão/marca principal — sem sobrescrever os dois,
      // o botão ficava preso na cor fixa do gênero (preto no masculino,
      // vinho no feminino.css), ignorando a cor escolhida na edição.
      estilo.textContent = ':root{' +
        '--dourado:' + cor + '; --dourado-escuro:' + escuro + '; --dourado-claro:' + claro + '; --dourado-rgb:' + rgb.join(',') + ';' +
        '--terracotta:' + cor + '; --terracotta-deep:' + escuro + '; --terracotta-claro:' + claro + '; --terracotta-rgb:' + rgb.join(',') + ';' +
        '}';
    }
  }
  function salvarCor(cor, corSecundaria) {
    linhaAtual.cor_destaque = cor;
    linhaAtual.cor_secundaria = corSecundaria;
    aplicarCorDinamica(cor, corSecundaria);
    // antes esse rpc era "fire and forget" — se falhasse (rede, sessão
    // expirada etc.), a cor mudava na tela mas nunca era salva de verdade,
    // e um F5 devolvia a cor antiga sem nenhum aviso do motivo.
    db.rpc('tenant_admin_atualizar_cor', { p_estabelecimento_id: estabId, p_cor_destaque: cor, p_cor_secundaria: corSecundaria || null }).then(function (res) {
      if (res.error && window.VBDialogo) { window.VBDialogo.alert('Não deu pra salvar a cor: ' + res.error.message); return; }
      if (!res.error && window.VBSalvo) window.VBSalvo.mostrar('Salvo');
    }, function () {
      if (window.VBDialogo) window.VBDialogo.alert('Sem conexão — a cor mudou na tela mas não foi salva. Tenta de novo.');
    });
    var corInput = document.getElementById('adminCorInput');
    var corSecundariaInput = document.getElementById('adminCorSecundariaInput');
    if (corInput) corInput.value = cor;
    if (corSecundariaInput && corSecundaria) corSecundariaInput.value = corSecundaria;
  }

  // "seguir cor da imagem": extrai um tom médio e um tom escuro da própria
  // foto principal e usa como paleta do site, pra tudo casar com a foto.
  function seguirCorDaImagem(url) {
    if (!window.extrairCoresDaImagem) return;
    window.extrairCoresDaImagem(url).then(function (cores) {
      salvarCor(cores.primaria, cores.secundaria);
    }, function (err) {
      // extração falha silenciosamente com bastante frequência quando a
      // foto vem de outra origem (CORS) — antes isso não avisava nada,
      // parecia que "seguiu a cor" (mudou na tela um instante) mas na
      // real nunca chegou a acontecer.
      if (window.VBDialogo) window.VBDialogo.alert('Não consegui pegar a cor dessa foto: ' + (err && err.message ? err.message : 'tenta com outra imagem.'));
    });
  }

  function alternarSeguirCorImagem() {
    var novoValor = !linhaAtual.seguir_cor_imagem;
    linhaAtual.seguir_cor_imagem = novoValor;
    var btn = document.getElementById('adminSeguirCorImagemBtn');
    if (btn) btn.classList.toggle('is-ativo', novoValor);
    db.rpc('tenant_admin_alternar_seguir_cor_imagem', { p_estabelecimento_id: estabId, p_seguir: novoValor }).then(function (res) {
      if (res.error && window.VBDialogo) window.VBDialogo.alert('Não deu pra salvar: ' + res.error.message);
    }, function () {
      if (window.VBDialogo) window.VBDialogo.alert('Sem conexão — tenta de novo.');
    });
    if (novoValor) {
      var fotoAtual = (generoAtual === 'feminino' && linhaAtual.foto_hero_feminino_url) ? linhaAtual.foto_hero_feminino_url : linhaAtual.foto_hero_url;
      if (fotoAtual) seguirCorDaImagem(fotoAtual);
    }
  }

  // widgets translúcidos (agenda/catálogo em vidro fosco) — puramente
  // visual, aplicado via classe no body pra valer pro site inteiro
  function aplicarWidgetsTranslucidos(ativo) {
    document.body.classList.toggle('vb-widgets-translucidos', !!ativo);
  }

  function alternarWidgetsTranslucidos() {
    var novoValor = !linhaAtual.widgets_translucidos;
    linhaAtual.widgets_translucidos = novoValor;
    var btn = document.getElementById('adminWidgetsTranslucidosBtn');
    if (btn) btn.classList.toggle('is-ativo', novoValor);
    aplicarWidgetsTranslucidos(novoValor);
    db.rpc('tenant_admin_alternar_widgets_translucidos', { p_estabelecimento_id: estabId, p_translucido: novoValor });
    // o efeito cobre o site inteiro (cabeçalho, menu, rodapé e a
    // agenda/catálogo) — já dá pra ver de cara no topo da página.
    window.VBDialogo.alert(novoValor
      ? 'Vidro fosco ativado! O cabeçalho, o menu e o rodapé do site já ficam translúcidos — e a agenda também, quando abrir.'
      : 'Vidro fosco desativado.');
  }

  // ---------- identidade do cliente na VB Agenda (login por WhatsApp) ----
  // Reconhece a mesma pessoa em QUALQUER estabelecimento da plataforma
  // (guardado uma única vez por telefone, não por estabelecimento como o
  // "lembrar meus dados" que já existia só dentro da agenda de cada
  // site). Sem verificação por enquanto — só identifica pelo número,
  // igual o resto do site já fazia. Ao reconhecer, também registra a
  // visita no estabelecimento aberto (tenant_registrar_cliente), pra o
  // dono ver esse contato na lista de clientes dele.
  function primeiroNome(nome) {
    return (nome || '').trim().split(/\s+/)[0] || nome || '';
  }

  function aplicarClienteGlobalNaTela(cliente) {
    var btn = document.getElementById('clienteGlobalBtn');
    var saudacao = document.getElementById('clienteSaudacao');
    var menuLoginTexto = document.getElementById('menuClienteLoginTexto');
    if (cliente) {
      if (btn) btn.textContent = 'Olá, ' + primeiroNome(cliente.nome);
      if (saudacao) {
        saudacao.textContent = 'Bem-vindo, ' + cliente.nome;
        saudacao.classList.remove('oculto');
      }
      if (menuLoginTexto) menuLoginTexto.textContent = 'Sair (' + primeiroNome(cliente.nome) + ')';
    } else {
      if (btn) btn.textContent = 'Entrar';
      if (saudacao) saudacao.classList.add('oculto');
      if (menuLoginTexto) menuLoginTexto.textContent = 'Entrar';
    }
  }

  function registrarVisitaCliente(cliente) {
    if (!cliente || !estabId) return;
    db.rpc('tenant_registrar_cliente', { p_estabelecimento_id: estabId, p_nome: cliente.nome, p_telefone: cliente.telefone });
  }

  function iniciarClienteGlobal() {
    if (!window.VBClienteGlobal) return;
    var overlay = document.getElementById('clienteGlobalOverlay');
    var btn = document.getElementById('clienteGlobalBtn');
    if (!overlay || !btn) return;
    var estagioEscolha = document.getElementById('clienteGlobalEstagioEscolha');
    var estagioTelefone = document.getElementById('clienteGlobalEstagioTelefone');
    var estagioNome = document.getElementById('clienteGlobalEstagioNome');
    var telefoneInput = document.getElementById('clienteGlobalTelefoneInput');
    var nomeInput = document.getElementById('clienteGlobalNomeInput');
    var msg = document.getElementById('clienteGlobalMsg');
    var telefonePendente = '';

    var clienteAtual = window.VBClienteGlobal.obter();
    aplicarClienteGlobalNaTela(clienteAtual);
    if (clienteAtual) registrarVisitaCliente(clienteAtual);

    function resetarEstagios() {
      estagioTelefone.classList.add('oculto');
      estagioNome.classList.add('oculto');
      telefoneInput.value = '';
      nomeInput.value = '';
      msg.textContent = '';
      msg.className = 'msg';
    }
    // "Entrar" no hero agora pergunta primeiro quem tá entrando — cliente
    // (segue pro login por WhatsApp de sempre) ou dono de estabelecimento
    // (manda direto pro acesso do dono em cadastro.html), em vez de abrir
    // só o login de cliente e deixar o dono sem saber onde clicar. Ações
    // que já são claramente de cliente (Meus agendamentos, Meus dados)
    // pulam essa pergunta e vão direto pro login por WhatsApp.
    function abrir() {
      resetarEstagios();
      if (estagioEscolha) estagioEscolha.classList.remove('oculto');
      overlay.classList.remove('oculto');
    }
    function abrirLoginCliente() {
      resetarEstagios();
      if (estagioEscolha) estagioEscolha.classList.add('oculto');
      estagioTelefone.classList.remove('oculto');
      overlay.classList.remove('oculto');
      setTimeout(function () { telefoneInput.focus(); }, 50);
    }
    function fechar() { overlay.classList.add('oculto'); }

    var escolherClienteBtn = document.getElementById('clienteGlobalEscolherCliente');
    if (escolherClienteBtn) escolherClienteBtn.addEventListener('click', abrirLoginCliente);
    var escolherEstabelecimentoBtn = document.getElementById('clienteGlobalEscolherEstabelecimento');
    if (escolherEstabelecimentoBtn) escolherEstabelecimentoBtn.addEventListener('click', function () {
      window.location.href = '/cadastro.html';
    });
    var cancelarEscolhaBtn = document.getElementById('clienteGlobalCancelarEscolha');
    if (cancelarEscolhaBtn) cancelarEscolhaBtn.addEventListener('click', fechar);

    btn.addEventListener('click', function () {
      var atual = window.VBClienteGlobal.obter();
      if (atual) {
        if (window.VBMeusAgendamentos) { window.VBMeusAgendamentos.abrir(); return; }
        window.VBDialogo.confirm('Sair da sua conta VB Agenda neste site?').then(function (ok) {
          if (!ok) return;
          window.VBClienteGlobal.limpar();
          aplicarClienteGlobalNaTela(null);
        });
        return;
      }
      abrir();
    });

    document.getElementById('clienteGlobalCancelar').addEventListener('click', fechar);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) fechar(); });

    document.getElementById('clienteGlobalContinuar').addEventListener('click', function () {
      var telefone = window.VBClienteGlobal.normalizarTelefone(telefoneInput.value);
      if (telefone.length < 10) {
        msg.className = 'msg msg-erro';
        msg.textContent = 'Digite um WhatsApp válido, com DDD.';
        return;
      }
      telefonePendente = telefone;
      msg.textContent = 'Verificando…';
      msg.className = 'msg';
      db.rpc('vb_buscar_cliente_global', { p_telefone: telefone }).then(function (res) {
        var achou = res.data && res.data.length > 0 ? res.data[0] : null;
        if (achou) {
          window.VBClienteGlobal.salvar(achou.telefone, achou.nome);
          aplicarClienteGlobalNaTela({ telefone: achou.telefone, nome: achou.nome });
          registrarVisitaCliente({ telefone: achou.telefone, nome: achou.nome });
          fechar();
        } else {
          msg.textContent = '';
          msg.className = 'msg';
          estagioTelefone.classList.add('oculto');
          estagioNome.classList.remove('oculto');
          setTimeout(function () { nomeInput.focus(); }, 50);
        }
      }, function () {
        msg.className = 'msg msg-erro';
        msg.textContent = 'Sem conexão agora.';
      });
    });

    document.getElementById('clienteGlobalVoltarTelefone').addEventListener('click', function () {
      estagioNome.classList.add('oculto');
      estagioTelefone.classList.remove('oculto');
    });

    document.getElementById('clienteGlobalConfirmarNome').addEventListener('click', function () {
      var nome = nomeInput.value.trim();
      if (!nome) return;
      db.rpc('vb_login_cliente_global', { p_telefone: telefonePendente, p_nome: nome }).then(function (res) {
        var criado = res.data && res.data.length > 0 ? res.data[0] : { telefone: telefonePendente, nome: nome };
        window.VBClienteGlobal.salvar(criado.telefone, criado.nome);
        aplicarClienteGlobalNaTela({ telefone: criado.telefone, nome: criado.nome });
        registrarVisitaCliente({ telefone: criado.telefone, nome: criado.nome });
        fechar();
      }, function () {
        msg.className = 'msg msg-erro';
        msg.textContent = 'Sem conexão agora.';
      });
    });

    // ---- itens de cliente dentro do menu hambúrguer (separados dos itens
    // do estabelecimento) — mesma lógica do botão do topo, só que
    // acessível de dentro do menu também. ----
    var menuLoginBtn = document.getElementById('menuClienteLogin');
    if (menuLoginBtn) menuLoginBtn.addEventListener('click', function () {
      if (window.RafaelMenu) window.RafaelMenu.close();
      btn.click();
    });
    var menuAgendamentosBtn = document.getElementById('menuMeusAgendamentos');
    if (menuAgendamentosBtn) menuAgendamentosBtn.addEventListener('click', function () {
      if (window.RafaelMenu) window.RafaelMenu.close();
      if (!window.VBClienteGlobal.obter()) { abrirLoginCliente(); return; }
      if (window.VBMeusAgendamentos) window.VBMeusAgendamentos.abrir();
    });
    var menuDadosBtn = document.getElementById('menuMeusDados');
    if (menuDadosBtn) menuDadosBtn.addEventListener('click', function () {
      if (window.RafaelMenu) window.RafaelMenu.close();
      var cliente = window.VBClienteGlobal.obter();
      if (!cliente) { abrirLoginCliente(); return; }
      window.VBDialogo.prompt('Seu nome:', cliente.nome).then(function (novoNome) {
        if (novoNome === null) return;
        novoNome = novoNome.trim() || cliente.nome;
        window.VBDialogo.prompt('Seu WhatsApp com DDD:', cliente.telefone).then(function (novoTelefone) {
          if (novoTelefone === null) return;
          novoTelefone = window.VBClienteGlobal.normalizarTelefone(novoTelefone) || cliente.telefone;
          window.VBClienteGlobal.salvar(novoTelefone, novoNome);
          aplicarClienteGlobalNaTela({ telefone: novoTelefone, nome: novoNome });
          registrarVisitaCliente({ telefone: novoTelefone, nome: novoNome });
        });
      });
    });
  }

  if (!slug || !cidade) {
    carregando.classList.add('oculto');
    naoEncontrado.classList.remove('oculto');
    return;
  }

  function mostrarNaoEncontrado() {
    carregando.classList.add('oculto');
    naoEncontrado.classList.remove('oculto');
  }

  // sem internet mas o site já tinha sido aberto antes neste aparelho?
  // mostra a versão salva (localStorage) em vez do "não encontramos" —
  // que parecia um link quebrado quando era só falta de conexão.
  var ICONE_OFFLINE_TOPO = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.58 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';
  function mostrarAvisoOfflineTopo() {
    if (document.querySelector('.vb-offline-aviso-topo')) return;
    var aviso = document.createElement('div');
    aviso.className = 'vb-offline-aviso vb-offline-aviso-topo';
    aviso.innerHTML = ICONE_OFFLINE_TOPO + '<span>Sem conexão — mostrando a última versão salva deste site.</span>';
    document.body.prepend(aviso);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function formatarPreco(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }

  var SEGMENTOS = {
    barbearia: 'Barbearia',
    salao: 'Salão de beleza',
    manicure_pedicure: 'Manicure e pedicure',
    estetica: 'Estética',
    estetica_automotiva: 'Estética automotiva',
    outro: 'Estabelecimento'
  };

  var COPY = {
    masculino: { headline: 'Seu estilo, sem complicação.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
    feminino: { headline: 'Sua beleza merece hora marcada.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' }
  };

  // ---------- horário de funcionamento (rodapé), agrupando dias
  // consecutivos com o mesmo horário — igual "Segunda a sábado: 8h às
  // 18h" do Rafael, só que calculado a partir do que o dono cadastrou ----------
  var DIAS_PLENO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  function formatarHora(h) {
    var hm = String(h || '').slice(0, 5).replace(/^0/, '');
    return hm.replace(/:00$/, '');
  }

  function formatarHorarios(linhas) {
    var porDia = {};
    (linhas || []).forEach(function (h) { porDia[h.dia_semana] = h; });
    var dias = [];
    for (var i = 0; i < 7; i++) {
      var h = porDia[i] || { abre: '08:00', fecha: '18:00', fechado: i === 0 };
      dias.push({ dia: i, abre: formatarHora(h.abre), fecha: formatarHora(h.fecha), fechado: h.fechado });
    }
    var grupos = [];
    dias.forEach(function (d) {
      var ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.abre === d.abre && ultimo.fecha === d.fecha && ultimo.fechado === d.fechado) {
        ultimo.fim = d.dia;
      } else {
        grupos.push({ inicio: d.dia, fim: d.dia, abre: d.abre, fecha: d.fecha, fechado: d.fechado });
      }
    });
    return grupos.filter(function (g) { return !g.fechado; }).map(function (g) {
      var label = g.inicio === g.fim ? DIAS_PLENO[g.inicio] : DIAS_PLENO[g.inicio] + ' a ' + DIAS_PLENO[g.fim];
      return label + ': ' + g.abre + 'h às ' + g.fecha + 'h';
    });
  }

  function carregarHorarioRodape() {
    var wrap = document.getElementById('tplHorarioRodape');
    if (!wrap) return;
    db.rpc('tenant_listar_horarios', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = formatarHorarios(res.data || []);
      wrap.innerHTML = linhas.length
        ? linhas.map(function (l) { return '<p>' + escapeHtml(l) + '</p>'; }).join('')
        : '<p>Consulte os horários pelo WhatsApp</p>';
    }, function () {
      wrap.innerHTML = '<p>Consulte os horários pelo WhatsApp</p>';
    });
  }

  // ---------- gênero: fixo (masculino/feminino) ou "ambos" (com gate) ----------
  var SESSION_KEY = 'vbGeneroSessao_' + slug + '_' + cidade;

  function boiseriePlaceholder(corHex) {
    var cor = (corHex || '#C9A227').replace('#', '');
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect x='9' y='9' width='54' height='54' rx='6' fill='none' stroke='%23" + cor + "' stroke-opacity='0.4' stroke-width='1.6'/%3E%3Crect x='18' y='18' width='36' height='36' rx='3' fill='none' stroke='%23" + cor + "' stroke-opacity='0.4' stroke-width='1.1'/%3E%3C/svg%3E";
  }

  // ---------- modo admin: PIN + edição inline direto no site ----------
  var modoAdmin = false;
  var ESTOQUE_FOTOS_ADMIN = [
    { url: '/assets/tpl-classico/img/estoque/hero-masculino-1.jpg', legenda: 'Studio dourado' },
    { url: '/assets/tpl-classico/img/estoque/hero-feminino-1.jpg', legenda: 'Salão rosé' },
    { url: '/assets/tpl-classico/img/estoque/fachada-1.jpg', legenda: 'Fachada clássica' }
  ];
  // ícone de câmera em linha, no lugar do emoji nativo (some de aparência
  // por sistema operacional/navegador e fica cinza-chumbo, combinando com
  // o resto dos botões).
  var ICONE_CAMERA = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>';

  // especialidades sugeridas por nicho — mesma ideia dos serviços
  // sugeridos, mas pro campo de especialidade da equipe (o exemplo fixo
  // "Cortes e barba" não fazia sentido nenhum pra quem tem uma estética
  // automotiva, por exemplo).
  var ESPECIALIDADES_SUGERIDAS = {
    barbearia: ['Cortes e barba', 'Coloração', 'Sobrancelha'],
    salao: ['Cortes e coloração', 'Escova e penteados', 'Manicure e pedicure'],
    manicure_pedicure: ['Manicure', 'Pedicure', 'Unhas em gel'],
    estetica: ['Limpeza de pele', 'Massagens', 'Depilação'],
    estetica_automotiva: ['Lavagem e detalhamento', 'Polimento e vitrificação', 'Estética interna'],
    outro: ['Atendimento geral']
  };
  function especialidadesSugeridasPara(segmento) {
    return ESPECIALIDADES_SUGERIDAS[segmento] || ESPECIALIDADES_SUGERIDAS.outro;
  }

  function salvarNome() {
    var el = document.getElementById('tplNomeTopo');
    var nome = el.textContent.trim();
    if (!nome) {
      el.textContent = linhaAtual.nome;
      return;
    }
    linhaAtual.nome = nome;
    document.getElementById('tplNomeRodape').textContent = nome;
    db.rpc('tenant_admin_atualizar_nome', { p_estabelecimento_id: estabId, p_nome: nome });
  }

  function salvarCta() {
    var el = document.getElementById('tplCtaTexto');
    var texto = el.textContent.trim();
    if (!texto) {
      el.textContent = linhaAtual.texto_cta || 'Agendar horário';
      return;
    }
    linhaAtual.texto_cta = texto;
    db.rpc('tenant_admin_atualizar_cta', { p_estabelecimento_id: estabId, p_texto_cta: texto });
  }

  function salvarTextoHero() {
    var titulo = document.getElementById('tplHeadline').textContent.trim();
    var subtitulo = document.getElementById('tplSubcopy').textContent.trim();
    linhaAtual.titulo_hero = titulo;
    linhaAtual.subtitulo_hero = subtitulo;
    db.rpc('tenant_admin_atualizar_texto', {
      p_estabelecimento_id: estabId,
      p_titulo_hero: titulo,
      p_subtitulo_hero: subtitulo
    });
  }

  function abrirEditorHero() {
    // a foto principal fica sempre visível pra todo mundo (é o próprio
    // hero do site) — sem essa conferência, uma vez que esse escutador
    // de clique é ligado (quando o dono entra no modo admin) ele nunca
    // era removido, e continuava abrindo o editor mesmo depois de
    // "Sair" ou pra qualquer cliente usando o mesmo aparelho depois.
    if (!modoAdmin) return;
    var existente = document.getElementById('vbHeroEditor');
    if (existente) { existente.remove(); return; }
    var caixa = document.createElement('div');
    caixa.id = 'vbHeroEditor';
    caixa.style.cssText = 'position:absolute; z-index:20; bottom:1rem; left:1rem; right:1rem; background:rgba(255,255,255,.92); backdrop-filter:blur(16px); border-radius:16px; padding:0.9rem; box-shadow:0 15px 40px rgba(0,0,0,.3);';
    caixa.innerHTML =
      '<p style="margin:0 0 0.6rem; font-size:0.85rem; font-weight:700;">Trocar foto principal</p>' +
      '<label class="vb-btn-upload" style="width:100%; justify-content:center; margin-bottom:0.7rem; box-sizing:border-box;"><span class="vb-btn-upload-icone">' + ICONE_CAMERA + '</span> Escolher foto do celular<input type="file" id="vbHeroEditorUpload" accept="image/*"></label>' +
      '<p style="margin:0 0 0.45rem; font-size:0.78rem; color:var(--ink-soft,#7a7368);">ou toque numa foto pronta:</p>' +
      '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.5rem;">' +
      (window.estoqueFotosPara ? window.estoqueFotosPara(linhaAtual.segmento) : ESTOQUE_FOTOS_ADMIN).map(function (f) {
        return '<img src="' + f.url + '" data-estoque-url="' + f.url + '" title="' + f.legenda + '" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:10px; cursor:pointer;">';
      }).join('') +
      '</div>' +
      '<p class="msg" id="vbHeroEditorMsg" style="margin-top:0.5rem;"></p>';
    document.getElementById('tplHeroFoto').appendChild(caixa);

    function salvarFotoHero(url) {
      var msg = document.getElementById('vbHeroEditorMsg');
      msg.textContent = 'Salvando…';
      var chave = (generoAtual === 'feminino') ? 'p_foto_hero_feminino_url' : 'p_foto_hero_url';
      var payload = { p_estabelecimento_id: estabId, p_foto_hero_url: null, p_foto_hero_feminino_url: null };
      payload[chave] = url;
      db.rpc('tenant_admin_atualizar_hero', payload).then(function (res) {
        if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
        if (generoAtual === 'feminino') linhaAtual.foto_hero_feminino_url = url; else linhaAtual.foto_hero_url = url;
        caixa.remove();
        aplicarGenero(generoAtual);
        if (linhaAtual.seguir_cor_imagem) seguirCorDaImagem(url);
      });
    }

    caixa.querySelectorAll('[data-estoque-url]').forEach(function (img) {
      img.addEventListener('click', function (e) {
        e.stopPropagation();
        salvarFotoHero(img.getAttribute('data-estoque-url'));
      });
    });
    document.getElementById('vbHeroEditorUpload').addEventListener('change', function (e) {
      e.stopPropagation();
      var file = e.target.files[0];
      if (!file || !window.VBUpload) return;
      document.getElementById('vbHeroEditorMsg').textContent = 'Enviando…';
      window.VBUpload.uploadFoto(file, estabId, 'hero').then(salvarFotoHero, function (err) {
        document.getElementById('vbHeroEditorMsg').className = 'msg msg-erro';
        document.getElementById('vbHeroEditorMsg').textContent = err.message || 'Falha ao enviar.';
      });
    });
  }

  // ---- foto de perfil/capa do card no catálogo (fora do site em si) ----
  function abrirEditorFotoCard() {
    var existente = document.getElementById('vbFotoCardEditor');
    if (existente) { existente.remove(); return; }
    var estoque = window.estoqueFotosPara ? window.estoqueFotosPara(linhaAtual.segmento) : ESTOQUE_FOTOS_ADMIN;
    function gradeEstoque(dataAttr) {
      return '<p style="margin:0.5rem 0 0.4rem; font-size:0.78rem; color:var(--ink-soft,#7a7368);">ou toque numa foto pronta:</p>' +
        '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.4rem; margin-bottom:1rem;">' +
        estoque.map(function (f) {
          return '<img src="' + f.url + '" data-' + dataAttr + '="' + f.url + '" title="' + f.legenda + '" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; cursor:pointer;">';
        }).join('') +
        '</div>';
    }
    var caixa = document.createElement('div');
    caixa.id = 'vbFotoCardEditor';
    caixa.className = 'admin-pin-overlay';
    caixa.innerHTML =
      '<div class="admin-pin-box" style="max-width:360px; text-align:left;">' +
      '<p class="eyebrow">Como aparece no catálogo</p>' +
      '<h2 style="margin:0.3rem 0 1rem; font-size:1.1rem;">Foto do card</h2>' +
      '<p style="font-size:0.85rem; font-weight:700; margin:0 0 0.4rem;">Foto de perfil</p>' +
      '<label class="vb-btn-upload" style="width:100%; justify-content:center; margin-bottom:0.3rem; box-sizing:border-box;"><span class="vb-btn-upload-icone">' + ICONE_CAMERA + '</span> Escolher foto<input type="file" id="vbFotoCardPerfilUpload" accept="image/*"></label>' +
      gradeEstoque('estoque-perfil') +
      '<p style="font-size:0.85rem; font-weight:700; margin:0 0 0.4rem;">Foto de capa</p>' +
      '<label class="vb-btn-upload" style="width:100%; justify-content:center; margin-bottom:0.3rem; box-sizing:border-box;"><span class="vb-btn-upload-icone">' + ICONE_CAMERA + '</span> Escolher foto<input type="file" id="vbFotoCardCapaUpload" accept="image/*"></label>' +
      gradeEstoque('estoque-capa') +
      '<p class="msg" id="vbFotoCardMsg"></p>' +
      '<button type="button" class="btn btn-ghost" id="vbFotoCardFechar" style="width:100%;">Fechar</button>' +
      '</div>';
    document.body.appendChild(caixa);
    document.getElementById('vbFotoCardFechar').addEventListener('click', function () { caixa.remove(); });
    function salvar(campo, url) {
      var msg = document.getElementById('vbFotoCardMsg');
      msg.textContent = 'Salvando…';
      var payload = { p_estabelecimento_id: estabId, p_foto_perfil_url: null, p_foto_capa_url: null };
      payload[campo] = url;
      db.rpc('tenant_admin_atualizar_perfil_capa', payload).then(function (res) {
        if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
        msg.className = 'msg msg-ok';
        msg.textContent = 'Salvo!';
      });
    }
    document.getElementById('vbFotoCardPerfilUpload').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file || !window.VBUpload) return;
      document.getElementById('vbFotoCardMsg').textContent = 'Enviando…';
      window.VBUpload.uploadFoto(file, estabId, 'perfil').then(function (url) { salvar('p_foto_perfil_url', url); });
    });
    document.getElementById('vbFotoCardCapaUpload').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file || !window.VBUpload) return;
      document.getElementById('vbFotoCardMsg').textContent = 'Enviando…';
      window.VBUpload.uploadFoto(file, estabId, 'capa').then(function (url) { salvar('p_foto_capa_url', url); });
    });
    caixa.querySelectorAll('[data-estoque-perfil]').forEach(function (img) {
      img.addEventListener('click', function () { salvar('p_foto_perfil_url', img.getAttribute('data-estoque-perfil')); });
    });
    caixa.querySelectorAll('[data-estoque-capa]').forEach(function (img) {
      img.addEventListener('click', function () { salvar('p_foto_capa_url', img.getAttribute('data-estoque-capa')); });
    });
  }

  function atualizarMapaLink() {
    var link = document.getElementById('tplMapaLink');
    if (!link) return;
    if (linhaAtual.endereco_lat != null && linhaAtual.endereco_lng != null) {
      link.href = 'https://www.google.com/maps/search/?api=1&query=' + linhaAtual.endereco_lat + ',' + linhaAtual.endereco_lng;
      return;
    }
    var consulta = [linhaAtual.nome, linhaAtual.endereco, linhaAtual.cidade].filter(Boolean).join(' ');
    link.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consulta);
  }

  // ---- contador de acessos: conta uma vez por sessão do navegador, e só
  // pra quem visita de verdade (não conta quando o próprio dono já está
  // com o site desbloqueado como admin). ----
  function registrarAcessoSeNecessario() {
    if (modoAdmin) return;
    var chaveSessao = 'vbAcessoRegistrado_' + estabId;
    var jaContou = false;
    try { jaContou = sessionStorage.getItem(chaveSessao) === '1'; } catch (e) {}
    if (jaContou) return;
    // só marca como "já contou" depois da RPC confirmar sucesso — assim,
    // se a chamada falhar (rede, permissão, etc.), a próxima visita na
    // mesma sessão tenta de novo em vez de ficar zerada pra sempre.
    db.rpc('tenant_registrar_acesso', { p_estabelecimento_id: estabId }).then(function (res) {
      if (res && res.error) {
        console.error('Falha ao registrar acesso:', res.error);
        return;
      }
      try { sessionStorage.setItem(chaveSessao, '1'); } catch (e) {}
    }, function (err) {
      console.error('Falha ao registrar acesso:', err);
    });
  }

  var periodoContadorAtual = null;
  function consultarAcessosPorPeriodo(dias) {
    var totalEl = document.getElementById('tplContadorTotal');
    var botoes = document.getElementById('tplContadorPeriodos');
    if (!totalEl) return;
    periodoContadorAtual = dias;
    if (botoes) {
      botoes.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('is-ativo', Number(b.getAttribute('data-periodo')) === dias);
      });
    }
    db.rpc('tenant_publico_acessos_por_periodo', { p_estabelecimento_id: estabId, p_dias: dias }).then(function (res) {
      if (periodoContadorAtual !== dias) return;
      totalEl.textContent = (res.data != null ? res.data : 0);
    });
  }
  function atualizarContadorPublico() {
    var el = document.getElementById('tplContadorPublico');
    if (!el) return;
    if (linhaAtual.mostrar_contador_publico) {
      el.classList.remove('oculto');
      consultarAcessosPorPeriodo(5);
      var botoes = document.getElementById('tplContadorPeriodos');
      if (botoes && !botoes.dataset.ligado) {
        botoes.dataset.ligado = '1';
        botoes.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-periodo]');
          if (!btn) return;
          consultarAcessosPorPeriodo(Number(btn.getAttribute('data-periodo')));
        });
      }
    } else {
      el.classList.add('oculto');
    }
  }

  // Reconhece o endereço digitado num par de coordenadas reais (OpenStreetMap
  // Nominatim, gratuito e sem chave) pra deixar o link do mapa preciso.
  // Um endereço completo digitado de um jeito que o Nominatim não reconhece
  // ao pé da letra (abreviação de "Rua"/"Av.", complemento tipo "sala 2"/
  // "apto 301" no meio do texto, número colado sem vírgula etc.) fazia a
  // busca simplesmente não achar nada e desistir — agora tenta de novo com
  // versões cada vez mais simplificadas do texto, até no pior caso cair só
  // no nome da cidade (impreciso, mas melhor que não mostrar mapa nenhum).
  function geocodificarEndereco(endereco, cidade) {
    var semComplemento = (endereco || '').replace(/,?\s*(ap(?:t|to)?\.?|sala|loja|bloco|bl\.?|conjunto|cj\.?)\s*\.?\s*\d+\w*/gi, '').trim();
    var soRua = semComplemento.replace(/,?\s*n[º°o]?\.?\s*\d+[\w-]*/gi, '').replace(/^\s*,\s*/, '').trim();
    var tentativasBrutas = [endereco, semComplemento, soRua, ''];
    var vistas = {};
    var tentativas = [];
    tentativasBrutas.forEach(function (texto) {
      var consulta = [texto, cidade, 'Brasil'].filter(Boolean).join(', ');
      if (!vistas[consulta]) { vistas[consulta] = true; tentativas.push(consulta); }
    });

    function tentar(i) {
      if (i >= tentativas.length) return null;
      var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent(tentativas[i]);
      return fetch(url).then(function (res) { return res.json(); }).then(function (dados) {
        var achado = dados && dados[0];
        if (achado) return { lat: parseFloat(achado.lat), lng: parseFloat(achado.lon), aproximado: i > 0 };
        return tentar(i + 1);
      }, function () { return tentar(i + 1); });
    }
    return Promise.resolve(tentar(0));
  }

  function salvarEndereco() {
    var endereco = document.getElementById('tplEnderecoRodape').textContent.trim();
    // salva o texto na hora — geocodificar é só um extra pra deixar o mapa
    // preciso, e não pode travar a ação principal se o serviço demorar/falhar.
    linhaAtual.endereco = endereco;
    linhaAtual.endereco_lat = null;
    linhaAtual.endereco_lng = null;
    atualizarMapaLink();
    db.rpc('tenant_admin_atualizar_endereco', { p_estabelecimento_id: estabId, p_endereco: endereco, p_lat: null, p_lng: null });
    if (!endereco) return;
    geocodificarEndereco(endereco, linhaAtual.cidade).then(function (coord) {
      if (!coord) return;
      linhaAtual.endereco_lat = coord.lat;
      linhaAtual.endereco_lng = coord.lng;
      atualizarMapaLink();
      db.rpc('tenant_admin_atualizar_endereco', {
        p_estabelecimento_id: estabId,
        p_endereco: endereco,
        p_lat: coord.lat,
        p_lng: coord.lng
      });
    });
  }

  // esconde o site de quem visita enquanto faltar serviço ou equipe
  // (ninguém deveria cair numa agenda vazia sem profissional/serviço pra
  // escolher) — o dono ainda enxerga tudo normal assim que entra no modo
  // admin, pra poder completar o cadastro.
  function atualizarGateIncompleto() {
    var gate = document.getElementById('incompletoGate');
    if (!gate || !linhaAtual) return;
    // pizzaria (e outros nichos de cardápio, no futuro) não usa agendamento
    // com profissional — "pronto" pra eles é ter algo na Galeria, não
    // serviço/equipe, que nem existem nesse fluxo.
    var incompleto = linhaAtual.segmento === 'pizzaria'
      ? !linhaAtual.tem_cardapio
      : (!linhaAtual.tem_servico || !linhaAtual.tem_equipe);
    if (incompleto && !modoAdmin) {
      document.getElementById('incompletoTitulo').textContent = linhaAtual.nome + ' está quase pronto';
      gate.classList.add('open');
      document.body.classList.add('scroll-locked');
    } else {
      gate.classList.remove('open');
      if (!document.getElementById('genderGate') || !document.getElementById('genderGate').classList.contains('open')) {
        document.body.classList.remove('scroll-locked');
      }
    }
  }

  function ativarModoAdmin() {
    if (modoAdmin) return;
    modoAdmin = true;
    document.body.classList.add('vb-modo-admin');
    document.getElementById('adminModoBarra').classList.remove('oculto');
    // o dono não deveria ficar travado atrás do gate de gênero (ainda sem
    // resposta) pra poder editar — resolve com o padrão e segue.
    var gate = document.getElementById('genderGate');
    if (gate && gate.classList.contains('open')) {
      gate.classList.remove('open');
      document.body.classList.remove('scroll-locked');
      aplicarGenero(generoAtual || 'masculino');
    }
    atualizarGateIncompleto();
    var titulo = document.getElementById('tplHeadline');
    var sub = document.getElementById('tplSubcopy');
    var endereco = document.getElementById('tplEnderecoRodape');
    var nomeTopo = document.getElementById('tplNomeTopo');
    var ctaTexto = document.getElementById('tplCtaTexto');
    titulo.setAttribute('contenteditable', 'true');
    sub.setAttribute('contenteditable', 'true');
    endereco.setAttribute('contenteditable', 'true');
    nomeTopo.setAttribute('contenteditable', 'true');
    ctaTexto.setAttribute('contenteditable', 'true');
    titulo.addEventListener('blur', salvarTextoHero);
    sub.addEventListener('blur', salvarTextoHero);
    endereco.addEventListener('blur', salvarEndereco);
    nomeTopo.addEventListener('blur', salvarNome);
    ctaTexto.addEventListener('blur', salvarCta);
    document.getElementById('tplHeroFoto').addEventListener('click', abrirEditorHero);
    ativarEdicaoTelefone();
    carregarServicos();
    carregarEquipeAdmin();
    carregarGaleria();
    carregarRedesSociais();
    iniciarTutorialSeNecessario();
  }

  // ---- continuação da criação do site, direto no site real: NÃO é um
  // tutorial opcional/pulável — é a mesma criação começada em criar.html
  // (template, nicho, atendimento, nome, cidade, whatsapp), só que agora
  // com os campos de verdade embutidos direto na própria caixa (não é só
  // uma mensagem apontando pra um botão em outro canto da tela — cada
  // passo já abre a caixa de edição pronta pra preencher). Os passos com
  // "obrigatorio: true" não deixam avançar sem dado real (foto, 1 serviço,
  // 1 profissional); os demais só ficam marcados como recomendados. A
  // numeração continua contando de onde criar.html parou (?desde=N na
  // URL) — não reinicia do passo 1, pra não parecer uma etapa separada. ----
  var PASSOS_CRIACAO = [
    {
      id: 'foto', titulo: 'Foto principal',
      texto: 'Essa é a primeira coisa que os clientes veem. Escolha uma foto do seu celular ou uma das opções abaixo.',
      obrigatorio: true,
      avisoIncompleto: 'Escolha uma foto pra continuar.',
      completo: function () { return !!(linhaAtual && ((generoAtual === 'feminino') ? (linhaAtual.foto_hero_feminino_url || linhaAtual.foto_hero_url) : linhaAtual.foto_hero_url)); },
      render: renderPassoTutorialFoto
    },
    {
      id: 'cores', titulo: 'Cores da sua marca',
      texto: 'Você já escolheu uma cor lá no começo — aqui dá pra trocar quantas vezes quiser. Escolha a principal e a secundária.',
      obrigatorio: false,
      completo: function () { return true; },
      render: renderPassoTutorialCores
    },
    {
      id: 'servicos', titulo: 'Serviços e preços',
      texto: 'Adicione cada serviço que você oferece, com o preço. Precisa ter pelo menos um pra continuar.',
      obrigatorio: true,
      avisoIncompleto: 'Adicione pelo menos um serviço pra continuar.',
      completo: function () { return servicosCache && servicosCache.length > 0; },
      render: renderPassoTutorialServicos
    },
    {
      id: 'equipe', titulo: 'Sua equipe',
      texto: 'Adicione os profissionais que atendem na sua loja. Precisa ter pelo menos um pra continuar.',
      obrigatorio: true,
      avisoIncompleto: 'Adicione pelo menos um profissional pra continuar.',
      completo: function () { return equipeCache && equipeCache.length > 0; },
      render: renderPassoTutorialEquipe
    },
    {
      id: 'localizacao', titulo: 'Localização',
      texto: 'Onde fica seu estabelecimento? Isso aparece no rodapé do site e no link do mapa. Precisa preencher pra continuar.',
      obrigatorio: true,
      avisoIncompleto: 'Preencha o endereço pra continuar.',
      completo: function () { return !!(linhaAtual && linhaAtual.endereco && linhaAtual.endereco.trim()); },
      render: renderPassoTutorialLocalizacao
    },
    {
      id: 'redes', titulo: 'Redes sociais',
      texto: 'Opcional, mas muito importante — clientes confiam bem mais em quem tem Instagram e WhatsApp visíveis no site.',
      obrigatorio: false,
      completo: function () { return true; },
      render: renderPassoTutorialRedes
    },
    {
      id: 'galeria', titulo: 'Galeria de fotos',
      texto: 'Opcional, mas ajuda bastante a fechar clientes: mostre fotos do seu espaço e dos seus trabalhos.',
      obrigatorio: false,
      completo: function () { return true; },
      render: renderPassoTutorialGaleria
    }
  ];
  var passoCriacaoAtual = 0;
  var passoCriacaoDesde = 0;
  var passoCriacaoTotal = 0;

  function iniciarTutorialSeNecessario() {
    var params = new URLSearchParams(window.location.search);
    var querContinuar = params.get('tutorial') === '1';
    if (!querContinuar || !linhaAtual || linhaAtual.onboarding_concluido) return;
    passoCriacaoAtual = 0;
    passoCriacaoDesde = parseInt(params.get('desde'), 10) || 0;
    passoCriacaoTotal = passoCriacaoDesde + PASSOS_CRIACAO.length;
    // a barra de admin e a bolha de criação são as duas fixas na base da
    // tela — some com a barra enquanto a criação continua, senão as duas
    // ficam se sobrepondo (volta a aparecer quando termina)
    document.getElementById('adminModoBarra').classList.add('oculto');
    document.getElementById('vbTutorialOverlay').classList.remove('oculto');
    document.getElementById('vbTutorialProximo').addEventListener('click', function () {
      if (this.disabled) return;
      if (passoCriacaoAtual >= PASSOS_CRIACAO.length - 1) { concluirTutorial(); return; }
      passoCriacaoAtual++;
      mostrarPassoTutorial(passoCriacaoAtual);
    });
    mostrarPassoTutorial(0);
  }

  // atualiza o texto/estado do botão "Próximo" de acordo com o passo atual
  // — obrigatório sem dado real trava o avanço (com o aviso do motivo).
  function atualizarBotaoProximoTutorial() {
    var passo = PASSOS_CRIACAO[passoCriacaoAtual];
    var btn = document.getElementById('vbTutorialProximo');
    var aviso = document.getElementById('vbTutorialAviso');
    var completo = !passo.obrigatorio || (passo.completo && passo.completo());
    btn.disabled = !completo;
    btn.classList.toggle('vb-btn-desabilitado', !completo);
    if (aviso) {
      aviso.textContent = completo ? '' : (passo.avisoIncompleto || 'Preencha essa etapa pra continuar.');
      aviso.classList.toggle('oculto', completo);
    }
  }

  function mostrarPassoTutorial(indice) {
    var passo = PASSOS_CRIACAO[indice];
    document.getElementById('vbTutorialContador').textContent = 'Passo ' + (passoCriacaoDesde + indice + 1) + ' de ' + passoCriacaoTotal;
    document.getElementById('vbTutorialTitulo').textContent = passo.titulo;
    document.getElementById('vbTutorialTexto').textContent = passo.texto;
    document.getElementById('vbTutorialProximo').textContent = indice === PASSOS_CRIACAO.length - 1 ? 'Finalizar criação ✓' : 'Próximo →';
    var campos = document.getElementById('vbTutorialCampos');
    campos.innerHTML = '';
    if (passo.render) passo.render(campos);
    atualizarBotaoProximoTutorial();
  }

  function concluirTutorial() {
    document.getElementById('vbTutorialOverlay').classList.add('oculto');
    document.getElementById('adminModoBarra').classList.remove('oculto');
    if (linhaAtual) linhaAtual.onboarding_concluido = true;
    db.rpc('tenant_admin_concluir_onboarding', { p_estabelecimento_id: estabId });
  }

  // ---- passo "foto principal": mesmo upload/estoque do editor rápido do
  // admin, só que sempre visível dentro da própria caixa da criação — sem
  // precisar adivinhar onde clicar na foto por trás dela. ----
  function renderPassoTutorialFoto(container) {
    var fotoAtual = (generoAtual === 'feminino') ? (linhaAtual.foto_hero_feminino_url || linhaAtual.foto_hero_url) : linhaAtual.foto_hero_url;
    var estoque = window.estoqueFotosPara ? window.estoqueFotosPara(linhaAtual.segmento) : ESTOQUE_FOTOS_ADMIN;
    container.innerHTML =
      (fotoAtual ? '<div style="width:100%; aspect-ratio:16/9; border-radius:12px; background-size:cover; background-position:center; margin-bottom:0.7rem; background-image:url(\'' + fotoAtual + '\')"></div>' : '') +
      '<label class="vb-btn-upload" style="width:100%; justify-content:center; margin-bottom:0.7rem; box-sizing:border-box;"><span class="vb-btn-upload-icone">' + ICONE_CAMERA + '</span> Escolher foto do celular<input type="file" id="vbTutFotoUpload" accept="image/*"></label>' +
      '<p class="vb-servico-novo-legenda">ou toque numa foto pronta:</p>' +
      '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.5rem;">' +
      estoque.map(function (f) {
        var sel = f.url === fotoAtual;
        return '<img src="' + f.url + '" data-estoque-url="' + f.url + '" title="' + f.legenda + '" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:10px; cursor:pointer; border:2px solid ' + (sel ? 'var(--terracotta, var(--dourado,#C9A227))' : 'transparent') + ';">';
      }).join('') +
      '</div>' +
      '<p class="msg" id="vbTutFotoMsg" style="margin-top:0.5rem;"></p>' +
      renderBlocoFotoPerfil();

    function renderBlocoFotoPerfil() {
      var fotoPerfil = linhaAtual.foto_perfil_url || fotoAtual;
      var molduraAtual = linhaAtual.moldura_foto || 'simples';
      var MOLDURAS = [
        { chave: 'simples', nome: 'Simples' },
        { chave: 'dupla', nome: 'Dupla' },
        { chave: 'grossa', nome: 'Grossa' },
        { chave: 'pontilhada', nome: 'Pontilhada' },
        { chave: 'metalica', nome: 'Metálica' },
        { chave: 'giratoria', nome: 'Giratória ✨' },
        { chave: 'aura', nome: 'Aura' }
      ];
      var avatarConteudo = fotoPerfil
        ? '<span class="catalogo-avatar-foto" style="background-image:url(\'' + fotoPerfil + '\');"></span>'
        : escapeHtml((linhaAtual.nome || '?')[0].toUpperCase());
      return '<hr style="border:none; border-top:1px solid var(--borda-suave,#e7e2d8); margin:1.2rem 0;">' +
        '<p style="font-size:0.85rem; font-weight:700; margin:0 0 0.5rem;">Foto de perfil <span style="font-weight:400; color:var(--ink-soft,#7a7368);">— aparece no catálogo e no seu painel</span></p>' +
        '<div style="display:flex; align-items:center; gap:1rem; margin-bottom:0.8rem;">' +
        '<span class="catalogo-avatar-anel moldura-' + molduraAtual + '" id="vbTutPerfilAnel" style="position:relative; left:auto; bottom:auto; --avatar-cor:' + (linhaAtual.cor_destaque || '#C9A227') + '; width:64px; height:64px; flex-shrink:0;">' +
        '<span class="catalogo-avatar" style="background:' + (linhaAtual.cor_destaque || '#C9A227') + ';">' + avatarConteudo + '</span>' +
        '</span>' +
        '<label class="vb-btn-upload" style="justify-content:center; box-sizing:border-box; flex:1;"><span class="vb-btn-upload-icone">' + ICONE_CAMERA + '</span> Escolher foto<input type="file" id="vbTutPerfilUpload" accept="image/*"></label>' +
        '</div>' +
        '<p class="vb-servico-novo-legenda">ou escolha um avatar pronto:</p>' +
        '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.5rem; margin-bottom:0.8rem;">' +
        (window.avataresParaSegmento ? window.avataresParaSegmento(linhaAtual.segmento) : []).map(function (f) {
          var sel = f.url === fotoPerfil;
          return '<img src="' + f.url + '" data-estoque-avatar-url="' + f.url + '" title="' + f.legenda + '" style="width:100%; aspect-ratio:1; object-fit:contain; background:var(--linho,#f2ede2); border-radius:10px; cursor:pointer; border:2px solid ' + (sel ? 'var(--terracotta, var(--dourado,#C9A227))' : 'transparent') + ';">';
        }).join('') +
        '</div>' +
        '<p class="vb-servico-novo-legenda">Borda da foto:</p>' +
        '<div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.4rem;">' +
        MOLDURAS.map(function (m) {
          return '<button type="button" class="vb-servico-chip" data-moldura="' + m.chave + '" style="' + (m.chave === molduraAtual ? 'background:var(--terracotta,var(--dourado,#C9A227)); color:#fff; border-color:transparent;' : '') + '">' + m.nome + '</button>';
        }).join('') +
        '</div>' +
        '<p class="msg" id="vbTutPerfilMsg"></p>';
    }

    function salvarPerfil(campo, valor) {
      var msg = document.getElementById('vbTutPerfilMsg');
      msg.textContent = 'Salvando…';
      var payload = { p_estabelecimento_id: estabId, p_foto_perfil_url: null, p_foto_capa_url: null, p_moldura_foto: null };
      payload[campo] = valor;
      db.rpc('tenant_admin_atualizar_perfil_capa', payload).then(function (res) {
        if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
        if (campo === 'p_foto_perfil_url') linhaAtual.foto_perfil_url = valor;
        if (campo === 'p_moldura_foto') linhaAtual.moldura_foto = valor;
        mostrarPassoTutorial(passoCriacaoAtual);
      });
    }
    var uploadPerfilEl = document.getElementById('vbTutPerfilUpload');
    if (uploadPerfilEl) {
      uploadPerfilEl.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file || !window.VBUpload) return;
        document.getElementById('vbTutPerfilMsg').textContent = 'Enviando…';
        window.VBUpload.uploadFoto(file, estabId, 'perfil').then(function (url) { salvarPerfil('p_foto_perfil_url', url); }, function (err) {
          var msg = document.getElementById('vbTutPerfilMsg');
          msg.className = 'msg msg-erro';
          msg.textContent = err.message || 'Falha ao enviar.';
        });
      });
    }
    container.querySelectorAll('[data-estoque-avatar-url]').forEach(function (img) {
      img.addEventListener('click', function () { salvarPerfil('p_foto_perfil_url', img.getAttribute('data-estoque-avatar-url')); });
    });
    container.querySelectorAll('[data-moldura]').forEach(function (btn) {
      btn.addEventListener('click', function () { salvarPerfil('p_moldura_foto', btn.getAttribute('data-moldura')); });
    });

    function salvar(url) {
      var msg = document.getElementById('vbTutFotoMsg');
      msg.textContent = 'Salvando…';
      var chave = (generoAtual === 'feminino') ? 'p_foto_hero_feminino_url' : 'p_foto_hero_url';
      var payload = { p_estabelecimento_id: estabId, p_foto_hero_url: null, p_foto_hero_feminino_url: null };
      payload[chave] = url;
      db.rpc('tenant_admin_atualizar_hero', payload).then(function (res) {
        if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
        if (generoAtual === 'feminino') linhaAtual.foto_hero_feminino_url = url; else linhaAtual.foto_hero_url = url;
        aplicarGenero(generoAtual);
        if (linhaAtual.seguir_cor_imagem) seguirCorDaImagem(url);
        mostrarPassoTutorial(passoCriacaoAtual);
      });
    }
    container.querySelectorAll('[data-estoque-url]').forEach(function (img) {
      img.addEventListener('click', function () { salvar(img.getAttribute('data-estoque-url')); });
    });
    document.getElementById('vbTutFotoUpload').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file || !window.VBUpload) return;
      document.getElementById('vbTutFotoMsg').textContent = 'Enviando…';
      window.VBUpload.uploadFoto(file, estabId, 'hero').then(salvar, function (err) {
        document.getElementById('vbTutFotoMsg').className = 'msg msg-erro';
        document.getElementById('vbTutFotoMsg').textContent = err.message || 'Falha ao enviar.';
      });
    });
  }

  // ---- passo "cores da marca": os mesmos dois seletores de cor da barra
  // de admin, embutidos aqui — a barra de admin fica escondida durante a
  // criação, então sem isso não dava pra mudar cor nenhuma nesse passo. ----
  // paletas prontas — jeito rápido e moderno de escolher cor sem precisar
  // entender teoria de cor: cada uma já é um par testado (principal +
  // secundária), cobrindo climas bem diferentes de marca.
  var PALETAS_PRONTAS = [
    { nome: 'Dourado clássico', principal: '#C9A227', secundaria: '#8A6D1C' },
    { nome: 'Vermelho pista', principal: '#D8342A', secundaria: '#8F1F18' },
    { nome: 'Azul confiança', principal: '#2E6F9E', secundaria: '#1C435F' },
    { nome: 'Verde natural', principal: '#3F7A4E', secundaria: '#26492F' },
    { nome: 'Rosa suave', principal: '#C9668E', secundaria: '#8A4160' },
    { nome: 'Roxo premium', principal: '#6B4FA0', secundaria: '#463368' },
    { nome: 'Grafite & prata', principal: '#54565A', secundaria: '#232426' },
    { nome: 'Terracota', principal: '#B5622E', secundaria: '#7A4019' }
  ];

  function renderPassoTutorialCores(container) {
    var corPrincipal = linhaAtual.cor_destaque || '#C9A227';
    var corSecundaria = linhaAtual.cor_secundaria || rgbParaHex(misturarRgb(hexParaRgbNums(corPrincipal), [0, 0, 0], 0.28));
    var temFoto = !!((generoAtual === 'feminino' && linhaAtual.foto_hero_feminino_url) || linhaAtual.foto_hero_url);
    container.innerHTML =
      (temFoto ? '<button type="button" class="btn btn-ghost" id="vbTutSeguirFoto" style="width:100%; margin-bottom:1rem;">🎨 Usar as cores da minha foto</button>' : '') +
      '<p class="vb-servico-novo-legenda">Paletas prontas:</p>' +
      '<div style="display:flex; flex-wrap:wrap; gap:0.6rem; margin-bottom:1.1rem;">' +
      PALETAS_PRONTAS.map(function (p) {
        var ativa = p.principal.toLowerCase() === corPrincipal.toLowerCase();
        return '<button type="button" class="vb-paleta-pronta' + (ativa ? ' is-selecionada' : '') + '" data-paleta-principal="' + p.principal + '" data-paleta-secundaria="' + p.secundaria + '" title="' + p.nome + '" aria-label="' + p.nome + '">' +
          '<span style="background:' + p.principal + ';"></span><span style="background:' + p.secundaria + ';"></span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '<p class="vb-servico-novo-legenda">Ou escolha à mão:</p>' +
      '<div style="display:flex; gap:1.4rem; align-items:center; margin-bottom:0.4rem;">' +
      '<label style="display:flex; flex-direction:column; align-items:center; gap:0.35rem; font-size:0.75rem; color:var(--ink-soft,#7a7368);">Principal' +
      '<span class="admin-cor-swatch" style="width:44px; height:44px;"><input type="color" id="vbTutCorPrincipal" value="' + corPrincipal + '"></span>' +
      '</label>' +
      '<label style="display:flex; flex-direction:column; align-items:center; gap:0.35rem; font-size:0.75rem; color:var(--ink-soft,#7a7368);">Secundária' +
      '<span class="admin-cor-swatch" style="width:44px; height:44px;"><input type="color" id="vbTutCorSecundaria" value="' + corSecundaria + '"></span>' +
      '</label>' +
      '</div>';
    var inputPrincipal = document.getElementById('vbTutCorPrincipal');
    var inputSecundaria = document.getElementById('vbTutCorSecundaria');
    inputPrincipal.addEventListener('input', function () { aplicarCorDinamica(inputPrincipal.value, inputSecundaria.value); });
    inputSecundaria.addEventListener('input', function () { aplicarCorDinamica(inputPrincipal.value, inputSecundaria.value); });
    inputPrincipal.addEventListener('change', function () { salvarCor(inputPrincipal.value, inputSecundaria.value); });
    inputSecundaria.addEventListener('change', function () { salvarCor(inputPrincipal.value, inputSecundaria.value); });
    container.querySelectorAll('[data-paleta-principal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        salvarCor(btn.getAttribute('data-paleta-principal'), btn.getAttribute('data-paleta-secundaria'));
        mostrarPassoTutorial(passoCriacaoAtual);
      });
    });
    var seguirBtn = document.getElementById('vbTutSeguirFoto');
    if (seguirBtn) {
      seguirBtn.addEventListener('click', function () {
        var fotoAtual = (generoAtual === 'feminino' && linhaAtual.foto_hero_feminino_url) ? linhaAtual.foto_hero_feminino_url : linhaAtual.foto_hero_url;
        linhaAtual.seguir_cor_imagem = true;
        db.rpc('tenant_admin_alternar_seguir_cor_imagem', { p_estabelecimento_id: estabId, p_seguir: true });
        seguirCorDaImagem(fotoAtual);
        setTimeout(function () { mostrarPassoTutorial(passoCriacaoAtual); }, 200);
      });
    }
  }

  // ---- passo "serviços": mesma sugestão por nicho + campo manual do
  // painel "+Novo serviço" de sempre, só que já aberto aqui dentro —
  // precisa ter pelo menos 1 cadastrado pra continuar. ----
  function renderPassoTutorialServicos(container) {
    var sugestoes = (window.servicosSugeridosPara ? window.servicosSugeridosPara(linhaAtual.segmento) : []).filter(function (s) {
      return !servicosCache.some(function (existente) { return existente.nome === s.nome; });
    });
    container.innerHTML =
      (servicosCache.length ? '<ul class="vb-tutorial-lista">' + servicosCache.map(function (s) {
        return '<li>' + escapeHtml(s.nome) + ' · ' + formatarPreco(s.preco) +
          '<button type="button" class="vb-remover-x" data-remover-servico-tut="' + s.id + '" style="position:static; margin-left:0.5rem; display:inline-flex; align-items:center; justify-content:center; vertical-align:middle;">×</button></li>';
      }).join('') + '</ul>' : '') +
      (sugestoes.length ? '<p class="vb-servico-novo-legenda">Sugestões pro seu tipo de negócio (toque pra usar o nome, o preço você define agora):</p><div class="vb-servico-chips">' +
        sugestoes.map(function (s) {
          return '<button type="button" class="vb-servico-chip" data-chip-nome="' + escapeHtml(s.nome) + '">' + escapeHtml(s.nome) + '</button>';
        }).join('') + '</div>' : '') +
      '<p class="vb-servico-novo-legenda">Nome e preço do serviço:</p>' +
      '<div class="vb-servico-manual">' +
      '<input type="text" id="vbTutServicoNome" placeholder="Nome do serviço">' +
      '<input type="text" inputmode="decimal" id="vbTutServicoPreco" placeholder="Preço">' +
      '<button type="button" class="btn btn-primario" id="vbTutServicoSalvar">Adicionar</button>' +
      '</div>';

    function atualizarERenderizar() {
      db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
        servicosCache = res.data || [];
        carregarServicos();
        mostrarPassoTutorial(passoCriacaoAtual);
      });
    }
    function salvar(nome, preco) {
      if (!nome || !nome.trim()) return;
      db.rpc('tenant_admin_salvar_servico', { p_estabelecimento_id: estabId, p_id: null, p_nome: nome.trim(), p_preco: preco || 0, p_categoria: 'unissex' }).then(atualizarERenderizar);
    }
    // a sugestão só preenche o NOME — o preço é sempre digitado na hora
    // pelo dono (nenhum valor "chutado" entra sem ele decidir).
    container.querySelectorAll('[data-chip-nome]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var nomeInput = document.getElementById('vbTutServicoNome');
        var precoInput = document.getElementById('vbTutServicoPreco');
        nomeInput.value = chip.getAttribute('data-chip-nome');
        precoInput.focus();
      });
    });
    container.querySelectorAll('[data-remover-servico-tut]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        db.rpc('tenant_admin_remover_servico', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-servico-tut') }).then(atualizarERenderizar);
      });
    });
    document.getElementById('vbTutServicoSalvar').addEventListener('click', function () {
      var nome = document.getElementById('vbTutServicoNome').value;
      var preco = parseFloat(document.getElementById('vbTutServicoPreco').value.replace(',', '.')) || 0;
      salvar(nome, preco);
    });
  }

  // ---- passo "equipe": mesmo padrão do de serviços (campos de verdade,
  // não prompt()) — precisa ter pelo menos 1 profissional pra continuar. ----
  function renderPassoTutorialEquipe(container) {
    var especialidades = especialidadesSugeridasPara(linhaAtual.segmento);
    container.innerHTML =
      (equipeCache.length ? '<ul class="vb-tutorial-lista">' + equipeCache.map(function (p) {
        return '<li>' + escapeHtml(p.nome) + (p.especialidade ? ' · ' + escapeHtml(p.especialidade) : '') +
          '<button type="button" class="vb-remover-x" data-remover-membro-tut="' + p.id + '" style="position:static; margin-left:0.5rem; display:inline-flex; align-items:center; justify-content:center; vertical-align:middle;">×</button></li>';
      }).join('') + '</ul>' : '') +
      '<p class="vb-servico-novo-legenda">Especialidades comuns pro seu tipo de negócio (toque pra usar):</p><div class="vb-servico-chips">' +
      especialidades.map(function (e) {
        return '<button type="button" class="vb-servico-chip" data-chip-especialidade="' + escapeHtml(e) + '">' + escapeHtml(e) + '</button>';
      }).join('') + '</div>' +
      '<p class="vb-servico-novo-legenda">Nome e especialidade do profissional:</p>' +
      '<div class="vb-servico-manual">' +
      '<input type="text" id="vbTutMembroNome" placeholder="Nome">' +
      '<input type="text" id="vbTutMembroEspecialidade" placeholder="Especialidade">' +
      '<button type="button" class="btn btn-primario" id="vbTutMembroSalvar">Adicionar</button>' +
      '</div>';

    function atualizarERenderizar() {
      db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId }).then(function (res) {
        equipeCache = res.data || [];
        carregarEquipeAdmin();
        mostrarPassoTutorial(passoCriacaoAtual);
      });
    }
    container.querySelectorAll('[data-chip-especialidade]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.getElementById('vbTutMembroEspecialidade').value = chip.getAttribute('data-chip-especialidade');
        document.getElementById('vbTutMembroNome').focus();
      });
    });
    container.querySelectorAll('[data-remover-membro-tut]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        db.rpc('tenant_admin_remover_membro', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-membro-tut') }).then(atualizarERenderizar);
      });
    });
    document.getElementById('vbTutMembroSalvar').addEventListener('click', function () {
      var nome = document.getElementById('vbTutMembroNome').value;
      var especialidade = document.getElementById('vbTutMembroEspecialidade').value;
      if (!nome || !nome.trim()) return;
      db.rpc('tenant_admin_salvar_membro', { p_estabelecimento_id: estabId, p_id: null, p_nome: nome.trim(), p_especialidade: (especialidade || '').trim(), p_foto_url: null }).then(atualizarERenderizar);
    });
  }

  // ---- passo "localização": endereço obrigatório (aparece no rodapé e
  // vira o link do mapa) — geocodifica em segundo plano, sem travar o
  // avanço caso o serviço de mapa demore ou falhe. ----
  function mapaEmbedHtml(lat, lng) {
    var d = 0.006; // ~600m de folga ao redor do ponto, pra dar contexto sem afastar demais
    var bbox = (lng - d) + ',' + (lat - d) + ',' + (lng + d) + ',' + (lat + d);
    var src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&marker=' + lat + ',' + lng + '&layer=mapnik';
    return '<iframe src="' + src + '" style="width:100%; height:150px; border:0; border-radius:10px; margin-top:0.6rem;" loading="lazy" title="Mapa do endereço"></iframe>';
  }

  function renderPassoTutorialLocalizacao(container) {
    var temCoord = linhaAtual.endereco_lat != null && linhaAtual.endereco_lng != null;
    container.innerHTML =
      '<input type="text" id="vbTutEndereco" placeholder="Rua, número — bairro, cidade" style="width:100%; box-sizing:border-box; padding:0.65rem 0.8rem; border-radius:10px; border:1px solid rgba(0,0,0,0.15); font-family:inherit; font-size:16px;" value="' + escapeHtml(linhaAtual.endereco || '') + '">' +
      '<p class="msg" id="vbTutEnderecoMsg" style="margin-top:0.5rem;">' + (temCoord ? '✓ Encontramos esse endereço no mapa.' : '') + '</p>' +
      '<div id="vbTutEnderecoMapa">' + (temCoord ? mapaEmbedHtml(linhaAtual.endereco_lat, linhaAtual.endereco_lng) : '') + '</div>';
    var input = document.getElementById('vbTutEndereco');
    var salvarPendente = null;
    input.addEventListener('input', function () {
      clearTimeout(salvarPendente);
      salvarPendente = setTimeout(function () {
        var endereco = input.value.trim();
        linhaAtual.endereco = endereco;
        linhaAtual.endereco_lat = null;
        linhaAtual.endereco_lng = null;
        atualizarMapaLink();
        document.getElementById('tplEnderecoRodape').textContent = endereco || 'Endereço não informado';
        atualizarBotaoProximoTutorial();
        var mapaEl = document.getElementById('vbTutEnderecoMapa');
        if (mapaEl) mapaEl.innerHTML = '';
        db.rpc('tenant_admin_atualizar_endereco', { p_estabelecimento_id: estabId, p_endereco: endereco, p_lat: null, p_lng: null });
        var msgEl = document.getElementById('vbTutEnderecoMsg');
        if (!endereco) {
          if (msgEl) msgEl.textContent = '';
          return;
        }
        if (msgEl) { msgEl.className = 'msg'; msgEl.textContent = 'Localizando no mapa…'; }
        geocodificarEndereco(endereco, linhaAtual.cidade).then(function (coord) {
          // o dono pode já ter avançado pro próximo passo antes do mapa
          // responder — a caixa desse passo nem existe mais nesse caso.
          var msgAtual = document.getElementById('vbTutEnderecoMsg');
          var mapaAtual = document.getElementById('vbTutEnderecoMapa');
          if (!coord) {
            if (msgAtual) { msgAtual.className = 'msg msg-erro'; msgAtual.textContent = 'Não achamos esse endereço no mapa — confira se tem rua, número, bairro e cidade completos. O texto continua salvo do jeito que você digitou.'; }
            return;
          }
          linhaAtual.endereco_lat = coord.lat;
          linhaAtual.endereco_lng = coord.lng;
          atualizarMapaLink();
          if (msgAtual) { msgAtual.className = 'msg msg-ok'; msgAtual.textContent = '✓ Encontramos esse endereço no mapa.'; }
          if (mapaAtual) mapaAtual.innerHTML = mapaEmbedHtml(coord.lat, coord.lng);
          db.rpc('tenant_admin_atualizar_endereco', { p_estabelecimento_id: estabId, p_endereco: endereco, p_lat: coord.lat, p_lng: coord.lng });
        });
      }, 500);
    });
  }

  // ---- passo "redes sociais": opcional, mas com um selo deixando claro
  // que vale a pena preencher (não é obrigatório, mas também não é só
  // enfeite) — mesmo prompt de link de sempre, só que embutido aqui. ----
  function renderPassoTutorialRedes(container) {
    container.innerHTML =
      '<p class="vb-tutorial-selo-recomendado">★ Recomendado</p>' +
      '<div class="vb-tutorial-redes" id="vbTutRedes"></div>';
    var alvo = document.getElementById('vbTutRedes');
    var linksVisiveis = REDES.filter(function (r) { return r.chave !== 'whatsapp'; });
    function render() {
      alvo.innerHTML = linksVisiveis.map(function (r) {
        var vazio = !linhaAtual[r.chave];
        return '<button type="button" class="social-badge" data-rede-tut="' + r.chave + '" title="' + r.label + '" style="' + (vazio ? 'opacity:0.4;' : '') + '">' + r.icone + '</button>';
      }).join('');
      alvo.querySelectorAll('[data-rede-tut]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var chave = btn.getAttribute('data-rede-tut');
          var atual = linhaAtual[chave] || '';
          window.VBDialogo.prompt('Link do ' + btn.getAttribute('title') + ' (deixe vazio pra remover):', atual).then(function (novo) {
            if (novo === null) return;
            novo = novo.trim() || null;
            linhaAtual[chave] = novo;
            db.rpc('tenant_admin_atualizar_redes', {
              p_estabelecimento_id: estabId,
              p_instagram_url: linhaAtual.instagram_url,
              p_facebook_url: linhaAtual.facebook_url,
              p_tiktok_url: linhaAtual.tiktok_url
            }).then(function () { carregarRedesSociais(); render(); });
          });
        });
      });
    }
    render();
  }

  // ---- passo "galeria": botão de enviar fotos direto aqui — continua
  // opcional, mas com o mesmo selo de "vale a pena" do passo de redes. ----
  function renderPassoTutorialGaleria(container) {
    container.innerHTML =
      '<p class="vb-tutorial-selo-recomendado">★ Recomendado</p>' +
      '<div id="vbTutGaleriaGrid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:0.5rem; margin-bottom:0.7rem;"></div>' +
      '<label class="vb-btn-upload" style="width:100%; justify-content:center; box-sizing:border-box;"><span class="vb-btn-upload-icone">' + ICONE_CAMERA + '</span> Adicionar fotos<input type="file" id="vbTutGaleriaUpload" accept="image/*" multiple></label>' +
      '<p class="msg" id="vbTutGaleriaMsg" style="margin-top:0.5rem;"></p>';

    function renderGrid() {
      db.rpc('tenant_listar_galeria', { p_estabelecimento_id: estabId }).then(function (res) {
        var linhas = res.data || [];
        document.getElementById('vbTutGaleriaGrid').innerHTML = linhas.slice(0, 6).map(function (g) {
          return '<img src="' + escapeHtml(g.foto_url) + '" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px;">';
        }).join('');
      });
    }
    renderGrid();

    document.getElementById('vbTutGaleriaUpload').addEventListener('change', function (e) {
      var arquivos = Array.prototype.slice.call(e.target.files);
      if (!arquivos.length || !window.VBUpload) return;
      var msg = document.getElementById('vbTutGaleriaMsg');
      msg.textContent = 'Enviando…';
      Promise.all(arquivos.map(function (arquivo) {
        return window.VBUpload.uploadFoto(arquivo, estabId, 'galeria').then(function (url) {
          return db.rpc('tenant_admin_adicionar_foto', { p_estabelecimento_id: estabId, p_foto_url: url, p_staff_id: null });
        });
      })).then(function () {
        msg.textContent = '';
        renderGrid();
        carregarGaleria();
      });
    });
  }

  function desativarModoAdmin() {
    modoAdmin = false;
    document.body.classList.remove('vb-modo-admin');
    document.getElementById('adminModoBarra').classList.add('oculto');
    document.getElementById('tplHeadline').removeAttribute('contenteditable');
    document.getElementById('tplSubcopy').removeAttribute('contenteditable');
    document.getElementById('tplEnderecoRodape').removeAttribute('contenteditable');
    document.getElementById('tplNomeTopo').removeAttribute('contenteditable');
    document.getElementById('tplCtaTexto').removeAttribute('contenteditable');
    // reconfere se já tem serviço/equipe (pode ter completado agora) antes
    // de decidir se o portão "em preparação" volta a aparecer pra visita.
    db.rpc('buscar_estabelecimento', { p_slug: slug, p_cidade: cidade }).then(function (res) {
      var linha = res.data && res.data[0];
      if (linha) {
        linhaAtual.tem_servico = linha.tem_servico;
        linhaAtual.tem_equipe = linha.tem_equipe;
      }
      atualizarGateIncompleto();
    });
    carregarServicos();
    carregarEquipeAdmin();
    carregarGaleria();
    carregarRedesSociais();
  }

  // conta de verdade logada e dona deste estabelecimento? liga o modo
  // admin direto, sem PIN nenhum (a conta já é a prova de dono) — só
  // depois disso resolver é que dá pra saber se quem visita é o próprio
  // dono, então o contador de acessos espera esse resultado.
  function verificarSessaoDono() {
    db.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (session && linhaAtual && session.user.id === linhaAtual.dono_user_id) {
        ativarModoAdmin();
      }
      registrarAcessoSeNecessario();
    });
  }

  // acesso admin é só pela conta real (dono logado com Gmail/e-mail) — sem
  // PIN nenhum. Quem clica em "Admin" sem ser a conta dona é mandado pra
  // tela de login pra entrar com a conta certa. Toda a gestão do negócio
  // (caixa, agenda, clientes, dashboard) mudou pra cadastro.html — aqui
  // no site em si só sobrou o Modo Edição visual, então o gatilho sempre
  // manda pra lá.
  function iniciarModoAdmin() {
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('.vb-admin-trigger');
      if (!trigger) return;
      e.preventDefault();
      if (window.RafaelMenu) window.RafaelMenu.close();
      window.location.href = '/cadastro.html';
    });
    document.getElementById('adminSairBtn').addEventListener('click', function () {
      // "Sair" precisa encerrar a sessão de verdade — só esconder a
      // barra de admin (como era antes) deixava a conta logada por
      // baixo, e verificarSessaoDono() reativava o modo admin sozinho
      // na próxima visita a essa mesma aba/aparelho.
      db.auth.signOut().then(desativarModoAdmin, desativarModoAdmin);
    });
    var corInput = document.getElementById('adminCorInput');
    var corSecundariaInput = document.getElementById('adminCorSecundariaInput');
    corInput.addEventListener('input', function () { aplicarCorDinamica(corInput.value, corSecundariaInput.value); });
    corInput.addEventListener('change', function () { salvarCor(corInput.value, corSecundariaInput.value); });
    corSecundariaInput.addEventListener('input', function () { aplicarCorDinamica(corInput.value, corSecundariaInput.value); });
    corSecundariaInput.addEventListener('change', function () { salvarCor(corInput.value, corSecundariaInput.value); });

    document.getElementById('adminSeguirCorImagemBtn').addEventListener('click', alternarSeguirCorImagem);
    document.getElementById('adminWidgetsTranslucidosBtn').addEventListener('click', alternarWidgetsTranslucidos);
    document.getElementById('adminFotoCardBtn').addEventListener('click', abrirEditorFotoCard);
  }

  function aplicarGenero(g) {
    generoAtual = g;
    var femCss = document.getElementById('tplFeminino');
    femCss.disabled = (g !== 'feminino');

    var nome = linhaAtual.nome;
    document.getElementById('tplEyebrow').textContent = (SEGMENTOS[linhaAtual.segmento] || 'Estabelecimento') + ' · ' + linhaAtual.cidade;
    // frase de efeito por nicho, sorteada de forma estável a partir do
    // slug+cidade — o mesmo site sempre mostra a mesma frase, mas
    // dificilmente igual à de outro estabelecimento do mesmo segmento.
    var frase = window.fraseEfeitoPara ? window.fraseEfeitoPara(linhaAtual.segmento, (linhaAtual.slug || '') + linhaAtual.cidade) : COPY[g];
    document.getElementById('tplHeadline').textContent = linhaAtual.titulo_hero || frase.headline;
    document.getElementById('tplSubcopy').textContent = linhaAtual.subtitulo_hero || frase.sub;

    var fotoHero = (g === 'feminino' && linhaAtual.foto_hero_feminino_url) ? linhaAtual.foto_hero_feminino_url : linhaAtual.foto_hero_url;
    var heroFoto = document.getElementById('tplHeroFoto');
    heroFoto.style.backgroundColor = 'var(--linen-deep)';
    if (fotoHero) {
      heroFoto.style.backgroundImage = 'url("' + fotoHero + '")';
      heroFoto.style.backgroundSize = 'cover';
    } else {
      // o padrão boiserie é um ladrilho pequeno (72x72) pra repetir, não
      // uma foto — "cover" esticava ele até virar um único quadrado gigante.
      heroFoto.style.backgroundImage = 'url("' + boiseriePlaceholder(linhaAtual.cor_destaque) + '")';
      heroFoto.style.backgroundSize = '72px 72px';
    }

    var trocaBtn = document.getElementById('tplTrocaGenero');
    if (linhaAtual.genero_atendimento === 'ambos' && linhaAtual.segmento !== 'estetica_automotiva') {
      var outro = g === 'masculino' ? 'feminino' : 'masculino';
      document.getElementById('tplTrocaGlifo').textContent = outro === 'feminino' ? 'F' : 'M';
      document.getElementById('tplTrocaLabel').textContent = outro === 'feminino' ? 'Área feminina' : 'Área masculina';
      trocaBtn.classList.remove('oculto');
      trocaBtn.onclick = function (e) {
        e.preventDefault();
        try { sessionStorage.setItem(SESSION_KEY, outro); } catch (err) {}
        aplicarGenero(outro);
      };
    } else {
      trocaBtn.classList.add('oculto');
    }
  }

  function mostrarSplashSeNecessario() {
    var chave = 'vbSplashVisto_' + estabId;
    var jaViu = false;
    try { jaViu = sessionStorage.getItem(chave) === '1'; } catch (e) {}
    if (jaViu) return;
    try { sessionStorage.setItem(chave, '1'); } catch (e) {}
    var splash = document.getElementById('vbSplash');
    if (!splash) return;
    splash.classList.remove('oculto');
    setTimeout(function () { splash.classList.add('oculto'); }, 1500);
  }

  function iniciarGenero() {
    // estética automotiva não distingue público por gênero — o campo
    // genero_atendimento é gravado como 'ambos' só como valor técnico
    // padrão desde a criação (criar.js), mas aqui isso nunca deve abrir
    // o portão de escolha nem mostrar o botão de trocar de área.
    if (linhaAtual.segmento === 'estetica_automotiva') {
      document.getElementById('genderGate').remove();
      mostrarSplashSeNecessario();
      aplicarGenero('masculino');
      return;
    }
    if (linhaAtual.genero_atendimento !== 'ambos') {
      document.getElementById('genderGate').remove();
      mostrarSplashSeNecessario();
      aplicarGenero(linhaAtual.genero_atendimento);
      return;
    }
    var escolhaSalva = null;
    try { escolhaSalva = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
    if (escolhaSalva) {
      document.getElementById('genderGate').remove();
      aplicarGenero(escolhaSalva);
      return;
    }
    var gate = document.getElementById('genderGate');
    gate.classList.add('open');
    document.body.classList.add('scroll-locked');
    gate.querySelectorAll('[data-gender-escolha]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var escolha = btn.getAttribute('data-gender-escolha');
        try { sessionStorage.setItem(SESSION_KEY, escolha); } catch (e) {}
        document.body.classList.remove('scroll-locked');
        gate.remove();
        aplicarGenero(escolha);
      });
    });
  }

  // ---------- serviços, galeria, agenda ----------
  var ICONE_TESOURA = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="23" r="3.2"/><circle cx="9" cy="9" r="3.2"/><line x1="11.5" y1="11" x2="26" y2="23"/><line x1="11.5" y1="21" x2="26" y2="9"/></svg>';
  var ICONE_GALERIA_BADGE = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="9" height="9" rx="1.5"/><rect x="18" y="5" width="9" height="9" rx="1.5"/><rect x="5" y="18" width="9" height="9" rx="1.5"/><rect x="18" y="18" width="9" height="9" rx="1.5"/></svg>';
  var ICONE_AGENDA = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="9" width="20" height="16" rx="2"/><line x1="6" y1="14" x2="26" y2="14"/><line x1="11" y1="6" x2="11" y2="11"/><line x1="21" y1="6" x2="21" y2="11"/></svg>';

  // ---------- redes sociais (mesmo padrão em todas as réplicas) ----------
  var ICONE_WHATSAPP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c4.97 0 9-3.8 9-8.5S16.97 4 12 4s-9 3.8-9 8.5c0 1.7.5 3.2 1.4 4.5L3 21l4.3-1.3c1.3.8 2.9 1.3 4.7 1.3z"/><path d="M8.7 9.3c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .5.4l.6 1.5c.1.2 0 .4-.1.5l-.5.5c-.1.1-.2.3-.1.5.3.6 1.4 1.7 2 2 .2.1.4 0 .5-.1l.5-.5c.1-.1.3-.2.5-.1l1.5.6c.4.1.4.3.4.5v.5c0 .2 0 .4-.5.6-1.6.6-3.7-.5-5.1-1.9-1.4-1.4-2.5-3.5-1.9-5.1z" fill="currentColor" stroke="none"/></svg>';
  var ICONE_INSTAGRAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.3"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>';
  var ICONE_FACEBOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M14 8.5h-1.3c-.9 0-1.7.7-1.7 1.6v2h3l-.4 2.6h-2.6V19"/></svg>';
  var ICONE_TIKTOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.5a3.5 3.5 0 1 1-3-3.46"/><path d="M14 4c.3 2.2 1.8 3.8 4 4.2"/></svg>';

  var REDES = [
    { chave: 'whatsapp', label: 'WhatsApp', icone: ICONE_WHATSAPP },
    { chave: 'instagram_url', label: 'Instagram', icone: ICONE_INSTAGRAM },
    { chave: 'facebook_url', label: 'Facebook', icone: ICONE_FACEBOOK },
    { chave: 'tiktok_url', label: 'TikTok', icone: ICONE_TIKTOK }
  ];

  function carregarRedesSociais() {
    var strip = document.getElementById('tplRedesSociais');
    if (!strip) return;
    var linksVisiveis = REDES.filter(function (r) {
      if (r.chave === 'whatsapp') return !!linhaAtual.telefone_whatsapp;
      return modoAdmin || linhaAtual[r.chave];
    });
    strip.innerHTML = linksVisiveis.map(function (r) {
      var url = r.chave === 'whatsapp'
        ? 'https://wa.me/55' + linhaAtual.telefone_whatsapp.replace(/\D/g, '')
        : linhaAtual[r.chave];
      var vazio = r.chave !== 'whatsapp' && !url;
      var estiloVazio = vazio ? ' style="opacity:0.4;"' : '';
      if (modoAdmin && r.chave !== 'whatsapp') {
        return '<button type="button" class="social-badge" data-rede="' + r.chave + '" title="' + r.label + '"' + estiloVazio + '>' + r.icone + '</button>';
      }
      return '<a class="social-badge" href="' + escapeHtml(url) + '" target="_blank" rel="noopener" title="' + r.label + '">' + r.icone + '</a>';
    }).join('');

    if (!modoAdmin) return;
    strip.querySelectorAll('[data-rede]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var chave = btn.getAttribute('data-rede');
        var atual = linhaAtual[chave] || '';
        window.VBDialogo.prompt('Link do ' + btn.getAttribute('title') + ' (deixe vazio pra remover):', atual).then(function (novo) {
          if (novo === null) return;
          novo = novo.trim() || null;
          linhaAtual[chave] = novo;
          db.rpc('tenant_admin_atualizar_redes', {
            p_estabelecimento_id: estabId,
            p_instagram_url: linhaAtual.instagram_url,
            p_facebook_url: linhaAtual.facebook_url,
            p_tiktok_url: linhaAtual.tiktok_url
          }).then(carregarRedesSociais);
        });
      });
    });
  }

  var servicosCache = [];

  // ícone de linha por nicho — mesmo estilo/traço dos ícones do catálogo e
  // do seletor de segmento em criar.js, pra ficar visualmente consistente
  // em todo o app (nada de foto real aqui: é tudo gerado por código, então
  // funciona pra qualquer estabelecimento sem precisar subir imagem).
  var ICONES_SEGMENTO = {
    barbearia: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8.1" y1="7.5" x2="20" y2="19"/><line x1="8.1" y1="16.5" x2="20" y2="5"/></svg>',
    salao: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 18c2-4 2-8 0-12"/><path d="M9 18c2-4 2-8 0-12"/><path d="M14 18c2-4 2-8 0-12"/><path d="M19 18c2-4 2-8 0-12"/></svg>',
    manicure_pedicure: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2h6v3l1.5 2v13a1 1 0 01-1 1h-7a1 1 0 01-1-1V7L9 5V2z"/><path d="M9 2h6"/></svg>',
    estetica: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M12 2L14.3 7.7L20 10L14.3 12.3L12 18L9.7 12.3L4 10L9.7 7.7z"/></svg>',
    estetica_automotiva: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12l1.5-4.5A2 2 0 0 1 6.4 6h11.2a2 2 0 0 1 1.9 1.5L21 12"/><path d="M3 12h18v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4z"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></svg>',
    outro: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1-5h16l1 5"/><path d="M3 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0"/><path d="M5 9v10h14V9"/><path d="M9 19v-6h6v6"/></svg>'
  };
  // alguns nomes de serviço são tão comuns entre nichos diferentes que dá
  // pra acertar um ícone mais específico só pelo texto (ex: "barba" tem
  // ícone próprio mesmo dentro de um salão unissex) — quando nada bate,
  // cai no ícone padrão do segmento do estabelecimento.
  var ICONES_SERVICO_PALAVRA = [
    { chave: /barba/i, icone: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v6c0 5 3 9 6 9s6-4 6-9V4"/><path d="M9 4v5"/><path d="M15 4v5"/></svg>' },
    { chave: /unha|esmalt/i, icone: ICONES_SEGMENTO.manicure_pedicure },
    { chave: /sobrancelha|design de olhar/i, icone: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 15c2-5 6-7 9-7s7 2 9 7"/></svg>' },
    { chave: /massagem|relax/i, icone: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="2.2"/><path d="M6 21c0-4 2-6 2-9M18 21c0-4-2-6-2-9M8 12h8"/></svg>' },
    { chave: /lavagem|higieniza/i, icone: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2s6 7 6 12a6 6 0 1 1-12 0c0-5 6-12 6-12z"/></svg>' },
    { chave: /polimento|cera|brilho/i, icone: ICONES_SEGMENTO.estetica },
    { chave: /corte|cabelo/i, icone: ICONE_TESOURA }
  ];
  function iconeParaServico(nome) {
    for (var i = 0; i < ICONES_SERVICO_PALAVRA.length; i++) {
      if (ICONES_SERVICO_PALAVRA[i].chave.test(nome || '')) return ICONES_SERVICO_PALAVRA[i].icone;
    }
    return ICONES_SEGMENTO[linhaAtual.segmento] || ICONES_SEGMENTO.outro;
  }
  // gradiente do botão redondo: sempre a partir da cor do site (a mesma
  // que o dono escolheu no wizard), alternando um tom mais claro/mais
  // escuro a cada botão pra não ficar tudo idêntico.
  function corBotaoRedondo(indice) {
    var base = garantirContraste(hexParaRgbNums(linhaAtual.cor_destaque || '#C9A227'));
    var alvo = (indice % 2 === 0) ? [0, 0, 0] : [255, 255, 255];
    var quantidade = (indice % 2 === 0) ? 0.22 : 0.16;
    var ponta = misturarRgb(base, alvo, quantidade);
    return 'linear-gradient(135deg, ' + rgbParaHex(base) + ', ' + rgbParaHex(ponta) + ')';
  }

  function carregarServicos() {
    var lista = document.getElementById('tplListaServicos');
    var strip = document.getElementById('tplServiceStrip');
    // pizzaria (cardápio/Galeria) não usa agendamento com profissional —
    // esconde a seção de Serviços inteira em vez de mostrar "em breve"
    // pra sempre num nicho que nunca vai ter serviço cadastrado.
    if (linhaAtual.segmento === 'pizzaria') {
      var secaoServicos = document.getElementById('servicosSecao');
      if (secaoServicos) secaoServicos.classList.add('oculto');
      strip.innerHTML =
        '<button type="button" class="service-badge" onclick="document.getElementById(\'galeriaSecao\').scrollIntoView({behavior:\'smooth\'})"><span class="mark">' + ICONE_GALERIA_BADGE + '</span><strong>Ver</strong><span>Galeria</span></button>';
      return;
    }
    db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      servicosCache = linhas;
      strip.innerHTML =
        '<button type="button" class="service-badge" onclick="document.getElementById(\'servicosSecao\').scrollIntoView({behavior:\'smooth\'})"><span class="mark">' + ICONE_TESOURA + '</span><strong>Ver</strong><span>Serviços</span></button>' +
        '<button type="button" class="service-badge" data-open-widget><span class="mark">' + ICONE_AGENDA + '</span><strong>Agendar</strong><span>Horário</span></button>';

      if (!linhas.length && !modoAdmin) {
        lista.classList.remove('servicos-redondos-lista');
        lista.innerHTML = '<li style="border:none; color:var(--ink-soft);">Serviços em breve.</li>';
        return;
      }

      if (!modoAdmin) {
        lista.classList.add('servicos-redondos-lista');
        lista.innerHTML = linhas.map(function (s, i) {
          return '<li>' +
            '<button type="button" class="servico-redondo" data-open-widget-servico="' + escapeHtml(s.nome) + '" aria-label="Agendar ' + escapeHtml(s.nome) + '">' +
            '<span class="servico-redondo-icone" style="background:' + corBotaoRedondo(i) + '">' + iconeParaServico(s.nome) + '</span>' +
            '<span class="servico-redondo-nome">' + escapeHtml(s.nome) + '</span>' +
            '<span class="servico-redondo-preco">' + formatarPreco(s.preco) + '</span>' +
            '</button></li>';
        }).join('');
      } else {
        lista.classList.remove('servicos-redondos-lista');
        lista.innerHTML = linhas.map(function (s) {
          return '<li style="position:relative; padding-right:2.2rem;">' +
            '<span class="nome" contenteditable="true" data-servico-id="' + s.id + '" data-campo="nome" data-vb-editavel="servico">' + escapeHtml(s.nome) + '</span>' +
            '<span class="cidade" contenteditable="true" data-servico-id="' + s.id + '" data-campo="preco" data-vb-editavel="servico">' + Number(s.preco).toFixed(2).replace('.', ',') + '</span>' +
            '<button type="button" class="vb-remover-x" data-remover-servico="' + s.id + '">×</button>' +
            '</li>';
        }).join('') +
          '<li style="border:none; display:block;">' +
          '<button type="button" class="btn btn-ghost" id="vbAddServico" style="padding:0.4rem 0.8rem; font-size:0.82rem;">+ Novo serviço</button>' +
          '<div id="vbNovoServicoPainel" class="vb-servico-novo-painel oculto"></div>' +
          '</li>';

        lista.querySelectorAll('[data-servico-id]').forEach(function (el) {
          el.addEventListener('blur', function () {
            var novoNome = el.parentNode.querySelector('[data-campo="nome"]').textContent.trim();
            var novoPreco = parseFloat(el.parentNode.querySelector('[data-campo="preco"]').textContent.replace(',', '.')) || 0;
            db.rpc('tenant_admin_salvar_servico', {
              p_estabelecimento_id: estabId, p_id: el.getAttribute('data-servico-id'),
              p_nome: novoNome, p_preco: novoPreco, p_categoria: linhas.filter(function (s) { return s.id === el.getAttribute('data-servico-id'); })[0].categoria
            });
          });
        });
        lista.querySelectorAll('[data-remover-servico]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            db.rpc('tenant_admin_remover_servico', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-servico') }).then(carregarServicos);
          });
        });

        function salvarNovoServico(nome, preco) {
          if (!nome || !nome.trim()) return;
          db.rpc('tenant_admin_salvar_servico', { p_estabelecimento_id: estabId, p_id: null, p_nome: nome.trim(), p_preco: preco || 0, p_categoria: 'unissex' }).then(carregarServicos);
        }

        var addBtn = document.getElementById('vbAddServico');
        var painel = document.getElementById('vbNovoServicoPainel');
        if (addBtn) addBtn.addEventListener('click', function () {
          var abrindo = painel.classList.contains('oculto');
          if (!abrindo) { painel.classList.add('oculto'); return; }
          var sugestoes = window.servicosSugeridosPara ? window.servicosSugeridosPara(linhaAtual.segmento) : [];
          painel.innerHTML =
            (sugestoes.length ? '<p class="vb-servico-novo-legenda">Sugestões pro seu tipo de negócio (toque pra usar o nome, o preço você define agora):</p><div class="vb-servico-chips">' +
              sugestoes.map(function (s) {
                return '<button type="button" class="vb-servico-chip" data-chip-nome="' + escapeHtml(s.nome) + '">' + escapeHtml(s.nome) + '</button>';
              }).join('') + '</div>' : '') +
            '<p class="vb-servico-novo-legenda">Nome e preço do serviço:</p>' +
            '<div class="vb-servico-manual">' +
            '<input type="text" id="vbNovoServicoNome" placeholder="Nome do serviço">' +
            '<input type="text" inputmode="decimal" id="vbNovoServicoPreco" placeholder="Preço">' +
            '<button type="button" class="btn btn-primario" id="vbNovoServicoSalvar">Adicionar</button>' +
            '</div>';
          painel.classList.remove('oculto');
          painel.querySelectorAll('[data-chip-nome]').forEach(function (chip) {
            chip.addEventListener('click', function () {
              document.getElementById('vbNovoServicoNome').value = chip.getAttribute('data-chip-nome');
              document.getElementById('vbNovoServicoPreco').focus();
            });
          });
          document.getElementById('vbNovoServicoSalvar').addEventListener('click', function () {
            var nome = document.getElementById('vbNovoServicoNome').value;
            var preco = parseFloat(document.getElementById('vbNovoServicoPreco').value.replace(',', '.')) || 0;
            salvarNovoServico(nome, preco);
          });
        });
      }
    });
  }

  // ---- promoções ativas (público) — o dono cadastra no painel de
  // gestão (aba Comunidade); aqui só mostramos quem já tem promoção
  // vigente, escondendo a seção inteira quando não há nenhuma. ----
  function carregarPromocoesPublicas() {
    var secao = document.getElementById('promocoesSecao');
    var lista = document.getElementById('tplListaPromocoes');
    if (!secao || !lista) return;
    db.rpc('estabelecimento_promocoes_publicas', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      if (!linhas.length) { secao.classList.add('oculto'); return; }
      secao.classList.remove('oculto');
      lista.innerHTML = linhas.map(function (p) {
        return '<div class="promocao-card">' +
          (p.foto_url ? '<span class="promocao-card-foto" style="background-image:url(\'' + escapeHtml(p.foto_url) + '\')"></span>' : '') +
          '<span class="promocao-card-texto"><strong>' + escapeHtml(p.titulo) + '</strong>' + (p.texto ? '<br>' + escapeHtml(p.texto) : '') + '</span>' +
          '</div>';
      }).join('');
    }, function () { secao.classList.add('oculto'); });
  }

  // ---- Galeria pública (cardápio/catálogo) — categorias, itens, meio
  // a meio (regra oficial: cobra o valor da metade mais cara + borda) e
  // combos de faixa de preço fixa. O dono cadastra na aba Galeria do
  // painel de gestão; aqui só exibimos e montamos o link de pedido pelo
  // WhatsApp — sem carrinho persistente ainda. ----
  function carregarGaleriaPublica() {
    var secao = document.getElementById('galeriaSecao');
    var conteudo = document.getElementById('tplGaleriaConteudo');
    if (!secao || !conteudo) return;
    db.rpc('estabelecimento_cardapio_publico', { p_estabelecimento_id: estabId }).then(function (res) {
      var dados = res.data || {};
      var categorias = dados.categorias || [];
      var itens = dados.itens || [];
      var bordas = dados.bordas || [];
      var combos = dados.combos || [];
      if (!itens.length) { secao.classList.add('oculto'); return; }
      secao.classList.remove('oculto');

      var tel = (linhaAtual.telefone_whatsapp || '').replace(/\D/g, '');
      function linkPedido(descricaoLinha, total) {
        if (!tel) return null;
        var msg = 'Olá! Quero fazer um pedido:%0A' + encodeURIComponent('• ' + descricaoLinha) +
          '%0A' + encodeURIComponent('💰 Total: ' + formatarPreco(total));
        return 'https://wa.me/55' + tel + '?text=' + msg;
      }
      function opcoesBorda(idCompleto) {
        if (!bordas.length) return '';
        return '<select class="field-select-galeria" id="' + idCompleto + '"><option value="">Sem borda</option>' +
          bordas.map(function (b) { return '<option value="' + b.id + '">' + escapeHtml(b.nome) + ' (+' + formatarPreco(b.preco) + ')</option>'; }).join('') +
          '</select>';
      }
      function bordaPorId(id) { return bordas.filter(function (b) { return b.id === id; })[0] || null; }

      var htmlItens = '';
      var categoriasComItem = categorias.filter(function (c) {
        return itens.some(function (i) { return i.categoria_id === c.id; });
      });
      var semCategoria = itens.filter(function (i) { return !categorias.some(function (c) { return c.id === i.categoria_id; }); });
      var grupos = categoriasComItem.map(function (c) {
        return { nome: c.nome, lista: itens.filter(function (i) { return i.categoria_id === c.id; }) };
      });
      if (semCategoria.length) grupos.push({ nome: categorias.length ? 'Outros' : null, lista: semCategoria });

      htmlItens = grupos.map(function (g) {
        return (g.nome ? '<p class="galeria-categoria-titulo">' + escapeHtml(g.nome) + '</p>' : '') +
          '<div class="galeria-itens-grid">' + g.lista.map(function (it) {
            var idPrefixo = 'galItem' + it.id.replace(/-/g, '');
            return '<div class="galeria-item-card">' +
              (it.foto_url ? '<span class="galeria-item-foto" style="background-image:url(\'' + it.foto_url + '\')"></span>' : '') +
              '<span class="galeria-item-nome">' + escapeHtml(it.nome) + '</span>' +
              (it.descricao ? '<span class="galeria-item-descricao">' + escapeHtml(it.descricao) + '</span>' : '') +
              '<span class="galeria-item-preco">' + formatarPreco(it.preco) + '</span>' +
              (bordas.length ? opcoesBorda(idPrefixo + 'Borda') : '') +
              '<a class="btn btn-primario galeria-item-pedir" data-pedir-item="' + it.id + '" data-prefixo="' + idPrefixo + '" href="#" target="_blank" rel="noopener">Pedir pelo WhatsApp</a>' +
              '</div>';
          }).join('') + '</div>';
      }).join('');

      var itensMeio = itens.filter(function (i) { return i.permite_meio_a_meio; });
      var htmlMeio = '';
      if (itensMeio.length >= 2) {
        var opcoesSabor = itensMeio.map(function (i) { return '<option value="' + i.id + '">' + escapeHtml(i.nome) + ' — ' + formatarPreco(i.preco) + '</option>'; }).join('');
        htmlMeio =
          '<p class="galeria-categoria-titulo">Monte seu meio a meio</p>' +
          '<div class="galeria-meio-card">' +
          '<label>1ª metade<select id="galMeioA">' + opcoesSabor + '</select></label>' +
          '<label>2ª metade<select id="galMeioB">' + opcoesSabor + '</select></label>' +
          (bordas.length ? '<label>Borda' + opcoesBorda('galMeioBordaSelect') + '</label>' : '') +
          '<p class="galeria-meio-total">Total: <strong id="galMeioTotal">' + formatarPreco(itensMeio[0].preco) + '</strong></p>' +
          '<a class="btn btn-primario galeria-item-pedir" id="galMeioPedir" href="#" target="_blank" rel="noopener">Pedir pelo WhatsApp</a>' +
          '</div>';
      }

      var htmlCombos = '';
      if (combos.length) {
        htmlCombos = '<p class="galeria-categoria-titulo">Combos</p>' + combos.map(function (co) {
          var elegiveis = (co.item_ids || []).map(function (id) { return itens.filter(function (i) { return i.id === id; })[0]; }).filter(Boolean);
          if (elegiveis.length < 2) return '';
          var opcoes = elegiveis.map(function (i) { return '<option value="' + i.id + '">' + escapeHtml(i.nome) + '</option>'; }).join('');
          return '<div class="galeria-combo-card">' +
            '<p class="galeria-combo-titulo">' + escapeHtml(co.titulo) + ' · ' + formatarPreco(co.preco) + '</p>' +
            '<label>1º sabor<select class="gal-combo-s1" data-combo="' + co.id + '">' + opcoes + '</select></label>' +
            '<label>2º sabor<select class="gal-combo-s2" data-combo="' + co.id + '">' + opcoes + '</select></label>' +
            '<a class="btn btn-primario galeria-item-pedir" data-pedir-combo="' + co.id + '" href="#" target="_blank" rel="noopener">Pedir pelo WhatsApp</a>' +
            '</div>';
        }).join('');
      }

      conteudo.innerHTML = htmlItens + htmlMeio + htmlCombos;
      if (window.VBSelect) window.VBSelect.enhanceTodos(conteudo);

      // pedido de item avulso (com borda opcional)
      conteudo.querySelectorAll('[data-pedir-item]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var it = itens.filter(function (i) { return i.id === a.getAttribute('data-pedir-item'); })[0];
          if (!it) return;
          var prefixo = a.getAttribute('data-prefixo');
          var bordaSel = document.getElementById(prefixo + 'Borda');
          var borda = bordaSel ? bordaPorId(bordaSel.value) : null;
          var total = it.preco + (borda ? borda.preco : 0);
          var descricao = it.nome + (borda ? ' (Borda: ' + borda.nome + ')' : '');
          var link = linkPedido(descricao, total);
          if (!link) { e.preventDefault(); window.VBDialogo.alert('Esse estabelecimento ainda não configurou o WhatsApp.'); return; }
          a.href = link;
        });
      });

      // monte seu meio a meio
      var selA = document.getElementById('galMeioA'), selB = document.getElementById('galMeioB');
      var bordaMeioSel = document.getElementById('galMeioBordaSelect');
      var totalMeioEl = document.getElementById('galMeioTotal');
      var pedirMeioBtn = document.getElementById('galMeioPedir');
      function atualizarTotalMeio() {
        if (!selA || !selB) return;
        var itA = itens.filter(function (i) { return i.id === selA.value; })[0];
        var itB = itens.filter(function (i) { return i.id === selB.value; })[0];
        var borda = bordaMeioSel ? bordaPorId(bordaMeioSel.value) : null;
        var total = Math.max(itA ? itA.preco : 0, itB ? itB.preco : 0) + (borda ? borda.preco : 0);
        if (totalMeioEl) totalMeioEl.textContent = formatarPreco(total);
        return { itA: itA, itB: itB, borda: borda, total: total };
      }
      if (selA) { selA.addEventListener('change', atualizarTotalMeio); selB.addEventListener('change', atualizarTotalMeio); if (bordaMeioSel) bordaMeioSel.addEventListener('change', atualizarTotalMeio); atualizarTotalMeio(); }
      if (pedirMeioBtn) pedirMeioBtn.addEventListener('click', function (e) {
        var estado = atualizarTotalMeio();
        if (!estado || !estado.itA || !estado.itB || estado.itA.id === estado.itB.id) {
          e.preventDefault();
          window.VBDialogo.alert('Escolha 2 sabores diferentes.');
          return;
        }
        var descricao = 'Meio a meio: ' + estado.itA.nome + ' / ' + estado.itB.nome + (estado.borda ? ' (Borda: ' + estado.borda.nome + ')' : '');
        var link = linkPedido(descricao, estado.total);
        if (!link) { e.preventDefault(); window.VBDialogo.alert('Esse estabelecimento ainda não configurou o WhatsApp.'); return; }
        pedirMeioBtn.href = link;
      });

      // combos
      conteudo.querySelectorAll('[data-pedir-combo]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var comboId = a.getAttribute('data-pedir-combo');
          var combo = combos.filter(function (c) { return c.id === comboId; })[0];
          var s1 = conteudo.querySelector('.gal-combo-s1[data-combo="' + comboId + '"]');
          var s2 = conteudo.querySelector('.gal-combo-s2[data-combo="' + comboId + '"]');
          if (!combo || !s1 || !s2) return;
          if (s1.value === s2.value) { e.preventDefault(); window.VBDialogo.alert('Escolha 2 sabores diferentes — o combo é uma unidade de cada.'); return; }
          var it1 = itens.filter(function (i) { return i.id === s1.value; })[0];
          var it2 = itens.filter(function (i) { return i.id === s2.value; })[0];
          var descricao = combo.titulo + ' — ' + (it1 ? it1.nome : '') + ' + ' + (it2 ? it2.nome : '');
          var link = linkPedido(descricao, combo.preco);
          if (!link) { e.preventDefault(); window.VBDialogo.alert('Esse estabelecimento ainda não configurou o WhatsApp.'); return; }
          a.href = link;
        });
      });
    }, function () { secao.classList.add('oculto'); });
  }

  // ---- equipe (aparece só pro admin nesta página — o público vê a
  // equipe no site institucional, mas o dono gerencia direto por aqui) ----
  var equipeCache = [];
  function carregarEquipeAdmin() {
    if (!modoAdmin) return;
    var secao = document.getElementById('equipeSecaoAdmin');
    var lista = document.getElementById('tplListaEquipeAdmin');
    if (!secao || !lista) return;
    secao.classList.remove('oculto');
    db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      equipeCache = linhas;
      lista.innerHTML = linhas.map(function (p) {
        var avatarConteudo = p.foto_url
          ? '<span style="width:100%; height:100%; display:block; background-size:cover; background-position:center; background-image:url(\'' + escapeHtml(p.foto_url) + '\');"></span>'
          : escapeHtml((p.nome || '?')[0].toUpperCase());
        return '<li style="position:relative; padding-right:2.2rem;">' +
          '<div style="display:flex; align-items:center; gap:0.6rem;">' +
          '<button type="button" class="vb-membro-avatar-btn" data-editar-foto-membro="' + p.id + '" title="Trocar foto" style="flex-shrink:0; width:38px; height:38px; border-radius:50%; overflow:hidden; border:1px solid rgba(0,0,0,0.15); background:var(--linho,#f2ede2); display:flex; align-items:center; justify-content:center; font-weight:700; cursor:pointer; padding:0;">' + avatarConteudo + '</button>' +
          '<div style="flex:1; min-width:0;">' +
          '<span class="nome" contenteditable="true" data-membro-id="' + p.id + '" data-campo="nome" data-vb-editavel="membro">' + escapeHtml(p.nome) + '</span>' +
          '<span class="cidade" contenteditable="true" data-membro-id="' + p.id + '" data-campo="especialidade" data-vb-editavel="membro">' + escapeHtml(p.especialidade || 'Especialidade') + '</span>' +
          '</div></div>' +
          '<button type="button" class="vb-remover-x" data-remover-membro="' + p.id + '">×</button>' +
          '<div class="vb-servico-novo-painel oculto" id="vbFotoMembroPainel-' + p.id + '" style="margin-top:0.6rem;"></div>' +
          '</li>';
      }).join('') +
        '<li style="border:none; display:block;">' +
        '<button type="button" class="btn btn-ghost" id="vbAddMembro" style="padding:0.4rem 0.8rem; font-size:0.82rem;">+ Novo profissional</button>' +
        '<div id="vbNovoMembroPainel" class="vb-servico-novo-painel oculto"></div>' +
        '</li>';

      function membroAtual(id) {
        return equipeCache.filter(function (m) { return m.id === id; })[0] || {};
      }

      lista.querySelectorAll('[data-membro-id]').forEach(function (el) {
        el.addEventListener('blur', function () {
          var item = el.closest('li');
          var membroId = el.getAttribute('data-membro-id');
          var novoNome = item.querySelector('[data-campo="nome"]').textContent.trim();
          var novaEspecialidade = item.querySelector('[data-campo="especialidade"]').textContent.trim();
          // manda a foto atual de volta (do cache) — sem isso, toda edição
          // de texto apagava a foto, porque a RPC sempre substitui o
          // foto_url pelo que for enviado, mesmo que seja nulo.
          db.rpc('tenant_admin_salvar_membro', {
            p_estabelecimento_id: estabId, p_id: membroId,
            p_nome: novoNome, p_especialidade: novaEspecialidade, p_foto_url: membroAtual(membroId).foto_url || null
          });
        });
      });
      lista.querySelectorAll('[data-remover-membro]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          db.rpc('tenant_admin_remover_membro', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-membro') }).then(carregarEquipeAdmin);
        });
      });

      function salvarFotoMembro(membroId, url) {
        var m = membroAtual(membroId);
        db.rpc('tenant_admin_salvar_membro', {
          p_estabelecimento_id: estabId, p_id: membroId,
          p_nome: m.nome, p_especialidade: m.especialidade || '', p_foto_url: url
        }).then(carregarEquipeAdmin);
      }

      lista.querySelectorAll('[data-editar-foto-membro]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var membroId = btn.getAttribute('data-editar-foto-membro');
          var painel = document.getElementById('vbFotoMembroPainel-' + membroId);
          // fecha qualquer outro painel de foto aberto antes de abrir este
          lista.querySelectorAll('.vb-servico-novo-painel').forEach(function (p) { if (p !== painel) p.classList.add('oculto'); });
          var abrindo = painel.classList.contains('oculto');
          if (!abrindo) { painel.classList.add('oculto'); return; }
          var avatares = window.avataresParaSegmento ? window.avataresParaSegmento(linhaAtual.segmento) : [];
          painel.innerHTML =
            '<label class="vb-btn-upload" style="width:100%; justify-content:center; box-sizing:border-box; margin-bottom:0.6rem;"><span class="vb-btn-upload-icone">' + ICONE_CAMERA + '</span> Escolher foto do celular<input type="file" id="vbUploadFotoMembro-' + membroId + '" accept="image/*"></label>' +
            (avatares.length
              ? '<p class="vb-servico-novo-legenda">ou escolha um avatar pronto:</p><div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.5rem;">' +
                avatares.map(function (f) {
                  return '<img src="' + f.url + '" data-avatar-membro-url="' + f.url + '" title="' + f.legenda + '" style="width:100%; aspect-ratio:1; object-fit:contain; background:var(--linho,#f2ede2); border-radius:10px; cursor:pointer;">';
                }).join('') + '</div>'
              : '') +
            (membroAtual(membroId).foto_url ? '<button type="button" class="btn btn-ghost" id="vbRemoverFotoMembro" style="width:100%; margin-top:0.6rem;">Remover foto</button>' : '') +
            '<p class="msg" id="vbFotoMembroMsg-' + membroId + '" style="margin-top:0.4rem;"></p>';
          painel.classList.remove('oculto');
          var uploadEl = document.getElementById('vbUploadFotoMembro-' + membroId);
          uploadEl.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file || !window.VBUpload) return;
            var msg = document.getElementById('vbFotoMembroMsg-' + membroId);
            msg.textContent = 'Enviando…';
            window.VBUpload.uploadFoto(file, estabId, 'equipe').then(function (url) { salvarFotoMembro(membroId, url); }, function (err) {
              msg.className = 'msg msg-erro';
              msg.textContent = err.message || 'Falha ao enviar.';
            });
          });
          painel.querySelectorAll('[data-avatar-membro-url]').forEach(function (img) {
            img.addEventListener('click', function () { salvarFotoMembro(membroId, img.getAttribute('data-avatar-membro-url')); });
          });
          var removerBtn = document.getElementById('vbRemoverFotoMembro');
          if (removerBtn) removerBtn.addEventListener('click', function () { salvarFotoMembro(membroId, null); });
        });
      });

      function salvarNovoMembro(nome, especialidade) {
        if (!nome || !nome.trim()) return;
        db.rpc('tenant_admin_salvar_membro', { p_estabelecimento_id: estabId, p_id: null, p_nome: nome.trim(), p_especialidade: (especialidade || '').trim(), p_foto_url: null }).then(carregarEquipeAdmin);
      }

      var addBtn = document.getElementById('vbAddMembro');
      var painelMembro = document.getElementById('vbNovoMembroPainel');
      if (addBtn) addBtn.addEventListener('click', function () {
        var abrindo = painelMembro.classList.contains('oculto');
        if (!abrindo) { painelMembro.classList.add('oculto'); return; }
        painelMembro.innerHTML =
          '<p class="vb-servico-novo-legenda">Nome e especialidade do profissional:</p>' +
          '<div class="vb-servico-manual">' +
          '<input type="text" id="vbNovoMembroNome" placeholder="Nome">' +
          '<input type="text" id="vbNovoMembroEspecialidade" placeholder="Especialidade (ex: Cortes e barba)">' +
          '<button type="button" class="btn btn-primario" id="vbNovoMembroSalvar">Adicionar</button>' +
          '</div>';
        painelMembro.classList.remove('oculto');
        document.getElementById('vbNovoMembroSalvar').addEventListener('click', function () {
          salvarNovoMembro(document.getElementById('vbNovoMembroNome').value, document.getElementById('vbNovoMembroEspecialidade').value);
        });
      });
    });
  }

  // ---- telefone/WhatsApp editável inline (reaproveita a mesma RPC de
  // identidade — os outros campos ficam intactos porque ela só troca o
  // que vier preenchido) ----
  function ativarEdicaoTelefone() {
    [document.getElementById('tplTelefoneMenu'), document.getElementById('tplTelefoneRodape')].forEach(function (el) {
      if (!el || el.dataset.vbTelefoneLigado) return;
      el.dataset.vbTelefoneLigado = '1';
      el.addEventListener('click', function (e) {
        // o link do telefone continua visível/clicável pra todo mundo
        // (é assim que o cliente liga/manda WhatsApp) — sem essa
        // conferência, uma vez que esse escutador é ligado ele fica pra
        // sempre, e continuava abrindo a edição mesmo depois de "Sair".
        if (!modoAdmin) return;
        e.preventDefault();
        var atual = linhaAtual.telefone_whatsapp || '';
        window.VBDialogo.prompt('WhatsApp com DDD (ex: 15999999999):', atual).then(function (novo) {
          if (novo === null) return;
          novo = novo.trim();
          if (!novo || novo === atual) return;
          db.rpc('tenant_admin_atualizar_identidade', {
            p_estabelecimento_id: estabId, p_nome: null, p_slug: null, p_cidade: null, p_segmento: null, p_telefone_whatsapp: novo
          }).then(function (res) {
            if (res.error) return;
            linhaAtual.telefone_whatsapp = novo;
            var tel = novo.replace(/\D/g, '');
            [document.getElementById('tplTelefoneMenu'), document.getElementById('tplTelefoneRodape')].forEach(function (a) {
              a.style.display = '';
              a.href = 'tel:+55' + tel;
              a.textContent = novo;
            });
            carregarRedesSociais();
          });
        });
      });
    });
  }

  function carregarGaleria() {
    db.rpc('tenant_listar_galeria', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      if (!linhas.length && !modoAdmin) return;

      var grid = document.getElementById('tplGrid');
      var fotosHtml = linhas.slice(0, 9).map(function (g) {
        var remover = modoAdmin ? '<button type="button" class="vb-remover-x" data-remover-galeria="' + g.id + '">×</button>' : '';
        return '<div class="vb-foto-wrap"><img src="' + escapeHtml(g.foto_url) + '" alt="" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:6px;" loading="lazy">' + remover + '</div>';
      }).join('');
      grid.innerHTML = fotosHtml + (modoAdmin ? '<button type="button" class="vb-add-tile" id="vbAddFoto">+</button><input type="file" id="vbAddFotoInput" accept="image/*" multiple style="display:none;">' : '');
      document.getElementById('tplGaleriaSecao').classList.remove('oculto');

      if (!modoAdmin) return;
      grid.querySelectorAll('[data-remover-galeria]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          db.rpc('tenant_admin_remover_foto', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-galeria') }).then(carregarGaleria);
        });
      });
      document.getElementById('vbAddFoto').addEventListener('click', function () {
        document.getElementById('vbAddFotoInput').click();
      });
      document.getElementById('vbAddFotoInput').addEventListener('change', function (e) {
        var arquivos = Array.prototype.slice.call(e.target.files);
        if (!arquivos.length || !window.VBUpload) return;
        Promise.all(arquivos.map(function (arquivo) {
          return window.VBUpload.uploadFoto(arquivo, estabId, 'galeria').then(function (url) {
            return db.rpc('tenant_admin_adicionar_foto', { p_estabelecimento_id: estabId, p_foto_url: url, p_staff_id: null });
          });
        })).then(carregarGaleria);
      });
    });
  }

  // ---------- agenda em passo a passo (mesmo fluxo do Rafael, com dados
  // de verdade por estabelecimento e horários que respeitam quem já
  // marcou) ----------
  var WIZ_STORAGE_PREFIX = 'vbClienteContato_';
  var DIAS_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  function iniciarWizard() {
    var overlay = document.getElementById('wizardOverlay');
    if (!overlay) return;

    var closeBtn = document.getElementById('wizardClose');
    var backBtn = document.getElementById('wizardBack');
    var nextBtn = document.getElementById('wizardNext');
    var wizardNav = overlay.querySelector('.wizard-nav');
    var successEl = document.getElementById('wizardSuccess');
    var successCloseBtn = document.getElementById('wizardSuccessClose');
    var whatsappLink = document.getElementById('wizardWhatsappLink');
    var welcomeHint = document.getElementById('welcomeBackHint');
    var nomeInput = document.getElementById('wizNome');
    var telefoneInput = document.getElementById('wizTelefone');
    var profissionalList = overlay.querySelector('[data-group="profissional"]');
    var servicoGrid = overlay.querySelector('[data-group="servico"]');
    var diaRow = overlay.querySelector('[data-group="dia"]');
    var horarioGrid = overlay.querySelector('[data-group="horario"]');
    var steps = Array.prototype.slice.call(overlay.querySelectorAll('.wizard-step'));
    var dots = Array.prototype.slice.call(overlay.querySelectorAll('.wizard-steps-dots span'));
    var totalSteps = steps.length;
    var current = 1;
    var choices = {};
    var staffList = [];
    var diasDisponiveis = [];
    var lastFocused = null;

    function storageKey() { return WIZ_STORAGE_PREFIX + estabId; }

    function isoDate(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function carregarProfissionais() {
      db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId }).then(function (res) {
        staffList = res.data || [];
        if (!staffList.length) {
          profissionalList.innerHTML = '<button type="button" class="pick-card" data-value="Qualquer profissional">Qualquer profissional disponível</button>';
          return;
        }
        profissionalList.innerHTML = staffList.map(function (p) {
          return '<button type="button" class="pick-card" data-value="' + escapeHtml(p.nome) + '" data-staff-id="' + p.id + '">' +
            '<img src="' + (p.foto_url ? escapeHtml(p.foto_url) : '/assets/tpl-classico/img/placeholder-portrait.svg') + '" alt="">' +
            escapeHtml(p.nome) + (p.especialidade ? ' — ' + escapeHtml(p.especialidade) : '') +
            '</button>';
        }).join('');
      });
    }

    function carregarServicosWizard() {
      var genero = generoAtual;
      var lista = servicosCache.filter(function (s) { return s.categoria === genero || s.categoria === 'unissex'; });
      if (!lista.length) lista = servicosCache;
      servicoGrid.innerHTML = lista.map(function (s) {
        return '<button type="button" class="pick-btn' + (s.nome === choices.servico ? ' selected' : '') + '" data-value="' + escapeHtml(s.nome) + '">' + escapeHtml(s.nome) + '</button>';
      }).join('');
    }

    function gerarDiasUteis(n) {
      var dias = [];
      var hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      for (var i = 1; dias.length < n; i++) {
        var d = new Date(hoje);
        d.setDate(hoje.getDate() + i);
        dias.push(d);
      }
      return dias;
    }

    function renderDias() {
      diasDisponiveis = gerarDiasUteis(6);
      diaRow.innerHTML = diasDisponiveis.map(function (d) {
        var label = DIAS_ABREV[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
        return '<button type="button" class="day-btn" data-value="' + label + '" data-iso="' + isoDate(d) + '">' +
          DIAS_ABREV[d.getDay()] + '<br>' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '</button>';
      }).join('');
    }

    function renderHorarios(slots) {
      if (!slots || !slots.length) {
        horarioGrid.innerHTML = '<p style="grid-column:1/-1; color:var(--ink-soft); font-size:0.9rem;">Sem horários livres nesse dia.</p>';
        return;
      }
      horarioGrid.innerHTML = slots.map(function (s) {
        return '<button type="button" class="time-btn" data-value="' + s.horario + '"' + (s.disponivel ? '' : ' disabled style="opacity:.35;"') + '>' + s.horario + (s.disponivel ? '' : ' (ocupado)') + '</button>';
      }).join('');
    }

    function atualizarHorarios() {
      var diaBtn = diaRow.querySelector('.day-btn.selected');
      if (!diaBtn) return;
      var iso = diaBtn.getAttribute('data-iso');
      var profBtn = profissionalList.querySelector('.pick-card.selected');
      var staffId = profBtn ? profBtn.getAttribute('data-staff-id') : null;
      horarioGrid.innerHTML = '<p style="grid-column:1/-1; color:var(--ink-soft); font-size:0.9rem;">Carregando…</p>';
      db.rpc('tenant_public_agenda_slots', { p_estabelecimento_id: estabId, p_dia: iso, p_staff_id: staffId || null }).then(function (res) {
        renderHorarios(res.data || []);
      }, function () {
        renderHorarios([]);
      });
    }

    function isStepValid(step) {
      var stepEl = steps[step - 1];
      var requiredInputs = stepEl.querySelectorAll('.field-input[required]');
      if (requiredInputs.length) {
        return Array.prototype.every.call(requiredInputs, function (inp) { return inp.value.trim().length > 0; });
      }
      var group = stepEl.querySelector('[data-group]');
      if (!group) return true;
      return Boolean(choices[group.getAttribute('data-group')]);
    }

    function render() {
      steps.forEach(function (s) { s.classList.toggle('active', Number(s.dataset.step) === current); });
      dots.forEach(function (d) {
        var n = Number(d.dataset.dot);
        d.classList.toggle('active', n === current);
        d.classList.toggle('done', n < current);
      });
      nextBtn.textContent = current === totalSteps ? 'Confirmar' : 'Continuar';
      nextBtn.classList.toggle('is-disabled', !isStepValid(current));
      if (current === totalSteps) {
        document.getElementById('wizSummaryBox').innerHTML =
          'Nome: <strong>' + escapeHtml(choices.nome || '—') + '</strong><br>' +
          'Profissional: <strong>' + escapeHtml(choices.profissional || '—') + '</strong><br>' +
          'Serviço: <strong>' + escapeHtml(choices.servico || '—') + '</strong><br>' +
          'Dia: <strong>' + escapeHtml(choices.dia || '—') + '</strong><br>' +
          'Horário: <strong>' + escapeHtml(choices.horario || '—') + '</strong>';
      }
    }

    function selectChoice(groupName, value) {
      choices[groupName] = value;
      var group = overlay.querySelector('[data-group="' + groupName + '"]');
      if (group) {
        group.querySelectorAll('[data-value]').forEach(function (b) {
          b.classList.toggle('selected', b.getAttribute('data-value') === value);
        });
      }
      if (groupName === 'profissional' || groupName === 'dia') atualizarHorarios();
      render();
    }

    [profissionalList, servicoGrid, diaRow, horarioGrid].forEach(function (group) {
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-value]');
        if (!btn || btn.disabled) return;
        selectChoice(group.getAttribute('data-group'), btn.getAttribute('data-value'));
      });
    });

    function syncContato() {
      choices.nome = nomeInput.value.trim();
      choices.telefone = telefoneInput.value.trim();
    }
    ['input', 'change', 'blur'].forEach(function (evt) {
      nomeInput.addEventListener(evt, function () { syncContato(); render(); });
      telefoneInput.addEventListener(evt, function () { syncContato(); render(); });
    });

    function lockScroll() {
      document.body.classList.add('scroll-locked');
    }
    function unlockScroll() {
      document.body.classList.remove('scroll-locked');
    }

    function open(servicoPreSelecionado) {
      lastFocused = document.activeElement;
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      lockScroll();
      carregarProfissionais();
      renderDias();

      var saved = null;
      try {
        var raw = localStorage.getItem(storageKey());
        if (raw) saved = JSON.parse(raw);
      } catch (e) {}
      // sem histórico neste estabelecimento (primeira visita), mas já
      // logado com a conta global (telefone+nome)? usa esses dados —
      // só o serviço fica mesmo por preencher, o resto é automático.
      if (!saved && window.VBClienteGlobal) {
        var global = window.VBClienteGlobal.obter();
        if (global) saved = { nome: global.nome, telefone: global.telefone };
      }

      current = 1;
      choices = {};
      // veio de um botão redondo de serviço específico (clicado direto no
      // site)? já entra com o pedido decidido — só falta contato/horário.
      if (servicoPreSelecionado) choices.servico = servicoPreSelecionado;
      carregarServicosWizard();
      if (saved && saved.nome && saved.telefone) {
        choices.nome = saved.nome;
        choices.telefone = saved.telefone;
        nomeInput.value = saved.nome;
        telefoneInput.value = saved.telefone;
        welcomeHint.textContent = 'Bem-vindo de volta, ' + saved.nome.split(' ')[0] + '! Já preenchemos seus dados — é só conferir.';
        welcomeHint.style.display = '';
        db.rpc('tenant_registrar_cliente', { p_estabelecimento_id: estabId, p_nome: saved.nome, p_telefone: saved.telefone });
        current = 2;
      } else {
        welcomeHint.style.display = 'none';
        nomeInput.value = '';
        telefoneInput.value = '';
      }
      render();
      if (closeBtn) closeBtn.focus();
    }

    function mostrarSucesso(whatsappUrl) {
      whatsappLink.href = whatsappUrl;
      document.getElementById('wizSummarySuccessBox').innerHTML = document.getElementById('wizSummaryBox').innerHTML;
      steps.forEach(function (s) { s.classList.remove('active'); });
      wizardNav.style.display = 'none';
      successEl.style.display = '';
      overlay.scrollTop = 0;
      if (successCloseBtn) successCloseBtn.focus();
    }

    function close() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      unlockScroll();
      current = 1;
      choices = {};
      nextBtn.disabled = false;
      wizardNav.style.display = '';
      successEl.style.display = 'none';
      overlay.querySelectorAll('.selected').forEach(function (b) { b.classList.remove('selected'); });
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    if (successCloseBtn) successCloseBtn.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    backBtn.addEventListener('click', function () {
      if (current > 1) { current--; render(); overlay.scrollTop = 0; } else { close(); }
    });

    nextBtn.addEventListener('click', function () {
      syncContato();
      if (!isStepValid(current)) {
        var stepEl = steps[current - 1];
        var vazio = stepEl.querySelector('.field-input[required]');
        if (vazio) { if (vazio.reportValidity) vazio.reportValidity(); else vazio.focus(); }
        return;
      }

      var eraContato = current === 1;
      if (eraContato) {
        try { localStorage.setItem(storageKey(), JSON.stringify({ nome: choices.nome, telefone: choices.telefone })); } catch (e) {}
      }

      if (current < totalSteps) {
        current++;
        render();
        overlay.scrollTop = 0;
        if (eraContato) db.rpc('tenant_registrar_cliente', { p_estabelecimento_id: estabId, p_nome: choices.nome || '', p_telefone: choices.telefone || '' });
        return;
      }

      nextBtn.disabled = true;
      var diaBtn = diaRow.querySelector('.day-btn.selected');
      var profBtn = profissionalList.querySelector('.pick-card.selected');
      db.rpc('tenant_criar_agendamento', {
        p_estabelecimento_id: estabId,
        p_cliente_nome: choices.nome || '',
        p_cliente_telefone: choices.telefone || '',
        p_staff_id: profBtn ? profBtn.getAttribute('data-staff-id') : null,
        p_staff_nome: choices.profissional || null,
        p_servico: choices.servico || null,
        p_dia: diaBtn ? diaBtn.getAttribute('data-iso') : null,
        p_dia_label: choices.dia || null,
        p_horario: choices.horario || ''
      }).then(function (res) {
        nextBtn.disabled = false;
        if (res.error) {
          window.VBDialogo.alert(res.error.message);
          current = 4;
          render();
          atualizarHorarios();
          return;
        }
        var tel = (linhaAtual.telefone_whatsapp || '').replace(/\D/g, '');
        var msg = 'Olá! Quero agendar um horário:%0A' +
          '• Nome: ' + encodeURIComponent(choices.nome || '') + '%0A' +
          '• Profissional: ' + encodeURIComponent(choices.profissional || '') + '%0A' +
          '• Serviço: ' + encodeURIComponent(choices.servico || '') + '%0A' +
          '• Dia: ' + encodeURIComponent(choices.dia || '') + '%0A' +
          '• Horário: ' + encodeURIComponent(choices.horario || '');
        var url = tel ? ('https://wa.me/55' + tel + '?text=' + msg) : '#';
        mostrarSucesso(url);
      }, function () {
        nextBtn.disabled = false;
        window.VBDialogo.alert('Sem conexão agora — tenta de novo em instantes.');
      });
    });

    document.addEventListener('click', function (e) {
      if (modoAdmin && e.target.closest('[contenteditable="true"]')) return;
      var botaoServico = e.target.closest('[data-open-widget-servico]');
      if (botaoServico) {
        if (window.RafaelMenu) window.RafaelMenu.close();
        open(botaoServico.getAttribute('data-open-widget-servico'));
        return;
      }
      if (e.target.closest('[data-open-widget]')) {
        if (window.RafaelMenu) window.RafaelMenu.close();
        open();
      }
    });
  }

  function renderizar(linha) {
    carregando.classList.add('oculto');
    estabId = linha.id;
    linhaAtual = linha;
    aplicarTemplateCss(linha.template);
    aplicarCorDinamica(linha.cor_destaque, linha.cor_secundaria);
    var adminCorInput = document.getElementById('adminCorInput');
    if (adminCorInput) adminCorInput.value = linha.cor_destaque || '#C9A227';
    var adminCorSecundariaInput = document.getElementById('adminCorSecundariaInput');
    if (adminCorSecundariaInput) {
      adminCorSecundariaInput.value = linha.cor_secundaria || rgbParaHex(misturarRgb(hexParaRgbNums(linha.cor_destaque || '#C9A227'), [0, 0, 0], 0.28));
    }
    var adminSeguirCorImagemBtn = document.getElementById('adminSeguirCorImagemBtn');
    if (adminSeguirCorImagemBtn) adminSeguirCorImagemBtn.classList.toggle('is-ativo', !!linha.seguir_cor_imagem);
    aplicarWidgetsTranslucidos(linha.widgets_translucidos);
    var adminWidgetsTranslucidosBtn = document.getElementById('adminWidgetsTranslucidosBtn');
    if (adminWidgetsTranslucidosBtn) adminWidgetsTranslucidosBtn.classList.toggle('is-ativo', !!linha.widgets_translucidos);

    document.title = linha.nome + ' — VB Agenda';
    document.getElementById('tplNomeTopo').textContent = linha.nome;
    document.getElementById('tplNomeRodape').textContent = linha.nome;
    document.getElementById('tplCtaTexto').textContent = linha.texto_cta || (linha.segmento === 'pizzaria' ? 'Ver cardápio' : 'Agendar horário');
    // pizzaria não agenda com profissional — o botão principal do hero
    // (e qualquer outro atalho "Agendar horário" do site) leva direto
    // pra Galeria em vez de abrir o assistente de agendamento.
    if (linha.segmento === 'pizzaria') {
      document.querySelectorAll('[data-open-widget]').forEach(function (el) {
        el.removeAttribute('data-open-widget');
        el.addEventListener('click', function (e) {
          e.preventDefault();
          var secao = document.getElementById('galeriaSecao');
          if (secao) secao.scrollIntoView({ behavior: 'smooth' });
        });
      });
    }
    document.getElementById('tplCidadeRodape').textContent = linha.cidade.charAt(0).toUpperCase() + linha.cidade.slice(1) + '/SP';
    document.getElementById('tplEnderecoMenu').textContent = linha.cidade.charAt(0).toUpperCase() + linha.cidade.slice(1) + '/SP';
    document.getElementById('tplCopyright').textContent = '© ' + new Date().getFullYear() + ' ' + linha.nome + ' — todos os direitos reservados';

    if (linha.telefone_whatsapp) {
      var tel = linha.telefone_whatsapp.replace(/\D/g, '');
      ['tplTelefoneMenu', 'tplTelefoneRodape'].forEach(function (id) {
        var a = document.getElementById(id);
        a.href = 'tel:+55' + tel;
        a.textContent = linha.telefone_whatsapp;
      });
    } else {
      document.getElementById('tplTelefoneMenu').closest('p').style.display = 'none';
      document.getElementById('tplTelefoneRodape').style.display = 'none';
    }

    document.getElementById('tplEnderecoRodape').textContent = linha.endereco || 'Endereço não informado';
    atualizarMapaLink();
    carregarHorarioRodape();
    atualizarContadorPublico();
    var linkInst = document.getElementById('tplLinkInstitucional');
    if (linkInst) linkInst.href = '/' + encodeURIComponent(slug) + '/' + encodeURIComponent(cidade) + '/institucional';

    tpl.classList.remove('oculto');
    iniciarGenero();
    carregarServicos();
    carregarGaleria();
    carregarRedesSociais();
    carregarPromocoesPublicas();
    carregarGaleriaPublica();
    iniciarModoAdmin();
    iniciarWizard();
    iniciarClienteGlobal();
    verificarSessaoDono();

    // site incompleto (sem serviço ou sem equipe) pra quem visita? mostra
    // "em preparação" por cima de tudo (inclusive do gate de gênero, que
    // não faz sentido perguntar pra um site ainda vazio) — o conteúdo por
    // baixo continua sendo montado normal, então o admin edita tudo assim
    // que desbloqueia (linha acima já chama isso de novo).
    atualizarGateIncompleto();

    // veio de outra página do site (ex: institucional.html) com
    // #agendar na URL? abre a agenda direto.
    if (window.location.hash === '#agendar') {
      var gatilho = document.querySelector('[data-open-widget]');
      if (gatilho) gatilho.click();
    }
  }

  var chaveCachePerfil = 'perfil_' + slug + '_' + cidade;
  db.rpc('buscar_estabelecimento', { p_slug: slug, p_cidade: cidade }).then(function (res) {
    var linha = res.data && res.data[0];
    if (res.error || !linha) {
      mostrarNaoEncontrado();
      return;
    }
    if (window.VBCache) window.VBCache.salvar(chaveCachePerfil, linha);
    renderizar(linha);
  }, function () {
    var cache = window.VBCache ? window.VBCache.carregar(chaveCachePerfil) : null;
    if (cache && cache.dados) {
      mostrarAvisoOfflineTopo();
      renderizar(cache.dados);
      return;
    }
    mostrarNaoEncontrado();
  });
})();
