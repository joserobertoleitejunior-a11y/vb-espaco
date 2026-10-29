-- Resumo do painel: o dinheiro que entrou soma as vendas do Caixa e os pedidos
-- de Delivery/Serviços concluídos (antes só contava o Caixa).
create or replace function public.tenant_admin_dashboard_resumo(p_estabelecimento_id uuid, p_dias integer default 14)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_dono uuid; v_result json;
begin
  select dono_user_id into v_dono from public.estabelecimentos where id = p_estabelecimento_id;
  if v_dono is distinct from auth.uid() then raise exception 'Não autorizado'; end if;

  with entradas as (
    select criado_em, valor, descricao from public.tenant_vendas where estabelecimento_id = p_estabelecimento_id
    union all
    select criado_em, total, 'Pedido #' || numero from public.delivery_pedidos where estabelecimento_id = p_estabelecimento_id and status = 'concluido'
  )
  select json_build_object(
    'faturamento_por_dia', (
      select coalesce(json_agg(json_build_object('dia', to_char(d.dia, 'DD/MM'), 'total', coalesce(v.total, 0)) order by d.dia), '[]'::json)
      from generate_series((current_date - (p_dias - 1)), current_date, interval '1 day') as d(dia)
      left join (select date(criado_em) as dia, sum(valor) as total from entradas group by date(criado_em)) v on v.dia = d.dia
    ),
    'total_periodo', (select coalesce(sum(valor), 0) from entradas where criado_em >= current_date - (p_dias - 1)),
    'total_hoje', (select coalesce(sum(valor), 0) from entradas where date(criado_em) = current_date),
    'agendamentos_por_status', (
      select coalesce(json_object_agg(status, qtd), '{}'::json)
      from (select status, count(*) as qtd from public.tenant_appointments where estabelecimento_id = p_estabelecimento_id group by status) s
    ),
    'agendamentos_periodo', (select count(*) from public.tenant_appointments where estabelecimento_id = p_estabelecimento_id and criado_em >= current_date - (p_dias - 1)),
    'pedidos_periodo', (select count(*) from public.delivery_pedidos where estabelecimento_id = p_estabelecimento_id and status <> 'cancelado' and criado_em >= current_date - (p_dias - 1)),
    'total_clientes', (select count(*) from public.tenant_clients where estabelecimento_id = p_estabelecimento_id),
    'clientes_novos_periodo', (select count(*) from public.tenant_clients where estabelecimento_id = p_estabelecimento_id and primeira_visita >= current_date - (p_dias - 1)),
    'top_servicos', (
      select coalesce(json_agg(json_build_object('nome', descricao, 'qtd', qtd, 'total', total) order by total desc), '[]'::json)
      from (select descricao, count(*) as qtd, sum(valor) as total from entradas where descricao not like 'Pedido #%' group by descricao order by sum(valor) desc limit 5) t
    )
  ) into v_result;
  return v_result;
end;
$$;
