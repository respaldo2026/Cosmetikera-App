-- ====================================================
-- FIX URGENTE: CORREGIR POLÍTICA UPDATE INCOMPLETA
-- ====================================================

-- Eliminar la política malformada
DROP POLICY IF EXISTS "Permitir update director" ON perfiles;

-- Recrearla correctamente con WITH CHECK
CREATE POLICY "Permitir update director" ON perfiles
  FOR UPDATE
  USING (
    coalesce(auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  )
  WITH CHECK (
    coalesce(auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- Verificar que ahora tiene WITH CHECK
SELECT 
  policyname,
  cmd,
  with_check IS NOT NULL as tiene_with_check
FROM pg_policies 
WHERE tablename = 'perfiles' AND cmd = 'UPDATE'
ORDER BY policyname;

-- Prueba un UPDATE ahora (reemplaza AQUI_EL_ID)
-- UPDATE perfiles 
-- SET nombre_completo = nombre_completo || ' - ACTUALIZADO'
-- WHERE id = 'AQUI_EL_ID';
