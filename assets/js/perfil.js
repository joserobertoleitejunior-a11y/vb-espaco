/* Página pública /:slug/:cidade — o link que cada dono recebe e
   compartilha com os clientes dele. Lê os dois pedaços do caminho da
   URL (o Netlify reescreve pra /perfil.html mantendo a URL original —
   ver _redirects) e busca via RPC pública buscar_estabelecimento, com
   serviços, galeria e agendamento de verdade. */
(function () {
  if (!window.db) return;

  var partes = window.location.pathname.split('/').filter(Boolean);
  var slug = partes[0];
  var cidade = partes[1];

  var carregando = document.getElementById('carregando');
  var naoEncontrado = document.getElementById('naoEncontrado');
  var perfil = document.getElementById('perfil');
  var estabId = null;

  if (!slug || !cidade) {
    carregando.classList.add('oculto');
    naoEncontrado.classList.remove('oculto');
    return;
  }

  function mostrarNaoEncontrado() {
    carregando.classList.add('oculto');
    naoEncontrado.classList.remove('oculto');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function formatarPreco(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }

  function carregarServicos() {
    var lista = document.getElementById('listaServicosPerfil');
    var select = document.getElementById('agServico');
    db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      if (!linhas.length) {
        lista.innerHTML = '<li style="border:none; color:var(--tinta-suave);">Serviços em breve.</li>';
        select.innerHTML = '<option value="">Nenhum serviço cadastrado ainda</option>';
        select.disabled = true;
        return;
      }
      lista.innerHTML = linhas.map(function (s) {
        return '<li><span class="nome">' + escapeHtml(s.nome) + '</span><span class="cidade">' + formatarPreco(s.preco) + '</span></li>';
      }).join('');
      select.innerHTML = linhas.map(function (s) {
        return '<option value="' + escapeHtml(s.nome) + '">' + escapeHtml(s.nome) + ' — ' + formatarPreco(s.preco) + '</option>';
      }).join('');
    });
  }

  function carregarGaleria() {
    db.rpc('tenant_listar_galeria', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      if (!linhas.length) return;
      var grade = document.getElementById('gradeGaleria');
      grade.innerHTML = linhas.slice(0, 9).map(function (g) {
        return '<img src="' + escapeHtml(g.foto_url) + '" alt="" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px;" loading="lazy">';
      }).join('');
      document.getElementById('cardGaleria').classList.remove('oculto');
    });
  }

  document.getElementById('formAgendar').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = document.getElementById('agendarMsg');
    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    msg.className = 'msg';
    msg.textContent = 'Agendando…';

    var dia = document.getElementById('agDia').value;
    var dataObj = dia ? new Date(dia + 'T00:00:00') : null;
    var diaLabel = dataObj ? dataObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : dia;

    db.rpc('tenant_criar_agendamento', {
      p_estabelecimento_id: estabId,
      p_cliente_nome: document.getElementById('agNome').value.trim(),
      p_cliente_telefone: document.getElementById('agTelefone').value.trim(),
      p_staff_id: null,
      p_staff_nome: null,
      p_servico: document.getElementById('agServico').value || null,
      p_dia: dia,
      p_dia_label: diaLabel,
      p_horario: document.getElementById('agHorario').value
    }).then(function (res) {
      btn.disabled = false;
      if (res.error) {
        msg.className = 'msg msg-erro';
        msg.textContent = res.error.message;
        return;
      }
      msg.className = 'msg msg-ok';
      msg.textContent = 'Agendamento confirmado! ✓';
      document.getElementById('formAgendar').reset();
    }, function () {
      btn.disabled = false;
      msg.className = 'msg msg-erro';
      msg.textContent = 'Sem conexão agora — tenta de novo em instantes.';
    });
  });

  function renderizar(linha) {
    carregando.classList.add('oculto');
    estabId = linha.id;

    var segmentos = {
      barbearia: 'Barbearia',
      salao: 'Salão de beleza',
      manicure_pedicure: 'Manicure e pedicure',
      estetica: 'Estética',
      outro: 'Estabelecimento'
    };

    document.title = linha.nome + ' — VB Agenda';
    document.getElementById('perfilSegmento').textContent = segmentos[linha.segmento] || 'Estabelecimento';
    document.getElementById('perfilNome').textContent = linha.nome;
    document.getElementById('perfilCidade').textContent = linha.cidade.charAt(0).toUpperCase() + linha.cidade.slice(1);
    document.getElementById('perfilHeader').style.background = linha.cor_destaque || '#C9A227';

    if (linha.telefone_whatsapp) {
      var btn = document.getElementById('whatsappBtn');
      btn.href = 'https://wa.me/55' + linha.telefone_whatsapp.replace(/\D/g, '');
      btn.classList.remove('oculto');
    }

    perfil.classList.remove('oculto');
    carregarServicos();
    carregarGaleria();
  }

  db.rpc('buscar_estabelecimento', { p_slug: slug, p_cidade: cidade }).then(function (res) {
    var linha = res.data && res.data[0];
    if (res.error || !linha) {
      mostrarNaoEncontrado();
      return;
    }
    renderizar(linha);
  }, mostrarNaoEncontrado);
})();
