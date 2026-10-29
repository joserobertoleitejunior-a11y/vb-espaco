-- Fotos do cliente no pedido de orçamento/chamado (aplicado). Antes iam
-- dentro da observação, que o banco corta em 280 caracteres (cada link tem
-- ~150) — agora ficam em detalhes.fotos: até 3 links, e só links do bucket
-- cliente-anexos na pasta do próprio estabelecimento. Muda só esse trecho
-- da função (o resto fica igual): lê a definição atual e acrescenta.
do $$
declare d text;
begin
  select pg_get_functiondef('public.delivery_criar_pedido(uuid,text,text,jsonb,text,text,text,text,numeric,text,numeric,numeric,jsonb)'::regprocedure) into d;
  if position('cliente-anexos' in d) > 0 then return; end if;
  d := replace(d, E'::numeric) end\n    ));', E'::numeric) end,\n      ''fotos'', (select jsonb_agg(f) from (\n        select f from jsonb_array_elements_text(case when jsonb_typeof(p_detalhes->''fotos'') = ''array'' then p_detalhes->''fotos'' else ''[]''::jsonb end) f\n        where f ~ (''^https://[a-z0-9]+\\.supabase\\.co/storage/v1/object/public/cliente-anexos/'' || e.id::text || ''/[A-Za-z0-9._-]+$'')\n        limit 3) x)\n    ));');
  if position('cliente-anexos' in d) = 0 then raise exception 'trecho de detalhes não encontrado — nada mudou'; end if;
  execute d;
end $$;
