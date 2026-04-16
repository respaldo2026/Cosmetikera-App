-- =====================================================
-- MATERIALES NECESARIOS POR CLASE (PENSUM)
-- Ejecutar en Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.materiales_clase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id bigint NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
  pensum_id uuid REFERENCES public.pensum(id) ON DELETE SET NULL,
  pensum_curso_id uuid NOT NULL REFERENCES public.pensum_cursos(id) ON DELETE CASCADE,
  nombre_material text NOT NULL,
  cantidad text,
  unidad text,
  observaciones text,
  obligatorio boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 1,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_materiales_clase_programa ON public.materiales_clase(programa_id);
CREATE INDEX IF NOT EXISTS idx_materiales_clase_pensum ON public.materiales_clase(pensum_id);
CREATE INDEX IF NOT EXISTS idx_materiales_clase_pensum_curso ON public.materiales_clase(pensum_curso_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_materiales_clase()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_materiales_clase_updated_at ON public.materiales_clase;
CREATE TRIGGER trg_materiales_clase_updated_at
BEFORE UPDATE ON public.materiales_clase
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_materiales_clase();

ALTER TABLE public.materiales_clase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS materiales_clase_select_auth ON public.materiales_clase;
CREATE POLICY materiales_clase_select_auth
ON public.materiales_clase
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS materiales_clase_insert_staff ON public.materiales_clase;
CREATE POLICY materiales_clase_insert_staff
ON public.materiales_clase
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.rol IN ('admin', 'director', 'secretaria')
  )
);

DROP POLICY IF EXISTS materiales_clase_update_staff ON public.materiales_clase;
CREATE POLICY materiales_clase_update_staff
ON public.materiales_clase
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.rol IN ('admin', 'director', 'secretaria')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.rol IN ('admin', 'director', 'secretaria')
  )
);

DROP POLICY IF EXISTS materiales_clase_delete_staff ON public.materiales_clase;
CREATE POLICY materiales_clase_delete_staff
ON public.materiales_clase
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.rol IN ('admin', 'director', 'secretaria')
  )
);
