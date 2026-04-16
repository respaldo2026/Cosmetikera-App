-- ====================================================
-- SCRIPT SIMPLE - SOLO LO ESENCIAL
-- Ejecuta TODO esto junto en Supabase SQL Editor
-- ====================================================

-- 1. Ver tu ROL en el JWT (IMPORTANTE)
SELECT 
  'TU_ROL_ES:' as resultado,
  auth.jwt()->>'rol' as rol;

-- 2. Ver un ID de estudiante (para probar UPDATE)
SELECT id, nombre_completo 
FROM perfiles 
WHERE rol = 'estudiante' 
LIMIT 1;

-- 3. Ver si las políticas UPDATE existen y tienen WITH CHECK
SELECT 
  policyname,
  cmd,
  with_check IS NOT NULL as tiene_with_check
FROM pg_policies 
WHERE tablename = 'perfiles' AND cmd = 'UPDATE';

-- 4. AHORA COPIA EL ID DEL PASO 2 Y EJECUTA ESTO:
-- Reemplaza 'AQUI_EL_ID' con el UUID que viste arriba
-- UPDATE perfiles 
-- SET nombre_completo = nombre_completo || ' - TEST'
-- WHERE id = 'AQUI_EL_ID';
