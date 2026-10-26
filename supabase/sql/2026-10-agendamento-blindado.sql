-- Agendamento à prova de erro: não deixa marcar sem horário, em dia que já
-- passou, fora da grade do dia, nem dois clientes no mesmo horário com o
-- mesmo profissional (nem quando os dois tocam "Confirmar" ao mesmo tempo).
create unique index if not exists tenant_appointments_horario_unico
  on public.tenant_appointments (estabelecimento_id, dia, horario, coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status <> 'cancelado';

create or replace function public.tenant_criar_agendamento(
  p_estabelecimento_id uuid, p_cliente_nome text, p_cliente_telefone text, p_staff_id uuid, p_staff_nome text,
  p_servico text, p_dia date, p_dia_label text, p_horario text
) returns public.tenant_appointments
language plpgsql security definer set search_path = public as $$
declare v_row public.tenant_appointments;
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
  if not exists (select 1 from public.tenant_public_agenda_slots(p_estabelecimento_id, p_dia, p_staff_id) s where s.horario = p_horario and s.disponivel) then
    raise exception 'Esse horário acabou de ficar indisponível — escolha outro.';
  end if;
  begin
    insert into public.tenant_appointments (estabelecimento_id, cliente_nome, cliente_telefone, staff_id, staff_nome, servico, dia, dia_label, horario)
    values (p_estabelecimento_id, trim(p_cliente_nome), p_cliente_telefone, p_staff_id, p_staff_nome, p_servico, p_dia, p_dia_label, p_horario)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'Esse horário acabou de ficar indisponível — escolha outro.';
  end;
  return v_row;
end;
$$;

-- remarcar (cliente): mesmas regras do agendamento novo
create or replace function public.cliente_reagendar_agendamento(p_id uuid, p_telefone text, p_dia date, p_dia_label text, p_horario text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_estab uuid; v_staff uuid; v_ok boolean := false;
begin
  select estabelecimento_id, staff_id into v_estab, v_staff
  from public.tenant_appointments
  where id = p_id and cliente_telefone = p_telefone and status <> 'cancelado';
  if v_estab is null then raise exception 'Agendamento não encontrado.'; end if;
  if coalesce(trim(p_horario), '') = '' or p_dia is null then raise exception 'Escolha o dia e o horário.'; end if;
  if p_dia < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Esse dia já passou — escolha outro.'; end if;
  if not exists (select 1 from public.tenant_public_agenda_slots(v_estab, p_dia, v_staff) s where s.horario = p_horario and s.disponivel) then
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
$$;

-- dono: encaixe pelo caixa e mudança de status com aviso claro se o horário já estiver tomado
create or replace function public.tenant_admin_criar_agendamento(p_estabelecimento_id uuid, p_cliente_nome text, p_cliente_telefone text, p_staff_id uuid, p_staff_nome text, p_servico text, p_dia date, p_dia_label text, p_horario text)
returns public.tenant_appointments language plpgsql security definer set search_path = public as $$
declare v_dono uuid; v_row public.tenant_appointments;
begin
  select dono_user_id into v_dono from public.estabelecimentos where id = p_estabelecimento_id;
  if v_dono is distinct from auth.uid() then raise exception 'Não autorizado'; end if;
  if coalesce(trim(p_horario), '') = '' or p_dia is null then raise exception 'Escolha o dia e o horário.'; end if;
  begin
    insert into public.tenant_appointments
      (estabelecimento_id, cliente_nome, cliente_telefone, staff_id, staff_nome, servico, dia, dia_label, horario, status, origem)
    values
      (p_estabelecimento_id, p_cliente_nome, p_cliente_telefone, p_staff_id, p_staff_nome, p_servico, p_dia, p_dia_label, p_horario, 'confirmado', 'pdv')
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
$$;

create or replace function public.tenant_admin_atualizar_agendamento(p_estabelecimento_id uuid, p_id uuid, p_status text)
returns public.tenant_appointments language plpgsql security definer set search_path = public as $$
declare v_row public.tenant_appointments;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  begin
    update public.tenant_appointments set status = p_status
    where id = p_id and estabelecimento_id = p_estabelecimento_id
    returning * into v_row;
  exception when unique_violation then
    raise exception 'Outro cliente já está marcado nesse horário — não dá pra reativar esse agendamento.';
  end;
  return v_row;
end;
$$;
