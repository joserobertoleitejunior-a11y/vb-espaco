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

  var SEGMENTOS = {
    barbearia: 'Barbearia',
    salao: 'Salão de beleza',
    manicure_pedicure: 'Manicure e pedicure',
    estetica: 'Estética',
    outro: 'Estabelecimento'
  };

  var COPY = {
    masculino: { headline: 'Seu estilo, sem complicação.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
    feminino: { headline: 'Sua beleza merece hora marcada.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' }
  };

  // ---------- gênero: fixo (masculino/feminino) ou "ambos" (com gate) ----------
  var SESSION_KEY = 'vbGeneroSessao_' + slug + '_' + cidade;

  function aplicarGenero(g) {
    generoAtual = g;
    var femCss = document.getElementById('tplFeminino');
    femCss.disabled = (g !== 'feminino');

    var nome = linhaAtual.nome;
    document.getElementById('tplEyebrow').textContent = (SEGMENTOS[linhaAtual.segmento] || 'Estabelecimento') + ' · ' + linhaAtual.cidade;
    document.getElementById('tplHeadline').textContent = COPY[g].headline;
    document.getElementById('tplSubcopy').textContent = COPY[g].sub;

    var trocaBtn = document.getElementById('tplTrocaGenero');
    if (linhaAtual.genero_atendimento === 'ambos') {
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

  function iniciarGenero() {
    if (linhaAtual.genero_atendimento !== 'ambos') {
      document.getElementById('genderGate').remove();
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

  function carregarServicos() {
    var lista = document.getElementById('tplListaServicos');
    var select = document.getElementById('agServico');
    var strip = document.getElementById('tplServiceStrip');
    db.rpc('tenant_listar_servicos', { p_estabelecimento_id: estabId }).then(function (res) {
      var linhas = res.data || [];
      strip.innerHTML =
        '<button type="button" class="service-badge" onclick="document.getElementById(\'agendarSecao\').scrollIntoView({behavior:\'smooth\'})"><span class="mark">' + ICONE_TESOURA + '</span><strong>Ver</strong><span>Serviços</span></button>' +
        '<a href="#agendarSecao" class="service-badge"><span class="mark">' + ICONE_AGENDA + '</span><strong>Agendar</strong><span>Horário</span></a>';

      if (!linhas.length) {
        lista.innerHTML = '<li style="border:none; color:var(--ink-soft);">Serviços em breve.</li>';
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
      document.getElementById('tplGrid').innerHTML = linhas.slice(0, 9).map(function (g) {
        return '<img src="' + escapeHtml(g.foto_url) + '" alt="" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:6px;" loading="lazy">';
      }).join('');
      document.getElementById('tplGaleriaSecao').classList.remove('oculto');
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
    linhaAtual = linha;

    document.title = linha.nome + ' — VB Agenda';
    document.getElementById('tplNomeTopo').textContent = linha.nome;
    document.getElementById('tplNomeRodape').textContent = linha.nome;
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
      var wa = document.getElementById('whatsappBtn');
      wa.href = 'https://wa.me/55' + tel;
      wa.classList.remove('oculto');
    } else {
      document.getElementById('tplTelefoneMenu').closest('p').style.display = 'none';
    }

    var cor = (linha.cor_destaque || '#C9A227').replace('#', '');
    var padraoSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect x='9' y='9' width='54' height='54' rx='6' fill='none' stroke='%23" + cor + "' stroke-opacity='0.4' stroke-width='1.6'/%3E%3Crect x='18' y='18' width='36' height='36' rx='3' fill='none' stroke='%23" + cor + "' stroke-opacity='0.4' stroke-width='1.1'/%3E%3C/svg%3E";
    document.getElementById('tplHeroFoto').style.background =
      'var(--linen-deep) url("' + padraoSvg + '")';

    tpl.classList.remove('oculto');
    iniciarGenero();
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
