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
  // lista de estilos e pastas de CSS: assets/js/templates.js (VibeTemplates)
  var templateAtualParaCor = 'classico-boiserie';
  // a foto do topo é a mesma em Agendar, Pedir e Chamar: a principal (ou a
  // feminina, na área feminina) e, se não tiver, a capa — antes a Agenda
  // ignorava a capa e o mesmo negócio aparecia sem foto num lado e com
  // foto no outro
  function fotoPrincipal(g) {
    if (!linhaAtual) return null;
    return ((g || generoAtual) === 'feminino' && linhaAtual.foto_hero_feminino_url) || linhaAtual.foto_hero_url || linhaAtual.foto_capa_url || null;
  }
  // só beleza separa área masculina/feminina; borracharia, pet, comida etc. nunca
  var SEGMENTOS_COM_GENERO = ['barbearia', 'salao', 'manicure_pedicure', 'estetica', 'outro'];
  function separaPorGenero() {
    return !!linhaAtual && linhaAtual.genero_atendimento === 'ambos' && SEGMENTOS_COM_GENERO.indexOf(linhaAtual.segmento) > -1;
  }
  function aplicarTemplateCss(templateKey) {
    templateAtualParaCor = window.VibeTemplates.aplicar(templateKey).chave;
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
    if (window.VibeTemplates.usaTerracotta(templateAtualParaCor)) {
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
  // estilos "segue sua foto" usam a foto de capa (desfocada) como fundo
  function atualizarFundoDaFoto() {
    if (!linhaAtual || !window.VibeTemplates) return;
    var foto = fotoPrincipal();
    window.VibeTemplates.fundoDaFoto(window.VibeTemplates.segueFoto(templateAtualParaCor) ? foto : null);
  }

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
      var fotoAtual = fotoPrincipal();
      if (fotoAtual) seguirCorDaImagem(fotoAtual);
    }
  }

  // ---- trocar o estilo do site: folha embaixo com os prints; tocar
  // mostra ao vivo no próprio site, "Usar este" salva ----
  function aplicarEstiloAoVivo(chave) {
    aplicarTemplateCss(chave);
    aplicarCorDinamica(linhaAtual.cor_destaque, linhaAtual.cor_secundaria);
    atualizarFundoDaFoto();
  }
  function abrirGaleriaEstilos() {
    var T = window.VibeTemplates;
    if (!T || document.getElementById('vbEstilos')) return;
    var original = templateAtualParaCor;
    var escolhido = original;
    var folha = document.createElement('div');
    folha.id = 'vbEstilos';
    folha.className = 'vb-estilos';
    folha.setAttribute('role', 'dialog');
    folha.setAttribute('aria-label', 'Estilo do site');
    folha.innerHTML = '<div class="vb-estilos-topo"><strong>Estilo do site</strong><span>Toque pra ver no seu site</span></div>' +
      '<div class="vb-estilos-trilho">' + T.LISTA.map(function (t) {
        return '<button type="button" class="vb-estilos-item" data-estilo="' + t.chave + '" aria-pressed="false">' +
          '<img src="' + t.print + '" alt="" loading="lazy"><span>' + escapeHtml(t.nome) + (t.segueFoto ? '<em>segue sua foto</em>' : '') + '</span></button>';
      }).join('') + '</div>' +
      '<div class="vb-estilos-acoes"><button type="button" class="vb-estilos-cancelar">Cancelar</button><button type="button" class="vb-estilos-salvar">Usar este</button></div>';
    document.body.appendChild(folha);
    function marcar() {
      folha.querySelectorAll('[data-estilo]').forEach(function (b) {
        var on = b.getAttribute('data-estilo') === escolhido;
        b.classList.toggle('is-ativo', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }
    marcar();
    var atual = folha.querySelector('.is-ativo');
    if (atual && atual.scrollIntoView) atual.scrollIntoView({ inline: 'center', block: 'nearest' });
    function fechar() { folha.classList.add('saindo'); setTimeout(function () { folha.remove(); }, 250); }
    folha.addEventListener('click', function (e) {
      var item = e.target.closest('[data-estilo]');
      if (item) { escolhido = item.getAttribute('data-estilo'); marcar(); aplicarEstiloAoVivo(escolhido); return; }
      if (e.target.closest('.vb-estilos-cancelar')) { aplicarEstiloAoVivo(original); fechar(); return; }
      if (!e.target.closest('.vb-estilos-salvar')) return;
      var btn = e.target.closest('.vb-estilos-salvar');
      btn.disabled = true;
      btn.textContent = 'Salvando…';
      db.rpc('tenant_admin_atualizar_template', { p_estabelecimento_id: estabId, p_template: escolhido }).then(function (res) {
        if (res.error) throw res.error;
        linhaAtual.template = escolhido;
        // estilos "segue sua foto" ligam a cor tirada da foto
        if (T.segueFoto(escolhido) && !linhaAtual.seguir_cor_imagem) alternarSeguirCorImagem();
        if (window.VBSalvo) window.VBSalvo.mostrar('Estilo salvo');
        fechar();
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Usar este';
        if (window.VBDialogo) window.VBDialogo.alert('Não deu pra salvar o estilo: ' + ((err && err.message) || 'tenta de novo.'));
      });
    });
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

  // ---------- identidade do cliente no Vibe (login por WhatsApp) ----
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
      if (btn) {
        var eu = window.VBConta && window.VBConta.atual();
        var foto = eu && eu.telefone === cliente.telefone ? eu.foto : null;
        if (window.VBAvatar) btn.innerHTML = window.VBAvatar.html(cliente.nome, cliente.telefone, 'p', foto) + '<span></span>';
        else btn.textContent = '';
        var tx = btn.querySelector('span:last-child') || btn;
        tx.textContent = 'Olá, ' + primeiroNome(cliente.nome);
        btn.classList.add('com-foto');
      }
      if (saudacao) {
        saudacao.textContent = 'Bem-vindo, ' + cliente.nome;
        saudacao.classList.remove('oculto');
      }
      if (menuLoginTexto) menuLoginTexto.textContent = 'Sair (' + primeiroNome(cliente.nome) + ')';
    } else {
      if (btn) { btn.textContent = 'Entrar'; btn.classList.remove('com-foto'); }
      if (saudacao) saudacao.classList.add('oculto');
      if (menuLoginTexto) menuLoginTexto.textContent = 'Entrar';
    }
  }

  function registrarVisitaCliente(cliente) {
    if (!cliente || !estabId) return;
    // quem entrou com a senha fica na lista de clientes ("só acessou") até agendar ou pedir;
    // vale o token da sessão — ninguém consegue cadastrar nome falso de outra pessoa
    var tk = window.VBClienteGlobal && window.VBClienteGlobal.token();
    if (tk) db.rpc('tenant_registrar_acesso_cliente', { p_estabelecimento_id: estabId, p_token: tk });
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
    // a sessão salva ainda vale? (venceu ou a senha foi trocada noutro aparelho)
    if (clienteAtual && window.VBConta) window.VBConta.conferir().then(function (c) { if (!c) aplicarClienteGlobalNaTela(null); });

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
    // login do cliente: WhatsApp + senha de 6 números (cliente-conta.js);
    // "esqueci a senha" já oferece pedir o código pro WhatsApp deste negócio
    function abrirLoginCliente(depois) {
      fechar();
      if (!window.VBConta) return;
      window.VBConta.entrar({ negocio: { nome: linhaAtual && linhaAtual.nome, whatsapp: linhaAtual && linhaAtual.telefone_whatsapp } }).then(function (c) {
        if (!c) return;
        aplicarClienteGlobalNaTela(c);
        registrarVisitaCliente(c);
        if (typeof depois === 'function') depois(c);
      });
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
        window.VBDialogo.confirm('Sair da sua conta neste site?').then(function (ok) {
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
      if (!window.VBClienteGlobal.obter()) { abrirLoginCliente(function () { if (window.VBMeusAgendamentos) window.VBMeusAgendamentos.abrir(); }); return; }
      if (window.VBMeusAgendamentos) window.VBMeusAgendamentos.abrir();
    });
    var menuDadosBtn = document.getElementById('menuMeusDados');
    if (menuDadosBtn) menuDadosBtn.addEventListener('click', function () {
      if (window.RafaelMenu) window.RafaelMenu.close();
      var cliente = window.VBClienteGlobal.obter();
      if (!cliente) { abrirLoginCliente(); return; }
      window.VBConta.perfil().then(function (c) {
        if (!c) return;
        window.VBClienteGlobal.salvar(c.telefone, c.nome);
        aplicarClienteGlobalNaTela({ telefone: c.telefone, nome: c.nome });
        registrarVisitaCliente({ telefone: c.telefone, nome: c.nome });
      });
    });
  }

  if (!slug || !cidade) {
    carregando.classList.add('oculto');
    naoEncontrado.classList.remove('oculto');
    return;
  }

  function mostrarNaoEncontrado() {
    document.documentElement.classList.remove('site-carregando');
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
    // preço zero é de propósito (orçamento, retoque): mostra "Grátis"
    if (v !== null && v !== undefined && v !== '' && Number(v) === 0) return 'Grátis';
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }

  var SEGMENTOS = {
    barbearia: 'Barbearia',
    salao: 'Salão de beleza',
    manicure_pedicure: 'Manicure e pedicure',
    estetica: 'Estética',
    estetica_automotiva: 'Estética automotiva',
    tatuador: 'Estúdio de tatuagem',
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
      horariosCache = res.data || [];
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
  // o site nunca mais vira editor solto (texto/foto/lista clicável): o dono
  // edita pelo passo a passo. modoAdmin só libera os dados pros passos.
  var edicaoNoSite = false;
  var ESTOQUE_FOTOS_ADMIN = [
    { url: '/assets/tpl-classico/img/estoque/hero-masculino-1.jpg', legenda: 'Studio dourado' },
    { url: '/assets/tpl-classico/img/estoque/hero-feminino-1.jpg', legenda: 'Salão rosé' },
    { url: '/assets/estoque/geral/grafite.svg', legenda: 'Grafite' }
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
    tatuador: ['Fineline', 'Blackwork', 'Realismo', 'Old school', 'Aquarela', 'Lettering'],
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
    aplicarEfeitoTitulo(null, nome);
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
    var tituloEl = document.getElementById('tplHeadline');
    var titulo = (tituloEl.getAttribute('data-te-texto') != null ? tituloEl.getAttribute('data-te-texto') : tituloEl.textContent).trim();
    var subtitulo = document.getElementById('tplSubcopy').textContent.trim();
    linhaAtual.titulo_hero = titulo;
    linhaAtual.subtitulo_hero = subtitulo;
    db.rpc('tenant_admin_atualizar_texto', {
      p_estabelecimento_id: estabId,
      p_titulo_hero: titulo,
      p_subtitulo_hero: subtitulo
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
    // carregada de antemão (prerender) e ainda não aberta: só conta a visita quando abrir
    if (document.prerendering) { document.addEventListener('prerenderingchange', registrarAcessoSeNecessario, { once: true }); return; }
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


  // esconde o site de quem visita enquanto faltar serviço ou equipe
  // (ninguém deveria cair numa agenda vazia sem profissional/serviço pra
  // escolher) — o dono ainda enxerga tudo normal assim que entra no modo
  // admin, pra poder completar o cadastro.
  function atualizarGateIncompleto() {
    var gate = document.getElementById('incompletoGate');
    if (!gate || !linhaAtual) return;
    // a Agenda precisa de pelo menos um serviço e um profissional pra
    // agendar (cardápio e pedido agora são a área Delivery, em /pedir)
    var incompleto = !linhaAtual.tem_servico || !linhaAtual.tem_equipe;
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
    // edição só pelo passo a passo (criar/editar): o site em si não vira
    // mais um editor solto, com texto e foto clicáveis
    document.getElementById('adminModoBarra').classList.add('oculto');
    // o dono não deveria ficar travado atrás do gate de gênero (ainda sem
    // resposta) pra poder editar — resolve com o padrão e segue.
    var gate = document.getElementById('genderGate');
    if (gate && gate.classList.contains('open')) {
      gate.classList.remove('open');
      document.body.classList.remove('scroll-locked');
      aplicarGenero(generoAtual || 'masculino');
    }
    atualizarGateIncompleto();
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
      id: 'foto', titulo: 'Foto principal', capitulo: 'impressao', pergunta: 'Qual foto mostra melhor o seu negócio?',
      texto: 'É a primeira coisa que o cliente vê. Mande uma do celular ou toque numa pronta.',
      obrigatorio: true,
      aviso: 'Escolha uma foto pra continuar.',
      completo: function () { return !!fotoPrincipal(); },
      render: renderPassoTutorialFoto
    },
    {
      id: 'servicos', titulo: 'Serviços e preços', capitulo: 'oferta', pergunta: 'O que o cliente pode agendar?',
      texto: 'Toque numa sugestão ou escreva o seu — com preço e quanto tempo leva.',
      obrigatorio: true,
      aviso: 'Adicione pelo menos um serviço pra continuar.',
      completo: function () { return servicosCache && servicosCache.length > 0; },
      render: renderPassoTutorialServicos
    },
    {
      id: 'equipe', titulo: 'Quem atende', capitulo: 'oferta', pergunta: 'Quem atende os clientes?',
      texto: 'Coloque seu nome (e o de quem trabalha com você). O cliente escolhe na hora de agendar.',
      obrigatorio: true,
      aviso: 'Adicione pelo menos uma pessoa pra continuar.',
      completo: function () { return equipeCache && equipeCache.length > 0; },
      render: renderPassoTutorialEquipe
    },
    {
      id: 'localizacao', titulo: 'Endereço', capitulo: 'achar', pergunta: 'Onde fica o seu espaço?',
      texto: 'Aparece no site e abre no mapa.',
      obrigatorio: true,
      aviso: 'Preencha o endereço pra continuar.',
      completo: function () { return !!(linhaAtual && linhaAtual.endereco && linhaAtual.endereco.trim()); },
      render: renderPassoTutorialLocalizacao
    }
    // cores, redes sociais e galeria ficam pro painel ("Editar site"),
    // fora da criação — eram passos a mais que confundiam no primeiro uso
  ];
  var passoCriacaoAtual = 0;
  var passoCriacaoDesde = 0;
  var passoCriacaoTotal = 0;
  var passosAtivos = PASSOS_CRIACAO;
  var editandoPorPassos = false; // true = veio do painel em "Editar meu site"
  function modoPassos() {
    var q = new URLSearchParams(window.location.search);
    return q.get('editar') === '1' ? 'editar' : q.get('tutorial') === '1' ? 'criar' : null;
  }

  // ---- o editor único (assets/js/editor-matriz.js): a mesma interface pra
  // criar e pra editar, igual à de Pedir/Chamar. Os renders de cada passo
  // continuam aqui; mostrarPassoTutorial/atualizarBotaoProximoTutorial
  // viraram atalhos pro editor (os passos chamam eles depois de salvar). ----
  var editorAtual = null;
  var respostasNegocio = {};
  function iniciarTutorialSeNecessario() {
    var params = new URLSearchParams(window.location.search);
    var modo = modoPassos();
    if (!modo || !linhaAtual || !window.VBEditor) return;
    if (modo === 'criar' && linhaAtual.onboarding_concluido) return;
    editandoPorPassos = modo === 'editar';
    var barra = document.getElementById('adminModoBarra');
    if (barra) barra.classList.add('oculto');
    var antigo = document.getElementById('vbTutorialOverlay');
    if (antigo) antigo.classList.add('oculto');
    var abrir = function () {
      passosAtivos = editandoPorPassos ? montarPassosEdicao() : PASSOS_CRIACAO;
      passoCriacaoDesde = editandoPorPassos ? 0 : (parseInt(params.get('desde'), 10) || 0);
      passoCriacaoTotal = passoCriacaoDesde + passosAtivos.length;
      editorAtual = window.VBEditor.abrir({
        modo: editandoPorPassos ? 'editar' : 'criar',
        passos: passosAtivos.map(function (p, i) {
          return Object.assign({}, p, {
            render: function (caixa, ctx) {
              passoCriacaoAtual = i;
              if (localTutorial) { localTutorial.destruir(); localTutorial = null; }
              if (p.render) p.render(caixa, ctx);
            }
          });
        }),
        inicial: params.get('passo'),
        contagem: editandoPorPassos ? null : { desde: passoCriacaoDesde, total: passoCriacaoTotal },
        aoConcluir: concluirTutorial
      });
    };
    // as perguntas do tipo de negócio precisam das respostas já salvas
    if (editandoPorPassos && window.VBPerguntas) window.VBPerguntas.carregar(estabId).then(function (r) { respostasNegocio = r; abrir(); });
    else abrir();
  }

  function atualizarBotaoProximoTutorial() {
    if (editorAtual) editorAtual.estado();
  }
  function mostrarPassoTutorial(indice) {
    if (!editorAtual) return;
    if (indice === editorAtual.indice()) editorAtual.atualizar(); else editorAtual.ir(indice);
  }

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
        var tattoo = linhaAtual.segmento === 'tatuador';
        var estilos = tattoo ? especialidadesSugeridasPara('tatuador') : [];
        galeriaQtd = linhas.length;
        atualizarBotaoProximoTutorial();
        var gradeEl = document.getElementById('vbTutGaleriaGrid');
        gradeEl.innerHTML = linhas.slice(0, tattoo ? 12 : 6).map(function (g) {
          var img = '<img src="' + escapeHtml(g.foto_url) + '" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px;">';
          if (!tattoo) return img;
          // cada foto do portfólio ganha um estilo (vira filtro no site)
          return '<div class="vb-foto-estilo">' + img +
            '<select data-estilo-foto="' + g.id + '" aria-label="Estilo da foto"><option value="">Estilo…</option>' +
            estilos.map(function (e) { return '<option' + (g.estilo === e ? ' selected' : '') + '>' + escapeHtml(e) + '</option>'; }).join('') +
            '</select></div>';
        }).join('');
        gradeEl.querySelectorAll('[data-estilo-foto]').forEach(function (sel) {
          sel.addEventListener('change', function () {
            db.rpc('tenant_admin_estilo_foto', { p_estabelecimento_id: estabId, p_id: sel.getAttribute('data-estilo-foto'), p_estilo: sel.value || null }).then(carregarGaleria);
          });
        });
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

  // ---- editar o site (painel → "Editar meu site"): o mesmo passo a passo
  // da criação, com tudo que dá pra mudar, sem nada obrigatório ----
  function renderPassoEdicaoTextos(container) {
    var campos = [
      ['tplNomeTopo', 'Nome do negócio', linhaAtual.nome, salvarNome],
      ['tplHeadline', 'Frase embaixo do nome', textoDoTitulo(), salvarTextoHero],
      ['tplSubcopy', 'Frase pequena embaixo', document.getElementById('tplSubcopy').textContent, salvarTextoHero],
      ['tplCtaTexto', 'Texto do botão de agendar', linhaAtual.texto_cta || document.getElementById('tplCtaTexto').textContent, salvarCta]
    ];
    container.innerHTML = campos.map(function (c, i) {
      return '<div class="field" style="margin-bottom:0.7rem;"><label for="vbEdTexto' + i + '">' + c[1] + '</label>' +
        (c[0] === 'tplSubcopy' ? '<textarea id="vbEdTexto' + i + '" rows="2">' + escapeHtml(c[2]) + '</textarea>' : '<input type="text" id="vbEdTexto' + i + '" value="' + escapeHtml(c[2]) + '">') + '</div>';
    }).join('') +
      '<div class="field" style="margin-bottom:0.7rem;"><label for="vbEdTelefone">WhatsApp do negócio</label><input type="tel" id="vbEdTelefone" inputmode="tel" value="' + escapeHtml(linhaAtual.telefone_whatsapp || '') + '"></div>' +
      '<p class="msg" id="vbEdTextosMsg"></p>';
    campos.forEach(function (c, i) {
      var input = document.getElementById('vbEdTexto' + i);
      // escreve no site ao vivo e salva quando sai do campo
      input.addEventListener('input', function () {
        if (c[0] === 'tplHeadline') aplicarEfeitoTitulo(input.value);
        else if (c[0] === 'tplNomeTopo') { document.getElementById(c[0]).textContent = input.value; aplicarEfeitoTitulo(null, input.value); }
        else document.getElementById(c[0]).textContent = input.value;
      });
      input.addEventListener('change', function () {
        c[3]();
        var msg = document.getElementById('vbEdTextosMsg');
        if (msg) { msg.className = 'msg msg-ok'; msg.textContent = 'Salvo ✓'; }
      });
    });
    ligarTelefoneEdicao();
  }
  function ligarTelefoneEdicao() {
    var input = document.getElementById('vbEdTelefone');
    if (!input) return;
    input.addEventListener('change', function () {
      var msg = document.getElementById('vbEdTextosMsg');
      salvarTelefone(input.value).then(function () {
        if (msg) { msg.className = 'msg msg-ok'; msg.textContent = 'Salvo ✓'; }
      }, function (err) {
        if (msg) { msg.className = 'msg msg-erro'; msg.textContent = (err && err.message) || 'Não deu pra salvar o WhatsApp.'; }
      });
    });
  }
  function renderPassoEdicaoEstilo(container) {
    var topo = document.createElement('div');
    topo.innerHTML =
      '<button type="button" class="btn btn-primario" id="vbEdEstilo" style="width:100%; margin-bottom:0.8rem;">Trocar o estilo do site</button>';
    var cores = document.createElement('div');
    var extras = document.createElement('div');
    extras.className = 'vb-ed-extras';
    extras.innerHTML =
      '<button type="button" class="btn btn-ghost" id="vbEdVidro">' + (linhaAtual.widgets_translucidos ? 'Tirar efeito vidro' : 'Efeito vidro na agenda') + '</button>' +
      '<button type="button" class="btn btn-ghost" id="vbEdFotoBusca">Foto que aparece na busca</button>';
    container.appendChild(topo);
    container.appendChild(cores);
    container.appendChild(extras);
    renderPassoTutorialCores(cores);
    document.getElementById('vbEdEstilo').addEventListener('click', abrirGaleriaEstilos);
    document.getElementById('vbEdVidro').addEventListener('click', function () {
      alternarWidgetsTranslucidos();
      this.textContent = linhaAtual.widgets_translucidos ? 'Tirar efeito vidro' : 'Efeito vidro na agenda';
    });
    document.getElementById('vbEdFotoBusca').addEventListener('click', abrirEditorFotoCard);
  }
  // editar (painel → "Editar meu site"): tudo do site, em capítulos, uma
  // pergunta por vez; as do tipo de negócio vêm de perguntas-segmento.js
  function montarPassosEdicao() {
    var redes = function () { return !!(linhaAtual.instagram_url || linhaAtual.facebook_url || linhaAtual.tiktok_url); };
    var tattoo = linhaAtual.segmento === 'tatuador';
    var base = [
      { id: 'foto', capitulo: 'impressao', titulo: 'Foto principal', pergunta: 'Qual foto mostra melhor o seu negócio?', ajuda: 'É a primeira coisa que o cliente vê. Mande do celular ou toque numa pronta.', completo: function () { return !!fotoPrincipal(); }, render: renderPassoTutorialFoto },
      { id: 'textos', capitulo: 'impressao', titulo: 'Nome e frases', pergunta: 'Como você quer se apresentar?', ajuda: 'O nome e as frases do topo. Muda ao vivo aqui atrás.', completo: function () { return !!(linhaAtual.titulo_hero || '').trim(); }, render: renderPassoEdicaoTextos },
      { id: 'estilo', capitulo: 'impressao', titulo: 'Cores e estilo', pergunta: 'Qual a cara do seu site?', ajuda: 'O visual inteiro — vale pra Agendar, Pedir e Chamar.', completo: function () { return !!linhaAtual.template; }, render: renderPassoEdicaoEstilo },
      { id: 'efeito', capitulo: 'impressao', titulo: 'Efeito do título', pergunta: 'Quer dar movimento ao título?', ajuda: 'Opcional: o nome (ou a frase) se mexe — entrando, na horizontal, na vertical ou junto com a rolagem.', render: renderPassoEdicaoTituloEfeito },
      { id: 'servicos', capitulo: 'oferta', titulo: tattoo ? 'Sessões e preços' : 'Serviços e preços', pergunta: tattoo ? 'Que sessões o cliente pode marcar?' : 'O que o cliente pode agendar?', ajuda: 'Com preço e quanto tempo leva — a agenda reserva o tempo todo.', completo: function () { return servicosCache.length > 0; }, render: renderPassoTutorialServicos },
      { id: 'equipe', capitulo: 'oferta', titulo: 'Quem atende', pergunta: 'Quem atende os clientes?', ajuda: 'O cliente escolhe na hora de agendar.', completo: function () { return equipeCache.length > 0; }, render: renderPassoTutorialEquipe },
      { id: 'galeria', capitulo: 'oferta', titulo: tattoo ? 'Portfólio' : 'Galeria de fotos', pergunta: tattoo ? 'Mostre os seus trabalhos' : 'Mostre o seu espaço e os seus trabalhos', ajuda: tattoo ? 'Marque o estilo de cada foto: no site vira filtro.' : 'Fotos de verdade passam confiança.', completo: function () { return galeriaQtd > 0; }, render: renderPassoTutorialGaleria },
      { id: 'horario', capitulo: 'funciona', titulo: 'Horário', pergunta: 'Que dias e horários você atende?', ajuda: 'A agenda só oferece horários dentro disso.', completo: function () { return horariosCache.length > 0; }, render: renderPassoEdicaoHorario },
      { id: 'contato', capitulo: 'funciona', titulo: 'WhatsApp', pergunta: 'Em qual WhatsApp você recebe os agendamentos?', completo: function () { return !!(linhaAtual.telefone_whatsapp || '').replace(/\D/g, ''); }, render: renderPassoEdicaoContato },
      { id: 'localizacao', capitulo: 'achar', titulo: 'Endereço', pergunta: 'Onde fica o seu espaço?', ajuda: 'Aparece no site e abre no mapa.', completo: function () { return !!(linhaAtual.endereco || '').trim(); }, render: renderPassoTutorialLocalizacao },
      { id: 'redes', capitulo: 'achar', titulo: 'Redes sociais', pergunta: 'Onde mais te acham na internet?', ajuda: 'Instagram, Facebook e TikTok no site.', completo: redes, render: renderPassoTutorialRedes }
    ];
    var sobre = window.VBPerguntas ? window.VBPerguntas.passosEditor(estabId, linhaAtual.segmento, linhaAtual.areas || ['agenda'], respostasNegocio, desenharBomSaber) : [];
    return base.concat(sobre);
  }

  function concluirTutorial() {
    document.getElementById('vbTutorialOverlay').classList.add('oculto');
    if (editandoPorPassos) { window.location.href = '/cadastro.html'; return; }
    if (linhaAtual) linhaAtual.onboarding_concluido = true;
    db.rpc('tenant_admin_concluir_onboarding', { p_estabelecimento_id: estabId }).then(function () {
      // site pronto: abre como o cliente vê (com o botão "Editar meu site" pro dono)
      window.location.replace(window.location.pathname);
    }, function () { window.location.replace(window.location.pathname); });
  }

  // ---- passo "foto principal": mesmo upload/estoque do editor rápido do
  // admin, só que sempre visível dentro da própria caixa da criação — sem
  // precisar adivinhar onde clicar na foto por trás dela. ----
  function renderPassoTutorialFoto(container) {
    var fotoAtual = fotoPrincipal();
    var estoque = window.estoqueFotosPara ? window.estoqueFotosPara(linhaAtual.segmento) : ESTOQUE_FOTOS_ADMIN;
    container.innerHTML =
      (fotoAtual ? '<div id="vbTutFoco" style="margin-bottom:0.7rem;"></div>' : '') +
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
    montarFocoFoto(document.getElementById('vbTutFoco'));

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


  // ---- duração do serviço: a agenda bloqueia o tempo todo (uma sessão de
  // tatuagem de 4h não deixa ninguém marcar no meio dela) ----
  var DURACOES = [30, 45, 60, 90, 120, 180, 240, 300, 360, 480];
  function rotuloDuracao(min) {
    min = Number(min) || 30;
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + ' h' + (m ? ' ' + m : '');
  }
  function selectDuracaoHtml(id) {
    return '<select id="' + id + '" class="vb-servico-duracao" aria-label="Duração">' +
      DURACOES.map(function (d) { return '<option value="' + d + '"' + (d === 30 ? ' selected' : '') + '>' + rotuloDuracao(d) + '</option>'; }).join('') +
      '</select>';
  }
  // salva o serviço e, se a duração não for a padrão (30 min), grava ela também
  function salvarServicoComDuracao(nome, preco, duracao) {
    return db.rpc('tenant_admin_salvar_servico', { p_estabelecimento_id: estabId, p_id: null, p_nome: nome.trim(), p_preco: preco || 0, p_categoria: 'unissex' }).then(function (res) {
      var id = res && res.data && res.data.id;
      if (!id || !duracao || Number(duracao) === 30) return res;
      return db.rpc('tenant_admin_duracao_servico', { p_estabelecimento_id: estabId, p_id: id, p_duracao_min: Number(duracao) }).then(function () { return res; });
    });
  }
  function duracaoSugerida(nome) {
    var lista = window.servicosSugeridosPara ? window.servicosSugeridosPara(linhaAtual.segmento) : [];
    var s = lista.filter(function (x) { return x.nome === nome; })[0];
    return s && s.duracao ? s.duracao : 30;
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
        return '<li>' + escapeHtml(s.nome) + ' · ' + formatarPreco(s.preco) + (s.duracao_min ? ' · ' + rotuloDuracao(s.duracao_min) : '') +
          '<button type="button" class="vb-remover-x" data-remover-servico-tut="' + s.id + '" style="position:static; margin-left:0.5rem; display:inline-flex; align-items:center; justify-content:center; vertical-align:middle;">×</button></li>';
      }).join('') + '</ul>' : '') +
      (sugestoes.length ? '<p class="vb-servico-novo-legenda">Sugestões pro seu tipo de negócio (toque pra usar o nome, o preço você define agora):</p><div class="vb-servico-chips">' +
        sugestoes.map(function (s) {
          return '<button type="button" class="vb-servico-chip" data-chip-nome="' + escapeHtml(s.nome) + '">' + escapeHtml(s.nome) + '</button>';
        }).join('') + '</div>' : '') +
      '<p class="vb-servico-novo-legenda">Nome, preço e quanto tempo leva:</p>' +
      '<div class="vb-servico-manual">' +
      '<input type="text" id="vbTutServicoNome" placeholder="Nome do serviço">' +
      '<input type="text" inputmode="decimal" id="vbTutServicoPreco" placeholder="Preço">' +
      selectDuracaoHtml('vbTutServicoDuracao') +
      '<button type="button" class="btn btn-primario" id="vbTutServicoSalvar">Adicionar</button>' +
      '</div>';

    function atualizarERenderizar() {
      db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
        servicosCache = res.data || [];
        carregarServicos();
        mostrarPassoTutorial(passoCriacaoAtual);
      });
    }
    function salvar(nome, preco, duracao) {
      if (!nome || !nome.trim()) return;
      salvarServicoComDuracao(nome, preco, duracao).then(atualizarERenderizar);
    }
    // a sugestão só preenche o NOME — o preço é sempre digitado na hora
    // pelo dono (nenhum valor "chutado" entra sem ele decidir).
    container.querySelectorAll('[data-chip-nome]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var nomeInput = document.getElementById('vbTutServicoNome');
        var precoInput = document.getElementById('vbTutServicoPreco');
        nomeInput.value = chip.getAttribute('data-chip-nome');
        document.getElementById('vbTutServicoDuracao').value = String(duracaoSugerida(nomeInput.value));
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
      salvar(nome, preco, document.getElementById('vbTutServicoDuracao').value);
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
  var localTutorial = null;
  function renderPassoTutorialLocalizacao(container) {
    if (localTutorial) localTutorial.destruir();
    if (!window.VBLocal) return;
    var salvarPendente = null;
    localTutorial = window.VBLocal.montar(container, {
      endereco: linhaAtual.endereco || '',
      lat: linhaAtual.endereco_lat, lng: linhaAtual.endereco_lng,
      cidade: linhaAtual.cidade,
      aoMudar: function (v) {
        linhaAtual.endereco = v.endereco;
        linhaAtual.endereco_lat = v.lat;
        linhaAtual.endereco_lng = v.lng;
        atualizarMapaLink();
        document.getElementById('tplEnderecoRodape').textContent = v.endereco || 'Endereço não informado';
        atualizarBotaoProximoTutorial();
        clearTimeout(salvarPendente);
        salvarPendente = setTimeout(function () {
          db.rpc('tenant_admin_atualizar_endereco', { p_estabelecimento_id: estabId, p_endereco: v.endereco, p_lat: v.lat, p_lng: v.lng });
        }, 400);
      }
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
  // o dono vê o site igual ao cliente, com um botão pra editar pelo passo a passo
  function mostrarAtalhoDono() {
    if (document.getElementById('vbDonoAtalho')) return;
    var barra = document.createElement('div');
    barra.id = 'vbDonoAtalho';
    barra.className = 'vb-dono-atalho';
    barra.innerHTML = '<span>Este site é seu</span>' +
      '<a href="' + window.location.pathname + '?editar=1">Editar meu site</a>' +
      '<a href="/cadastro.html" class="vb-dono-atalho-painel">Painel</a>';
    document.body.appendChild(barra);
  }
  function verificarSessaoDono() {
    db.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (session && linhaAtual && session.user.id === linhaAtual.dono_user_id) {
        if (modoPassos()) ativarModoAdmin(); else mostrarAtalhoDono();
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

    document.getElementById('adminEstiloBtn').addEventListener('click', abrirGaleriaEstilos);
    document.getElementById('adminSeguirCorImagemBtn').addEventListener('click', alternarSeguirCorImagem);
    document.getElementById('adminWidgetsTranslucidosBtn').addEventListener('click', alternarWidgetsTranslucidos);
    document.getElementById('adminFotoCardBtn').addEventListener('click', abrirEditorFotoCard);
  }

  function aplicarGenero(g) {
    generoAtual = g;
    var femCss = document.getElementById('tplFeminino');
    femCss.disabled = (g !== 'feminino');
    atualizarFundoDaFoto();

    var nome = linhaAtual.nome;
    // nome do tipo de negócio pela lista da plataforma (segmentos.js) — a
    // lista daqui só tinha os de beleza e borracharia saía "Estabelecimento"
    var seg = linhaAtual.segmento;
    var nomeSeg = (seg !== 'outro' && window.VibeSegmentos && window.VibeSegmentos.nome(seg)) || SEGMENTOS[seg] || 'Estabelecimento';
    var cidadeBonita = String(linhaAtual.cidade || '').replace(/(^|[\s-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
    document.getElementById('tplEyebrow').textContent = nomeSeg + ' · ' + cidadeBonita;
    // frase de efeito por nicho, sorteada de forma estável a partir do
    // slug+cidade — o mesmo site sempre mostra a mesma frase, mas
    // dificilmente igual à de outro estabelecimento do mesmo segmento.
    var frase = window.fraseEfeitoPara ? window.fraseEfeitoPara(linhaAtual.segmento, (linhaAtual.slug || '') + linhaAtual.cidade) : COPY[g];
    aplicarEfeitoTitulo(linhaAtual.titulo_hero || frase.headline);
    document.getElementById('tplSubcopy').textContent = linhaAtual.subtitulo_hero || frase.sub;

    var fotoHero = fotoPrincipal(g);
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
    montarFaixaContatos();

    var trocaBtn = document.getElementById('tplTrocaGenero');
    if (separaPorGenero()) {
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

  // ---- efeito do título (movimento/letra/estilo) e faixa de contatos na foto ----
  var efeitoTitulo = {};
  var efeitoCarregado = false;
  function textoDoTitulo() {
    var el = document.getElementById('tplHeadline');
    return el.getAttribute('data-te-texto') != null ? el.getAttribute('data-te-texto') : el.textContent;
  }
  // o topo inteiro: nome do negócio (título grande), frase e foco da foto
  function alvosTopo() {
    return { nome: document.getElementById('tplNomeHero'), frase: document.getElementById('tplHeadline'), foto: document.getElementById('tplHeroFoto') };
  }
  function aplicarEfeitoTitulo(texto, nome) {
    var alvos = alvosTopo();
    if (nome == null && linhaAtual && alvos.nome && alvos.nome.getAttribute('data-te-texto') == null) nome = linhaAtual.nome;
    if (!window.VBTituloEfeitos) {
      if (texto != null) alvos.frase.textContent = texto;
      if (nome != null && alvos.nome) alvos.nome.textContent = nome;
      return;
    }
    window.VBTituloEfeitos.aplicarTopo(alvos, efeitoTitulo, { frase: texto, nome: nome });
    if (!efeitoCarregado && estabId) {
      efeitoCarregado = true;
      window.VBTituloEfeitos.carregar(estabId).then(function (cfg) {
        efeitoTitulo = cfg || {};
        window.VBTituloEfeitos.aplicarTopo(alvosTopo(), efeitoTitulo);
      });
    }
  }
  function montarFaixaContatos() {
    if (!window.VBFaixaContatos || !linhaAtual) return;
    window.VBFaixaContatos.montar(document.getElementById('tplHeroFoto'), {
      whatsapp: linhaAtual.telefone_whatsapp, instagram: linhaAtual.instagram_url, facebook: linhaAtual.facebook_url,
      tiktok: linhaAtual.tiktok_url, endereco: linhaAtual.endereco, cidade: linhaAtual.cidade,
      acao: { tipo: 'agendar', rotulo: 'Agendar horário', aoTocar: function () { if (window.VBAgenda) window.VBAgenda.abrir(); } }
    });
  }
  // enquadrar a foto do topo: o ponto escolhido fica no centro do corte
  var salvarFocoDepois = 0;
  function montarFocoFoto(caixa) {
    if (!caixa || !window.VBTituloEfeitos) return;
    window.VBTituloEfeitos.montarFoco(caixa, fotoPrincipal(), efeitoTitulo, function (cfg) {
      efeitoTitulo = cfg;
      window.VBTituloEfeitos.aplicarFoco(document.getElementById('tplHeroFoto'), cfg.foco);
      clearTimeout(salvarFocoDepois);
      salvarFocoDepois = setTimeout(function () {
        window.VBTituloEfeitos.salvar(estabId, efeitoTitulo).catch(function () {});
      }, 400);
    });
  }
  function renderPassoEdicaoTituloEfeito(container) {
    // o título fica embaixo da foto no celular: traz ele pro topo da tela, acima da bolha
    var tituloVivo = document.getElementById('tplNomeHero') || document.getElementById('tplHeadline');
    if (tituloVivo) window.scrollTo({ top: Math.max(0, tituloVivo.getBoundingClientRect().top + window.scrollY - 70), behavior: 'smooth' });
    var demo = document.createElement('div');
    container.appendChild(demo);
    window.VBTituloEfeitos.montarEscolha(demo, efeitoTitulo, function (cfg) {
      efeitoTitulo = cfg;
      aplicarEfeitoTitulo();
      window.VBTituloEfeitos.salvar(estabId, cfg).catch(function (e) {
        if (window.VBDialogo) window.VBDialogo.alert('Não deu pra salvar o efeito: ' + ((e && e.message) || 'tenta de novo.'));
      });
    });
  }

  function iniciarGenero() {
    // fora da beleza ninguém separa público por gênero —
    // o campo genero_atendimento é gravado como 'ambos' só como valor
    // técnico padrão desde a criação (criar.js), mas aqui isso nunca deve
    // abrir o portão de escolha nem mostrar o botão de trocar de área.
    if (SEGMENTOS_COM_GENERO.indexOf(linhaAtual.segmento) === -1) {
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
    montarFaixaContatos();
    var strip = document.getElementById('tplRedesSociais');
    if (!strip) return;
    var linksVisiveis = REDES.filter(function (r) {
      if (r.chave === 'whatsapp') return !!linhaAtual.telefone_whatsapp;
      return edicaoNoSite || linhaAtual[r.chave];
    });
    strip.innerHTML = linksVisiveis.map(function (r) {
      var url = r.chave === 'whatsapp'
        ? 'https://wa.me/55' + linhaAtual.telefone_whatsapp.replace(/\D/g, '')
        : linhaAtual[r.chave];
      var vazio = r.chave !== 'whatsapp' && !url;
      var estiloVazio = vazio ? ' style="opacity:0.4;"' : '';
      if (edicaoNoSite && r.chave !== 'whatsapp') {
        return '<button type="button" class="social-badge" data-rede="' + r.chave + '" title="' + r.label + '"' + estiloVazio + '>' + r.icone + '</button>';
      }
      return '<a class="social-badge" href="' + escapeHtml(url) + '" target="_blank" rel="noopener" title="' + r.label + '">' + r.icone + '</a>';
    }).join('');

    if (!edicaoNoSite) return;
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
  var agendaPeloHash = false;
  function abrirAgendaDoHash(linhas) {
    agendaPeloHash = false;
    var pedido = decodeURIComponent((window.location.hash.split('=')[1] || '')).trim().toLowerCase();
    var achado = pedido ? linhas.filter(function (s) { return String(s.nome).trim().toLowerCase() === pedido; })[0] : null;
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(function () { if (window.VBAgenda) window.VBAgenda.abrir(achado ? achado.nome : undefined); }, 0);
  }

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
    tatuador: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 3l3 3-9.5 9.5-3-3z"/><path d="M8.5 12.5L5 16l3 3 3.5-3.5"/><path d="M5 19l-2 2"/><path d="M15 6l3 3"/></svg>',
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
    db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      servicosCache = linhas;
      if (agendaPeloHash) abrirAgendaDoHash(linhas);
      strip.innerHTML =
        '<button type="button" class="service-badge" onclick="document.getElementById(\'servicosSecao\').scrollIntoView({behavior:\'smooth\'})"><span class="mark">' + ICONE_TESOURA + '</span><strong>Ver</strong><span>Serviços</span></button>' +
        '<button type="button" class="service-badge" data-open-widget><span class="mark">' + ICONE_AGENDA + '</span><strong>Agendar</strong><span>Horário</span></button>';

      if (!linhas.length && !edicaoNoSite) {
        lista.classList.remove('servicos-redondos-lista');
        lista.innerHTML = '<li style="border:none; color:var(--ink-soft);">Serviços em breve.</li>';
        return;
      }

      if (!edicaoNoSite) {
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

        function salvarNovoServico(nome, preco, duracao) {
          if (!nome || !nome.trim()) return;
          salvarServicoComDuracao(nome, preco, duracao).then(carregarServicos);
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
            '<p class="vb-servico-novo-legenda">Nome, preço e quanto tempo leva:</p>' +
            '<div class="vb-servico-manual">' +
            '<input type="text" id="vbNovoServicoNome" placeholder="Nome do serviço">' +
            '<input type="text" inputmode="decimal" id="vbNovoServicoPreco" placeholder="Preço">' +
            selectDuracaoHtml('vbNovoServicoDuracao') +
            '<button type="button" class="btn btn-primario" id="vbNovoServicoSalvar">Adicionar</button>' +
            '</div>';
          painel.classList.remove('oculto');
          painel.querySelectorAll('[data-chip-nome]').forEach(function (chip) {
            chip.addEventListener('click', function () {
              document.getElementById('vbNovoServicoNome').value = chip.getAttribute('data-chip-nome');
              document.getElementById('vbNovoServicoDuracao').value = String(duracaoSugerida(chip.getAttribute('data-chip-nome')));
              document.getElementById('vbNovoServicoPreco').focus();
            });
          });
          document.getElementById('vbNovoServicoSalvar').addEventListener('click', function () {
            var nome = document.getElementById('vbNovoServicoNome').value;
            var preco = parseFloat(document.getElementById('vbNovoServicoPreco').value.replace(',', '.')) || 0;
            salvarNovoServico(nome, preco, document.getElementById('vbNovoServicoDuracao').value);
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

  // ---- equipe (aparece só pro admin nesta página — o público vê a
  // equipe no site institucional, mas o dono gerencia direto por aqui) ----
  var equipeCache = [];
  function carregarEquipeAdmin() {
    if (!modoAdmin) return;
    if (!edicaoNoSite) {
      db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId }).then(function (res) { equipeCache = res.data || []; });
      return;
    }
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

  var horariosCache = [];
  var galeriaQtd = 0;
  var NOMES_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // ---- passo "horário" (editor): cada dia com aberto/fechado e o horário;
  // salva sozinho a cada mudança ----
  function renderPassoEdicaoHorario(caixa, ctx) {
    var porDia = {};
    horariosCache.forEach(function (h) { porDia[h.dia_semana] = h; });
    var ordem = [1, 2, 3, 4, 5, 6, 0];
    caixa.innerHTML = '<div class="vbh-lista">' + ordem.map(function (d) {
      var h = porDia[d] || { abre: '08:00', fecha: '18:00', fechado: d === 0 };
      return '<div class="vbh-dia' + (h.fechado ? ' fechado' : '') + '" data-dia="' + d + '">' +
        '<label class="vbh-chave"><input type="checkbox" data-aberto' + (h.fechado ? '' : ' checked') + '><span>' + NOMES_DIA[d] + '</span></label>' +
        '<span class="vbh-horas"><input type="time" data-abre value="' + String(h.abre).slice(0, 5) + '"> – <input type="time" data-fecha value="' + String(h.fecha).slice(0, 5) + '"></span>' +
        '<span class="vbh-fechado-txt">Fechado</span></div>';
    }).join('') + '</div>' +
      '<button type="button" class="vbh-copiar" data-copiar>Usar o horário de segunda em todos os dias abertos</button>';
    function salvarDia(linha) {
      var aberto = linha.querySelector('[data-aberto]').checked;
      linha.classList.toggle('fechado', !aberto);
      ctx.salvo('Salvando…');
      return db.rpc('tenant_admin_salvar_horario', {
        p_estabelecimento_id: estabId, p_dia_semana: Number(linha.getAttribute('data-dia')),
        p_abre: linha.querySelector('[data-abre]').value || '08:00', p_fecha: linha.querySelector('[data-fecha]').value || '18:00', p_fechado: !aberto
      }).then(function (res) {
        if (res.error) { ctx.salvo(res.error.message, true); return; }
        var d = Number(linha.getAttribute('data-dia'));
        horariosCache = horariosCache.filter(function (h) { return h.dia_semana !== d; }).concat([{ dia_semana: d, abre: linha.querySelector('[data-abre]').value, fecha: linha.querySelector('[data-fecha]').value, fechado: !aberto }]);
        ctx.salvo('Salvo');
        carregarHorarioRodape();
      }, function () { ctx.salvo('Sem conexão — tente de novo', true); });
    }
    caixa.querySelectorAll('.vbh-dia').forEach(function (linha) {
      linha.querySelectorAll('input').forEach(function (inp) { inp.addEventListener('change', function () { salvarDia(linha); }); });
    });
    caixa.querySelector('[data-copiar]').addEventListener('click', function () {
      var seg = caixa.querySelector('.vbh-dia[data-dia="1"]');
      var a = seg.querySelector('[data-abre]').value, f = seg.querySelector('[data-fecha]').value;
      var linhas = Array.prototype.filter.call(caixa.querySelectorAll('.vbh-dia'), function (l) { return l !== seg && l.querySelector('[data-aberto]').checked; });
      linhas.forEach(function (l) { l.querySelector('[data-abre]').value = a; l.querySelector('[data-fecha]').value = f; });
      linhas.reduce(function (pr, l) { return pr.then(function () { return salvarDia(l); }); }, Promise.resolve());
    });
  }

  // ---- passo "WhatsApp" (editor) ----
  function renderPassoEdicaoContato(caixa, ctx) {
    caixa.innerHTML = '<input class="vbp-texto" id="vbEdTelefone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(15) 99999-9999" value="' + escapeHtml(linhaAtual.telefone_whatsapp || '') + '">' +
      '<p class="vbp-dica">Cada agendamento abre uma conversa com esse número.</p>';
    var inp = document.getElementById('vbEdTelefone');
    inp.addEventListener('change', function () {
      if (inp.value.replace(/\D/g, '').length < 10) { ctx.salvo('Confira o número com DDD', true); return; }
      ctx.salvo('Salvando…');
      salvarTelefone(inp.value).then(function () { ctx.salvo('Salvo'); }, function (e) { ctx.salvo((e && e.message) || 'Não salvou', true); });
    });
  }

  // ---- "Bom saber" no site: respostas das perguntas do tipo de negócio ----
  function desenharBomSaber(respostas) {
    if (!window.VBPerguntas || !linhaAtual) return;
    var html = window.VBPerguntas.bomSaberHtml(linhaAtual.segmento, linhaAtual.areas || ['agenda'], respostas || {});
    var atual = document.getElementById('vbBomSaber');
    if (!html) { if (atual) atual.remove(); return; }
    var div = document.createElement('div');
    div.id = 'vbBomSaber';
    div.innerHTML = html;
    var antes = document.getElementById('tplGaleriaSecao');
    if (atual) atual.replaceWith(div);
    else if (antes && antes.parentNode) antes.parentNode.insertBefore(div, antes);
  }

  function salvarTelefone(novo) {
    novo = String(novo || '').trim();
    if (!novo || novo === (linhaAtual.telefone_whatsapp || '')) return Promise.resolve();
    return db.rpc('tenant_admin_atualizar_identidade', {
      p_estabelecimento_id: estabId, p_nome: null, p_slug: null, p_cidade: null, p_segmento: null, p_telefone_whatsapp: novo
    }).then(function (res) {
      if (res.error) throw res.error;
      linhaAtual.telefone_whatsapp = novo;
      var tel = novo.replace(/\D/g, '');
      [document.getElementById('tplTelefoneMenu'), document.getElementById('tplTelefoneRodape')].forEach(function (a) {
        if (!a) return;
        a.style.display = '';
        a.href = 'tel:+55' + tel;
        a.textContent = novo;
      });
      carregarRedesSociais();
    });
  }

  function carregarGaleria() {
    db.rpc('tenant_listar_galeria', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      galeriaQtd = linhas.length;
      atualizarBotaoProximoTutorial();
      if (!linhas.length && !edicaoNoSite) return;

      var grid = document.getElementById('tplGrid');
      var vitrine = document.getElementById('tplGaleriaVitrine');
      var rotulo = document.getElementById('tplGaleriaRotulo');
      // quem visita vê a vitrine (fotos grandes, tela cheia); o dono editando, a grade com + e ×
      var vendoVitrine = !edicaoNoSite && linhaAtual.segmento !== 'tatuador' && window.VBGaleria && vitrine;
      grid.style.display = vendoVitrine ? 'none' : 'grid';
      if (rotulo) rotulo.style.display = vendoVitrine ? 'none' : '';
      if (vitrine) vitrine.classList.toggle('oculto', !vendoVitrine);
      if (vendoVitrine) {
        window.VBGaleria.montar(vitrine, linhas, { titulo: 'Galeria' });
        document.getElementById('tplGaleriaSecao').classList.remove('oculto');
        return;
      }
      // tatuagem: a galeria vira portfólio, com filtro por estilo
      if (linhaAtual.segmento === 'tatuador' && !edicaoNoSite) { montarPortfolio(grid, linhas); return; }
      var fotosHtml = linhas.slice(0, 9).map(function (g) {
        var remover = edicaoNoSite ? '<button type="button" class="vb-remover-x" data-remover-galeria="' + g.id + '">×</button>' : '';
        return '<div class="vb-foto-wrap"><img src="' + escapeHtml(g.foto_url) + '" alt="" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:6px;" loading="lazy">' + remover + '</div>';
      }).join('');
      grid.innerHTML = fotosHtml + (edicaoNoSite ? '<button type="button" class="vb-add-tile" id="vbAddFoto">+</button><input type="file" id="vbAddFotoInput" accept="image/*" multiple style="display:none;">' : '');
      document.getElementById('tplGaleriaSecao').classList.remove('oculto');

      if (!edicaoNoSite) return;
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

  // portfólio do tatuador: chips com os estilos que existem nas fotos
  // ("Todos" primeiro) e a grade filtrando na hora, sem recarregar
  function montarPortfolio(grid, linhas) {
    var secao = document.getElementById('tplGaleriaSecao');
    var eyebrow = secao.querySelector('.eyebrow');
    if (eyebrow) eyebrow.textContent = 'Portfólio';
    var estilos = [];
    linhas.forEach(function (g) { if (g.estilo && estilos.indexOf(g.estilo) === -1) estilos.push(g.estilo); });
    var filtros = secao.querySelector('.portfolio-filtros');
    if (!filtros) {
      filtros = document.createElement('div');
      filtros.className = 'portfolio-filtros';
      secao.insertBefore(filtros, grid);
    }
    filtros.innerHTML = estilos.length ? ['Todos'].concat(estilos).map(function (e, i) {
      return '<button type="button" class="portfolio-chip' + (i === 0 ? ' ativo' : '') + '" data-estilo="' + (i === 0 ? '' : escapeHtml(e)) + '">' + escapeHtml(e) + '</button>';
    }).join('') : '';
    function desenhar(estilo) {
      var vistas = linhas.filter(function (g) { return !estilo || g.estilo === estilo; }).slice(0, 18);
      // tocar numa tatuagem abre em tela cheia, passando só pelas do filtro
      grid.onclick = function (e) {
        var f = e.target.closest('[data-i]');
        if (f && window.VBGaleria) window.VBGaleria.telaCheia(vistas, Number(f.getAttribute('data-i')));
      };
      grid.innerHTML = vistas.map(function (g, i) {
        return '<figure class="portfolio-item" data-i="' + i + '" style="cursor:zoom-in"><img src="' + escapeHtml(g.foto_url) + '" alt="' + escapeHtml(g.estilo || 'Tatuagem') + '" loading="lazy">' +
          (g.estilo ? '<figcaption>' + escapeHtml(g.estilo) + '</figcaption>' : '') + '</figure>';
      }).join('');
    }
    filtros.onclick = function (e) {
      var b = e.target.closest('[data-estilo]');
      if (!b) return;
      filtros.querySelectorAll('.portfolio-chip').forEach(function (c) { c.classList.toggle('ativo', c === b); });
      desenhar(b.getAttribute('data-estilo'));
    };
    desenhar('');
    secao.classList.remove('oculto');
  }

  // ---------- agenda em passo a passo (mesmo fluxo do Rafael, com dados
  // de verdade por estabelecimento e horários que respeitam quem já
  // marcou) ----------
  var WIZ_STORAGE_PREFIX = 'vbClienteContato_';
  var DIAS_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  var MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

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
    var ultimoPedidoHorarios = null;
    var briefingEl = document.getElementById('wizBriefing');

    // ---- tatuagem: antes do dia e horário, a pessoa conta a ideia (vai pra
    // agenda do estúdio e pro WhatsApp — o tatuador já chega sabendo) ----
    var BRIEF_LOCAIS = ['Braço', 'Antebraço', 'Mão', 'Perna', 'Costas', 'Peito', 'Costela', 'Pescoço', 'Pé', 'Outro'];
    var BRIEF_TAMANHOS = ['Pequena (até 7 cm)', 'Média (7 a 15 cm)', 'Grande (15 cm+)', 'Fechamento'];
    function ehTattoo() { return !!linhaAtual && linhaAtual.segmento === 'tatuador'; }
    function montarBriefing() {
      if (!briefingEl) return;
      briefingEl.classList.toggle('oculto', !ehTattoo());
      if (!ehTattoo()) return;
      var estilos = especialidadesSugeridasPara('tatuador').concat(['Ainda não sei']);
      var chips = function (campo, lista) {
        return '<div class="wiz-brief-chips" data-brief="' + campo + '">' + lista.map(function (v) {
          return '<button type="button" class="wiz-brief-chip" data-v="' + escapeHtml(v) + '">' + escapeHtml(v) + '</button>';
        }).join('') + '</div>';
      };
      briefingEl.innerHTML =
        '<p class="wiz-brief-titulo">Sua ideia</p>' +
        '<p class="wiz-brief-rotulo">Onde no corpo?</p>' + chips('local', BRIEF_LOCAIS) +
        '<p class="wiz-brief-rotulo">Tamanho aproximado</p>' + chips('tamanho', BRIEF_TAMANHOS) +
        '<p class="wiz-brief-rotulo">Estilo</p>' + chips('estilo', estilos) +
        '<label class="wiz-brief-rotulo" for="wizBriefIdeia">Conte em poucas palavras <span>(opcional)</span></label>' +
        '<textarea id="wizBriefIdeia" class="wiz-brief-ideia" rows="2" maxlength="600" placeholder="Ex.: rosa fineline com o nome da minha filha"></textarea>' +
        '<div id="wizBriefFotos" class="wiz-brief-fotos"></div>' +
        '<label class="wiz-brief-check"><input type="checkbox" id="wizBriefMaior"> Tenho 18 anos ou mais <span>(menor só com responsável presente)</span></label>';
      choices.b_fotos = choices.b_fotos || [];
      desenharFotosBriefing();
      marcarBriefing();
    }
    // foto de referência: desenho, outra tattoo, o lugar do corpo
    function desenharFotosBriefing() {
      var caixa = document.getElementById('wizBriefFotos');
      if (!caixa || !window.VBAnexoFotos) return;
      caixa.innerHTML = window.VBAnexoFotos.bloco(choices.b_fotos, { titulo: 'Foto de referência', ajuda: 'Um desenho, outra tatuagem que você curtiu ou o lugar do corpo — o estúdio já chega com o orçamento mais certo.' });
      window.VBAnexoFotos.ligar(caixa, choices.b_fotos, estabId, desenharFotosBriefing);
    }
    function fotosBriefing() { return window.VBAnexoFotos && choices.b_fotos ? window.VBAnexoFotos.urls(choices.b_fotos) : []; }
    function marcarBriefing() {
      if (!briefingEl) return;
      briefingEl.querySelectorAll('[data-brief]').forEach(function (g) {
        var campo = g.getAttribute('data-brief');
        g.querySelectorAll('[data-v]').forEach(function (b) {
          var on = choices['b_' + campo] === b.getAttribute('data-v');
          b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
      var ideia = document.getElementById('wizBriefIdeia');
      if (ideia && ideia.value !== (choices.b_ideia || '')) ideia.value = choices.b_ideia || '';
      var maior = document.getElementById('wizBriefMaior');
      if (maior) maior.checked = !!choices.b_maior;
    }
    if (briefingEl) {
      briefingEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-v]');
        if (!b) return;
        var campo = b.closest('[data-brief]').getAttribute('data-brief');
        choices['b_' + campo] = choices['b_' + campo] === b.getAttribute('data-v') ? undefined : b.getAttribute('data-v');
        marcarBriefing(); render();
      });
      briefingEl.addEventListener('input', function (e) {
        if (e.target.id === 'wizBriefIdeia') choices.b_ideia = e.target.value.slice(0, 600);
      });
      briefingEl.addEventListener('change', function (e) {
        if (e.target.id === 'wizBriefMaior') { choices.b_maior = e.target.checked; render(); }
      });
    }
    function briefingDetalhes() {
      if (!ehTattoo()) return null;
      return { local: choices.b_local || '', tamanho: choices.b_tamanho || '', estilo: choices.b_estilo || '', ideia: choices.b_ideia || '', maior_idade: !!choices.b_maior, referencia: fotosBriefing().join(' ') };
    }
    function briefingLinhas() {
      if (!ehTattoo()) return [];
      var fotos = fotosBriefing();
      return [['Local', choices.b_local], ['Tamanho', choices.b_tamanho], ['Estilo', choices.b_estilo], ['Ideia', choices.b_ideia],
        ['Referência', fotos.length ? fotos.join(' ') : '']]
        .filter(function (l) { return l[1]; });
    }
    function duracaoDoServico(nome) {
      var s = servicosCache.filter(function (x) { return x.nome === nome; })[0];
      return s && s.duracao_min ? Number(s.duracao_min) : 30;
    }

    function storageKey() { return WIZ_STORAGE_PREFIX + estabId; }

    function isoDate(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function carregarProfissionais() {
      db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId }).then(function (res) {
        staffList = res.data || [];
        if (!staffList.length) {
          profissionalList.innerHTML = '<button type="button" class="pick-card" data-value="Qualquer profissional" data-key="qualquer">Qualquer profissional disponível</button>';
          marcarSelecionados();
          return;
        }
        profissionalList.innerHTML = staffList.map(function (p) {
          var rotulo = p.nome + (p.especialidade ? ' — ' + p.especialidade : '');
          return '<button type="button" class="pick-card" data-value="' + escapeHtml(rotulo) + '" data-key="' + p.id + '" data-staff-id="' + p.id + '">' +
            '<img src="' + (p.foto_url ? escapeHtml(p.foto_url) : '/assets/tpl-classico/img/placeholder-portrait.svg') + '" alt="">' +
            escapeHtml(p.nome) + (p.especialidade ? ' — ' + escapeHtml(p.especialidade) : '') +
            '</button>';
        }).join('');
        marcarSelecionados();
      });
    }

    function carregarServicosWizard() {
      var genero = generoAtual;
      var lista = servicosCache.filter(function (s) { return s.categoria === genero || s.categoria === 'unissex'; });
      if (!lista.length) lista = servicosCache;
      // serviço vindo de fora (botão do site / busca) só traz o nome: marca o primeiro com esse nome
      if (choices.servico && !choices.servicoKey) {
        var achado = lista.filter(function (s) { return s.nome === choices.servico; })[0];
        if (achado) choices.servicoKey = String(achado.id);
      }
      servicoGrid.innerHTML = lista.map(function (s) {
        var preco = Number(s.preco) > 0 ? ' <small class="pick-preco">' + formatarPreco(s.preco) + '</small>' : '';
        var dur = Number(s.duracao_min) > 30 ? ' <small class="pick-duracao">' + rotuloDuracao(s.duracao_min) + '</small>' : '';
        return '<button type="button" class="pick-btn" data-value="' + escapeHtml(s.nome) + '" data-key="' + escapeHtml(String(s.id)) + '">' + escapeHtml(s.nome) + preco + dur + '</button>';
      }).join('');
      marcarSelecionados();
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
        return '<button type="button" class="day-btn" data-value="' + label + '" data-key="' + isoDate(d) + '" data-iso="' + isoDate(d) + '">' +
          '<span class="dia-sem">' + DIAS_ABREV[d.getDay()] + '</span><span class="dia-num">' + String(d.getDate()).padStart(2, '0') + '</span>' +
          '<span class="dia-mes">' + MESES_ABREV[d.getMonth()] + '</span></button>';
      }).join('');
    }

    function renderHorarios(slots) {
      if (!slots || !slots.length) {
        horarioGrid.innerHTML = '<p style="grid-column:1/-1; color:var(--ink-soft); font-size:0.9rem;">Sem horários livres nesse dia.</p>';
        delete choices.horario; delete choices.horarioKey;
        render();
        return;
      }
      horarioGrid.innerHTML = slots.map(function (s) {
        return '<button type="button" class="time-btn" data-value="' + s.horario + '" data-key="' + s.horario + '"' + (s.disponivel ? '' : ' disabled style="opacity:.35;"') + '>' + s.horario + (s.disponivel ? '' : ' (ocupado)') + '</button>';
      }).join('');
      // o horário escolhido antes sumiu ou ficou ocupado nesta nova lista? desmarca
      var aindaLivre = (slots || []).some(function (s) { return s.disponivel && s.horario === choices.horario; });
      if (choices.horario && !aindaLivre) { delete choices.horario; delete choices.horarioKey; }
      marcarSelecionados();
      render();
    }

    function atualizarHorarios() {
      var iso = choices.diaKey;
      if (!iso) return;
      var staffId = choices.profissionalKey && choices.profissionalKey !== 'qualquer' ? choices.profissionalKey : null;
      var pedido = iso + '|' + (staffId || '') + '|' + (choices.servico || '');
      ultimoPedidoHorarios = pedido;
      horarioGrid.innerHTML = '<p style="grid-column:1/-1; color:var(--ink-soft); font-size:0.9rem;">Carregando…</p>';
      // horários que cabem o serviço inteiro (uma sessão de 4h só aparece
      // onde tem 4h livres antes de fechar)
      db.rpc('tenant_public_horarios_servico', { p_estabelecimento_id: estabId, p_dia: iso, p_staff_id: staffId || null, p_servico: choices.servico || '' }).then(function (res) {
        if (pedido !== ultimoPedidoHorarios) return; // trocou de dia/profissional enquanto carregava
        renderHorarios(res.data || []);
      }, function () {
        if (pedido !== ultimoPedidoHorarios) return;
        renderHorarios([]);
      });
    }

    function isStepValid(step) {
      var stepEl = steps[step - 1];
      var requiredInputs = stepEl.querySelectorAll('.field-input[required]');
      if (requiredInputs.length) {
        return Array.prototype.every.call(requiredInputs, function (inp) { return inp.value.trim().length > 0; });
      }
      var grupos = stepEl.querySelectorAll('[data-group]');
      var ok = Array.prototype.every.call(grupos, function (g) { return Boolean(choices[g.getAttribute('data-group')]); });
      if (ok && step === 1 && ehTattoo()) ok = !!choices.b_local && !!choices.b_maior;
      return ok;
    }

    function render() {
      steps.forEach(function (s) { s.classList.toggle('active', Number(s.dataset.step) === current); });
      dots.forEach(function (d) {
        var n = Number(d.dataset.dot);
        d.classList.toggle('active', n === current);
        d.classList.toggle('done', n < current);
      });
      nextBtn.textContent = current === totalSteps ? 'Confirmar' : 'Continuar';
      var eyebrow = document.getElementById('wizardEyebrow');
      if (eyebrow) eyebrow.textContent = 'Passo ' + current + ' de ' + totalSteps;
      nextBtn.classList.toggle('is-disabled', !isStepValid(current));
      if (current === totalSteps) {
        document.getElementById('wizSummaryBox').innerHTML =
          'Nome: <strong>' + escapeHtml(choices.nome || '—') + '</strong><br>' +
          'Profissional: <strong>' + escapeHtml(choices.profissional || '—') + '</strong><br>' +
          'Serviço: <strong>' + escapeHtml(choices.servico || '—') + '</strong>' +
          (duracaoDoServico(choices.servico) > 30 ? ' <small>(' + rotuloDuracao(duracaoDoServico(choices.servico)) + ')</small>' : '') + '<br>' +
          briefingLinhas().map(function (l) {
            var v = l[0] === 'Referência' ? fotosBriefing().length + (fotosBriefing().length > 1 ? ' fotos' : ' foto') : l[1];
            return l[0] + ': <strong>' + escapeHtml(v) + '</strong><br>';
          }).join('') +
          'Dia: <strong>' + escapeHtml(choices.dia || '—') + '</strong><br>' +
          'Horário: <strong>' + escapeHtml(choices.horario || '—') + '</strong>';
      }
    }

    // cada grupo guarda o texto (pro resumo/WhatsApp) e a chave única do
    // botão tocado — dois profissionais ou serviços com o mesmo nome nunca
    // acendem juntos, e o horário sempre vai pro profissional certo
    function marcarSelecionados() {
      [profissionalList, servicoGrid, diaRow, horarioGrid].forEach(function (group) {
        var nome = group.getAttribute('data-group');
        group.querySelectorAll('[data-key]').forEach(function (b) {
          var on = choices[nome + 'Key'] != null && b.getAttribute('data-key') === String(choices[nome + 'Key']);
          b.classList.toggle('selected', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    }
    function selectChoice(groupName, value, key) {
      var mudou = choices[groupName + 'Key'] !== key;
      choices[groupName] = value;
      choices[groupName + 'Key'] = key;
      if (mudou && (groupName === 'profissional' || groupName === 'dia' || groupName === 'servico')) {
        delete choices.horario; delete choices.horarioKey;
        atualizarHorarios();
      }
      marcarSelecionados();
      render();
    }

    [profissionalList, servicoGrid, diaRow, horarioGrid].forEach(function (group) {
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-key]');
        if (!btn || btn.disabled) return;
        selectChoice(group.getAttribute('data-group'), btn.getAttribute('data-value'), btn.getAttribute('data-key'));
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

      choices = {};
      // passo a passo: 1 serviço, 2 profissional, 3 dia/horário, 4 contato
      // (pulado quando já sabemos quem é), 5 confirmar. Veio de um botão
      // de serviço (ou do passo a passo da busca)? já começa no profissional.
      if (servicoPreSelecionado) choices.servico = servicoPreSelecionado;
      // tatuagem sempre passa pelo passo 1: é lá que a pessoa conta a ideia
      current = servicoPreSelecionado && !ehTattoo() ? 2 : 1;
      carregarServicosWizard();
      montarBriefing();
      var passo1 = steps[0];
      passo1.querySelector('h2').textContent = ehTattoo() ? 'Qual sessão?' : 'Qual serviço?';
      passo1.querySelector('.hint').textContent = ehTattoo() ? 'Escolha o tipo de sessão e conte sua ideia.' : 'Comece pelo que você quer fazer.';
      if (saved && saved.nome && saved.telefone) {
        choices.nome = saved.nome;
        choices.telefone = saved.telefone;
        nomeInput.value = saved.nome;
        telefoneInput.value = saved.telefone;
        welcomeHint.textContent = 'Bem-vindo de volta, ' + saved.nome.split(' ')[0] + '! Já preenchemos seus dados — é só conferir.';
        welcomeHint.style.display = '';
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

    window.VBAgenda = { abrir: open };

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

      var eraContato = current === 4;
      if (eraContato) {
        try { localStorage.setItem(storageKey(), JSON.stringify({ nome: choices.nome, telefone: choices.telefone })); } catch (e) {}
      }

      if (current < totalSteps) {
        current++;
        // contato já conhecido (voltou ou entrou com a conta)? pula direto pro confirmar
        if (current === 4 && choices.nome && choices.telefone) current = 5;
        render();
        overlay.scrollTop = 0;
        return;
      }

      nextBtn.disabled = true;
      // foto de referência ainda subindo? espera antes de marcar
      (window.VBAnexoFotos && choices.b_fotos ? window.VBAnexoFotos.esperar(choices.b_fotos) : Promise.resolve()).then(function () { return db.rpc('tenant_agendar', {
        p_estabelecimento_id: estabId,
        p_cliente_nome: choices.nome || '',
        p_cliente_telefone: choices.telefone || '',
        p_staff_id: choices.profissionalKey && choices.profissionalKey !== 'qualquer' ? choices.profissionalKey : null,
        p_staff_nome: choices.profissional || null,
        p_servico: choices.servico || null,
        p_dia: choices.diaKey || null,
        p_dia_label: choices.dia || null,
        p_horario: choices.horario || '',
        p_detalhes: briefingDetalhes()
      }); }).then(function (res) {
        nextBtn.disabled = false;
        if (res.error) {
          window.VBDialogo.alert(res.error.message);
          current = 3;
          delete choices.horario; delete choices.horarioKey;
          render();
          atualizarHorarios();
          return;
        }
        var tel = (linhaAtual.telefone_whatsapp || '').replace(/\D/g, '');
        var msg = (ehTattoo() ? 'Olá! Quero agendar uma sessão de tatuagem:%0A' : 'Olá! Quero agendar um horário:%0A') +
          '• Nome: ' + encodeURIComponent(choices.nome || '') + '%0A' +
          '• Profissional: ' + encodeURIComponent(choices.profissional || '') + '%0A' +
          '• Serviço: ' + encodeURIComponent(choices.servico || '') + '%0A' +
          '• Dia: ' + encodeURIComponent(choices.dia || '') + '%0A' +
          '• Horário: ' + encodeURIComponent(choices.horario || '') +
          briefingLinhas().map(function (l) { return '%0A• ' + encodeURIComponent(l[0] + ': ' + l[1]); }).join('') +
          (ehTattoo() && !fotosBriefing().length ? '%0A%0A' + encodeURIComponent('Vou mandar a foto de referência por aqui.') : '');
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
    atualizarFundoDaFoto();
    // guarda o visual pra próxima visita abrir já no estilo certo e libera a tela
    if (window.VibeTemplates.lembrar) window.VibeTemplates.lembrar(templateAtualParaCor);
    window.VibeTemplates.quandoPronto().then(function () { document.documentElement.classList.remove('site-carregando'); });
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

    document.title = linha.nome;
    document.getElementById('tplNomeTopo').textContent = linha.nome;
    document.getElementById('tplNomeRodape').textContent = linha.nome;
    document.getElementById('tplCtaTexto').textContent = linha.texto_cta || (linha.segmento === 'tatuador' ? 'Agendar sessão' : 'Agendar horário');
    ligarOutraArea(linha);
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
    // "Bom saber": o que o dono respondeu sobre o negócio (perguntas-segmento.js)
    if (window.VBPerguntas) window.VBPerguntas.carregar(linha.id).then(function (r) { respostasNegocio = r; desenharBomSaber(r); });
    carregarRedesSociais();
    carregarPromocoesPublicas();
    iniciarModoAdmin();
    iniciarWizard();
    montarPassoSite(linha);
    iniciarClienteGlobal();
    verificarSessaoDono();

    // site incompleto (sem serviço ou sem equipe) pra quem visita? mostra
    // "em preparação" por cima de tudo (inclusive do gate de gênero, que
    // não faz sentido perguntar pra um site ainda vazio) — o conteúdo por
    // baixo continua sendo montado normal, então o admin edita tudo assim
    // que desbloqueia (linha acima já chama isso de novo).
    atualizarGateIncompleto();

    // veio de outra página do site (ex: institucional.html) com #agendar
    // na URL, ou do passo a passo da busca com #agendar=Serviço? abre a
    // agenda direto (com o serviço, assim que a lista de serviços chegar).
    if (/^#agendar(=|$)/.test(window.location.hash)) agendaPeloHash = true;
  }

  // "O próximo passo a um clique": uma pergunta só, com as ações que este
  // negócio oferece; cada uma leva pro passo a passo dela
  function montarPassoSite(linha) {
    if (!window.VBPassoSite) return;
    var areas = linha.areas || ['agenda'];
    var base = '/' + encodeURIComponent(linha.slug) + '/' + encodeURIComponent(linha.cidade);
    var urgente = SEG_URGENTE.indexOf(linha.segmento) !== -1;
    var tel = (linha.telefone_whatsapp || '').replace(/\D/g, '');
    var comentarios = false;
    if (window.VBAvaliacoes) {
      window.VBAvaliacoes.ligar(linha.id, document.querySelector('#tplClassico .site-footer')).then(function (ok) { comentarios = ok; });
    }
    window.VBPassoSite.montar({
      titulo: 'O que você quer fazer aqui?',
      sub: linha.nome,
      opcoes: function () {
        return [
          { rotulo: 'Agendar um horário', detalhe: 'serviço, profissional, dia e pronto', acao: function () { if (window.VBAgenda) window.VBAgenda.abrir(); } },
          areas.indexOf('delivery') !== -1 ? { rotulo: 'Fazer um pedido', detalhe: 'escolhe, coloca no carrinho e envia', href: base + '/pedir' } : null,
          areas.indexOf('servicos') !== -1 ? { rotulo: urgente ? 'Chamar agora' : 'Pedir um orçamento', detalhe: urgente ? 'manda sua localização e a gente vai' : 'conta o que precisa e recebe o valor', href: base + '/pedir' } : null,
          servicosCache.length ? { rotulo: 'Ver serviços e preços', detalhe: servicosCache.length + (servicosCache.length > 1 ? ' serviços' : ' serviço'), acao: function () { var s = document.getElementById('servicosSecao'); if (s) s.scrollIntoView({ behavior: 'smooth' }); } } : null,
          comentarios ? { rotulo: 'Deixar um comentário', detalhe: 'conta como foi o atendimento', acao: function () { window.VBAvaliacoes.comentar(); } } : null,
          tel ? { rotulo: 'Falar no WhatsApp', detalhe: linha.telefone_whatsapp, href: 'https://wa.me/55' + tel } : null
        ];
      }
    });
  }

  // Agenda + Delivery/Serviços no mesmo estabelecimento: o toggle da faixa
  // (espaço da plataforma, fora da área do estabelecimento) troca de área
  var SEG_URGENTE = ['borracharia', 'chaveiro', 'guincho', 'eletricista', 'encanador', 'assistencia_tecnica'];
  // deixa a loja/chamado já com os dados neste aparelho (cópia local), pra
  // troca pelo toggle abrir na hora mesmo onde não dá pra carregar a
  // página de antemão (iPhone)
  function aquecerOutraArea(linha) {
    if (!window.VBCache) return;
    var ir = function () {
      db.rpc('delivery_buscar_estabelecimento', { p_slug: linha.slug, p_cidade: linha.cidade }).then(function (r) {
        if (r.error || !r.data) return;
        db.rpc('delivery_cardapio_publico', { p_estabelecimento_id: r.data.id }).then(function (c) {
          window.VBCache.salvar('loja_' + linha.slug + '_' + linha.cidade, { estab: r.data, cardapio: (!c.error && c.data) || null, ident: linha });
        });
      });
    };
    if (window.requestIdleCallback) requestIdleCallback(ir, { timeout: 3000 }); else setTimeout(ir, 1200);
  }
  function ligarOutraArea(linha) {
    var areas = linha.areas || [];
    var temPedido = areas.indexOf('delivery') !== -1, temServico = areas.indexOf('servicos') !== -1;
    if ((!temPedido && !temServico) || !window.VibeToggle) return;
    var base = '/' + encodeURIComponent(linha.slug) + '/' + encodeURIComponent(linha.cidade);
    var urgente = SEG_URGENTE.indexOf(linha.segmento) !== -1;
    aquecerOutraArea(linha);
    window.VibeToggle.montar(document.getElementById('faixaAreas'), {
      tema: 'escuro', atual: 'agenda', swipe: true, semCubo: true, rotulo: 'O que você quer fazer',
      opcoes: [
        { chave: 'agenda', rotulo: 'Agendar', href: base },
        temPedido ? { chave: 'delivery', rotulo: 'Pedir', href: base + '/pedir' }
                  : { chave: 'servicos', rotulo: urgente ? 'Chamar' : 'Orçamento', href: base + '/pedir' }
      ]
    });
    var lista = document.querySelector('#siteMenu .site-menu-list');
    if (lista && !document.getElementById('menuOutraArea')) {
      var li = document.createElement('li');
      li.innerHTML = '<a id="menuOutraArea" href="' + base + '/pedir"><span>' + (temPedido ? 'Fazer pedido' : urgente ? 'Chamar agora' : 'Pedir orçamento') + '</span><span class="num">↗</span></a>';
      lista.appendChild(li);
    }
  }

  // chave com o endereço decodificado (igual à da loja, que guarda a cópia de lá)
  function semCodigo(t) { try { return decodeURIComponent(t); } catch (e) { return t; } }
  var chaveCachePerfil = 'perfil_' + semCodigo(slug) + '_' + semCodigo(cidade);
  // veio do toggle Agendar/Pedir e este aparelho viu o site há pouco? abre
  // na hora com o que já tinha (o banco só atualiza a cópia pra próxima)
  var veioDaTroca = false;
  try { veioDaTroca = sessionStorage.getItem('vbTrocaArea') === '1'; sessionStorage.removeItem('vbTrocaArea'); } catch (e) {}
  var copia = veioDaTroca && !/[?&](editar|tutorial|passo)=/.test(location.search) && window.VBCache ? window.VBCache.carregar(chaveCachePerfil) : null;
  var abriuDaCopia = !!(copia && copia.dados && Date.now() - copia.quando < 15 * 60 * 1000 && (copia.dados.areas || ['agenda']).indexOf('agenda') > -1);
  if (abriuDaCopia) renderizar(copia.dados);
  db.rpc('buscar_estabelecimento', { p_slug: slug, p_cidade: cidade }).then(function (res) {
    var linha = res.data && res.data[0];
    if (abriuDaCopia) { if (linha && window.VBCache) window.VBCache.salvar(chaveCachePerfil, linha); return; }
    if (res.error || !linha) {
      mostrarNaoEncontrado();
      return;
    }
    if (window.VBCache) window.VBCache.salvar(chaveCachePerfil, linha);
    // estabelecimento só de Delivery/Serviços (sem agenda): o site é a loja/chamado
    var areasLinha = linha.areas || ['agenda'];
    if (areasLinha.indexOf('agenda') === -1 && !/[?&]tutorial=1/.test(location.search)) {
      location.replace('/' + encodeURIComponent(slug) + '/' + encodeURIComponent(cidade) + '/pedir');
      return;
    }
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
