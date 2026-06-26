-- =====================================================
-- Turnos de caja / apertura y cierre
-- =====================================================

create table if not exists public.caja_turnos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opened_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  base_apertura numeric(14,2) not null default 0,
  producido_efectivo numeric(14,2) not null default 0,
  efectivo_esperado numeric(14,2) not null default 0,
  efectivo_contado numeric(14,2) not null default 0,
  descuadre numeric(14,2) not null default 0,
  billetes jsonb not null default '{}'::jsonb,
  monedas jsonb not null default '{}'::jsonb,
  notas_apertura text,
  notas_cierre text,
  resumen jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_caja_turnos_tenant_estado on public.caja_turnos (tenant_id, estado);
create index if not exists idx_caja_turnos_tenant_opened_at on public.caja_turnos (tenant_id, opened_at desc);

create unique index if not exists uq_caja_turno_abierto_por_tenant
  on public.caja_turnos (tenant_id)
  where estado = 'abierto';

create or replace function public.caja_turno_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_caja_turnos_updated_at on public.caja_turnos;
create trigger trg_caja_turnos_updated_at
before update on public.caja_turnos
for each row
execute function public.caja_turno_set_updated_at();

alter table public.caja_turnos enable row level security;

drop policy if exists "caja_turnos_select_tenant" on public.caja_turnos;
create policy "caja_turnos_select_tenant"
  on public.caja_turnos
  for select
  to authenticated
  using (tenant_id = public.effective_tenant_id() and public.is_tenant_member(tenant_id));

drop policy if exists "caja_turnos_insert_tenant" on public.caja_turnos;
create policy "caja_turnos_insert_tenant"
  on public.caja_turnos
  for insert
  to authenticated
  with check (tenant_id = public.effective_tenant_id() and public.is_tenant_member(tenant_id));

drop policy if exists "caja_turnos_update_tenant" on public.caja_turnos;
create policy "caja_turnos_update_tenant"
  on public.caja_turnos
  for update
  to authenticated
  using (tenant_id = public.effective_tenant_id() and public.is_tenant_member(tenant_id))
  with check (tenant_id = public.effective_tenant_id() and public.is_tenant_member(tenant_id));
