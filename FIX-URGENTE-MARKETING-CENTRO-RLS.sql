-- ====================================================
-- FIX URGENTE: desbloquear RLS de marketing_centro
-- Caso: UPDATE en cursos falla con
-- "new row violates row-level security policy for table marketing_centro"
-- ====================================================

-- 0) IMPORTANTE
-- Este script da permisos de escritura a TODOS los usuarios autenticados
-- en marketing_centro para resolver el bloqueo operativo.
-- Luego se puede endurecer.

-- 1) Eliminar TODAS las políticas existentes en marketing_centro
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_centro'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.marketing_centro', pol.policyname);
  END LOOP;
END $$;

-- 2) Asegurar RLS activa
ALTER TABLE public.marketing_centro ENABLE ROW LEVEL SECURITY;

-- 3) Política temporal permisiva para usuarios autenticados
CREATE POLICY "marketing_centro_auth_all_temp"
ON public.marketing_centro
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 4) Verificación
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'marketing_centro'
ORDER BY policyname;

-- 5) Confirmación rápida de sesión (en SQL Editor suele dar NULL)
SELECT auth.uid() as uid_sql_editor, auth.role() as role_sql_editor, current_user;
