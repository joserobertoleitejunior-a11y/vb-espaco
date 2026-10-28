/* Serviços sugeridos por nicho — aparecem como opções clicáveis na hora de
   cadastrar serviços, pra não obrigar o dono a digitar tudo do zero. Só
   mostra as opções do segmento do próprio estabelecimento (sem misturar
   com os outros nichos) — sempre com espaço pra adicionar um manual. */
(function () {
  window.VB_SERVICOS_SUGERIDOS = {
    barbearia: [
      { nome: 'Corte masculino', preco: 35 },
      { nome: 'Barba', preco: 25 },
      { nome: 'Corte + barba', preco: 55 },
      { nome: 'Sobrancelha', preco: 15 },
      { nome: 'Pézinho', preco: 15 },
      { nome: 'Platinado', preco: 90 }
    ],
    salao: [
      { nome: 'Corte feminino', preco: 60 },
      { nome: 'Escova', preco: 50 },
      { nome: 'Coloração', preco: 120 },
      { nome: 'Hidratação', preco: 70 },
      { nome: 'Progressiva', preco: 180 },
      { nome: 'Penteado', preco: 90 }
    ],
    manicure_pedicure: [
      { nome: 'Manicure', preco: 30 },
      { nome: 'Pedicure', preco: 35 },
      { nome: 'Manicure + pedicure', preco: 60 },
      { nome: 'Unha em gel', preco: 70 },
      { nome: 'Alongamento', preco: 90 },
      { nome: 'Nail art', preco: 20 }
    ],
    estetica: [
      { nome: 'Limpeza de pele', preco: 100 },
      { nome: 'Massagem relaxante', preco: 120 },
      { nome: 'Drenagem linfática', preco: 110 },
      { nome: 'Design de sobrancelha', preco: 35 },
      { nome: 'Depilação', preco: 50 },
      { nome: 'Pedras quentes', preco: 150 }
    ],
    // tatuagem: o tempo da sessão importa mais que o preço fechado — a
    // agenda bloqueia a sessão inteira (duracao em minutos)
    tatuador: [
      { nome: 'Orçamento e avaliação', preco: 0, duracao: 30 },
      { nome: 'Flash tattoo', preco: 150, duracao: 60 },
      { nome: 'Tatuagem pequena (até 7 cm)', preco: 250, duracao: 120 },
      { nome: 'Tatuagem média (7 a 15 cm)', preco: 450, duracao: 240 },
      { nome: 'Sessão fechada (dia inteiro)', preco: 900, duracao: 480 },
      { nome: 'Retoque', preco: 0, duracao: 60 }
    ],
    estetica_automotiva: [
      { nome: 'Lavagem simples', preco: 40 },
      { nome: 'Lavagem completa', preco: 70 },
      { nome: 'Polimento', preco: 200 },
      { nome: 'Higienização interna', preco: 150 },
      { nome: 'Enceramento', preco: 90 },
      { nome: 'Vitrificação', preco: 400 }
    ],
    petshop: [
      { nome: 'Banho (porte pequeno)', preco: 45 },
      { nome: 'Banho (porte médio)', preco: 60 },
      { nome: 'Banho (porte grande)', preco: 80 },
      { nome: 'Banho e tosa', preco: 90 },
      { nome: 'Tosa higiênica', preco: 35 },
      { nome: 'Corte de unhas', preco: 20 }
    ],
    outro: []
  };

  window.servicosSugeridosPara = function (segmento) {
    return window.VB_SERVICOS_SUGERIDOS[segmento] || [];
  };
})();
