/* Perguntas de cada tipo de negócio — entram no editor (editor-matriz.js)
   no capítulo "Sobre o seu negócio", uma por vez, e as respostas viram o
   "Bom saber" do site (o que o cliente quer saber antes de ir/pedir).

   Cada pergunta: chave (salva em estabelecimentos.respostas), pergunta,
   ajuda, tipo ('um' = escolhe uma, 'varios' = marca quantas quiser,
   'texto'), opcoes [[valor, rótulo]] e selo(valor) → a frase curta que
   aparece no site (ou null pra não mostrar nada).

   Uso:
     VBPerguntas.lista(segmento, areas)            → perguntas daquele negócio
     VBPerguntas.render(caixa, pergunta, respostas, salvar)
     VBPerguntas.bomSaberHtml(segmento, areas, respostas)
     VBPerguntas.carregar(estabId) / .salvar(estabId, chave, valor) */
(function (global) {
  'use strict';
  var SIM_NAO = [['sim', 'Sim'], ['nao', 'Não']];
  function sim(frase) { return function (v) { return v === 'sim' ? frase : null; }; }
  function mapa(m) { return function (v) { return m[v] || null; }; }

  /* ---------- por área (todo negócio daquela área responde) ---------- */
  var DA_AREA = {
    agenda: [
      { chave: 'sem_hora', pergunta: 'Atende quem chega sem horário marcado?', tipo: 'um',
        opcoes: [['sim', 'Sim, se tiver vaga'], ['nao', 'Só com horário marcado']],
        selo: mapa({ sim: 'Atende sem hora marcada, se tiver vaga', nao: 'Só com horário marcado' }) },
      { chave: 'pagamentos', pergunta: 'Como o cliente pode pagar aí?', tipo: 'varios',
        opcoes: [['pix', 'Pix'], ['cartao', 'Cartão'], ['dinheiro', 'Dinheiro']],
        selo: function (v) { return v && v.length ? 'Aceita ' + v.map(function (x) { return { pix: 'Pix', cartao: 'cartão', dinheiro: 'dinheiro' }[x]; }).join(', ').replace(/, ([^,]*)$/, ' e $1') : null; } },
      { chave: 'conforto', pergunta: 'O que o seu espaço tem?', ajuda: 'Marque o que tiver — aparece pro cliente antes de ir.', tipo: 'varios',
        opcoes: [['estacionamento', 'Estacionamento'], ['acessivel', 'Acesso pra cadeira de rodas'], ['wifi', 'Wi-Fi'], ['ar', 'Ar-condicionado'], ['cafe', 'Cafezinho']],
        selo: function (v) { return v && v.length ? v.map(function (x) { return { estacionamento: 'Estacionamento', acessivel: 'Acessível', wifi: 'Wi-Fi', ar: 'Ar-condicionado', cafe: 'Cafezinho' }[x]; }).join(' · ') : null; } }
    ],
    servicos: [
      { chave: 'garantia', pergunta: 'Dá garantia do serviço?', tipo: 'um',
        opcoes: [['nao', 'Não'], ['30', '30 dias'], ['90', '90 dias'], ['180', '6 meses'], ['365', '1 ano']],
        selo: function (v) { return v && v !== 'nao' ? 'Garantia de ' + { 30: '30 dias', 90: '90 dias', 180: '6 meses', 365: '1 ano' }[v] : null; } },
      { chave: 'nota_fiscal', pergunta: 'Emite nota fiscal?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Emite nota fiscal') },
      { chave: 'orcamento_gratis', pergunta: 'O orçamento é grátis?', tipo: 'um',
        opcoes: [['sim', 'Sim, grátis'], ['nao', 'Cobro a visita']], selo: mapa({ sim: 'Orçamento grátis', nao: 'Visita técnica cobrada' }) }
    ],
    delivery: [
      { chave: 'embalagem', pergunta: 'Como o pedido sai daí?', tipo: 'varios',
        opcoes: [['lacrado', 'Embalagem lacrada'], ['termica', 'Bolsa térmica'], ['sustentavel', 'Embalagem sustentável']],
        selo: function (v) { return v && v.length ? v.map(function (x) { return { lacrado: 'Embalagem lacrada', termica: 'Chega quentinho (bolsa térmica)', sustentavel: 'Embalagem sustentável' }[x]; }).join(' · ') : null; } }
    ]
  };

  /* ---------- por tipo de negócio ---------- */
  var DO_SEGMENTO = {
    tatuador: [
      { chave: 'sinal', pergunta: 'Cobra sinal pra reservar a sessão?', ajuda: 'Diz pro cliente antes de ele marcar — evita falta.', tipo: 'um',
        opcoes: [['nao', 'Não cobro'], ['desconta', 'Sim, e desconto do valor final'], ['sim', 'Sim']],
        selo: mapa({ nao: 'Não cobra sinal', desconta: 'Sinal pra reservar (descontado no valor)', sim: 'Sinal pra reservar a sessão' }) },
      { chave: 'menor', pergunta: 'Tatua menor de idade?', tipo: 'um',
        opcoes: [['nao', 'Não'], ['responsavel', 'Só com responsável presente']],
        selo: mapa({ nao: 'Só maiores de 18', responsavel: 'Menor só com responsável presente' }) },
      { chave: 'desenho', pergunta: 'Faz desenho exclusivo?', tipo: 'um',
        opcoes: [['sim', 'Sim, crio do zero'], ['flash', 'Trabalho com flash/catálogo'], ['ambos', 'Os dois']],
        selo: mapa({ sim: 'Desenho exclusivo', flash: 'Flash e catálogo', ambos: 'Desenho exclusivo ou flash' }) },
      { chave: 'retoque', pergunta: 'O retoque é grátis?', tipo: 'um',
        opcoes: [['nao', 'Não'], ['30', 'Até 30 dias'], ['60', 'Até 60 dias'], ['90', 'Até 90 dias']],
        selo: function (v) { return v && v !== 'nao' ? 'Retoque grátis em até ' + v + ' dias' : null; } },
      { chave: 'cover', pergunta: 'Faz cobertura (cover up) de tatuagem antiga?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Faz cobertura de tatuagem antiga') },
      { chave: 'descartavel', pergunta: 'Agulhas e materiais são descartáveis?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Material descartável, aberto na sua frente') }
    ],
    barbearia: [
      { chave: 'crianca', pergunta: 'Corta cabelo de criança?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Corta cabelo de criança') },
      { chave: 'bebida', pergunta: 'Oferece alguma coisa pra beber?', tipo: 'varios',
        opcoes: [['cafe', 'Café'], ['cerveja', 'Cerveja'], ['refri', 'Refrigerante'], ['agua', 'Água']],
        selo: function (v) { return v && v.length ? 'Tem ' + v.map(function (x) { return { cafe: 'café', cerveja: 'cerveja', refri: 'refri', agua: 'água' }[x]; }).join(', ').replace(/, ([^,]*)$/, ' e $1') + ' pra quem espera' : null; } }
    ],
    salao: [
      { chave: 'crianca', pergunta: 'Atende criança?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Atende criança') },
      { chave: 'produtos', pergunta: 'Vende os produtos que usa?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Vende os produtos que usa') }
    ],
    manicure_pedicure: [
      { chave: 'domicilio', pergunta: 'Atende a domicílio?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Atende a domicílio') },
      { chave: 'esterilizacao', pergunta: 'Esteriliza os alicates em autoclave?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Alicates esterilizados em autoclave') }
    ],
    estetica: [
      { chave: 'avaliacao', pergunta: 'A primeira avaliação é grátis?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Primeira avaliação grátis') },
      { chave: 'pacotes', pergunta: 'Tem pacote com várias sessões?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Pacotes com várias sessões') }
    ],
    estetica_automotiva: [
      { chave: 'leva_traz', pergunta: 'Busca e leva o carro?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Busca e leva o seu carro') },
      { chave: 'espera', pergunta: 'Tem onde o cliente esperar?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Sala de espera') }
    ],
    petshop: [
      { chave: 'taxi_dog', pergunta: 'Busca e leva o pet (táxi dog)?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Táxi dog: busca e leva o pet') },
      { chave: 'gato', pergunta: 'Atende gato?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Atende gatos') }
    ],
    pizzaria: [
      { chave: 'meio_a_meio', pergunta: 'Faz meio a meio?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Meio a meio') },
      { chave: 'sem_gluten', pergunta: 'Tem opção sem glúten ou sem lactose?', tipo: 'varios',
        opcoes: [['gluten', 'Sem glúten'], ['lactose', 'Sem lactose'], ['vegana', 'Vegana']],
        selo: function (v) { return v && v.length ? 'Tem opção ' + v.map(function (x) { return { gluten: 'sem glúten', lactose: 'sem lactose', vegana: 'vegana' }[x]; }).join(', ').replace(/, ([^,]*)$/, ' e $1') : null; } },
      { chave: 'forno', pergunta: 'O forno é a lenha?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Forno a lenha') }
    ],
    hamburgueria: [
      { chave: 'vegetariano', pergunta: 'Tem lanche vegetariano?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Tem opção vegetariana') },
      { chave: 'ponto', pergunta: 'O cliente escolhe o ponto da carne?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Você escolhe o ponto da carne') }
    ],
    lanchonete: [{ chave: 'vegetariano', pergunta: 'Tem lanche vegetariano?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Tem opção vegetariana') }],
    restaurante: [
      { chave: 'vegetariano', pergunta: 'Tem prato vegetariano?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Tem prato vegetariano') },
      { chave: 'self', pergunta: 'Como é o almoço aí?', tipo: 'um', opcoes: [['self', 'Self-service'], ['prato', 'Prato feito / à la carte'], ['ambos', 'Os dois']],
        selo: mapa({ self: 'Self-service', prato: 'Prato feito e à la carte', ambos: 'Self-service e à la carte' }) }
    ],
    japonesa: [{ chave: 'rodizio', pergunta: 'Tem rodízio no salão?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Rodízio no salão') }],
    marmitaria: [{ chave: 'cardapio_dia', pergunta: 'O cardápio muda todo dia?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Cardápio novo todo dia') }],
    acaiteria: [{ chave: 'monta', pergunta: 'O cliente monta o açaí do jeito dele?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Monte do seu jeito') }],
    sorveteria: [{ chave: 'sem_acucar', pergunta: 'Tem sorvete sem açúcar ou sem lactose?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Tem opção sem açúcar/sem lactose') }],
    doceria: [{ chave: 'encomenda', pergunta: 'Aceita encomenda de bolo e doces pra festa?', tipo: 'um',
      opcoes: [['nao', 'Não'], ['2', 'Sim, com 2 dias de antecedência'], ['7', 'Sim, com 1 semana']],
      selo: function (v) { return v === '2' ? 'Encomendas com 2 dias de antecedência' : v === '7' ? 'Encomendas com 1 semana de antecedência' : null; } }],
    padaria: [{ chave: 'fornada', pergunta: 'Tem fornada de pão quentinho em que horário?', tipo: 'texto', ajuda: 'Ex.: 6h, 11h e 17h',
      selo: function (v) { return v ? 'Pão quentinho: ' + v : null; } }],
    mercado: [{ chave: 'gelada', pergunta: 'Entrega bebida gelada?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Bebida gelada') }],
    adega: [
      { chave: 'gelada', pergunta: 'Entrega bebida gelada?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Chega gelada') },
      { chave: 'gelo', pergunta: 'Vende gelo e carvão?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Tem gelo e carvão') }
    ],
    borracharia: [{ chave: 'h24', pergunta: 'Atende 24 horas?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Atende 24h') }],
    guincho: [{ chave: 'h24', pergunta: 'Atende 24 horas?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Atende 24h') },
      { chave: 'moto', pergunta: 'Leva moto também?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Leva moto também') }],
    chaveiro: [{ chave: 'h24', pergunta: 'Atende 24 horas?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Atende 24h') },
      { chave: 'codificada', pergunta: 'Faz chave codificada de carro?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Faz chave codificada') }],
    eletricista: [{ chave: 'emergencia', pergunta: 'Atende emergência fora do horário?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Atende emergência') }],
    encanador: [{ chave: 'emergencia', pergunta: 'Atende vazamento de emergência?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Atende vazamento de emergência') }],
    pedreiro: [{ chave: 'material', pergunta: 'Compra o material ou o cliente compra?', tipo: 'um',
      opcoes: [['eu', 'Eu compro (incluso no orçamento)'], ['cliente', 'O cliente compra'], ['combina', 'A gente combina']],
      selo: mapa({ eu: 'Material incluso no orçamento', cliente: 'Material por conta do cliente', combina: 'Material: a combinar' }) }],
    ar_condicionado: [{ chave: 'instalacao', pergunta: 'O que você faz?', tipo: 'varios',
      opcoes: [['instala', 'Instalação'], ['limpa', 'Limpeza'], ['conserta', 'Conserto']],
      selo: function (v) { return v && v.length ? v.map(function (x) { return { instala: 'Instalação', limpa: 'Limpeza', conserta: 'Conserto' }[x]; }).join(' · ') : null; } }],
    diarista: [{ chave: 'material', pergunta: 'Leva o material de limpeza?', tipo: 'um', opcoes: [['sim', 'Sim, levo'], ['nao', 'Uso o da casa']],
      selo: mapa({ sim: 'Leva o material de limpeza', nao: 'Usa o material da casa' }) }],
    assistencia_tecnica: [{ chave: 'na_hora', pergunta: 'Conserta na hora (troca de tela, bateria)?', tipo: 'um', opcoes: SIM_NAO, selo: sim('Conserto na hora') }]
  };

  function lista(segmento, areas) {
    var out = [], vistas = {};
    function add(p) { if (!vistas[p.chave]) { vistas[p.chave] = 1; out.push(p); } }
    (DO_SEGMENTO[segmento] || []).forEach(add);
    (areas || ['agenda']).forEach(function (a) { (DA_AREA[a] || []).forEach(add); });
    return out;
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function respondida(p, v) { return p.tipo === 'varios' ? Array.isArray(v) : v != null && v !== ''; }

  // desenha UMA pergunta (botões grandes); salvar(chave, valor) grava
  function render(caixa, p, respostas, salvar) {
    var v = respostas[p.chave];
    if (p.tipo === 'texto') {
      caixa.innerHTML = '<input class="vbp-texto" id="vbpTexto" maxlength="80" value="' + esc(v || '') + '" placeholder="' + esc(p.ajuda || '') + '">';
      var inp = caixa.querySelector('#vbpTexto');
      inp.addEventListener('change', function () { salvar(p.chave, inp.value.trim() || null); });
      return;
    }
    var marcados = p.tipo === 'varios' ? (Array.isArray(v) ? v : []) : [v];
    caixa.innerHTML = '<div class="vbp-opcoes' + (p.tipo === 'varios' ? ' vbp-varios' : '') + '">' + p.opcoes.map(function (o) {
      var on = marcados.indexOf(o[0]) > -1;
      return '<button type="button" class="vbp-op' + (on ? ' ativo' : '') + '" data-vbp="' + esc(o[0]) + '" aria-pressed="' + on + '">' +
        '<span class="vbp-marca" aria-hidden="true"></span>' + esc(o[1]) + '</button>';
    }).join('') + '</div>' +
      (p.tipo === 'varios' ? '<p class="vbp-dica">Marque quantos quiser. Nenhum? Toque em Próximo.</p>' : '');
    caixa.querySelectorAll('[data-vbp]').forEach(function (b) {
      b.addEventListener('click', function () {
        var val = b.getAttribute('data-vbp');
        if (p.tipo === 'varios') {
          var atual = Array.isArray(respostas[p.chave]) ? respostas[p.chave].slice() : [];
          var i = atual.indexOf(val);
          if (i > -1) atual.splice(i, 1); else atual.push(val);
          salvar(p.chave, atual);
        } else {
          salvar(p.chave, respostas[p.chave] === val ? null : val);
        }
      });
    });
  }

  // "Bom saber" do site: só as respostas que viram frase
  function bomSaberHtml(segmento, areas, respostas) {
    var frases = lista(segmento, areas).map(function (p) {
      var v = respostas && respostas[p.chave];
      return respondida(p, v) ? p.selo(v) : null;
    }).filter(Boolean);
    if (!frases.length) return '';
    return '<section class="bom-saber"><p class="bom-saber-titulo">Bom saber</p><ul>' +
      frases.map(function (f) { return '<li><span aria-hidden="true">✓</span>' + esc(f) + '</li>'; }).join('') + '</ul></section>';
  }

  function carregar(estabId) {
    return global.db.rpc('respostas_publicas', { p_estabelecimento_id: estabId }).then(function (r) {
      return (r && !r.error && r.data) || {};
    }, function () { return {}; });
  }
  function salvar(estabId, chave, valor) {
    return global.db.rpc('tenant_admin_salvar_resposta', { p_estabelecimento_id: estabId, p_chave: chave, p_valor: valor == null ? null : valor })
      .then(function (r) { if (r.error) throw r.error; return r.data || {}; });
  }

  // passos prontos pro editor: um por pergunta, no capítulo "sobre"
  function passosEditor(estabId, segmento, areas, respostas, aoMudar) {
    return lista(segmento, areas).map(function (p) {
      return {
        id: 'q_' + p.chave, capitulo: 'sobre', titulo: p.pergunta, pergunta: p.pergunta, ajuda: p.ajuda || '',
        completo: function () { return respondida(p, respostas[p.chave]); },
        render: function (caixa, ctx) {
          render(caixa, p, respostas, function (chave, valor) {
            if (valor == null) delete respostas[chave]; else respostas[chave] = valor;
            ctx.atualizar();
            ctx.salvo('Salvando…');
            salvar(estabId, chave, valor).then(function (novas) {
              Object.keys(respostas).forEach(function (k) { delete respostas[k]; });
              Object.keys(novas).forEach(function (k) { respostas[k] = novas[k]; });
              ctx.salvo('Salvo');
              if (aoMudar) aoMudar(respostas);
            }, function (e) { ctx.salvo((e && e.message) || 'Não salvou — tente de novo', true); });
          });
        }
      };
    });
  }

  global.VBPerguntas = { lista: lista, render: render, bomSaberHtml: bomSaberHtml, carregar: carregar, salvar: salvar, passosEditor: passosEditor };
})(window);
