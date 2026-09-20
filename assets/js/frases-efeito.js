/* Frases de efeito (headline + subcopy do hero) por nicho — cada
   estabelecimento pega uma combinação diferente das outras (calculada a
   partir do slug/nome dele, então é sempre a MESMA pra aquele site, mas
   nunca igual à de outro), em vez da mesma frase genérica repetida em
   todo site da plataforma. */
(function () {
  var FRASES_SEGMENTO = {
    barbearia: [
      { headline: 'Seu estilo, sem complicação.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
      { headline: 'Corte na régua, hora marcada.', sub: 'Chega de fila: escolha o profissional, o serviço e o horário direto por aqui.' },
      { headline: 'Estilo é coisa séria por aqui.', sub: 'Agende em segundos e garanta seu horário com quem entende do assunto.' },
      { headline: 'Sua barba, do seu jeito.', sub: 'Escolha o serviço, o profissional e o melhor horário — sem ligação, sem espera.' },
      { headline: 'Visual novo, sem enrolação.', sub: 'Marque seu horário agora e chegue na hora certa, sem imprevistos.' },
      { headline: 'Barbearia de verdade, agenda moderna.', sub: 'Veja os horários livres e agende do jeito mais rápido possível.' },
      { headline: 'Tradição no corte, praticidade pra marcar.', sub: 'Escolha seu profissional de confiança e agende com poucos toques.' },
      { headline: 'Cuidado que aparece no espelho.', sub: 'Reserve seu horário agora — simples, rápido, sem complicação.' }
    ],
    salao: [
      { headline: 'Sua beleza merece hora marcada.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
      { headline: 'Beleza que combina com sua rotina.', sub: 'Veja os horários disponíveis e marque no seu tempo, sem precisar ligar.' },
      { headline: 'Cada visita, um novo brilho.', sub: 'Escolha o serviço, o profissional e agende em poucos segundos.' },
      { headline: 'Seu momento de cuidar de você.', sub: 'Agende online e organize sua semana sem sair do lugar.' },
      { headline: 'Transformação começa com um agendamento.', sub: 'Marque seu horário agora e garanta o dia que você quiser.' },
      { headline: 'Salão de confiança, agenda na palma da mão.', sub: 'Escolha o serviço ideal pra você e agende sem complicação.' },
      { headline: 'Beleza com hora certa pra acontecer.', sub: 'Veja a disponibilidade em tempo real e marque seu horário agora.' },
      { headline: 'Onde seu estilo ganha vida.', sub: 'Agende em poucos toques e viva a experiência completa.' }
    ],
    manicure_pedicure: [
      { headline: 'Unhas impecáveis, hora marcada.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
      { headline: 'Cuidado nos detalhes que aparecem.', sub: 'Escolha o serviço, o dia e o horário — tudo sem precisar ligar.' },
      { headline: 'Mãos e pés sempre em dia.', sub: 'Marque seu horário agora e organize sua agenda de cuidados.' },
      { headline: 'Capricho que dura semanas.', sub: 'Veja os horários livres e agende em poucos segundos.' },
      { headline: 'Seu esmalte favorito, no seu tempo.', sub: 'Agende online, sem espera e sem complicação.' },
      { headline: 'Nail design com hora marcada.', sub: 'Escolha seu serviço preferido e garanta seu horário agora.' },
      { headline: 'Detalhe que faz toda a diferença.', sub: 'Marque seu horário de manicure e pedicure em poucos toques.' },
      { headline: 'Cuidado de verdade, sem enrolação.', sub: 'Agende seu horário agora e chegue no dia certo.' }
    ],
    estetica: [
      { headline: 'Seu bem-estar merece hora marcada.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
      { headline: 'Cuidar de você começa aqui.', sub: 'Escolha o tratamento ideal e marque seu horário sem complicação.' },
      { headline: 'Autoestima em dia, sempre.', sub: 'Veja os horários disponíveis e agende em poucos segundos.' },
      { headline: 'Resultados que você sente.', sub: 'Marque seu horário agora e comece seu cuidado hoje mesmo.' },
      { headline: 'Um momento só seu.', sub: 'Agende online e organize seu cuidado sem sair de casa.' },
      { headline: 'Estética que cuida de verdade.', sub: 'Escolha o serviço e o profissional ideal pra você agora.' },
      { headline: 'Pele em dia, mente tranquila.', sub: 'Veja a agenda em tempo real e marque seu horário agora.' },
      { headline: 'Seu cuidado, no seu tempo.', sub: 'Agende em poucos toques e sinta a diferença.' }
    ],
    estetica_automotiva: [
      { headline: 'Seu carro, sempre impecável.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
      { headline: 'Brilho que dura, cuidado que aparece.', sub: 'Escolha o serviço ideal e marque seu horário sem complicação.' },
      { headline: 'Detalhamento de outro nível.', sub: 'Veja os horários disponíveis e agende em poucos segundos.' },
      { headline: 'Seu carro merece esse cuidado.', sub: 'Marque seu horário agora e garanta o dia que você quiser.' },
      { headline: 'De sujo a impecável, com hora marcada.', sub: 'Agende online e deixe seu carro nas mãos certas.' },
      { headline: 'Proteção e brilho em um só lugar.', sub: 'Escolha o serviço e o horário ideal pra você agora.' },
      { headline: 'Cuidado automotivo sem complicação.', sub: 'Veja a agenda em tempo real e marque seu horário agora.' },
      { headline: 'Seu veículo, tratado como novo.', sub: 'Agende em poucos toques e garanta seu horário.' }
    ],
    outro: [
      { headline: 'Seu atendimento, sem complicação.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
      { headline: 'Praticidade do início ao fim.', sub: 'Escolha o serviço, o dia e o horário — tudo sem precisar ligar.' },
      { headline: 'Feito pra facilitar sua vida.', sub: 'Veja os horários disponíveis e agende em poucos segundos.' },
      { headline: 'Seu tempo vale — agende online.', sub: 'Marque seu horário agora e garanta o dia que você quiser.' },
      { headline: 'Atendimento de qualidade, hora marcada.', sub: 'Agende online, sem espera e sem complicação.' },
      { headline: 'Simples assim: escolha e agende.', sub: 'Escolha o serviço ideal pra você e marque agora.' },
      { headline: 'Sua conveniência em primeiro lugar.', sub: 'Veja a agenda em tempo real e marque seu horário agora.' },
      { headline: 'Feito pra você, no seu tempo.', sub: 'Agende em poucos toques e simplifique sua rotina.' }
    ]
  };

  function hashTexto(str) {
    var h = 0;
    str = String(str || '');
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  // sempre a mesma frase pro mesmo estabelecimento (slug+cidade não muda),
  // mas dificilmente igual à de outro estabelecimento do mesmo nicho.
  window.fraseEfeitoPara = function (segmento, semente) {
    var pool = FRASES_SEGMENTO[segmento] || FRASES_SEGMENTO.outro;
    var indice = hashTexto(semente) % pool.length;
    return pool[indice];
  };
})();
