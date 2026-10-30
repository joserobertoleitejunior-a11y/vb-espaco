/* Página /moderacao.html — só administradores da plataforma (vb_plataforma_admins).
   Lista os negócios, apaga um (com motivo) e mostra o registro de remoções. */
(function () {
  var estado = document.getElementById('mod-estado'), app = document.getElementById('mod-app');
  var lista = document.getElementById('mod-lista'), logEl = document.getElementById('mod-log');
  var busca = document.getElementById('mod-busca'), fundo = document.getElementById('mod-fundo');
  var alvo = null, timer = null;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function data(iso) { try { return new Date(iso).toLocaleDateString('pt-BR') + ' ' + new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function dizer(txt, erro) { estado.hidden = false; estado.className = 'mod-msg' + (erro ? ' erro' : ''); estado.innerHTML = txt; app.hidden = true; }

  function carregarLista() {
    db.rpc('admin_listar_negocios', { p_busca: busca.value || null }).then(function (r) {
      if (r.error) { lista.innerHTML = '<p class="mod-msg erro">' + esc(r.error.message) + '</p>'; return; }
      var l = r.data || [];
      lista.innerHTML = l.length ? l.map(function (n, i) {
        return '<div class="mod-item"><div><strong>' + esc(n.nome) + '</strong>' +
          '<small><a href="/' + encodeURIComponent(n.slug) + '/' + encodeURIComponent(n.cidade) + '" target="_blank" rel="noopener">/' + esc(n.slug) + '/' + esc(n.cidade) + '</a> · ' + esc(n.segmento || '') + '</small>' +
          '<small>Dono: ' + esc(n.dono_email || 'sem dono') + (n.outros_negocios > 0 ? ' (tem mais ' + n.outros_negocios + ' negócio(s))' : '') + '</small>' +
          '<small>Criado em ' + esc(data(n.criado_em)) + ' · ' + n.agendamentos + ' agendamento(s) · ' + n.clientes + ' cliente(s)</small></div>' +
          '<button type="button" class="mod-btn" data-i="' + i + '">Apagar conta</button></div>';
      }).join('') : '<p class="mod-vazio">Nenhum negócio encontrado.</p>';
      lista._dados = l;
    });
  }
  function carregarLog() {
    db.rpc('admin_listar_moderacao').then(function (r) {
      var l = (r && r.data) || [];
      logEl.innerHTML = l.length ? l.map(function (x) {
        return '<div class="mod-log"><b>' + esc(x.nome) + '</b> (' + esc(x.dono_email || '—') + ')<br>' + esc(x.motivo) + (x.detalhe ? ' — ' + esc(x.detalhe) : '') +
          '<br><span style="color:#6b6d75">' + esc(data(x.quando)) + (x.login_apagado ? ' · login do dono apagado' : '') + '</span></div>';
      }).join('') : '<p class="mod-vazio">Ainda não removeu nenhuma conta.</p>';
    });
  }

  busca.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(carregarLista, 300); });
  lista.addEventListener('click', function (e) {
    var b = e.target.closest('[data-i]'); if (!b) return;
    alvo = lista._dados[Number(b.getAttribute('data-i'))];
    document.getElementById('mod-resumo').textContent = alvo.nome + ' (' + (alvo.dono_email || 'sem dono') + ')';
    document.getElementById('mod-nome-conf').textContent = alvo.nome;
    ['mod-detalhe', 'mod-confirma'].forEach(function (id) { document.getElementById(id).value = ''; });
    document.getElementById('mod-login').checked = false;
    document.getElementById('mod-erro').hidden = true;
    document.getElementById('mod-apagar').disabled = true;
    fundo.hidden = false;
  });
  document.getElementById('mod-confirma').addEventListener('input', function () {
    document.getElementById('mod-apagar').disabled = !alvo || this.value.trim().toLowerCase() !== alvo.nome.trim().toLowerCase();
  });
  document.getElementById('mod-cancelar').addEventListener('click', function () { fundo.hidden = true; alvo = null; });
  document.getElementById('mod-apagar').addEventListener('click', function () {
    var btn = this, erro = document.getElementById('mod-erro');
    btn.disabled = true; erro.hidden = true;
    db.rpc('admin_apagar_negocio', {
      p_id: alvo.id, p_motivo: document.getElementById('mod-motivo').value,
      p_detalhe: document.getElementById('mod-detalhe').value, p_apagar_login: document.getElementById('mod-login').checked
    }).then(function (r) {
      if (r.error) { erro.textContent = r.error.message; erro.hidden = false; btn.disabled = false; return; }
      fundo.hidden = true; alvo = null; carregarLista(); carregarLog();
    }, function () { erro.textContent = 'Sem conexão. Tente de novo.'; erro.hidden = false; btn.disabled = false; });
  });

  if (!window.db) { dizer('Não consegui conectar. Confira a internet.', true); return; }
  db.auth.getSession().then(function (s) {
    if (!(s.data && s.data.session)) { dizer('Entre na sua conta primeiro: <a href="/cadastro.html">abrir o login</a>.'); return; }
    db.rpc('admin_sou_admin').then(function (r) {
      if (r.error || r.data !== true) { dizer('Esta página é só para a administração da Matriz.', true); return; }
      estado.hidden = true; app.hidden = false; carregarLista(); carregarLog();
    });
  });
})();
