/* Banco de avatares ilustrados por nicho — usados no seletor de "foto de
   perfil" do assistente (renderBlocoFotoPerfil, em perfil.js) pra quem
   ainda não tem uma foto própria. Gerados por IA, fundo transparente,
   recorte automático (ver /assets/estoque/avatares/*.png). */
(function () {
  var GENERICOS = [
    { url: '/assets/estoque/avatares/avatar-atendente-camisa.png', legenda: 'Atendente' },
    { url: '/assets/estoque/avatares/avatar-recepcao-tablet.png', legenda: 'Recepção com tablet' },
    { url: '/assets/estoque/avatares/avatar-recepcao-telefone.png', legenda: 'Recepção ao telefone' },
    { url: '/assets/estoque/avatares/avatar-loja-chaves.png', legenda: 'Atendimento em loja' }
  ];

  window.VB_ESTOQUE_AVATARES = {
    barbearia: [
      { url: '/assets/estoque/avatares/avatar-barbeiro-tesoura.png', legenda: 'Barbeiro com tesoura' },
      { url: '/assets/estoque/avatares/avatar-barbeiro-navalha.png', legenda: 'Barbeiro com navalha' }
    ].concat(GENERICOS),
    salao: [
      { url: '/assets/estoque/avatares/avatar-cabeleireira-secador.png', legenda: 'Cabeleireira' },
      { url: '/assets/estoque/avatares/avatar-barbeiro-tesoura.png', legenda: 'Cabeleireiro com tesoura' }
    ].concat(GENERICOS),
    manicure_pedicure: [
      { url: '/assets/estoque/avatares/avatar-manicure.png', legenda: 'Manicure' }
    ].concat(GENERICOS),
    estetica: [
      { url: '/assets/estoque/avatares/avatar-esteticista-frasco.png', legenda: 'Esteticista' },
      { url: '/assets/estoque/avatares/avatar-massagem-pes.png', legenda: 'Massoterapeuta' }
    ].concat(GENERICOS),
    estetica_automotiva: [
      { url: '/assets/estoque/avatares/avatar-automotiva-polimento.png', legenda: 'Detalhamento automotivo' },
      { url: '/assets/estoque/avatares/avatar-automotiva-lavagem.png', legenda: 'Lavagem automotiva' },
      { url: '/assets/estoque/avatares/avatar-loja-chaves.png', legenda: 'Atendimento' }
    ],
    outro: GENERICOS
  };

  window.avataresParaSegmento = function (segmento) {
    return window.VB_ESTOQUE_AVATARES[segmento] || window.VB_ESTOQUE_AVATARES.outro;
  };
})();
