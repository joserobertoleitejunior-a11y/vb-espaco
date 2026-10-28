/* Aviso da fase de finalização num lugar só: enquanto o app está nos
   últimos ajustes, tudo é grátis e nenhuma taxa é cobrada. Quando for
   lançado, a mensalidade pra negócios passa a ser MENSALIDADE (pra quem
   agenda, pede ou chama continua sempre grátis).

   Marca um elemento com data-aviso-gratis:
   - ="curto": uma linha (splash);
   - vazio (""): o aviso completo, em cartão (cadastro, painel, criar). */
(function (global) {
  'use strict';
  var MENSALIDADE = 'R$ 19,90';
  global.VB_AVISO_GRATIS = { mensalidade: MENSALIDADE };

  var ICONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/></svg>';

  function html(tipo) {
    if (tipo === 'curto') {
      return ICONE + '<span>Em fase de finalização: <strong>tudo grátis</strong>, sem nenhuma taxa.</span>';
    }
    return ICONE + '<span><strong>Fase de finalização — tudo grátis.</strong> A Matriz está nos últimos ajustes e não cobra nenhuma taxa agora. ' +
      'Quando o app for finalizado, a mensalidade pra negócios vai ser <strong>' + MENSALIDADE + ' por mês</strong> — e você é avisado antes de qualquer cobrança.</span>';
  }

  function aplicar() {
    document.querySelectorAll('[data-aviso-gratis]').forEach(function (el) {
      var tipo = el.getAttribute('data-aviso-gratis');
      el.classList.add('aviso-gratis');
      if (tipo === 'curto') el.classList.add('aviso-gratis-curto');
      el.setAttribute('role', 'note');
      el.innerHTML = html(tipo);
    });
  }
  global.VBAvisoGratis = { aplicar: aplicar, html: html };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})(window);
