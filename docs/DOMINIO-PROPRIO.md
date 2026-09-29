# Passo a passo pra trocar pro domínio próprio

Hoje o site vive em `vb-espaco.joserobertoleitejunior.workers.dev`. Quando o
domínio for comprado (ex: `pertin.com.br`), fazer nesta ordem:

## 1. Cloudflare (você)
1. Se o domínio foi comprado fora da Cloudflare, adicione-o em
   **Websites → Add a site** e troque os nameservers no registrador pelos
   que a Cloudflare mostrar (demora de minutos a ~24h pra propagar).
2. **Workers & Pages → vb-espaco → Settings → Domains & Routes → Add → Custom domain**
   e digite o domínio. A Cloudflare emite o certificado SSL sozinha.
3. Confira que `vb-espaco.joserobertoleitejunior.workers.dev` continua
   funcionando em paralelo (não precisa remover) — evita link quebrado
   enquanto o DNS novo propaga.

## 2. Código (uma linha, eu faço quando avisar)
Troca todas as menções ao domínio antigo por padrão, num comando só:
```
sed -i 's#vb-espaco\.joserobertoleitejunior\.workers\.dev#SEUDOMINIO.com.br#g' \
  index.html cadastro.html parceiros.html termos.html sitemap.xml robots.txt
```
Isso atualiza: canonical, Open Graph/Twitter card, JSON-LD, sitemap.xml e
robots.txt. `manifest.json` já usa caminho relativo (`/`), não precisa mexer.

## 3. Supabase (você — painel do projeto `oeracgvnuomcaydmizzj`)
**Authentication → URL Configuration:**
- **Site URL**: troca pro domínio novo.
- **Redirect URLs**: adiciona `https://SEUDOMINIO.com.br/**` (mantém a do
  Workers até confirmar que tudo migrou).

## 4. Google Cloud Console (você — login com Google)
Se o login com Google (`docs/LOGIN-SUPABASE-GOOGLE.md`) já estiver configurado:
**APIs e Serviços → Credenciais → ID do cliente OAuth** → em
**URIs de redirecionamento autorizados**, adiciona a URL de callback do
Supabase (`https://oeracgvnuomcaydmizzj.supabase.co/auth/v1/callback`) —
essa já deveria estar lá desde a configuração inicial, não muda com o
domínio. O que muda é qualquer **Origens JavaScript autorizadas** que
aponte pro domínio do site, se você tiver adicionado uma.

## 5. Depois de tudo no ar
- Teste em aba anônima: abrir o domínio novo, cadastrar um negócio de
  teste, fazer login com Google, confirmar que o link de cada
  estabelecimento (`/:slug/:cidade`) funciona.
- Google Search Console: adiciona a propriedade do domínio novo e envia o
  `sitemap.xml`.
- Se for anunciar o link em algum lugar (WhatsApp, Instagram), usa sempre
  o domínio novo a partir daqui.

## Pendente antes de comprar
Confirmar no registrador (registro.br ou similar) que o nome escolhido
está livre — ver sugestões na conversa (ex: `pertin.com.br`, `pertin.app`).
