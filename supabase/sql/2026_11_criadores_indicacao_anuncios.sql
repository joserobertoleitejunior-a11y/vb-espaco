-- Criadores de conteúdo: indicação com 15% de comissão mensal + locais de anúncio à venda.
-- NÃO aplicado ainda: rodar no SQL Editor (https://supabase.com/dashboard/project/oeracgvnuomcaydmizzj/sql/new).
-- Seguro rodar mais de uma vez. Acesso só por RPC (tabelas sem política).

-- ============ 1) criadores ============
create table if not exists public.criadores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 60),
  codigo text not null unique check (codigo ~ '^[a-z0-9]{4,12}$'),
  cidade text check (cidade is null or char_length(cidade) <= 60),
  instagram text check (instagram is null or char_length(instagram) <= 120),
  tiktok text check (tiktok is null or char_length(tiktok) <= 120),
  youtube text check (youtube is null or char_length(youtube) <= 120),
  percentual numeric(5,2) not null default 15.00 check (percentual between 0 and 50),
  mensalidade numeric(8,2) not null default 4.90,   -- plano barato do criador (cobrança entra depois)
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.criadores enable row level security;

-- ============ 2) indicações: quem trouxe quem (um negócio tem no máximo um criador) ============
create table if not exists public.criador_indicacoes (
  id uuid primary key default gen_random_uuid(),
  criador_id uuid not null references public.criadores(id) on delete cascade,
  estabelecimento_id uuid not null unique references public.estabelecimentos(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists criador_indicacoes_criador_idx on public.criador_indicacoes (criador_id);
alter table public.criador_indicacoes enable row level security;

-- ============ 3) comissões: 15% de cada pagamento aprovado do negócio indicado ============
create table if not exists public.criador_comissoes (
  id uuid primary key default gen_random_uuid(),
  criador_id uuid not null references public.criadores(id) on delete cascade,
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  mp_payment_id text not null unique,               -- reprocessar o mesmo aviso não duplica
  valor_base numeric(10,2) not null,
  percentual numeric(5,2) not null,
  valor numeric(10,2) not null,
  competencia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  status text not null default 'a_pagar' check (status in ('a_pagar', 'paga', 'cancelada')),
  paga_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists criador_comissoes_criador_idx on public.criador_comissoes (criador_id, competencia desc);
alter table public.criador_comissoes enable row level security;

-- ============ 4) RPCs do criador ============
create or replace function public.criador_criar(p_nome text, p_cidade text, p_instagram text, p_tiktok text, p_youtube text)
returns public.criadores language plpgsql security definer set search_path to 'public' as $function$
declare v_uid uuid := auth.uid(); v_cod text; v_row public.criadores; v_i int := 0;
begin
  if v_uid is null then raise exception 'Entre na sua conta primeiro.'; end if;
  select * into v_row from public.criadores where user_id = v_uid;
  if found then return v_row; end if;
  if char_length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Escreva seu nome.'; end if;
  loop
    v_cod := substr(md5(random()::text || clock_timestamp()::text || v_uid::text), 1, 7);
    exit when not exists (select 1 from public.criadores where codigo = v_cod);
    v_i := v_i + 1; if v_i > 20 then raise exception 'Tente de novo.'; end if;
  end loop;
  insert into public.criadores (user_id, nome, codigo, cidade, instagram, tiktok, youtube)
  values (v_uid, left(trim(p_nome), 60), v_cod, nullif(left(trim(coalesce(p_cidade, '')), 60), ''),
          nullif(left(trim(coalesce(p_instagram, '')), 120), ''), nullif(left(trim(coalesce(p_tiktok, '')), 120), ''),
          nullif(left(trim(coalesce(p_youtube, '')), 120), ''))
  returning * into v_row;
  return v_row;
end;
$function$;

-- painel do criador: o perfil + números do mês e do total
create or replace function public.criador_meu()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare v_c public.criadores; v_mes date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  select * into v_c from public.criadores where user_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v_c.id, 'nome', v_c.nome, 'codigo', v_c.codigo, 'percentual', v_c.percentual, 'mensalidade', v_c.mensalidade,
    'indicados', (select count(*) from public.criador_indicacoes where criador_id = v_c.id),
    'comissao_mes', coalesce((select sum(valor) from public.criador_comissoes where criador_id = v_c.id and status <> 'cancelada' and competencia >= v_mes), 0),
    'comissao_total', coalesce((select sum(valor) from public.criador_comissoes where criador_id = v_c.id and status <> 'cancelada'), 0),
    'a_receber', coalesce((select sum(valor) from public.criador_comissoes where criador_id = v_c.id and status = 'a_pagar'), 0)
  );
end;
$function$;

-- lista dos negócios que ele trouxe (só nome/cidade/situação, sem dado pessoal do dono)
create or replace function public.criador_meus_indicados()
returns table (nome text, cidade text, desde timestamptz, comissao_total numeric)
language sql stable security definer set search_path to 'public' as $$
  select e.nome, e.cidade, i.criado_em,
         coalesce((select sum(c.valor) from public.criador_comissoes c where c.criador_id = i.criador_id and c.estabelecimento_id = i.estabelecimento_id and c.status <> 'cancelada'), 0)
  from public.criador_indicacoes i
  join public.criadores k on k.id = i.criador_id and k.user_id = auth.uid()
  join public.estabelecimentos e on e.id = i.estabelecimento_id
  order by i.criado_em desc limit 200;
$$;

-- o dono, ao criar o negócio, informa o código que veio no link (?ref=). Vale uma vez; nunca o próprio criador.
create or replace function public.indicacao_registrar(p_estabelecimento_id uuid, p_codigo text)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
declare v_c public.criadores; v_dono uuid;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  select * into v_c from public.criadores where codigo = lower(trim(coalesce(p_codigo, ''))) and ativo;
  if not found then return false; end if;
  select dono_user_id into v_dono from public.estabelecimentos where id = p_estabelecimento_id;
  if v_dono = v_c.user_id then return false; end if;
  insert into public.criador_indicacoes (criador_id, estabelecimento_id) values (v_c.id, p_estabelecimento_id)
  on conflict (estabelecimento_id) do nothing;
  return found;
end;
$function$;

-- chamada SÓ pelo webhook do Mercado Pago (service role): 15% de cada pagamento aprovado
create or replace function public.criador_comissao_registrar(p_estabelecimento_id uuid, p_payment_id text, p_valor numeric)
returns numeric language plpgsql security definer set search_path to 'public' as $function$
declare v_i public.criador_indicacoes; v_c public.criadores; v_com numeric;
begin
  select * into v_i from public.criador_indicacoes where estabelecimento_id = p_estabelecimento_id;
  if not found then return 0; end if;
  select * into v_c from public.criadores where id = v_i.criador_id and ativo;
  if not found or coalesce(p_valor, 0) <= 0 then return 0; end if;
  v_com := round(p_valor * v_c.percentual / 100, 2);
  insert into public.criador_comissoes (criador_id, estabelecimento_id, mp_payment_id, valor_base, percentual, valor)
  values (v_c.id, p_estabelecimento_id, p_payment_id, p_valor, v_c.percentual, v_com)
  on conflict (mp_payment_id) do nothing;
  return v_com;
end;
$function$;
revoke all on function public.criador_comissao_registrar(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.criador_comissao_registrar(uuid, text, numeric) to service_role;

-- reembolso/estorno: cancela a comissão daquele pagamento (service role)
create or replace function public.criador_comissao_cancelar(p_payment_id text)
returns void language sql security definer set search_path to 'public' as $$
  update public.criador_comissoes set status = 'cancelada' where mp_payment_id = p_payment_id and status = 'a_pagar';
$$;
revoke all on function public.criador_comissao_cancelar(text) from public, anon, authenticated;
grant execute on function public.criador_comissao_cancelar(text) to service_role;

-- ============ 5) locais de anúncio à venda ============
create table if not exists public.anuncio_locais (
  codigo text primary key check (codigo ~ '^[a-z_]{3,30}$'),
  nome text not null,
  descricao text not null,
  preco_semana numeric(8,2) not null check (preco_semana >= 0),
  ordem int not null default 0,
  ativo boolean not null default true
);
alter table public.anuncio_locais enable row level security;

insert into public.anuncio_locais (codigo, nome, descricao, preco_semana, ordem) values
  ('busca_topo',   'Topo da busca',          'Primeiro painel que a pessoa vê ao procurar um negócio na sua cidade.', 29.90, 1),
  ('home_cidade',  'Página da cidade',       'Carrossel de destaques na página inicial da cidade.',                    24.90, 2),
  ('area_agenda',  'Área Agendar',           'Painel "Anuncie aqui" dentro de Agendar.',                               14.90, 3),
  ('area_pedir',   'Área Pedir',             'Painel "Anuncie aqui" dentro de Pedir.',                                 14.90, 4),
  ('area_chamar',  'Área Chamar',            'Painel "Anuncie aqui" dentro de Chamar.',                                14.90, 5),
  ('video_perfil', 'Vídeo no perfil de outro negócio', 'Seu vídeo na faixa "Vídeos de quem já foi" de um negócio parceiro.', 19.90, 6)
on conflict (codigo) do update set nome = excluded.nome, descricao = excluded.descricao, preco_semana = excluded.preco_semana, ordem = excluded.ordem;

create table if not exists public.anuncio_reservas (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  local_codigo text not null references public.anuncio_locais(codigo),
  semanas int not null check (semanas between 1 and 12),
  valor numeric(10,2) not null,
  criador_id uuid references public.criadores(id) on delete set null,   -- criador que vendeu/produziu o anúncio
  titulo text check (titulo is null or char_length(titulo) <= 60),
  video_url text check (video_url is null or video_url ~ '^https://'),
  status text not null default 'pedido' check (status in ('pedido', 'pago', 'no_ar', 'encerrado', 'cancelado')),
  criado_em timestamptz not null default now()
);
create index if not exists anuncio_reservas_estab_idx on public.anuncio_reservas (estabelecimento_id, criado_em desc);
alter table public.anuncio_reservas enable row level security;

create or replace function public.anuncio_locais_listar()
returns setof public.anuncio_locais language sql stable security definer set search_path to 'public' as $$
  select * from public.anuncio_locais where ativo order by ordem;
$$;

create or replace function public.anuncio_local_reservar(
  p_estabelecimento_id uuid, p_local text, p_semanas int, p_titulo text, p_video_url text, p_codigo_criador text)
returns public.anuncio_reservas language plpgsql security definer set search_path to 'public' as $function$
declare v_l public.anuncio_locais; v_c uuid; v_row public.anuncio_reservas;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  select * into v_l from public.anuncio_locais where codigo = p_local and ativo;
  if not found then raise exception 'Esse local não está à venda.'; end if;
  select id into v_c from public.criadores where codigo = lower(trim(coalesce(p_codigo_criador, ''))) and ativo;
  insert into public.anuncio_reservas (estabelecimento_id, local_codigo, semanas, valor, criador_id, titulo, video_url)
  values (p_estabelecimento_id, v_l.codigo, least(greatest(coalesce(p_semanas, 1), 1), 12),
          v_l.preco_semana * least(greatest(coalesce(p_semanas, 1), 1), 12), v_c,
          nullif(left(trim(coalesce(p_titulo, '')), 60), ''), nullif(trim(coalesce(p_video_url, '')), ''))
  returning * into v_row;
  return v_row;
end;
$function$;

grant execute on function public.criador_criar(text, text, text, text, text) to authenticated;
grant execute on function public.criador_meu() to authenticated;
grant execute on function public.criador_meus_indicados() to authenticated;
grant execute on function public.indicacao_registrar(uuid, text) to authenticated;
grant execute on function public.anuncio_locais_listar() to anon, authenticated;
grant execute on function public.anuncio_local_reservar(uuid, text, int, text, text, text) to authenticated;
