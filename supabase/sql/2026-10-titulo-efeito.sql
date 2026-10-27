-- Efeito do título do site (movimento, fonte e estilo), escolhido pelo dono
-- no passo a passo de edição (perfil.js e assets/pedidos/editar-loja.js);
-- desenhado por assets/js/titulo-efeitos.js. (aplicado)
alter table public.estabelecimentos add column if not exists titulo_efeito jsonb not null default '{}'::jsonb;

create or replace function public.titulo_efeito_publico(p_estabelecimento_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(titulo_efeito, '{}'::jsonb) from public.estabelecimentos where id = p_estabelecimento_id;
$$;
revoke all on function public.titulo_efeito_publico(uuid) from public;
grant execute on function public.titulo_efeito_publico(uuid) to anon, authenticated;

create or replace function public.tenant_admin_atualizar_titulo_efeito(p_estabelecimento_id uuid, p_efeito jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb := '{}'::jsonb; e jsonb := coalesce(p_efeito, '{}'::jsonb);
begin
  perform public.vibe_exigir_dono(p_estabelecimento_id);
  -- só guarda o que o site sabe desenhar
  if e->>'movimento' in ('surgir','digitar','onda','brilho','pulsar','faixa','girar') then v := v || jsonb_build_object('movimento', e->>'movimento'); end if;
  if e->>'fonte' in ('classica','moderna','impacto','manuscrita','elegante') then v := v || jsonb_build_object('fonte', e->>'fonte'); end if;
  if e->>'estilo' in ('degrade','contorno','neon','sombra','caixa') then v := v || jsonb_build_object('estilo', e->>'estilo'); end if;
  update public.estabelecimentos set titulo_efeito = v where id = p_estabelecimento_id;
  return v;
end;
$$;
revoke all on function public.tenant_admin_atualizar_titulo_efeito(uuid, jsonb) from public;
grant execute on function public.tenant_admin_atualizar_titulo_efeito(uuid, jsonb) to authenticated;
