-- ====================================================
-- VERIFICAR SI LAS POLÍTICAS RLS FUNCIONAN
-- ====================================================
-- Ejecutar este script en Supabase SQL Editor
-- para confirmar que las políticas UPDATE están activas
-- ====================================================

-- 1. Ver todas las políticas de perfiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'perfiles'
ORDER BY cmd, policyname;

-- 2. Verificar que RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'perfiles';

-- 3. Probar UPDATE con tu usuario actual
-- IMPORTANTE: Reemplaza 'TU_ID_UUID_AQUI' con el ID del estudiante que intentas editar
-- SELECT auth.uid(); -- Ejecuta esto primero para ver tu ID

-- Ejemplo de UPDATE que debería funcionar si eres admin:
-- UPDATE perfiles 
-- SET nombre_completo = 'Prueba de actualización'
-- WHERE id = 'TU_ID_UUID_AQUI';

-- 4. Ver el rol actual del usuario autenticado
SELECT 
  auth.uid() as mi_user_id,
  auth.jwt()->>'rol' as mi_rol_desde_jwt,
  auth.jwt()->>'role' as mi_role_desde_jwt,
  (auth.jwt()::jsonb) as jwt_completo;

-- 5. Buscar si existe alguna política UPDATE para perfiles
SELECT COUNT(*) as politicas_update_activas
FROM pg_policies 
WHERE tablename = 'perfiles' 
AND cmd = 'UPDATE';

-- ====================================================
-- DIAGNÓSTICO: Interpretar resultados
-- ====================================================
-- Si "politicas_update_activas" = 0 → NO ejecutaste el FIX
-- Si "rls_enabled" = false → RLS deshabilitado (MAL)
-- Si "mi_rol_desde_jwt" es NULL → JWT no tiene claim 'rol'
-- ====================================================
