-- ============================================================
-- DIAGNÓSTICO: Verificar permisos y sesión - 2026-02-12
-- ============================================================
-- Ejecutar en SQL Editor de Supabase para diagnosticar

-- 1. Ver tu usuario actual y rol
SELECT 
  auth.uid() as mi_user_id,
  auth.email() as mi_email,
  auth.role() as mi_role_auth;

-- 2. Ver tu perfil y rol
SELECT id, email, rol, nombre_completo
FROM perfiles
WHERE id = auth.uid();

-- 3. Ver políticas actuales de cursos
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'cursos'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- 4. Verificar si RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'cursos';

-- 5. Test manual: ¿Puedes insertar?
-- Descomenta esto solo para probar:
/*
INSERT INTO cursos (
  nombre, 
  programa_id,
  profesor_id,
  cupo_maximo,
  precio,
  estado,
  modalidad
) VALUES (
  'TEST - ELIMINAR',
  (SELECT id FROM programas LIMIT 1),
  auth.uid(),
  20,
  0,
  'proximo',
  'presencial'
);

-- Si funcionó, elimínalo:
DELETE FROM cursos WHERE nombre = 'TEST - ELIMINAR';
*/
