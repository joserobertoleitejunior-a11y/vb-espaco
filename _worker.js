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

    if (partes.length === 3 && partes[2] === 'institucional') {
      return servirComo(request, env, '/institucional.html');
    }
    if (partes.length === 2) {
      return servirComo(request, env, '/perfil.html');
    }
    return env.ASSETS.fetch(request);
  }
};

async function servirComo(request, env, caminho) {
  const url = new URL(request.url);
  const urlDoArquivo = new URL(caminho, url.origin);
  const pedidoDoArquivo = new Request(urlDoArquivo.toString(), request);
  return env.ASSETS.fetch(pedidoDoArquivo);
}
