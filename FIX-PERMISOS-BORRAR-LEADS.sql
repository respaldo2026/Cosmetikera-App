-- ====================================================
-- FIX: Permitir borrar leads a admin, director y administrativo
-- ====================================================

-- Eliminar política antigua de DELETE
DROP POLICY IF EXISTS "leads_delete" ON leads;

-- Nueva política: admin, director y administrativo pueden eliminar leads
CREATE POLICY "leads_delete" ON leads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo')
    )
  );

-- Verificar políticas actuales
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
ORDER BY policyname;

-- Verificación: ¿El usuario actual puede eliminar?
SELECT 
    auth.uid() as mi_usuario_id,
    p.rol as mi_rol,
    CASE 
        WHEN p.rol IN ('admin', 'director', 'administrativo') THEN '✅ SÍ puedes borrar leads'
        ELSE '❌ NO puedes borrar leads (rol: ' || p.rol || ')'
    END as puede_eliminar
FROM perfiles p
WHERE p.id = auth.uid();
