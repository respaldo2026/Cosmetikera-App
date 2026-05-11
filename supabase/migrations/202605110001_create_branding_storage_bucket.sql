-- Create branding bucket for logos used in configuracion panel.
-- Idempotent migration: safe to run multiple times.

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update
set public = excluded.public,
    name = excluded.name;

-- Public read for branding assets.
drop policy if exists "Lectura publica branding" on storage.objects;
create policy "Lectura publica branding"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'branding');

-- Authenticated users can upload logos.
drop policy if exists "Subida branding autenticados" on storage.objects;
create policy "Subida branding autenticados"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'branding');

-- Authenticated users can update branding files.
drop policy if exists "Actualizacion branding autenticados" on storage.objects;
create policy "Actualizacion branding autenticados"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'branding')
  with check (bucket_id = 'branding');

-- Authenticated users can delete branding files.
drop policy if exists "Eliminacion branding autenticados" on storage.objects;
create policy "Eliminacion branding autenticados"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'branding');
