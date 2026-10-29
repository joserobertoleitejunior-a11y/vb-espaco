-- Perguntas por tipo de negócio (aplicado): o editor pergunta coisas que
-- só fazem sentido pra cada um (tatuador: sinal, menor de idade, retoque;
-- pizzaria: meio a meio, sem glúten; eletricista: garantia, emergência…)
-- e o site mostra as respostas em "Bom saber". Sem mexer nas funções que
-- já existem: coluna nova + uma função pra salvar e outra pra ler.

alter table public.estabelecimentos add column if not exists respostas jsonb not null default '{}'::jsonb;

-- salva UMA resposta (o editor salva a cada toque); valor null apaga
create or replace function public.tenant_admin_salvar_resposta(p_estabelecimento_id uuid, p_chave text, p_valor jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v jsonb;
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  if p_chave !~ '^[a-z0-9_]{2,40}$' then raise exception 'Pergunta inválida.'; end if;
  if p_valor is not null and (jsonb_typeof(p_valor) not in ('string', 'boolean', 'number', 'array') or length(p_valor::text) > 400) then
    raise exception 'Resposta grande demais.';
  end if;
  update public.estabelecimentos
  set respostas = case when p_valor is null or p_valor = 'null'::jsonb then respostas - p_chave
                       else jsonb_set(respostas, array[p_chave], p_valor, true) end
  where id = p_estabelecimento_id
  returning respostas into v;
  if (select count(*) from jsonb_object_keys(v)) > 60 then raise exception 'Respostas demais.'; end if;
  return v;
end;
$function$;

-- respostas pro site (público)
create or replace function public.respostas_publicas(p_estabelecimento_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce((select respostas from public.estabelecimentos where id = p_estabelecimento_id and ativo is not false), '{}'::jsonb);
$$;

revoke execute on function public.tenant_admin_salvar_resposta(uuid, text, jsonb) from public, anon;
grant execute on function public.tenant_admin_salvar_resposta(uuid, text, jsonb) to authenticated;
grant execute on function public.respostas_publicas(uuid) to anon, authenticated;
