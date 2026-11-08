-- Histórico da conversa do dono com o funcionário digital, por estabelecimento.
-- Guarda o que foi dito e, nas ações que dá pra reverter, os passos para desfazer.
-- Depois: preço e créditos de IA por forma de uso (Chamar / Agenda / Delivery), renovam todo mês, com teto por dia e pacotes avulsos.
create table if not exists public.assistente_historico (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  papel text not null check (papel in ('eu', 'ele')),
  texto text not null check (char_length(texto) <= 2000),
  acao text,
  desfazer jsonb,
  desfeito_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists assistente_historico_estab_idx on public.assistente_historico (estabelecimento_id, criado_em desc);
alter table public.assistente_historico enable row level security;
-- sem policies: só as funções abaixo (security definer) mexem na tabela
revoke all on public.assistente_historico from anon, authenticated;

create or replace function public.assistente_historico_listar(p_estabelecimento_id uuid, p_limite integer default 80)
returns table (id uuid, papel text, texto text, acao text, desfazer jsonb, desfeito_em timestamptz, criado_em timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  return query
    select h.id, h.papel, h.texto, h.acao, h.desfazer, h.desfeito_em, h.criado_em
    from (select * from public.assistente_historico where estabelecimento_id = p_estabelecimento_id
          order by criado_em desc limit greatest(1, least(coalesce(p_limite, 80), 200))) h
    order by h.criado_em asc;
end $$;

create or replace function public.assistente_historico_salvar(p_estabelecimento_id uuid, p_papel text, p_texto text, p_acao text default null, p_desfazer jsonb default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  insert into public.assistente_historico (estabelecimento_id, papel, texto, acao, desfazer)
  values (p_estabelecimento_id, p_papel, left(coalesce(p_texto, ''), 2000), left(p_acao, 60), p_desfazer)
  returning id into v_id;
  -- guarda só as últimas 300 mensagens por estabelecimento
  delete from public.assistente_historico
  where estabelecimento_id = p_estabelecimento_id
    and id in (select id from public.assistente_historico where estabelecimento_id = p_estabelecimento_id order by criado_em desc offset 300);
  return v_id;
end $$;

create or replace function public.assistente_historico_desfeito(p_estabelecimento_id uuid, p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  update public.assistente_historico set desfeito_em = now() where id = p_id and estabelecimento_id = p_estabelecimento_id and desfeito_em is null;
end $$;

revoke all on function public.assistente_historico_listar(uuid, integer) from public, anon;
revoke all on function public.assistente_historico_salvar(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.assistente_historico_desfeito(uuid, uuid) from public, anon;
grant execute on function public.assistente_historico_listar(uuid, integer) to authenticated;
grant execute on function public.assistente_historico_salvar(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.assistente_historico_desfeito(uuid, uuid) to authenticated;

-- ===== Créditos da IA: planos, saldo que renova todo mês, teto por dia e pacotes avulsos =====
-- 1 mensagem = peso_mensagem créditos; 1 foto de cardápio = peso_foto créditos (gasta ~8x mais).
-- Tudo aqui é configuração: mudar preço, pacote ou peso é um UPDATE, sem mexer no código.
create table if not exists public.assistente_planos (
  plano text primary key,
  nome text not null,
  creditos_mes integer not null check (creditos_mes >= 0),
  teto_dia integer not null check (teto_dia >= 0),
  peso_mensagem integer not null default 1 check (peso_mensagem >= 1),
  peso_foto integer not null default 8 check (peso_foto >= 1),
  preco_mensal numeric(8,2) not null
);
alter table public.assistente_planos enable row level security;
revoke all on public.assistente_planos from anon, authenticated;

-- O preço da mensalidade (3 degraus, cada um com sua cota de IA que renova todo mês):
--   basico     UMA forma: só Chamar ou só Agenda                                   R$ 14,90 · 80 créditos
--   padrao     duas formas sem Delivery (Chamar + Agenda) ou Delivery sozinho       R$ 21,90 · 150 créditos
--   completo   Delivery + outra forma, ou quem liga a "IA completa" (ia_turbo)      R$ 34,90 · 400 créditos
-- Mudar preço/cota é um UPDATE em assistente_planos.
insert into public.assistente_planos (plano, nome, creditos_mes, teto_dia, peso_mensagem, peso_foto, preco_mensal) values
  ('basico',   'Matriz Básico',    80, 25, 1, 8, 14.90),
  ('padrao',   'Matriz',          150, 40, 1, 8, 21.90),
  ('completo', 'Matriz Completo', 400, 80, 1, 8, 34.90)
on conflict (plano) do update set nome = excluded.nome, creditos_mes = excluded.creditos_mes, teto_dia = excluded.teto_dia,
  peso_mensagem = excluded.peso_mensagem, peso_foto = excluded.peso_foto, preco_mensal = excluded.preco_mensal;

-- qual degrau o negócio tem, pelas áreas que usa
create or replace function public.vibe_plano_base(p_areas text[])
returns text language sql immutable set search_path = public as $$
  select case
    when (select count(distinct a) from unnest(coalesce(p_areas, '{}'::text[])) a where a in ('agenda', 'servicos', 'delivery')) >= 2
         and 'delivery' = any(coalesce(p_areas, '{}'::text[])) then 'completo'
    when 'delivery' = any(coalesce(p_areas, '{}'::text[])) then 'padrao'
    when (select count(distinct a) from unnest(coalesce(p_areas, '{}'::text[])) a where a in ('agenda', 'servicos')) >= 2 then 'padrao'
    else 'basico'
  end
$$;

-- ia_turbo = "IA completa": qualquer negócio pode subir para o Matriz Completo (R$ 34,90 · 400 créditos)
alter table public.estabelecimentos add column if not exists ia_turbo boolean not null default false;

create or replace function public.vibe_plano_do_negocio(p_areas text[], p_turbo boolean)
returns text language sql immutable set search_path = public as $$
  select case when coalesce(p_turbo, false) then 'completo' else public.vibe_plano_base(p_areas) end
$$;

create or replace function public.vibe_trg_mensalidade()
returns trigger language plpgsql set search_path = public as $$
begin
  new.mensalidade := (select preco_mensal from public.assistente_planos where plano = public.vibe_plano_do_negocio(new.areas, new.ia_turbo));
  return new;
end $$;
drop trigger if exists estab_mensalidade_por_areas on public.estabelecimentos;
create trigger estab_mensalidade_por_areas before insert or update of areas, ia_turbo on public.estabelecimentos
  for each row execute function public.vibe_trg_mensalidade();

-- uso por dia (creditos = total gasto no dia; do_pacote = quanto saiu de pacote avulso, que não conta na cota do mês)
create table if not exists public.assistente_uso (
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  dia date not null,
  mensagens integer not null default 0,
  fotos integer not null default 0,
  creditos integer not null default 0,
  do_pacote integer not null default 0,
  primary key (estabelecimento_id, dia)
);
alter table public.assistente_uso enable row level security;
revoke all on public.assistente_uso from anon, authenticated;

-- créditos avulsos comprados (não vencem; só são usados depois que a cota do mês acaba)
create table if not exists public.assistente_saldo (
  estabelecimento_id uuid primary key references public.estabelecimentos(id) on delete cascade,
  extras integer not null default 0 check (extras >= 0)
);
alter table public.assistente_saldo enable row level security;
revoke all on public.assistente_saldo from anon, authenticated;

-- Situação atual de um estabelecimento (usado por consumir e pelo contador do terminal)
create or replace function public.assistente_situacao(p_estabelecimento_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  p public.assistente_planos%rowtype;
  v_mes_usado integer; v_dia_usado integer; v_msg integer := 0; v_foto integer := 0; v_extras integer := 0;
begin
  select pl.* into p from public.assistente_planos pl
    join public.estabelecimentos e on pl.plano = public.vibe_plano_do_negocio(e.areas, e.ia_turbo)
    where e.id = p_estabelecimento_id;
  if not found then select * into p from public.assistente_planos where plano = 'basico'; end if;
  select coalesce(sum(creditos - do_pacote), 0) into v_mes_usado from public.assistente_uso
    where estabelecimento_id = p_estabelecimento_id and dia >= v_mes;
  select coalesce(creditos, 0), coalesce(mensagens, 0), coalesce(fotos, 0) into v_dia_usado, v_msg, v_foto from public.assistente_uso
    where estabelecimento_id = p_estabelecimento_id and dia = v_hoje;
  select coalesce(extras, 0) into v_extras from public.assistente_saldo where estabelecimento_id = p_estabelecimento_id;
  return jsonb_build_object(
    'plano', p.plano, 'plano_nome', p.nome,
    'creditos_mes', p.creditos_mes, 'usados_mes', v_mes_usado,
    'restante_mes', greatest(p.creditos_mes - v_mes_usado, 0),
    'extras', coalesce(v_extras, 0),
    'restantes', greatest(p.creditos_mes - v_mes_usado, 0) + coalesce(v_extras, 0),
    'teto_dia', p.teto_dia, 'usados_dia', coalesce(v_dia_usado, 0),
    'peso_mensagem', p.peso_mensagem, 'peso_foto', p.peso_foto,
    'mensagens', coalesce(v_msg, 0), 'fotos', coalesce(v_foto, 0),
    'renova_em', (v_mes + interval '1 month')::date
  );
end $$;

-- Gasta créditos de 1 mensagem ou 1 foto. ok=false traz o motivo e um texto pronto pra mostrar.
create or replace function public.assistente_consumir(p_estabelecimento_id uuid, p_tipo text default 'mensagem')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  s jsonb; v_peso integer; v_do_pacote integer := 0; v_restante_mes integer; v_extras integer;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  insert into public.assistente_saldo (estabelecimento_id) values (p_estabelecimento_id) on conflict do nothing;
  insert into public.assistente_uso (estabelecimento_id, dia) values (p_estabelecimento_id, v_hoje) on conflict do nothing;
  -- trava a linha do dia pra duas chamadas juntas não furarem o limite
  perform 1 from public.assistente_uso where estabelecimento_id = p_estabelecimento_id and dia = v_hoje for update;
  s := public.assistente_situacao(p_estabelecimento_id);
  v_peso := case when p_tipo = 'foto' then (s->>'peso_foto')::int else (s->>'peso_mensagem')::int end;
  v_restante_mes := (s->>'restante_mes')::int; v_extras := (s->>'extras')::int;

  if (s->>'usados_dia')::int + v_peso > (s->>'teto_dia')::int then
    return s || jsonb_build_object('ok', false, 'motivo', 'dia', 'limite', (s->>'teto_dia')::int,
      'mensagem', 'Você chegou no limite de hoje (' || (s->>'teto_dia') || ' créditos). Ele volta amanhã — os botões do painel continuam funcionando normalmente.');
  end if;
  if v_peso > v_restante_mes + v_extras then
    return s || jsonb_build_object('ok', false, 'motivo', 'mes', 'limite', (s->>'creditos_mes')::int,
      'mensagem', 'Seus créditos de IA acabaram. Eles renovam em ' || to_char((s->>'renova_em')::date, 'DD/MM') || ' — ou peça mais créditos. Os botões do painel continuam funcionando.');
  end if;
  -- gasta primeiro a cota do mês; só depois os créditos avulsos
  if v_peso > v_restante_mes then
    v_do_pacote := v_peso - v_restante_mes;
    update public.assistente_saldo set extras = extras - v_do_pacote where estabelecimento_id = p_estabelecimento_id;
  end if;
  update public.assistente_uso set
    mensagens = mensagens + case when p_tipo = 'foto' then 0 else 1 end,
    fotos = fotos + case when p_tipo = 'foto' then 1 else 0 end,
    creditos = creditos + v_peso, do_pacote = do_pacote + v_do_pacote
  where estabelecimento_id = p_estabelecimento_id and dia = v_hoje;
  return public.assistente_situacao(p_estabelecimento_id) || jsonb_build_object('ok', true, 'tipo', p_tipo, 'gasto', v_peso);
end $$;

-- O contador do terminal (não gasta nada)
create or replace function public.assistente_uso_hoje(p_estabelecimento_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  return public.assistente_situacao(p_estabelecimento_id);
end $$;

-- Só quem é admin da plataforma muda plano e soma créditos (cobrança/atendimento)
create or replace function public.assistente_definir_turbo(p_estabelecimento_id uuid, p_ligado boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.vb_plataforma_admins where user_id = auth.uid()) then raise exception 'Só o admin da plataforma pode fazer isso.'; end if;
  update public.estabelecimentos set ia_turbo = coalesce(p_ligado, false) where id = p_estabelecimento_id;
end $$;

create or replace function public.assistente_somar_creditos(p_estabelecimento_id uuid, p_creditos integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if not exists (select 1 from public.vb_plataforma_admins where user_id = auth.uid()) then raise exception 'Só o admin da plataforma pode fazer isso.'; end if;
  insert into public.assistente_saldo (estabelecimento_id, extras) values (p_estabelecimento_id, greatest(p_creditos, 0))
    on conflict (estabelecimento_id) do update set extras = public.assistente_saldo.extras + greatest(p_creditos, 0)
    returning extras into v;
  return v;
end $$;

revoke all on function public.assistente_situacao(uuid) from public, anon, authenticated;
revoke all on function public.assistente_consumir(uuid, text) from public, anon;
revoke all on function public.assistente_uso_hoje(uuid) from public, anon;
revoke all on function public.assistente_definir_turbo(uuid, boolean) from public, anon;
revoke all on function public.assistente_somar_creditos(uuid, integer) from public, anon;
grant execute on function public.assistente_consumir(uuid, text) to authenticated;
grant execute on function public.assistente_uso_hoje(uuid) to authenticated;
grant execute on function public.assistente_definir_turbo(uuid, boolean) to authenticated;
grant execute on function public.assistente_somar_creditos(uuid, integer) to authenticated;
