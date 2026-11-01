-- Anúncios: além de "visto" e "clique", conta quem AGENDOU ou PEDIU depois de vir pelo anúncio.
-- O site manda o id do anúncio junto com o id do agendamento/pedido recém-criado; o banco
-- confere que o agendamento é mesmo desse negócio e é de agora (30 min) antes de contar,
-- e cada agendamento/pedido conta uma vez só.
alter table public.anuncios add column if not exists agendamentos int not null default 0;
alter table public.anuncios add column if not exists pedidos int not null default 0;

create table if not exists public.anuncio_conversoes (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.anuncios(id) on delete cascade,
  tipo text not null check (tipo in ('agendamento', 'pedido')),
  ref_id uuid not null unique,
  criado_em timestamptz not null default now()
);
alter table public.anuncio_conversoes enable row level security;

create or replace function public.anuncio_converter(p_id uuid, p_tipo text, p_ref uuid)
returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v_estab uuid; v_ok boolean := false; v_novo int;
begin
  select estabelecimento_id into v_estab from public.anuncios where id = p_id;
  if v_estab is null or p_ref is null then return false; end if;
  if p_tipo = 'agendamento' then
    v_ok := exists (select 1 from public.tenant_appointments a where a.id = p_ref and a.estabelecimento_id = v_estab and a.criado_em > now() - interval '30 minutes');
  elsif p_tipo = 'pedido' then
    v_ok := exists (select 1 from public.delivery_pedidos d where d.id = p_ref and d.estabelecimento_id = v_estab and d.criado_em > now() - interval '30 minutes');
  end if;
  if not v_ok then return false; end if;
  insert into public.anuncio_conversoes (anuncio_id, tipo, ref_id) values (p_id, p_tipo, p_ref) on conflict (ref_id) do nothing;
  get diagnostics v_novo = row_count;
  if v_novo = 0 then return false; end if;
  update public.anuncios set agendamentos = agendamentos + case when p_tipo = 'agendamento' then 1 else 0 end,
                             pedidos = pedidos + case when p_tipo = 'pedido' then 1 else 0 end
  where id = p_id;
  return true;
end;
$$;
grant execute on function public.anuncio_converter(uuid, text, uuid) to anon, authenticated;
