/* Banco de fotos de estoque por nicho — usadas no seletor "ou escolha uma
   pronta" (foto principal, capa e galeria) pra quem ainda não tem fotos
   próprias do estabelecimento. Fotos de bancos gratuitos (Unsplash/Pexels/
   Pixabay) e do Adobe Stock (gratuitas, licenciadas pela conta da
   plataforma), liberadas pra uso comercial. */
(function () {
  window.VB_ESTOQUE_FOTOS = {
    barbearia: [
      { url: '/assets/estoque/barbearia/interior-tijolo.jpg', legenda: 'Barbearia estilo industrial' },
      { url: '/assets/estoque/barbearia/cadeiras-fileira.jpg', legenda: 'Cadeiras em fileira' },
      { url: '/assets/estoque/barbearia/cadeira-vintage-vermelha.jpg', legenda: 'Cadeira vintage' },
      { url: '/assets/estoque/barbearia/corte-pretoebranco.jpg', legenda: 'Corte clássico' },
      { url: '/assets/estoque/barbearia/produtos-bancada.jpg', legenda: 'Produtos e ferramentas' },
      { url: '/assets/estoque/barbearia/poste-barbearia.jpg', legenda: 'Poste de barbearia' }
    ],
    salao: [
      { url: '/assets/estoque/salao/corte-feminino.jpg', legenda: 'Corte feminino' },
      { url: '/assets/estoque/salao/escova-secador.jpg', legenda: 'Escova' },
      { url: '/assets/estoque/salao/penteado.jpg', legenda: 'Penteado' },
      { url: '/assets/tpl-classico/img/estoque/hero-feminino-1.jpg', legenda: 'Salão rosé' }
    ],
    manicure_pedicure: [
      { url: '/assets/estoque/manicure_pedicure/unhas-nude.jpg', legenda: 'Unhas nude' },
      { url: '/assets/estoque/manicure_pedicure/unhas-tartaruga.jpg', legenda: 'Unhas tartaruga' },
      { url: '/assets/estoque/manicure_pedicure/aplicacao-gel.jpg', legenda: 'Aplicação de gel' },
      { url: '/assets/estoque/manicure_pedicure/tesoura-detalhe.jpg', legenda: 'Ferramentas de manicure' }
    ],
    estetica: [
      { url: '/assets/estoque/estetica/limpeza-pele.jpg', legenda: 'Limpeza de pele' },
      { url: '/assets/estoque/estetica/mascara-facial.jpg', legenda: 'Máscara facial' },
      { url: '/assets/estoque/estetica/massagem-facial.jpg', legenda: 'Massagem facial' },
      { url: '/assets/estoque/estetica/massagem-pedras-quentes.jpg', legenda: 'Massagem com pedras quentes' }
    ],
    estetica_automotiva: [
      { url: '/assets/estoque/estetica_automotiva/lavagem-espuma.jpg', legenda: 'Lavagem com espuma' },
      { url: '/assets/estoque/estetica_automotiva/lavagem-roda.jpg', legenda: 'Detalhamento de roda' },
      { url: '/assets/estoque/estetica_automotiva/polimento-fita-verde.jpg', legenda: 'Polimento' },
      { url: '/assets/estoque/estetica_automotiva/polimento-detalhe.jpg', legenda: 'Polimento em detalhe' },
      { url: '/assets/estoque/estetica_automotiva/farol-classico.jpg', legenda: 'Clássico restaurado' },
      { url: '/assets/estoque/estetica_automotiva/interior-carro.jpg', legenda: 'Interior detalhado' },
      { url: '/assets/estoque/estetica_automotiva/escova-detalhamento.jpg', legenda: 'Escova de detalhamento' }
    ],
    pizzaria: [
      { url: '/assets/estoque/pizzaria/pizza-forno.jpg', legenda: 'Pizza saindo do forno' },
      { url: '/assets/estoque/pizzaria/pizza-mesa.jpg', legenda: 'Pizza na mesa' },
      { url: '/assets/estoque/pizzaria/pizza-fatia.jpg', legenda: 'Fatia de pizza' }
    ],
    hamburgueria: [
      { url: '/assets/estoque/hamburgueria/burger-artesanal.jpg', legenda: 'Hambúrguer artesanal' },
      { url: '/assets/estoque/hamburgueria/burger-batata.jpg', legenda: 'Hambúrguer com batata' },
      { url: '/assets/estoque/hamburgueria/burger-duplo.jpg', legenda: 'Hambúrguer duplo' }
    ],
    lanchonete: [
      { url: '/assets/estoque/lanchonete/lanche-salgados.jpg', legenda: 'Croissant recheado' },
      { url: '/assets/estoque/lanchonete/lanche-sanduiche.jpg', legenda: 'Sanduíche' },
      { url: '/assets/estoque/lanchonete/lanche-frango.jpg', legenda: 'Lanche de frango' }
    ],
    restaurante: [
      { url: '/assets/estoque/restaurante/prato-feito.jpg', legenda: 'Prato do dia' },
      { url: '/assets/estoque/restaurante/mesa-posta.jpg', legenda: 'Prato da casa' },
      { url: '/assets/estoque/restaurante/prato-chef.jpg', legenda: 'Prato do chef' }
    ],
    marmitaria: [
      { url: '/assets/estoque/marmitaria/marmita-arroz-feijao.jpg', legenda: 'Marmita saudável' },
      { url: '/assets/estoque/marmitaria/marmita-fit.jpg', legenda: 'Marmitas variadas' },
      { url: '/assets/estoque/marmitaria/marmitas-prontas.jpg', legenda: 'Marmitas prontas' }
    ],
    japonesa: [
      { url: '/assets/estoque/japonesa/sushi-combinado.jpg', legenda: 'Combinado de sushi' },
      { url: '/assets/estoque/japonesa/sushi-tabua.jpg', legenda: 'Sushi variado' },
      { url: '/assets/estoque/japonesa/temaki-hashi.jpg', legenda: 'Sushi e hashi' }
    ],
    acaiteria: [
      { url: '/assets/estoque/acaiteria/acai-tigela.jpg', legenda: 'Açaí na tigela' },
      { url: '/assets/estoque/acaiteria/acai-frutas.jpg', legenda: 'Açaí com frutas' },
      { url: '/assets/estoque/acaiteria/acai-copo.jpg', legenda: 'Açaí com acompanhamentos' }
    ],
    sorveteria: [
      { url: '/assets/estoque/sorveteria/sorvete-casquinha.jpg', legenda: 'Casquinha' },
      { url: '/assets/estoque/sorveteria/sorvete-bolas.jpg', legenda: 'Bolas de sorvete' },
      { url: '/assets/estoque/sorveteria/sorvete-taca.jpg', legenda: 'Taça de sorvete' }
    ],
    doceria: [
      { url: '/assets/estoque/doceria/bolo-confeitado.jpg', legenda: 'Bolo confeitado' },
      { url: '/assets/estoque/doceria/docinhos.jpg', legenda: 'Docinhos' },
      { url: '/assets/estoque/doceria/tortas-doces.jpg', legenda: 'Tortas e doces' }
    ],
    padaria: [
      { url: '/assets/estoque/padaria/pao-frances.jpg', legenda: 'Pães no forno' },
      { url: '/assets/estoque/padaria/padaria-vitrine.jpg', legenda: 'Vitrine da padaria' },
      { url: '/assets/estoque/padaria/paes-variados.jpg', legenda: 'Pães variados' }
    ],
    mercado: [
      { url: '/assets/estoque/mercado/hortifruti.jpg', legenda: 'Hortifruti' },
      { url: '/assets/estoque/mercado/corredor-mercado.jpg', legenda: 'Corredor do mercado' },
      { url: '/assets/estoque/mercado/compras-sacola.jpg', legenda: 'Compras na sacola' }
    ],
    adega: [
      { url: '/assets/estoque/adega/cerveja-limao.jpg', legenda: 'Cerveja com limão' },
      { url: '/assets/estoque/adega/cervejas-gelo.jpg', legenda: 'Cervejas no gelo' },
      { url: '/assets/estoque/adega/balde-gelo.jpg', legenda: 'Balde de gelo' }
    ],
    petshop: [
      { url: '/assets/estoque/petshop/banho-tosa.jpg', legenda: 'Banho e tosa' },
      { url: '/assets/estoque/petshop/cachorro-feliz.jpg', legenda: 'Secagem e escova' },
      { url: '/assets/estoque/petshop/gato-cuidado.jpg', legenda: 'Tosa' }
    ],
    borracharia: [
      { url: '/assets/estoque/borracharia/troca-pneu.jpg', legenda: 'Troca de pneu' },
      { url: '/assets/estoque/borracharia/montagem-roda.jpg', legenda: 'Montagem de roda' },
      { url: '/assets/estoque/borracharia/maquina-pneu.jpg', legenda: 'Desmontadora de pneu' }
    ],
    chaveiro: [
      { url: '/assets/estoque/chaveiro/chave-porta.jpg', legenda: 'Chave na porta' },
      { url: '/assets/estoque/chaveiro/fechadura-nova.jpg', legenda: 'Fechadura nova' },
      { url: '/assets/estoque/chaveiro/instalacao-fechadura.jpg', legenda: 'Instalação de fechadura' }
    ],
    guincho: [
      { url: '/assets/estoque/guincho/guincho-reboque.jpg', legenda: 'Reboque de carro' },
      { url: '/assets/estoque/guincho/guincho-plataforma.jpg', legenda: 'Guincho plataforma' },
      { url: '/assets/estoque/guincho/socorro-bateria.jpg', legenda: 'Socorro na estrada' }
    ],
    eletricista: [
      { url: '/assets/estoque/eletricista/fiacao-parede.jpg', legenda: 'Fiação na parede' },
      { url: '/assets/estoque/eletricista/quadro-disjuntores.jpg', legenda: 'Quadro de disjuntores' },
      { url: '/assets/estoque/eletricista/montagem-quadro.jpg', legenda: 'Montagem de quadro elétrico' }
    ],
    encanador: [
      { url: '/assets/estoque/encanador/cano-pia.jpg', legenda: 'Conserto embaixo da pia' },
      { url: '/assets/estoque/encanador/pia-cozinha.jpg', legenda: 'Pia da cozinha' },
      { url: '/assets/estoque/encanador/chave-grifo.jpg', legenda: 'Reparo hidráulico' }
    ],
    pedreiro: [
      { url: '/assets/estoque/pedreiro/parede-blocos.jpg', legenda: 'Levantando parede' },
      { url: '/assets/estoque/pedreiro/assentando-tijolo.jpg', legenda: 'Assentando tijolo' },
      { url: '/assets/estoque/pedreiro/revestimento-fachada.jpg', legenda: 'Revestimento de fachada' }
    ],
    vidraceiro: [
      { url: '/assets/estoque/vidraceiro/instalacao-janela.jpg', legenda: 'Instalação de janela' },
      { url: '/assets/estoque/vidraceiro/vidro-ventosa.jpg', legenda: 'Vidro com ventosa' },
      { url: '/assets/estoque/vidraceiro/reparo-janela.jpg', legenda: 'Reparo de janela' }
    ],
    ar_condicionado: [
      { url: '/assets/estoque/ar_condicionado/conserto-split.jpg', legenda: 'Conserto de split' },
      { url: '/assets/estoque/ar_condicionado/revisao-ar.jpg', legenda: 'Revisão do ar' },
      { url: '/assets/estoque/ar_condicionado/condensadora.jpg', legenda: 'Condensadora externa' }
    ],
    montador: [
      { url: '/assets/estoque/montador/montagem-gaveta.jpg', legenda: 'Montagem de gaveta' },
      { url: '/assets/estoque/montador/parafusadeira.jpg', legenda: 'Parafusadeira' },
      { url: '/assets/estoque/montador/montagem-armario.jpg', legenda: 'Montagem de armário' }
    ],
    diarista: [
      { url: '/assets/estoque/diarista/kit-limpeza.jpg', legenda: 'Kit de limpeza' },
      { url: '/assets/estoque/diarista/limpeza-piso.jpg', legenda: 'Limpeza do piso' },
      { url: '/assets/estoque/diarista/limpeza-cozinha.jpg', legenda: 'Limpeza da cozinha' }
    ],
    jardinagem: [
      { url: '/assets/estoque/jardinagem/poda-cerca-viva.jpg', legenda: 'Poda de cerca viva' },
      { url: '/assets/estoque/jardinagem/cortador-grama.jpg', legenda: 'Cortador de grama' },
      { url: '/assets/estoque/jardinagem/grama-aparada.jpg', legenda: 'Grama aparada' }
    ],
    dedetizacao: [
      { url: '/assets/estoque/dedetizacao/pulverizacao-externa.jpg', legenda: 'Pulverização externa' },
      { url: '/assets/estoque/dedetizacao/controle-pragas.jpg', legenda: 'Controle de pragas' },
      { url: '/assets/estoque/dedetizacao/aplicacao-inseticida.jpg', legenda: 'Aplicação' }
    ],
    assistencia_tecnica: [
      { url: '/assets/estoque/assistencia_tecnica/placa-celular.jpg', legenda: 'Reparo de placa' },
      { url: '/assets/estoque/assistencia_tecnica/bancada-celular.jpg', legenda: 'Bancada de conserto' },
      { url: '/assets/estoque/assistencia_tecnica/troca-tela.jpg', legenda: 'Troca de tela' }
    ],
    // capas neutras (desenhadas em código) pra quem ainda não tem foto do
    // próprio negócio — nunca foto de outro estabelecimento real
    geral: [
      { url: '/assets/estoque/geral/grafite.svg', legenda: 'Grafite' },
      { url: '/assets/estoque/geral/areia.svg', legenda: 'Areia' },
      { url: '/assets/estoque/geral/aco.svg', legenda: 'Aço' },
      { url: '/assets/estoque/geral/brasa.svg', legenda: 'Brasa' }
    ]
  };

  // fotos do tipo de negócio (quando existem) + as capas neutras
  window.estoqueFotosPara = function (segmento) {
    return (window.VB_ESTOQUE_FOTOS[segmento] || []).concat(window.VB_ESTOQUE_FOTOS.geral);
  };
})();
