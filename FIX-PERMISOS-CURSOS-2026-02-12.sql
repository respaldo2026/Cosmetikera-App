-- ============================================================
-- FIX: Permisos para crear grupos (cursos) - 2026-02-12
-- ============================================================

-- PASO 1: Diagnosticar el problema
-- Verificar usuario actual y su rol
SELECT 
  auth.uid() as user_id,
  auth.email() as email,
  (SELECT rol FROM perfiles WHERE id = auth.uid()) as rol_en_perfil,
  coalesce(
    auth.jwt()->'app_metadata'->>'rol',
    auth.jwt()->>'rol',
    auth.jwt()->>'role'
  ) as rol_en_jwt;

-- Ver todos los usuarios administradores
SELECT id, email, raw_app_meta_data, raw_user_meta_data
FROM auth.users
WHERE raw_app_meta_data->>'rol' IN ('admin', 'director', 'administrativo')
   OR raw_user_meta_data->>'rol' IN ('admin', 'director', 'administrativo');

-- PASO 2: SOLUCIÓN TEMPORAL - Permitir a usuarios autenticados crear cursos
-- Esta política temporal permite que cualquier usuario autenticado cree cursos
-- mientras verificamos los roles correctamente

-- Eliminar política restrictiva actual
DROP POLICY IF EXISTS "cursos_insert" ON cursos;

-- Crear política temporal más permisiva
CREATE POLICY "cursos_insert_temp" ON cursos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- NOTA: Después de crear los grupos necesarios, puedes restaurar la política restrictiva con:
/*
DROP POLICY IF EXISTS "cursos_insert_temp" ON cursos;

CREATE POLICY "cursos_insert" ON cursos
  FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );
*/

-- PASO 3: VERIFICAR POLÍTICAS ACTUALES
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
WHERE tablename = 'cursos'
ORDER BY policyname;

-- PASO 4: Si necesitas asignar rol de admin a tu usuario actual
-- REEMPLAZA 'tu-email@ejemplo.com' con tu email real
/*
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"rol": "admin"}'::jsonb
WHERE email = 'tu-email@ejemplo.com';

-- Actualizar también en la tabla perfiles
UPDATE perfiles
SET rol = 'admin'
WHERE email = 'tu-email@ejemplo.com';
*/

-- PASO 5: SOLUCIÓN PERMANENTE - Función para verificar roles
-- Esta función busca el rol en múltiples lugares
CREATE OR REPLACE FUNCTION auth.user_has_admin_role()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM perfiles p
    WHERE p.id = auth.uid()
      AND p.rol IN ('admin', 'director', 'administrativo')
  )
  OR coalesce(
    auth.jwt()->'app_metadata'->>'rol',
    auth.jwt()->>'rol',
    auth.jwt()->>'role'
  ) IN ('admin', 'director', 'administrativo');
$$;

-- Actualizar políticas para usar la función
DROP POLICY IF EXISTS "cursos_insert_temp" ON cursos;
DROP POLICY IF EXISTS "cursos_insert" ON cursos;

CREATE POLICY "cursos_insert_final" ON cursos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.user_has_admin_role());

-- Mensaje de confirmación
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Políticas de cursos actualizadas';
  RAISE NOTICE 'Ahora los usuarios con rol admin/director/administrativo pueden crear grupos';
  RAISE NOTICE 'El rol se verifica tanto en perfiles como en JWT metadata';
END $$;
