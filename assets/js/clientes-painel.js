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
          '<button type="button" class="cl-topo" data-cl-abrir="' + i + '" aria-haspopup="dialog">' +
            '<span class="cl-quem">' + (global.VBAvatar ? global.VBAvatar.html(c.nome, c.telefone, 'm') : '') +
              '<span class="cl-nomes"><strong>' + esc(c.nome) + '</strong><small>' + esc(fone(c.telefone)) + '</small></span></span>' +
            '<span class="cl-resto"><em class="cl-tag cl-' + t.cor + '">' + t.rotulo + '</em><small>' + esc(resumo(c)) + '</small></span>' +
          '</button></div>';
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
        if (global.VBAvatar) global.VBAvatar.hidratar(estabId, caixa);
      });
    }
    tudo();
    if (global.VBAvatar) global.VBAvatar.hidratar(estabId, caixa);

    var carregados = {};
    caixa.addEventListener('click', function (e) {
      var f = e.target.closest('[data-cl-filtro]');
      if (f) { filtro = f.getAttribute('data-cl-filtro'); var pos = caixa.querySelector('.cl-busca'); tudo(); if (pos && busca) caixa.querySelector('.cl-busca').focus(); if (global.VBAvatar) global.VBAvatar.hidratar(estabId, caixa); return; }
      if (e.target.closest('[data-cl-exportar]')) { opts.aoExportar(visiveis()); return; }

      var topo = e.target.closest('[data-cl-abrir]');
      if (!topo) return;
      cartao(linhas[topo.getAttribute('data-cl-abrir')], estabId);
    });
  }

  /* ---------- cartão flutuante do cliente (com efeito de digitando) ---------- */
  var ICO = {
    tel: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21c4.97 0 9-3.8 9-8.5S16.97 4 12 4s-9 3.8-9 8.5c0 1.7.5 3.2 1.4 4.5L3 21l4.3-1.3c1.3.8 2.9 1.3 4.7 1.3z"/></svg>',
    hist: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  function diasDesde(iso) { return iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity; }
  // "skills": etiquetas que resumem quem é o cliente, calculadas dos dados dele
  function skills(c) {
    var n = (c.agendamentos || 0) + (c.pedidos || 0), d = c.dados || {}, r = [];
    var ult = Math.min(diasDesde(c.ultimo_agendamento), diasDesde(c.ultimo_pedido), diasDesde(c.ultimo_acesso));
    if (n >= 5) r.push(['Cliente fiel', 'ouro']);
    else if (n >= 2) r.push(['Volta sempre', 'verde']);
    if (n === 1) r.push(['Primeira vez', 'azul']);
    if (diasDesde(c.primeira_visita) <= 7 && n < 2) r.push(['Novo por aqui', 'azul']);
    if (c.agendamentos && c.pedidos) r.push(['Agenda e pede', 'ouro']);
    else if (c.agendamentos) r.push(['Agenda horário', 'verde']);
    else if (c.pedidos) r.push(['Pede delivery', 'azul']);
    if (ult <= 1) r.push(['Ativo hoje', 'verde']);
    else if (ult > 60 && ult !== Infinity) r.push(['Sumiu há ' + Math.floor(ult / 30) + ' meses', 'cinza']);
    if (!n) r.push(['Só olhou o site', 'cinza']);
    if (d.endereco) r.push(['Tem endereço salvo', 'cinza']);
    if (d.veiculo) r.push([d.veiculo + (d.modelo ? ' ' + d.modelo : ''), 'cinza']);
    return r.slice(0, 6);
  }
  function linhasInfo(c) {
    var d = c.dados || {}, b = d.briefing || {}, l = [];
    function add(r, v) { if (v) l.push([r, String(v)]); }
    add('Primeiro contato', quando(c.primeira_visita));
    add('Último acesso', c.ultimo_acesso ? quando(c.ultimo_acesso) : '');
    add('Último serviço', c.ultimo_servico);
    add('Último agendamento', c.ultimo_agendamento ? quando(c.ultimo_agendamento) : '');
    add('Último pedido', c.ultimo_pedido ? quando(c.ultimo_pedido) : '');
    add('Acessos', c.acessos ? c.acessos + (c.acessos === 1 ? ' dia' : ' dias') : '');
    add('Endereço', d.endereco); add('Referência', d.referencia);
    add('Veículo', [d.veiculo, d.modelo].filter(Boolean).join(' — '));
    Object.keys(ROTULOS_BRIEFING).forEach(function (k) { var v = b[k]; if (v === true) v = 'Sim'; if (v === false) v = 'Não'; if (v != null && v !== '') add(ROTULOS_BRIEFING[k], v); });
    return l.slice(0, 9);
  }
  var reduz = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function digitar(alvos, textos, aoFim) {
    var parar = false, li = 0;
    var cur = document.createElement('i'); cur.className = 'clc-cur';
    function proxima() {
      if (parar || li >= alvos.length) { if (cur.parentNode) cur.remove(); if (aoFim && !parar) aoFim(); return; }
      var el = alvos[li], txt = textos[li], k = 0; li++;
      el.parentNode.classList.add('on'); el.appendChild(cur);
      (function passo() {
        if (parar) return;
        if (k >= txt.length) { setTimeout(proxima, 90); return; }
        el.insertBefore(document.createTextNode(txt.charAt(k++)), cur);
        setTimeout(passo, 16 + Math.random() * 14);
      })();
    }
    function tudoJa() { parar = true; if (cur.parentNode) cur.remove(); alvos.forEach(function (el, i) { el.parentNode.classList.add('on'); el.textContent = textos[i]; }); }
    if (reduz) tudoJa(); else proxima();
    return tudoJa;
  }

  function cartao(c, estabId) {
    var antigo = document.getElementById('clCartao'); if (antigo) antigo.remove();
    var t = tipo(c), sk = skills(c), info = linhasInfo(c);
    var box = document.createElement('div');
    box.id = 'clCartao'; box.className = 'clc'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Perfil de ' + c.nome);
    box.innerHTML = '<div class="clc-fundo" data-clc-fechar></div>' +
      '<div class="clc-card">' +
        '<button type="button" class="clc-x" data-clc-fechar aria-label="Fechar">' + ICO.x + '</button>' +
        '<div class="clc-capa"></div>' +
        '<div class="clc-perfil">' + (global.VBAvatar ? global.VBAvatar.html(c.nome, c.telefone, 'gg') : '') +
          '<h3 class="clc-nome"><span data-t></span></h3>' +
          '<p class="clc-fone"><em class="cl-tag cl-' + t.cor + '">' + t.rotulo + '</em> ' + esc(fone(c.telefone)) + '</p></div>' +
        '<div class="clc-skills">' + sk.map(function (x, i) { return '<span class="clc-skill cl-' + x[1] + '" style="animation-delay:' + (0.15 + i * 0.08) + 's">' + esc(x[0]) + '</span>'; }).join('') + '</div>' +
        '<div class="clc-info">' + info.map(function (x) { return '<div class="clc-l"><span>' + esc(x[0]) + '</span><strong data-t></strong></div>'; }).join('') + '</div>' +
        '<div class="clc-acoes">' +
          '<a class="clc-b" href="tel:+55' + String(c.telefone).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '') + '">' + ICO.tel + 'Ligar</a>' +
          '<a class="clc-b clc-zap" href="' + whats(c.telefone, 'Olá, ' + c.nome + '! Tudo bem?') + '" target="_blank" rel="noopener">' + ICO.wa + 'WhatsApp</a>' +
          '<button type="button" class="clc-b" data-clc-hist>' + ICO.hist + 'Histórico</button>' +
        '</div>' +
        '<div class="clc-hist oculto" id="clcHist"></div>' +
      '</div>';
    document.body.appendChild(box);
    document.documentElement.classList.add('clc-travado');
    if (global.VBAvatar) global.VBAvatar.hidratar(estabId, box);
    requestAnimationFrame(function () { box.classList.add('aberto'); });

    var alvos = [box.querySelector('.clc-nome [data-t]')].concat([].slice.call(box.querySelectorAll('.clc-info [data-t]')));
    var textos = [c.nome].concat(info.map(function (x) { return x[1]; }));
    var pular = digitar(alvos, textos);

    function fechar() {
      pular(); box.classList.remove('aberto');
      document.documentElement.classList.remove('clc-travado');
      document.removeEventListener('keydown', tecla);
      setTimeout(function () { box.remove(); }, 220);
    }
    function tecla(e) { if (e.key === 'Escape') fechar(); }
    document.addEventListener('keydown', tecla);
    var carregado = false;
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-clc-fechar]')) { fechar(); return; }
      if (e.target.closest('.clc-info')) pular();
      if (!e.target.closest('[data-clc-hist]')) return;
      pular();
      var h = box.querySelector('#clcHist'), abrir = h.classList.contains('oculto');
      h.classList.toggle('oculto', !abrir);
      if (abrir) setTimeout(function () { h.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
      if (!abrir || carregado) return;
      carregado = true;
      h.innerHTML = '<p class="cl-vazio-busca">Carregando…</p>';
      global.db.rpc('tenant_admin_historico_cliente', { p_estabelecimento_id: estabId, p_telefone: c.telefone }).then(function (res) {
        var itens = res.data || [];
        h.innerHTML = itens.length ? itens.map(function (x) {
          return '<div class="cl-h"><span><strong>' + esc(x.titulo || '—') + '</strong><small>' + esc(quando(x.data)) + ' · ' + esc([x.detalhe, x.staff_nome].filter(Boolean).join(' · ')) + '</small></span>' +
            '<em>' + (x.tipo === 'venda' ? 'Venda' : x.tipo === 'pedido' ? 'Pedido' : 'Agendamento') + '</em></div>';
        }).join('') : '<p class="cl-vazio-busca">Ainda sem agendamentos ou pedidos — só acessou o site.</p>';
      }, function () { h.innerHTML = '<p class="cl-erro">Não deu pra carregar o histórico agora.</p>'; });
    });
  }

  global.VBClientes = { montar: montar, tipo: tipo, fone: fone };
})(window);
