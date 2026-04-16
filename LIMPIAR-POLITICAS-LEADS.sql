-- ====================================================
-- LIMPIEZA Y CORRECCIÓN: Políticas RLS para LEADS
-- ====================================================
-- Problema: 8 políticas, muchas duplicadas y conflictivas
-- Solución: Mantener solo 4 políticas necesarias y bien configuradas
-- ====================================================

-- 1️⃣ ELIMINAR TODAS las políticas existentes
DROP POLICY IF EXISTS "leads_api_insert_all" ON leads;
DROP POLICY IF EXISTS "leads_api_select_all" ON leads;
DROP POLICY IF EXISTS "leads_api_update_all" ON leads;
DROP POLICY IF EXISTS "leads_delete" ON leads;
DROP POLICY IF EXISTS "leads_insert" ON leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
DROP POLICY IF EXISTS "leads_select" ON leads;
DROP POLICY IF EXISTS "leads_update" ON leads;

-- 2️⃣ CREAR políticas limpias y correctas

-- SELECT: admin, director, administrativo, secretaria pueden VER leads
CREATE POLICY "leads_select" ON leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo', 'secretaria')
    )
  );

-- INSERT: admin, director, administrativo, secretaria pueden CREAR leads
CREATE POLICY "leads_insert" ON leads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo', 'secretaria')
    )
  );

-- UPDATE: admin, director, administrativo, secretaria pueden ACTUALIZAR leads
CREATE POLICY "leads_update" ON leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo', 'secretaria')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo', 'secretaria')
    )
  );

-- DELETE: solo admin, director, administrativo pueden ELIMINAR leads
CREATE POLICY "leads_delete" ON leads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo')
    )
  );

-- ====================================================
-- 3️⃣ VERIFICACIÓN
-- ====================================================

-- Ver políticas después de la limpieza (debe haber solo 4)
SELECT 
    policyname,
    cmd,
    roles,
    CASE 
        WHEN cmd = 'SELECT' THEN '👁️ Ver leads'
        WHEN cmd = 'INSERT' THEN '➕ Crear leads'
        WHEN cmd = 'UPDATE' THEN '✏️ Editar leads'
        WHEN cmd = 'DELETE' THEN '🗑️ Eliminar leads'
    END as accion,
    CASE 
        WHEN policyname = 'leads_delete' THEN 'admin, director, administrativo'
        ELSE 'admin, director, administrativo, secretaria'
    END as roles_permitidos
FROM pg_policies
WHERE tablename = 'leads'
ORDER BY cmd;

-- Verificar tu usuario actual
SELECT 
    auth.uid() as mi_id,
    p.id,
    p.nombre_completo,
    p.email,
    p.rol,
    CASE 
        WHEN p.rol IN ('admin', 'director', 'administrativo') THEN '✅ Puedes ELIMINAR leads'
        WHEN p.rol = 'secretaria' THEN '⚠️ Puedes ver/crear/editar pero NO eliminar'
        ELSE '❌ Sin permisos en leads'
    END as permisos
FROM perfiles p
WHERE p.id = auth.uid();

-- ====================================================
-- 4️⃣ PRUEBA DE ELIMINACIÓN
-- ====================================================
-- Ejecuta esto para confirmar que puedes eliminar:
-- DELETE FROM leads WHERE id = '[ELIGE_UN_ID_DE_TEST]';

-- Si falla, copia el error exacto y lo revisamos

-- ====================================================
-- ✅ RESULTADO ESPERADO
-- ====================================================
-- Solo 4 políticas:
--   1. leads_select   (SELECT)  → 4 roles pueden ver
--   2. leads_insert   (INSERT)  → 4 roles pueden crear
--   3. leads_update   (UPDATE)  → 4 roles pueden editar
--   4. leads_delete   (DELETE)  → 3 roles pueden eliminar
-- ====================================================
