/* Login por WhatsApp na página inicial (index.html) — mesma identidade
   global usada dentro de cada estabelecimento (ver vb-cliente-global.js),
   só que aqui não há um estabelecimento aberto pra registrar visita. */
(function () {
  if (!window.db || !window.VBClienteGlobal) return;

  function primeiroNome(nome) {
    return (nome || '').trim().split(/\s+/)[0] || nome || '';
  }

  function aplicarNaTela(cliente) {
    var btn = document.getElementById('clienteGlobalBtn');
    var saudacao = document.getElementById('clienteSaudacao');
    if (cliente) {
      if (btn) btn.textContent = 'Olá, ' + primeiroNome(cliente.nome);
      if (saudacao) {
        saudacao.textContent = 'Bem-vindo, ' + cliente.nome;
        saudacao.classList.remove('oculto');
      }
    } else {
      if (btn) btn.textContent = 'Entrar';
      if (saudacao) saudacao.classList.add('oculto');
    }
  }

  function iniciar() {
    var overlay = document.getElementById('clienteGlobalOverlay');
    var btn = document.getElementById('clienteGlobalBtn');
    if (!overlay || !btn) return;
    var estagioTelefone = document.getElementById('clienteGlobalEstagioTelefone');
    var estagioNome = document.getElementById('clienteGlobalEstagioNome');
    var telefoneInput = document.getElementById('clienteGlobalTelefoneInput');
    var nomeInput = document.getElementById('clienteGlobalNomeInput');
    var msg = document.getElementById('clienteGlobalMsg');
    var telefonePendente = '';

    aplicarNaTela(window.VBClienteGlobal.obter());

    function abrir() {
      estagioTelefone.classList.remove('oculto');
      estagioNome.classList.add('oculto');
      telefoneInput.value = '';
      nomeInput.value = '';
      msg.textContent = '';
      msg.className = 'msg';
      overlay.classList.remove('oculto');
      setTimeout(function () { telefoneInput.focus(); }, 50);
    }
    function fechar() { overlay.classList.add('oculto'); }

    btn.addEventListener('click', function () {
      var atual = window.VBClienteGlobal.obter();
      if (atual) {
        window.VBDialogo.confirm('Sair da sua conta VB Agenda neste site?').then(function (ok) {
          if (!ok) return;
          window.VBClienteGlobal.limpar();
          aplicarNaTela(null);
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
          aplicarNaTela({ telefone: achou.telefone, nome: achou.nome });
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
        aplicarNaTela({ telefone: criado.telefone, nome: criado.nome });
        fechar();
      }, function () {
        msg.className = 'msg msg-erro';
        msg.textContent = 'Sem conexão agora.';
      });
    });
  }

  iniciar();
})();
