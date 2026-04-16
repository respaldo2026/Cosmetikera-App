-- ====================================================
-- FIX DEFINITIVO: POLÍTICAS RLS PARA LEADS
-- ====================================================
-- Ejecuta este script completo en Supabase SQL Editor
-- ====================================================

-- PASO 1: Eliminar TODAS las políticas existentes en leads
DROP POLICY IF EXISTS "leads_select" ON leads;
DROP POLICY IF EXISTS "leads_insert" ON leads;
DROP POLICY IF EXISTS "leads_update" ON leads;
DROP POLICY IF EXISTS "leads_delete" ON leads;
DROP POLICY IF EXISTS "leads_select_policy" ON leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
DROP POLICY IF EXISTS "leads_update_policy" ON leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON leads;
DROP POLICY IF EXISTS "Enable read access for all users" ON leads;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON leads;
DROP POLICY IF EXISTS "Enable update for users based on email" ON leads;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON leads;

-- PASO 2: Asegurarse de que RLS esté habilitado
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- PASO 3: Crear políticas CORRECTAS

-- SELECT: Todos los usuarios autenticados pueden ver leads
CREATE POLICY "leads_select_policy" ON leads
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- INSERT: Todos los usuarios autenticados pueden crear leads
CREATE POLICY "leads_insert_policy" ON leads
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- UPDATE: Solo admin, director, administrativo, secretaria
CREATE POLICY "leads_update_policy" ON leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'director', 'administrativo', 'secretaria')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'director', 'administrativo', 'secretaria')
    )
  );

-- DELETE: Solo admin, director, administrativo
CREATE POLICY "leads_delete_policy" ON leads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'director', 'administrativo')
    )
  );

-- ====================================================
-- VERIFICACIÓN
-- ====================================================

-- Ver las políticas creadas
SELECT 
  policyname,
  cmd,
  SUBSTRING(qual::text, 1, 80) as condicion
FROM pg_policies
WHERE tablename = 'leads'
ORDER BY cmd, policyname;

-- Verificar tu perfil
SELECT 
  'Tu perfil' as info,
  id,
  email,
  rol,
  CASE 
    WHEN rol IN ('admin', 'director', 'administrativo') THEN '✅ PUEDE ELIMINAR'
    ELSE '❌ NO PUEDE ELIMINAR'
  END as permisos
FROM perfiles
WHERE id = auth.uid();

-- Probar si puedes eliminar (simular)
SELECT 
  'Prueba de política DELETE' as info,
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE id = auth.uid()
    AND rol IN ('admin', 'director', 'administrativo')
  ) as puedes_eliminar;
