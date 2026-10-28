-- Tatuador + duração dos serviços (aplicado). Sem DROP: só adiciona colunas
-- e funções novas; as antigas mantêm a mesma assinatura.
--
-- 1) Serviço com duração: sessão de tatuagem leva horas, não 30 min. A
--    agenda passa a bloquear o tempo todo do serviço (e não só o horário
--    de início), pra ninguém marcar em cima de uma sessão em andamento.
--    Sem duração cadastrada, continua 30 min — igual era antes.
-- 2) Agendamento guarda "detalhes" (o briefing da tatuagem: local do
--    corpo, tamanho, estilo, ideia, 18+), que também vai no WhatsApp.
-- 3) Foto da galeria pode ter um estilo (fineline, blackwork…) — o site
--    do tatuador filtra o portfólio por estilo.
-- 4) Segmento novo: tatuador.

alter table public.tenant_services add column if not exists duracao_min int
  check (duracao_min is null or duracao_min between 15 and 720);
alter table public.tenant_appointments add column if not exists duracao_min int not null default 30
  check (duracao_min between 15 and 720);
alter table public.tenant_appointments add column if not exists detalhes jsonb;
alter table public.tenant_gallery add column if not exists estilo text
  check (estilo is null or char_length(estilo) <= 40);

-- duração do serviço pelo nome (como o agendamento guarda o serviço)
create or replace function public.vibe_duracao_servico(p_estabelecimento_id uuid, p_servico text)
returns int language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select s.duracao_min from public.tenant_services s
    where s.estabelecimento_id = p_estabelecimento_id and s.ativo and s.nome = trim(coalesce(p_servico, ''))
    order by s.criado_em limit 1), 30);
$$;

-- algum agendamento ativo encosta no intervalo [inicio, inicio + duração)?
create or replace function public.vibe_agenda_ocupada(
  p_estabelecimento_id uuid, p_dia date, p_staff_id uuid, p_inicio time, p_duracao_min int, p_excluir uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.tenant_appointments a
    where a.estabelecimento_id = p_estabelecimento_id
      and a.dia = p_dia
      and a.status <> 'cancelado'
      and (p_excluir is null or a.id <> p_excluir)
      and ((p_staff_id is null and a.staff_id is null) or a.staff_id = p_staff_id)
      and a.horario ~ '^\d{1,2}:\d{2}$'
      -- em minutos do dia (time + interval daria a volta na meia-noite)
      and extract(epoch from a.horario::time) / 60 < extract(epoch from p_inicio) / 60 + p_duracao_min
      and extract(epoch from p_inicio) / 60 < extract(epoch from a.horario::time) / 60 + a.duracao_min
  );
$$;

-- horários pra uma duração: o serviço cabe inteiro antes de fechar e não
-- encosta em nenhum outro agendamento (sem DROP: a versão antiga, de 3
-- argumentos, continua existindo e vira "30 minutos")
create or replace function public.vibe_agenda_slots_duracao(
  p_estabelecimento_id uuid, p_dia date, p_staff_id uuid, p_duracao_min int)
returns table(horario text, disponivel boolean)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_dia_semana int := extract(dow from p_dia);
  v_abre time := '08:00';
  v_fecha time := '18:00';
  v_fechado boolean := false;
  v_slot time;
  v_achou boolean := false;
  v_dur int := least(greatest(coalesce(p_duracao_min, 30), 15), 720);
begin
  select abre, fecha, fechado into v_abre, v_fecha, v_fechado
  from public.tenant_business_hours
  where estabelecimento_id = p_estabelecimento_id and dia_semana = v_dia_semana;
  get diagnostics v_achou = row_count;
  if not v_achou then
    v_abre := '08:00'; v_fecha := '18:00'; v_fechado := (v_dia_semana = 0);
  end if;
  if v_fechado then return; end if;

  v_slot := v_abre;
  while v_slot < v_fecha loop
    -- o serviço tem que terminar até a hora de fechar
    exit when extract(epoch from v_slot) / 60 + v_dur > extract(epoch from v_fecha) / 60;
    return query select to_char(v_slot, 'HH24:MI'),
      not public.vibe_agenda_ocupada(p_estabelecimento_id, p_dia, p_staff_id, v_slot, v_dur);
    v_slot := v_slot + interval '30 minutes';
  end loop;
end;
$function$;

create or replace function public.tenant_public_agenda_slots(p_estabelecimento_id uuid, p_dia date, p_staff_id uuid default null)
returns table(horario text, disponivel boolean)
language sql stable security definer set search_path to 'public' as $$
  select * from public.vibe_agenda_slots_duracao(p_estabelecimento_id, p_dia, p_staff_id, 30);
$$;

-- o site pede os horários do serviço escolhido (a duração vem do banco)
create or replace function public.tenant_public_horarios_servico(p_estabelecimento_id uuid, p_dia date, p_staff_id uuid, p_servico text)
returns table(horario text, disponivel boolean)
language sql stable security definer set search_path to 'public' as $$
  select * from public.vibe_agenda_slots_duracao(p_estabelecimento_id, p_dia, p_staff_id,
    public.vibe_duracao_servico(p_estabelecimento_id, p_servico));
$$;
grant execute on function public.tenant_public_horarios_servico(uuid, date, uuid, text) to anon, authenticated;

-- briefing do cliente: só texto curto, só as chaves conhecidas
create or replace function public.vibe_limpar_detalhes(p jsonb)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case when p is null or jsonb_typeof(p) <> 'object' then null else (
    select nullif(jsonb_object_agg(k, left(v #>> '{}', 600)), '{}'::jsonb)
    from jsonb_each(p) as e(k, v)
    where k in ('local', 'tamanho', 'estilo', 'ideia', 'referencia', 'maior_idade', 'primeira_tattoo')
      and jsonb_typeof(v) in ('string', 'boolean', 'number')
  ) end;
$$;

-- agendar com o briefing (função nova; a antiga continua, sem detalhes)
create or replace function public.tenant_agendar(
  p_estabelecimento_id uuid, p_cliente_nome text, p_cliente_telefone text, p_staff_id uuid, p_staff_nome text,
  p_servico text, p_dia date, p_dia_label text, p_horario text, p_detalhes jsonb default null)
returns tenant_appointments
language plpgsql security definer set search_path to 'public' as $function$
declare v_row public.tenant_appointments; v_dur int;
begin
  if coalesce(trim(p_horario), '') = '' then raise exception 'Escolha um horário.'; end if;
  if p_dia is null then raise exception 'Escolha um dia.'; end if;
  if p_dia < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Esse dia já passou — escolha outro.'; end if;
  if coalesce(trim(p_cliente_nome), '') = '' or char_length(regexp_replace(coalesce(p_cliente_telefone, ''), '\D', '', 'g')) < 10 then
    raise exception 'Confira seu nome e WhatsApp com DDD.';
  end if;
  if p_staff_id is not null and not exists (select 1 from public.tenant_staff s where s.id = p_staff_id and s.estabelecimento_id = p_estabelecimento_id and coalesce(s.ativo, true)) then
    raise exception 'Esse profissional não atende aqui.';
  end if;
  v_dur := public.vibe_duracao_servico(p_estabelecimento_id, p_servico);
  if not exists (select 1 from public.vibe_agenda_slots_duracao(p_estabelecimento_id, p_dia, p_staff_id, v_dur) s where s.horario = p_horario and s.disponivel) then
    raise exception 'Esse horário acabou de ficar indisponível — escolha outro.';
  end if;
  begin
    insert into public.tenant_appointments (estabelecimento_id, cliente_nome, cliente_telefone, staff_id, staff_nome, servico, dia, dia_label, horario, duracao_min, detalhes)
    values (p_estabelecimento_id, trim(p_cliente_nome), p_cliente_telefone, p_staff_id, p_staff_nome, p_servico, p_dia, p_dia_label, p_horario, v_dur, public.vibe_limpar_detalhes(p_detalhes))
    returning * into v_row;
  exception when unique_violation then
    raise exception 'Esse horário acabou de ficar indisponível — escolha outro.';
  end;
  return v_row;
end;
$function$;
grant execute on function public.tenant_agendar(uuid, text, text, uuid, text, text, date, text, text, jsonb) to anon, authenticated;

create or replace function public.tenant_criar_agendamento(
  p_estabelecimento_id uuid, p_cliente_nome text, p_cliente_telefone text, p_staff_id uuid, p_staff_nome text,
  p_servico text, p_dia date, p_dia_label text, p_horario text)
returns tenant_appointments
language sql security definer set search_path to 'public' as $$
  select * from public.tenant_agendar(p_estabelecimento_id, p_cliente_nome, p_cliente_telefone, p_staff_id, p_staff_nome,
    p_servico, p_dia, p_dia_label, p_horario, null);
$$;

-- agendamento manual do dono: também bloqueia o tempo do serviço
create or replace function public.tenant_admin_criar_agendamento(p_estabelecimento_id uuid, p_cliente_nome text, p_cliente_telefone text, p_staff_id uuid, p_staff_nome text, p_servico text, p_dia date, p_dia_label text, p_horario text)
returns tenant_appointments
language plpgsql security definer set search_path to 'public' as $function$
declare v_dono uuid; v_row public.tenant_appointments; v_dur int;
begin
  select dono_user_id into v_dono from public.estabelecimentos where id = p_estabelecimento_id;
  if v_dono is distinct from auth.uid() then raise exception 'Não autorizado'; end if;
  if coalesce(trim(p_horario), '') = '' or p_dia is null then raise exception 'Escolha o dia e o horário.'; end if;
  v_dur := public.vibe_duracao_servico(p_estabelecimento_id, p_servico);
  if p_horario ~ '^\d{1,2}:\d{2}$' and public.vibe_agenda_ocupada(p_estabelecimento_id, p_dia, p_staff_id, p_horario::time, v_dur) then
    raise exception 'Esse horário já está ocupado — escolha outro.';
  end if;
  begin
    insert into public.tenant_appointments
      (estabelecimento_id, cliente_nome, cliente_telefone, staff_id, staff_nome, servico, dia, dia_label, horario, status, origem, duracao_min)
    values
      (p_estabelecimento_id, p_cliente_nome, p_cliente_telefone, p_staff_id, p_staff_nome, p_servico, p_dia, p_dia_label, p_horario, 'confirmado', 'pdv', v_dur)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'Esse horário já está ocupado — escolha outro.';
  end;
  if p_cliente_telefone is not null and trim(p_cliente_telefone) <> '' then
    insert into public.tenant_clients (estabelecimento_id, telefone, nome)
    values (p_estabelecimento_id, trim(p_cliente_telefone), trim(p_cliente_nome))
    on conflict (estabelecimento_id, telefone)
    do update set nome = excluded.nome, ultima_visita = now(), total_visitas = tenant_clients.total_visitas + 1;
  end if;
  return v_row;
end;
$function$;

-- remarcar: confere o tempo todo do agendamento (sem contar ele mesmo)
create or replace function public.cliente_reagendar_agendamento(p_id uuid, p_telefone text, p_dia date, p_dia_label text, p_horario text)
returns boolean
language plpgsql security definer set search_path to 'public' as $function$
declare v_estab uuid; v_staff uuid; v_dur int; v_ok boolean := false;
begin
  select estabelecimento_id, staff_id, duracao_min into v_estab, v_staff, v_dur
  from public.tenant_appointments
  where id = p_id and cliente_telefone = p_telefone and status <> 'cancelado';
  if v_estab is null then raise exception 'Agendamento não encontrado.'; end if;
  if coalesce(trim(p_horario), '') = '' or p_dia is null then raise exception 'Escolha o dia e o horário.'; end if;
  if p_dia < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Esse dia já passou — escolha outro.'; end if;
  -- o horário existe e o atendimento inteiro cabe antes de fechar…
  if not exists (select 1 from public.vibe_agenda_slots_duracao(v_estab, p_dia, v_staff, v_dur) s where s.horario = p_horario)
     -- …e não encosta em outro (sem contar ele mesmo)
     or public.vibe_agenda_ocupada(v_estab, p_dia, v_staff, p_horario::time, v_dur, p_id) then
    raise exception 'Esse horário acabou de ficar indisponível — escolha outro.';
  end if;
  begin
    update public.tenant_appointments set dia = p_dia, dia_label = p_dia_label, horario = p_horario
    where id = p_id and cliente_telefone = p_telefone
    returning true into v_ok;
  exception when unique_violation then
    raise exception 'Esse horário acabou de ficar indisponível — escolha outro.';
  end;
  return coalesce(v_ok, false);
end;
$function$;

-- trocar o serviço: se o novo for mais longo, precisa caber
create or replace function public.cliente_trocar_servico_agendamento(p_id uuid, p_telefone text, p_servico text)
returns boolean
language plpgsql security definer set search_path to 'public' as $function$
declare v_ag public.tenant_appointments; v_dur int; v_ok boolean := false;
begin
  select * into v_ag from public.tenant_appointments
  where id = p_id and cliente_telefone = p_telefone and status <> 'cancelado';
  if v_ag.id is null then return false; end if;
  v_dur := public.vibe_duracao_servico(v_ag.estabelecimento_id, p_servico);
  if v_dur > v_ag.duracao_min and v_ag.horario ~ '^\d{1,2}:\d{2}$'
     and public.vibe_agenda_ocupada(v_ag.estabelecimento_id, v_ag.dia, v_ag.staff_id, v_ag.horario::time, v_dur, v_ag.id) then
    raise exception 'Esse serviço é mais demorado e não cabe nesse horário — remarque pra um horário com mais tempo livre.';
  end if;
  update public.tenant_appointments set servico = p_servico, duracao_min = v_dur
  where id = p_id and cliente_telefone = p_telefone and status <> 'cancelado'
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$function$;

-- duração do serviço (só o dono); salvar_servico continua como era
create or replace function public.tenant_admin_duracao_servico(p_estabelecimento_id uuid, p_id uuid, p_duracao_min int)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  update public.tenant_services
  set duracao_min = case when p_duracao_min is null then null else least(greatest(p_duracao_min, 15), 720) end
  where id = p_id and estabelecimento_id = p_estabelecimento_id;
  return found;
end;
$function$;
revoke execute on function public.tenant_admin_duracao_servico(uuid, uuid, int) from public, anon;
grant execute on function public.tenant_admin_duracao_servico(uuid, uuid, int) to authenticated;

-- estilo da foto do portfólio (só o dono)
create or replace function public.tenant_admin_estilo_foto(p_estabelecimento_id uuid, p_id uuid, p_estilo text)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  update public.tenant_gallery set estilo = nullif(left(trim(coalesce(p_estilo, '')), 40), '')
  where id = p_id and estabelecimento_id = p_estabelecimento_id;
  return found;
end;
$function$;
revoke execute on function public.tenant_admin_estilo_foto(uuid, uuid, text) from public, anon;
grant execute on function public.tenant_admin_estilo_foto(uuid, uuid, text) to authenticated;

create or replace function public.vibe_segmentos()
returns text[] language sql immutable set search_path to 'public' as $function$
  select array[
    -- agenda
    'barbearia','salao','manicure_pedicure','estetica','estetica_automotiva','tatuador',
    -- comida / loja
    'pizzaria','hamburgueria','lanchonete','restaurante','japonesa','marmitaria','acaiteria','sorveteria',
    'doceria','padaria','mercado','adega','petshop',
    -- serviços no local
    'borracharia','chaveiro','guincho','eletricista','encanador','pedreiro','vidraceiro','ar_condicionado',
    'dedetizacao','montador','diarista','jardinagem','assistencia_tecnica',
    'outro']::text[];
$function$;
