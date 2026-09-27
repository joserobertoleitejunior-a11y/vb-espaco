/* Plataforma VB — transição entre os apps (Agenda, Delivery, …).
   Mesmo login (auth.users) pra todos; a lista de apps e a URL de cada um
   vêm da tabela vb_apps (vb_apps_publico), então trocar domínio não exige
   mexer em código. App sem URL configurada simplesmente não aparece.
   Arquivo idêntico no vb-espaco e no vb-delivery. */
(function (global) {
  'use strict';

  var cache = null;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function carregar() {
    if (cache) return cache;
    if (!global.db) return { apps: [], negocios: [] };
    var r = await Promise.all([global.db.rpc('vb_apps_publico'), global.db.rpc('vb_meus_negocios')]);
    cache = { apps: (r[0] && r[0].data) || [], negocios: (r[1] && r[1].data) || [] };
    return cache;
  }

  function urlDoApp(apps, chave) {
    var a = apps.find(function (x) { return x.chave === chave; });
    return a && a.url ? a.url.replace(/\/+$/, '') : null;
  }

  /* Monta a lista "Meus negócios VB" num container.
     appAtual: 'agenda' | 'delivery'; aoEscolherLocal(negocio) é chamado
     quando o negócio é do próprio app (troca sem sair da página). */
  async function montarMenu(container, appAtual, idAtual, aoEscolherLocal) {
    if (!container) return;
    var dados = await carregar();
    var nomesApp = {};
    dados.apps.forEach(function (a) { nomesApp[a.chave] = a.nome; });
    var visiveis = dados.negocios.filter(function (n) { return n.app === appAtual || urlDoApp(dados.apps, n.app); });
    var outrosApps = dados.apps.filter(function (a) {
      return a.ativo && a.chave !== appAtual && a.url && !dados.negocios.some(function (n) { return n.app === a.chave; });
    });
    var html = '';
    if (visiveis.length) {
      html += '<p class="drawer-rotulo">Meus negócios VB</p>';
      html += visiveis.map(function (n) {
        var atual = n.app === appAtual && n.id === idAtual;
        return '<button type="button" class="drawer-link" data-vb-negocio="' + esc(n.app + ':' + n.id) + '"' + (atual ? ' aria-current="true"' : '') + '>' +
          '<span>' + esc(n.nome) + (atual ? ' <small>(aberto)</small>' : '') + '</span>' +
          '<span class="app-tag">' + esc((nomesApp[n.app] || n.app).replace('VB ', '')) + '</span></button>';
      }).join('');
    }
    if (outrosApps.length) {
      html += '<p class="drawer-rotulo">Conheça também</p>';
      html += outrosApps.map(function (a) {
        return '<a class="drawer-link" href="' + esc(urlDoApp(dados.apps, a.chave) + '/') + '"><span>' + esc(a.nome) +
          '<br><small>' + esc(a.descricao || '') + '</small></span></a>';
      }).join('');
    }
    container.innerHTML = html;
    container.querySelectorAll('[data-vb-negocio]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var partes = btn.getAttribute('data-vb-negocio').split(':');
        var negocio = dados.negocios.find(function (n) { return n.app === partes[0] && n.id === partes[1]; });
        if (!negocio) return;
        if (negocio.app === appAtual) { if (aoEscolherLocal) aoEscolherLocal(negocio); return; }
        var base = urlDoApp(dados.apps, negocio.app);
        if (base) global.location.href = base + '/cadastro.html?loja=' + encodeURIComponent(negocio.id);
      });
    });
  }

  global.VBPlataforma = { carregar: carregar, montarMenu: montarMenu, urlDoApp: urlDoApp };
})(window);
