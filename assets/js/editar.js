/* Painel de edição do estabelecimento — serviços, equipe, horários,
   galeria e agenda. TEMPORÁRIO: sem checar dono ainda (ver
   TESTE_SEM_LOGIN em cadastro.js) — qualquer um com o link ?id= edita. */
(function () {
  if (!window.db) return;

  var params = new URLSearchParams(window.location.search);
  var estabId = params.get('id');
  if (!estabId) {
    document.getElementById('tituloEstab').textContent = 'Link inválido — falta o ?id= do estabelecimento.';
    return;
  }

  var DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function formatarPreco(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }

  // ---- cabeçalho ----
  db.rpc('buscar_estabelecimento_por_id', { p_id: estabId }).then(function (res) {
    var linha = res.data && res.data[0];
    if (res.error || !linha) {
      document.getElementById('tituloEstab').textContent = 'Estabelecimento não encontrado.';
      return;
    }
    document.getElementById('tituloEstab').textContent = 'Editando: ' + linha.nome;
    document.getElementById('verPerfilBtn').href = '/' + encodeURIComponent(linha.slug) + '/' + encodeURIComponent(linha.cidade);
  });

  // ---- serviços ----
  var SEGMENTO_LABEL = { masculino: 'Masculino', feminino: 'Feminino', unissex: 'Unissex' };
  function carregarServicos() {
    var lista = document.getElementById('listaServicos');
    lista.innerHTML = '<li><span class="skeleton" style="width:60%;"></span></li>';
    db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = (res.data || []);
      if (!linhas.length) { lista.innerHTML = '<li style="border:none;">Nenhum serviço cadastrado ainda.</li>'; return; }
      lista.innerHTML = linhas.map(function (s) {
        return '<li><span><span class="nome">' + escapeHtml(s.nome) + '</span><br>' +
          '<span class="cidade">' + formatarPreco(s.preco) + ' · ' + SEGMENTO_LABEL[s.categoria] + '</span></span>' +
          '<button class="btn btn-ghost" type="button" style="padding:0.4rem 0.7rem; font-size:0.8rem;" data-remover-servico="' + s.id + '">Remover</button></li>';
      }).join('');
    }, function () { lista.innerHTML = '<li style="border:none;">Sem conexão agora.</li>'; });
  }
  document.getElementById('formServico').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = document.getElementById('servMsg');
    msg.textContent = 'Salvando…'; msg.className = 'msg';
    db.rpc('tenant_admin_salvar_servico', {
      p_estabelecimento_id: estabId, p_id: null,
      p_nome: document.getElementById('servNome').value.trim(),
      p_preco: parseFloat(document.getElementById('servPreco').value) || 0,
      p_categoria: document.getElementById('servCategoria').value
    }).then(function (res) {
      if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
      msg.className = 'msg msg-ok'; msg.textContent = 'Serviço adicionado!';
      document.getElementById('formServico').reset();
      carregarServicos();
    }, function () { msg.className = 'msg msg-erro'; msg.textContent = 'Sem conexão agora.'; });
  });
  document.getElementById('listaServicos').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remover-servico]');
    if (!btn) return;
    db.rpc('tenant_admin_remover_servico', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-servico') }).then(carregarServicos);
  });

  // ---- equipe ----
  function carregarEquipe() {
    var lista = document.getElementById('listaEquipe');
    lista.innerHTML = '<li><span class="skeleton" style="width:60%;"></span></li>';
    db.rpc('tenant_listar_equipe', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = (res.data || []);
      if (!linhas.length) { lista.innerHTML = '<li style="border:none;">Nenhum membro cadastrado ainda.</li>'; return; }
      lista.innerHTML = linhas.map(function (p) {
        return '<li><span><span class="nome">' + escapeHtml(p.nome) + '</span><br>' +
          '<span class="cidade">' + escapeHtml(p.especialidade || '—') + '</span></span>' +
          '<button class="btn btn-ghost" type="button" style="padding:0.4rem 0.7rem; font-size:0.8rem;" data-remover-membro="' + p.id + '">Remover</button></li>';
      }).join('');
    }, function () { lista.innerHTML = '<li style="border:none;">Sem conexão agora.</li>'; });
  }
  document.getElementById('formEquipe').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = document.getElementById('eqMsg');
    msg.textContent = 'Salvando…'; msg.className = 'msg';
    db.rpc('tenant_admin_salvar_membro', {
      p_estabelecimento_id: estabId, p_id: null,
      p_nome: document.getElementById('eqNome').value.trim(),
      p_especialidade: document.getElementById('eqEspecialidade').value.trim() || null,
      p_foto_url: document.getElementById('eqFoto').value.trim() || null
    }).then(function (res) {
      if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
      msg.className = 'msg msg-ok'; msg.textContent = 'Adicionado à equipe!';
      document.getElementById('formEquipe').reset();
      carregarEquipe();
    }, function () { msg.className = 'msg msg-erro'; msg.textContent = 'Sem conexão agora.'; });
  });
  document.getElementById('listaEquipe').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remover-membro]');
    if (!btn) return;
    db.rpc('tenant_admin_remover_membro', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-membro') }).then(carregarEquipe);
  });

  // ---- horários ----
  function carregarHorarios() {
    var wrap = document.getElementById('listaHorarios');
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
  document.getElementById('listaHorarios').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-salvar-horario]');
    if (!btn) return;
    var linha = btn.closest('[data-linha-horario]');
    var msg = document.getElementById('horMsg');
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

  // ---- galeria ----
  function carregarGaleria() {
    var lista = document.getElementById('listaGaleria');
    lista.innerHTML = '<li><span class="skeleton" style="width:60%;"></span></li>';
    db.rpc('tenant_listar_galeria', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = (res.data || []);
      if (!linhas.length) { lista.innerHTML = '<li style="border:none;">Nenhuma foto ainda.</li>'; return; }
      lista.innerHTML = linhas.map(function (g) {
        return '<li><span class="nome" style="word-break:break-all; max-width:70%;">' + escapeHtml(g.foto_url) + '</span>' +
          '<button class="btn btn-ghost" type="button" style="padding:0.4rem 0.7rem; font-size:0.8rem;" data-remover-foto="' + g.id + '">Remover</button></li>';
      }).join('');
    }, function () { lista.innerHTML = '<li style="border:none;">Sem conexão agora.</li>'; });
  }
  document.getElementById('formGaleria').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = document.getElementById('galMsg');
    msg.textContent = 'Salvando…'; msg.className = 'msg';
    db.rpc('tenant_admin_adicionar_foto', { p_estabelecimento_id: estabId, p_foto_url: document.getElementById('galFoto').value.trim(), p_staff_id: null }).then(function (res) {
      if (res.error) { msg.className = 'msg msg-erro'; msg.textContent = res.error.message; return; }
      msg.className = 'msg msg-ok'; msg.textContent = 'Foto adicionada!';
      document.getElementById('formGaleria').reset();
      carregarGaleria();
    }, function () { msg.className = 'msg msg-erro'; msg.textContent = 'Sem conexão agora.'; });
  });
  document.getElementById('listaGaleria').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remover-foto]');
    if (!btn) return;
    db.rpc('tenant_admin_remover_foto', { p_estabelecimento_id: estabId, p_id: btn.getAttribute('data-remover-foto') }).then(carregarGaleria);
  });

  // ---- agenda ----
  function carregarAgenda() {
    var lista = document.getElementById('listaAgenda');
    lista.innerHTML = '<li><span class="skeleton" style="width:60%;"></span></li>';
    db.rpc('tenant_admin_listar_agenda', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = (res.data || []);
      if (!linhas.length) { lista.innerHTML = '<li style="border:none;">Nenhum agendamento ainda.</li>'; return; }
      lista.innerHTML = linhas.map(function (a) {
        return '<li><span><span class="nome">' + escapeHtml(a.cliente_nome) + ' — ' + escapeHtml(a.servico || '') + '</span><br>' +
          '<span class="cidade">' + escapeHtml(a.dia_label || a.dia) + ' às ' + escapeHtml(a.horario) + ' · ' + escapeHtml(a.status) + '</span></span></li>';
      }).join('');
    }, function () { lista.innerHTML = '<li style="border:none;">Sem conexão agora.</li>'; });
  }

  carregarServicos();
  carregarEquipe();
  carregarHorarios();
  carregarGaleria();
  carregarAgenda();
})();
