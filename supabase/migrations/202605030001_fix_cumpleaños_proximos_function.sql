-- Fix: renombrar get_clientes_cumpleanos_proximos (sin n~) y corregir bug de extract.
-- El error "function pg_catalog.extract(unknown, integer) does not exist" ocurria porque
-- la resta de dos valores DATE en PostgreSQL devuelve INTEGER (dias), no INTERVAL.
-- EXTRACT(DAY FROM integer) no existe; la solucion es usar la resta directa (date - date = int).
-- Ademas se renombra la funcion para evitar el caracter n~ que causa problemas de encoding.

-- Eliminar la funcion vieja con n~ si existe
DROP FUNCTION IF EXISTS get_clientes_cumpleanos_proximos(integer);

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
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nombre_completo,
    p.cedula,
    p.telefono,
    p.fecha_nacimiento,
    -- Calcula dias hasta el proximo cumpleanos (este anio o siguiente).
    -- date - date = integer en PostgreSQL, no interval, por eso se usa la resta directa.
    CASE
      WHEN (make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                      EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
                      EXTRACT(DAY FROM p.fecha_nacimiento)::int) - CURRENT_DATE) >= 0
      THEN  make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                      EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
                      EXTRACT(DAY FROM p.fecha_nacimiento)::int) - CURRENT_DATE
      ELSE  make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1,
                      EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
                      EXTRACT(DAY FROM p.fecha_nacimiento)::int) - CURRENT_DATE
    END AS dias_para_cumpleanos
  FROM public.perfiles p
  WHERE
    p.fecha_nacimiento IS NOT NULL
    AND p.telefono IS NOT NULL
    AND (p.rol = 'cliente' OR p.rol IS NULL)
    AND (
      CASE
        WHEN (make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                        EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
                        EXTRACT(DAY FROM p.fecha_nacimiento)::int) - CURRENT_DATE) >= 0
        THEN  make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                        EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
                        EXTRACT(DAY FROM p.fecha_nacimiento)::int) - CURRENT_DATE
        ELSE  make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1,
                        EXTRACT(MONTH FROM p.fecha_nacimiento)::int,
                        EXTRACT(DAY FROM p.fecha_nacimiento)::int) - CURRENT_DATE
      END
    ) = dias_offset
  ORDER BY p.nombre_completo;
END;
$$ LANGUAGE plpgsql STABLE;

-- Ejemplos de uso:
-- SELECT * FROM get_clientes_cumpleanos_proximos(0);  -- Cumpleanos hoy
-- SELECT * FROM get_clientes_cumpleanos_proximos(1);  -- Cumpleanos en 1 dia
-- SELECT * FROM get_clientes_cumpleanos_proximos(2);  -- Cumpleanos en 2 dias
