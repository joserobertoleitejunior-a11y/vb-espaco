/* Banco de fotos de estoque por nicho — usadas no seletor "ou escolha uma
   pronta" (foto principal, capa e galeria) pra quem ainda não tem fotos
   próprias do estabelecimento. Fotos de bancos gratuitos (Unsplash/Pexels/
   Pixabay), licença livre pra uso comercial. */
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
      { url: '/assets/tpl-classico/img/estoque/hero-feminino-1.jpg', legenda: 'Salão rosé' },
      { url: '/assets/estoque/barbearia/cadeiras-fileira.jpg', legenda: 'Cadeiras em fileira' }
    ],
    manicure_pedicure: [
      { url: '/assets/estoque/manicure_pedicure/unhas-nude.jpg', legenda: 'Unhas nude' },
      { url: '/assets/estoque/manicure_pedicure/unhas-tartaruga.jpg', legenda: 'Unhas tartaruga' },
      { url: '/assets/estoque/manicure_pedicure/aplicacao-gel.jpg', legenda: 'Aplicação de gel' },
      { url: '/assets/estoque/manicure_pedicure/tesoura-detalhe.jpg', legenda: 'Ferramentas de manicure' }
    ],
    estetica: [
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
    outro: [
      { url: '/assets/tpl-classico/img/estoque/hero-masculino-1.jpg', legenda: 'Studio dourado' },
      { url: '/assets/tpl-classico/img/estoque/fachada-1.jpg', legenda: 'Fachada clássica' }
    ]
  };

  window.estoqueFotosPara = function (segmento) {
    return window.VB_ESTOQUE_FOTOS[segmento] || window.VB_ESTOQUE_FOTOS.outro;
  };
})();
