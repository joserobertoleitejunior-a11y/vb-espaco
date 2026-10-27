/* Efeitos do título do site: movimento, fonte e estilo escolhidos pelo
   dono no passo a passo de edição (Agenda e Pedir/Chamar). Tudo é CSS
   (assets/css/titulo-efeitos.css) — aqui só monta as peças que o efeito
   precisa (letras/palavras soltas, faixa duplicada) e liga as classes.
   Gravado em estabelecimentos.titulo_efeito (supabase/sql/2026-10-titulo-efeito.sql). */
(function (global) {
  'use strict';

  var OPCOES = {
    movimento: [
      { chave: '', nome: 'Parado' },
      { chave: 'surgir', nome: 'Surgir' },
      { chave: 'digitar', nome: 'Digitando' },
      { chave: 'onda', nome: 'Onda' },
      { chave: 'brilho', nome: 'Brilho' },
      { chave: 'pulsar', nome: 'Pulsar' },
      { chave: 'faixa', nome: 'Faixa correndo ↔' },
      { chave: 'girar', nome: 'Subindo ↕' }
    ],
    fonte: [
      { chave: '', nome: 'Do estilo' },
      { chave: 'classica', nome: 'Clássica' },
      { chave: 'elegante', nome: 'Elegante' },
      { chave: 'moderna', nome: 'Moderna' },
      { chave: 'impacto', nome: 'Impacto' },
      { chave: 'manuscrita', nome: 'Manuscrita' }
    ],
    estilo: [
      { chave: '', nome: 'Normal' },
      { chave: 'degrade', nome: 'Degradê' },
      { chave: 'contorno', nome: 'Contorno' },
      { chave: 'neon', nome: 'Neon' },
      { chave: 'sombra', nome: 'Sombra 3D' },
      { chave: 'caixa', nome: 'Caixa alta' }
    ]
  };

  var fonteCarregada = false;
  function carregarFonteManuscrita() {
    if (fonteCarregada) return;
    fonteCarregada = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap';
    document.head.appendChild(l);
  }

  function pedacos(texto, porPalavra) {
    var i = 0;
    return texto.split(/(\s+)/).map(function (parte) {
      if (/^\s+$/.test(parte)) return parte;
      if (porPalavra) return '<span class="te-p" style="--i:' + (i++) + '">' + esc(parte) + '</span>';
      // letras de uma palavra ficam juntas (não quebram no meio)
      return '<span class="te-palavra">' + Array.prototype.map.call(parte, function (c) {
        return '<span class="te-l" style="--i:' + (i++) + '">' + esc(c) + '</span>';
      }).join('') + '</span>';
    }).join('');
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // aplica no elemento do título; texto = o texto puro (o elemento é refeito)
  function aplicar(el, cfg, texto) {
    if (!el) return;
    cfg = cfg || {};
    if (texto == null) texto = el.getAttribute('data-te-texto') != null ? el.getAttribute('data-te-texto') : el.textContent;
    el.setAttribute('data-te-texto', texto);
    el.className = el.className.replace(/\bte-[a-z-]+\b/g, '').trim();
    el.style.removeProperty('--te-altura');
    var m = cfg.movimento || '', f = cfg.fonte || '', s = cfg.estilo || '';
    if (f === 'manuscrita') carregarFonteManuscrita();
    if (m === 'surgir') el.innerHTML = pedacos(texto, true);
    else if (m === 'digitar' || m === 'onda') el.innerHTML = pedacos(texto, false);
    else if (m === 'faixa') el.innerHTML = '<span class="te-trilho"><span>' + esc(texto) + '</span><span aria-hidden="true">' + esc(texto) + '</span></span>';
    else if (m === 'girar') el.innerHTML = '<span class="te-janela"><span class="te-trilho"><span>' + esc(texto) + '</span><span aria-hidden="true">' + esc(texto) + '</span></span></span>';
    else el.textContent = texto;
    if (m) el.classList.add('te-m-' + m);
    if (f) el.classList.add('te-f-' + f);
    if (s) el.classList.add('te-s-' + s);
    if (m || f || s) el.classList.add('te');
    if (m === 'girar') {
      // a janela mostra o tamanho de um título; o trilho sobe e repete
      var copia = el.querySelector('.te-trilho > span');
      requestAnimationFrame(function () { el.style.setProperty('--te-altura', copia.offsetHeight + 'px'); });
    }
  }

  function carregar(estabId) {
    if (!global.db || !estabId) return Promise.resolve({});
    return global.db.rpc('titulo_efeito_publico', { p_estabelecimento_id: estabId }).then(function (r) {
      return (r && !r.error && r.data) || {};
    }, function () { return {}; });
  }
  function salvar(estabId, cfg) {
    return global.db.rpc('tenant_admin_atualizar_titulo_efeito', { p_estabelecimento_id: estabId, p_efeito: cfg || {} }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }

  // bloco de escolha usado pelos dois editores (perfil.js e editar-loja.js)
  function montarEscolha(caixa, cfg, aoMudar) {
    cfg = Object.assign({}, cfg || {});
    function grupo(chave, titulo) {
      return '<p class="vb-ed-rotulo">' + titulo + '</p><div class="te-opcoes" data-grupo="' + chave + '">' +
        OPCOES[chave].map(function (o) {
          return '<button type="button" class="te-opcao' + ((cfg[chave] || '') === o.chave ? ' ativo' : '') + '" data-valor="' + o.chave + '">' + o.nome + '</button>';
        }).join('') + '</div>';
    }
    caixa.innerHTML = grupo('movimento', 'Movimento') + grupo('fonte', 'Letra') + grupo('estilo', 'Estilo');
    caixa.addEventListener('click', function (e) {
      var b = e.target.closest('[data-valor]');
      if (!b) return;
      var g = b.closest('[data-grupo]').getAttribute('data-grupo');
      cfg[g] = b.getAttribute('data-valor');
      if (!cfg[g]) delete cfg[g];
      b.parentNode.querySelectorAll('.te-opcao').forEach(function (x) { x.classList.toggle('ativo', x === b); });
      aoMudar(Object.assign({}, cfg));
    });
  }

  global.VBTituloEfeitos = { OPCOES: OPCOES, aplicar: aplicar, carregar: carregar, salvar: salvar, montarEscolha: montarEscolha };
})(window);
