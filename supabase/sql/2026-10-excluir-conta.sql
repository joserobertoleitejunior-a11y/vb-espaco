-- LGPD: o dono apaga a própria conta. Tudo que é dele cai junto por
-- cascata a partir de auth.users (estabelecimentos → serviços, agenda,
-- clientes, vendas, cardápio, anúncios…). Exige digitar EXCLUIR.
create or replace function public.vibe_excluir_minha_conta(p_confirmacao text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Entre na sua conta pra excluir.';
  end if;
  if coalesce(upper(trim(p_confirmacao)), '') <> 'EXCLUIR' then
    raise exception 'Digite EXCLUIR pra confirmar.';
  end if;
  delete from auth.users where id = v_uid;
  return true;
end;
$$;

revoke all on function public.vibe_excluir_minha_conta(text) from public, anon;
grant execute on function public.vibe_excluir_minha_conta(text) to authenticated;
