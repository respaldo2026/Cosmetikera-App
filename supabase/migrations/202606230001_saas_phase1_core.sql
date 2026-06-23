-- =====================================================
-- SaaS Fase 1 (single Supabase project)
-- Base multi-tenant sin tocar todavía tablas operativas
-- =====================================================

create extension if not exists pgcrypto;

-- =====================================================
-- TABLA: tenants
-- =====================================================
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  estado text not null default 'active' check (estado in ('active', 'inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index if not exists idx_tenants_estado on public.tenants (estado);

-- =====================================================
-- TABLA: tenant_memberships
-- =====================================================
create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  is_default boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists idx_tenant_memberships_user on public.tenant_memberships (user_id);
create index if not exists idx_tenant_memberships_tenant on public.tenant_memberships (tenant_id);

-- Garantiza un solo tenant por defecto por usuario
create unique index if not exists uq_tenant_memberships_default_per_user
  on public.tenant_memberships (user_id)
  where is_default = true;

-- =====================================================
-- UTILIDADES SQL PARA RLS FUTURA
-- =====================================================
create or replace function public.current_tenant_slug()
returns text
language sql
stable
as $$
  select nullif((auth.jwt() ->> 'tenant_slug'), '');
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select t.id
  from public.tenants t
  where t.slug = public.current_tenant_slug()
  limit 1;
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
  );
$$;

-- =====================================================
-- TRIGGER updated_at
-- =====================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at
before update on public.tenants
for each row
execute function public.set_updated_at();

drop trigger if exists trg_tenant_memberships_updated_at on public.tenant_memberships;
create trigger trg_tenant_memberships_updated_at
before update on public.tenant_memberships
for each row
execute function public.set_updated_at();

-- =====================================================
-- RLS BASE (solo en tablas SaaS nuevas)
-- =====================================================
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;

-- tenants: visible para miembros

drop policy if exists "tenants_select_member" on public.tenants;
create policy "tenants_select_member"
  on public.tenants
  for select
  to authenticated
  using (public.is_tenant_member(id));

-- tenant_memberships: cada usuario ve sus membresias

drop policy if exists "tenant_memberships_select_own" on public.tenant_memberships;
create policy "tenant_memberships_select_own"
  on public.tenant_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- tenant_memberships: admin/owner del tenant puede crear membresias

drop policy if exists "tenant_memberships_insert_admin" on public.tenant_memberships;
create policy "tenant_memberships_insert_admin"
  on public.tenant_memberships
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

-- tenant_memberships: admin/owner del tenant puede actualizar membresias

drop policy if exists "tenant_memberships_update_admin" on public.tenant_memberships;
create policy "tenant_memberships_update_admin"
  on public.tenant_memberships
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- tenant_memberships: admin/owner del tenant puede eliminar membresias

drop policy if exists "tenant_memberships_delete_admin" on public.tenant_memberships;
create policy "tenant_memberships_delete_admin"
  on public.tenant_memberships
  for delete
  to authenticated
  using (public.is_tenant_admin(tenant_id));

-- =====================================================
-- SEED INICIAL: tenant principal y membresia para usuarios existentes
-- =====================================================
insert into public.tenants (slug, nombre)
values ('principal', 'Tienda Principal')
on conflict (slug) do nothing;

insert into public.tenant_memberships (tenant_id, user_id, role, is_default)
select
  t.id,
  u.id,
  case
    when lower(coalesce(u.email, '')) = 'admin@gmail.com' then 'owner'
    else 'staff'
  end as role,
  true as is_default
from auth.users u
join public.tenants t on t.slug = 'principal'
left join public.tenant_memberships tm
  on tm.tenant_id = t.id
 and tm.user_id = u.id
where tm.id is null;
