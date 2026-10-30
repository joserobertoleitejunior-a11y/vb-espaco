-- Moderação feita por conversa (Claude Code + Supabase), sem página no site.
-- Funções mod_*: só o administrador do banco chama (não ficam abertas pela internet).
-- Apagar exige digitar o nome do negócio e fica registrado em vb_moderacao_log.

-- fecha a moderação antiga pela página (não é mais usada)
revoke execute on function public.admin_listar_negocios(text) from authenticated;
revoke execute on function public.admin_listar_moderacao() from authenticated;
revoke execute on function public.admin_apagar_negocio(uuid, text, text, boolean) from authenticated;
revoke execute on function public.admin_sou_admin() from authenticated;

create or replace function public.mod_listar(p_busca text default null)
returns table(id uuid, nome text, slug text, cidade text, segmento text, dono_email text, criado_em timestamptz, agendamentos bigint, clientes bigint, outros_negocios bigint)
language sql stable security definer set search_path to 'public' as $$
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
$$;

create or replace function public.mod_historico()
returns setof public.vb_moderacao_log
language sql stable security definer set search_path to 'public' as $$
  select * from public.vb_moderacao_log order by quando desc limit 50;
$$;

create or replace function public.mod_apagar_negocio(p_id uuid, p_motivo text, p_confirmo text, p_detalhe text default null, p_apagar_login boolean default false)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare e public.estabelecimentos; v_email text; v_login boolean := false;
begin
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Diga o motivo.'; end if;
  select * into e from public.estabelecimentos where id = p_id;
  if e.id is null then raise exception 'Negócio não encontrado.'; end if;
  if lower(btrim(coalesce(p_confirmo, ''))) <> lower(btrim(e.nome)) then
    raise exception 'Confirmação errada: digite exatamente o nome do negócio (%).', e.nome;
  end if;
  select u.email::text into v_email from auth.users u where u.id = e.dono_user_id;

  delete from public.estabelecimentos where id = p_id;

  if p_apagar_login and e.dono_user_id is not null
     and not exists (select 1 from public.estabelecimentos where dono_user_id = e.dono_user_id) then
    delete from auth.users where id = e.dono_user_id;
    v_login := true;
  end if;

  insert into public.vb_moderacao_log (admin_id, estabelecimento_id, nome, slug, cidade, dono_email, motivo, detalhe, login_apagado)
  values (null, e.id, e.nome, e.slug, e.cidade, v_email, btrim(p_motivo), nullif(btrim(coalesce(p_detalhe, '')), ''), v_login);
  return jsonb_build_object('ok', true, 'nome', e.nome, 'login_apagado', v_login);
end;
$$;

-- só o administrador do banco (o Claude Code pelo Supabase) executa; ninguém pela internet
revoke all on function public.mod_listar(text) from public, anon, authenticated;
revoke all on function public.mod_historico() from public, anon, authenticated;
revoke all on function public.mod_apagar_negocio(uuid, text, text, text, boolean) from public, anon, authenticated;
