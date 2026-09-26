-- A nova área de fotos é aditiva: nenhuma tabela ou registro existente é recriado.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('fotos-animais','fotos-animais',false,3670016,array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "Proprietario envia foto de animal" on storage.objects
for insert to authenticated
with check (bucket_id = 'fotos-animais' and exists (
  select 1 from public.fazendas f
  where f.id::text = split_part(name,'/',1) and f.proprietario_id = (select auth.uid())
));
create policy "Proprietario ve foto de animal" on storage.objects
for select to authenticated
using (bucket_id = 'fotos-animais' and exists (
  select 1 from public.fazendas f
  where f.id::text = split_part(name,'/',1) and f.proprietario_id = (select auth.uid())
));
create policy "Proprietario remove foto de animal" on storage.objects
for delete to authenticated
using (bucket_id = 'fotos-animais' and exists (
  select 1 from public.fazendas f
  where f.id::text = split_part(name,'/',1) and f.proprietario_id = (select auth.uid())
));
