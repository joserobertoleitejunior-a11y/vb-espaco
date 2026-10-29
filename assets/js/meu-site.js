/* Aba "Meu site" — a mesma nos painéis de Agendar (cadastro.html),
   Pedir e Chamar (painel-area.html). Não edita nada aqui: mostra o quanto
   o site está pronto, por capítulo, e cada linha abre o editor passo a
   passo (editor-matriz.js) direto naquele passo (?editar=1&passo=<id>).
   Embaixo: link, QR Code e Anunciar.

   VBMeuSite.montar(caixa, {
     nome: 'Barbearia do Zé',
     link: 'https://…/ze/campinas',          // site público
     editar: '/ze/campinas?editar=1',         // abre o editor
     passos: [{ id, capitulo, titulo, feito }] // feito: true | false | null (não sabe)
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

  function html(cfg) {
    var passos = cfg.passos || [];
    var conta = passos.filter(function (p) { return p.feito != null; });
    var feitos = conta.filter(function (p) { return p.feito; }).length;
    var pct = conta.length ? Math.round(feitos / conta.length * 100) : 0;
    var proximo = passos.filter(function (p) { return p.feito === false; })[0];
    var ir = function (id) { return esc(cfg.editar + (cfg.editar.indexOf('?') > -1 ? '&' : '?') + 'passo=' + encodeURIComponent(id)); };

    var grupos = {}, ordem = [];
    passos.forEach(function (p) {
      if (!grupos[p.capitulo]) { grupos[p.capitulo] = []; ordem.push(p.capitulo); }
      grupos[p.capitulo].push(p);
    });

    var limpo = (cfg.link || '').replace(/^https?:\/\//, '');
    return '<div class="ms">' +
      '<a class="ms-topo" href="' + esc(proximo ? ir(proximo.id) : cfg.editar) + '">' +
        '<span class="ms-anel-caixa">' + anel(pct) + '</span>' +
        '<span class="ms-topo-txt">' +
          '<strong>' + (pct === 100 ? 'Seu site está completo' : 'Seu site está ' + pct + '% pronto') + '</strong>' +
          '<small>' + (proximo ? 'Próximo: ' + esc(proximo.titulo) : 'Toque pra revisar qualquer parte') + '</small>' +
        '</span>' +
        '<span class="ms-topo-btn">' + (pct === 0 ? 'Começar' : proximo ? 'Continuar' : 'Editar') + '</span>' +
      '</a>' +
      '<p class="ms-ajuda">Tudo se edita do mesmo jeito: passo a passo, vendo o site mudar na hora. Toque numa parte pra ir direto nela.</p>' +
      ordem.map(function (cap) {
        var lista = grupos[cap];
        var ok = lista.filter(function (p) { return p.feito; }).length;
        return '<section class="ms-cap">' +
          '<header><h3>' + esc(CAPITULOS[cap] || cap) + '</h3><span>' + ok + '/' + lista.length + '</span></header>' +
          lista.map(function (p) {
            var est = p.feito ? 'ok' : p.feito === false ? 'falta' : 'opcional';
            return '<a class="ms-passo ms-' + est + '" href="' + ir(p.id) + '">' +
              '<span class="ms-marca" aria-hidden="true">' + (p.feito ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '') + '</span>' +
              '<span class="ms-passo-nome">' + esc(p.titulo) + '</span>' +
              '<span class="ms-passo-est">' + (p.feito ? 'pronto' : p.feito === false ? 'falta' : 'opcional') + '</span>' +
              '</a>';
          }).join('') +
          '</section>';
      }).join('') +
      '<section class="ms-cap ms-divulgar">' +
        '<header><h3>Divulgar</h3></header>' +
        '<div class="ms-link"><code>' + esc(limpo) + '</code></div>' +
        '<div class="ms-botoes">' +
          '<button type="button" class="ms-btn" data-ms="copiar">Copiar link</button>' +
          '<button type="button" class="ms-btn" data-ms="compartilhar">Compartilhar</button>' +
          '<a class="ms-btn" href="' + esc(cfg.link) + '" target="_blank" rel="noopener">Abrir</a>' +
        '</div>' +
        '<div class="ms-qr"><div class="ms-qr-img" data-ms-qr></div><div><p>QR Code pra colar no balcão, no cartão e nas embalagens.</p><button type="button" class="ms-btn" data-ms="baixar">Baixar QR Code</button></div></div>' +
      '</section>' +
      '<a class="ms-anunciar" href="/anunciar.html">' +
        '<span class="ms-anunciar-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a7.5 7.5 0 0 1 0 11"/></svg></span>' +
        '<span><strong>Anunciar</strong><small>Seu negócio em destaque na busca</small></span>' +
      '</a>' +
      '</div>';
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

  // as perguntas do tipo de negócio (perguntas-segmento.js), no capítulo "sobre"
  function passosSobre(segmento, areas, respostas) {
    if (!global.VBPerguntas) return [];
    return global.VBPerguntas.lista(segmento, areas).map(function (p) {
      var v = respostas[p.chave];
      return { id: 'q_' + p.chave, capitulo: 'sobre', titulo: p.pergunta, feito: p.tipo === 'varios' ? Array.isArray(v) : v != null && v !== '' };
    });
  }
  var tem = function (v) { return !!String(v || '').trim(); };
  var qtd = function (l) { return l == null ? null : l.length > 0; };

  // mesmos ids e capítulos do editor da Agenda (perfil.js → montarPassosEdicao)
  function passosAgenda(d) {
    var l = d.linha || {}, tattoo = l.segmento === 'tatuador';
    return [
      { id: 'foto', capitulo: 'impressao', titulo: 'Foto principal', feito: !!(l.foto_hero_url || l.foto_capa_url) },
      { id: 'textos', capitulo: 'impressao', titulo: 'Nome e frases', feito: tem(l.titulo_hero) },
      { id: 'estilo', capitulo: 'impressao', titulo: 'Cores e estilo', feito: !!l.template },
      { id: 'efeito', capitulo: 'impressao', titulo: 'Efeito do título', feito: null },
      { id: 'servicos', capitulo: 'oferta', titulo: tattoo ? 'Sessões e preços' : 'Serviços e preços', feito: qtd(d.servicos) },
      { id: 'equipe', capitulo: 'oferta', titulo: 'Quem atende', feito: qtd(d.equipe) },
      { id: 'galeria', capitulo: 'oferta', titulo: tattoo ? 'Portfólio' : 'Galeria de fotos', feito: qtd(d.galeria) },
      { id: 'horario', capitulo: 'funciona', titulo: 'Horário', feito: qtd(d.horarios) },
      { id: 'contato', capitulo: 'funciona', titulo: 'WhatsApp', feito: tem(String(l.telefone_whatsapp || '').replace(/\D/g, '')) },
      { id: 'localizacao', capitulo: 'achar', titulo: 'Endereço', feito: tem(l.endereco) },
      { id: 'redes', capitulo: 'achar', titulo: 'Redes sociais', feito: !!(l.instagram_url || l.facebook_url || l.tiktok_url) }
    ].concat(passosSobre(l.segmento, d.areas || ['agenda'], d.respostas || {}));
  }

  // mesmos ids e capítulos do editor de Pedir/Chamar (editar-loja.js → montarPassos)
  function passosLoja(d) {
    var e = d.loja || {}, ident = d.identidade || {}, S = !!d.servico;
    var h = e.horarios;
    return [
      { id: 'foto', capitulo: 'impressao', titulo: 'Foto principal', feito: !!(ident.foto_hero_url || e.foto_capa_url) },
      { id: 'logo', capitulo: 'impressao', titulo: 'Logo', feito: !!e.foto_perfil_url },
      { id: 'textos', capitulo: 'impressao', titulo: 'Nome e frases', feito: tem(e.descricao) },
      { id: 'estilo', capitulo: 'impressao', titulo: 'Cores e estilo', feito: d.identidade ? !!ident.template : null },
      { id: 'efeito', capitulo: 'impressao', titulo: 'Efeito do título', feito: null },
      { id: 'itens', capitulo: 'oferta', titulo: S ? 'Serviços e preços' : 'Cardápio', feito: d.itens == null ? null : d.itens > 0 },
      { id: 'atendimento', capitulo: 'funciona', titulo: S ? 'Atendimento' : 'Entrega e retirada', feito: !!(e.aceita_entrega || e.aceita_retirada) },
      { id: 'pagamento', capitulo: 'funciona', titulo: 'Pagamento', feito: !!(e.formas_pagamento && e.formas_pagamento.length) },
      { id: 'horario', capitulo: 'funciona', titulo: 'Horário', feito: !!(h && Object.keys(h).length) },
      { id: 'endereco', capitulo: 'achar', titulo: 'Endereço e Instagram', feito: tem(e.endereco) }
    ].concat(passosSobre(e.segmento, e.areas || [S ? 'servicos' : 'delivery'], d.respostas || {}));
  }

  global.VBMeuSite = { montar: montar, html: html, passosAgenda: passosAgenda, passosLoja: passosLoja, CAPITULOS: CAPITULOS };
})(window);
