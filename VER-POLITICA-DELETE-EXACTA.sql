-- ====================================================
-- VER POLÍTICAS DELETE EXACTAS EN LEADS
-- ====================================================

-- Ver la política DELETE completa
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as condicion_completa,
  with_check::text as with_check_condition
FROM pg_policies
WHERE tablename = 'leads' AND cmd = 'DELETE'
ORDER BY policyname;

-- ====================================================
-- Si la política usa perfiles.id = auth.uid()
-- Necesitamos verificar que tu perfil existe
-- ====================================================

-- Tu ID de usuario (desde auth)
SELECT 
  'Tu user ID' as detalle,
  auth.uid() as valor;

-- Tu perfil en la tabla perfiles
SELECT 
  'Tu perfil' as detalle,
  id,
  email,
  rol
FROM perfiles
WHERE id = auth.uid();

-- ¿Existe el match?
SELECT 
  'Match de política' as detalle,
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE perfiles.id = auth.uid()
    AND perfiles.rol IN ('admin', 'director', 'administrativo')
  ) as cumple_condicion;
