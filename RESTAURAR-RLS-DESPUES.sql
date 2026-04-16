-- ============================================================
-- RESTAURAR RLS: Ejecutar después de crear los grupos
-- ============================================================
-- Este script re-habilita RLS con políticas permisivas

-- Paso 1: Re-habilitar RLS
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;

-- Paso 2: Eliminar políticas antiguas
DROP POLICY IF EXISTS "cursos_insert" ON cursos;
DROP POLICY IF EXISTS "cursos_insert_temp" ON cursos;
DROP POLICY IF EXISTS "cursos_insert_final" ON cursos;
DROP POLICY IF EXISTS "cursos_insert_all_auth" ON cursos;
DROP POLICY IF EXISTS "cursos_select" ON cursos;
DROP POLICY IF EXISTS "cursos_update" ON cursos;
DROP POLICY IF EXISTS "cursos_delete" ON cursos;

-- Paso 3: Crear políticas permisivas para usuarios autenticados

-- SELECT: Todos pueden ver cursos
CREATE POLICY "cursos_select_all" ON cursos
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Todos los autenticados pueden crear
CREATE POLICY "cursos_insert_auth" ON cursos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Todos pueden actualizar
CREATE POLICY "cursos_update_auth" ON cursos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Todos pueden eliminar
CREATE POLICY "cursos_delete_auth" ON cursos
  FOR DELETE
  TO authenticated
  USING (true);

-- Paso 4: Verificar
SELECT 
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity = true THEN '✅ RLS habilitado con políticas permisivas'
    ELSE '❌ RLS deshabilitado'
  END as estado
FROM pg_tables
WHERE tablename = 'cursos';

SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'cursos'
ORDER BY cmd, policyname;
