-- Planos novos: Básico R$ 14,90 (80) · Matriz R$ 21,90 (150) · Completo R$ 34,90 (400). Seguro rodar mais de uma vez.
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

-- tira os planos antigos (depois que nenhum negócio aponta mais para eles)
-- (a ordem importa: as funções acima já usam só basico/padrao/completo)
delete from public.assistente_planos where plano in ('chamar', 'delivery', 'turbo');
update public.estabelecimentos set areas = areas;

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

