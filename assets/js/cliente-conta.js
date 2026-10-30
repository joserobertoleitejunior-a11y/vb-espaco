/* Conta do cliente da Matriz: WhatsApp + senha de 6 números (e, se o
   aparelho tiver, entrar com rosto/digital — passkey, de graça).
   Uma tela só, usada no início, em qualquer site de negócio e no Meus
   agendamentos:
     WhatsApp → (tem senha?) senha de 6 números | criar conta (nome + senha)
              → (opcional) ativar rosto/digital neste aparelho
   Esqueci a senha: rosto/digital (se ativado) ou um código de 6 números
   que o estabelecimento manda pro seu WhatsApp.

   VBConta.entrar({ telefone, motivo, negocio: { nome, whatsapp } }) → Promise<cliente|null>
   VBConta.atual() → { telefone, nome } | null      VBConta.token()
   VBConta.sair()   VBConta.trocarSenha()           VBConta.conferir()
   A sessão fica em localStorage 'vbClienteConta' ({ token, telefone, nome }). */
(function (global) {
  'use strict';
  var CHAVE = 'vbClienteConta';
  var ROSTO = 'vbRostoAtivo_'; // + telefone: este aparelho tem passkey

  function ler() { try { var d = JSON.parse(localStorage.getItem(CHAVE) || 'null'); return d && d.token && d.telefone ? d : null; } catch (e) { return null; } }
  function gravar(d) { try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch (e) {} }
  function apagar() { try { localStorage.removeItem(CHAVE); localStorage.removeItem('vbClienteGlobal'); } catch (e) {} }
  function atual() { var d = ler(); return d ? { telefone: d.telefone, nome: d.nome, foto: d.foto || null } : null; }
  function token() { var d = ler(); return d ? d.token : null; }
  function soDigitos(v) { return String(v || '').replace(/\D/g, ''); }
  function formatar(t) { t = soDigitos(t); return t.length === 11 ? '(' + t.slice(0, 2) + ') ' + t.slice(2, 7) + '-' + t.slice(7) : t.length === 10 ? '(' + t.slice(0, 2) + ') ' + t.slice(2, 6) + '-' + t.slice(6) : t; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function msgErro(e, padrao) {
    var m = (e && (e.message || e.erro)) || '';
    if (/failed to fetch|network/i.test(m)) return 'Sem conexão agora — tente de novo.';
    return m || padrao || 'Não deu agora. Tente de novo.';
  }
  function rpc(nome, args) {
    return global.db.rpc(nome, args).then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  var temPasskey = !!(global.PublicKeyCredential && navigator.credentials && navigator.credentials.create);

  /* ---------- rosto/digital (WebAuthn, conferido na edge function cliente-passkey) ---------- */
  function funcao(corpo) {
    return global.db.functions.invoke('cliente-passkey', { body: corpo }).then(function (r) {
      if (r.error) {
        // o corpo do erro vem no context da resposta
        var ctx = r.error.context;
        if (ctx && ctx.json) return ctx.json().then(function (j) { throw new Error((j && j.erro) || 'Não deu agora.'); }, function () { throw r.error; });
        throw r.error;
      }
      if (r.data && r.data.erro) throw new Error(r.data.erro);
      return r.data;
    });
  }
  function b64(buf) { var s = ''; new Uint8Array(buf).forEach(function (x) { s += String.fromCharCode(x); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function deB64(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); var bin = atob(s + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(bin, function (c) { return c.charCodeAt(0); }); }

  function ativarRosto() {
    var d = ler();
    if (!d || !temPasskey) return Promise.reject(new Error('Este aparelho não tem rosto/digital pro navegador.'));
    return funcao({ acao: 'opcoes-registro', token: d.token }).then(function (op) {
      return navigator.credentials.create({ publicKey: {
        challenge: deB64(op.challenge),
        rp: { id: op.rpId, name: 'Matriz' },
        user: { id: deB64(op.userId), name: op.nome, displayName: op.apelido },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'required', requireResidentKey: true },
        excludeCredentials: (op.excluir || []).map(function (id) { return { type: 'public-key', id: deB64(id) }; }),
        timeout: 60000, attestation: 'none'
      } }).then(function (cred) {
        var r = cred.response;
        if (!r.getPublicKey) throw new Error('Navegador antigo: atualize pra usar rosto/digital.');
        return funcao({ acao: 'registrar', desafio_id: op.desafio_id, id: cred.id, clientDataJSON: b64(r.clientDataJSON), spki: b64(r.getPublicKey()), alg: r.getPublicKeyAlgorithm() });
      });
    }).then(function () { try { localStorage.setItem(ROSTO + d.telefone, '1'); } catch (e) {} return true; });
  }
  // telefone vazio = "Entrar com digital" direto: o celular mostra as contas salvas
  function entrarComRosto(telefone) {
    return funcao({ acao: 'opcoes-entrar', telefone: telefone || '' }).then(function (op) {
      return navigator.credentials.get({ publicKey: {
        challenge: deB64(op.challenge), rpId: op.rpId, userVerification: 'required', timeout: 60000,
        allowCredentials: (op.permitir || []).map(function (id) { return { type: 'public-key', id: deB64(id) }; })
      } }).then(function (cred) {
        var r = cred.response;
        return funcao({ acao: 'entrar', desafio_id: op.desafio_id, id: cred.id, clientDataJSON: b64(r.clientDataJSON), authenticatorData: b64(r.authenticatorData), signature: b64(r.signature) });
      });
    }).then(function (s) { gravar({ token: s.token, telefone: s.telefone, nome: s.nome }); try { localStorage.setItem(ROSTO + s.telefone, '1'); } catch (e) {} return s; });
  }
  function rostoAtivoAqui(tel) { try { return localStorage.getItem(ROSTO + tel) === '1'; } catch (e) { return false; } }

  /* ---------- a tela ---------- */
  var caixa = null, resolver = null, estado = {};
  function montar() {
    if (caixa) return caixa;
    caixa = document.createElement('div');
    caixa.className = 'vbc';
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-modal', 'true');
    caixa.innerHTML = '<div class="vbc-fundo" data-vbc-fechar></div><div class="vbc-painel"><button type="button" class="vbc-x" data-vbc-fechar aria-label="Fechar">×</button><div class="vbc-corpo"></div></div>';
    document.body.appendChild(caixa);
    caixa.addEventListener('click', function (e) { if (e.target.closest('[data-vbc-fechar]')) concluir(null); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && caixa.classList.contains('aberta')) concluir(null); });
    return caixa;
  }
  function concluir(cliente) {
    if (caixa) caixa.classList.remove('aberta');
    document.documentElement.classList.remove('vbc-travado');
    var r = resolver; resolver = null;
    if (r) r(cliente);
  }
  function tela(html, foco) {
    var corpo = montar().querySelector('.vbc-corpo');
    corpo.innerHTML = html;
    caixa.classList.add('aberta');
    document.documentElement.classList.add('vbc-travado');
    var alvo = corpo.querySelector(foco || 'input');
    if (alvo) setTimeout(function () { alvo.focus(); }, 60);
    return corpo;
  }
  function cab(titulo, sub) {
    return '<p class="vbc-marca">Matriz · sua conta</p><h2 class="vbc-titulo">' + titulo + '</h2>' + (sub ? '<p class="vbc-sub">' + sub + '</p>' : '');
  }
  // 6 caixinhas de senha, num campo só (o teclado numérico do celular abre)
  function campoSenha(id, rotulo) {
    return '<label class="vbc-rotulo" for="' + id + '">' + rotulo + '</label>' +
      '<div class="vbc-pin" data-pin="' + id + '"><input id="' + id + '" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" aria-label="' + esc(rotulo) + '">' +
      '<span></span><span></span><span></span><span></span><span></span><span></span></div>';
  }
  function ligarSenhas(corpo, aoCompletar) {
    corpo.querySelectorAll('.vbc-pin').forEach(function (pin) {
      var inp = pin.querySelector('input');
      var pontos = pin.querySelectorAll('span');
      inp.addEventListener('input', function () {
        inp.value = soDigitos(inp.value).slice(0, 6);
        pontos.forEach(function (p, i) { p.classList.toggle('cheio', i < inp.value.length); p.classList.toggle('vez', i === inp.value.length); });
        if (inp.value.length === 6 && aoCompletar) aoCompletar(inp);
      });
      pin.addEventListener('click', function () { inp.focus(); });
      pontos[0].classList.add('vez');
    });
  }
  function aviso(corpo, texto, ok) {
    var m = corpo.querySelector('.vbc-msg');
    if (m) { m.textContent = texto || ''; m.className = 'vbc-msg' + (texto ? (ok ? ' ok' : ' erro') : ''); }
  }
  function ocupado(btn, sim, rotulo) {
    if (!btn) return;
    if (sim) { btn.dataset.rotulo = btn.innerHTML; btn.disabled = true; btn.innerHTML = rotulo || 'Um instante…'; }
    else { btn.disabled = false; if (btn.dataset.rotulo) btn.innerHTML = btn.dataset.rotulo; }
  }

  // 1) WhatsApp
  function passoTelefone() {
    var corpo = tela(cab('Entre com seu WhatsApp', estado.motivo || 'Pra ver, remarcar e cancelar seus horários com segurança.') +
      '<label class="vbc-rotulo" for="vbcTel">WhatsApp com DDD</label>' +
      '<input class="vbc-campo" id="vbcTel" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(15) 99999-9999" value="' + esc(formatar(estado.telefone || '')) + '">' +
      '<p class="vbc-msg"></p><button type="button" class="vbc-btn" id="vbcSeguir">Continuar</button>' +
      (temPasskey ? '<div class="vbc-ou"><span>ou</span></div><button type="button" class="vbc-btn vbc-btn-rosto" id="vbcDigital">' + ICONE_DIGITAL + 'Entrar com digital</button>' : '') +
      '<p class="vbc-letra">Seus dados ficam só com você e com os negócios onde você agenda ou pede. <a href="/privacidade.html" target="_blank" rel="noopener">Privacidade</a></p>');
    var inp = corpo.querySelector('#vbcTel'), btn = corpo.querySelector('#vbcSeguir');
    inp.addEventListener('input', function () { var c = inp.selectionStart === inp.value.length; inp.value = formatar(inp.value); if (c) inp.selectionStart = inp.selectionEnd = inp.value.length; });
    function seguir() {
      var tel = soDigitos(inp.value);
      if (tel.length < 10 || tel.length > 11) return aviso(corpo, 'Digite o WhatsApp com DDD.');
      estado.telefone = tel;
      ocupado(btn, true);
      rpc('cliente_status', { p_telefone: tel }).then(function (st) {
        estado.status = st || {};
        if (st && st.tem_senha) passoSenha(); else passoCriar();
      }, function (e) { ocupado(btn, false); aviso(corpo, msgErro(e)); });
    }
    btn.addEventListener('click', seguir);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') seguir(); });
    var bd = corpo.querySelector('#vbcDigital');
    if (bd) bd.addEventListener('click', function () {
      ocupado(bd, true, 'Toque o sensor…');
      aviso(corpo, '');
      entrarComRosto('').then(function (s) { concluir({ telefone: s.telefone, nome: s.nome }); }, function (e) {
        ocupado(bd, false);
        aviso(corpo, e && e.name === 'NotAllowedError' ? 'Nenhuma digital salva aqui — entre com o WhatsApp e ative a digital depois.' : msgErro(e));
      });
    });
  }

  // 2a) já tem senha
  function passoSenha() {
    var rosto = temPasskey && estado.status.tem_rosto;
    var corpo = tela(cab('Digite sua senha', 'WhatsApp ' + esc(formatar(estado.telefone)) + ' · <button type="button" class="vbc-link" id="vbcTrocarTel">trocar</button>') +
      campoSenha('vbcPin', 'Senha de 6 números') +
      '<p class="vbc-msg"></p>' +
      (rosto ? '<button type="button" class="vbc-btn vbc-btn-rosto" id="vbcRosto">' + ICONE_ROSTO + 'Entrar com digital</button>' : '') +
      '<button type="button" class="vbc-link vbc-esqueci" id="vbcEsqueci">Esqueci a senha</button>', rosto && rostoAtivoAqui(estado.telefone) ? '#vbcRosto' : 'input');
    corpo.querySelector('#vbcTrocarTel').addEventListener('click', passoTelefone);
    corpo.querySelector('#vbcEsqueci').addEventListener('click', passoEsqueci);
    ligarSenhas(corpo, function (inp) {
      aviso(corpo, 'Conferindo…', true);
      rpc('cliente_entrar', { p_telefone: estado.telefone, p_pin: inp.value }).then(entrou, function (e) {
        inp.value = ''; inp.dispatchEvent(new Event('input'));
        corpo.querySelector('.vbc-pin').classList.add('vbc-treme');
        setTimeout(function () { var p = corpo.querySelector('.vbc-pin'); if (p) p.classList.remove('vbc-treme'); }, 450);
        aviso(corpo, msgErro(e, 'Senha errada.'));
      });
    });
    var br = corpo.querySelector('#vbcRosto');
    if (br) br.addEventListener('click', function () {
      ocupado(br, true, 'Olhe pro celular…');
      entrarComRosto(estado.telefone).then(function (s) { entrou(s); }, function (e) {
        ocupado(br, false);
        aviso(corpo, e && e.name === 'NotAllowedError' ? 'Cancelado. Use a senha ou tente de novo.' : msgErro(e));
      });
    });
  }

  // 2b) primeira vez (ou conta antiga sem senha): nome + senha
  function passoCriar() {
    var corpo = tela(cab('Crie sua conta', 'É rapidinho: seu nome e uma senha de 6 números pra proteger seus horários.') +
      '<label class="vbc-rotulo" for="vbcNome">Seu nome</label><input class="vbc-campo" id="vbcNome" autocomplete="name" maxlength="80" placeholder="Como te chamamos?">' +
      campoSenha('vbcPin1', 'Crie uma senha de 6 números') + campoSenha('vbcPin2', 'Repita a senha') +
      '<p class="vbc-msg"></p><button type="button" class="vbc-btn" id="vbcCriar">Criar minha conta</button>' +
      '<button type="button" class="vbc-link" id="vbcVoltar">Voltar</button>');
    ligarSenhas(corpo);
    corpo.querySelector('#vbcVoltar').addEventListener('click', passoTelefone);
    var btn = corpo.querySelector('#vbcCriar');
    btn.addEventListener('click', function () {
      var nome = corpo.querySelector('#vbcNome').value.trim(), p1 = corpo.querySelector('#vbcPin1').value, p2 = corpo.querySelector('#vbcPin2').value;
      if (nome.length < 2) return aviso(corpo, 'Digite seu nome.');
      if (p1.length !== 6) return aviso(corpo, 'A senha tem 6 números.');
      if (p1 !== p2) return aviso(corpo, 'As duas senhas não estão iguais.');
      ocupado(btn, true, 'Criando…');
      rpc('cliente_criar_conta', { p_telefone: estado.telefone, p_nome: nome, p_pin: p1 }).then(function (s) { entrou(s, true); }, function (e) { ocupado(btn, false); aviso(corpo, msgErro(e)); });
    });
  }

  // esqueci a senha
  function passoEsqueci() {
    var rosto = temPasskey && estado.status && estado.status.tem_rosto;
    var corpo = tela(cab('Criar uma senha nova', 'Escolha como confirmar que o WhatsApp é seu:') +
      (rosto ? '<button type="button" class="vbc-opcao" id="vbcPeloRosto">' + ICONE_ROSTO + '<span><strong>Com rosto ou digital</strong><small>Na hora, neste aparelho</small></span></button>' : '') +
      (rosto ? '' : '<div class="vbc-opcao vbc-opcao-info"><span><strong>Sem rosto ou digital neste aparelho</strong><small>Por segurança, nenhum negócio consegue criar senha por você. Entre num aparelho onde você ativou o rosto/digital, ou fale com o suporte da Matriz.</small></span></div>') +
      '<p class="vbc-msg"></p><button type="button" class="vbc-link" id="vbcVoltar">Voltar</button>');
    corpo.querySelector('#vbcVoltar').addEventListener('click', passoSenha);
    var pr = corpo.querySelector('#vbcPeloRosto');
    if (pr) pr.addEventListener('click', function () {
      entrarComRosto(estado.telefone).then(function (s) { estado.sessao = s; passoNovaSenha(); }, function (e) { aviso(corpo, e && e.name === 'NotAllowedError' ? 'Cancelado.' : msgErro(e)); });
    });
  }
  function passoCodigo() {
    var corpo = tela(cab('Código e senha nova', 'Digite o código que chegou no seu WhatsApp ' + esc(formatar(estado.telefone)) + '.') +
      campoSenha('vbcCod', 'Código de 6 números') + campoSenha('vbcPin1', 'Senha nova (6 números)') + campoSenha('vbcPin2', 'Repita a senha nova') +
      '<p class="vbc-msg"></p><button type="button" class="vbc-btn" id="vbcSalvar">Salvar senha nova</button><button type="button" class="vbc-link" id="vbcVoltar">Voltar</button>');
    corpo.querySelector('#vbcCod').type = 'text';
    ligarSenhas(corpo);
    corpo.querySelector('#vbcVoltar').addEventListener('click', passoEsqueci);
    var btn = corpo.querySelector('#vbcSalvar');
    btn.addEventListener('click', function () {
      var cod = corpo.querySelector('#vbcCod').value, p1 = corpo.querySelector('#vbcPin1').value, p2 = corpo.querySelector('#vbcPin2').value;
      if (cod.length !== 6) return aviso(corpo, 'O código tem 6 números.');
      if (p1.length !== 6) return aviso(corpo, 'A senha tem 6 números.');
      if (p1 !== p2) return aviso(corpo, 'As duas senhas não estão iguais.');
      ocupado(btn, true, 'Salvando…');
      rpc('cliente_redefinir_senha', { p_telefone: estado.telefone, p_codigo: cod, p_pin: p1 }).then(function (s) { entrou(s); }, function (e) { ocupado(btn, false); aviso(corpo, msgErro(e)); });
    });
  }
  // depois de entrar com rosto/digital, ou em "Trocar senha"
  function passoNovaSenha() {
    var corpo = tela(cab('Senha nova', 'Escolha 6 números fáceis de lembrar (e difíceis de adivinhar).') +
      campoSenha('vbcPin1', 'Senha nova') + campoSenha('vbcPin2', 'Repita a senha') +
      '<p class="vbc-msg"></p><button type="button" class="vbc-btn" id="vbcSalvar">Salvar</button>');
    ligarSenhas(corpo);
    var btn = corpo.querySelector('#vbcSalvar');
    btn.addEventListener('click', function () {
      var p1 = corpo.querySelector('#vbcPin1').value, p2 = corpo.querySelector('#vbcPin2').value;
      if (p1.length !== 6) return aviso(corpo, 'A senha tem 6 números.');
      if (p1 !== p2) return aviso(corpo, 'As duas senhas não estão iguais.');
      ocupado(btn, true, 'Salvando…');
      rpc('cliente_trocar_senha', { p_token: token(), p_pin: p1 }).then(function () {
        var d = ler(); concluir(d ? { telefone: d.telefone, nome: d.nome } : null);
        if (global.VBDialogo) global.VBDialogo.alert('Senha nova salva.');
      }, function (e) { ocupado(btn, false); aviso(corpo, msgErro(e)); });
    });
  }

  function entrou(s, novo) {
    gravar({ token: s.token, telefone: s.telefone, nome: s.nome });
    // conta nova: convida pra pôr a foto (dá pra pular); quem já tinha foto só entra
    if (novo) { passoFoto({ telefone: s.telefone, nome: s.nome }, function () { depoisDeEntrar(s, novo); }); return; }
    conferir().then(function () {});
    depoisDeEntrar(s, novo);
  }

  /* ---------- foto de perfil ---------- */
  function guardarFoto(dataUrl) {
    return rpc('cliente_trocar_foto', { p_token: token(), p_foto: dataUrl || null }).then(function () {
      var d = ler(); if (d) { d.foto = dataUrl || null; gravar(d); }
      if (global.VBAvatar && d) global.VBAvatar.guardar(d.telefone, dataUrl);
      return dataUrl || null;
    });
  }
  function escolherFoto(corpo, avatarEl, aoSalvar) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    return function (selfie) {
      if (selfie) inp.setAttribute('capture', 'user'); else inp.removeAttribute('capture');
      inp.onchange = function () {
        var f = inp.files && inp.files[0]; inp.value = '';
        if (!f) return;
        aviso(corpo, 'Salvando sua foto…', true);
        global.VBAvatar.reduzir(f).then(guardarFoto).then(function (url) {
          avatarEl.innerHTML = url ? '<img src="' + esc(url) + '" alt="">' : '<b>' + esc(global.VBAvatar.iniciais((atual() || {}).nome)) + '</b>';
          aviso(corpo, 'Foto salva!', true);
          if (aoSalvar) aoSalvar(url);
        }, function (e) { aviso(corpo, msgErro(e, 'Não deu pra salvar a foto.')); });
      };
      inp.click();
    };
  }
  function blocoFoto(nome, foto) {
    return '<div class="vbc-foto"><span class="vb-av vb-av-gg" id="vbcAv" style="--av:' + (global.VBAvatar ? global.VBAvatar.cor(nome) : '#0f6b5c') + '">' +
      (foto ? '<img src="' + esc(foto) + '" alt="">' : '<b>' + esc(global.VBAvatar ? global.VBAvatar.iniciais(nome) : '?') + '</b>') + '</span></div>';
  }
  function passoFoto(cliente, seguir) {
    if (!global.VBAvatar) { seguir(); return; }
    var corpo = tela(cab('Coloque sua foto', 'Assim quem te atende reconhece você. Fica ao lado do seu nome, igual nas redes sociais.') + blocoFoto(cliente.nome, null) +
      '<button type="button" class="vbc-btn" id="vbcSelfie">Tirar uma selfie</button>' +
      '<button type="button" class="vbc-btn vbc-btn-suave" id="vbcGaleria">Escolher da galeria</button>' +
      '<button type="button" class="vbc-link" id="vbcDepoisFoto">Agora não</button><p class="vbc-msg"></p>', '#vbcSelfie');
    var av = corpo.querySelector('#vbcAv'), pegar = escolherFoto(corpo, av, function () { setTimeout(seguir, 700); });
    corpo.querySelector('#vbcSelfie').addEventListener('click', function () { pegar(true); });
    corpo.querySelector('#vbcGaleria').addEventListener('click', function () { pegar(false); });
    corpo.querySelector('#vbcDepoisFoto').addEventListener('click', seguir);
  }
  // "Meus dados": foto, nome e senha numa tela só
  function perfil() {
    var c = atual();
    if (!c) return Promise.resolve(null);
    return new Promise(function (ok) {
      resolver = ok;
      var corpo = tela(cab('Seu perfil', formatar(c.telefone)) + blocoFoto(c.nome, c.foto) +
        '<div class="vbc-foto-acoes"><button type="button" class="vbc-mini" id="vbcSelfie">Tirar selfie</button><button type="button" class="vbc-mini" id="vbcGaleria">Galeria</button>' +
        (c.foto ? '<button type="button" class="vbc-mini" id="vbcSemFoto">Remover</button>' : '') + '</div>' +
        '<label class="vbc-rotulo" for="vbcNome">Seu nome</label><input class="vbc-campo" id="vbcNome" maxlength="80" value="' + esc(c.nome) + '" autocomplete="name">' +
        '<p class="vbc-msg"></p><button type="button" class="vbc-btn" id="vbcSalvarPerfil">Salvar</button>' +
        '<button type="button" class="vbc-link" id="vbcSenha">Trocar minha senha</button>', '#vbcNome');
      var av = corpo.querySelector('#vbcAv'), pegar = escolherFoto(corpo, av);
      corpo.querySelector('#vbcSelfie').addEventListener('click', function () { pegar(true); });
      corpo.querySelector('#vbcGaleria').addEventListener('click', function () { pegar(false); });
      var sem = corpo.querySelector('#vbcSemFoto');
      if (sem) sem.addEventListener('click', function () { guardarFoto(null).then(function () { perfil(); }, function (e) { aviso(corpo, msgErro(e)); }); });
      corpo.querySelector('#vbcSenha').addEventListener('click', function () { passoNovaSenha(); });
      var btn = corpo.querySelector('#vbcSalvarPerfil');
      btn.addEventListener('click', function () {
        var nome = corpo.querySelector('#vbcNome').value.trim();
        if (nome.length < 2) return aviso(corpo, 'Digite seu nome.');
        ocupado(btn, true, 'Salvando…');
        var depois = function () { var d = ler(); if (d) { d.nome = nome; gravar(d); } concluir(atual()); };
        if (nome === c.nome) { depois(); return; }
        rpc('cliente_trocar_nome', { p_token: token(), p_nome: nome }).then(depois, function (e) { ocupado(btn, false); aviso(corpo, msgErro(e)); });
      });
    });
  }

  function depoisDeEntrar(s, novo) {
    var cliente = { telefone: s.telefone, nome: s.nome };
    // oferece rosto/digital uma vez por aparelho, logo depois de entrar
    if (temPasskey && !rostoAtivoAqui(s.telefone)) {
      var corpo = tela(cab(novo ? 'Conta criada!' : 'Pronto, ' + esc((s.nome || '').split(' ')[0]) + '!', 'Quer entrar só com a digital (ou o rosto), da próxima vez, neste celular?') +
        '<button type="button" class="vbc-btn vbc-btn-rosto" id="vbcAtivar">' + ICONE_ROSTO + 'Ativar entrada com digital</button>' +
        '<button type="button" class="vbc-link" id="vbcDepois">Agora não</button><p class="vbc-msg"></p>', '#vbcAtivar');
      corpo.querySelector('#vbcDepois').addEventListener('click', function () { concluir(cliente); });
      var b = corpo.querySelector('#vbcAtivar');
      b.addEventListener('click', function () {
        ocupado(b, true, 'Olhe pro celular…');
        ativarRosto().then(function () { concluir(cliente); }, function (e) {
          ocupado(b, false);
          aviso(corpo, e && e.name === 'NotAllowedError' ? 'Tudo bem — dá pra ativar depois.' : msgErro(e));
        });
      });
      return;
    }
    concluir(cliente);
  }

  var ICONE_DIGITAL = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11v3.5c0 2-.5 3.8-1.5 5.5M8.5 9.2A4 4 0 0116 11v1.5M5 12a7 7 0 0111.2-5.6M5.2 15.5C5.1 14.4 5 13.2 5 12M19 12.2c0 3-.5 5.3-1.6 7.5M15.4 20.2c.6-1.6.9-3.2 1-4.7"/></svg>';
  var ICONE_ROSTO = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2"/><path d="M9 10v1M15 10v1M12 10v3h-1M9.5 15.5a3.5 3.5 0 005 0"/></svg>';
  var ICONE_WHATS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21c4.97 0 9-3.8 9-8.5S16.97 4 12 4s-9 3.8-9 8.5c0 1.7.5 3.2 1.4 4.5L3 21l4.3-1.3c1.3.8 2.9 1.3 4.7 1.3z"/></svg>';

  function entrar(opts) {
    opts = opts || {};
    estado = { telefone: soDigitos(opts.telefone || ''), motivo: opts.motivo || '', negocio: opts.negocio || null, status: {} };
    return new Promise(function (ok) {
      resolver = ok;
      if (estado.telefone.length >= 10) {
        rpc('cliente_status', { p_telefone: estado.telefone }).then(function (st) { estado.status = st || {}; if (st && st.tem_senha) passoSenha(); else passoCriar(); }, passoTelefone);
        tela(cab('Um instante…'));
      } else passoTelefone();
    });
  }
  function sair() {
    var t = token();
    apagar();
    if (t && global.db) global.db.rpc('cliente_sair', { p_token: t }).then(function () {}, function () {});
  }
  // a sessão salva ainda vale? (venceu, trocou a senha em outro aparelho…)
  function conferir() {
    var t = token();
    if (!t || !global.db) return Promise.resolve(null);
    return global.db.rpc('cliente_sessao', { p_token: t }).then(function (r) {
      if (r.error) return atual(); // sem conexão: não desloga
      if (!r.data) { apagar(); return null; }
      var d = ler(); if (d && ((r.data.nome && d.nome !== r.data.nome) || (r.data.foto || null) !== (d.foto || null))) { if (r.data.nome) d.nome = r.data.nome; d.foto = r.data.foto || null; gravar(d); }
      return atual();
    }, function () { return atual(); });
  }
  function trocarSenha() {
    estado = { telefone: (atual() || {}).telefone || '', status: {} };
    return new Promise(function (ok) { resolver = ok; passoNovaSenha(); });
  }

  /* ---------- dono do negócio (conta do Supabase) ---------- */
  function ativarDonoDigital() {
    if (!temPasskey) return Promise.reject(new Error('Este aparelho não tem digital pro navegador.'));
    return global.db.auth.getSession().then(function (r) {
      var sess = r.data && r.data.session;
      if (!sess) throw new Error('Entre com e-mail e senha primeiro.');
      return funcao({ acao: 'dono-opcoes-registro', jwt: sess.access_token });
    }).then(function (op) {
      return navigator.credentials.create({ publicKey: {
        challenge: deB64(op.challenge),
        rp: { id: op.rpId, name: 'Matriz' },
        user: { id: deB64(op.userId), name: op.nome, displayName: op.apelido },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'required', requireResidentKey: true },
        excludeCredentials: (op.excluir || []).map(function (id) { return { type: 'public-key', id: deB64(id) }; }),
        timeout: 60000, attestation: 'none'
      } }).then(function (cred) {
        var r = cred.response;
        if (!r.getPublicKey) throw new Error('Navegador antigo: atualize pra usar a digital.');
        return funcao({ acao: 'dono-registrar', desafio_id: op.desafio_id, id: cred.id, clientDataJSON: b64(r.clientDataJSON), spki: b64(r.getPublicKey()), alg: r.getPublicKeyAlgorithm() });
      });
    }).then(function () { try { localStorage.setItem('vbDonoDigital', '1'); } catch (e) {} return true; });
  }
  function entrarDonoDigital() {
    return funcao({ acao: 'dono-opcoes-entrar' }).then(function (op) {
      return navigator.credentials.get({ publicKey: { challenge: deB64(op.challenge), rpId: op.rpId, userVerification: 'required', timeout: 60000, allowCredentials: [] } }).then(function (cred) {
        var r = cred.response;
        return funcao({ acao: 'dono-entrar', desafio_id: op.desafio_id, id: cred.id, clientDataJSON: b64(r.clientDataJSON), authenticatorData: b64(r.authenticatorData), signature: b64(r.signature) });
      });
    }).then(function (s) {
      // o tipo mudou de nome entre versões do Supabase: tenta os dois
      return global.db.auth.verifyOtp({ token_hash: s.token_hash, type: 'magiclink' }).then(function (r) {
        if (!r.error) return r.data;
        return global.db.auth.verifyOtp({ token_hash: s.token_hash, type: 'email' }).then(function (r2) { if (r2.error) throw r.error; return r2.data; });
      });
    });
  }

  global.VBConta = {
    ativarDonoDigital: ativarDonoDigital, entrarDonoDigital: entrarDonoDigital,
    entrarComDigital: function () { return entrarComRosto('').then(function (s) { return { telefone: s.telefone, nome: s.nome }; }); }, entrar: entrar, atual: atual, token: token, sair: sair, conferir: conferir, trocarSenha: trocarSenha, perfil: perfil, ativarRosto: ativarRosto, temRosto: function () { return temPasskey; }, formatar: formatar };
})(window);
