-- ====================================================
-- DIAGNÓSTICO COMPLETO: PERMISOS POR USUARIO
-- ====================================================

-- ====================
-- 1. TU SESIÓN ACTUAL
-- ====================
SELECT 
  '🔑 TU SESIÓN' as seccion,
  auth.uid() as tu_user_id,
  auth.role() as tu_rol_jwt,
  current_user as usuario_db,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ NO AUTENTICADO'
    ELSE '✅ Autenticado'
  END as estado_auth;

-- ====================
-- 2. TU PERFIL
-- ====================
SELECT 
  '👤 TU PERFIL' as seccion,
  id,
  email,
  rol,
  nombre_completo,
  CASE 
    WHEN rol IN ('admin', 'director', 'administrativo') THEN '✅ ROL VÁLIDO para eliminar'
    ELSE '❌ ROL NO VÁLIDO: "' || COALESCE(rol, 'NULL') || '"'
  END as puede_eliminar
FROM perfiles
WHERE id = auth.uid();

-- ====================
-- 3. POLÍTICAS DELETE EN LEADS
-- ====================
SELECT 
  '🔒 POLÍTICAS DELETE' as seccion,
  policyname,
  cmd,
  SUBSTRING(qual::text, 1, 100) as condicion,
  CASE 
    WHEN qual::text ILIKE '%admin%' THEN '✅ Menciona admin'
    ELSE '⚠️ No menciona admin'
  END as valida_admin
FROM pg_policies
WHERE tablename = 'leads' AND cmd = 'DELETE';

-- ====================
-- 4. VERIFICAR SI RLS ESTÁ HABILITADO
-- ====================
SELECT 
  '🛡️ RLS STATUS' as seccion,
  tablename,
  rowsecurity as rls_habilitado,
  CASE 
    WHEN rowsecurity THEN '✅ RLS activo'
    ELSE '❌ RLS DESACTIVADO'
  END as estado
FROM pg_tables
WHERE tablename = 'leads';

-- ====================
-- 5. SIMULAR LA EVALUACIÓN DE LA POLÍTICA
-- ====================
SELECT 
  '🧪 PRUEBA DE POLÍTICA' as seccion,
  auth.uid() as mi_id,
  (SELECT rol FROM perfiles WHERE id = auth.uid()) as mi_rol,
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE perfiles.id = auth.uid()
    AND perfiles.rol IN ('admin', 'director', 'administrativo')
  ) as puedo_eliminar_segun_politica,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo')
    ) THEN '✅ SÍ PUEDES ELIMINAR'
    ELSE '❌ NO PUEDES ELIMINAR'
  END as resultado;

-- ====================
-- 6. TODOS LOS USUARIOS QUE SÍ PUEDEN ELIMINAR
-- ====================
SELECT 
  '✅ USUARIOS AUTORIZADOS' as seccion,
  id,
  email,
  rol,
  nombre_completo
FROM perfiles
WHERE rol IN ('admin', 'director', 'administrativo')
ORDER BY rol, email;

-- ====================
-- 7. DIAGNÓSTICO DE PROBLEMA
-- ====================
WITH diagnostico AS (
  SELECT 
    auth.uid() IS NULL as sin_auth,
    NOT EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid()) as sin_perfil,
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol NOT IN ('admin', 'director', 'administrativo')
    ) as rol_invalido,
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IS NULL
    ) as rol_null
)
SELECT 
  '🔍 DIAGNÓSTICO' as seccion,
  CASE 
    WHEN sin_auth THEN '❌ PROBLEMA: No estás autenticado (auth.uid() es NULL)'
    WHEN sin_perfil THEN '❌ PROBLEMA: Tu usuario no tiene perfil en tabla perfiles'
    WHEN rol_null THEN '❌ PROBLEMA: Tu perfil tiene rol = NULL'
    WHEN rol_invalido THEN '❌ PROBLEMA: Tu rol no es admin/director/administrativo'
    ELSE '✅ TODO OK - Deberías poder eliminar'
  END as problema_detectado
FROM diagnostico;
