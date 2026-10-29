-- Anúncios (aplicado): o dono publica um anúncio que aparece nos painéis
-- "Anuncie aqui" do passo a passo da busca (guia.js), na área (Agendar,
-- Pedir, Chamar) e, se quiser, só pra quem procura um tipo de negócio.
-- Na fase de finalização é grátis; o período vai de 7 a 30 dias.
-- Acesso só por RPC (tabela sem política: ninguém lê/escreve direto).

create table if not exists public.anuncios (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  area text not null check (area in ('agenda', 'delivery', 'servicos')),
  segmento text check (segmento is null or char_length(segmento) <= 40),
  titulo text not null check (char_length(titulo) between 2 and 40),
  texto text not null check (char_length(texto) between 2 and 90),
  foto_url text check (foto_url is null or char_length(foto_url) <= 500),
  inicio date not null default (now() at time zone 'America/Sao_Paulo')::date,
  fim date not null,
  ativo boolean not null default true,
  vistos int not null default 0,
  cliques int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists anuncios_area_idx on public.anuncios (area, fim) where ativo;
alter table public.anuncios enable row level security;

-- publicar (dono): um anúncio no ar por área de cada negócio
create or replace function public.tenant_admin_criar_anuncio(
  p_estabelecimento_id uuid, p_area text, p_segmento text, p_titulo text, p_texto text, p_foto_url text, p_dias int)
returns public.anuncios language plpgsql security definer set search_path to 'public' as $function$
declare v_row public.anuncios; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_dias int;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  if p_area not in ('agenda', 'delivery', 'servicos') then raise exception 'Escolha onde o anúncio vai aparecer.'; end if;
  if char_length(trim(coalesce(p_titulo, ''))) < 2 then raise exception 'Escreva o título do anúncio.'; end if;
  if char_length(trim(coalesce(p_texto, ''))) < 2 then raise exception 'Escreva o texto do anúncio.'; end if;
  if p_segmento is not null and not (p_segmento = any(public.vibe_segmentos())) then raise exception 'Tipo de negócio inválido.'; end if;
  if coalesce(p_foto_url, '') <> '' and p_foto_url !~ '^(https://|/assets/)' then raise exception 'Foto inválida.'; end if;
  v_dias := least(greatest(coalesce(p_dias, 7), 1), 30);
  if exists (select 1 from public.anuncios a where a.estabelecimento_id = p_estabelecimento_id and a.area = p_area and a.ativo and a.fim >= v_hoje) then
    raise exception 'Você já tem um anúncio no ar nessa área — pause ele antes de publicar outro.';
  end if;
  insert into public.anuncios (estabelecimento_id, area, segmento, titulo, texto, foto_url, inicio, fim)
  values (p_estabelecimento_id, p_area, nullif(p_segmento, ''), left(trim(p_titulo), 40), left(trim(p_texto), 90), nullif(p_foto_url, ''), v_hoje, v_hoje + v_dias - 1)
  returning * into v_row;
  return v_row;
end;
$function$;

create or replace function public.tenant_admin_meus_anuncios(p_estabelecimento_id uuid)
returns setof public.anuncios language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  return query select * from public.anuncios where estabelecimento_id = p_estabelecimento_id order by criado_em desc limit 20;
end;
$function$;

create or replace function public.tenant_admin_pausar_anuncio(p_estabelecimento_id uuid, p_id uuid, p_ativo boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  if p_ativo and exists (select 1 from public.anuncios a, public.anuncios b where b.id = p_id and a.estabelecimento_id = b.estabelecimento_id
       and a.area = b.area and a.id <> b.id and a.ativo and a.fim >= (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'Já tem outro anúncio no ar nessa área.';
  end if;
  update public.anuncios set ativo = p_ativo where id = p_id and estabelecimento_id = p_estabelecimento_id;
  return found;
end;
$function$;

-- os anúncios no ar de uma área (público, pro guia da busca)
create or replace function public.anuncios_ativos(p_area text, p_cidade text default null)
returns table (id uuid, estabelecimento_id uuid, segmento text, titulo text, texto text, foto_url text,
               nome text, slug text, cidade text, cor_destaque text)
language sql stable security definer set search_path to 'public' as $$
  select a.id, a.estabelecimento_id, a.segmento, a.titulo, a.texto,
         coalesce(a.foto_url, e.foto_capa_url, e.foto_hero_url), e.nome, e.slug, e.cidade, e.cor_destaque
  from public.anuncios a join public.estabelecimentos e on e.id = a.estabelecimento_id
  where a.area = p_area and a.ativo and e.ativo is not false
    and (now() at time zone 'America/Sao_Paulo')::date between a.inicio and a.fim
    and (p_cidade is null or e.cidade = lower(trim(p_cidade)))
  order by random() limit 12;
$$;

-- contadores: quantas vezes apareceu e quantas vezes tocaram
create or replace function public.anuncio_registrar(p_id uuid, p_tipo text)
returns void language sql security definer set search_path to 'public' as $$
  update public.anuncios set vistos = vistos + case when p_tipo = 'visto' then 1 else 0 end,
                             cliques = cliques + case when p_tipo = 'clique' then 1 else 0 end
  where id = p_id and ativo;
$$;

revoke execute on function public.tenant_admin_criar_anuncio(uuid, text, text, text, text, text, int) from public, anon;
revoke execute on function public.tenant_admin_meus_anuncios(uuid) from public, anon;
revoke execute on function public.tenant_admin_pausar_anuncio(uuid, uuid, boolean) from public, anon;
grant execute on function public.tenant_admin_criar_anuncio(uuid, text, text, text, text, text, int) to authenticated;
grant execute on function public.tenant_admin_meus_anuncios(uuid) to authenticated;
grant execute on function public.tenant_admin_pausar_anuncio(uuid, uuid, boolean) to authenticated;
grant execute on function public.anuncios_ativos(text, text) to anon, authenticated;
grant execute on function public.anuncio_registrar(uuid, text) to anon, authenticated;
