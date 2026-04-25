-- Consecutivo de facturacion/ticket para ventas
-- Objetivo: iniciar en 1000 y mantener numeracion unica y persistente.

DO $$
BEGIN
  IF to_regclass('public.ventas') IS NULL THEN
    RAISE NOTICE 'Tabla public.ventas no existe en este entorno. Se omite migracion.';
    RETURN;
  END IF;

  IF to_regclass('public.ventas_numero_ticket_seq') IS NULL THEN
    CREATE SEQUENCE public.ventas_numero_ticket_seq START WITH 1000 INCREMENT BY 1;
  END IF;

  ALTER TABLE public.ventas
    ADD COLUMN IF NOT EXISTS numero_ticket bigint;

  ALTER TABLE public.ventas
    ALTER COLUMN numero_ticket SET DEFAULT nextval('public.ventas_numero_ticket_seq');

  -- Rellenar ventas antiguas sin numero_ticket con un consecutivo estable.
  WITH base AS (
    SELECT GREATEST(COALESCE(MAX(numero_ticket), 999), 999) AS max_actual
    FROM public.ventas
  ),
  pendientes AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(fecha, now()), id) AS rn
    FROM public.ventas
    WHERE numero_ticket IS NULL
  )
  UPDATE public.ventas v
  SET numero_ticket = base.max_actual + pendientes.rn
  FROM base, pendientes
  WHERE v.id = pendientes.id;

  PERFORM setval(
    'public.ventas_numero_ticket_seq',
    GREATEST(COALESCE((SELECT MAX(numero_ticket) FROM public.ventas), 999), 999),
    true
  );

  CREATE UNIQUE INDEX IF NOT EXISTS ventas_numero_ticket_key
    ON public.ventas(numero_ticket);
END
$$;
