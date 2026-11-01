/* Serviços sugeridos por nicho — aparecem como opções clicáveis na hora de
   cadastrar serviços, pra não obrigar o dono a digitar tudo do zero. Só
   mostra as opções do segmento do próprio estabelecimento (sem misturar
   com os outros nichos) — sempre com espaço pra adicionar um manual.

   Aqui vai só o NOME e, quando faz diferença pra agenda, o tempo. Preço
   nenhum: quem põe valor é sempre o dono do estabelecimento. */
(function () {
  window.VB_SERVICOS_SUGERIDOS = {
    barbearia: [
      { nome: 'Corte masculino' },
      { nome: 'Barba' },
      { nome: 'Corte + barba' },
      { nome: 'Sobrancelha' },
      { nome: 'Pézinho' },
      { nome: 'Platinado' }
    ],
    salao: [
      { nome: 'Corte feminino' },
      { nome: 'Escova' },
      { nome: 'Coloração' },
      { nome: 'Hidratação' },
      { nome: 'Progressiva' },
      { nome: 'Penteado' }
    ],
    manicure_pedicure: [
      { nome: 'Manicure' },
      { nome: 'Pedicure' },
      { nome: 'Manicure + pedicure' },
      { nome: 'Unha em gel' },
      { nome: 'Alongamento' },
      { nome: 'Nail art' }
    ],
    estetica: [
      { nome: 'Limpeza de pele' },
      { nome: 'Massagem relaxante' },
      { nome: 'Drenagem linfática' },
      { nome: 'Design de sobrancelha' },
      { nome: 'Depilação' },
      { nome: 'Pedras quentes' }
    ],
    // tatuagem: o tempo da sessão importa mais que o preço fechado — a
    // agenda bloqueia a sessão inteira (duracao em minutos)
    tatuador: [
      { nome: 'Orçamento e avaliação', duracao: 30 },
      { nome: 'Flash tattoo', duracao: 60 },
      { nome: 'Tatuagem pequena (até 7 cm)', duracao: 120 },
      { nome: 'Tatuagem média (7 a 15 cm)', duracao: 240 },
      { nome: 'Sessão fechada (dia inteiro)', duracao: 480 },
      { nome: 'Retoque', duracao: 60 }
    ],
    estetica_automotiva: [
      { nome: 'Lavagem simples' },
      { nome: 'Lavagem completa' },
      { nome: 'Polimento' },
      { nome: 'Higienização interna' },
      { nome: 'Enceramento' },
      { nome: 'Vitrificação' }
    ],
    petshop: [
      { nome: 'Banho (porte pequeno)' },
      { nome: 'Banho (porte médio)' },
      { nome: 'Banho (porte grande)' },
      { nome: 'Banho e tosa' },
      { nome: 'Tosa higiênica' },
      { nome: 'Corte de unhas' }
    ],
    outro: []
  };

  window.servicosSugeridosPara = function (segmento) {
    return window.VB_SERVICOS_SUGERIDOS[segmento] || [];
  };
})();
