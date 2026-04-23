-- =====================================================
-- CAMPAÑA DE REFERIDOS - La Cosmetikera
-- Ejecutar en: https://supabase.com/dashboard/project/<project>/sql/new
-- =====================================================

-- Columna para rastrear quién refirió a cada cliente
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS referido_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL;

-- Columna para saber si el referido ya fue acreditado (evitar doble acreditación)
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS referido_acreditado boolean NOT NULL DEFAULT false;

-- Índice para búsquedas por referidor
CREATE INDEX IF NOT EXISTS idx_perfiles_referido_por ON public.perfiles(referido_por);

-- Ampliar el CHECK de tipo en puntos_historial para incluir 'referido'
ALTER TABLE public.puntos_historial
  DROP CONSTRAINT IF EXISTS puntos_historial_tipo_check;

ALTER TABLE public.puntos_historial
  ADD CONSTRAINT puntos_historial_tipo_check
  CHECK (tipo IN ('ganados','canjeados','bonificacion','ajuste','bienvenida','cumpleanos','racha','referido'));
