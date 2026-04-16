-- ====================================================
-- SCRIPT COMPLETO DE DIAGNÓSTICO
-- Ejecutar TODO en Supabase SQL Editor de una vez
-- ====================================================

-- PASO 1: Ver tu ROL actual en el JWT
SELECT 
  auth.uid() as mi_user_id,
  auth.jwt()->>'rol' as mi_rol_desde_jwt,
  auth.jwt()->>'role' as mi_role_desde_jwt,
  auth.jwt()->>'email' as mi_email;

-- PASO 2: Ver TODAS las políticas de perfiles en detalle
SELECT 
  policyname as nombre_politica,
  cmd as operacion,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene USING'
    ELSE 'Sin USING'
  END as tiene_using,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Tiene WITH CHECK'
    ELSE 'Sin WITH CHECK'
  END as tiene_with_check
FROM pg_policies 
WHERE tablename = 'perfiles'
ORDER BY cmd, policyname;

-- PASO 3: Buscar estudiantes para obtener sus IDs
SELECT id, nombre_completo, rol, email 
FROM perfiles 
WHERE rol = 'estudiante' 
LIMIT 5;

-- PASO 4: Ver si hay triggers en perfiles y sus detalles
SELECT 
  trigger_name,
  event_manipulation as evento,
  action_timing as cuando,
  action_statement as que_hace
FROM information_schema.triggers
WHERE event_object_table = 'perfiles';

-- PASO 5: Ver el contenido del trigger de UPDATE
SELECT pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgname = 'update_perfiles_updated_at';

-- PASO 6: Ver el contenido del trigger de cupos
SELECT pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgname = 'trigger_restituir_cupos_estudiante';

-- ====================================================
-- DESPUÉS de ejecutar lo anterior, copia el ID de algún estudiante
-- y ejecuta ESTO (reemplaza AQUI_EL_ID_UUID):
-- ====================================================
-- UPDATE perfiles 
-- SET observaciones = 'Prueba UPDATE ' || NOW()::text
-- WHERE id = 'AQUI_EL_ID_UUID';

-- ====================================================
-- Si el UPDATE anterior funciona, copia el resultado:
-- "1 row(s) affected" = FUNCIONA
-- Error = NO FUNCIONA (es un problema de RLS)
-- ====================================================
