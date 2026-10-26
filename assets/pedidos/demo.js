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
  var HORARIO_ALMOCO = { '1': [['10:30', '14:30']], '2': [['10:30', '14:30']], '3': [['10:30', '14:30']], '4': [['10:30', '14:30']], '5': [['10:30', '14:30']], '6': [['10:30', '14:00']] };
  var HORARIO_TARDE = { '0': [['12:00', '22:00']], '2': [['12:00', '22:00']], '3': [['12:00', '22:00']], '4': [['12:00', '22:00']], '5': [['12:00', '23:00']], '6': [['12:00', '23:00']] };
  var HORARIO_CEDO = { '0': [['06:00', '12:00']], '1': [['06:00', '20:00']], '2': [['06:00', '20:00']], '3': [['06:00', '20:00']], '4': [['06:00', '20:00']], '5': [['06:00', '20:00']], '6': [['06:00', '20:00']] };
  function modelo(nome, descricao, horarios, categorias, itens, extra) {
    var o = { nome: nome, descricao: descricao, horarios: horarios, categorias: categorias, itens: itens, bordas: [], combos: [] };
    for (var k in extra || {}) o[k] = extra[k];
    return o;
  }
  function cats(lista) { return lista.map(function (n, i) { return { id: 'c' + (i + 1), nome: n }; }); }

  // ---------- Pedir (delivery) ----------
  DADOS.lanchonete = modelo('Nome da sua lanchonete', 'Lanches na chapa, porções e sucos feitos na hora.', HORARIO_NOITE,
    cats(['Lanches', 'Porções', 'Bebidas']), [
      it('l1', 'c1', 'X-salada', 'Hambúrguer, queijo, alface, tomate e maionese da casa', 22.9),
      it('l2', 'c1', 'X-bacon', 'Hambúrguer, bacon crocante, queijo e salada', 27.9),
      it('l3', 'c1', 'X-tudo', 'Dois hambúrgueres, ovo, bacon, presunto, queijo e salada', 34.9),
      it('l4', 'c1', 'Misto quente', 'Pão de forma, presunto e queijo na chapa', 12),
      it('l5', 'c2', 'Batata frita', 'Porção de 400g', 24.9),
      it('l6', 'c2', 'Calabresa acebolada', 'Porção com pão', 32.9),
      it('l7', 'c3', 'Suco natural 500ml', 'Laranja, limão ou maracujá', 10),
      it('l8', 'c3', 'Refrigerante lata', '350ml', 6.5)
    ]);
  DADOS.restaurante = modelo('Nome do seu restaurante', 'Comida caseira feita no dia, com tempero de casa.', HORARIO_ALMOCO,
    cats(['Pratos do dia', 'Executivos', 'Sobremesas', 'Bebidas']), [
      it('r1', 'c1', 'Feijoada (quarta e sábado)', 'Com arroz, couve, farofa, torresmo e laranja', 39.9),
      it('r2', 'c1', 'Frango assado com batatas', 'Coxa e sobrecoxa, arroz e salada', 29.9),
      it('r3', 'c2', 'Executivo de bife acebolado', 'Arroz, feijão, fritas e salada', 32.9),
      it('r4', 'c2', 'Executivo de filé de frango', 'Grelhado, arroz, feijão e legumes', 29.9),
      it('r5', 'c2', 'Parmegiana de carne', 'Com arroz e fritas — serve bem uma pessoa', 39.9),
      it('r6', 'c3', 'Pudim de leite', 'Fatia', 9),
      it('r7', 'c4', 'Suco natural 500ml', 'Laranja, limão ou abacaxi com hortelã', 10),
      it('r8', 'c4', 'Refrigerante 600ml', 'Coca-Cola ou Guaraná', 8)
    ]);
  DADOS.marmitaria = modelo('Nome da sua marmitaria', 'Marmita caseira quentinha no almoço — cardápio novo todo dia.', HORARIO_ALMOCO,
    cats(['Marmitas', 'Fitness', 'Bebidas']), [
      it('mm1', 'c1', 'Marmita pequena', 'Arroz, feijão, 1 carne e 2 acompanhamentos', 18),
      it('mm2', 'c1', 'Marmita média', 'Arroz, feijão, 1 carne e 3 acompanhamentos', 22),
      it('mm3', 'c1', 'Marmita grande', 'Arroz, feijão, 2 carnes e 3 acompanhamentos', 27),
      it('mm4', 'c2', 'Fit de frango', 'Frango grelhado, arroz integral e legumes no vapor', 24),
      it('mm5', 'c2', 'Fit de patinho', 'Patinho moído, batata-doce e brócolis', 26),
      it('mm6', 'c3', 'Suco natural 300ml', 'Laranja ou limão', 7),
      it('mm7', 'c3', 'Refrigerante lata', '350ml', 6)
    ], { pedido_minimo: 18 });
  DADOS.sorveteria = modelo('Nome da sua sorveteria', 'Sorvete artesanal, picolé e milk-shake.', HORARIO_TARDE,
    cats(['Potes', 'Taças e shakes', 'Picolés']), [
      it('sv1', 'c1', 'Pote 500ml', 'Até 2 sabores', 24.9),
      it('sv2', 'c1', 'Pote 1,5L', 'Até 3 sabores', 49.9),
      it('sv3', 'c2', 'Taça banana split', 'Banana, 3 bolas, chantilly e calda', 26.9),
      it('sv4', 'c2', 'Milk-shake 500ml', 'Chocolate, morango ou ovomaltine', 19.9),
      it('sv5', 'c3', 'Picolé de fruta', 'Limão, morango, coco ou uva', 5),
      it('sv6', 'c3', 'Picolé cremoso', 'Chocolate, leite condensado ou pistache', 7.5)
    ]);
  DADOS.doceria = modelo('Nome da sua doceria', 'Bolos, docinhos e sobremesas feitos à mão. Encomendas pra festa.', HORARIO_COMERCIAL,
    cats(['Bolos', 'Docinhos', 'Sobremesas']), [
      it('d1', 'c1', 'Bolo de pote', 'Ninho com morango, prestígio ou brigadeiro', 13),
      it('d2', 'c1', 'Bolo inteiro 1kg', 'Escolha a massa e o recheio — encomenda com 1 dia', 79.9),
      it('d3', 'c1', 'Fatia de bolo', 'Sabor do dia', 12),
      it('d4', 'c2', 'Brigadeiro gourmet (cento)', 'Encomenda pra festa', 120),
      it('d5', 'c2', 'Caixa com 6 doces', 'Brigadeiro, beijinho e bicho-de-pé', 18),
      it('d6', 'c3', 'Brownie', 'Com nozes, recheado de doce de leite', 11),
      it('d7', 'c3', 'Pudim inteiro', 'Pudim de leite condensado — 1kg', 45)
    ]);
  DADOS.padaria = modelo('Nome da sua padaria', 'Pão quentinho toda hora, café da manhã e lanches.', HORARIO_CEDO,
    cats(['Pães', 'Café da manhã', 'Salgados', 'Bolos e doces']), [
      it('pd1', 'c1', 'Pão francês (10 un)', 'Saindo do forno', 9),
      it('pd2', 'c1', 'Pão de forma caseiro', 'Fatiado', 12),
      it('pd3', 'c2', 'Kit café da manhã', 'Pão na chapa, café com leite, suco e fruta', 24.9),
      it('pd4', 'c2', 'Pão de queijo (10 un)', 'Mineiro, assado na hora', 14),
      it('pd5', 'c3', 'Coxinha', 'Frango com catupiry', 7),
      it('pd6', 'c3', 'Esfiha de carne', 'Aberta', 6),
      it('pd7', 'c4', 'Bolo de cenoura com chocolate', 'Inteiro, 800g', 32),
      it('pd8', 'c4', 'Sonho', 'Creme ou doce de leite', 6.5)
    ]);
  DADOS.adega = modelo('Nome da sua adega', 'Cerveja gelada, destilados e gelo com entrega rápida.', HORARIO_NOITE,
    cats(['Cervejas', 'Destilados', 'Sem álcool', 'Gelo e carvão']), [
      it('ad1', 'c1', 'Cerveja lata 350ml (12 un)', 'Pilsen, bem gelada', 45),
      it('ad2', 'c1', 'Cerveja long neck', 'Unidade', 7.5),
      it('ad3', 'c2', 'Vodka 1L', 'Nacional', 39.9),
      it('ad4', 'c2', 'Whisky 1L', '8 anos', 99.9),
      it('ad5', 'c3', 'Energético 2L', 'Unidade', 16.9),
      it('ad6', 'c3', 'Refrigerante 2L', 'Coca-Cola, Guaraná ou Fanta', 12),
      it('ad7', 'c4', 'Gelo 5kg', 'Pacote', 12),
      it('ad8', 'c4', 'Carvão 3kg', 'Saco', 18)
    ], { aviso: 'Venda proibida para menores de 18 anos.' });

  // ---------- Chamar (serviços) ----------
  function servico(nome, descricao, horarios, categorias, itens, extra) {
    var o = modelo(nome, descricao, horarios, categorias, itens, extra);
    if (o.taxa_entrega == null) o.taxa_entrega = 0;
    return o;
  }
  DADOS.guincho = servico('Nome do seu guincho', 'Guincho 24h pra carro e moto — leva até a oficina ou pra casa.', H24,
    cats(['Socorro', 'Transporte']), [
      it('g1', 'c1', 'Guincho urbano', 'Dentro da cidade', 180),
      it('g2', 'c1', 'Pane seca (combustível)', 'Levamos combustível até você', 80),
      it('g3', 'c1', 'Carga de bateria', 'Chupeta no local', 60),
      it('g4', 'c2', 'Guincho rodoviário (por km)', 'Fora da cidade — valor por km rodado', 6),
      it('g5', 'c2', 'Transporte de moto', 'Prancha própria pra moto', 150)
    ], { taxa_entrega: 0, tempo_min: 20, tempo_max: 45, aviso: 'Atendimento 24h — mande sua localização.' });
  DADOS.eletricista = servico('Seu nome ou da sua empresa', 'Instalação, reparo e manutenção elétrica residencial e comercial.', HORARIO_COMERCIAL,
    cats(['Emergência', 'Instalação', 'Manutenção']), [
      it('e1', 'c1', 'Falta de energia / disjuntor desarmando', 'Diagnóstico e reparo no local', 120),
      it('e2', 'c1', 'Curto-circuito', 'Localiza e corrige', 150),
      it('e3', 'c2', 'Instalação de chuveiro', 'Com troca de resistência se precisar', 90),
      it('e4', 'c2', 'Instalação de tomada ou interruptor', 'Por ponto', 45),
      it('e5', 'c2', 'Instalação de ventilador de teto', 'Com suporte', 120),
      it('e6', 'c3', 'Troca de padrão de energia', 'Orçamento conforme a concessionária', 0)
    ], { taxa_entrega: 30, tempo_min: 30, tempo_max: 90 });
  DADOS.encanador = servico('Seu nome ou da sua empresa', 'Vazamentos, desentupimentos e instalações hidráulicas.', HORARIO_COMERCIAL,
    cats(['Emergência', 'Instalação', 'Reparos']), [
      it('h1', 'c1', 'Vazamento', 'Localiza e conserta', 120),
      it('h2', 'c1', 'Desentupimento de pia ou ralo', 'Com máquina', 130),
      it('h3', 'c1', 'Desentupimento de vaso', 'Com máquina', 150),
      it('h4', 'c2', 'Instalação de torneira ou misturador', 'Material à parte', 70),
      it('h5', 'c2', 'Instalação de caixa d’água', 'Até 1000L', 250),
      it('h6', 'c3', 'Troca de reparo de descarga', 'Válvula ou caixa acoplada', 80)
    ], { taxa_entrega: 30, tempo_min: 30, tempo_max: 90 });
  DADOS.assistencia_tecnica = servico('Nome da sua assistência', 'Conserto de celular, notebook e eletrônicos com garantia.', HORARIO_COMERCIAL,
    cats(['Celular', 'Computador', 'Outros']), [
      it('at1', 'c1', 'Troca de tela', 'Orçamento conforme o modelo', 0),
      it('at2', 'c1', 'Troca de bateria', 'Peça com garantia de 90 dias', 150),
      it('at3', 'c1', 'Conector de carga', 'Limpeza ou troca', 90),
      it('at4', 'c2', 'Formatação com backup', 'Windows, programas e arquivos', 120),
      it('at5', 'c2', 'Limpeza interna + pasta térmica', 'Notebook esquentando ou desligando', 130),
      it('at6', 'c3', 'Diagnóstico', 'Descontado se fizer o serviço', 40)
    ], { taxa_entrega: 0, tempo_min: 1, tempo_max: 3 });
  DADOS.vidraceiro = servico('Nome da sua vidraçaria', 'Box, espelho, janela e vidro temperado sob medida.', HORARIO_COMERCIAL,
    cats(['Sob medida', 'Reparos']), [
      it('v1', 'c1', 'Box de banheiro', 'Vidro temperado 8mm — medição grátis', 0),
      it('v2', 'c1', 'Espelho sob medida', 'Com ou sem bisotê', 0),
      it('v3', 'c1', 'Janela de vidro', 'Sob medida', 0),
      it('v4', 'c2', 'Troca de vidro quebrado', 'Janela ou porta', 0),
      it('v5', 'c2', 'Regulagem de box', 'Roldanas e vedação', 90)
    ], { tempo_min: 1, tempo_max: 5 });
  DADOS.ar_condicionado = servico('Nome da sua empresa', 'Instalação, limpeza e manutenção de ar-condicionado.', HORARIO_COMERCIAL,
    cats(['Instalação', 'Manutenção']), [
      it('ac1', 'c1', 'Instalação split até 12.000 BTUs', 'Com até 3m de tubulação', 450),
      it('ac2', 'c1', 'Instalação split 18.000 a 24.000 BTUs', 'Com até 3m de tubulação', 600),
      it('ac3', 'c2', 'Limpeza completa (higienização)', 'Evaporadora e condensadora', 200),
      it('ac4', 'c2', 'Carga de gás', 'Com teste de vazamento', 250),
      it('ac5', 'c2', 'Visita técnica', 'Diagnóstico — descontado no serviço', 80)
    ], { tempo_min: 1, tempo_max: 3 });
  DADOS.montador = servico('Seu nome ou da sua empresa', 'Montagem e desmontagem de móveis com cuidado e rapidez.', HORARIO_COMERCIAL,
    cats(['Montagem', 'Outros']), [
      it('mo1', 'c1', 'Guarda-roupa', 'Até 6 portas', 180),
      it('mo2', 'c1', 'Cama ou berço', 'Montagem completa', 80),
      it('mo3', 'c1', 'Armário de cozinha', 'Por módulo', 60),
      it('mo4', 'c1', 'Rack ou painel de TV', 'Com fixação na parede', 120),
      it('mo5', 'c2', 'Desmontagem pra mudança', 'Por móvel', 50),
      it('mo6', 'c2', 'Instalação de prateleira ou cortina', 'Por peça', 40)
    ], { tempo_min: 1, tempo_max: 3 });
  DADOS.diarista = servico('Seu nome', 'Faxina caprichada em casa, apartamento ou escritório.', HORARIO_COMERCIAL,
    cats(['Faxina', 'Extras']), [
      it('di1', 'c1', 'Diária (8h)', 'Limpeza completa da casa', 180),
      it('di2', 'c1', 'Meia diária (4h)', 'Limpeza de manutenção', 110),
      it('di3', 'c1', 'Faxina pós-obra', 'Orçamento conforme o tamanho', 0),
      it('di4', 'c2', 'Passar roupa', 'Por cesto', 60),
      it('di5', 'c2', 'Limpeza de vidros e janelas', 'Por casa', 80)
    ], { tempo_min: 1, tempo_max: 4 });
  DADOS.jardinagem = servico('Seu nome ou da sua empresa', 'Corte de grama, poda e manutenção de jardim.', HORARIO_COMERCIAL,
    cats(['Manutenção', 'Projetos']), [
      it('ja1', 'c1', 'Corte de grama', 'Até 100m², com recolhimento', 90),
      it('ja2', 'c1', 'Poda de árvores e arbustos', 'Por visita', 150),
      it('ja3', 'c1', 'Limpeza de terreno', 'Orçamento conforme o tamanho', 0),
      it('ja4', 'c2', 'Plantio de grama', 'Por m², grama à parte', 8),
      it('ja5', 'c2', 'Projeto de jardim', 'Visita e projeto', 0)
    ], { tempo_min: 1, tempo_max: 5 });
  DADOS.dedetizacao = servico('Nome da sua empresa', 'Dedetização, descupinização e controle de pragas com garantia.', HORARIO_COMERCIAL,
    cats(['Controle de pragas', 'Limpeza']), [
      it('dd1', 'c1', 'Dedetização residencial', 'Baratas, formigas e aranhas — garantia de 90 dias', 220),
      it('dd2', 'c1', 'Descupinização', 'Orçamento após vistoria', 0),
      it('dd3', 'c1', 'Controle de ratos', 'Com iscas e monitoramento', 250),
      it('dd4', 'c2', 'Limpeza de caixa d’água', 'Até 1000L, com laudo', 180)
    ], { tempo_min: 1, tempo_max: 4 });
  DADOS.estetica_automotiva = servico('Nome da sua estética automotiva', 'Lavagem, polimento e higienização — leve e busque ou a gente vai até você.', HORARIO_COMERCIAL,
    cats(['Lavagem', 'Detalhamento']), [
      it('ea1', 'c1', 'Lavagem simples', 'Externa + aspiração', 50),
      it('ea2', 'c1', 'Lavagem completa', 'Externa, interna, cera e pretinho', 90),
      it('ea3', 'c2', 'Polimento técnico', 'Remove riscos e devolve o brilho', 350),
      it('ea4', 'c2', 'Higienização interna', 'Bancos, carpete e teto', 250),
      it('ea5', 'c2', 'Vitrificação de pintura', 'Proteção por até 2 anos', 900)
    ], { taxa_entrega: 20, tempo_min: 1, tempo_max: 3 });

  // tipos sem exemplo próprio usam o exemplo mais parecido (com o nome certo)
  var PARECIDO = {};
  function montar(segmento, template) {
    var fonte = DADOS[segmento] ? segmento : (PARECIDO[segmento] || 'pizzaria');
    var base = Object.assign({}, DADOS[fonte]);
    var seg = DADOS[segmento] || PARECIDO[segmento] ? segmento : 'pizzaria';
    if (!DADOS[segmento] && PARECIDO[segmento] && global.VibeSegmentos) base.nome = global.VibeSegmentos.exemplo(segmento);
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
