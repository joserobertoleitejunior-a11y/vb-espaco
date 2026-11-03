-- Histórico da conversa do dono com o funcionário digital, por estabelecimento.
-- Guarda o que foi dito e, nas ações que dá pra reverter, os passos para desfazer.
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

-- ===== Limite de uso do funcionário por estabelecimento (limite justo, por dia) =====
-- Mensagens de texto e fotos de cardápio contam separado (a foto gasta bem mais da IA).
create table if not exists public.assistente_uso (
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  dia date not null,
  mensagens integer not null default 0,
  fotos integer not null default 0,
  primary key (estabelecimento_id, dia)
);
alter table public.assistente_uso enable row level security;
revoke all on public.assistente_uso from anon, authenticated;

-- Consome 1 uso do tipo pedido ('mensagem' ou 'foto'). Devolve se pode, quanto usou e o limite.
create or replace function public.assistente_consumir(p_estabelecimento_id uuid, p_tipo text default 'mensagem')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_lim_msg constant integer := 80;
  v_lim_foto constant integer := 12;
  v_msg integer; v_foto integer;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  insert into public.assistente_uso (estabelecimento_id, dia) values (p_estabelecimento_id, v_hoje) on conflict do nothing;
  select mensagens, fotos into v_msg, v_foto from public.assistente_uso where estabelecimento_id = p_estabelecimento_id and dia = v_hoje for update;
  if p_tipo = 'foto' then
    if v_foto >= v_lim_foto then return jsonb_build_object('ok', false, 'tipo', 'foto', 'usados', v_foto, 'limite', v_lim_foto); end if;
    update public.assistente_uso set fotos = fotos + 1 where estabelecimento_id = p_estabelecimento_id and dia = v_hoje;
    return jsonb_build_object('ok', true, 'tipo', 'foto', 'usados', v_foto + 1, 'limite', v_lim_foto);
  end if;
  if v_msg >= v_lim_msg then return jsonb_build_object('ok', false, 'tipo', 'mensagem', 'usados', v_msg, 'limite', v_lim_msg); end if;
  update public.assistente_uso set mensagens = mensagens + 1 where estabelecimento_id = p_estabelecimento_id and dia = v_hoje;
  return jsonb_build_object('ok', true, 'tipo', 'mensagem', 'usados', v_msg + 1, 'limite', v_lim_msg);
end $$;

-- Quanto já usou hoje (pra mostrar no chat sem gastar nada)
create or replace function public.assistente_uso_hoje(p_estabelecimento_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_msg integer := 0; v_foto integer := 0;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  select mensagens, fotos into v_msg, v_foto from public.assistente_uso where estabelecimento_id = p_estabelecimento_id and dia = v_hoje;
  return jsonb_build_object('mensagens', coalesce(v_msg, 0), 'fotos', coalesce(v_foto, 0), 'limite_mensagens', 80, 'limite_fotos', 12);
end $$;

revoke all on function public.assistente_consumir(uuid, text) from public, anon;
revoke all on function public.assistente_uso_hoje(uuid) from public, anon;
grant execute on function public.assistente_consumir(uuid, text) to authenticated;
grant execute on function public.assistente_uso_hoje(uuid) to authenticated;
