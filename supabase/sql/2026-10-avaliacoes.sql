-- Comentários de clientes sobre cada estabelecimento.
-- Aparecem embaixo dos painéis de destaque no passo a passo da busca e na
-- seção "O que dizem os clientes" do site de cada negócio.
-- Sem acesso direto à tabela: tudo passa pelas funções abaixo.

create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_nome text not null check (char_length(cliente_nome) between 2 and 60),
  cliente_telefone text,
  nota smallint not null check (nota between 1 and 5),
  comentario text not null check (char_length(comentario) between 3 and 400),
  oculta boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists avaliacoes_estab_idx on public.avaliacoes (estabelecimento_id, criado_em desc);
alter table public.avaliacoes enable row level security;

-- últimos comentários visíveis (só o primeiro nome de quem escreveu)
create or replace function public.avaliacoes_publicas(p_estabelecimento_id uuid, p_limite int default 3)
returns table (cliente_nome text, nota smallint, comentario text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select split_part(trim(a.cliente_nome), ' ', 1), a.nota, a.comentario, a.criado_em
  from public.avaliacoes a
  where a.estabelecimento_id = p_estabelecimento_id and not a.oculta
  order by a.criado_em desc
  limit least(greatest(coalesce(p_limite, 3), 1), 20);
$$;

-- média e total de vários estabelecimentos de uma vez (pra ranquear no passo a passo)
create or replace function public.avaliacoes_resumo(p_ids uuid[])
returns table (estabelecimento_id uuid, media numeric, total int)
language sql stable security definer set search_path = public as $$
  select a.estabelecimento_id, round(avg(a.nota)::numeric, 1), count(*)::int
  from public.avaliacoes a
  where a.estabelecimento_id = any (p_ids) and not a.oculta
  group by a.estabelecimento_id;
$$;

-- novo comentário: 1 por telefone a cada 24h no mesmo lugar, e no máximo 30 por hora por lugar
create or replace function public.avaliacao_criar(
  p_estabelecimento_id uuid, p_nome text, p_telefone text, p_nota int, p_comentario text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_id uuid;
begin
  if char_length(v_tel) < 10 then raise exception 'Informe seu WhatsApp com DDD.'; end if;
  if not exists (select 1 from public.estabelecimentos where id = p_estabelecimento_id) then
    raise exception 'Estabelecimento não encontrado.';
  end if;
  if exists (select 1 from public.avaliacoes where estabelecimento_id = p_estabelecimento_id
             and cliente_telefone = v_tel and criado_em > now() - interval '24 hours') then
    raise exception 'Você já deixou um comentário aqui hoje. Obrigado!';
  end if;
  if (select count(*) from public.avaliacoes where estabelecimento_id = p_estabelecimento_id
      and criado_em > now() - interval '1 hour') >= 30 then
    raise exception 'Muitos comentários agora — tenta de novo daqui a pouco.';
  end if;
  insert into public.avaliacoes (estabelecimento_id, cliente_nome, cliente_telefone, nota, comentario)
  values (p_estabelecimento_id, trim(p_nome), v_tel, p_nota, trim(p_comentario))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.avaliacoes_publicas(uuid, int) from public;
revoke all on function public.avaliacoes_resumo(uuid[]) from public;
revoke all on function public.avaliacao_criar(uuid, text, text, int, text) from public;
grant execute on function public.avaliacoes_publicas(uuid, int) to anon, authenticated;
grant execute on function public.avaliacoes_resumo(uuid[]) to anon, authenticated;
grant execute on function public.avaliacao_criar(uuid, text, text, int, text) to anon, authenticated;
