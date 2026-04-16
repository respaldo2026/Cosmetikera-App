-- Ajusta RLS para permitir que perfiles con rol adecuado editen agent_settings
-- Incluye director y servicio, y aplica la misma condición en USING y WITH CHECK

drop policy if exists "Admins gestionan agent_settings" on public.agent_settings;
create policy "Admins gestionan agent_settings"
  on public.agent_settings
  for all
  to authenticated
  using (
    auth.role() = 'service_role'
    or auth.uid() in (
      select id from public.perfiles where rol in ('desarrollo', 'administrador', 'admin', 'director')
    )
  )
  with check (
    auth.role() = 'service_role'
    or auth.uid() in (
      select id from public.perfiles where rol in ('desarrollo', 'administrador', 'admin', 'director')
    )
  );
