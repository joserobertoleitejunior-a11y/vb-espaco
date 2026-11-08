-- Criadores de conteúdo: catálogo de serviços e preços + créditos de IA (400/mês no plano de R$ 14,90).
-- Rodar DEPOIS de 2026_11_criadores_indicacao_anuncios.sql. Seguro rodar mais de uma vez.

alter table public.criadores alter column mensalidade set default 14.90;
update public.criadores set mensalidade = 14.90 where mensalidade = 4.90;

-- ===== catálogo de serviços do criador =====
create table if not exists public.criador_servicos (
  id uuid primary key default gen_random_uuid(),
  criador_id uuid not null references public.criadores(id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 80),
  descricao text check (descricao is null or char_length(descricao) <= 300),
  tipo_preco text not null default 'fixo' check (tipo_preco in ('fixo', 'a_partir', 'orcamento')),
  preco numeric(10,2) check (preco is null or preco >= 0),
  prazo_dias int check (prazo_dias is null or prazo_dias between 1 and 90),
  uso text not null default 'organico' check (uso in ('organico', 'anuncio', 'exclusivo')),
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists criador_servicos_criador_idx on public.criador_servicos (criador_id, ordem);
alter table public.criador_servicos enable row level security;
revoke all on public.criador_servicos from anon, authenticated;

create or replace function public.criador_servicos_listar()
returns setof public.criador_servicos language sql stable security definer set search_path = public as $$
  select s.* from public.criador_servicos s join public.criadores k on k.id = s.criador_id
  where k.user_id = auth.uid() and s.ativo order by s.ordem, s.criado_em;
$$;

create or replace function public.criador_servico_salvar(
  p_id uuid, p_nome text, p_descricao text, p_tipo_preco text, p_preco numeric, p_prazo_dias int, p_uso text)
returns public.criador_servicos language plpgsql security definer set search_path = public as $$
declare v_k uuid; v_row public.criador_servicos;
begin
  select id into v_k from public.criadores where user_id = auth.uid();
  if v_k is null then raise exception 'Crie seu perfil de criador primeiro.'; end if;
  if char_length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Escreva o nome do serviço.'; end if;
  if p_tipo_preco in ('fixo', 'a_partir') and (p_preco is null or p_preco < 0) then raise exception 'Informe o preço.'; end if;
  if p_id is null then
    if (select count(*) from public.criador_servicos where criador_id = v_k and ativo) >= 30 then raise exception 'Limite de 30 serviços.'; end if;
    insert into public.criador_servicos (criador_id, nome, descricao, tipo_preco, preco, prazo_dias, uso, ordem)
    values (v_k, left(trim(p_nome), 80), nullif(left(trim(coalesce(p_descricao, '')), 300), ''), coalesce(p_tipo_preco, 'fixo'),
            case when p_tipo_preco = 'orcamento' then null else p_preco end, p_prazo_dias, coalesce(p_uso, 'organico'),
            coalesce((select max(ordem) + 1 from public.criador_servicos where criador_id = v_k), 0))
    returning * into v_row;
  else
    update public.criador_servicos set nome = left(trim(p_nome), 80), descricao = nullif(left(trim(coalesce(p_descricao, '')), 300), ''),
           tipo_preco = coalesce(p_tipo_preco, 'fixo'), preco = case when p_tipo_preco = 'orcamento' then null else p_preco end,
           prazo_dias = p_prazo_dias, uso = coalesce(p_uso, 'organico')
    where id = p_id and criador_id = v_k returning * into v_row;
    if not found then raise exception 'Serviço não encontrado.'; end if;
  end if;
  return v_row;
end $$;

create or replace function public.criador_servico_apagar(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.criador_servicos set ativo = false
  where id = p_id and criador_id = (select id from public.criadores where user_id = auth.uid());
  return found;
end $$;

-- ===== créditos de IA do criador: 400 por mês (renova dia 1º), teto por dia =====
create table if not exists public.criador_ia_uso (
  criador_id uuid not null references public.criadores(id) on delete cascade,
  dia date not null,
  creditos int not null default 0,
  primary key (criador_id, dia)
);
alter table public.criador_ia_uso enable row level security;
revoke all on public.criador_ia_uso from anon, authenticated;

create or replace function public.criador_ia_situacao()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k uuid; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
        v_mes date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
        v_mes_usado int; v_dia_usado int;
        c_mes constant int := 400; c_dia constant int := 80;
begin
  select id into k from public.criadores where user_id = auth.uid();
  if k is null then return null; end if;
  select coalesce(sum(creditos), 0) into v_mes_usado from public.criador_ia_uso where criador_id = k and dia >= v_mes;
  select coalesce(sum(creditos), 0) into v_dia_usado from public.criador_ia_uso where criador_id = k and dia = v_hoje;
  return jsonb_build_object('creditos_mes', c_mes, 'usados_mes', v_mes_usado, 'restantes', greatest(c_mes - v_mes_usado, 0),
    'teto_dia', c_dia, 'usados_dia', v_dia_usado, 'renova_em', (v_mes + interval '1 month')::date);
end $$;

-- gasta créditos (a edge function criador-ia chama isto com o login do criador)
create or replace function public.criador_ia_consumir(p_peso int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k uuid; s jsonb; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_peso int := least(greatest(coalesce(p_peso, 1), 1), 20);
begin
  select id into k from public.criadores where user_id = auth.uid() and ativo;
  if k is null then return jsonb_build_object('ok', false, 'mensagem', 'Crie seu perfil de criador para usar a IA.'); end if;
  insert into public.criador_ia_uso (criador_id, dia) values (k, v_hoje) on conflict do nothing;
  perform 1 from public.criador_ia_uso where criador_id = k and dia = v_hoje for update;
  s := public.criador_ia_situacao();
  if (s->>'usados_dia')::int + v_peso > (s->>'teto_dia')::int then
    return s || jsonb_build_object('ok', false, 'mensagem', 'Você chegou no limite de hoje. Ele volta amanhã.');
  end if;
  if v_peso > (s->>'restantes')::int then
    return s || jsonb_build_object('ok', false, 'mensagem', 'Seus créditos de IA acabaram. Eles renovam em ' || to_char((s->>'renova_em')::date, 'DD/MM') || '.');
  end if;
  update public.criador_ia_uso set creditos = creditos + v_peso where criador_id = k and dia = v_hoje;
  return public.criador_ia_situacao() || jsonb_build_object('ok', true, 'gasto', v_peso);
end $$;

-- devolve créditos quando a IA falhou depois de cobrar
create or replace function public.criador_ia_devolver(p_peso int)
returns void language plpgsql security definer set search_path = public as $$
declare k uuid; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select id into k from public.criadores where user_id = auth.uid();
  if k is null then return; end if;
  update public.criador_ia_uso set creditos = greatest(creditos - least(greatest(coalesce(p_peso, 1), 1), 20), 0) where criador_id = k and dia = v_hoje;
end $$;

revoke all on function public.criador_servicos_listar() from public, anon;
revoke all on function public.criador_servico_salvar(uuid, text, text, text, numeric, int, text) from public, anon;
revoke all on function public.criador_servico_apagar(uuid) from public, anon;
revoke all on function public.criador_ia_situacao() from public, anon;
revoke all on function public.criador_ia_consumir(int) from public, anon;
revoke all on function public.criador_ia_devolver(int) from public, anon;
grant execute on function public.criador_servicos_listar() to authenticated;
grant execute on function public.criador_servico_salvar(uuid, text, text, text, numeric, int, text) to authenticated;
grant execute on function public.criador_servico_apagar(uuid) to authenticated;
grant execute on function public.criador_ia_situacao() to authenticated;
grant execute on function public.criador_ia_consumir(int) to authenticated;
grant execute on function public.criador_ia_devolver(int) to authenticated;
