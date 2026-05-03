-- Fix: get_clientes_cumpleaños_proximos
-- El error "function pg_catalog.extract(unknown, integer) does not exist" ocurre porque
-- la resta de dos valores DATE en PostgreSQL devuelve INTEGER (dias), no INTERVAL.
-- EXTRACT(DAY FROM integer) no existe; la solucion es usar la resta directa.

CREATE OR REPLACE FUNCTION get_clientes_cumpleaños_proximos(
  dias_offset integer DEFAULT 0
)
RETURNS TABLE (
  perfil_id uuid,
  nombre_completo text,
  cedula text,
  telefono text,
  fecha_nacimiento date,
  dias_para_cumpleaños integer
) AS $$
DECLARE
  cumple_este_anio date;
  cumple_sig_anio  date;
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nombre_completo,
    p.cedula,
    p.telefono,
    p.fecha_nacimiento,
    -- Calcula dias hasta el proximo cumpleanos (este año o siguiente)
    CASE
      WHEN (
        make_date(
          EXTRACT(YEAR FROM CURRENT_DATE)::int,
          EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
          EXTRACT(DAY FROM p.fecha_nacimiento)::int
        ) - CURRENT_DATE
      ) >= 0
      THEN (
        make_date(
          EXTRACT(YEAR FROM CURRENT_DATE)::int,
          EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
          EXTRACT(DAY FROM p.fecha_nacimiento)::int
        ) - CURRENT_DATE
      )
      ELSE (
        make_date(
          EXTRACT(YEAR FROM CURRENT_DATE)::int + 1,
          EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
          EXTRACT(DAY FROM p.fecha_nacimiento)::int
        ) - CURRENT_DATE
      )
    END AS dias_para_cumpleaños
  FROM public.perfiles p
  WHERE
    p.fecha_nacimiento IS NOT NULL
    AND p.telefono IS NOT NULL
    AND (p.rol = 'cliente' OR p.rol IS NULL)
    AND (
      CASE
        WHEN (
          make_date(
            EXTRACT(YEAR FROM CURRENT_DATE)::int,
            EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
            EXTRACT(DAY FROM p.fecha_nacimiento)::int
          ) - CURRENT_DATE
        ) >= 0
        THEN (
          make_date(
            EXTRACT(YEAR FROM CURRENT_DATE)::int,
            EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
            EXTRACT(DAY FROM p.fecha_nacimiento)::int
          ) - CURRENT_DATE
        )
        ELSE (
          make_date(
            EXTRACT(YEAR FROM CURRENT_DATE)::int + 1,
            EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
            EXTRACT(DAY FROM p.fecha_nacimiento)::int
          ) - CURRENT_DATE
        )
      END
    ) = dias_offset
  ORDER BY p.nombre_completo;
END;
$$ LANGUAGE plpgsql STABLE;

-- Ejemplos de uso:
-- SELECT * FROM get_clientes_cumpleaños_proximos(0);  -- Cumpleanos hoy
-- SELECT * FROM get_clientes_cumpleaños_proximos(1);  -- Cumpleanos en 1 dia
-- SELECT * FROM get_clientes_cumpleaños_proximos(2);  -- Cumpleanos en 2 dias
