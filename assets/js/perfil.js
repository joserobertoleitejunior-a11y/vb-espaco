/* Página pública /:slug/:cidade — o link que cada dono recebe e
   compartilha com os clientes dele. Lê os dois pedaços do caminho da
   URL (o Netlify reescreve pra /perfil.html mantendo a URL original —
   ver _redirects) e busca via RPC pública buscar_estabelecimento. */
(function () {
  if (!window.db) return;

  var partes = window.location.pathname.split('/').filter(Boolean);
  var slug = partes[0];
  var cidade = partes[1];

  var carregando = document.getElementById('carregando');
  var naoEncontrado = document.getElementById('naoEncontrado');
  var perfil = document.getElementById('perfil');

  if (!slug || !cidade) {
    carregando.classList.add('oculto');
    naoEncontrado.classList.remove('oculto');
    return;
  }

  function mostrarNaoEncontrado() {
    carregando.classList.add('oculto');
    naoEncontrado.classList.remove('oculto');
  }

  function renderizar(linha) {
    carregando.classList.add('oculto');

    var segmentos = {
      barbearia: 'Barbearia',
      salao: 'Salão de beleza',
      manicure_pedicure: 'Manicure e pedicure',
      estetica: 'Estética',
      outro: 'Estabelecimento'
    };

    document.title = linha.nome + ' — VB Agenda';
    document.getElementById('perfilSegmento').textContent = segmentos[linha.segmento] || 'Estabelecimento';
    document.getElementById('perfilNome').textContent = linha.nome;
    document.getElementById('perfilCidade').textContent = linha.cidade.charAt(0).toUpperCase() + linha.cidade.slice(1);
    document.getElementById('perfilHeader').style.background = linha.cor_destaque || '#C9A227';

    if (linha.telefone_whatsapp) {
      var btn = document.getElementById('whatsappBtn');
      btn.href = 'https://wa.me/55' + linha.telefone_whatsapp.replace(/\D/g, '');
      btn.classList.remove('oculto');
    }

    perfil.classList.remove('oculto');
  }

  db.rpc('buscar_estabelecimento', { p_slug: slug, p_cidade: cidade }).then(function (res) {
    var linha = res.data && res.data[0];
    if (res.error || !linha) {
      mostrarNaoEncontrado();
      return;
    }
    renderizar(linha);
  }, mostrarNaoEncontrado);
})();
