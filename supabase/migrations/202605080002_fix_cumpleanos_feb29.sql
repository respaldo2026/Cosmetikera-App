-- Fix: manejar cumpleaños del 29 de febrero en años no bisiestos.
-- Cuando un cliente nació el 29/02 y el año actual no es bisiesto,
-- make_date(año, 2, 29) lanza "date out of range". La solución es
-- usar el 28 de febrero como fecha equivalente en años no bisiestos.

CREATE OR REPLACE FUNCTION get_clientes_cumpleanos_proximos(
  dias_offset integer DEFAULT 0
)
RETURNS TABLE (
  perfil_id uuid,
  nombre_completo text,
  cedula text,
  telefono text,
  fecha_nacimiento date,
  dias_para_cumpleanos integer
) AS $$
DECLARE
  v_year_curr int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_year_next int := v_year_curr + 1;
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nombre_completo,
    p.cedula,
    p.telefono,
    p.fecha_nacimiento,
    -- Días hasta el próximo cumpleaños.
    -- Para Feb-29 en año no bisiesto se usa Feb-28 como equivalente.
    CASE
      WHEN (
        make_date(
          v_year_curr,
          EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
          LEAST(
            EXTRACT(DAY FROM p.fecha_nacimiento)::int,
            EXTRACT(DAY FROM (make_date(v_year_curr, EXTRACT(MONTH FROM p.fecha_nacimiento)::int, 1) + INTERVAL '1 month - 1 day'))::int
          )
        ) - CURRENT_DATE
      ) >= 0
      THEN (
        make_date(
          v_year_curr,
          EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
          LEAST(
            EXTRACT(DAY FROM p.fecha_nacimiento)::int,
            EXTRACT(DAY FROM (make_date(v_year_curr, EXTRACT(MONTH FROM p.fecha_nacimiento)::int, 1) + INTERVAL '1 month - 1 day'))::int
          )
        ) - CURRENT_DATE
      )
      ELSE (
        make_date(
          v_year_next,
          EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
          LEAST(
            EXTRACT(DAY FROM p.fecha_nacimiento)::int,
            EXTRACT(DAY FROM (make_date(v_year_next, EXTRACT(MONTH FROM p.fecha_nacimiento)::int, 1) + INTERVAL '1 month - 1 day'))::int
          )
        ) - CURRENT_DATE
      )
    END AS dias_para_cumpleanos
  FROM public.perfiles p
  WHERE
    p.fecha_nacimiento IS NOT NULL
    AND p.telefono IS NOT NULL
    AND (p.rol = 'cliente' OR p.rol IS NULL)
    AND (
      CASE
        WHEN (
          make_date(
            v_year_curr,
            EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
            LEAST(
              EXTRACT(DAY FROM p.fecha_nacimiento)::int,
              EXTRACT(DAY FROM (make_date(v_year_curr, EXTRACT(MONTH FROM p.fecha_nacimiento)::int, 1) + INTERVAL '1 month - 1 day'))::int
            )
          ) - CURRENT_DATE
        ) >= 0
        THEN (
          make_date(
            v_year_curr,
            EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
            LEAST(
              EXTRACT(DAY FROM p.fecha_nacimiento)::int,
              EXTRACT(DAY FROM (make_date(v_year_curr, EXTRACT(MONTH FROM p.fecha_nacimiento)::int, 1) + INTERVAL '1 month - 1 day'))::int
            )
          ) - CURRENT_DATE
        )
        ELSE (
          make_date(
            v_year_next,
            EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
            LEAST(
              EXTRACT(DAY FROM p.fecha_nacimiento)::int,
              EXTRACT(DAY FROM (make_date(v_year_next, EXTRACT(MONTH FROM p.fecha_nacimiento)::int, 1) + INTERVAL '1 month - 1 day'))::int
            )
          ) - CURRENT_DATE
        )
      END
    ) = dias_offset
  ORDER BY p.nombre_completo;
END;
$$ LANGUAGE plpgsql STABLE;

-- Verificación rápida (ejecutar manualmente):
-- SELECT * FROM get_clientes_cumpleanos_proximos(0);
-- SELECT * FROM get_clientes_cumpleanos_proximos(1);
-- SELECT * FROM get_clientes_cumpleanos_proximos(2);
