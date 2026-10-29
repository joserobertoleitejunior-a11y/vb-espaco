-- Clientes do negócio: todo mundo que agenda, pede ou só acessa fica salvo,
-- com tudo que já se sabe dele.
--
-- Antes, o cliente só entrava na lista se o navegador chamasse
-- tenant_registrar_cliente (e só em alguns caminhos): agendar não salvava
-- ninguém. Agora o próprio banco cuida: cada agendamento/pedido novo (ou que
-- muda de status) recalcula o cadastro do cliente, e quem entra logado no site
-- aparece como "só acessou" até agendar ou pedir.
--
-- Sem apagar nada: só colunas novas e funções trocadas (mesma assinatura).

alter table public.tenant_clients
  add column if not exists acessos int not null default 0,
  add column if not exists agendamentos int not null default 0,
  add column if not exists pedidos int not null default 0,
  add column if not exists ultimo_acesso timestamptz,
  add column if not exists ultimo_agendamento timestamptz,
  add column if not exists ultimo_pedido timestamptz,
  add column if not exists ultimo_servico text,
  add column if not exists dados jsonb not null default '{}'::jsonb,
  add column if not exists origem text not null default 'acesso';

-- recalcula o cadastro de um cliente a partir do que ele já fez neste negócio
create or replace function public.vibe_recalcular_cliente(p_estab uuid, p_telefone text, p_nome text default null)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_tel text := public.vb_tel(p_telefone);
  v_ag int; v_ult_ag timestamptz; v_ped int; v_ult_ped timestamptz;
  v_serv text; v_det jsonb; v_nome_ag text;
  v_end text; v_ref text; v_ped_det jsonb; v_nome_ped text;
  v_dados jsonb; v_nome text;
begin
  if p_estab is null or length(v_tel) < 10 then return; end if;

  select count(*) filter (where status <> 'cancelado'), max(criado_em) filter (where status <> 'cancelado')
    into v_ag, v_ult_ag
  from public.tenant_appointments where estabelecimento_id = p_estab and public.vb_tel(cliente_telefone) = v_tel;
  select servico, detalhes, cliente_nome into v_serv, v_det, v_nome_ag
  from public.tenant_appointments where estabelecimento_id = p_estab and public.vb_tel(cliente_telefone) = v_tel
  order by criado_em desc limit 1;

  select count(*) filter (where status <> 'cancelado'), max(criado_em) filter (where status <> 'cancelado')
    into v_ped, v_ult_ped
  from public.delivery_pedidos where estabelecimento_id = p_estab and public.vb_tel(cliente_telefone) = v_tel;
  select endereco_entrega, referencia, detalhes, cliente_nome into v_end, v_ref, v_ped_det, v_nome_ped
  from public.delivery_pedidos where estabelecimento_id = p_estab and public.vb_tel(cliente_telefone) = v_tel
  order by criado_em desc limit 1;

  v_dados := jsonb_strip_nulls(jsonb_build_object(
    'endereco', nullif(trim(coalesce(v_end, '')), ''),
    'referencia', nullif(trim(coalesce(v_ref, '')), ''),
    'veiculo', nullif(v_ped_det ->> 'veiculo', ''),
    'modelo', nullif(v_ped_det ->> 'modelo', ''),
    'briefing', v_det
  ));
  v_nome := coalesce(nullif(trim(coalesce(p_nome, '')), ''), v_nome_ag, v_nome_ped, 'Cliente');

  insert into public.tenant_clients as c (estabelecimento_id, telefone, nome, primeira_visita, ultima_visita, total_visitas,
    agendamentos, pedidos, ultimo_agendamento, ultimo_pedido, ultimo_servico, dados, origem)
  values (p_estab, v_tel, v_nome, now(), now(), coalesce(v_ag, 0) + coalesce(v_ped, 0),
    coalesce(v_ag, 0), coalesce(v_ped, 0), v_ult_ag, v_ult_ped, v_serv, v_dados,
    case when coalesce(v_ag, 0) > 0 then 'agendamento' when coalesce(v_ped, 0) > 0 then 'pedido' else 'acesso' end)
  on conflict (estabelecimento_id, telefone) do update set
    nome = case when nullif(trim(coalesce(p_nome, '')), '') is not null then trim(p_nome) else c.nome end,
    agendamentos = coalesce(v_ag, 0), pedidos = coalesce(v_ped, 0),
    total_visitas = coalesce(v_ag, 0) + coalesce(v_ped, 0),
    ultimo_agendamento = v_ult_ag, ultimo_pedido = v_ult_ped, ultimo_servico = coalesce(v_serv, c.ultimo_servico),
    dados = c.dados || v_dados,
    ultima_visita = greatest(c.ultima_visita, coalesce(v_ult_ag, c.ultima_visita), coalesce(v_ult_ped, c.ultima_visita)),
    origem = case when coalesce(v_ag, 0) > 0 then 'agendamento' when coalesce(v_ped, 0) > 0 then 'pedido' else c.origem end;
end;
$$;
revoke all on function public.vibe_recalcular_cliente(uuid, text, text) from public, anon, authenticated;

create or replace function public.vibe_gatilho_cliente_agenda() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.vibe_recalcular_cliente(new.estabelecimento_id, new.cliente_telefone, new.cliente_nome);
  return new;
end;
$$;
create or replace trigger vibe_cliente_da_agenda
  after insert or update of status, cliente_telefone, cliente_nome on public.tenant_appointments
  for each row execute function public.vibe_gatilho_cliente_agenda();

create or replace function public.vibe_gatilho_cliente_pedido() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.vibe_recalcular_cliente(new.estabelecimento_id, new.cliente_telefone, new.cliente_nome);
  return new;
end;
$$;
create or replace trigger vibe_cliente_do_pedido
  after insert or update of status, cliente_telefone, cliente_nome on public.delivery_pedidos
  for each row execute function public.vibe_gatilho_cliente_pedido();

-- quem entrou logado no site (WhatsApp + senha) e ainda não agendou/pediu:
-- "só acessou". Conta 1 acesso por dia.
create or replace function public.tenant_registrar_acesso_cliente(p_estabelecimento_id uuid, p_token text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_tel text; v_nome text; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select s.telefone, c.nome into v_tel, v_nome
  from public.vb_cliente_sessoes s join public.vb_clientes_globais c on c.telefone = s.telefone
  where s.token_hash = public.vb_hash_token(p_token) and s.expira_em > now();
  if v_tel is null or not exists (select 1 from public.estabelecimentos where id = p_estabelecimento_id) then return; end if;
  insert into public.tenant_clients as c (estabelecimento_id, telefone, nome, primeira_visita, ultima_visita, total_visitas, acessos, ultimo_acesso, origem)
  values (p_estabelecimento_id, v_tel, v_nome, now(), now(), 0, 1, now(), 'acesso')
  on conflict (estabelecimento_id, telefone) do update set
    nome = v_nome,
    acessos = case when (c.ultimo_acesso at time zone 'America/Sao_Paulo')::date is distinct from v_hoje then c.acessos + 1 else c.acessos end,
    ultimo_acesso = now();
end;
$$;
grant execute on function public.tenant_registrar_acesso_cliente(uuid, text) to anon, authenticated;

-- a antiga aceitava qualquer nome/telefone digitado por qualquer um (dava pra
-- encher a lista de um negócio com nomes falsos): agora não faz nada
create or replace function public.tenant_registrar_cliente(p_estabelecimento_id uuid, p_nome text, p_telefone text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  return;
end;
$$;

-- a lista: quem teve atividade mais recente primeiro
create or replace function public.tenant_admin_listar_clientes(p_estabelecimento_id uuid)
returns setof public.tenant_clients
language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  return query
    select * from public.tenant_clients
    where estabelecimento_id = p_estabelecimento_id
    order by greatest(ultima_visita, coalesce(ultimo_acesso, ultima_visita)) desc;
end;
$$;

-- histórico: agora acha o cliente mesmo com o telefone escrito de outro jeito
create or replace function public.tenant_admin_historico_cliente(p_estabelecimento_id uuid, p_telefone text)
returns table(tipo text, data timestamptz, titulo text, detalhe text, staff_nome text)
language plpgsql security definer set search_path to 'public' as $$
declare v_tel text := public.vb_tel(p_telefone);
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  return query
    select 'agendamento'::text, (a.dia + coalesce(a.horario::time, '00:00'::time))::timestamptz, a.servico,
           case a.status when 'pendente' then 'Pendente' when 'confirmado' then 'Confirmado' when 'cancelado' then 'Cancelado' when 'concluido' then 'Concluído' else a.status end,
           a.staff_nome
    from public.tenant_appointments a
    where a.estabelecimento_id = p_estabelecimento_id and public.vb_tel(a.cliente_telefone) = v_tel
    union all
    select 'pedido'::text, p.criado_em, 'Pedido #' || p.numero,
           ('R$ ' || to_char(p.total, 'FM999999990.00')) || ' · ' ||
           case p.status when 'novo' then 'Novo' when 'preparando' then 'Preparando' when 'saiu_entrega' then 'A caminho' when 'concluido' then 'Concluído' when 'cancelado' then 'Cancelado' else p.status end,
           null::text
    from public.delivery_pedidos p
    where p.estabelecimento_id = p_estabelecimento_id and public.vb_tel(p.cliente_telefone) = v_tel
    union all
    select 'venda'::text, v.criado_em, v.descricao, ('R$ ' || to_char(v.valor, 'FM999999990.00')), v.staff_nome
    from public.tenant_vendas v
    where v.estabelecimento_id = p_estabelecimento_id and public.vb_tel(v.cliente_telefone) = v_tel
    order by 2 desc
    limit 50;
end;
$$;

-- quem já agendou/pediu antes desta correção entra na lista agora
do $$
declare r record;
begin
  for r in
    select estabelecimento_id e, cliente_telefone t from public.tenant_appointments
    union
    select estabelecimento_id, cliente_telefone from public.delivery_pedidos
  loop
    perform public.vibe_recalcular_cliente(r.e, r.t, null);
  end loop;
end $$;
