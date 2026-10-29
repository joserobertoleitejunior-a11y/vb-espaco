-- Fotos que o cliente manda junto do orçamento/chamado/ideia da tatuagem
-- (assets/js/anexo-fotos.js). Bucket público só pra LEITURA pelo link: sem
-- política de SELECT, ninguém consegue listar as fotos dos outros — só
-- abre quem tem o link (que vai no pedido e no WhatsApp do negócio).
-- Envio: qualquer um (cliente não tem conta), mas só imagem, até 5 MB, e
-- só direto na pasta de um estabelecimento que existe.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cliente-anexos', 'cliente-anexos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.vibe_estab_existe(p_id text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.estabelecimentos where id::text = p_id);
$$;
grant execute on function public.vibe_estab_existe(text) to anon, authenticated;

create policy "cliente-anexos cliente envia" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'cliente-anexos'
    and array_length(storage.foldername(name), 1) = 1
    and public.vibe_estab_existe((storage.foldername(name))[1])
  );
