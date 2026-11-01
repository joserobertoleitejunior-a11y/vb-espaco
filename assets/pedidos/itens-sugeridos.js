/* O que cada tipo de negócio costuma vender — só os NOMES, agrupados por
   categoria. Serve pro passo a passo do cardápio: o dono toca no que vende e
   o item entra na categoria certa, sem preço nenhum (quem põe valor é ele).
   Vale pro delivery (cardápio) e pros serviços (catálogo de chamados). */
(function (global) {
  'use strict';
  var C = {
    pizzaria: [
      ['Tradicionais', ['Mussarela', 'Calabresa', 'Portuguesa', 'Frango com catupiry', 'Marguerita', 'Bacon']],
      ['Especiais', ['Quatro queijos', 'Toscana', 'Pepperoni', 'Lombo canadense', 'Camarão']],
      ['Doces', ['Chocolate', 'Romeu e Julieta', 'Prestígio', 'Banana com canela']],
      ['Bebidas', ['Refrigerante 2L', 'Refrigerante lata', 'Suco natural', 'Cerveja long neck', 'Água']]
    ],
    hamburgueria: [
      ['Burgers', ['Smash clássico', 'Cheddar bacon', 'Duplo da casa', 'Frango crocante', 'Vegetariano', 'Kids']],
      ['Acompanhamentos', ['Batata frita', 'Batata com cheddar e bacon', 'Onion rings', 'Nuggets']],
      ['Bebidas', ['Refrigerante lata', 'Suco', 'Milkshake', 'Água']]
    ],
    lanchonete: [
      ['Lanches', ['X-salada', 'X-burger', 'X-egg', 'X-tudo', 'Misto quente', 'Bauru']],
      ['Porções', ['Batata frita', 'Frango à passarinho', 'Calabresa acebolada', 'Polenta']],
      ['Bebidas', ['Refrigerante lata', 'Suco', 'Vitamina', 'Café', 'Água']]
    ],
    restaurante: [
      ['Pratos', ['Prato feito', 'Executivo de frango', 'Executivo de carne', 'Filé de peixe', 'Massa do dia', 'Feijoada']],
      ['Porções', ['Porção de fritas', 'Salada', 'Farofa']],
      ['Sobremesas', ['Pudim', 'Mousse', 'Salada de frutas']],
      ['Bebidas', ['Refrigerante', 'Suco', 'Água', 'Cerveja']]
    ],
    japonesa: [
      ['Combinados', ['Combinado 20 peças', 'Combinado 30 peças', 'Combinado família']],
      ['Sushi e sashimi', ['Sashimi salmão', 'Niguiri salmão', 'Uramaki Filadélfia', 'Hossomaki', 'Temaki salmão']],
      ['Quentes', ['Yakissoba', 'Guioza', 'Harumaki', 'Tempurá']],
      ['Bebidas', ['Refrigerante', 'Chá gelado', 'Água', 'Saquê']]
    ],
    marmitaria: [
      ['Marmitas', ['Marmita pequena', 'Marmita média', 'Marmita grande', 'Marmita fitness', 'Marmita vegetariana']],
      ['Do dia', ['Prato do dia', 'Feijoada (sábado)', 'Macarronada']],
      ['Bebidas', ['Refrigerante lata', 'Suco', 'Água']]
    ],
    acaiteria: [
      ['Açaí', ['Açaí 300ml', 'Açaí 500ml', 'Açaí 700ml', 'Açaí no copo', 'Barca de açaí']],
      ['Complementos', ['Granola', 'Leite condensado', 'Paçoca', 'Morango', 'Banana', 'Nutella']],
      ['Outros', ['Sorvete', 'Milkshake', 'Vitamina', 'Água']]
    ],
    sorveteria: [
      ['Sorvetes', ['Casquinha', 'Copo 1 bola', 'Copo 2 bolas', 'Pote 1 litro', 'Picolé']],
      ['Especiais', ['Milkshake', 'Sundae', 'Banana split', 'Açaí']],
      ['Bebidas', ['Refrigerante', 'Água']]
    ],
    doceria: [
      ['Doces', ['Brigadeiro', 'Beijinho', 'Brownie', 'Cupcake', 'Trufa', 'Pudim']],
      ['Bolos', ['Fatia de bolo', 'Bolo no pote', 'Bolo inteiro (encomenda)', 'Torta']],
      ['Bebidas', ['Café', 'Chocolate quente', 'Suco', 'Refrigerante']]
    ],
    padaria: [
      ['Padaria', ['Pão francês (kg)', 'Pão de forma', 'Pão doce', 'Bisnaguinha', 'Broa']],
      ['Lanches', ['Misto quente', 'Pão na chapa', 'Coxinha', 'Esfiha', 'Empada']],
      ['Bolos e doces', ['Fatia de bolo', 'Sonho', 'Rosca']],
      ['Bebidas', ['Café', 'Suco', 'Refrigerante', 'Leite']]
    ],
    mercado: [
      ['Mercearia', ['Arroz 5kg', 'Feijão 1kg', 'Açúcar 1kg', 'Óleo', 'Macarrão', 'Café 500g']],
      ['Frios e laticínios', ['Leite 1L', 'Queijo (kg)', 'Presunto (kg)', 'Manteiga', 'Iogurte']],
      ['Hortifrúti', ['Banana (kg)', 'Tomate (kg)', 'Batata (kg)', 'Cebola (kg)', 'Alface']],
      ['Bebidas', ['Refrigerante 2L', 'Cerveja', 'Água', 'Suco']],
      ['Limpeza e higiene', ['Detergente', 'Sabão em pó', 'Papel higiênico', 'Água sanitária']]
    ],
    adega: [
      ['Cervejas', ['Cerveja lata', 'Cerveja long neck', 'Cerveja litrão', 'Fardo de cerveja']],
      ['Destilados', ['Vodka', 'Whisky', 'Cachaça', 'Gin']],
      ['Vinhos', ['Vinho tinto', 'Vinho branco', 'Espumante']],
      ['Outros', ['Energético', 'Refrigerante', 'Gelo', 'Petisco']]
    ],
    petshop: [
      ['Rações', ['Ração cães adultos', 'Ração filhotes', 'Ração gatos', 'Ração a granel (kg)']],
      ['Petiscos', ['Bifinho', 'Osso de couro', 'Sachê']],
      ['Higiene', ['Shampoo', 'Tapete higiênico', 'Areia para gatos']],
      ['Acessórios', ['Coleira', 'Brinquedo', 'Comedouro']]
    ],
    borracharia: [
      ['Socorro', ['Troca de pneu', 'Conserto de furo', 'Troca de câmara', 'Socorro na estrada']],
      ['Serviços', ['Balanceamento', 'Alinhamento', 'Calibragem', 'Troca de válvula']]
    ],
    chaveiro: [
      ['Chaves', ['Cópia de chave simples', 'Chave codificada', 'Chave de carro', 'Controle de portão']],
      ['Socorro', ['Abertura de porta', 'Abertura de carro', 'Troca de segredo']]
    ],
    guincho: [['Reboque', ['Guincho na cidade', 'Guincho na estrada (km)', 'Carga e descarga', 'Pane seca']]],
    eletricista: [
      ['Elétrica', ['Visita técnica', 'Troca de tomada', 'Troca de disjuntor', 'Instalação de chuveiro', 'Instalação de luminária']],
      ['Obras', ['Ponto de energia novo', 'Troca de fiação', 'Quadro de luz']]
    ],
    encanador: [
      ['Vazamentos', ['Visita técnica', 'Caça-vazamento', 'Troca de torneira', 'Desentupimento']],
      ['Instalação', ['Instalação de vaso', 'Instalação de caixa d’água', 'Troca de registro']]
    ],
    pedreiro: [['Obras', ['Visita e orçamento', 'Reforma de banheiro', 'Assentamento de piso (m²)', 'Pintura (m²)', 'Muro e alvenaria']]],
    vidraceiro: [['Vidros', ['Visita e medição', 'Box de banheiro', 'Janela de vidro', 'Espelho', 'Troca de vidro quebrado']]],
    ar_condicionado: [['Ar-condicionado', ['Limpeza', 'Instalação', 'Carga de gás', 'Conserto', 'Visita técnica']]],
    dedetizacao: [['Dedetização', ['Apartamento', 'Casa', 'Comércio', 'Descupinização', 'Controle de ratos']]],
    montador: [['Montagem', ['Guarda-roupa', 'Cama', 'Cozinha planejada', 'Mesa e cadeiras', 'Desmontagem']]],
    diarista: [['Limpeza', ['Diária de limpeza', 'Faxina pesada', 'Limpeza pós-obra', 'Passar roupa']]],
    jardinagem: [['Jardim', ['Corte de grama', 'Poda de árvore', 'Limpeza de terreno', 'Manutenção mensal']]],
    assistencia_tecnica: [['Conserto', ['Orçamento', 'Troca de tela de celular', 'Troca de bateria', 'Formatação', 'Conserto de eletrodoméstico']]],
    estetica_automotiva: [['Lavagem', ['Lavagem simples', 'Lavagem completa', 'Higienização interna', 'Polimento', 'Enceramento', 'Vitrificação']]]
  };
  global.VBItensSugeridos = {
    para: function (segmento) { return C[segmento] || []; },
    temPara: function (segmento) { return !!C[segmento]; }
  };
})(window);
