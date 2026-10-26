-- Dados extras pro passo a passo da busca (assets/js/guia.js): a mesma
-- lista pública de listar_estabelecimentos + o que o guia precisa pra
-- comparar lojas de Pedir/Chamar (entrega, retirada, taxa, tempo, pedido
-- mínimo, onde atende e o menor preço do cardápio/serviços).
create or replace function public.guia_estabelecimentos(p_area text default null)
returns table (
  id uuid, nome text, slug text, cidade text, segmento text, cor_destaque text, template text,
  foto_perfil_url text, foto_capa_url text, foto_hero_url text, telefone_whatsapp text,
  endereco text, endereco_lat numeric, endereco_lng numeric, tem_promocao_ativa boolean,
  areas text[], aberto_agora boolean,
  servico_onde text, aceita_entrega boolean, aceita_retirada boolean, taxa_entrega numeric,
  tempo_entrega_min integer, tempo_entrega_max integer, pedido_minimo numeric, menor_preco numeric
)
language sql stable security definer set search_path = public as $$
  select l.id, l.nome, l.slug, l.cidade, l.segmento, l.cor_destaque, l.template,
         l.foto_perfil_url, l.foto_capa_url, l.foto_hero_url, l.telefone_whatsapp,
         l.endereco, l.endereco_lat, l.endereco_lng, l.tem_promocao_ativa,
         l.areas, l.aberto_agora,
         e.servico_onde, d.aceita_entrega, d.aceita_retirada, d.taxa_entrega,
         d.tempo_entrega_min, d.tempo_entrega_max, d.pedido_minimo,
         case when p_area in ('delivery', 'servicos')
           then (select min(i.preco) from public.delivery_cardapio_itens i where i.estabelecimento_id = l.id and i.ativo and i.preco > 0)
           else (select min(s.preco) from public.tenant_services s where s.estabelecimento_id = l.id and s.ativo and s.preco > 0)
         end as menor_preco
  from public.listar_estabelecimentos(null, null, p_area) l
  join public.estabelecimentos e on e.id = l.id
  left join public.delivery_estabelecimentos d on d.id = l.id and d.ativo;
$$;
revoke all on function public.guia_estabelecimentos(text) from public;
grant execute on function public.guia_estabelecimentos(text) to anon, authenticated;
