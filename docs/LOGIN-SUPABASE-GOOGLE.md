# Login do dono: Supabase Auth + Google (passo a passo)

O login do dono usa o Supabase Auth (projeto `oeracgvnuomcaydmizzj`). No código:

- **Google**: `signInWithOAuth({ provider: 'google', options: { redirectTo: <site>/cadastro.html } })`
- **E-mail e senha**: `signUp(..., { emailRedirectTo: <site>/cadastro.html })`: o link de confirmação do e-mail volta pro login.

`<site>` é sempre o endereço em que a pessoa está, então o mesmo código serve pro endereço atual e pro domínio novo. O Supabase só aceita voltar pra endereços que estão na lista dele. É isso que os passos abaixo configuram.

---

## Parte 1 — Endereços permitidos (Supabase)

1. Abra https://supabase.com/dashboard/project/oeracgvnuomcaydmizzj/auth/url-configuration
2. **Site URL**: `https://vb-espaco.joserobertoleitejunior.workers.dev`
3. Em **Redirect URLs**, clique em **Add URL** e adicione, uma por vez:
   - `https://vb-espaco.joserobertoleitejunior.workers.dev/**`
   - `http://localhost:8941/**` (só pra testes locais; opcional)
4. **Save**.

> Quando comprar o domínio (ex.: `vibe.com.br`), volte aqui: troque a **Site URL** pelo domínio novo e **adicione** `https://vibe.com.br/**` (e `https://www.vibe.com.br/**`). Deixe o endereço `workers.dev` na lista até todo mundo estar usando o domínio.

## Parte 2 — Criar o "cliente OAuth" no Google Cloud

1. Abra https://console.cloud.google.com/ e crie um projeto (ex.: **Vibe**). Se já tiver um, pode usar.
2. Menu **APIs e serviços → Tela de consentimento OAuth** (ou **Google Auth Platform → Branding**):
   - Tipo de usuário: **Externo**
   - Nome do app: **Vibe**; e-mail de suporte: o seu
   - Domínios autorizados: `supabase.co` (e, depois, o seu domínio)
   - Escopos: os padrões (`email`, `profile`, `openid`) — não precisa de mais nada
   - Publique o app (**Publicar app / In production**). Em modo "teste" só entram os e-mails que você cadastrar como testadores.
3. Menu **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**
   - Nome: **Vibe (Supabase)**
   - **Origens JavaScript autorizadas**: `https://vb-espaco.joserobertoleitejunior.workers.dev`
   - **URIs de redirecionamento autorizados**: `https://oeracgvnuomcaydmizzj.supabase.co/auth/v1/callback`
     (é o endereço do Supabase, não o do site — o Google devolve pro Supabase, e o Supabase devolve pro site)
   - **Criar**. Copie o **ID do cliente** e a **Chave secreta do cliente**.

## Parte 3 — Ligar o Google no Supabase

1. Abra https://supabase.com/dashboard/project/oeracgvnuomcaydmizzj/auth/providers
2. Clique em **Google** → ligue **Enable Sign in with Google**.
3. Cole o **Client ID** e o **Client Secret** do passo anterior → **Save**.

> A chave secreta fica só no painel do Supabase. Nunca cole ela no código nem em conversa.

## Parte 4 — Ajustes de segurança recomendados (Supabase)

Em https://supabase.com/dashboard/project/oeracgvnuomcaydmizzj/auth/providers → **Email**:

- **Confirm email**: ligado (quem cria conta por e-mail confirma antes de entrar).
- Em **Auth → Settings / Password security**: ligue **Leaked password protection** (bloqueia senhas que já vazaram na internet — é o único aviso de segurança que o Supabase mostra hoje no projeto).

## Parte 5 — Testar (2 minutos)

1. Numa janela anônima, abra `https://vb-espaco.joserobertoleitejunior.workers.dev/cadastro.html`.
2. **Entrar com Google** → escolha a conta → deve voltar pra `/cadastro.html` já logado.
3. Crie uma conta por e-mail → abra o e-mail de confirmação → o link deve voltar pra `/cadastro.html`.

Se aparecer **"redirect_uri_mismatch"** (tela do Google): o endereço da Parte 2, item 3, está diferente de `https://oeracgvnuomcaydmizzj.supabase.co/auth/v1/callback`.
Se voltar pra página inicial em vez do login, ou der **"Redirect URL not allowed"**: falta o endereço com `/**` na Parte 1.
