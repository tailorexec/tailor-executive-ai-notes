-- Bucket publico para downloads (ex.: APK do app).
insert into storage.buckets (id, name, public)
values ('downloads', 'downloads', true)
on conflict (id) do nothing;

drop policy if exists downloads_read on storage.objects;
create policy downloads_read on storage.objects for select using (bucket_id = 'downloads');

drop policy if exists downloads_admin on storage.objects;
create policy downloads_admin on storage.objects for all
  using (bucket_id = 'downloads' and public.is_admin())
  with check (bucket_id = 'downloads' and public.is_admin());
