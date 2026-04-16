-- Tabla principal de movimientos financieros
create table if not exists public.movimientos_financieros (
    id uuid primary key default gen_random_uuid(),
    fecha date not null default current_date,
    tipo text not null check (tipo in ('ingreso', 'egreso')),
    monto numeric(12,2) not null check (monto >= 0),
    concepto text not null,
    categoria text,
    metodo_pago text,
    referencia text,
    descripcion text,
    estudiante_id uuid references public.perfiles(id) on delete set null,
    proveedor_id uuid references public.perfiles(id) on delete set null,
    ticket_url text,
    conciliado boolean not null default false,
    conciliado_el timestamp with time zone,
    conciliado_por uuid references auth.users(id),
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    created_by uuid references auth.users(id)
);

-- Índices para filtros comunes
create index if not exists movimientos_financieros_fecha_idx on public.movimientos_financieros (fecha desc);
create index if not exists movimientos_financieros_tipo_idx on public.movimientos_financieros (tipo);
create index if not exists movimientos_financieros_categoria_idx on public.movimientos_financieros (categoria);
create index if not exists movimientos_financieros_estudiante_idx on public.movimientos_financieros (estudiante_id);
create index if not exists movimientos_financieros_proveedor_idx on public.movimientos_financieros (proveedor_id);

-- Politicas RLS sugeridas (ajustar según roles reales)
alter table public.movimientos_financieros enable row level security;

create policy "movimientos read staff" on public.movimientos_financieros
    for select using (
        auth.role() in ('authenticated')
    );

create policy "movimientos insert tesoreria" on public.movimientos_financieros
    for insert with check (
        auth.role() in ('authenticated')
    );

create policy "movimientos update tesoreria" on public.movimientos_financieros
    for update using (
        auth.role() in ('authenticated')
    ) with check (
        auth.role() in ('authenticated')
    );

create policy "movimientos delete admin" on public.movimientos_financieros
    for delete using (
        auth.role() = 'service_role'
    );

-- Vista para saldo acumulado por día
create or replace view public.vw_movimientos_saldos_diarios as
select
    fecha,
    sum(case when tipo = 'ingreso' then monto else -monto end) as saldo_dia,
    sum(sum(case when tipo = 'ingreso' then monto else -monto end)) over (order by fecha rows between unbounded preceding and current row) as saldo_acumulado
from public.movimientos_financieros
group by fecha
order by fecha;
