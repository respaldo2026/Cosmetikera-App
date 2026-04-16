-- =====================================================
-- FIX: Limpiar caché del schema en Supabase
-- Ejecuta esto en Supabase SQL Editor si sigues viendo el error
-- =====================================================

-- 1️⃣ Verificar que la tabla tiene las columnas correctas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'material_didactico'
ORDER BY ordinal_position;

-- 2️⃣ Si no están las columnas correctas, ejecuta esto para actualizar:
-- (Solo si falta alguna columna)

ALTER TABLE IF EXISTS public.material_didactico 
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

ALTER TABLE IF EXISTS public.material_didactico 
  ADD COLUMN IF NOT EXISTS url_archivo TEXT;

ALTER TABLE IF EXISTS public.material_didactico 
  ADD COLUMN IF NOT EXISTS nombre_archivo VARCHAR(255);

ALTER TABLE IF EXISTS public.material_didactico 
  ADD COLUMN IF NOT EXISTS tamano_bytes INTEGER;

ALTER TABLE IF EXISTS public.material_didactico 
  ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true;

-- 3️⃣ Borrar las columnas antiguas (si existen)
ALTER TABLE IF EXISTS public.material_didactico 
  DROP COLUMN IF EXISTS tipo_mime CASCADE;

ALTER TABLE IF EXISTS public.material_didactico 
  DROP COLUMN IF EXISTS url CASCADE;

ALTER TABLE IF EXISTS public.material_didactico 
  DROP COLUMN IF EXISTS tipo_origen CASCADE;

-- 4️⃣ Notificar a Supabase que limpie el caché
-- En Supabase Dashboard:
-- - Ve a SQL Editor
-- - Ejecuta esta query
-- - Luego recarga la página (Cmd+R o Ctrl+R)
-- - El caché se debe limpiar después de 30 segundos

-- 5️⃣ Verificar nuevamente que todo esté bien
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'material_didactico'
  AND column_name IN ('mime_type', 'url_archivo', 'nombre_archivo', 'tamano_bytes', 'visible')
ORDER BY column_name;

-- ✅ Si ves estas 5 columnas listadas, el esquema está correcto
