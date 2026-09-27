/* Splash do Vibe: desenha os ícones, cumprimenta pela hora, lembra a
   última escolha, troca "Tenho um negócio" por "Meu painel" quando o dono
   já está logado e, ao escolher, sai deslizando pra área (View Transitions). */
(function () {
  'use strict';

  var CHAVE_ULTIMA = 'vibe-ultima-escolha';
  var T = window.VibeToggle || {};
  var ICONES = T.ICONES || {};
  // "tenho um negócio": uma lojinha com o cubo em cima, traço por traço
  ICONES.negocio = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4 10.5V20h16v-9.5" pathLength="1"/><path d="M3 10.5l2-5h14l2 5z" pathLength="1"/>' +
    '<path d="M10 20v-4.5h4V20" pathLength="1" class="vt-check"/></svg>';

  var corpo = document.body;
  var cubo = document.getElementById('spCubo');
  var ops = Array.prototype.slice.call(document.querySelectorAll('.sp-op'));

  // ícones
  ops.forEach(function (op) {
    var ic = op.querySelector('.sp-ic');
    if (ic && ICONES[ic.getAttribute('data-icone')]) ic.innerHTML = ICONES[ic.getAttribute('data-icone')];
  });

  // cumprimento pela hora
  var h = new Date().getHours();
  var ola = document.getElementById('spOla');
  if (ola) ola.textContent = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';

  function ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }
  function gravar(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) {} }

  // dono já logado (sessão do Supabase salva neste aparelho) → atalho pro painel
  function donoLogado() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-.+-auth-token$/.test(k) && /"access_token"/.test(localStorage.getItem(k) || '')) return true;
      }
    } catch (e) {}
    return false;
  }
  if (donoLogado()) {
    document.getElementById('spNegocio').href = '/cadastro.html';
    document.getElementById('spNegocioTitulo').textContent = 'Meu painel';
    document.getElementById('spNegocioSub').textContent = 'Agenda, pedidos e chamados do seu negócio';
    var entrar = document.getElementById('spEntrar');
    if (entrar) entrar.textContent = 'Minha conta';
  }

  // lembra a última escolha com um selo discreto
  var ultima = ler(CHAVE_ULTIMA);
  ops.forEach(function (op) {
    if (op.getAttribute('data-area') !== ultima) return;
    var selo = document.createElement('span');
    selo.className = 'sp-selo';
    selo.textContent = 'Da última vez';
    op.appendChild(selo);
  });

  // foco numa opção: acende a luz da área e o cubo vira pra ela
  var MIRA = { agenda: -30, delivery: 30, servicos: 90, negocio: 180 };
  function focar(op) {
    var area = op ? op.getAttribute('data-area') : '';
    ops.forEach(function (o) { o.classList.toggle('sp-foco', o === op); });
    if (area) corpo.setAttribute('data-foco', area); else corpo.removeAttribute('data-foco');
    if (cubo) cubo.style.setProperty('--mira', (MIRA[area] || 0) + 'deg');
  }
  ops.forEach(function (op) {
    op.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') focar(op); });
    op.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') focar(null); });
    op.addEventListener('focus', function () { focar(op); });
    op.addEventListener('blur', function () { focar(null); });
    op.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // nova aba: segue normal
      gravar(CHAVE_ULTIMA, op.getAttribute('data-area'));
      focar(op);
      op.classList.add('sp-indo');
      if (T.marcarDirecao) T.marcarDirecao('avanca');
    });
  });

  // voltou pelo "voltar" do navegador (bfcache): limpa o estado de clique
  window.addEventListener('pageshow', function () {
    ops.forEach(function (o) { o.classList.remove('sp-indo'); });
    focar(null);
  });
})();
