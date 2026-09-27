/* Dados de demonstração por segmento — usados na prévia ao vivo dos templates
   (perfil.html?demo=<segmento>&tpl=<template>). Nada aqui vai pro banco. */
(function (global) {
  'use strict';

  var HORARIO_NOITE = { '0': [['18:00', '23:30']], '2': [['18:00', '23:30']], '3': [['18:00', '23:30']], '4': [['18:00', '23:30']], '5': [['18:00', '00:30']], '6': [['18:00', '00:30']] };
  var HORARIO_COMERCIAL = { '1': [['08:00', '19:00']], '2': [['08:00', '19:00']], '3': [['08:00', '19:00']], '4': [['08:00', '19:00']], '5': [['08:00', '19:00']], '6': [['08:00', '14:00']] };

  function it(id, cat, nome, descricao, preco, extras) {
    var o = { id: id, categoria_id: cat, nome: nome, descricao: descricao, preco: preco, foto_url: null, permite_meio_a_meio: false, aceita_borda: false, ativo: true };
    for (var k in extras || {}) o[k] = extras[k];
    return o;
  }

  var DADOS = {
    pizzaria: {
      nome: 'Nome da sua pizzaria', descricao: 'Pizza de fermentação natural, forno a lenha e borda recheada. Meio a meio sem pagar mais por isso.',
      aviso: 'Terça é dia de rodízio de bordas: todas pela metade do preço.',
      horarios: HORARIO_NOITE,
      categorias: [{ id: 'c1', nome: 'Tradicionais' }, { id: 'c2', nome: 'Especiais' }, { id: 'c3', nome: 'Doces' }, { id: 'c4', nome: 'Bebidas' }],
      itens: [
        it('p1', 'c1', 'Mussarela', 'Mussarela, tomate fresco e orégano', 42.9, { permite_meio_a_meio: true, aceita_borda: true }),
        it('p2', 'c1', 'Calabresa', 'Calabresa fatiada, cebola roxa e azeitonas', 44.9, { permite_meio_a_meio: true, aceita_borda: true }),
        it('p3', 'c1', 'Portuguesa', 'Presunto, ovos, cebola, ervilha e mussarela', 49.9, { permite_meio_a_meio: true, aceita_borda: true }),
        it('p4', 'c1', 'Frango com catupiry', 'Frango desfiado temperado e catupiry original', 49.9, { permite_meio_a_meio: true, aceita_borda: true }),
        it('p5', 'c2', 'Toscana', 'Linguiça toscana artesanal, cebola caramelizada e parmesão', 56.9, { permite_meio_a_meio: true, aceita_borda: true }),
        it('p6', 'c2', 'Quatro queijos', 'Mussarela, gorgonzola, parmesão e catupiry', 58.9, { permite_meio_a_meio: true, aceita_borda: true }),
        it('p7', 'c2', 'Pepperoni', 'Pepperoni crocante e mel picante', 62.9, { permite_meio_a_meio: true, aceita_borda: true }),
        it('p8', 'c3', 'Chocolate com morango', 'Chocolate ao leite e morangos frescos', 46.9, { permite_meio_a_meio: true }),
        it('p9', 'c3', 'Romeu e Julieta', 'Goiabada cascão com queijo minas', 44.9, { permite_meio_a_meio: true }),
        it('p10', 'c4', 'Refrigerante 2L', 'Coca-Cola, Guaraná ou Fanta', 14),
        it('p11', 'c4', 'Suco natural 1L', 'Laranja ou limão', 16)
      ],
      bordas: [{ id: 'b1', nome: 'Catupiry', preco: 9 }, { id: 'b2', nome: 'Cheddar', preco: 9 }, { id: 'b3', nome: 'Chocolate', preco: 11 }],
      combos: [{ id: 'k1', nome: 'Combo Dobro', preco: 89.9, qtd_sabores: 2, itens_permitidos: ['p1', 'p2', 'p3', 'p4'] }]
    },
    hamburgueria: {
      nome: 'Nome da sua hamburgueria', descricao: 'Smash burger na chapa, pão brioche e batata cortada na hora.',
      horarios: HORARIO_NOITE,
      categorias: [{ id: 'c1', nome: 'Burgers' }, { id: 'c2', nome: 'Acompanhamentos' }, { id: 'c3', nome: 'Bebidas' }],
      itens: [
        it('h1', 'c1', 'Smash clássico', 'Dois smash de 80g, cheddar, cebola na chapa e molho da casa', 32.9),
        it('h2', 'c1', 'Bacon lover', 'Blend 160g, bacon crocante, cheddar e barbecue', 38.9),
        it('h3', 'c1', 'Veggie', 'Burger de grão-de-bico, rúcula, tomate e maionese verde', 34.9),
        it('h4', 'c2', 'Batata rústica', 'Com páprica e alecrim', 18.9),
        it('h5', 'c2', 'Onion rings', '12 anéis empanados', 21.9),
        it('h6', 'c3', 'Milkshake', 'Ovomaltine, morango ou doce de leite', 19.9),
        it('h7', 'c3', 'Refrigerante lata', '350ml', 7)
      ],
      bordas: [], combos: [{ id: 'k1', nome: 'Dupla da madrugada', preco: 64.9, qtd_sabores: 2, itens_permitidos: ['h1', 'h2', 'h3'] }]
    },
    petshop: {
      nome: 'Nome do seu petshop', descricao: 'Ração, petiscos e acessórios com entrega no mesmo dia.',
      horarios: HORARIO_COMERCIAL,
      categorias: [{ id: 'c1', nome: 'Rações' }, { id: 'c2', nome: 'Petiscos' }, { id: 'c3', nome: 'Higiene' }, { id: 'c4', nome: 'Brinquedos' }],
      itens: [
        it('a1', 'c1', 'Ração premium cães adultos 15kg', 'Frango e arroz, sem corantes', 189.9),
        it('a2', 'c1', 'Ração gatos castrados 10kg', 'Controle de peso e trato urinário', 164.9),
        it('a3', 'c2', 'Bifinho de carne', 'Pacote 500g', 24.9),
        it('a4', 'c2', 'Osso de couro', 'Kit com 5 unidades', 19.9),
        it('a5', 'c3', 'Tapete higiênico', '30 unidades, super absorvente', 54.9),
        it('a6', 'c3', 'Areia sanitária 4kg', 'Grãos finos, controle de odor', 29.9),
        it('a7', 'c4', 'Bolinha que apita', 'Borracha atóxica', 12.9)
      ],
      bordas: [], combos: []
    },
    mercado: {
      nome: 'Nome do seu mercado', descricao: 'Frutas, verduras e mercearia fresquinhos, direto do produtor.',
      horarios: HORARIO_COMERCIAL,
      categorias: [{ id: 'c1', nome: 'Frutas' }, { id: 'c2', nome: 'Verduras' }, { id: 'c3', nome: 'Mercearia' }],
      itens: [
        it('m1', 'c1', 'Banana prata (kg)', 'Madura no ponto', 6.49),
        it('m2', 'c1', 'Morango (bandeja)', '250g, orgânico', 9.9),
        it('m3', 'c1', 'Abacate (un)', 'Grande', 5.5),
        it('m4', 'c2', 'Alface crespa', 'Hidropônica', 3.99),
        it('m5', 'c2', 'Tomate italiano (kg)', 'Pra molho', 8.9),
        it('m6', 'c3', 'Ovos caipira (dúzia)', 'Granja local', 16.9),
        it('m7', 'c3', 'Café torrado 500g', 'Torra média', 24.9)
      ],
      bordas: [], combos: []
    },
    acaiteria: {
      nome: 'Nome da sua açaiteria', descricao: 'Açaí batido na hora, do jeito que você montar.',
      horarios: { '0': [['13:00', '22:00']], '2': [['13:00', '22:00']], '3': [['13:00', '22:00']], '4': [['13:00', '22:00']], '5': [['13:00', '23:00']], '6': [['13:00', '23:00']] },
      categorias: [{ id: 'c1', nome: 'Açaí' }, { id: 'c2', nome: 'Cremes' }, { id: 'c3', nome: 'Adicionais' }],
      itens: [
        it('q1', 'c1', 'Açaí 300ml', 'Com banana, granola e leite condensado', 16.9),
        it('q2', 'c1', 'Açaí 500ml', 'Com morango, leite em pó e paçoca', 22.9),
        it('q3', 'c1', 'Açaí 700ml', 'Monte com até 5 acompanhamentos', 28.9),
        it('q4', 'c2', 'Creme de cupuaçu 500ml', 'Com castanha e mel', 24.9),
        it('q5', 'c3', 'Nutella extra', 'Porção de 30g', 6)
      ],
      bordas: [], combos: []
    },
    japonesa: {
      nome: 'Nome do seu restaurante', descricao: 'Peças montadas na hora com peixe fresco todos os dias.',
      horarios: HORARIO_NOITE,
      categorias: [{ id: 'c1', nome: 'Combinados' }, { id: 'c2', nome: 'Temakis' }, { id: 'c3', nome: 'Quentes' }],
      itens: [
        it('j1', 'c1', 'Combinado 20 peças', 'Sashimi, niguiri, uramaki e hossomaki', 69.9),
        it('j2', 'c1', 'Combinado 40 peças', 'Pra dividir — o mais pedido da casa', 124.9),
        it('j3', 'c2', 'Temaki salmão completo', 'Salmão, cream cheese e cebolinha', 32.9),
        it('j4', 'c3', 'Hot roll (10 un)', 'Empanado, com molho tarê', 29.9),
        it('j5', 'c3', 'Yakisoba', 'Carne, frango e legumes', 42.9)
      ],
      bordas: [], combos: []
    }
  };
  var H24 = { '0': [['00:00', '24:00']], '1': [['00:00', '24:00']], '2': [['00:00', '24:00']], '3': [['00:00', '24:00']], '4': [['00:00', '24:00']], '5': [['00:00', '24:00']], '6': [['00:00', '24:00']] };
  DADOS.borracharia = {
    nome: 'Nome da sua borracharia', descricao: 'Pneu furou? A gente vai até você em qualquer bairro da cidade, 24 horas. Carro, moto, caminhonete e caminhão.',
    aviso: 'Socorro 24h em toda a cidade — mande sua localização que a gente chega.',
    horarios: H24, taxa_entrega: 15, tempo_min: 20, tempo_max: 40,
    categorias: [{ id: 'c1', nome: 'Socorro no local' }, { id: 'c2', nome: 'Reparos' }, { id: 'c3', nome: 'Pneus' }, { id: 'c4', nome: 'Na borracharia' }],
    itens: [
      it('r1', 'c1', 'Troca pelo estepe', 'Tiramos o furado e colocamos o estepe, onde você estiver', 50),
      it('r2', 'c1', 'Pneu de moto furado', 'Reparo no local sem tirar a roda (quando possível)', 35),
      it('r3', 'c1', 'Carga de bateria', 'Chupeta com cabo e verificação rápida', 40),
      it('r4', 'c2', 'Remendo a frio', 'Furo simples na banda de rodagem', 35),
      it('r5', 'c2', 'Vulcanização (remendo a quente)', 'Pra corte maior ou furo que o remendo simples não segura', 70),
      it('r6', 'c2', 'Calibragem + conferência', 'Calibra os 4 pneus e confere estepe e válvulas', 15),
      it('r7', 'c3', 'Pneu novo', 'Traga a medida (ex.: 175/70 R13) — orçamento na hora', 0),
      it('r8', 'c3', 'Pneu remold', 'Opção econômica, com garantia — orçamento na hora', 0),
      it('r9', 'c4', 'Balanceamento (por roda)', 'Na borracharia, com máquina', 15),
      it('r10', 'c4', 'Alinhamento', 'Na borracharia', 70)
    ],
    bordas: [], combos: []
  };
  DADOS.chaveiro = {
    nome: 'Nome do seu chaveiro', descricao: 'Ficou trancado pra fora? Abertura de porta, carro e cópia de chave — a gente vai até você.',
    horarios: H24, taxa_entrega: 20, tempo_min: 20, tempo_max: 40,
    categorias: [{ id: 'c1', nome: 'Emergência' }, { id: 'c2', nome: 'Na loja' }],
    itens: [
      it('k1', 'c1', 'Abertura de porta residencial', 'Sem danificar a fechadura, sempre que possível', 90),
      it('k2', 'c1', 'Abertura de carro', 'Todas as marcas', 120),
      it('k3', 'c1', 'Troca de segredo', 'Fechadura continua, a chave antiga deixa de abrir', 70),
      it('k4', 'c2', 'Cópia de chave simples', 'Na hora', 12),
      it('k5', 'c2', 'Chave codificada de carro', 'Orçamento conforme o modelo', 0)
    ],
    bordas: [], combos: []
  };
  DADOS.pedreiro = {
    nome: 'Nome da sua empresa de reformas', descricao: 'Pequenas e grandes reformas em Itapetininga e região. Visita pra orçamento sem compromisso.',
    horarios: HORARIO_COMERCIAL, taxa_entrega: 0, tempo_min: 1, tempo_max: 3,
    categorias: [{ id: 'c1', nome: 'Reforma' }, { id: 'c2', nome: 'Acabamento' }, { id: 'c3', nome: 'Reparos' }],
    itens: [
      it('m1', 'c1', 'Reforma de banheiro', 'Troca de piso, revestimento e louças', 0),
      it('m2', 'c1', 'Construção de muro', 'Bloco ou tijolo, com ou sem reboco', 0),
      it('m3', 'c2', 'Assentamento de piso', 'Por metro quadrado, material à parte', 0),
      it('m4', 'c2', 'Pintura interna', 'Por cômodo, com massa corrida', 0),
      it('m5', 'c3', 'Reparo de vazamento em parede', 'Localiza, abre e fecha com acabamento', 0),
      it('m6', 'c3', 'Troca de telhas', 'Com revisão do madeiramento', 0)
    ],
    bordas: [], combos: []
  };
  DADOS.lanchonete = DADOS.hamburgueria;
  DADOS.restaurante = DADOS.japonesa;

  function montar(segmento, template) {
    var base = DADOS[segmento] || DADOS.pizzaria;
    var seg = DADOS[segmento] ? segmento : 'pizzaria';
    return {
      estabelecimento: {
        id: 'demo', nome: base.nome, slug: 'demo', cidade: 'itapetininga', segmento: seg,
        telefone_whatsapp: '15999999999', template: template || 'claro', cor_destaque: null, layout: null,
        modo: global.VB && global.VB.modoDoSegmento(seg) === 'servico' ? 'servico' : 'cardapio', areas: ['agenda'],
        descricao: base.descricao, aviso: base.aviso || null,
        tempo_entrega_min: base.tempo_min || 30, tempo_entrega_max: base.tempo_max || 50,
        taxa_entrega: base.taxa_entrega != null ? base.taxa_entrega : 6, pedido_minimo: global.VB && global.VB.modoDoSegmento(seg) === 'servico' ? null : 25,
        aceita_entrega: true, aceita_retirada: true,
        status_manual: 'aberto', horarios: base.horarios,
        formas_pagamento: ['pix', 'cartao', 'dinheiro'], chave_pix: 'pix@exemplo.com.br',
        endereco: 'Rua Campos Salles, 100 — Centro', instagram_url: null,
        foto_capa_url: null, foto_perfil_url: null, aberto_agora: true
      },
      cardapio: {
        categorias: base.categorias,
        itens: base.itens,
        bordas: base.bordas,
        combos: base.combos
      }
    };
  }

  global.VBDemo = { montar: montar, segmentos: Object.keys(DADOS) };
})(window);
