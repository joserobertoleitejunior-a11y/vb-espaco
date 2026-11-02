// Roteamento das páginas públicas de cada estabelecimento (/:slug/:cidade e
// /:slug/:cidade/institucional). O arquivo _redirects (formato Netlify) não
// é interpretado da mesma forma pelo Cloudflare Workers — em vez de manter a
// URL e trocar o conteúdo (rewrite), ele estava mudando a URL de verdade pra
// /perfil.html sem o slug/cidade, quebrando a busca do estabelecimento. Aqui
// controlamos isso na mão: buscamos o HTML certo via env.ASSETS mas
// devolvemos como resposta da URL original, sem mudar o que aparece na
// barra de endereço.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const partes = url.pathname.split('/').filter(Boolean);

    // com html_handling:"none" (ver comentário acima), o Cloudflare Assets
    // não serve mais index.html sozinho na raiz — sem isso aqui, o próprio
    // link principal do site (a home) não abria.
    if (partes.length === 0) {
      return servirComo(request, env, '/index.html');
    }
    // a lista por área (Explorar) mora na mesma página da splash: trocar de
    // tela não recarrega nada; o endereço /explorar.html?area=… só diz qual abrir
    if (partes.length === 1 && (partes[0] === 'explorar.html' || partes[0] === 'explorar')) {
      return servirComo(request, env, '/index.html');
    }
    if (partes.length === 3 && partes[2] === 'institucional') {
      return servirComo(request, env, '/institucional.html');
    }
    // área Delivery/Serviços do mesmo estabelecimento (loja, chamado, orçamento)
    if (partes.length === 3 && (partes[2] === 'pedir' || partes[2] === 'chamar' || partes[2] === 'orcamento')) {
      return servirComo(request, env, '/pedir.html');
    }
    if (partes.length === 2) {
      return servirComo(request, env, '/perfil.html');
    }
    const resposta = comMolduraPropria(await env.ASSETS.fetch(request));
    // endereço que não existe: página "não achei" da Matriz em vez da tela crua
    if (resposta.status === 404 && (request.headers.get('accept') || '').includes('text/html')) {
      const pagina = await servirComo(request, env, '/404.html');
      return new Response(pagina.body, { status: 404, headers: pagina.headers });
    }
    return resposta;
  }
};

async function servirComo(request, env, caminho) {
  const url = new URL(request.url);
  const urlDoArquivo = new URL(caminho, url.origin);
  const pedidoDoArquivo = new Request(urlDoArquivo.toString(), request);
  return comMolduraPropria(await env.ASSETS.fetch(pedidoDoArquivo));
}

// O painel de pedidos abre dentro do painel de gestão, e a prévia do editor abre
// dentro da página de edição — as duas são janelinhas do próprio site. Com
// X-Frame-Options: DENY o navegador recusava a conexão e a área ficava em branco.
// frame-ancestors 'self' libera só o próprio site e continua barrando os outros.
function comMolduraPropria(resposta) {
  const h = new Headers(resposta.headers);
  h.set('X-Frame-Options', 'SAMEORIGIN');
  const csp = h.get('Content-Security-Policy');
  if (!csp) h.set('Content-Security-Policy', "frame-ancestors 'self'");
  else if (!/frame-ancestors/i.test(csp)) h.set('Content-Security-Policy', csp + "; frame-ancestors 'self'");
  return new Response(resposta.body, { status: resposta.status, statusText: resposta.statusText, headers: h });
}
