-- ====================================================
-- VERIFICAR POLÍTICAS RLS ACTUALES EN LEADS
-- ====================================================

-- 1. Ver todas las políticas en la tabla leads
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
WHERE tablename = 'leads'
ORDER BY cmd, policyname;

-- 2. Verificar si RLS está habilitado
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'leads';

-- 3. Verificar tu sesión actual (ejecutar desde la app web logiado)
SELECT 
  auth.uid() as mi_user_id,
  auth.role() as mi_rol_jwt,
  current_user as usuario_db;

-- 4. Verificar tu perfil
SELECT 
  id,
  email,
  rol,
  nombre_completo
FROM perfiles
WHERE id = auth.uid();

-- 5. Simular la query que hace la política DELETE
SELECT 
  'Resultado de la política DELETE:' as mensaje,
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE perfiles.id = auth.uid()
    AND perfiles.rol IN ('admin', 'director', 'administrativo')
  ) as puedes_eliminar;
