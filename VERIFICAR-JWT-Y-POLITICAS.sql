-- ====================================================
-- PASO 1: Ver tu ROL actual en el JWT
-- ====================================================
SELECT 
  auth.uid() as mi_user_id,
  auth.jwt()->>'rol' as mi_rol_desde_jwt,
  auth.jwt()->>'role' as mi_role_desde_jwt,
  auth.jwt()->>'email' as mi_email;

-- ====================================================
-- PASO 2: Ver TODAS las políticas de perfiles en detalle
-- ====================================================
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

-- ====================================================
-- PASO 3: Intentar UPDATE real en un perfil de prueba
-- ====================================================
-- IMPORTANTE: Reemplaza 'ID_DEL_ESTUDIANTE_AQUI' con el UUID real
-- del estudiante que estás intentando editar

-- Primero busca un estudiante para obtener su ID:
SELECT id, nombre_completo, rol, email 
FROM perfiles 
WHERE rol = 'estudiante' 
LIMIT 3;

-- Luego intenta actualizar (reemplaza el ID):
-- UPDATE perfiles 
-- SET observaciones = 'Prueba de actualización desde SQL ' || NOW()::text
-- WHERE id = 'PEGA_AQUI_EL_ID_DEL_ESTUDIANTE';

-- Si el UPDATE funciona aquí pero no en Vercel, es problema del frontend
-- Si el UPDATE NO funciona aquí, es problema de permisos RLS

-- ====================================================
-- PASO 4: Ver si hay algún trigger que pueda bloquear
-- ====================================================
SELECT 
  trigger_name,
  event_manipulation as evento,
  action_timing as cuando
FROM information_schema.triggers
WHERE event_object_table = 'perfiles';
