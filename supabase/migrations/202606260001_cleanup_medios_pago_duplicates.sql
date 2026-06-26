-- =====================================================
-- Limpieza y unicidad para medios_pago
-- =====================================================
-- Objetivo:
-- 1) Normalizar los codigos existentes.
-- 2) Eliminar duplicados conservando el registro mas antiguo.
-- 3) Garantizar unicidad futura por codigo.

update public.medios_pago
set codigo = lower(btrim(codigo))
where codigo is not null
  and codigo <> lower(btrim(codigo));

with ranked as (
  select
    ctid,
    row_number() over (
      partition by codigo
      order by created_at asc, id asc
    ) as rn
  from public.medios_pago
)
delete from public.medios_pago mp
using ranked r
where mp.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists uq_medios_pago_codigo
  on public.medios_pago (codigo);
