/* "Meu plano" no painel do dono: plano, valor, créditos de IA, validade e botão de pagar (Mercado Pago).
   Enquanto a cobrança estiver desligada (plataforma_config.cobranca_ativa = 'nao'), não aparece nada —
   continua o aviso de "grátis por tempo limitado". Ligar: update plataforma_config set valor='sim' where chave='cobranca_ativa'. */
(function () {
  'use strict';
  if (!window.db) return;
  var ativa = null; // null = ainda não sabe
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function reais(n) { return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ','); }
  function data(d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); return p[2] + '/' + p[1]; }

  function situacao(p) {
    var hoje = new Date().toISOString().slice(0, 10), ate = p.valido_ate ? String(p.valido_ate).slice(0, 10) : null;
    if (p.pagamento_status === 'em_dia' && ate && ate >= hoje) return { cor: 'ok', txt: 'Em dia até ' + data(ate) };
    if (ate && ate >= hoje) return { cor: 'ok', txt: 'Teste grátis até ' + data(ate) };
    return { cor: 'atraso', txt: 'Pagamento pendente' };
  }

  function montar(no) {
    var id = no.getAttribute('data-meu-plano');
    no.setAttribute('data-mp-pronto', '1');
    db.rpc('meu_plano', { p_estabelecimento_id: id }).then(function (r) {
      var p = r.data;
      if (r.error || !p || !p.cobranca_ativa) return; // desligado: segue o aviso de grátis
      var cartao = no.closest('.dash-aviso-gratis'); if (cartao) cartao.style.display = 'none';
      var s = situacao(p);
      no.innerHTML =
        '<div class="mp-plano"><div class="mp-plano-topo"><div><small>Meu plano</small><strong>' + esc(p.plano_nome) + '</strong></div><b>' + reais(p.mensalidade) + '<em>/mês</em></b></div>' +
        '<p class="mp-status mp-' + s.cor + '">' + esc(s.txt) + '</p>' +
        '<p class="mp-ia">IA do funcionário: <b>' + p.usados_mes + ' de ' + p.creditos_mes + '</b> créditos usados · renova em ' + data(p.renova_em) + '</p>' +
        '<label class="mp-turbo"><input type="checkbox" ' + (p.ia_completa ? 'checked' : '') + '> <span>IA completa — 400 créditos por mês (plano ' + reais(p.preco_completo) + ')</span></label>' +
        '<button type="button" class="mp-pagar">Pagar ' + reais(p.mensalidade) + ' agora</button><p class="mp-msg" role="status"></p></div>';
      var msg = no.querySelector('.mp-msg');
      no.querySelector('.mp-turbo input').addEventListener('change', function () {
        var ligada = this.checked;
        db.rpc('meu_plano_ia_completa', { p_estabelecimento_id: id, p_ligada: ligada }).then(function (x) {
          if (x.error) { msg.textContent = 'Não deu pra mudar agora.'; return; }
          no.removeAttribute('data-mp-pronto'); montar(no);
        });
      });
      no.querySelector('.mp-pagar').addEventListener('click', function () {
        var b = this; b.disabled = true; msg.textContent = 'Abrindo o pagamento…';
        db.functions.invoke('mp-criar-cobranca', { body: { estabelecimento_id: id } }).then(function (x) {
          var link = x.data && x.data.init_point;
          if (link) { location.href = link; return; }
          b.disabled = false; msg.textContent = (x.data && x.data.erro) || 'Não deu pra abrir o pagamento agora. Tenta de novo.';
        }, function () { b.disabled = false; msg.textContent = 'Sem conexão. Tenta de novo.'; });
      });
    });
  }
  function varrer() {
    document.querySelectorAll('[data-meu-plano]:not([data-mp-pronto])').forEach(montar);
  }
  new MutationObserver(varrer).observe(document.documentElement, { childList: true, subtree: true });
  varrer();
})();
