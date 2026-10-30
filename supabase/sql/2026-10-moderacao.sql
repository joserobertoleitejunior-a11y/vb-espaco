-- Moderação da plataforma: só quem está em vb_plataforma_admins lista e apaga contas.
-- Toda remoção fica registrada (quem, quando, motivo/denúncia).
create table if not exists public.vb_plataforma_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.vb_plataforma_admins enable row level security;

create table if not exists public.vb_moderacao_log (
  id uuid primary key default gen_random_uuid(),
  quando timestamptz not null default now(),
  admin_id uuid,
  estabelecimento_id uuid,
  nome text, slug text, cidade text, dono_email text,
  motivo text not null,
  detalhe text,
  login_apagado boolean not null default false
);
alter table public.vb_moderacao_log enable row level security;

insert into public.vb_plataforma_admins (user_id)
select id from auth.users where email in ('joserobertoleitejunior@gmail.com', 'joserobertoleitejunior@outlook.com')
on conflict do nothing;

create or replace function public.vb_exigir_admin() returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.vb_plataforma_admins where user_id = auth.uid()) then
    raise exception 'Sem acesso.';
  end if;
end;
$$;
revoke all on function public.vb_exigir_admin() from public, anon, authenticated;

create or replace function public.admin_sou_admin() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is not null and exists (select 1 from public.vb_plataforma_admins where user_id = auth.uid());
$$;
grant execute on function public.admin_sou_admin() to authenticated;

create or replace function public.admin_listar_negocios(p_busca text default null)
returns table(id uuid, nome text, slug text, cidade text, segmento text, dono_email text, criado_em timestamptz, agendamentos bigint, clientes bigint, outros_negocios bigint)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.vb_exigir_admin();
  return query
    select e.id, e.nome, e.slug, e.cidade, e.segmento,
           (select u.email::text from auth.users u where u.id = e.dono_user_id),
           e.criado_em,
           (select count(*) from public.tenant_appointments a where a.estabelecimento_id = e.id),
           (select count(*) from public.tenant_clients c where c.estabelecimento_id = e.id),
           (select count(*) from public.estabelecimentos o where o.dono_user_id = e.dono_user_id and o.id <> e.id)
    from public.estabelecimentos e
    where p_busca is null or btrim(p_busca) = ''
       or e.nome ilike '%' || btrim(p_busca) || '%' or e.slug ilike '%' || btrim(p_busca) || '%'
       or exists (select 1 from auth.users u where u.id = e.dono_user_id and u.email ilike '%' || btrim(p_busca) || '%')
    order by e.criado_em desc
    limit 100;
end;
$$;
grant execute on function public.admin_listar_negocios(text) to authenticated;

create or replace function public.admin_listar_moderacao()
returns setof public.vb_moderacao_log
language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.vb_exigir_admin();
  return query select * from public.vb_moderacao_log order by quando desc limit 50;
end;
$$;
grant execute on function public.admin_listar_moderacao() to authenticated;

-- apaga o negócio (e tudo que é dele) e, se pedido, o login do dono (só se ele não tiver outro negócio)
create or replace function public.admin_apagar_negocio(p_id uuid, p_motivo text, p_detalhe text default null, p_apagar_login boolean default false)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare e public.estabelecimentos; v_email text; v_login boolean := false;
begin
  perform public.vb_exigir_admin();
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Diga o motivo.'; end if;
  select * into e from public.estabelecimentos where id = p_id;
  if e.id is null then raise exception 'Negócio não encontrado.'; end if;
  select u.email::text into v_email from auth.users u where u.id = e.dono_user_id;
  if e.dono_user_id = auth.uid() and p_apagar_login then raise exception 'Você não pode apagar o seu próprio login por aqui.'; end if;
  if exists (select 1 from public.vb_plataforma_admins where user_id = e.dono_user_id) and e.dono_user_id <> auth.uid() then
    raise exception 'Esse negócio é de outro administrador.';
  end if;

  delete from public.estabelecimentos where id = p_id;

  if p_apagar_login and e.dono_user_id is not null
     and not exists (select 1 from public.estabelecimentos where dono_user_id = e.dono_user_id) then
    delete from auth.users where id = e.dono_user_id;
    v_login := true;
  end if;

  insert into public.vb_moderacao_log (admin_id, estabelecimento_id, nome, slug, cidade, dono_email, motivo, detalhe, login_apagado)
  values (auth.uid(), e.id, e.nome, e.slug, e.cidade, v_email, btrim(p_motivo), nullif(btrim(coalesce(p_detalhe, '')), ''), v_login);
  return jsonb_build_object('ok', true, 'login_apagado', v_login);
end;
$$;
grant execute on function public.admin_apagar_negocio(uuid, text, text, boolean) to authenticated;
