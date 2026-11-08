/* Painel do criador (criadores.html): catálogo de serviços e preços + IA (roteiro, legenda, proposta, preço).
   VBCriadorPainel.montar(elemento) — usa window.db. */
(function (global) {
  'use strict';
  var USO = { organico: 'Só orgânico (meu perfil)', anuncio: 'Pode virar anúncio pago', exclusivo: 'Exclusivo do cliente' };
  var TIPOS = { fixo: 'Preço fixo', a_partir: 'A partir de', orcamento: 'Sob orçamento' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function reais(n) { return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ','); }
  function precoTxt(s) { return s.tipo_preco === 'orcamento' ? 'Sob orçamento' : (s.tipo_preco === 'a_partir' ? 'a partir de ' : '') + reais(s.preco); }

  function montar(raiz, criador) {
    var servicos = [];
    raiz.innerHTML =
      '<section class="cr-cartao"><h2>Meus serviços e preços</h2><p style="margin-top:0;font-size:.88rem">É o seu catálogo: o que você vende, quanto custa, em quanto tempo entrega e o que o cliente pode fazer com o vídeo.</p>' +
      '<div id="cpLista"></div><div id="cpForm"></div><button type="button" id="cpNovo" class="cr-sec">+ Novo serviço</button></section>' +
      '<section class="cr-cartao"><h2>IA do criador</h2><div class="cp-abas" id="cpAbas"></div><div id="cpCampos"></div>' +
      '<button type="button" id="cpGerar">Gerar</button><div class="cr-msg" id="cpMsg"></div>' +
      '<div id="cpSaida" class="cp-saida" hidden></div><p class="cp-cred" id="cpCred"></p></section>';
    var $ = function (i) { return raiz.querySelector('#' + i); };

    /* ---------- catálogo ---------- */
    function listar() {
      db.rpc('criador_servicos_listar').then(function (r) {
        servicos = r.data || [];
        $('cpLista').innerHTML = servicos.length ? '<table>' + servicos.map(function (s, i) {
          return '<tr><td><b>' + esc(s.nome) + '</b><br><small style="color:#6b6d75">' + precoTxt(s) + (s.prazo_dias ? ' · ' + s.prazo_dias + ' dias' : '') + ' · ' + esc(USO[s.uso]) + '</small></td>' +
            '<td><button type="button" class="cr-mini" data-ed="' + i + '">Editar</button></td></tr>';
        }).join('') + '</table>' : '<p style="margin:.2rem 0 .6rem;color:#6b6d75">Nenhum serviço ainda. Exemplo: "Reels de 30 s — R$ 250".</p>';
        desenharProposta();
      });
    }
    $('cpLista').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ed]'); if (b) formulario(servicos[+b.getAttribute('data-ed')]);
    });
    $('cpNovo').onclick = function () { formulario(null); };
    function formulario(s) {
      s = s || { tipo_preco: 'fixo', uso: 'organico' };
      $('cpNovo').hidden = true;
      $('cpForm').innerHTML = '<div class="cp-form"><input id="fNome" placeholder="Nome (ex.: Reels de 30 s)" maxlength="80" value="' + esc(s.nome) + '">' +
        '<select id="fTipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '"' + (s.tipo_preco === k ? ' selected' : '') + '>' + TIPOS[k] + '</option>'; }).join('') + '</select>' +
        '<input id="fPreco" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Preço em R$" value="' + (s.preco == null ? '' : s.preco) + '">' +
        '<input id="fPrazo" type="number" inputmode="numeric" min="1" max="90" placeholder="Prazo de entrega (dias)" value="' + (s.prazo_dias || '') + '">' +
        '<select id="fUso">' + Object.keys(USO).map(function (k) { return '<option value="' + k + '"' + (s.uso === k ? ' selected' : '') + '>' + USO[k] + '</option>'; }).join('') + '</select>' +
        '<input id="fDesc" placeholder="O que está incluso (opcional)" maxlength="300" value="' + esc(s.descricao) + '">' +
        '<div class="cr-msg" id="fMsg"></div><div class="cp-linha"><button type="button" id="fSalvar">Salvar</button><button type="button" class="cr-sec" id="fCancelar">Cancelar</button>' +
        (s.id ? '<button type="button" class="cr-sec" id="fApagar">Apagar</button>' : '') + '<button type="button" class="cr-sec" id="fIA">Sugerir preço com IA</button></div></div>';
      var f = function (i) { return $(i); };
      function ajusta() { f('fPreco').hidden = f('fTipo').value === 'orcamento'; }
      f('fTipo').onchange = ajusta; ajusta();
      f('fCancelar').onclick = fechar;
      f('fIA').onclick = function () { aba('preco'); var el = $('d_entrega'); if (el) el.value = f('fNome').value; $('cpCampos').scrollIntoView({ behavior: 'smooth' }); };
      if (f('fApagar')) f('fApagar').onclick = function () { if (confirm('Apagar este serviço?')) db.rpc('criador_servico_apagar', { p_id: s.id }).then(function () { fechar(); listar(); }); };
      f('fSalvar').onclick = function () {
        db.rpc('criador_servico_salvar', { p_id: s.id || null, p_nome: f('fNome').value, p_descricao: f('fDesc').value, p_tipo_preco: f('fTipo').value,
          p_preco: f('fPreco').value === '' ? null : Number(f('fPreco').value), p_prazo_dias: f('fPrazo').value === '' ? null : Number(f('fPrazo').value), p_uso: f('fUso').value
        }).then(function (r) { if (r.error) { f('fMsg').textContent = r.error.message; return; } fechar(); listar(); });
      };
    }
    function fechar() { $('cpForm').innerHTML = ''; $('cpNovo').hidden = false; }

    /* ---------- IA ---------- */
    var ABAS = {
      roteiro: { nome: 'Roteiro', campos: [['link', 'Cole o link do site do negócio na Matriz (a IA lê as informações dele)'], ['negocio', 'Nome do negócio'], ['tipo_negocio', 'Tipo (pizzaria, barbearia…)'], ['formato', 'Formato (Reels 30 s, TikTok…)'], ['objetivo', 'Objetivo (mais pedidos, divulgar promoção…)'], ['tom', 'Tom (descontraído, elegante…)'], ['detalhes', 'Detalhes: produtos, promoção, diferenciais', 1]] },
      legenda: { nome: 'Legenda', campos: [['link', 'Cole o link do site do negócio na Matriz (a IA lê as informações dele)'], ['negocio', 'Nome do negócio'], ['rede', 'Rede (Instagram, TikTok…)'], ['sobre', 'Sobre o que é o vídeo', 1], ['tom', 'Tom'], ['cidade', 'Cidade']] },
      proposta: { nome: 'Proposta', campos: [['link', 'Cole o link do site do negócio na Matriz (a IA lê as informações dele)'], ['cliente', 'Nome do negócio (cliente)'], ['observacoes', 'Observações (briefing, datas, pedidos do cliente)', 1]], servicos: true },
      preco: { nome: 'Preço', campos: [['entrega', 'Serviço (ex.: Reels de 30 s)'], ['nicho', 'Nicho (comida, beleza…)'], ['seguidores', 'Seus seguidores (opcional)'], ['cidade', 'Cidade'], ['uso', 'Direito de uso (orgânico, anúncio…)'], ['observacoes', 'Observações', 1]] }
    };
    var atual = 'roteiro';
    function aba(k) {
      atual = k;
      $('cpAbas').innerHTML = Object.keys(ABAS).map(function (x) { return '<button type="button" class="cp-aba' + (x === k ? ' on' : '') + '" data-aba="' + x + '">' + ABAS[x].nome + '</button>'; }).join('');
      $('cpCampos').innerHTML = ABAS[k].campos.map(function (c) {
        return c[2] ? '<textarea id="d_' + c[0] + '" rows="3" placeholder="' + esc(c[1]) + '" maxlength="600"></textarea>' : '<input id="d_' + c[0] + '" placeholder="' + esc(c[1]) + '" maxlength="160">';
      }).join('') + (ABAS[k].servicos ? '<div id="cpServ"></div>' : '');
      if (ABAS[k].campos[0][0] === 'link') { var dica = document.createElement('p'); dica.className = 'cp-dica'; dica.textContent = 'Com o link, o roteiro já sai com o nome, os produtos, os preços e o jeito do negócio. Sem link, preencha os campos abaixo.'; $('cpCampos').insertBefore(dica, $('d_link').nextSibling); }
      if (k === 'proposta') desenharProposta();
      $('cpSaida').hidden = true; $('cpMsg').textContent = '';
    }
    function desenharProposta() {
      var el = $('cpServ'); if (!el) return;
      el.innerHTML = servicos.length ? '<p class="cp-rot">Serviços na proposta</p>' + servicos.map(function (s, i) {
        return '<label class="cp-chk"><input type="checkbox" data-s="' + i + '"> <span>' + esc(s.nome) + ' — ' + precoTxt(s) + '</span></label>';
      }).join('') : '<p style="color:#6b6d75;font-size:.85rem">Cadastre serviços acima para entrarem na proposta.</p>';
    }
    $('cpAbas').addEventListener('click', function (e) { var b = e.target.closest('[data-aba]'); if (b) aba(b.getAttribute('data-aba')); });
    function creditos(u) { if (u) $('cpCred').textContent = 'Créditos de IA: ' + u.usados_mes + ' de ' + u.creditos_mes + ' usados · renova em ' + String(u.renova_em).slice(8, 10) + '/' + String(u.renova_em).slice(5, 7); }
    db.rpc('criador_ia_situacao').then(function (r) { creditos(r.data); });

    $('cpGerar').onclick = function () {
      var btn = this, dados = {};
      ABAS[atual].campos.forEach(function (c) { dados[c[0]] = ($('d_' + c[0]) || {}).value || ''; });
      if (ABAS[atual].servicos) {
        dados.criador = criador.nome;
        dados.servicos = Array.prototype.map.call(raiz.querySelectorAll('#cpServ input:checked'), function (i) {
          var s = servicos[+i.getAttribute('data-s')];
          return { nome: s.nome, preco: precoTxt(s), prazo: s.prazo_dias ? s.prazo_dias + ' dias' : '', uso: USO[s.uso] };
        });
        if (!dados.servicos.length) { $('cpMsg').textContent = 'Marque pelo menos um serviço.'; return; }
      }
      btn.disabled = true; $('cpMsg').textContent = 'Criando…'; $('cpSaida').hidden = true;
      db.functions.invoke('criador-ia', { body: { tipo: atual, dados: dados } }).then(function (x) {
        btn.disabled = false;
        var d = x.data;
        if (d && d.texto) {
          $('cpMsg').textContent = '';
          $('cpSaida').hidden = false;
          $('cpSaida').innerHTML = (d.negocio ? '<p class="cp-rot">Feito com os dados de ' + esc(d.negocio) + '</p>' : '') + '<pre>' + esc(d.texto) + '</pre><button type="button" class="cr-sec" id="cpCopiar">Copiar texto</button>';
          $('cpCopiar').onclick = function () { var b = this; (navigator.clipboard ? navigator.clipboard.writeText(d.texto) : Promise.reject()).then(function () { b.textContent = 'Copiado!'; }, function () { b.textContent = 'Selecione e copie acima'; }); };
          creditos(d.uso);
          return;
        }
        // erro da função: o corpo vem em x.error.context (Response) quando o status não é 2xx
        var ctx = x.error && x.error.context;
        if (ctx && ctx.json) ctx.json().then(function (j) { $('cpMsg').textContent = j.erro || 'Não deu certo agora.'; }, function () { $('cpMsg').textContent = 'Não deu certo agora.'; });
        else $('cpMsg').textContent = (d && d.erro) || 'Não deu certo agora. Tente de novo.';
      }, function () { btn.disabled = false; $('cpMsg').textContent = 'Sem conexão. Tente de novo.'; });
    };
    aba('roteiro'); listar();
  }
  global.VBCriadorPainel = { montar: montar };
})(window);
