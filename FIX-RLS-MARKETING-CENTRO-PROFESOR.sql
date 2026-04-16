-- ====================================================
-- FIX RLS: marketing_centro bloquea update de cursos (profesor)
-- Error: new row violates row-level security policy for table "marketing_centro"
-- ====================================================

-- 1) Ver estado actual de políticas
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

-- 2) Limpiar políticas conflictivas/con nombres antiguos
DROP POLICY IF EXISTS "Acceso total marketing" ON public.marketing_centro;
DROP POLICY IF EXISTS "marketing_centro_admin_all" ON public.marketing_centro;
DROP POLICY IF EXISTS "marketing_centro_select" ON public.marketing_centro;
DROP POLICY IF EXISTS "marketing_centro_insert" ON public.marketing_centro;
DROP POLICY IF EXISTS "marketing_centro_update" ON public.marketing_centro;
DROP POLICY IF EXISTS "marketing_centro_delete" ON public.marketing_centro;

-- 3) Asegurar RLS activa
ALTER TABLE public.marketing_centro ENABLE ROW LEVEL SECURITY;

-- 4) Política única robusta para usuarios administrativos
-- IMPORTANTE: incluye 'admin' (tu caso), además de variantes comunes
CREATE POLICY "marketing_centro_admin_all"
ON public.marketing_centro
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.rol IN ('admin', 'administrador', 'director', 'administrativo', 'desarrollo')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.rol IN ('admin', 'administrador', 'director', 'administrativo', 'desarrollo')
  )
);

-- 5) Verificación rápida
SELECT
  'perfil_actual' AS test,
  p.id,
  p.email,
  p.rol
FROM public.perfiles p
WHERE p.id = auth.uid();

SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'marketing_centro'
ORDER BY policyname;

-- 6) (Opcional) Prueba de permiso lógico
SELECT
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.rol IN ('admin', 'administrador', 'director', 'administrativo', 'desarrollo')
  ) AS puede_escribir_marketing_centro;
