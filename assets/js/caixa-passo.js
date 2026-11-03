/* Caixa passo a passo: registrar uma venda em poucos toques.
   Uma pergunta por tela, botões grandes, e o que dá pra adivinhar já vem
   escolhido. Só pede o que importa:

     1. O que foi vendido?      (toque no serviço; de novo soma mais um)
     2. Quem atendeu?           (só se tiver equipe; um toque e já avança)
     3. Como pagou?             (Pix e Cartão: um toque e avança)
     4. Quem comprou?           (opcional — pode pular)
     5. Conferir e registrar

   Não fala com o banco: quem usa passa `enviar(params)` (a mesma função da
   fila offline do painel). Assim a venda sai pelo mesmo caminho de sempre.

     VBCaixaPasso.abrir({
       servicos: [{ id, nome, preco }], equipe: [{ id, nome }],
       formas: [{ chave, nome }], preco: fn(valor) → "R$ 10,00",
       base: { p_estabelecimento_id },
       enviar: fn(params) → Promise<{ offline?, res?: { error } }>,
       aoTerminar: fn()   // depois de registrar (pra atualizar a lista do dia)
     });
*/
(function (global) {
  'use strict';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function arred(v) { return Math.round(v * 100) / 100; }
  function numero(txt) { return parseFloat(String(txt || '').replace(/\./g, '').replace(',', '.')) || 0; }

  var SETA = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var FECHAR = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var CHECK = '<svg viewBox="0 0 52 52" width="64" height="64" aria-hidden="true"><circle class="cxw-ok-c" cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="3"/><path class="cxw-ok-v" d="M15 27l8 8 15-17" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function abrir(cfg) {
    var formas = cfg.formas || [];
    var temEquipe = (cfg.equipe || []).length > 0;
    var passos = ['itens'].concat(temEquipe ? ['quem'] : [], ['pagar', 'cliente', 'conferir']);
    var avulsoSeq = 0;

    var s;
    function zerar() {
      s = { i: 0, carrinho: [], staff: null, forma: null, dividir: false, forma2: null, valor1: '', recebido: '', nome: '', tel: '', enviando: false, pronto: false, erro: '', avulso: false };
    }
    zerar();

    var raiz = document.createElement('div');
    raiz.className = 'cxw';
    raiz.setAttribute('role', 'dialog');
    raiz.setAttribute('aria-modal', 'true');
    raiz.setAttribute('aria-label', 'Nova venda');
    raiz.innerHTML =
      '<header class="cxw-topo">' +
        '<button type="button" class="cxw-voltar" data-cxw-voltar aria-label="Voltar">' + SETA + '</button>' +
        '<div class="cxw-titulo"><strong>Nova venda</strong><span data-cxw-conta></span></div>' +
        '<button type="button" class="cxw-fechar" data-cxw-fechar aria-label="Fechar">' + FECHAR + '</button>' +
      '</header>' +
      '<div class="cxw-barra"><i data-cxw-barra></i></div>' +
      '<main class="cxw-corpo" data-cxw-corpo></main>' +
      '<footer class="cxw-pe" data-cxw-pe></footer>';
    document.body.appendChild(raiz);
    document.documentElement.classList.add('cxw-aberto');
    requestAnimationFrame(function () { raiz.classList.add('on'); });

    var corpo = raiz.querySelector('[data-cxw-corpo]');
    var pe = raiz.querySelector('[data-cxw-pe]');

    function total() { return arred(s.carrinho.reduce(function (t, x) { return t + x.preco * x.qtd; }, 0)); }
    function nomeForma(ch) { var f = formas.filter(function (x) { return x.chave === ch; })[0]; return f ? f.nome : ch; }
    function qtdDe(key) { var x = s.carrinho.filter(function (i) { return i.key === key; })[0]; return x ? x.qtd : 0; }
    function mexer(key, nome, preco, servicoId, delta) {
      var x = s.carrinho.filter(function (i) { return i.key === key; })[0];
      if (!x && delta > 0) s.carrinho.push({ key: key, nome: nome, preco: preco, qtd: 1, servicoId: servicoId });
      else if (x) { x.qtd += delta; if (x.qtd <= 0) s.carrinho = s.carrinho.filter(function (i) { return i.key !== key; }); }
    }

    /* ---------- cada tela ---------- */
    function telaItens() {
      var cartoes = (cfg.servicos || []).map(function (sv) {
        var q = qtdDe(String(sv.id));
        return '<div class="cxw-card' + (q ? ' on' : '') + '" data-cxw-item="' + esc(sv.id) + '" role="button" tabindex="0">' +
          '<span class="cxw-card-nome">' + esc(sv.nome) + '</span><span class="cxw-card-preco">' + cfg.preco(Number(sv.preco) || 0) + '</span>' +
          (q ? '<span class="cxw-qtd"><button type="button" data-cxw-menos="' + esc(sv.id) + '" aria-label="Tirar um">−</button><b>' + q + '</b></span>' : '') + '</div>';
      }).join('');
      var avulsos = s.carrinho.filter(function (i) { return !i.servicoId; }).map(function (x) {
        return '<div class="cxw-card on" data-cxw-item="' + esc(x.key) + '"><span class="cxw-card-nome">' + esc(x.nome) + '</span><span class="cxw-card-preco">' + cfg.preco(x.preco) + '</span>' +
          '<span class="cxw-qtd"><button type="button" data-cxw-menos="' + esc(x.key) + '" aria-label="Tirar um">−</button><b>' + x.qtd + '</b></span></div>';
      }).join('');
      var avulsoBox = s.avulso
        ? '<div class="cxw-avulso"><input id="cxwAvDesc" type="text" placeholder="O que foi vendido? Ex.: Shampoo" maxlength="80" autocomplete="off">' +
          '<input id="cxwAvValor" type="text" inputmode="decimal" placeholder="Valor (R$)" autocomplete="off">' +
          '<button type="button" class="cxw-sec" data-cxw-avulso-ok>Colocar na venda</button></div>'
        : '';
      return '<h2>O que foi vendido?</h2><p class="cxw-dica">Toque no serviço. Toque de novo pra somar mais um.</p>' +
        '<div class="cxw-grade">' + cartoes + avulsos +
        '<button type="button" class="cxw-card cxw-outro" data-cxw-avulso>' + (s.avulso ? 'Fechar' : '+ Outro item') + '<small>digitar o valor</small></button></div>' + avulsoBox;
    }

    function telaQuem() {
      var lista = (cfg.equipe || []).map(function (p) {
        return '<button type="button" class="cxw-grande' + (s.staff && s.staff.id === p.id ? ' on' : '') + '" data-cxw-staff="' + esc(p.id) + '">' + esc(p.nome) + '</button>';
      }).join('');
      return '<h2>Quem atendeu?</h2><p class="cxw-dica">Um toque e já avança.</p><div class="cxw-lista">' + lista + '</div>' +
        '<button type="button" class="cxw-link" data-cxw-pular>Pular — não quero dizer</button>';
    }

    function telaPagar() {
      var t = total();
      var botoes = formas.map(function (f) {
        return '<button type="button" class="cxw-grande' + (!s.dividir && s.forma === f.chave ? ' on' : '') + '" data-cxw-forma="' + f.chave + '">' + esc(f.nome) + '</button>';
      }).join('');
      var extra = '';
      if (s.dividir) {
        var v1 = numero(s.valor1), resto = arred(t - v1);
        var chips = function (atual, att) {
          return '<div class="cxw-chips">' + formas.map(function (f) { return '<button type="button" class="' + (atual === f.chave ? 'on' : '') + '" data-cxw-' + att + '="' + f.chave + '">' + esc(f.nome) + '</button>'; }).join('') + '</div>';
        };
        extra = '<div class="cxw-divide"><p class="cxw-dica">Pagou de dois jeitos. Diga quanto foi no primeiro; o resto vai no segundo.</p>' +
          '<div class="cxw-linha"><span>1º jeito</span>' + chips(s.forma, 'forma1') + '<input id="cxwV1" type="text" inputmode="decimal" placeholder="Quanto? (R$)" value="' + esc(s.valor1) + '"></div>' +
          '<div class="cxw-linha"><span>2º jeito</span>' + chips(s.forma2, 'forma2') + '<p class="cxw-resto" id="cxwResto">' + (v1 > 0 && v1 < t ? 'Resto: ' + cfg.preco(resto) : 'O resto aparece aqui') + '</p></div></div>';
      } else if (s.forma === 'dinheiro') {
        var rec = numero(s.recebido), troco = arred(rec - t);
        var sugestoes = [t].concat([20, 50, 100, 200].filter(function (n) { return n > t; }).slice(0, 3));
        extra = '<div class="cxw-troco"><p class="cxw-dica">Quanto ele deu? (opcional, só pra calcular o troco)</p>' +
          '<div class="cxw-chips">' + sugestoes.map(function (n, k) { return '<button type="button" data-cxw-rec="' + n + '">' + (k === 0 ? 'Certinho' : cfg.preco(n)) + '</button>'; }).join('') + '</div>' +
          '<input id="cxwRec" type="text" inputmode="decimal" placeholder="Outro valor (R$)" value="' + esc(s.recebido) + '">' +
          '<p class="cxw-resto' + (rec && troco < 0 ? ' erro' : '') + '" id="cxwTroco">' + (rec ? (troco >= 0 ? 'Troco: ' + cfg.preco(troco) : 'Faltam ' + cfg.preco(-troco)) : '') + '</p></div>';
      }
      return '<h2>Como o cliente pagou?</h2><p class="cxw-dica">Total: <strong>' + cfg.preco(t) + '</strong></p>' +
        (s.dividir ? '' : '<div class="cxw-lista">' + botoes + '</div>') + extra +
        '<button type="button" class="cxw-link" data-cxw-dividir>' + (s.dividir ? 'Voltar: pagou de um jeito só' : 'Pagou de dois jeitos? Toque aqui') + '</button>';
    }

    function telaCliente() {
      return '<h2>Quem comprou?</h2><p class="cxw-dica">Opcional. Com o telefone, o cliente fica salvo na aba Clientes.</p>' +
        '<label class="cxw-campo">Nome<input id="cxwNome" type="text" placeholder="Ex.: Maria Silva" value="' + esc(s.nome) + '" maxlength="80" autocomplete="off"></label>' +
        '<label class="cxw-campo">Telefone<input id="cxwTel" type="tel" inputmode="numeric" placeholder="Ex.: 15 99999-8888" value="' + esc(s.tel) + '" maxlength="20" autocomplete="off"></label>' +
        '<button type="button" class="cxw-link" data-cxw-pular>Pular — venda sem cliente</button>';
    }

    function pagamentoTexto() {
      if (s.dividir) return nomeForma(s.forma) + ' ' + cfg.preco(numero(s.valor1)) + ' + ' + nomeForma(s.forma2) + ' ' + cfg.preco(arred(total() - numero(s.valor1)));
      return nomeForma(s.forma);
    }

    function telaConferir() {
      var itens = s.carrinho.map(function (x) {
        return '<li><span>' + (x.qtd > 1 ? x.qtd + '× ' : '') + esc(x.nome) + '</span><b>' + cfg.preco(arred(x.preco * x.qtd)) + '</b></li>';
      }).join('');
      var linhas = [['Pagamento', pagamentoTexto()]];
      if (temEquipe) linhas.unshift(['Atendeu', s.staff ? s.staff.nome : '—']);
      linhas.push(['Cliente', (s.nome || s.tel) ? [s.nome, s.tel].filter(Boolean).join(' · ') : 'Sem cliente']);
      return '<h2>Tudo certo?</h2><ul class="cxw-resumo">' + itens + '</ul>' +
        '<div class="cxw-total"><span>Total</span><strong>' + cfg.preco(total()) + '</strong></div>' +
        '<dl class="cxw-dados">' + linhas.map(function (l) { return '<div><dt>' + l[0] + '</dt><dd>' + esc(l[1]) + '</dd></div>'; }).join('') + '</dl>' +
        (s.erro ? '<p class="cxw-erro">' + esc(s.erro) + '</p>' : '');
    }

    function telaPronto() {
      return '<div class="cxw-pronto">' + CHECK + '<h2>Venda registrada!</h2><p class="cxw-dica">' + cfg.preco(s.totalFeito) + ' · ' + esc(s.pagFeito) + '</p>' +
        (s.offline ? '<p class="cxw-dica">Sem internet agora: a venda ficou salva neste aparelho e sobe sozinha quando a conexão voltar.</p>' : '') + '</div>';
    }

    /* ---------- rodapé e navegação ---------- */
    function podeAvancar() {
      var p = passos[s.i];
      if (p === 'itens') return s.carrinho.length > 0;
      if (p === 'pagar') {
        if (s.dividir) { var v1 = numero(s.valor1); return !!s.forma && !!s.forma2 && s.forma !== s.forma2 && v1 > 0 && v1 < total(); }
        return !!s.forma;
      }
      return true;
    }
    function rodape() {
      if (s.pronto) return '<button type="button" class="cxw-sec" data-cxw-fechar>Fechar</button><button type="button" class="cxw-prim" data-cxw-nova>Nova venda</button>';
      var p = passos[s.i];
      if (p === 'quem') return '';
      if (p === 'pagar' && !s.dividir && s.forma !== 'dinheiro') return '';
      if (p === 'conferir') return '<button type="button" class="cxw-prim" data-cxw-registrar' + (s.enviando ? ' disabled' : '') + '>' + (s.enviando ? 'Registrando…' : 'Registrar venda · ' + cfg.preco(total())) + '</button>';
      var rotulo = p === 'itens' ? (s.carrinho.length ? 'Continuar · ' + cfg.preco(total()) : 'Toque no que foi vendido') : 'Continuar';
      return '<button type="button" class="cxw-prim" data-cxw-avancar' + (podeAvancar() ? '' : ' disabled') + '>' + rotulo + '</button>';
    }
    function atualizarRodape() { pe.innerHTML = rodape(); pe.classList.toggle('vazio', !pe.innerHTML); }

    var sentido = 1;
    function desenhar(foco) {
      var p = passos[s.i];
      var html = s.pronto ? telaPronto() : (p === 'itens' ? telaItens() : p === 'quem' ? telaQuem() : p === 'pagar' ? telaPagar() : p === 'cliente' ? telaCliente() : telaConferir());
      corpo.innerHTML = html;
      corpo.className = 'cxw-corpo ' + (foco === 'mesma' ? '' : (sentido > 0 ? 'vem-dir' : 'vem-esq'));
      raiz.querySelector('[data-cxw-voltar]').style.visibility = (s.i === 0 || s.pronto) ? 'hidden' : 'visible';
      raiz.querySelector('[data-cxw-conta]').textContent = s.pronto ? '' : 'Passo ' + (s.i + 1) + ' de ' + passos.length;
      raiz.querySelector('[data-cxw-barra]').style.width = (s.pronto ? 100 : ((s.i + 1) / passos.length) * 100) + '%';
      atualizarRodape();
    }
    function ir(delta) { sentido = delta; s.i = Math.max(0, Math.min(passos.length - 1, s.i + delta)); s.erro = ''; desenhar(); focar(); }
    function focar() {
      var alvo = corpo.querySelector('#cxwNome, #cxwAvDesc');
      if (alvo && passos[s.i] === 'cliente') setTimeout(function () { alvo.focus(); }, 260);
    }
    function fechar() {
      raiz.classList.remove('on');
      document.documentElement.classList.remove('cxw-aberto');
      setTimeout(function () { raiz.remove(); }, 220);
      document.removeEventListener('keydown', teclas);
    }
    function teclas(e) { if (e.key === 'Escape') fechar(); }
    document.addEventListener('keydown', teclas);

    /* ---------- registrar: as mesmas chamadas de antes, uma por item (ou por forma, se dividiu) ---------- */
    function registrar() {
      if (s.enviando) return;
      s.enviando = true; s.erro = ''; atualizarRodape();
      var comuns = Object.assign({}, cfg.base, {
        p_staff_id: s.staff ? s.staff.id : null, p_staff_nome: s.staff ? s.staff.nome : null,
        p_cliente_nome: s.nome.trim() || null, p_cliente_telefone: s.tel.trim() || null
      });
      var chamadas;
      if (!s.dividir) {
        chamadas = s.carrinho.map(function (x) {
          return Object.assign({}, comuns, { p_descricao: (x.qtd > 1 ? x.qtd + 'x ' : '') + x.nome, p_valor: arred(x.preco * x.qtd), p_forma_pagamento: s.forma, p_servico_id: x.servicoId || null });
        });
      } else {
        var v1 = numero(s.valor1), conjunta = s.carrinho.map(function (x) { return (x.qtd > 1 ? x.qtd + 'x ' : '') + x.nome; }).join(', ');
        chamadas = [[s.forma, v1], [s.forma2, arred(total() - v1)]].map(function (t) {
          return Object.assign({}, comuns, { p_descricao: conjunta, p_valor: t[1], p_forma_pagamento: t[0], p_servico_id: null });
        });
      }
      var offline = false;
      chamadas.reduce(function (fila, params) {
        return fila.then(function (erroAntes) {
          if (erroAntes) return erroAntes;
          return cfg.enviar(params).then(function (r) { if (r && r.offline) { offline = true; return null; } return (r && r.res && r.res.error) || null; });
        });
      }, Promise.resolve(null)).then(function (erro) {
        s.enviando = false;
        if (erro) { s.erro = erro.message || 'Não deu pra registrar. Tente de novo.'; desenhar('mesma'); return; }
        s.pronto = true; s.offline = offline; s.totalFeito = total(); s.pagFeito = pagamentoTexto();
        desenhar();
        if (cfg.aoTerminar) cfg.aoTerminar();
      }, function () { s.enviando = false; s.erro = 'Não deu pra registrar. Tente de novo.'; desenhar('mesma'); });
    }

    /* ---------- toques ---------- */
    raiz.addEventListener('click', function (e) {
      var t = e.target;
      var q = function (sel) { return t.closest(sel); };
      var el;
      if (q('[data-cxw-fechar]')) return fechar();
      if (q('[data-cxw-voltar]')) return ir(-1);
      if (q('[data-cxw-nova]')) { zerar(); sentido = -1; desenhar(); return; }
      if (q('[data-cxw-registrar]')) return registrar();
      if (q('[data-cxw-avancar]')) { if (podeAvancar()) ir(1); return; }
      if (q('[data-cxw-pular]')) { if (passos[s.i] === 'quem') s.staff = null; if (passos[s.i] === 'cliente') { s.nome = ''; s.tel = ''; } return ir(1); }

      if ((el = q('[data-cxw-menos]'))) { e.stopPropagation(); var k = el.getAttribute('data-cxw-menos'); mexer(k, '', 0, null, -1); return desenhar('mesma'), atualizarRodape(); }
      if ((el = q('[data-cxw-item]'))) {
        var id = el.getAttribute('data-cxw-item');
        var sv = (cfg.servicos || []).filter(function (x) { return String(x.id) === id; })[0];
        if (sv) mexer(id, sv.nome, Number(sv.preco) || 0, sv.id, 1); else mexer(id, '', 0, null, 1);
        return desenhar('mesma');
      }
      if (q('[data-cxw-avulso-ok]')) {
        var d = corpo.querySelector('#cxwAvDesc').value.trim(), v = numero(corpo.querySelector('#cxwAvValor').value);
        if (!d || !(v > 0)) { corpo.querySelector(d ? '#cxwAvValor' : '#cxwAvDesc').focus(); return; }
        var key = 'avulso-' + (++avulsoSeq);
        s.carrinho.push({ key: key, nome: d, preco: v, qtd: 1, servicoId: null });
        s.avulso = false; return desenhar('mesma');
      }
      if (q('[data-cxw-avulso]')) { s.avulso = !s.avulso; desenhar('mesma'); if (s.avulso) corpo.querySelector('#cxwAvDesc').focus(); return; }

      if ((el = q('[data-cxw-staff]'))) {
        var sid = el.getAttribute('data-cxw-staff');
        s.staff = (cfg.equipe || []).filter(function (p) { return String(p.id) === sid; })[0] || null;
        desenhar('mesma'); return void setTimeout(function () { ir(1); }, 200);
      }
      if ((el = q('[data-cxw-forma]'))) {
        s.forma = el.getAttribute('data-cxw-forma'); s.recebido = '';
        if (s.forma === 'dinheiro') return desenhar('mesma');
        desenhar('mesma'); return void setTimeout(function () { ir(1); }, 200);
      }
      if ((el = q('[data-cxw-rec]'))) { s.recebido = String(el.getAttribute('data-cxw-rec')).replace('.', ','); return desenhar('mesma'); }
      if (q('[data-cxw-dividir]')) { s.dividir = !s.dividir; s.forma = s.dividir ? (s.forma || formas[0].chave) : null; s.forma2 = null; s.valor1 = ''; return desenhar('mesma'); }
      if ((el = q('[data-cxw-forma1]'))) { s.forma = el.getAttribute('data-cxw-forma1'); return desenhar('mesma'); }
      if ((el = q('[data-cxw-forma2]'))) { s.forma2 = el.getAttribute('data-cxw-forma2'); return desenhar('mesma'); }
    });

    // digitar não redesenha a tela (senão o teclado fecha): só atualiza o que depende do valor
    raiz.addEventListener('input', function (e) {
      var id = e.target.id;
      if (id === 'cxwV1') {
        s.valor1 = e.target.value;
        var v1 = numero(s.valor1), r = corpo.querySelector('#cxwResto');
        if (r) r.textContent = v1 > 0 && v1 < total() ? 'Resto: ' + cfg.preco(arred(total() - v1)) : 'O resto aparece aqui';
        atualizarRodape();
      } else if (id === 'cxwRec') {
        s.recebido = e.target.value;
        var rec = numero(s.recebido), tr = arred(rec - total()), el = corpo.querySelector('#cxwTroco');
        if (el) { el.textContent = rec ? (tr >= 0 ? 'Troco: ' + cfg.preco(tr) : 'Faltam ' + cfg.preco(-tr)) : ''; el.classList.toggle('erro', !!rec && tr < 0); }
      } else if (id === 'cxwNome') s.nome = e.target.value;
      else if (id === 'cxwTel') s.tel = e.target.value;
    });
    raiz.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'cxwAvDesc') { e.preventDefault(); corpo.querySelector('#cxwAvValor').focus(); }
      else if (e.target.id === 'cxwAvValor') { e.preventDefault(); corpo.querySelector('[data-cxw-avulso-ok]').click(); }
      else if (e.target.id === 'cxwNome') { e.preventDefault(); corpo.querySelector('#cxwTel').focus(); }
      else if (e.target.id === 'cxwTel') { e.preventDefault(); if (podeAvancar()) ir(1); }
      else if (e.target.hasAttribute && e.target.hasAttribute('data-cxw-item') && (e.key === 'Enter')) e.target.click();
    });

    desenhar();
    return { fechar: fechar };
  }

  global.VBCaixaPasso = { abrir: abrir };
})(window);
