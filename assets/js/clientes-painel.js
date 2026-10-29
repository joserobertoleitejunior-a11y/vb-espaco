/* Lista de clientes do negócio — a mesma nos painéis de Agendar (cadastro.html)
   e de Pedir/Chamar (painel-area.html).

   Mostra TODO mundo que o negócio já teve, separado por o que fez:
     Agendou · Pediu · Só acessou (entrou na conta da Matriz e olhou o site)
   e, em cada um, tudo que o banco guardou (tenant_clients, mantida pelo próprio
   banco a cada agendamento/pedido/acesso — ver supabase/sql/2026-10-clientes-completos.sql).

   VBClientes.montar(caixa, { estabId, nome, aoExportar(linhas) }) */
(function (global) {
  'use strict';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fone(t) {
    t = String(t || '').replace(/\D/g, '');
    return t.length === 11 ? '(' + t.slice(0, 2) + ') ' + t.slice(2, 7) + '-' + t.slice(7) : t.length === 10 ? '(' + t.slice(0, 2) + ') ' + t.slice(2, 6) + '-' + t.slice(6) : t;
  }
  function quando(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function dia(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'; }
  function whats(tel, msg) {
    var d = String(tel || '').replace(/\D/g, '');
    return 'https://wa.me/' + (d.length <= 11 ? '55' : '') + d + (msg ? '?text=' + encodeURIComponent(msg) : '');
  }

  // o que ele fez de verdade (mais forte primeiro)
  function tipo(c) {
    var ag = c.agendamentos || 0, pe = c.pedidos || 0;
    if (ag && pe) return { chave: 'agendou', rotulo: 'Agendou e pediu', cor: 'ouro' };
    if (ag) return { chave: 'agendou', rotulo: 'Agendou', cor: 'verde' };
    if (pe) return { chave: 'pediu', rotulo: 'Pediu', cor: 'azul' };
    if (c.origem === 'agendamento') return { chave: 'acesso', rotulo: 'Cancelou', cor: 'cinza' };
    return { chave: 'acesso', rotulo: 'Só acessou', cor: 'cinza' };
  }
  function resumo(c) {
    var p = [];
    if (c.agendamentos) p.push(c.agendamentos + (c.agendamentos === 1 ? ' agendamento' : ' agendamentos'));
    if (c.pedidos) p.push(c.pedidos + (c.pedidos === 1 ? ' pedido' : ' pedidos'));
    if (!p.length) p.push(c.acessos ? c.acessos + (c.acessos === 1 ? ' acesso' : ' acessos') : 'sem atividade');
    return p.join(' · ');
  }

  var ROTULOS_BRIEFING = { local: 'Local do corpo', tamanho: 'Tamanho', estilo: 'Estilo', ideia: 'Ideia', maior_idade: 'Maior de 18', primeira_tattoo: 'Primeira tatuagem', referencia: 'Referência' };
  function linhaDado(rotulo, valor) { return valor ? '<div class="cl-dado"><span>' + esc(rotulo) + '</span><strong>' + esc(valor) + '</strong></div>' : ''; }
  function detalhes(c) {
    var d = c.dados || {}, b = d.briefing || {};
    return '<div class="cl-dados">' +
      linhaDado('Primeiro contato', quando(c.primeira_visita)) +
      linhaDado('Último acesso', c.ultimo_acesso ? quando(c.ultimo_acesso) : '') +
      linhaDado('Acessos (dias)', c.acessos ? String(c.acessos) : '') +
      linhaDado('Último agendamento', c.ultimo_agendamento ? quando(c.ultimo_agendamento) : '') +
      linhaDado('Último pedido', c.ultimo_pedido ? quando(c.ultimo_pedido) : '') +
      linhaDado('Último serviço', c.ultimo_servico) +
      linhaDado('Endereço', d.endereco) + linhaDado('Referência', d.referencia) +
      linhaDado('Veículo', [d.veiculo, d.modelo].filter(Boolean).join(' — ')) +
      Object.keys(ROTULOS_BRIEFING).map(function (k) {
        var v = b[k]; if (v === true) v = 'Sim'; if (v === false) v = 'Não';
        return linhaDado(ROTULOS_BRIEFING[k], v == null ? '' : String(v));
      }).join('') +
      '</div>';
  }

  function montar(caixa, opts) {
    var db = global.db, estabId = opts.estabId;
    caixa.innerHTML = '<div class="cl"><div class="skeleton" style="height:3rem;border-radius:14px;margin-bottom:.6rem"></div><div class="skeleton" style="height:5rem;border-radius:14px"></div></div>';
    return db.rpc('tenant_admin_listar_clientes', { p_estabelecimento_id: estabId }).then(function (res) {
      if (res.error) throw res.error;
      desenhar(caixa, opts, res.data || []);
    }).catch(function (e) {
      caixa.innerHTML = '<p class="cl-erro">' + esc((e && e.message) || 'Sem conexão agora.') + '</p>';
    });
  }

  function desenhar(caixa, opts, linhas) {
    var estabId = opts.estabId;
    var filtro = 'todos', busca = '';
    var cont = { todos: linhas.length, agendou: 0, pediu: 0, acesso: 0 };
    linhas.forEach(function (c) { cont[tipo(c).chave]++; });

    function visiveis() {
      var q = busca.toLowerCase().replace(/\s+/g, ' ').trim(), qd = q.replace(/\D/g, '');
      return linhas.filter(function (c) {
        if (filtro !== 'todos' && tipo(c).chave !== filtro) return false;
        if (!q) return true;
        return String(c.nome || '').toLowerCase().indexOf(q) > -1 || (qd && String(c.telefone).indexOf(qd) > -1);
      });
    }

    function lista() {
      var v = visiveis();
      if (!linhas.length) {
        return '<div class="cl-vazio"><strong>Nenhum cliente ainda</strong><p>Quem agendar ou pedir pelo seu site entra aqui sozinho, com nome, WhatsApp e tudo que escolheu. Quem só entrar na conta da Matriz e olhar o site aparece como “Só acessou”.</p></div>';
      }
      if (!v.length) return '<p class="cl-vazio-busca">Ninguém nessa busca.</p>';
      return v.map(function (c) {
        var t = tipo(c), i = linhas.indexOf(c);
        return '<div class="cl-item" data-cl="' + i + '">' +
          '<button type="button" class="cl-topo" data-cl-abrir="' + i + '" aria-expanded="false">' +
            '<span class="cl-quem"><strong>' + esc(c.nome) + '</strong><small>' + esc(fone(c.telefone)) + '</small></span>' +
            '<span class="cl-resto"><em class="cl-tag cl-' + t.cor + '">' + t.rotulo + '</em><small>' + esc(resumo(c)) + '</small></span>' +
          '</button>' +
          '<div class="cl-det oculto" id="clDet-' + i + '">' + detalhes(c) +
            '<div class="cl-acoes">' +
              '<a class="cl-btn" href="' + whats(c.telefone, 'Olá, ' + c.nome + '! Tudo bem?') + '" target="_blank" rel="noopener">Chamar no WhatsApp</a>' +
            '</div>' +
            '<p class="cl-sub">Histórico</p><div class="cl-hist" data-cl-hist="' + i + '"><p class="cl-vazio-busca">Carregando…</p></div>' +
          '</div></div>';
      }).join('');
    }
    function chips() {
      return [['todos', 'Todos'], ['agendou', 'Agendaram'], ['pediu', 'Pediram'], ['acesso', 'Só acessaram']].map(function (f) {
        return '<button type="button" class="cl-chip' + (filtro === f[0] ? ' ativo' : '') + '" data-cl-filtro="' + f[0] + '">' + f[1] + ' <b>' + cont[f[0]] + '</b></button>';
      }).join('');
    }
    function tudo() {
      caixa.innerHTML = '<div class="cl">' +
        '<p class="cl-intro">Todo mundo que agenda ou pede entra aqui sozinho. Quem entra na conta da Matriz e só olha o seu site aparece como “Só acessou”.</p>' +
        '<div class="cl-chips">' + chips() + '</div>' +
        (linhas.length > 4 ? '<input class="cl-busca" type="search" placeholder="Buscar por nome ou WhatsApp" value="' + esc(busca) + '">' : '') +
        (opts.aoExportar && linhas.length ? '<button type="button" class="cl-exportar" data-cl-exportar>Exportar PDF</button>' : '') +
        '<div class="cl-lista">' + lista() + '</div></div>';
      var b = caixa.querySelector('.cl-busca');
      if (b) b.addEventListener('input', function () {
        busca = b.value;
        caixa.querySelector('.cl-lista').innerHTML = lista();
      });
    }
    tudo();

    var carregados = {};
    caixa.addEventListener('click', function (e) {
      var f = e.target.closest('[data-cl-filtro]');
      if (f) { filtro = f.getAttribute('data-cl-filtro'); var pos = caixa.querySelector('.cl-busca'); tudo(); if (pos && busca) caixa.querySelector('.cl-busca').focus(); return; }
      if (e.target.closest('[data-cl-exportar]')) { opts.aoExportar(visiveis()); return; }

      var topo = e.target.closest('[data-cl-abrir]');
      if (!topo) return;
      var i = topo.getAttribute('data-cl-abrir');
      var det = document.getElementById('clDet-' + i);
      var abrir = det.classList.contains('oculto');
      det.classList.toggle('oculto', !abrir);
      topo.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      if (!abrir || carregados[i]) return;
      carregados[i] = true;
      global.db.rpc('tenant_admin_historico_cliente', { p_estabelecimento_id: estabId, p_telefone: linhas[i].telefone }).then(function (res) {
        var alvo = caixa.querySelector('[data-cl-hist="' + i + '"]');
        if (!alvo) return;
        var itens = res.data || [];
        alvo.innerHTML = itens.length ? itens.map(function (h) {
          return '<div class="cl-h"><span><strong>' + esc(h.titulo || '—') + '</strong><small>' + esc(quando(h.data)) + ' · ' + esc([h.detalhe, h.staff_nome].filter(Boolean).join(' · ')) + '</small></span>' +
            '<em>' + (h.tipo === 'venda' ? 'Venda' : h.tipo === 'pedido' ? 'Pedido' : 'Agendamento') + '</em></div>';
        }).join('') : '<p class="cl-vazio-busca">Ainda sem agendamentos ou pedidos — só acessou o site.</p>';
      }, function () {
        var alvo = caixa.querySelector('[data-cl-hist="' + i + '"]');
        if (alvo) alvo.innerHTML = '<p class="cl-erro">Não deu pra carregar o histórico agora.</p>';
      });
    });
  }

  global.VBClientes = { montar: montar, tipo: tipo, fone: fone };
})(window);
