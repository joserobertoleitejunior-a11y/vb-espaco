/* Roda DENTRO do iframe de pré-visualização do passo a passo de criação
   (preview-embutido.html) — não fala com o Supabase, só recebe o estado
   atual do formulário via postMessage e re-renderiza a página igualzinha
   ao site de verdade (mesmo CSS de template, mesmas classes). */
(function () {
  var TEMPLATE_PASTAS = {
    'classico-boiserie': 'tpl-classico',
    'claro-minimal': 'tpl-claro',
    'escuro-premium': 'tpl-escuro',
    'automotivo-carbono': 'tpl-automotivo'
  };

  var COPY = {
    masculino: { headline: 'Seu estilo, sem complicação.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
    feminino: { headline: 'Sua beleza merece hora marcada.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' },
    ambos: { headline: 'Seu estilo, sem complicação.', sub: 'Agende seu horário com poucos toques — escolha o serviço e o dia que preferir.' }
  };

  var SEGMENTOS = {
    barbearia: 'Barbearia',
    salao: 'Salão de beleza',
    manicure_pedicure: 'Manicure e pedicure',
    estetica: 'Estética',
    estetica_automotiva: 'Estética automotiva',
    outro: 'Estabelecimento'
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function boiseriePlaceholder(corHex) {
    var cor = (corHex || '#C9A227').replace('#', '');
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect x='9' y='9' width='54' height='54' rx='6' fill='none' stroke='%23" + cor + "' stroke-opacity='0.4' stroke-width='1.6'/%3E%3Crect x='18' y='18' width='36' height='36' rx='3' fill='none' stroke='%23" + cor + "' stroke-opacity='0.4' stroke-width='1.1'/%3E%3C/svg%3E";
  }

  function hexParaRgbNums(hex) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16) || 0, parseInt(h.substr(2, 2), 16) || 0, parseInt(h.substr(4, 2), 16) || 0];
  }
  function misturarRgb(rgb, alvo, quantidade) {
    return rgb.map(function (c, i) { return Math.round(c + (alvo[i] - c) * quantidade); });
  }
  function rgbParaHex(rgb) {
    return '#' + rgb.map(function (c) {
      return Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
    }).join('');
  }
  function aplicarCorDinamica(cor, corSecundaria) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(cor || '')) return;
    var rgb = hexParaRgbNums(cor);
    var corSecundariaValida = /^#[0-9A-Fa-f]{6}$/.test(corSecundaria || '');
    var escuro = corSecundariaValida ? corSecundaria : rgbParaHex(misturarRgb(rgb, [0, 0, 0], 0.28));
    var claro = rgbParaHex(misturarRgb(rgb, [255, 255, 255], 0.42));
    var estilo = document.getElementById('tplCorDinamica');
    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = 'tplCorDinamica';
      document.head.appendChild(estilo);
    }
    if (TEMPLATES_COM_TERRACOTTA.indexOf(templateAtual) > -1) {
      estilo.textContent = ':root{--terracotta:' + cor + '; --terracotta-deep:' + escuro + '; --terracotta-claro:' + claro + '; --terracotta-rgb:' + rgb.join(',') + ';}';
    } else {
      estilo.textContent = ':root{--dourado:' + cor + '; --dourado-escuro:' + escuro + '; --dourado-claro:' + claro + '; --dourado-rgb:' + rgb.join(',') + ';}';
    }
  }

  var TEMPLATES_COM_TERRACOTTA = ['claro-minimal', 'escuro-premium', 'automotivo-carbono'];
  var templateAtual = null;
  function aplicarTemplateCss(templateKey) {
    if (templateKey === templateAtual) return;
    templateAtual = templateKey;
    var pasta = TEMPLATE_PASTAS[templateKey] || 'tpl-classico';
    document.getElementById('tplBase').href = '/assets/' + pasta + '/css/base.css?v=4';
    document.getElementById('tplFeminino').href = '/assets/' + pasta + '/css/feminino.css?v=3';
  }

  function renderizar(estado) {
    estado = estado || {};
    aplicarTemplateCss(estado.template || 'classico-boiserie');

    var genero = estado.genero_atendimento || 'ambos';
    document.getElementById('tplFeminino').disabled = (genero !== 'feminino');

    document.getElementById('tplNomeTopo').textContent = estado.nome || 'Seu estabelecimento';
    var segmentoLabel = SEGMENTOS[estado.segmento] || 'Estabelecimento';
    document.getElementById('tplEyebrow').textContent = segmentoLabel + (estado.cidade ? ' · ' + estado.cidade : '');

    var copy = COPY[genero] || COPY.ambos;
    document.getElementById('tplHeadline').textContent = estado.titulo_hero || copy.headline;
    document.getElementById('tplSubcopy').textContent = estado.subtitulo_hero || copy.sub;
    document.getElementById('tplCtaTexto').textContent = estado.texto_cta || 'Agendar horário';

    var cor = estado.cor_destaque || '#C9A227';
    aplicarCorDinamica(cor, estado.cor_secundaria);

    var heroFoto = document.getElementById('tplHeroFoto');
    var fotoHero = genero === 'feminino' ? (estado.foto_hero_feminino_url || estado.foto_hero_url) : estado.foto_hero_url;
    heroFoto.style.backgroundColor = 'var(--linen-deep)';
    if (fotoHero) {
      heroFoto.style.backgroundImage = 'url("' + fotoHero + '")';
      heroFoto.style.backgroundSize = 'cover';
    } else {
      heroFoto.style.backgroundImage = 'url("' + boiseriePlaceholder(cor) + '")';
      heroFoto.style.backgroundSize = '72px 72px';
    }
  }

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.tipo !== 'vb-preview-estado') return;
    renderizar(e.data.estado);
  });

  if (window.parent) window.parent.postMessage({ tipo: 'vb-preview-pronto' }, '*');
})();
