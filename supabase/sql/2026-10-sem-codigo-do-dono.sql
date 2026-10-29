-- O dono do negócio não pode mais gerar código de senha para um cliente:
-- a conta do cliente vale para todos os negócios, então esse código dava ao
-- dono acesso à conta inteira. A função continua existindo, mas só recusa.
create or replace function public.tenant_admin_codigo_cliente(p_estabelecimento_id uuid, p_telefone text) returns text
language plpgsql security definer set search_path to 'public' as $$
begin
  raise exception 'Desativado: o cliente redefine a própria senha.';
end;
$$;
revoke execute on function public.tenant_admin_codigo_cliente(uuid, text) from public, anon, authenticated;
