/* "O próximo passo a um clique" dentro do site de cada estabelecimento:
   um botão discreto no rodapé da tela que abre uma folha com uma
   pergunta só — "O que você quer fazer aqui?" — e as respostas certas
   pra aquele negócio (agendar, pedir, orçamento, chamar, ver preços,
   falar no WhatsApp). Cada resposta leva direto pro passo a passo
   daquela ação (a agenda em 5 passos, o cardápio por categoria...).

   window.VBPassoSite.montar({ titulo, sub, opcoes: function () { return [
     { rotulo, detalhe, href } | { rotulo, detalhe, acao: function () {} } ] } }) */
(function () {
  var pill = null, folha = null, cfg = null;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var DEGRAUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h5v-5h5v-5h5V5h3"/></svg>';

  function montar(config) {
    cfg = config;
    if (pill) return;
    pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'passo-pill';
    pill.innerHTML = DEGRAUS + '<span>O próximo passo <em>a um clique</em></span>';
    pill.addEventListener('click', abrir);
    document.body.appendChild(pill);
    requestAnimationFrame(function () { pill.classList.add('mostrar'); });
  }

  function abrir() {
    var opcoes = (cfg.opcoes() || []).filter(Boolean);
    if (opcoes.length === 1 && opcoes[0].acao) { opcoes[0].acao(); return; }
    if (!folha) {
      folha = document.createElement('div');
      folha.className = 'passo-folha';
      folha.setAttribute('role', 'dialog');
      folha.setAttribute('aria-modal', 'true');
      folha.addEventListener('click', function (e) {
        if (e.target === folha || e.target.closest('[data-fechar]')) { fechar(); return; }
        var op = e.target.closest('[data-op]');
        if (!op) return;
        var escolhida = folha._opcoes[Number(op.getAttribute('data-op'))];
        op.classList.add('escolhida');
        setTimeout(function () {
          fechar();
          if (escolhida.acao) escolhida.acao();
          else if (escolhida.href) window.location.href = escolhida.href;
        }, 170);
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && folha.classList.contains('aberta')) fechar(); });
      document.body.appendChild(folha);
    }
    folha._opcoes = opcoes;
    var sub = typeof cfg.sub === 'function' ? cfg.sub() : cfg.sub;
    folha.innerHTML = '<div class="passo-folha-caixa">' +
      '<button type="button" class="passo-folha-fechar" data-fechar aria-label="Fechar">×</button>' +
      '<p class="passo-folha-marca">' + DEGRAUS + 'Passo a passo</p>' +
      '<h2>' + esc(cfg.titulo || 'O que você quer fazer aqui?') + '</h2>' +
      (sub ? '<p class="passo-folha-sub">' + esc(sub) + '</p>' : '') +
      '<ol>' + opcoes.map(function (o, i) {
        return '<li style="--i:' + i + '"><button type="button" data-op="' + i + '">' +
          '<span class="n">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="t">' + esc(o.rotulo) + '</span>' +
          (o.detalhe ? '<span class="d">' + esc(o.detalhe) + '</span>' : '') +
          '<span class="s" aria-hidden="true">→</span></button></li>';
      }).join('') + '</ol></div>';
    folha.classList.add('aberta');
    var primeiro = folha.querySelector('[data-op]');
    if (primeiro) primeiro.focus({ preventScroll: true });
  }

  function fechar() { if (folha) folha.classList.remove('aberta'); if (pill) pill.focus({ preventScroll: true }); }

  window.VBPassoSite = { montar: montar, abrir: function () { if (cfg) abrir(); } };
})();
