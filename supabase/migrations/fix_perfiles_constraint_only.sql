-- =====================================================
-- FIX URGENTE: Constraint perfiles_rol_check
-- Ejecutar en: https://supabase.com/dashboard/project/gzrogwpbkkynhuostxle/sql/new
-- =====================================================

-- 1. Eliminar constraint PRIMERO (antes de tocar datos)
--    El constraint viejo bloquea incluso los UPDATE con valores nuevos
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;

-- 2. Ahora migrar roles antiguos sin restricciones
UPDATE public.perfiles SET rol = 'administrador' WHERE rol IN ('admin', 'director', 'administrativo');
UPDATE public.perfiles SET rol = 'vendedor'      WHERE rol IN ('secretaria', 'asesor');
UPDATE public.perfiles SET rol = 'cliente'       WHERE rol IN ('estudiante', 'egresado');
-- Cualquier otro rol desconocido → vendedor como rol base
UPDATE public.perfiles SET rol = 'vendedor'
  WHERE rol NOT IN ('administrador', 'marketing', 'vendedor', 'cliente');

-- 3. Crear el nuevo constraint con los 4 roles correctos
ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('administrador', 'marketing', 'vendedor', 'cliente'));

-- Verificar resultado
SELECT DISTINCT rol, COUNT(*) FROM public.perfiles GROUP BY rol ORDER BY rol;
