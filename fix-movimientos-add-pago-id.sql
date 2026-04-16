alter table public.movimientos_financieros
    add column if not exists pago_id uuid unique references public.pagos(id) on delete set null;

create index if not exists movimientos_financieros_pago_id_idx on public.movimientos_financieros (pago_id);
