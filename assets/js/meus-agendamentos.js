/* "Meus agendamentos" — painel do cliente (login só por telefone) pra ver,
   remarcar e cancelar os próprios agendamentos em qualquer estabelecimento
   da plataforma, direto na página inicial (index.html). Abre a partir do
   próprio botão "Olá, {nome}" do topo (ver vb-cliente-global-index.js). */
(function () {
  if (!window.db) return;

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function formatarData(diaIso) {
    var partes = (diaIso || '').split('-');
    if (partes.length !== 3) return diaIso;
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  function iniciar() {
    var overlay = document.getElementById('meusAgendamentosOverlay');
    var corpo = document.getElementById('magCorpo');
    var fechar = document.getElementById('magFechar');
    var sairBtn = document.getElementById('magSair');
    if (!overlay || !corpo || !window.VBClienteGlobal) return;

    function carregar() {
      var cliente = window.VBClienteGlobal.obter();
      if (!cliente) return;
      corpo.innerHTML = '<div class="skeleton" style="height:1.4rem; margin-bottom:0.5rem;"></div><div class="skeleton" style="height:1rem; width:60%;"></div>';
      db.rpc('cliente_listar_meus_agendamentos', { p_telefone: cliente.telefone }).then(function (res) {
        var linhas = res.data || [];
        if (!linhas.length) {
          corpo.innerHTML = '<p style="color:var(--tinta-suave); font-size:0.9rem;">Você ainda não tem agendamentos.</p>';
          return;
        }
        corpo.innerHTML = linhas.map(function (a) {
          var cancelado = a.status === 'cancelado';
          return '<div style="border-bottom:1px solid var(--borda); padding:0.8rem 0;' + (cancelado ? ' opacity:0.55;' : '') + '">' +
            '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:0.5rem;">' +
            '<span class="principal" style="font-weight:700;">' + escapeHtml(a.estabelecimento_nome) + '</span>' +
            '<span class="secundario" style="color:var(--tinta-suave); font-size:0.8rem;">' + escapeHtml(a.estabelecimento_cidade) + '</span>' +
            '</div>' +
            '<div class="secundario" style="color:var(--tinta-suave); font-size:0.85rem; margin:0.25rem 0;">' + escapeHtml(a.servico || '') + (a.staff_nome ? ' · ' + escapeHtml(a.staff_nome) : '') + '</div>' +
            '<div style="font-weight:700;">' + formatarData(a.dia) + ' às ' + escapeHtml(a.horario) + (cancelado ? ' · Cancelado' : '') + '</div>' +
            (cancelado ? '' :
              '<div style="display:flex; gap:0.5rem; margin-top:0.6rem;">' +
              '<button type="button" class="btn btn-ghost" data-remarcar="' + a.id + '" data-estab="' + a.estabelecimento_id + '" data-staff="' + (a.staff_id || '') + '" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Remarcar</button>' +
              '<button type="button" class="btn btn-ghost" data-cancelar="' + a.id + '" style="padding:0.4rem 0.8rem; font-size:0.8rem; color:var(--erro,#b5442e); border-color:var(--erro,#b5442e);">Cancelar</button>' +
              '</div>' +
              '<div class="oculto" id="magRemarcar' + a.id + '" style="margin-top:0.6rem;"></div>') +
            '</div>';
        }).join('');

        corpo.querySelectorAll('[data-cancelar]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            window.VBDialogo.confirm('Cancelar esse agendamento? Não tem como desfazer.').then(function (ok) {
              if (!ok) return;
              db.rpc('cliente_cancelar_agendamento', { p_id: btn.getAttribute('data-cancelar'), p_telefone: cliente.telefone }).then(carregar);
            });
          });
        });

        corpo.querySelectorAll('[data-remarcar]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-remarcar');
            var estabId = btn.getAttribute('data-estab');
            var staffId = btn.getAttribute('data-staff') || null;
            var painel = document.getElementById('magRemarcar' + id);
            var abrindo = painel.classList.contains('oculto');
            if (!abrindo) { painel.classList.add('oculto'); return; }
            painel.innerHTML =
              '<input type="date" id="magData' + id + '" style="width:100%; box-sizing:border-box; padding:0.5rem; border-radius:8px; border:1px solid var(--borda); margin-bottom:0.5rem;">' +
              '<div id="magSlots' + id + '" style="display:flex; flex-wrap:wrap; gap:0.4rem;"></div>';
            painel.classList.remove('oculto');
            var dataInput = document.getElementById('magData' + id);
            dataInput.min = new Date().toISOString().slice(0, 10);
            dataInput.addEventListener('change', function () {
              var diaIso = dataInput.value;
              if (!diaIso) return;
              var slotsEl = document.getElementById('magSlots' + id);
              slotsEl.textContent = 'Carregando…';
              db.rpc('tenant_public_agenda_slots', { p_estabelecimento_id: estabId, p_dia: diaIso, p_staff_id: staffId }).then(function (res) {
                var slots = (res.data || []).filter(function (s) { return s.disponivel; });
                if (!slots.length) { slotsEl.innerHTML = '<span style="color:var(--tinta-suave); font-size:0.85rem;">Sem horários livres nesse dia.</span>'; return; }
                var diaLabel = new Date(diaIso + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
                slotsEl.innerHTML = slots.map(function (s) {
                  return '<button type="button" class="btn btn-ghost" data-slot="' + escapeHtml(s.horario) + '" style="padding:0.35rem 0.7rem; font-size:0.8rem;">' + escapeHtml(s.horario) + '</button>';
                }).join('');
                slotsEl.querySelectorAll('[data-slot]').forEach(function (slotBtn) {
                  slotBtn.addEventListener('click', function () {
                    db.rpc('cliente_reagendar_agendamento', {
                      p_id: id, p_telefone: cliente.telefone, p_dia: diaIso, p_dia_label: diaLabel, p_horario: slotBtn.getAttribute('data-slot')
                    }).then(function (res2) {
                      if (res2.error) { window.VBDialogo.alert(res2.error.message); return; }
                      carregar();
                    });
                  });
                });
              });
            });
          });
        });
      }, function () {
        corpo.innerHTML = '<p style="color:var(--erro,#b5442e); font-size:0.9rem;">Sem conexão agora — tenta de novo em instantes.</p>';
      });
    }

    fechar.addEventListener('click', function () { overlay.classList.add('oculto'); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.add('oculto'); });
    sairBtn.addEventListener('click', function () {
      window.VBDialogo.confirm('Sair da sua conta VB Agenda neste site?').then(function (ok) {
        if (!ok) return;
        window.VBClienteGlobal.limpar();
        overlay.classList.add('oculto');
        window.location.reload();
      });
    });

    window.VBMeusAgendamentos = {
      abrir: function () { overlay.classList.remove('oculto'); carregar(); }
    };
  }

  iniciar();
})();
