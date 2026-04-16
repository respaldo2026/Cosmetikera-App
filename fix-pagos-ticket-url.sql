alter table public.pagos
    add column if not exists ticket_url text;
