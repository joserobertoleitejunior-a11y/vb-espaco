/* Aba "Meu site" — a mesma nos painéis de Agendar (cadastro.html),
   Pedir e Chamar (painel-area.html). Não edita nada aqui: mostra o quanto
   o site está pronto e cada linha abre o editor passo a passo
   (editor-matriz.js) direto naquele passo (?editar=1&passo=<id>).

   Duas regras que mandam na tela toda:
   - passo OBRIGATÓRIO (opcional: false) — sem ele o site não vai pro ar.
     Conta na porcentagem e aparece na lista "Precisa fazer".
   - passo OPCIONAL (opcional: true) — enfeita, não trava nada. Fica numa
     lista separada, com a palavra "se quiser".

   VBMeuSite.montar(caixa, {
     nome: 'Barbearia do Zé',
     link: 'https://…/ze/campinas',           // site público
     editar: '/ze/campinas?editar=1',          // abre o editor
     passos: [{ id, capitulo, titulo, feito, opcional, ajuda }]
   }) */
(function (global) {
  var CAPITULOS = {
    impressao: 'Primeira impressão',
    oferta: 'O que você oferece',
    funciona: 'Como funciona',
    achar: 'Onde te achar',
    sobre: 'Sobre o seu negócio'
  };
  var QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function avisar(msg) {
    if (global.VB && global.VB.toast) global.VB.toast(msg);
  }

  function anel(pct) {
    var r = 26, c = 2 * Math.PI * r;
    return '<svg class="ms-anel" viewBox="0 0 64 64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="' + r + '" class="ms-anel-fundo"/>' +
      '<circle cx="32" cy="32" r="' + r + '" class="ms-anel-cheio" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - pct / 100)).toFixed(1) + '"/>' +
      '</svg><span class="ms-anel-num">' + pct + '<small>%</small></span>';
  }

  function marcaOk() {
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  }

  // uma linha da lista: nome em cima, explicação embaixo, selo do lado.
  // O nome quebra em várias linhas de propósito — nada de palavra cortada.
  function linha(p, ir) {
    var est = p.feito ? 'ok' : p.opcional ? 'extra' : 'falta';
    var selo = p.feito ? 'pronto' : p.opcional ? 'se quiser' : 'precisa';
    return '<a class="ms-passo ms-' + est + '" href="' + ir(p.id) + '">' +
      '<span class="ms-marca" aria-hidden="true">' + (p.feito ? marcaOk() : '') + '</span>' +
      '<span class="ms-passo-txt">' +
        '<span class="ms-passo-nome">' + esc(p.titulo) + '</span>' +
        (p.ajuda ? '<span class="ms-passo-ajuda">' + esc(p.ajuda) + '</span>' : '') +
      '</span>' +
      '<span class="ms-passo-selo">' + selo + '</span>' +
      '<span class="ms-seta" aria-hidden="true">›</span>' +
      '</a>';
  }

  function html(cfg) {
    var passos = (cfg.passos || []).map(function (p) {
      // feito: null significava "não sei" — vira opcional, que é o que é na prática
      return {
        id: p.id, capitulo: p.capitulo, titulo: p.titulo, ajuda: p.ajuda,
        feito: !!p.feito,
        opcional: p.opcional != null ? !!p.opcional : p.feito == null
      };
    });
    var ir = function (id) { return esc(cfg.editar + (cfg.editar.indexOf('?') > -1 ? '&' : '?') + 'passo=' + encodeURIComponent(id)); };

    var precisa = passos.filter(function (p) { return !p.opcional; });
    var faltando = precisa.filter(function (p) { return !p.feito; });
    var extras = passos.filter(function (p) { return p.opcional && !p.feito; });
    var pct = precisa.length ? Math.round((precisa.length - faltando.length) / precisa.length * 100) : 100;
    var pronto = faltando.length === 0;
    var proximo = faltando[0] || extras[0];

    var grupos = {}, ordem = [];
    passos.forEach(function (p) {
      if (!grupos[p.capitulo]) { grupos[p.capitulo] = []; ordem.push(p.capitulo); }
      grupos[p.capitulo].push(p);
    });

    var limpo = (cfg.link || '').replace(/^https?:\/\//, '');
    var out = '<div class="ms' + (pronto ? ' ms-completo' : '') + '">';

    // 1. o anel: só conta o que é obrigatório
    out += '<a class="ms-topo" href="' + esc(proximo ? ir(proximo.id) : cfg.editar) + '">' +
      '<span class="ms-anel-caixa">' + anel(pct) + '</span>' +
      '<span class="ms-topo-txt">' +
        '<strong>' + (pronto ? 'Seu site está no ar' : 'Faltam ' + faltando.length + (faltando.length === 1 ? ' passo' : ' passos')) + '</strong>' +
        '<small>' + (pronto ? 'Tudo o que precisava já está preenchido' : 'Toque pra fazer o próximo: ' + esc(faltando[0].titulo)) + '</small>' +
      '</span>' +
      '<span class="ms-seta ms-seta-topo" aria-hidden="true">›</span>' +
      '</a>';

    // 2. a lista curta do que trava o site
    if (!pronto) {
      out += '<section class="ms-bloco ms-bloco-precisa">' +
        '<header><h3>Precisa fazer</h3><p>Sem estes passos o site não fica pronto. São ' + faltando.length + ' e dá pra fazer agora.</p></header>' +
        '<div class="ms-lista">' + faltando.map(function (p) { return linha(p, ir); }).join('') + '</div>' +
        '</section>';
    } else {
      out += '<p class="ms-ok-aviso"><span aria-hidden="true">' + marcaOk() + '</span> Obrigatórios prontos. Daqui pra frente é só melhorar.</p>';
    }

    // 3. o que é enfeite
    if (extras.length) {
      out += '<section class="ms-bloco ms-bloco-extra">' +
        '<header><h3>Se quiser deixar mais bonito</h3><p>Nada aqui é obrigatório. O site funciona sem.</p></header>' +
        '<div class="ms-lista">' + extras.map(function (p) { return linha(p, ir); }).join('') + '</div>' +
        '</section>';
    }

    // 4. tudo, por capítulo, pra quem quer mexer em algo já pronto
    out += '<details class="ms-tudo"' + (pronto ? ' open' : '') + '>' +
      '<summary><strong>Ver e editar todas as partes</strong><small>' + passos.length + ' partes do seu site</small></summary>' +
      ordem.map(function (cap) {
        var lista = grupos[cap];
        var ok = lista.filter(function (p) { return p.feito; }).length;
        return '<section class="ms-bloco ms-cap">' +
          '<header><h3>' + esc(CAPITULOS[cap] || cap) + '</h3><span class="ms-conta">' + ok + ' de ' + lista.length + '</span></header>' +
          '<div class="ms-lista">' + lista.map(function (p) { return linha(p, ir); }).join('') + '</div>' +
          '</section>';
      }).join('') +
      '</details>';

    // 5. divulgar
    out += '<section class="ms-bloco ms-divulgar">' +
      '<header><h3>Divulgar</h3><p>Este é o endereço do seu site. Manda pra quem você quiser.</p></header>' +
      '<div class="ms-link"><code>' + esc(limpo) + '</code></div>' +
      '<div class="ms-botoes">' +
        '<button type="button" class="ms-btn ms-btn-forte" data-ms="copiar">Copiar o link</button>' +
        '<button type="button" class="ms-btn" data-ms="compartilhar">Mandar no WhatsApp</button>' +
        '<a class="ms-btn" href="' + esc(cfg.link) + '" target="_blank" rel="noopener">Abrir o site</a>' +
      '</div>' +
      '<div class="ms-qr">' +
        '<div class="ms-qr-img" data-ms-qr></div>' +
        '<div class="ms-qr-txt"><p>QR Code pra colar no balcão, no cartão e nas embalagens. O cliente aponta a câmera e cai no seu site.</p>' +
        '<button type="button" class="ms-btn" data-ms="baixar">Baixar o QR Code</button></div>' +
      '</div>' +
      '</section>';

    // 6. anunciar
    out += '<a class="ms-anunciar" href="/anunciar.html">' +
      '<span class="ms-anunciar-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a7.5 7.5 0 0 1 0 11"/></svg></span>' +
      '<span class="ms-anunciar-txt"><strong>Anunciar</strong><small>Seu negócio em destaque na busca de quem está perto</small></span>' +
      '<span class="ms-seta" aria-hidden="true">›</span>' +
      '</a>';

    return out + '</div>';
  }

  function desenharQr(alvo, url) {
    var fazer = function () {
      alvo.innerHTML = '';
      try { new global.QRCode(alvo, { text: url, width: 200, height: 200, correctLevel: global.QRCode.CorrectLevel.M }); }
      catch (e) { alvo.closest('.ms-qr').hidden = true; }
    };
    if (global.QRCode) { fazer(); return; }
    var s = document.querySelector('script[data-ms-qrlib]');
    if (!s) {
      s = document.createElement('script');
      s.src = QR_LIB; s.setAttribute('data-ms-qrlib', '');
      document.head.appendChild(s);
    }
    s.addEventListener('load', fazer);
    s.addEventListener('error', function () { var q = alvo.closest('.ms-qr'); if (q) q.hidden = true; });
  }

  function montar(caixa, cfg) {
    caixa.innerHTML = html(cfg);
    var qr = caixa.querySelector('[data-ms-qr]');
    if (qr) desenharQr(qr, cfg.link);
    caixa.querySelectorAll('[data-ms]').forEach(function (b) {
      b.addEventListener('click', function () {
        var acao = b.getAttribute('data-ms');
        if (acao === 'copiar') {
          if (navigator.clipboard) navigator.clipboard.writeText(cfg.link).then(function () { avisar('Link copiado!'); b.textContent = 'Copiado ✓'; });
        } else if (acao === 'compartilhar') {
          var dados = { title: cfg.nome, text: cfg.nome + ' — veja aqui:', url: cfg.link };
          if (navigator.share) navigator.share(dados).catch(function () {});
          else global.open('https://wa.me/?text=' + encodeURIComponent(dados.text + ' ' + dados.url), '_blank');
        } else if (acao === 'baixar') {
          var c = qr && (qr.querySelector('canvas') || qr.querySelector('img'));
          if (!c) { avisar('QR Code ainda carregando'); return; }
          var a = document.createElement('a');
          a.download = 'qrcode-' + (cfg.nome || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
          a.href = c.tagName === 'CANVAS' ? c.toDataURL('image/png') : c.src;
          a.click();
        }
      });
    });
  }

  // as perguntas do tipo de negócio (perguntas-segmento.js), no capítulo "sobre".
  // Nenhuma é obrigatória: são detalhes que ajudam o cliente a decidir.
  function passosSobre(segmento, areas, respostas) {
    if (!global.VBPerguntas) return [];
    return global.VBPerguntas.lista(segmento, areas).map(function (p) {
      var v = respostas[p.chave];
      return {
        id: 'q_' + p.chave, capitulo: 'sobre', titulo: p.pergunta, opcional: true,
        ajuda: 'Detalhe que o cliente gosta de saber antes de chegar',
        feito: p.tipo === 'varios' ? Array.isArray(v) : v != null && v !== ''
      };
    });
  }
  var tem = function (v) { return !!String(v || '').trim(); };
  var qtd = function (l) { return !!(l && l.length > 0); };

  // mesmos ids e capítulos do editor da Agenda (perfil.js → montarPassosEdicao)
  function passosAgenda(d) {
    var l = d.linha || {}, tattoo = l.segmento === 'tatuador';
    return [
      { id: 'foto', capitulo: 'impressao', titulo: 'Foto principal', opcional: false,
        ajuda: 'A primeira coisa que o cliente vê. Pode ser foto sua, do lugar ou do trabalho.',
        feito: !!(l.foto_hero_url || l.foto_capa_url) },
      { id: 'textos', capitulo: 'impressao', titulo: 'Nome e frase do seu negócio', opcional: false,
        ajuda: 'O nome grande e uma frase curta dizendo o que você faz.', feito: tem(l.titulo_hero) },
      { id: 'servicos', capitulo: 'oferta', titulo: tattoo ? 'Sessões e preços' : 'Serviços e preços', opcional: false,
        ajuda: 'Sem isso o cliente não tem o que escolher na hora de agendar.', feito: qtd(d.servicos) },
      { id: 'horario', capitulo: 'funciona', titulo: 'Dias e horários que você atende', opcional: false,
        ajuda: 'É o que libera os horários na agenda do cliente.', feito: qtd(d.horarios) },
      { id: 'contato', capitulo: 'funciona', titulo: 'Seu WhatsApp', opcional: false,
        ajuda: 'Pra você receber os agendamentos e o cliente falar com você.',
        feito: tem(String(l.telefone_whatsapp || '').replace(/\D/g, '')) },
      { id: 'localizacao', capitulo: 'achar', titulo: 'Endereço', opcional: false,
        ajuda: 'Onde o cliente te acha. Aparece no mapa do site.', feito: tem(l.endereco) },
      { id: 'estilo', capitulo: 'impressao', titulo: 'Cores e estilo', opcional: true,
        ajuda: 'Já vem um estilo escolhido. Troque se quiser outra cara.', feito: !!l.template },
      { id: 'efeito', capitulo: 'impressao', titulo: 'Efeito do título', opcional: true,
        ajuda: 'Uma animação na entrada do site.', feito: false },
      { id: 'equipe', capitulo: 'oferta', titulo: 'Quem atende', opcional: true,
        ajuda: 'Se trabalha com mais gente, o cliente escolhe com quem quer.', feito: qtd(d.equipe) },
      { id: 'galeria', capitulo: 'oferta', titulo: tattoo ? 'Portfólio' : 'Galeria de fotos', opcional: true,
        ajuda: 'Fotos dos seus trabalhos. Vende sozinho.', feito: qtd(d.galeria) },
      { id: 'redes', capitulo: 'achar', titulo: 'Instagram e redes', opcional: true,
        ajuda: 'Liga o site às suas redes.', feito: !!(l.instagram_url || l.facebook_url || l.tiktok_url) }
    ].concat(passosSobre(l.segmento, d.areas || ['agenda'], d.respostas || {}));
  }

  // mesmos ids e capítulos do editor de Pedir/Chamar (editar-loja.js → montarPassos)
  function passosLoja(d) {
    var e = d.loja || {}, ident = d.identidade || {}, S = !!d.servico;
    var h = e.horarios;
    return [
      { id: 'foto', capitulo: 'impressao', titulo: 'Foto principal', opcional: false,
        ajuda: 'A primeira coisa que o cliente vê. Uma foto boa do lugar ou do produto.',
        feito: !!(ident.foto_hero_url || e.foto_capa_url) },
      { id: 'textos', capitulo: 'impressao', titulo: 'Nome e frase do seu negócio', opcional: false,
        ajuda: 'O nome grande e uma frase curta dizendo o que você vende.', feito: tem(e.descricao) },
      { id: 'itens', capitulo: 'oferta', titulo: S ? 'Serviços e preços' : 'Cardápio com preços', opcional: false,
        ajuda: S ? 'Sem isso o cliente não tem o que pedir.' : 'O coração do site. Pode mandar uma foto do cardápio e a IA preenche.',
        feito: !!(d.itens && d.itens > 0) },
      { id: 'atendimento', capitulo: 'funciona', titulo: S ? 'Como você atende' : 'Entrega e retirada', opcional: false,
        ajuda: S ? 'Diz se atende no local, em casa ou os dois.' : 'Diz se você entrega, se o cliente busca, e quanto custa a entrega.',
        feito: !!(e.aceita_entrega || e.aceita_retirada) },
      { id: 'pagamento', capitulo: 'funciona', titulo: 'Sua chave Pix', opcional: false,
        ajuda: 'É por ela que o cliente te paga, dentro do site. O dinheiro cai direto na sua conta.',
        feito: tem(e.chave_pix) },
      { id: 'horario', capitulo: 'funciona', titulo: 'Dias e horários que você abre', opcional: false,
        ajuda: 'É o que mostra "aberto agora" pro cliente.', feito: !!(h && Object.keys(h).length) },
      { id: 'endereco', capitulo: 'achar', titulo: 'Endereço', opcional: false,
        ajuda: 'Onde o cliente te acha e de onde sai a entrega.', feito: tem(e.endereco) },
      { id: 'logo', capitulo: 'impressao', titulo: 'Logo', opcional: true,
        ajuda: 'Se você tem uma marca, suba aqui. Sem logo o site usa o nome.', feito: !!e.foto_perfil_url },
      { id: 'estilo', capitulo: 'impressao', titulo: 'Cores e estilo', opcional: true,
        ajuda: 'Já vem um estilo escolhido. Troque se quiser outra cara.', feito: !!ident.template },
      { id: 'efeito', capitulo: 'impressao', titulo: 'Efeito do título', opcional: true,
        ajuda: 'Uma animação na entrada do site.', feito: false },
      { id: 'galeria', capitulo: 'oferta', titulo: 'Galeria de fotos', opcional: true,
        ajuda: 'Fotos dos pratos, dos produtos, do lugar.', feito: !!(d.galeria && d.galeria > 0) }
    ].concat(passosSobre(e.segmento, e.areas || [S ? 'servicos' : 'delivery'], d.respostas || {}));
  }

  global.VBMeuSite = { montar: montar, html: html, passosAgenda: passosAgenda, passosLoja: passosLoja, CAPITULOS: CAPITULOS };
})(window);
