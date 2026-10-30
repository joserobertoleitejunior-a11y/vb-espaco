-- Foto de perfil do cliente (estilo Facebook): a mesma foto aparece ao lado do nome
-- dele em qualquer lugar. Vai pequena (256px, JPEG) guardada na própria conta global.
alter table public.vb_clientes_globais add column if not exists foto text;

create or replace function public.cliente_trocar_foto(p_token text, p_foto text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v_tel text := public.vb_cliente_do_token(p_token);
begin
  if v_tel is null then raise exception 'Entre na sua conta primeiro.'; end if;
  if p_foto is null or btrim(p_foto) = '' then
    update public.vb_clientes_globais set foto = null, atualizado_em = now() where telefone = v_tel;
    return true;
  end if;
  if p_foto !~ '^data:image/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$' then raise exception 'Foto inválida.'; end if;
  if length(p_foto) > 90000 then raise exception 'Foto muito pesada.'; end if;
  update public.vb_clientes_globais set foto = p_foto, atualizado_em = now() where telefone = v_tel;
  return true;
end;
$$;
grant execute on function public.cliente_trocar_foto(text, text) to anon, authenticated;

create or replace function public.cliente_sessao(p_token text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_tel text; v_nome text; v_foto text;
begin
  select s.telefone, c.nome, c.foto into v_tel, v_nome, v_foto from public.vb_cliente_sessoes s
  join public.vb_clientes_globais c on c.telefone = s.telefone
  where s.token_hash = public.vb_hash_token(p_token) and s.expira_em > now();
  if v_tel is null then return null; end if;
  return jsonb_build_object('telefone', v_tel, 'nome', v_nome, 'foto', v_foto);
end;
$$;

-- o dono só vê a foto de quem é cliente do negócio dele
create or replace function public.tenant_admin_fotos_clientes(p_estabelecimento_id uuid, p_telefones text[])
returns table(telefone text, foto text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  return query
    select t.tel, g.foto
    from unnest(p_telefones) as t(tel)
    join public.vb_clientes_globais g on g.telefone = public.vb_tel(t.tel)
    where g.foto is not null
      and (exists (select 1 from public.tenant_clients c where c.estabelecimento_id = p_estabelecimento_id and public.vb_tel(c.telefone) = g.telefone)
        or exists (select 1 from public.tenant_appointments a where a.estabelecimento_id = p_estabelecimento_id and public.vb_tel(a.cliente_telefone) = g.telefone)
        or exists (select 1 from public.delivery_pedidos p where p.estabelecimento_id = p_estabelecimento_id and public.vb_tel(p.cliente_telefone) = g.telefone))
    limit 300;
end;
$$;
grant execute on function public.tenant_admin_fotos_clientes(uuid, text[]) to authenticated;
