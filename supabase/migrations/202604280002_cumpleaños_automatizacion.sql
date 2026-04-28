-- =====================================================
-- PLANTILLAS DE CUMPLEAÑOS - La Cosmetikera
-- Mensajes transaccionales para recordar beneficios
-- =====================================================

-- 1. Plantilla: 2 días ANTES del cumpleaños
INSERT INTO public.plantillas_whatsapp (nombre, descripcion, plantilla, variables, activa)
VALUES (
  'Cumpleaños -2 Días',
  'Plantilla transaccional: cumpleaños_recordatorio_2d_es - Se envía 2 días antes del cumpleaños',
  'Tu cumpleaños se acerca 🎂

En 2 días activaremos tu descuento especial de cumpleaños.

💝 PRÓXIMAMENTE:
- Descuento exclusivo en la app
- Acceso a productos VIP
- Puntos x2 en compras

Mantén tu app actualizada para no perderlo.

¡Nos vemos pronto! 🎉',
  ARRAY[]::text[],
  true
);

-- 2. Plantilla: 1 día ANTES del cumpleaños
INSERT INTO public.plantillas_whatsapp (nombre, descripcion, plantilla, variables, activa)
VALUES (
  'Cumpleaños -1 Día',
  'Plantilla transaccional: cumpleaños_recordatorio_1d_es - Se envía 1 día antes del cumpleaños',
  '¡Casi es tu día! 🎂

Mañana se activa tu descuento especial de cumpleaños.

💝 MAÑANA TENDRÁS:
- Descuento exclusivo en compras
- Acceso a productos especiales
- Puntos x2 en todas tus compras

¡No te lo pierdas! 🎉',
  ARRAY[]::text[],
  true
);

-- 3. Plantilla: EL DÍA del cumpleaños
INSERT INTO public.plantillas_whatsapp (nombre, descripcion, plantilla, variables, activa)
VALUES (
  'Cumpleaños +0 Días',
  'Plantilla transaccional: cumpleaños_celebracion_es - Se envía el día del cumpleaños',
  '¡Feliz cumpleaños! 🎂🎉

Hoy es tu día especial y tenemos sorpresas para ti.

💝 HOY DISFRUTAS:
- Descuento activado en la app
- Acceso a productos VIP exclusivos
- Puntos x2 en todas tus compras

¡Accede a la app y celebra con nosotros!
https://app.cosmetikera.com

¿Preguntas? Escribe "Hola" 💬',
  ARRAY[]::text[],
  true
);

-- 4. Tabla para rastrear envíos de cumpleaños por cliente
CREATE TABLE IF NOT EXISTS public.cumpleaños_notificaciones (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid        NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  año_celebracion integer     NOT NULL,
  
  -- Cada uno de los 3 mensajes
  enviado_2d_antes boolean    NOT NULL DEFAULT false,
  fecha_2d_antes  timestamptz,
  
  enviado_1d_antes boolean    NOT NULL DEFAULT false,
  fecha_1d_antes  timestamptz,
  
  enviado_dia_cumple boolean  NOT NULL DEFAULT false,
  fecha_dia_cumple timestamptz,
  
  -- Auditoría
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  
  -- Único por perfil + año (evita duplicados)
  UNIQUE(perfil_id, año_celebracion)
);

ALTER TABLE public.cumpleaños_notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total cumpleaños_notificaciones" ON public.cumpleaños_notificaciones;
CREATE POLICY "Acceso total cumpleaños_notificaciones"
  ON public.cumpleaños_notificaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Función para obtener clientes con cumpleaños próximo
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
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.nombre_completo,
    p.cedula,
    p.telefono,
    p.fecha_nacimiento,
    -- Días hasta el próximo cumpleaños (este año o el siguiente)
    CASE 
      WHEN (EXTRACT(MONTH FROM p.fecha_nacimiento)::int * 100 + EXTRACT(DAY FROM p.fecha_nacimiento)::int) 
           >= (EXTRACT(MONTH FROM CURRENT_DATE)::int * 100 + EXTRACT(DAY FROM CURRENT_DATE)::int)
      THEN EXTRACT(DAY FROM 
             DATE(EXTRACT(YEAR FROM CURRENT_DATE)::text || 
                  TO_CHAR(p.fecha_nacimiento, '-MM-DD')) - CURRENT_DATE
           )::int
      ELSE EXTRACT(DAY FROM 
             DATE((EXTRACT(YEAR FROM CURRENT_DATE)::int + 1)::text || 
                  TO_CHAR(p.fecha_nacimiento, '-MM-DD')) - CURRENT_DATE
           )::int
    END as dias_para_cumpleaños
  FROM public.perfiles p
  WHERE 
    p.fecha_nacimiento IS NOT NULL
    AND p.telefono IS NOT NULL
    AND (rol = 'cliente' OR rol IS NULL)
    -- Filtrar por días offset (puede ser -2, -1, 0)
    AND CASE 
      WHEN (EXTRACT(MONTH FROM p.fecha_nacimiento)::int * 100 + EXTRACT(DAY FROM p.fecha_nacimiento)::int) 
           >= (EXTRACT(MONTH FROM CURRENT_DATE)::int * 100 + EXTRACT(DAY FROM CURRENT_DATE)::int)
      THEN EXTRACT(DAY FROM 
             DATE(EXTRACT(YEAR FROM CURRENT_DATE)::text || 
                  TO_CHAR(p.fecha_nacimiento, '-MM-DD')) - CURRENT_DATE
           )::int
      ELSE EXTRACT(DAY FROM 
             DATE((EXTRACT(YEAR FROM CURRENT_DATE)::int + 1)::text || 
                  TO_CHAR(p.fecha_nacimiento, '-MM-DD')) - CURRENT_DATE
           )::int
    END = dias_offset
  ORDER BY p.nombre_completo;
END;
$$ LANGUAGE plpgsql STABLE;

-- Ejemplos de uso:
-- SELECT * FROM get_clientes_cumpleaños_proximos(-2);  -- Cumpleaños en 2 días
-- SELECT * FROM get_clientes_cumpleaños_proximos(-1);  -- Cumpleaños en 1 día
-- SELECT * FROM get_clientes_cumpleaños_proximos(0);   -- Cumpleaños hoy
