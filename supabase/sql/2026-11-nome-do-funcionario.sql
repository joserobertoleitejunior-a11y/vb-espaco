-- O nome do funcionário digital é escolhido pelo DONO do estabelecimento e
-- fica no banco, não no aparelho: assim o nome segue o dono em qualquer
-- celular ou computador. Já aplicado no projeto (migração
-- 2026_11_nome_do_funcionario); fica aqui como histórico.
alter table public.estabelecimentos
  add column if not exists nome_assistente text;

create or replace function public.assistente_nome(p_estabelecimento_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  perform vibe_exigir_dono(p_estabelecimento_id);
  select nullif(btrim(nome_assistente), '') into v
    from estabelecimentos where id = p_estabelecimento_id;
  return v;
end;
$$;

create or replace function public.assistente_definir_nome(p_estabelecimento_id uuid, p_nome text)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  perform vibe_exigir_dono(p_estabelecimento_id);
  v := nullif(btrim(coalesce(p_nome, '')), '');
  if v is not null and length(v) > 20 then v := btrim(substring(v from 1 for 20)); end if;
  update estabelecimentos set nome_assistente = v where id = p_estabelecimento_id;
  return v;
end;
$$;

revoke all on function public.assistente_nome(uuid) from public, anon;
revoke all on function public.assistente_definir_nome(uuid, text) from public, anon;
grant execute on function public.assistente_nome(uuid) to authenticated;
grant execute on function public.assistente_definir_nome(uuid, text) to authenticated;
