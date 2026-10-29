-- Entrar com digital/rosto também pro dono do negócio (passkey).
-- A digital nunca sai do celular: aqui fica só a chave pública do aparelho,
-- ligada à conta do dono (auth.users). Some junto se a conta for excluída.
create table if not exists public.vb_dono_passkeys (
  id text primary key,                 -- credential id (base64url)
  user_id uuid not null references auth.users (id) on delete cascade,
  chave_spki text not null,
  alg int not null,
  rp_id text not null,
  contador bigint not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists vb_dono_passkeys_user on public.vb_dono_passkeys (user_id);
alter table public.vb_dono_passkeys enable row level security;

-- o desafio do dono fica preso à conta dele
alter table public.vb_cliente_desafios add column if not exists user_id uuid;

-- quantos aparelhos o dono tem com digital (pra mostrar no menu)
create or replace function public.dono_digitais() returns int
language sql stable security definer set search_path to 'public' as $$
  select count(*)::int from public.vb_dono_passkeys where user_id = auth.uid();
$$;
grant execute on function public.dono_digitais() to authenticated;
