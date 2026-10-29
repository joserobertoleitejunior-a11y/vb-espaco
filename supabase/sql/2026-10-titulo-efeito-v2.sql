-- Efeito do título v2: mais movimentos (horizontais, verticais e ligados à
-- rolagem da página), onde aplicar (nome do negócio, frase ou os dois) e o
-- ponto de foco da foto do topo ("x y" em %). Mesma assinatura: só troca a
-- lista do que o site sabe desenhar.
create or replace function public.tenant_admin_atualizar_titulo_efeito(p_estabelecimento_id uuid, p_efeito jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v jsonb := '{}'::jsonb; e jsonb := coalesce(p_efeito, '{}'::jsonb);
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  if e->>'movimento' in ('surgir','digitar','onda','brilho','pulsar',
                         'faixa','faixa-direita','vaivem','dupla','rolar-h',
                         'girar','roleta','cascata','rolar-v') then
    v := v || jsonb_build_object('movimento', e->>'movimento');
  end if;
  if e->>'fonte' in ('classica','moderna','impacto','manuscrita','elegante') then v := v || jsonb_build_object('fonte', e->>'fonte'); end if;
  if e->>'estilo' in ('degrade','contorno','neon','sombra','caixa') then v := v || jsonb_build_object('estilo', e->>'estilo'); end if;
  if e->>'alvo' in ('nome','frase','ambos') then v := v || jsonb_build_object('alvo', e->>'alvo'); end if;
  if e->>'foco' ~ '^(100|[1-9]?[0-9]) (100|[1-9]?[0-9])$' then v := v || jsonb_build_object('foco', e->>'foco'); end if;
  update public.estabelecimentos set titulo_efeito = v where id = p_estabelecimento_id;
  return v;
end;
$function$;
