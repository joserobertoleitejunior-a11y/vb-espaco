/* Tudo o que o funcionário digital sabe FAZER além do básico (agenda, pedido, caixa):
   cardápio, loja, serviços, equipe, horários, promoções, recados, vendas e site.
   Cada ação usa as MESMAS RPCs dos botões do painel — o bot não tem poder extra,
   só poupa os toques. A IA (função "assistente") escolhe a ação; aqui é que ela roda.

     VBBotAcoes.criar({
       db, estabId, areas, segmento, preco: fn(valor),
       ir: fn(aba), recarregar: fn('cardapio'|'agenda'|…), tour: fn()
     }) → { nome_da_acao: fn(args) → Promise<texto> | texto }

   Quem pode apagar pede um "sim" antes (lista PRECISA_SIM no funcionario.js). */
(function (global) {
  'use strict';

  function norm(t) { return String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; }

  // acha por nome (igual > começa com > contém); devolve { um } ou { varios } ou {}
  function achar(lista, nome) {
    var q = norm(nome);
    if (!q) return {};
    var igual = lista.filter(function (x) { return norm(x.nome) === q; });
    if (igual.length === 1) return { um: igual[0] };
    var cont = lista.filter(function (x) { return norm(x.nome).indexOf(q) !== -1; });
    if (cont.length === 1) return { um: cont[0] };
    var pal = q.split(' ').filter(Boolean);
    var todas = lista.filter(function (x) { var n = norm(x.nome); return pal.every(function (p) { return n.indexOf(p) !== -1; }); });
    if (todas.length === 1) return { um: todas[0] };
    var cand = igual.length ? igual : (cont.length ? cont : todas);
    return cand.length ? { varios: cand } : {};
  }
  function pergunta(c, o) { return 'Achei mais de um: ' + c.varios.slice(0, 4).map(function (x) { return x.nome; }).join(', ') + '. Qual deles?'; }

  function dataISO(txt) {
    var t = norm(txt), d = new Date();
    var base = function (n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; };
    var fmt = function (x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    if (!t || t === 'hoje') return fmt(base(0));
    if (t === 'amanha') return fmt(base(1));
    if (t === 'depois de amanha') return fmt(base(2));
    var dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    for (var i = 0; i < 7; i++) if (t.indexOf(dias[i]) === 0) { var falta = (i - d.getDay() + 7) % 7 || 7; return fmt(base(falta)); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    var m = /^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/.exec(t);
    if (m) { var ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : d.getFullYear(); return ano + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0'); }
    return null;
  }
  function hora(txt) {
    var m = /^(\d{1,2})(?:[:h](\d{2})?)?$/.exec(norm(txt).replace(/\s*(horas?|hrs?)$/, ''));
    if (!m) return null;
    var h = Number(m[1]), mi = Number(m[2] || 0);
    return h < 24 && mi < 60 ? String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') : null;
  }

  function criar(cx) {
    var db = cx.db, id = cx.estabId, areas = cx.areas || [], preco = cx.preco || function (v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); };
    var servico = areas.indexOf('servicos') !== -1 && areas.indexOf('delivery') === -1;
    var temPedidos = areas.indexOf('delivery') !== -1 || areas.indexOf('servicos') !== -1;
    var temAgenda = areas.indexOf('agenda') !== -1;
    var rpc = function (n, a) { return db.rpc(n, a).then(function (r) { if (r.error) throw new Error(r.error.message || 'Não consegui agora.'); return r.data; }); };
    var E = { p_estabelecimento_id: id };
    var com = function (extra) { return Object.assign({}, E, extra); };
    var so = function (cond, msg) { if (!cond) throw new Error(msg); };
    var itens = function () { return rpc('delivery_admin_listar_itens', E).then(function (l) { return l || []; }); };
    var cats = function () { return rpc('delivery_admin_listar_categorias', E).then(function (l) { return l || []; }); };
    var servicos = function () { return rpc('tenant_listar_servicos', E).then(function (l) { return l || []; }); };
    var equipe = function () { return rpc('tenant_listar_equipe', E).then(function (l) { return l || []; }); };
    var pizza = function (nomeCat) { return cx.segmento === 'pizzaria' && !/bebida|refri|suco|cerveja|[aá]gua|vinho|drink|sorvete|energ[eé]tico/i.test(String(nomeCat || '')); };
    var nomeItens = servico ? 'serviço' : 'item';
    function precisaPedidos() { so(temPedidos, 'Este negócio não tem cardápio.'); }

    // cada ação que dá pra reverter guarda os PASSOS pra desfazer (chamadas de banco simples).
    // O chat mostra o botão "Desfazer"; os passos ficam salvos junto da mensagem.
    var guardar = function (texto, passos) { if (cx.registrarDesfazer && passos && passos.length) cx.registrarDesfazer({ texto: texto, passos: passos }); };
    var argsItem = function (it, extra) {
      return Object.assign({ p_id: null, p_estabelecimento_id: id, p_categoria_id: it.categoria_id || null, p_nome: it.nome, p_descricao: it.descricao || null, p_preco: it.preco,
        p_foto_url: it.foto_url || null, p_permite_meio_a_meio: !!it.permite_meio_a_meio, p_ativo: it.ativo !== false, p_ordem: it.ordem || 0, p_aceita_borda: !!it.aceita_borda }, extra || {});
    };
    var A = {};

    /* ---------------- cardápio ---------------- */
    A.adicionar_item = function (a) {
      precisaPedidos();
      var nome = String(a.nome || '').trim();
      so(nome.length >= 2, 'Qual o nome do ' + nomeItens + '?');
      var p = a.preco == null || a.preco === '' ? 0 : num(a.preco);
      so(!isNaN(p) && p >= 0, 'Não entendi o preço.');
      return Promise.all([cats(), itens()]).then(function (r) {
        var cs = r[0], its = r[1], nomeCat = String(a.categoria || '').trim();
        var cat = nomeCat ? cs.filter(function (c) { return norm(c.nome) === norm(nomeCat); })[0] : (cs[0] || null);
        var garante = cat ? Promise.resolve(cat) : rpc('delivery_admin_salvar_categoria', com({ p_id: null, p_nome: nomeCat || (servico ? 'Serviços' : 'Cardápio'), p_ordem: cs.length }));
        return garante.then(function (c) {
          var ehPizza = pizza(c.nome);
          return rpc('delivery_admin_salvar_item', com({
            p_id: null, p_categoria_id: c.id, p_nome: nome.slice(0, 80), p_descricao: a.descricao ? String(a.descricao).slice(0, 300) : null, p_preco: p, p_foto_url: null,
            p_permite_meio_a_meio: ehPizza, p_ativo: true, p_ordem: its.length, p_aceita_borda: ehPizza
          }));
        }).then(function (novo) {
          if (novo && novo.id) guardar('Apagar ' + nome, [{ rpc: 'delivery_admin_remover_item', args: { p_id: novo.id, p_estabelecimento_id: id } }]);
          cx.recarregar('cardapio'); return 'Pronto, pus ' + nome + (p ? ' por ' + preco(p) : ' (sem preço ainda)') + ' no ' + (servico ? 'catálogo' : 'cardápio') + '.'; });
      });
    };
    function itemPorNome(nome) {
      return itens().then(function (l) {
        var c = achar(l, nome);
        if (c.varios) throw new Error(pergunta(c));
        if (!c.um) throw new Error('Não achei "' + nome + '" no cardápio.');
        return c.um;
      });
    }
    function salvarItem(it, mudancas) {
      return rpc('delivery_admin_salvar_item', argsItem(it, Object.assign({ p_id: it.id }, mudancas)));
    }
    A.mudar_preco_item = function (a) {
      precisaPedidos();
      var p = num(a.preco);
      so(!isNaN(p) && p >= 0, 'Qual o novo preço?');
      return itemPorNome(a.nome).then(function (it) {
        return salvarItem(it, { p_preco: p }).then(function () {
          guardar('Voltar o preço de ' + it.nome + ' para ' + preco(it.preco), [{ rpc: 'delivery_admin_salvar_item', args: argsItem(it, { p_id: it.id }) }]);
          cx.recarregar('cardapio'); return it.nome + ' agora custa ' + preco(p) + '.'; });
      });
    };
    A.mudar_nome_item = function (a) {
      precisaPedidos();
      var novo = String(a.novo_nome || '').trim();
      so(novo.length >= 2, 'Qual o novo nome?');
      return itemPorNome(a.nome).then(function (it) {
        return salvarItem(it, { p_nome: novo.slice(0, 80) }).then(function () {
          guardar('Voltar o nome para ' + it.nome, [{ rpc: 'delivery_admin_salvar_item', args: argsItem(it, { p_id: it.id }) }]);
          cx.recarregar('cardapio'); return 'Troquei o nome de ' + it.nome + ' para ' + novo + '.'; });
      });
    };
    A.disponibilidade_item = function (a) {
      precisaPedidos();
      var on = a.disponivel === true || /^(true|sim|s|1|ligar|ligado|disponivel)$/i.test(String(a.disponivel));
      return itemPorNome(a.nome).then(function (it) {
        return rpc('delivery_admin_alternar_item', com({ p_id: it.id, p_ativo: on })).then(function () {
          guardar((on ? 'Deixar ' + it.nome + ' esgotado de novo' : 'Voltar ' + it.nome + ' ao site'), [{ rpc: 'delivery_admin_alternar_item', args: { p_id: it.id, p_estabelecimento_id: id, p_ativo: it.ativo !== false } }]);
          cx.recarregar('cardapio'); return it.nome + (on ? ' voltou a aparecer no site.' : ' saiu do site (esgotado).');
        });
      });
    };
    A.remover_item = function (a) {
      precisaPedidos();
      return itemPorNome(a.nome).then(function (it) {
        return rpc('delivery_admin_remover_item', com({ p_id: it.id })).then(function () {
          guardar('Trazer ' + it.nome + ' de volta', [{ rpc: 'delivery_admin_salvar_item', args: argsItem(it) }]);
          cx.recarregar('cardapio'); return 'Apaguei ' + it.nome + ' do cardápio.'; });
      });
    };
    A.limpar_cardapio = function () {
      precisaPedidos();
      return Promise.all([itens(), cats()]).then(function (r) {
        var its = r[0], cs = r[1];
        if (!its.length && !cs.length) return 'O cardápio já está vazio.';
        // um por vez, em fila: são chamadas simples e a ordem não importa, mas assim um erro para no meio com a contagem certa
        var feitos = 0;
        return its.reduce(function (f, it) { return f.then(function () { return rpc('delivery_admin_remover_item', com({ p_id: it.id })).then(function () { feitos++; }); }); }, Promise.resolve())
          .then(function () { return cs.reduce(function (f, c) { return f.then(function () { return rpc('delivery_admin_remover_categoria', com({ p_id: c.id })); }); }, Promise.resolve()); })
          .then(function () {
            guardar('Recriar o cardápio com ' + feitos + ' itens', [{ tipo: 'recriar_cardapio', categorias: cs.map(function (c) { return { id: c.id, nome: c.nome, ordem: c.ordem || 0 }; }),
              itens: its.map(function (i) { return argsItem(i); }) }]);
            cx.recarregar('cardapio'); return 'Pronto, apaguei ' + feitos + (feitos === 1 ? ' item' : ' itens') + ' e as categorias. O cardápio está vazio.'; });
      });
    };
    A.criar_categoria = function (a) {
      precisaPedidos();
      var nome = String(a.nome || '').trim();
      so(nome.length >= 2, 'Qual o nome da categoria?');
      return cats().then(function (cs) {
        if (cs.some(function (c) { return norm(c.nome) === norm(nome); })) return 'Já existe a categoria ' + nome + '.';
        return rpc('delivery_admin_salvar_categoria', com({ p_id: null, p_nome: nome.slice(0, 40), p_ordem: cs.length })).then(function (nova) {
          if (nova && nova.id) guardar('Apagar a categoria ' + nome, [{ rpc: 'delivery_admin_remover_categoria', args: { p_id: nova.id, p_estabelecimento_id: id } }]);
          cx.recarregar('cardapio'); return 'Criei a categoria ' + nome + '.'; });
      });
    };
    A.remover_categoria = function (a) {
      precisaPedidos();
      return cats().then(function (cs) {
        var c = achar(cs, a.nome);
        if (c.varios) throw new Error(pergunta(c));
        if (!c.um) throw new Error('Não achei a categoria "' + a.nome + '".');
        return rpc('delivery_admin_remover_categoria', com({ p_id: c.um.id })).then(function () { cx.recarregar('cardapio'); return 'Apaguei a categoria ' + c.um.nome + '.'; });
      });
    };
    A.adicionar_borda = function (a) {
      precisaPedidos();
      var nome = String(a.nome || '').trim(), p = a.preco == null ? 0 : num(a.preco);
      so(nome.length >= 2 && !isNaN(p), 'Diga o nome e o preço da borda.');
      return rpc('delivery_admin_listar_bordas', E).then(function (l) {
        return rpc('delivery_admin_salvar_borda', com({ p_id: null, p_nome: nome.slice(0, 40), p_preco: p, p_ativo: true, p_ordem: (l || []).length }));
      }).then(function (nova) {
        if (nova && nova.id) guardar('Apagar a borda ' + nome, [{ rpc: 'delivery_admin_remover_borda', args: { p_id: nova.id, p_estabelecimento_id: id } }]);
        cx.recarregar('cardapio'); return 'Borda ' + nome + ' adicionada por ' + preco(p) + '.'; });
    };
    A.remover_borda = function (a) {
      precisaPedidos();
      return rpc('delivery_admin_listar_bordas', E).then(function (l) {
        var c = achar(l || [], a.nome);
        if (c.varios) throw new Error(pergunta(c));
        if (!c.um) throw new Error('Não achei a borda "' + a.nome + '".');
        return rpc('delivery_admin_remover_borda', com({ p_id: c.um.id })).then(function () { cx.recarregar('cardapio'); return 'Apaguei a borda ' + c.um.nome + '.'; });
      });
    };
    A.criar_combo = function (a) {
      precisaPedidos();
      var nome = String(a.nome || '').trim(), p = num(a.preco), q = Math.max(1, Math.min(6, Math.round(Number(a.qtd_sabores) || 1)));
      so(nome.length >= 2 && p > 0, 'Diga o nome e o preço do combo.');
      return Promise.all([itens(), rpc('delivery_admin_listar_combos', E)]).then(function (r) {
        var ids = r[0].filter(function (i) { return i.ativo !== false && Number(i.preco) > 0 && (i.permite_meio_a_meio || !r[0].some(function (x) { return x.permite_meio_a_meio; })); }).map(function (i) { return i.id; });
        so(ids.length, 'Preciso de itens com preço no cardápio pra montar o combo.');
        return rpc('delivery_admin_salvar_combo', com({ p_id: null, p_nome: nome.slice(0, 80), p_preco: p, p_itens_permitidos: ids, p_qtd_sabores: q, p_ativo: true, p_ordem: (r[1] || []).length }));
      }).then(function (novo) {
        if (novo && novo.id) guardar('Apagar o combo ' + nome, [{ rpc: 'delivery_admin_remover_combo', args: { p_id: novo.id, p_estabelecimento_id: id } }]);
        cx.recarregar('cardapio'); return 'Criei o combo ' + nome + ' por ' + preco(p) + '.'; });
    };
    A.remover_combo = function (a) {
      precisaPedidos();
      return rpc('delivery_admin_listar_combos', E).then(function (l) {
        var c = achar(l || [], a.nome);
        if (c.varios) throw new Error(pergunta(c));
        if (!c.um) throw new Error('Não achei o combo "' + a.nome + '".');
        return rpc('delivery_admin_remover_combo', com({ p_id: c.um.id })).then(function () { cx.recarregar('cardapio'); return 'Apaguei o combo ' + c.um.nome + '.'; });
      });
    };

    /* ---------------- loja (delivery) ---------------- */
    function lojaAtual() { return rpc('delivery_admin_meus_estabelecimentos').then(function (l) { return (l || []).filter(function (x) { return x.id === id; })[0] || {}; }, function () { return {}; }); }
    // grava e guarda o valor ANTERIOR de cada campo mexido (é isso que o "Desfazer" devolve)
    function campos(c, textoDesfazer) {
      return lojaAtual().then(function (antes) {
        return rpc('delivery_admin_atualizar_estabelecimento', { p_id: id, p_campos: c }).then(function (r) {
          var volta = {}; Object.keys(c).forEach(function (k) { volta[k] = antes[k] == null ? null : antes[k]; });
          guardar(textoDesfazer || 'Voltar como estava', [{ rpc: 'delivery_admin_atualizar_estabelecimento', args: { p_id: id, p_campos: volta } }]);
          return r;
        });
      });
    }
    A.abrir_fechar_loja = function (a) {
      precisaPedidos();
      var m = norm(a.modo);
      var modo = /^(aberto|abrir|abre|aberta)/.test(m) ? 'aberto' : /^(fechado|fechar|fecha|fechada)/.test(m) ? 'fechado' : /^(auto|horario|pelo)/.test(m) ? 'auto' : null;
      so(modo, 'Quer abrir, fechar ou seguir o horário?');
      return campos({ status_manual: modo }, 'Voltar o horário da loja como estava').then(function () {
        cx.recarregar('pedidos');
        return modo === 'aberto' ? 'Loja aberta agora.' : modo === 'fechado' ? 'Loja fechada agora.' : 'A loja volta a seguir o horário de funcionamento.';
      });
    };
    A.configurar_loja = function (a) {
      precisaPedidos();
      var c = {}, falou = [];
      var n = function (k, rot, destino) { if (a[k] != null && a[k] !== '') { var v = num(a[k]); so(!isNaN(v) && v >= 0, 'Não entendi ' + rot + '.'); c[destino] = v; falou.push(rot + ' ' + (/taxa|minimo|pedido/.test(destino) ? preco(v) : v)); } };
      n('taxa_entrega', 'a taxa de entrega', 'taxa_entrega');
      n('pedido_minimo', 'o pedido mínimo', 'pedido_minimo');
      n('tempo_min', 'o tempo mínimo', 'tempo_entrega_min');
      n('tempo_max', 'o tempo máximo', 'tempo_entrega_max');
      var b = function (k, rot, destino) { if (a[k] != null) { c[destino] = a[k] === true || /^(true|sim|s|1)$/i.test(String(a[k])); falou.push(rot + (c[destino] ? ' ligado' : ' desligado')); } };
      b('entrega', 'entrega', 'aceita_entrega');
      b('retirada', 'retirada na loja', 'aceita_retirada');
      if (a.aviso != null) { c.aviso = String(a.aviso).slice(0, 140); falou.push('o aviso do topo'); }
      if (a.chave_pix != null) { c.chave_pix = String(a.chave_pix).trim().slice(0, 120); falou.push('a chave Pix'); }
      if (a.whatsapp != null) { c.telefone_whatsapp = String(a.whatsapp).replace(/\D/g, '').slice(0, 15); falou.push('o WhatsApp'); }
      so(falou.length, 'O que você quer mudar na loja? Taxa de entrega, pedido mínimo, tempo, aviso, Pix…');
      return campos(c, 'Voltar as configurações da loja').then(function () { cx.recarregar('pedidos'); return 'Pronto: mudei ' + falou.join(', ') + '.'; });
    };

    /* ---------------- agenda: horários, serviços, equipe ---------------- */
    A.criar_agendamento = function (a) {
      so(temAgenda, 'Este negócio não tem agenda.');
      var dia = dataISO(a.dia), h = hora(a.horario);
      so(a.cliente && String(a.cliente).trim().length >= 2, 'Qual o nome do cliente?');
      so(dia, 'Pra que dia? Diga hoje, amanhã ou a data.');
      so(h, 'Que horas? Por exemplo 14:30.');
      return Promise.all([servicos(), equipe()]).then(function (r) {
        var sv = a.servico ? achar(r[0], a.servico) : {};
        if (a.servico && sv.varios) throw new Error(pergunta(sv));
        var pr = a.profissional ? achar(r[1], a.profissional) : {};
        var partes = dia.split('-');
        return rpc('tenant_admin_criar_agendamento', com({
          p_cliente_nome: String(a.cliente).trim().slice(0, 80), p_cliente_telefone: String(a.telefone || '').replace(/\D/g, '') || null,
          p_staff_id: pr.um ? pr.um.id : null, p_staff_nome: pr.um ? pr.um.nome : null,
          p_servico: sv.um ? sv.um.nome : (a.servico || null), p_dia: dia, p_dia_label: partes[2] + '/' + partes[1], p_horario: h
        })).then(function () { cx.recarregar('agenda'); return 'Agendei ' + a.cliente + ' para ' + partes[2] + '/' + partes[1] + ' às ' + h + '.'; });
      });
    };
    A.adicionar_servico = function (a) {
      so(temAgenda, 'Este negócio não tem agenda. Pra o cardápio, use adicionar item.');
      var nome = String(a.nome || '').trim(), p = num(a.preco);
      so(nome.length >= 2 && !isNaN(p) && p >= 0, 'Diga o nome e o preço do serviço.');
      return rpc('tenant_admin_salvar_servico', com({ p_id: null, p_nome: nome.slice(0, 80), p_preco: p, p_categoria: 'unissex' })).then(function (novo) {
        if (novo && novo.id) guardar('Apagar o serviço ' + nome, [{ rpc: 'tenant_admin_remover_servico', args: { p_estabelecimento_id: id, p_id: novo.id } }]);
        cx.recarregar('agenda'); return 'Serviço ' + nome + ' por ' + preco(p) + ' adicionado.'; });
    };
    function servicoPorNome(nome) {
      return servicos().then(function (l) {
        var c = achar(l, nome);
        if (c.varios) throw new Error(pergunta(c));
        if (!c.um) throw new Error('Não achei o serviço "' + nome + '".');
        return c.um;
      });
    }
    A.mudar_preco_servico = function (a) {
      var p = num(a.preco);
      so(!isNaN(p) && p >= 0, 'Qual o novo preço?');
      return servicoPorNome(a.nome).then(function (s) {
        return rpc('tenant_admin_salvar_servico', com({ p_id: s.id, p_nome: s.nome, p_preco: p, p_categoria: s.categoria || 'unissex' })).then(function () {
          guardar('Voltar o preço de ' + s.nome + ' para ' + preco(s.preco), [{ rpc: 'tenant_admin_salvar_servico', args: { p_estabelecimento_id: id, p_id: s.id, p_nome: s.nome, p_preco: Number(s.preco) || 0, p_categoria: s.categoria || 'unissex' } }]);
          cx.recarregar('agenda'); return s.nome + ' agora custa ' + preco(p) + '.'; });
      });
    };
    A.remover_servico = function (a) {
      return servicoPorNome(a.nome).then(function (s) { return rpc('tenant_admin_remover_servico', com({ p_id: s.id })).then(function () {
        guardar('Trazer o serviço ' + s.nome + ' de volta', [{ rpc: 'tenant_admin_salvar_servico', args: { p_estabelecimento_id: id, p_id: null, p_nome: s.nome, p_preco: Number(s.preco) || 0, p_categoria: s.categoria || 'unissex' } }]);
        cx.recarregar('agenda'); return 'Apaguei o serviço ' + s.nome + '.'; }); });
    };
    A.adicionar_profissional = function (a) {
      so(temAgenda, 'Este negócio não tem agenda.');
      var nome = String(a.nome || '').trim();
      so(nome.length >= 2, 'Qual o nome do profissional?');
      return rpc('tenant_admin_salvar_staff', com({ p_id: null, p_nome: nome.slice(0, 60), p_especialidade: a.especialidade ? String(a.especialidade).slice(0, 80) : null, p_foto_url: null }))
        .then(function () { cx.recarregar('agenda'); return nome + ' entrou na equipe.'; });
    };
    A.remover_profissional = function (a) {
      return equipe().then(function (l) {
        var c = achar(l, a.nome);
        if (c.varios) throw new Error(pergunta(c));
        if (!c.um) throw new Error('Não achei "' + a.nome + '" na equipe.');
        return rpc('tenant_admin_remover_staff', com({ p_id: c.um.id })).then(function () { cx.recarregar('agenda'); return c.um.nome + ' saiu da equipe.'; });
      });
    };
    /* ---- horário de funcionamento: vários dias de uma vez, turnos, agenda e delivery ---- */
    var ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
    var SIGLA_DIA = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
    var NOME_DIA_BOT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    var CURTO_DIA_BOT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    // "segunda a sexta", "terça e quinta", "fim de semana", "todos os dias", ["sexta","sábado"] → [1,2,3,4,5] …
    function diasDe(t) {
      if (Array.isArray(t)) t = t.join(' e ');
      t = norm(t).replace(/-feira/g, '').replace(/feiras?/g, '');
      if (!t) return [];
      if (/todo|diari|sempre|toda a semana/.test(t)) return ORDEM_DIAS.slice();
      if (/fim de semana|final de semana|fds/.test(t)) return [6, 0];
      if (/dias? uteis/.test(t)) return [1, 2, 3, 4, 5];
      var re = /(dom|seg|ter|qua|qui|sex|sab)[a-z]*/g, m, achados = [];
      while ((m = re.exec(t))) achados.push({ d: SIGLA_DIA[m[1]], ini: m.index, fim: m.index + m[0].length });
      var out = {};
      achados.forEach(function (x, k) {
        out[x.d] = true;
        var prox = achados[k + 1];
        // "segunda A sexta" / "segunda ATE sexta": vale o intervalo inteiro (a semana vai de segunda a domingo)
        if (prox && /(^|\s)(a|as|ate)(\s|$)/.test(t.slice(x.fim, prox.ini))) {
          var a0 = ORDEM_DIAS.indexOf(x.d), b0 = ORDEM_DIAS.indexOf(prox.d);
          for (var n = a0; ; n = (n + 1) % 7) { out[ORDEM_DIAS[n]] = true; if (n === b0) break; }
        }
      });
      return ORDEM_DIAS.filter(function (d) { return out[d]; });
    }
    // aceita {abre, fecha} ou {turnos: [["11:00","14:00"], ["18:00","23:00"]]}
    function turnosDe(a) {
      var l = [], ab, fe;
      if (Array.isArray(a.turnos)) {
        a.turnos.slice(0, 3).forEach(function (t) {
          var x = Array.isArray(t) ? t : [t && t.abre, t && t.fecha]; ab = hora(x[0]); fe = hora(x[1]);
          if (ab && fe) l.push([ab, fe]);
        });
      } else if (a.abre != null || a.fecha != null) { ab = hora(a.abre); fe = hora(a.fecha); if (ab && fe) l.push([ab, fe]); }
      return l;
    }
    function horaBonita(h) { if (h === '00:00') return 'meia-noite'; var p = h.split(':'); return Number(p[0]) + 'h' + (p[1] === '00' ? '' : p[1]); }
    function diasTexto(dias) {
      if (dias.length === 7) return 'Todos os dias';
      var runs = [], atual = null;
      ORDEM_DIAS.forEach(function (d) {
        if (dias.indexOf(d) === -1) { atual = null; return; }
        if (atual) atual.push(d); else { atual = [d]; runs.push(atual); }
      });
      var partes = runs.map(function (r) {
        var n = function (d) { return NOME_DIA_BOT[d]; };
        return r.length === 1 ? n(r[0]) : r.length === 2 ? n(r[0]) + ' e ' + n(r[1]) : CURTO_DIA_BOT[r[0]] + ' a ' + CURTO_DIA_BOT[r[r.length - 1]];
      });
      var t = partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes[0];
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
    A.horario_funcionamento = function (a) {
      so(temAgenda || temPedidos, 'Este negócio não tem horário pra mexer.');
      var dias = diasDe(a.dias != null ? a.dias : a.dia);
      so(dias.length, 'Quais dias? Por exemplo: segunda a sexta, ou todos os dias.');
      var fechado = a.fechado === true || /^(true|sim|s|1)$/i.test(String(a.fechado));
      var turnos = fechado ? [] : turnosDe(a);
      so(fechado || turnos.length, 'Diga que horas abre e fecha. Por exemplo: das 18h às 23h.');
      so(!turnos.some(function (t) { return t[0] === t[1]; }), 'Abre e fecha na mesma hora? Me diga o horário certo.');
      var texto = fechado ? diasTexto(dias) + ': fechado.' : diasTexto(dias) + ': ' + turnos.map(function (t) { return horaBonita(t[0]) + ' às ' + horaBonita(t[1]); }).join(' e ') + '.';
      var passos = [];

      // Agenda: um horário por dia (linhas de tenant_business_hours)
      var agenda = !temAgenda ? Promise.resolve() : (function () {
        so(turnos.length <= 1, 'A agenda aceita um horário por dia. Qual deles vale?');
        return rpc('tenant_listar_horarios', E).then(function (linhas) {
          var antes = {}; (linhas || []).forEach(function (l) { antes[l.dia_semana] = l; });
          var volta = [];
          return dias.reduce(function (pr, d) {
            return pr.then(function () {
              var o = antes[d], abre = fechado ? String((o && o.abre) || '09:00').slice(0, 5) : turnos[0][0], fecha = fechado ? String((o && o.fecha) || '18:00').slice(0, 5) : turnos[0][1];
              volta.push({ rpc: 'tenant_admin_salvar_horario', args: { p_estabelecimento_id: id, p_dia_semana: d, p_abre: o ? String(o.abre).slice(0, 5) : '09:00', p_fecha: o ? String(o.fecha).slice(0, 5) : '18:00', p_fechado: o ? !!o.fechado : true } });
              return rpc('tenant_admin_salvar_horario', com({ p_dia_semana: d, p_abre: abre, p_fecha: fecha, p_fechado: fechado }));
            });
          }, Promise.resolve()).then(function () { passos = passos.concat(volta); cx.recarregar('agenda'); });
        });
      })();

      // Delivery: o horário da loja é um objeto "dia → faixas" (aceita vários turnos)
      return agenda.then(function () {
        if (!temPedidos) return null;
        return lojaAtual().then(function (l) {
          var h = JSON.parse(JSON.stringify(l.horarios || {}));
          dias.forEach(function (d) { if (fechado) delete h[d]; else h[d] = turnos; });
          so(Object.keys(h).length, 'Assim a loja ficaria sem nenhum dia aberto, e o site entenderia que abre sempre. Deixe pelo menos um dia aberto.');
          return rpc('delivery_admin_atualizar_estabelecimento', { p_id: id, p_campos: { horarios: h } }).then(function () {
            passos.push({ rpc: 'delivery_admin_atualizar_estabelecimento', args: { p_id: id, p_campos: { horarios: l.horarios || {} } } });
            cx.recarregar('pedidos');
          });
        });
      }).then(function () {
        if (passos.length) guardar('Voltar os horários como estavam', passos);
        return texto;
      });
    };

    /* ---------------- endereço no mapa e redes sociais ---------------- */
    var REDES = {
      instagram: { chave: 'instagram_url', nome: 'Instagram', base: 'https://instagram.com/' },
      facebook: { chave: 'facebook_url', nome: 'Facebook', base: 'https://facebook.com/' },
      tiktok: { chave: 'tiktok_url', nome: 'TikTok', base: 'https://tiktok.com/@' }
    };
    function qualRede(t) {
      t = norm(t);
      return /insta/.test(t) ? 'instagram' : /face|fb/.test(t) ? 'facebook' : /tik/.test(t) ? 'tiktok' : null;
    }
    // "@fulano", "fulano", "instagram.com/fulano/" ou o link inteiro → link completo e limpo
    function linkDaRede(rede, v) {
      v = String(v == null ? '' : v).trim();
      if (!v) return '';
      var m = /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com|tiktok\.com)\/(.+)$/i.exec(v);
      var usuario = (m ? m[1] : v).split(/[?#]/)[0].replace(/\/+$/, '').replace(/^@/, '');
      so(/^[A-Za-z0-9._\-\/]{2,100}$/.test(usuario), 'Não entendi esse ' + REDES[rede].nome + '. Mande o @ ou o link.');
      return REDES[rede].base + usuario;
    }
    function negocioAtual() {
      // dados do negócio na agenda (redes, endereço, cidade) — o site público devolve tudo
      if (!cx.slug || !cx.cidade) return Promise.resolve({});
      return db.rpc('buscar_estabelecimento', { p_slug: cx.slug, p_cidade: cx.cidade }).then(function (r) { var l = r.data; return (Array.isArray(l) ? l[0] : l) || {}; }, function () { return {}; });
    }
    function nomeCidade() { return String(cx.cidade || '').replace(/-/g, ' '); }

    // Procura o endereço no mapa e põe o pino exato. Se o número não existe no mapa, avisa — não finge.
    A.definir_endereco = function (a) {
      so(temAgenda || temPedidos, 'Este negócio não tem endereço pra mexer.');
      var texto = String(a.endereco || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      so(texto.length >= 6, 'Qual o endereço? Rua, número e bairro.');
      var cidadeTxt = nomeCidade();
      var consulta = cidadeTxt && !norm(texto).includes(norm(cidadeTxt)) ? texto + ', ' + cidadeTxt : texto;
      var busca = cx.acharEndereco ? cx.acharEndereco(consulta) : Promise.resolve([]);
      var mapaFora = false;
      return Promise.resolve(busca).then(function (l) { return l; }, function () { mapaFora = true; return []; }).then(function (lista) {
        lista = lista || [];
        var quer = (/\d+/.exec(texto) || [])[0];
        // melhor resultado: o que tem o número pedido; senão o primeiro da cidade do negócio
        var daCidade = lista.filter(function (x) { return !cidadeTxt || norm([x.endereco, x.sub].join(' ')).includes(norm(cidadeTxt)); });
        var base = daCidade.length ? daCidade : lista;
        var achado = base.filter(function (x) { return x.temNumero && quer && String(x.endereco).indexOf(quer) !== -1; })[0] || base[0] || null;
        var exato = !!(achado && (!quer || (achado.temNumero && String(achado.endereco).indexOf(quer) !== -1)));
        var lat = achado ? Number(achado.lat) : null, lng = achado ? Number(achado.lng) : null;
        var gravar = texto;                                   // o que o cliente lê: o que o dono escreveu (ou o endereço do mapa, se bateu)
        if (achado && exato && achado.endereco) gravar = achado.endereco;
        var passos = [];
        var feitoPedidos = !temPedidos ? Promise.resolve() : lojaAtual().then(function (l) {
          return rpc('delivery_admin_atualizar_estabelecimento', { p_id: id, p_campos: { endereco: gravar, endereco_lat: lat, endereco_lng: lng } }).then(function () {
            passos.push({ rpc: 'delivery_admin_atualizar_estabelecimento', args: { p_id: id, p_campos: { endereco: l.endereco || '', endereco_lat: l.endereco_lat == null ? null : l.endereco_lat, endereco_lng: l.endereco_lng == null ? null : l.endereco_lng } } });
          });
        });
        return feitoPedidos.then(function () {
          if (!temAgenda) return null;
          return negocioAtual().then(function (n) {
            return rpc('tenant_admin_atualizar_endereco', com({ p_endereco: gravar, p_lat: lat, p_lng: lng })).then(function () {
              passos.push({ rpc: 'tenant_admin_atualizar_endereco', args: { p_estabelecimento_id: id, p_endereco: n.endereco || '', p_lat: n.endereco_lat == null ? null : n.endereco_lat, p_lng: n.endereco_lng == null ? null : n.endereco_lng } });
            });
          });
        }).then(function () {
          guardar('Voltar o endereço como estava', passos);
          if (cx.recarregar) cx.recarregar(temPedidos ? 'pedidos' : 'agenda');
          if (!achado && mapaFora) return 'Salvei o endereço "' + gravar + '", mas não consegui consultar o mapa agora — o pino não foi posto. Tente de novo em instantes.';
          if (!achado) return 'Salvei o endereço "' + gravar + '", mas não achei esse lugar no mapa — o pino não foi posto. Me diga o bairro ou a cidade e eu tento de novo.';
          if (!exato) return 'Salvei "' + gravar + '". Achei a rua no mapa, mas não o número ' + quer + ' — o pino ficou na rua. Confira no site.';
          return 'Pronto! Endereço no site e pino no mapa em: ' + gravar + '.';
        });
      });
    };

    A.definir_rede_social = function (a) {
      so(temAgenda || temPedidos, 'Este negócio não tem rede social pra mexer.');
      var rede = qualRede(a.rede);
      so(rede, 'Qual rede: Instagram, Facebook ou TikTok?');
      var link = linkDaRede(rede, a.valor);
      so(link, 'Qual o @ ou o link?');
      return aplicarRede(rede, link);
    };
    A.remover_rede_social = function (a) {
      var rede = qualRede(a.rede);
      so(rede, 'Qual rede: Instagram, Facebook ou TikTok?');
      return aplicarRede(rede, '');
    };
    function aplicarRede(rede, link) {
      var passos = [], R = REDES[rede];
      var pedidos = !temPedidos || rede !== 'instagram' ? Promise.resolve() : lojaAtual().then(function (l) {
        return rpc('delivery_admin_atualizar_estabelecimento', { p_id: id, p_campos: { instagram_url: link } }).then(function () {
          passos.push({ rpc: 'delivery_admin_atualizar_estabelecimento', args: { p_id: id, p_campos: { instagram_url: l.instagram_url || '' } } });
        });
      });
      return pedidos.then(function () {
        // a tabela da agenda guarda as 3 redes juntas: manda as outras duas como estão
        return negocioAtual().then(function (n) {
          var atual = { instagram_url: n.instagram_url || null, facebook_url: n.facebook_url || null, tiktok_url: n.tiktok_url || null };
          var novo = Object.assign({}, atual); novo[R.chave] = link || null;
          // sem ler as redes de hoje não dá pra regravar as três sem apagar as outras duas
          if (!n.id) { if (rede === 'instagram' && temPedidos) return null; throw new Error('Não consegui ler suas redes agora. Tente de novo em instantes.'); }
          return rpc('tenant_admin_atualizar_redes', com({ p_instagram_url: novo.instagram_url, p_facebook_url: novo.facebook_url, p_tiktok_url: novo.tiktok_url })).then(function () {
            passos.push({ rpc: 'tenant_admin_atualizar_redes', args: { p_estabelecimento_id: id, p_instagram_url: atual.instagram_url, p_facebook_url: atual.facebook_url, p_tiktok_url: atual.tiktok_url } });
          });
        });
      }).then(function () {
        guardar(link ? 'Voltar o ' + R.nome + ' como estava' : 'Colocar o ' + R.nome + ' de volta', passos);
        if (cx.recarregar) cx.recarregar(temPedidos ? 'pedidos' : 'agenda');
        return link ? R.nome + ' no site: ' + link : 'Tirei o ' + R.nome + ' do site.';
      });
    }

    /* ---------------- promoções, recados, vendas ---------------- */
    A.publicar_promocao = function (a) {
      var t = String(a.titulo || '').trim();
      so(t.length >= 2, 'Qual o título da promoção?');
      return rpc('tenant_admin_publicar_promocao', com({ p_titulo: t.slice(0, 80), p_foto_url: null, p_texto: a.texto ? String(a.texto).slice(0, 300) : null, p_dias_validade: Math.max(1, Math.min(60, Math.round(Number(a.dias) || 7))) }))
        .then(function (nova) {
          nova = Array.isArray(nova) ? nova[0] : nova;
          if (nova && nova.id) guardar('Apagar a promoção ' + t, [{ rpc: 'tenant_admin_apagar_promocao', args: { p_id: nova.id } }]);
          return 'Promoção "' + t + '" publicada no seu site.'; });
    };
    A.apagar_promocao = function (a) {
      return rpc('tenant_admin_listar_promocoes', E).then(function (l) {
        l = (l || []).map(function (x) { return { id: x.id, nome: x.titulo }; });
        var c = achar(l, a.titulo || a.nome);
        if (c.varios) throw new Error(pergunta(c));
        if (!c.um) throw new Error('Não achei essa promoção.');
        return rpc('tenant_admin_apagar_promocao', { p_id: c.um.id }).then(function () { return 'Apaguei a promoção ' + c.um.nome + '.'; });
      });
    };
    A.publicar_recado = function (a) {
      var t = String(a.texto || '').trim();
      so(t.length >= 2, 'Qual o recado?');
      return rpc('tenant_admin_publicar_status', com({ p_foto_url: null, p_texto: t.slice(0, 200) })).then(function () { return 'Recado publicado no seu site por 24 horas.'; });
    };
    A.remover_venda = function (a) {
      return rpc('tenant_admin_listar_vendas_hoje', E).then(function (l) {
        l = (l || []).map(function (v) { return { id: v.id, nome: v.descricao, valor: v.valor, forma: v.forma_pagamento }; });
        var c = a.descricao ? achar(l, a.descricao) : (l.length ? { um: l[0] } : {});
        if (c.varios) throw new Error(pergunta(c));
        if (!c.um) throw new Error('Não achei essa venda de hoje.');
        return rpc('tenant_admin_remover_venda', com({ p_id: c.um.id })).then(function () {
          guardar('Lançar de novo a venda ' + c.um.nome, [{ rpc: 'tenant_admin_registrar_venda', args: { p_estabelecimento_id: id, p_descricao: c.um.nome, p_valor: Number(c.um.valor) || 0, p_forma_pagamento: c.um.forma || 'pix', p_servico_id: null, p_staff_id: null, p_cliente_nome: null, p_cliente_telefone: null, p_staff_nome: null } }]);
          cx.recarregar('caixa'); return 'Apaguei a venda ' + c.um.nome + ' (' + preco(c.um.valor) + ').'; });
      });
    };

    /* ---------------- clientes e ajuda ---------------- */
    A.buscar_cliente = function (a) {
      return rpc('tenant_admin_listar_clientes', E).then(function (l) {
        l = (l || []).map(function (c) { return Object.assign({ nome: c.nome }, c); });
        var c = achar(l, a.nome);
        if (c.varios) throw new Error(pergunta(c));
        if (!c.um) throw new Error('Não achei esse cliente.');
        var x = c.um;
        return x.nome + ' · ' + String(x.telefone || '') + ' · ' + (Number(x.pedidos) || 0) + ' pedido(s), ' + (Number(x.agendamentos) || 0) + ' agendamento(s).';
      });
    };
    A.abrir_tour = function () { if (cx.tour) cx.tour(); return null; };

    // toda ação devolve uma promessa: um erro de validação ("qual o preço?") vira a fala do bot, não uma exceção solta
    Object.keys(A).forEach(function (k) { var f = A[k]; A[k] = function (a) { return Promise.resolve().then(function () { return f(a || {}); }); }; });
    return A;
  }

  // roda os passos guardados de uma ação (o "Desfazer" do chat). Passo = { rpc, args } ou o especial "recriar_cardapio".
  function executarDesfazer(db, passos) {
    var rpc = function (n, a) { return db.rpc(n, a).then(function (r) { if (r.error) throw new Error(r.error.message || 'Não consegui desfazer.'); return r.data; }); };
    return (passos || []).reduce(function (fila, passo) {
      return fila.then(function () {
        if (passo.rpc) return rpc(passo.rpc, passo.args || {});
        if (passo.tipo === 'recriar_cardapio') {
          var mapa = {}, estab = ((passo.itens || [])[0] || {}).p_estabelecimento_id || passo.estabelecimento_id;
          return (passo.categorias || []).reduce(function (f, c) {
            return f.then(function () { return rpc('delivery_admin_salvar_categoria', { p_id: null, p_estabelecimento_id: estab, p_nome: c.nome, p_ordem: c.ordem || 0 }).then(function (nova) { mapa[c.id] = nova && nova.id; }); });
          }, Promise.resolve()).then(function () {
            return (passo.itens || []).reduce(function (f, it) {
              return f.then(function () { return rpc('delivery_admin_salvar_item', Object.assign({}, it, { p_id: null, p_categoria_id: mapa[it.p_categoria_id] || it.p_categoria_id || null })); });
            }, Promise.resolve());
          });
        }
      });
    }, Promise.resolve());
  }

  var api = { criar: criar, executarDesfazer: executarDesfazer, _teste: { norm: norm, achar: achar, dataISO: dataISO, hora: hora, num: num } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.VBBotAcoes = api;
})(typeof window !== 'undefined' ? window : globalThis);
