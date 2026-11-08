-- Pagamento da mensalidade (Mercado Pago) + "Meu plano" no painel + repasse das comissões dos criadores.
-- Rodar DEPOIS de 2026_11_historico_do_funcionario.sql e 2026_11_criadores_indicacao_anuncios.sql.
-- Seguro rodar mais de uma vez.

-- ===== 1) chave geral: cobrança desligada até você decidir (enquanto 'nao', o painel mostra o aviso de grátis) =====
create table if not exists public.plataforma_config (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.plataforma_config enable row level security;
revoke all on public.plataforma_config from anon, authenticated;
insert into public.plataforma_config (chave, valor) values
  ('cobranca_ativa', 'nao'),
  ('repasse_dia', '10'),
  ('repasse_minimo', '20.00')
on conflict (chave) do nothing;

create or replace function public.plataforma_cobranca_ativa()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select valor = 'sim' from public.plataforma_config where chave = 'cobranca_ativa'), false)
$$;
grant execute on function public.plataforma_cobranca_ativa() to anon, authenticated;

-- ===== 2) "Meu plano" (dono) =====
create or replace function public.meu_plano(p_estabelecimento_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e record; s jsonb;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  select id, nome, mensalidade, ia_turbo, pagamento_status, trial_termina_em into e from public.estabelecimentos where id = p_estabelecimento_id;
  s := public.assistente_situacao(p_estabelecimento_id);
  return jsonb_build_object(
    'plano', s->>'plano', 'plano_nome', s->>'plano_nome', 'mensalidade', e.mensalidade,
    'creditos_mes', (s->>'creditos_mes')::int, 'usados_mes', (s->>'usados_mes')::int, 'renova_em', s->>'renova_em',
    'ia_completa', coalesce(e.ia_turbo, false), 'pagamento_status', e.pagamento_status, 'valido_ate', e.trial_termina_em,
    'cobranca_ativa', public.plataforma_cobranca_ativa(),
    'preco_completo', (select preco_mensal from public.assistente_planos where plano = 'completo')
  );
end $$;
grant execute on function public.meu_plano(uuid) to authenticated;

-- o dono liga/desliga a "IA completa" (Matriz Completo: 400 créditos, R$ 34,90); a mensalidade acompanha sozinha
create or replace function public.meu_plano_ia_completa(p_estabelecimento_id uuid, p_ligada boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  update public.estabelecimentos set ia_turbo = coalesce(p_ligada, false) where id = p_estabelecimento_id;
end $$;
grant execute on function public.meu_plano_ia_completa(uuid, boolean) to authenticated;

-- ===== 3) repasse das comissões (só admin da plataforma) =====
-- Regra: paga no dia {repasse_dia} do mês seguinte, só comissões de meses já fechados, a partir de {repasse_minimo}.
create or replace function public.admin_repasses_pendentes()
returns table (criador_id uuid, nome text, instagram text, cidade text, qtd bigint, valor numeric, pode_pagar boolean, ate date)
language plpgsql stable security definer set search_path = public as $$
declare v_ate date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date - 1);
        v_min numeric := coalesce((select valor::numeric from public.plataforma_config where chave = 'repasse_minimo'), 20);
begin
  if not exists (select 1 from public.vb_plataforma_admins where user_id = auth.uid()) then raise exception 'Só o admin da plataforma pode ver isso.'; end if;
  return query
    select k.id, k.nome, k.instagram, k.cidade, count(c.id), sum(c.valor), sum(c.valor) >= v_min, v_ate
    from public.criador_comissoes c join public.criadores k on k.id = c.criador_id
    where c.status = 'a_pagar' and c.competencia <= v_ate
    group by k.id, k.nome, k.instagram, k.cidade
    order by sum(c.valor) desc;
end $$;
grant execute on function public.admin_repasses_pendentes() to authenticated;

create or replace function public.admin_repasse_marcar_pago(p_criador_id uuid, p_ate date)
returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  if not exists (select 1 from public.vb_plataforma_admins where user_id = auth.uid()) then raise exception 'Só o admin da plataforma pode fazer isso.'; end if;
  update public.criador_comissoes set status = 'paga', paga_em = now()
    where criador_id = p_criador_id and status = 'a_pagar' and competencia <= p_ate;
  get diagnostics v = row_count;
  return v;
end $$;
grant execute on function public.admin_repasse_marcar_pago(uuid, date) to authenticated;
