/* Service worker da Matriz — deixa o "casco" do app (HTML/CSS/JS)
   abrir mesmo sem internet, pra quem já instalou como app conseguir
   trabalhar (caixa, agenda) offline. NUNCA mexe em chamada pro
   Supabase nem pro CDN — essas sempre vão direto pra rede, sem cache,
   porque são dado vivo (uma venda em cache seria uma venda errada). O
   que fica pendente offline é guardado à parte, em IndexedDB, por
   vb-offline.js — este arquivo só cuida do "casco" carregar.

   Bump o número da versão sempre que mudar a lista de arquivos aqui
   embaixo — isso descarta o cache antigo e busca tudo de novo. */
var VERSAO = 'vb-cache-v53';

// cache dos arquivos com ?v= e das imagens: o nome muda a cada versão, então
// não precisa jogar fora a cada atualização (antes tudo era baixado de novo
// a cada publicação). Fica com no máximo LIMITE_ARQUIVOS itens.
var ARQUIVOS = 'vb-arquivos-1';
var LIMITE_ARQUIVOS = 400;

// só o mínimo pra abrir sem internet (as páginas que o app instalado usa)
var CASCO = [
  '/',
  '/index.html',
  '/cadastro.html',
  '/manifest.json',
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
      return Promise.all(chaves.filter(function (k) { return k !== VERSAO && k !== ARQUIVOS; }).map(function (k) { return caches.delete(k); }));
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

// o cache dos arquivos não cresce pra sempre: tira os mais antigos
var aparando = false;
function aparar(cache) {
  if (aparando) return;
  aparando = true;
  cache.keys().then(function (chaves) {
    var sobra = chaves.length - LIMITE_ARQUIVOS;
    return Promise.all(chaves.slice(0, Math.max(0, sobra)).map(function (k) { return cache.delete(k); }));
  }).then(function () { aparando = false; }, function () { aparando = false; });
}

self.addEventListener('fetch', function (evento) {
  var req = evento.request;
  if (req.method !== 'GET') return; // POST/PUT (vendas, agendamentos etc.) nunca passa por aqui
  var url = new URL(req.url);
  if (ehApi(url)) return; // API/CDN/fonte: sempre rede, nunca cache

  // Página (HTML) e arquivo sem ?v=: rede primeiro — o que está no ar é
  // sempre o que aparece; o cache só entra sem internet. Antes era "cache
  // primeiro", e isso mostrava o layout da versão anterior até recarregar.
  // Arquivo versionado (?v=) e imagem: cache primeiro (o nome muda a cada
  // versão, então o que está guardado nunca fica velho).
  var versionado = url.origin === self.location.origin && /[?&]v=/.test(url.search);
  var imagem = req.destination === 'image' || req.destination === 'font';
  if (versionado || imagem) {
    var guardar = function (resposta) {
      if (resposta && resposta.ok && resposta.type !== 'opaque') { var copia = resposta.clone(); caches.open(ARQUIVOS).then(function (c) { c.put(req, copia).then(function () { aparar(c); }); }); }
      return resposta;
    };
    evento.respondWith(
      caches.match(req).then(function (emCache) {
        // imagem sem ?v= (fotos prontas, ícones): mostra a guardada e já
        // confere a do servidor por trás, pra trocar se mudou
        if (emCache && !versionado) evento.waitUntil(fetch(req).then(guardar).catch(function () {}));
        return emCache || fetch(req).then(guardar);
      })
    );
    return;
  }
  evento.respondWith(
    fetch(req).then(function (resposta) {
      if (resposta && resposta.ok && url.origin === self.location.origin) {
        var copia = resposta.clone();
        caches.open(VERSAO).then(function (cache) { cache.put(req, copia); });
      }
      return resposta;
    }).catch(function () {
      // offline: o que tiver guardado; página nunca vista cai no "casco" da home
      return caches.match(req).then(function (emCache) {
        if (emCache) return emCache;
        if (req.mode === 'navigate') return caches.match('/index.html');
        return Promise.reject('offline-sem-cache');
      });
    })
  );
});
