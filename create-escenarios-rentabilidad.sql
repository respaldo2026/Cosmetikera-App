-- Crear tabla de escenarios de rentabilidad si no existe
CREATE TABLE IF NOT EXISTS public.escenarios_rentabilidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  datos JSONB NOT NULL,
  resultados JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Agregar columnas faltantes si no existen
ALTER TABLE public.escenarios_rentabilidad
ADD COLUMN IF NOT EXISTS datos JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.escenarios_rentabilidad
ADD COLUMN IF NOT EXISTS resultados JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.escenarios_rentabilidad
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

-- Habilitar RLS
ALTER TABLE public.escenarios_rentabilidad ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS (solo admin)
DROP POLICY IF EXISTS "Solo admin puede ver escenarios" ON public.escenarios_rentabilidad;
CREATE POLICY "Solo admin puede ver escenarios" ON public.escenarios_rentabilidad
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');

DROP POLICY IF EXISTS "Solo admin puede modificar escenarios" ON public.escenarios_rentabilidad;
CREATE POLICY "Solo admin puede modificar escenarios" ON public.escenarios_rentabilidad
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');
