/* Service worker do VB Agenda — deixa o "casco" do app (HTML/CSS/JS)
   abrir mesmo sem internet, pra quem já instalou como app conseguir
   trabalhar (caixa, agenda) offline. NUNCA mexe em chamada pro
   Supabase nem pro CDN — essas sempre vão direto pra rede, sem cache,
   porque são dado vivo (uma venda em cache seria uma venda errada). O
   que fica pendente offline é guardado à parte, em IndexedDB, por
   vb-offline.js — este arquivo só cuida do "casco" carregar.

   Bump o número da versão sempre que mudar a lista de arquivos aqui
   embaixo — isso descarta o cache antigo e busca tudo de novo. */
var VERSAO = 'vb-cache-v2';

var CASCO = [
  '/',
  '/index.html',
  '/cadastro.html',
  '/editar.html',
  '/manifest.json',
  '/assets/css/styles.css',
  '/assets/js/supabase-client.js',
  '/assets/js/cadastro.js',
  '/assets/js/editar.js',
  '/assets/js/vb-select.js',
  '/assets/js/vb-dialogo.js',
  '/assets/js/vb-offline.js',
  '/assets/js/upload-fotos.js',
  '/assets/js/vb-status.js',
  '/assets/js/catalogo.js',
  '/assets/js/vb-cliente-global.js',
  '/assets/js/meus-agendamentos.js',
  '/assets/js/vb-cliente-global-index.js',
  '/assets/img/favicon.svg',
  '/assets/img/icons/icon-192.png',
  '/assets/img/icons/icon-512.png'
];

self.addEventListener('install', function (evento) {
  self.skipWaiting();
  evento.waitUntil(
    caches.open(VERSAO).then(function (cache) {
      // addAll falha inteiro se UM arquivo da lista não existir — melhor
      // adicionar um por um e seguir em frente mesmo se algum faltar.
      return Promise.all(CASCO.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (chaves) {
      return Promise.all(chaves.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function ehApi(url) {
  return url.hostname.indexOf('supabase.co') > -1
    || url.hostname.indexOf('jsdelivr.net') > -1
    || url.hostname.indexOf('googleapis.com') > -1
    || url.hostname.indexOf('gstatic.com') > -1
    || url.hostname.indexOf('nominatim.openstreetmap.org') > -1;
}

self.addEventListener('fetch', function (evento) {
  var req = evento.request;
  if (req.method !== 'GET') return; // POST/PUT (vendas, agendamentos etc.) nunca passa por aqui
  var url = new URL(req.url);
  if (ehApi(url)) return; // API/CDN/fonte: sempre rede, nunca cache

  // stale-while-revalidate: responde rápido com o que já tem em cache
  // (ou espera a rede se for a primeira vez) e atualiza o cache por
  // trás pra próxima visita, sem travar a tela esperando isso.
  evento.respondWith(
    caches.match(req).then(function (emCache) {
      var buscaRede = fetch(req).then(function (resposta) {
        if (resposta && resposta.ok) {
          var copia = resposta.clone();
          caches.open(VERSAO).then(function (cache) { cache.put(req, copia); });
        }
        return resposta;
      }).catch(function () {
        // offline e essa página nunca foi visitada/cacheada antes: cai
        // pro "casco" da home em vez de deixar o navegador mostrar a
        // tela de erro dele (ERR_FAILED) — pelo menos abre o app.
        if (emCache) return emCache;
        if (req.mode === 'navigate') return caches.match('/index.html');
        return Promise.reject('offline-sem-cache');
      });
      return emCache || buscaRede;
    })
  );
});
