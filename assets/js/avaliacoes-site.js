/* "O que dizem os clientes" no site de cada negócio + o passo a passo pra
   deixar um comentário (nota, texto, nome e WhatsApp). Depende das funções
   de supabase/sql/2026-10-avaliacoes.sql: se ainda não existirem no
   banco, nada aparece (nem a seção, nem a opção de comentar).

   VBAvaliacoes.ligar(estabId, antesDe) -> Promise<boolean disponível>
   VBAvaliacoes.comentar() — abre o formulário */
(function () {
  var estabId = null, secao = null, folha = null, nota = 0;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function estrelas(n) { return '★★★★★'.slice(0, n); }

  function ligar(id, antesDe) {
    estabId = id;
    if (!window.db) return Promise.resolve(false);
    return window.db.rpc('avaliacoes_publicas', { p_estabelecimento_id: id, p_limite: 6 }).then(function (r) {
      if (!r || r.error) return false;
      if (!secao) {
        secao = document.createElement('section');
        secao.className = 'aval-secao';
        secao.id = 'avaliacoesSecao';
        if (antesDe && antesDe.parentNode) antesDe.parentNode.insertBefore(secao, antesDe);
        else document.body.appendChild(secao);
        secao.addEventListener('click', function (e) { if (e.target.closest('[data-comentar]')) comentar(); });
      }
      pintar(r.data || []);
      return true;
    }, function () { return false; });
  }

  function pintar(lista) {
    var media = lista.length ? lista.reduce(function (s, c) { return s + c.nota; }, 0) / lista.length : 0;
    secao.innerHTML = '<p class="eyebrow">Comentários</p><h2>O que dizem os clientes</h2>' +
      (lista.length
        ? '<p class="aval-resumo"><b>' + estrelas(Math.round(media)) + '</b> ' + String(media.toFixed(1)).replace('.', ',') + ' nos últimos comentários</p>' +
          '<ul class="aval-lista">' + lista.map(function (c) {
            return '<li><p>“' + esc(c.comentario) + '”</p><small>' + esc(c.cliente_nome) + ' <span>' + estrelas(c.nota) + '</span></small></li>';
          }).join('') + '</ul>'
        : '<p class="aval-resumo">Ainda não tem comentários por aqui. Já foi atendido? Conta como foi.</p>') +
      '<button type="button" class="aval-deixar" data-comentar>Deixar meu comentário →</button>';
  }

  function comentar() {
    var conhecido = window.VBClienteGlobal && window.VBClienteGlobal.obter ? window.VBClienteGlobal.obter() : null;
    nota = 0;
    if (!folha) {
      folha = document.createElement('div');
      folha.className = 'passo-folha';
      folha.setAttribute('role', 'dialog');
      folha.setAttribute('aria-modal', 'true');
      document.body.appendChild(folha);
      folha.addEventListener('click', function (e) {
        if (e.target === folha || e.target.closest('[data-fechar]')) { folha.classList.remove('aberta'); return; }
        var b = e.target.closest('[data-nota]');
        if (b) {
          nota = Number(b.getAttribute('data-nota'));
          folha.querySelectorAll('[data-nota]').forEach(function (x) { x.classList.toggle('on', Number(x.getAttribute('data-nota')) <= nota); });
          validar();
        }
        if (e.target.closest('[data-enviar]')) enviar();
      });
      folha.addEventListener('input', validar);
    }
    folha.innerHTML = '<div class="passo-folha-caixa aval-form">' +
      '<button type="button" class="passo-folha-fechar" data-fechar aria-label="Fechar">×</button>' +
      '<p class="passo-folha-marca">Matriz</p>' +
      '<h2>Como foi o atendimento?</h2>' +
      '<p class="passo-folha-sub">Toque nas estrelas, escreva umas palavras e pronto.</p>' +
      '<div class="aval-estrelas" role="group" aria-label="Nota">' + [1, 2, 3, 4, 5].map(function (n) {
        return '<button type="button" data-nota="' + n + '" aria-label="' + n + ' de 5">★</button>';
      }).join('') + '</div>' +
      '<label for="avalTexto">Seu comentário</label><textarea id="avalTexto" maxlength="400" placeholder="Ex.: atendimento no horário, ambiente limpo…"></textarea>' +
      '<label for="avalNome">Seu nome</label><input id="avalNome" maxlength="60" autocomplete="name" value="' + esc(conhecido && conhecido.nome || '') + '">' +
      '<label for="avalTel">WhatsApp (não aparece pra ninguém)</label><input id="avalTel" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(conhecido && conhecido.telefone || '') + '">' +
      '<p class="aval-msg" id="avalMsg"></p>' +
      '<button type="button" class="aval-enviar" data-enviar disabled>Publicar comentário →</button></div>';
    folha.classList.add('aberta');
  }

  function valores() {
    return {
      texto: folha.querySelector('#avalTexto').value.trim(),
      nome: folha.querySelector('#avalNome').value.trim(),
      tel: folha.querySelector('#avalTel').value.replace(/\D/g, '')
    };
  }
  function validar() {
    var v = valores();
    folha.querySelector('[data-enviar]').disabled = !(nota && v.texto.length >= 3 && v.nome.length >= 2 && v.tel.length >= 10);
  }
  function enviar() {
    var v = valores(), btn = folha.querySelector('[data-enviar]'), msg = folha.querySelector('#avalMsg');
    btn.disabled = true; msg.textContent = '';
    window.db.rpc('avaliacao_criar', { p_estabelecimento_id: estabId, p_nome: v.nome, p_telefone: v.tel, p_nota: nota, p_comentario: v.texto }).then(function (r) {
      if (r.error) { msg.textContent = r.error.message || 'Não deu pra publicar agora.'; btn.disabled = false; return; }
      folha.querySelector('.passo-folha-caixa').innerHTML = '<button type="button" class="passo-folha-fechar" data-fechar aria-label="Fechar">×</button>' +
        '<p class="passo-folha-marca">Matriz</p><h2>Obrigado!</h2><p class="passo-folha-sub">Seu comentário já está no site e ajuda quem está escolhendo.</p>';
      ligar(estabId);
    }, function () { msg.textContent = 'Sem conexão agora — tenta de novo em instantes.'; btn.disabled = false; });
  }

  window.VBAvaliacoes = { ligar: ligar, comentar: comentar };
})();
