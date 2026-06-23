-- =====================================================
-- SaaS Fase 2
-- Agregar tenant_id en tablas operativas + backfill inicial
-- =====================================================

-- Tenant por defecto (principal) para compatibilidad mientras migramos código.
create or replace function public.get_default_tenant_id()
returns uuid
language sql
stable
as $$
  select id
  from public.tenants
  where slug = 'principal'
  limit 1;
$$;

-- Añade tenant_id a tablas operativas sin romper producción.
do $$
declare
  table_name text;
  fk_name text;
begin
  foreach table_name in array array[
    'perfiles',
    'articulos',
    'ventas',
    'compras',
    'movimientos_financieros',
    'configuracion',
    'proveedores',
    'puntos_historial',
    'canjes',
    'club_inscripciones',
    'notificaciones_enviadas',
    'whatsapp_conversation_history',
    'whatsapp_customer_memory'
  ]
  loop
    execute format('alter table if exists public.%I add column if not exists tenant_id uuid', table_name);
    execute format('alter table if exists public.%I alter column tenant_id set default public.get_default_tenant_id()', table_name);

    execute format('update public.%I set tenant_id = public.get_default_tenant_id() where tenant_id is null', table_name);

    execute format('create index if not exists idx_%I_tenant_id on public.%I (tenant_id)', table_name, table_name);

    fk_name := table_name || '_tenant_id_fkey';
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where c.conname = fk_name
        and n.nspname = 'public'
        and t.relname = table_name
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (tenant_id) references public.tenants(id) on delete restrict',
        table_name,
        fk_name
      );
    end if;
  end loop;
end $$;

-- Ajuste de unicidad por tenant para referencia de artículos.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'articulos'
      and column_name = 'referencia'
  ) then
    create unique index if not exists uq_articulos_tenant_referencia
      on public.articulos (tenant_id, lower(referencia))
      where referencia is not null and btrim(referencia) <> '';
  end if;
end $$;

-- Incluye tenant_id en sincronización auth.users -> perfiles.
create or replace function public.sync_perfil_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  meta jsonb;
  v_rol text;
  v_nombre text;
  v_telefono text;
  v_identificacion text;
  v_tenant_id uuid;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_tenant_id := public.get_default_tenant_id();

  v_rol := lower(
    coalesce(
      nullif(meta->>'rol', ''),
      case
        when lower(coalesce(new.email, '')) = 'admin@gmail.com' then 'administrador'
        else 'cliente'
      end
    )
  );

  if v_rol in ('admin', 'director', 'administrativo') then
    v_rol := 'administrador';
  elsif v_rol in ('secretaria', 'asesor') then
    v_rol := 'vendedor';
  elsif v_rol in ('estudiante', 'egresado') then
    v_rol := 'cliente';
  elsif v_rol not in ('administrador', 'marketing', 'vendedor', 'cliente') then
    v_rol := 'cliente';
  end if;

  v_nombre := coalesce(
    nullif(meta->>'nombre_completo', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Usuario'
  );

  v_telefono := nullif(meta->>'telefono', '');
  v_identificacion := nullif(coalesce(meta->>'identificacion', meta->>'cedula'), '');

  insert into public.perfiles (
    id,
    tenant_id,
    email,
    nombre_completo,
    rol,
    telefono,
    identificacion,
    activo,
    updated_at
  )
  values (
    new.id,
    v_tenant_id,
    new.email,
    v_nombre,
    v_rol,
    v_telefono,
    v_identificacion,
    true,
    now()
  )
  on conflict (id)
  do update set
    tenant_id = coalesce(public.perfiles.tenant_id, excluded.tenant_id),
    email = excluded.email,
    nombre_completo = coalesce(nullif(public.perfiles.nombre_completo, ''), excluded.nombre_completo),
    rol = coalesce(public.perfiles.rol, excluded.rol),
    telefono = coalesce(public.perfiles.telefono, excluded.telefono),
    identificacion = coalesce(public.perfiles.identificacion, excluded.identificacion),
    activo = coalesce(public.perfiles.activo, true),
    updated_at = now();

  return new;
end;
$$;
