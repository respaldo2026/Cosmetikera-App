-- Agrega metadatos comerciales para filtros y edición masiva de artículos
ALTER TABLE public.articulos
  ADD COLUMN IF NOT EXISTS proveedor text,
  ADD COLUMN IF NOT EXISTS tamano text,
  ADD COLUMN IF NOT EXISTS empaque text;

-- Índices opcionales para búsquedas por texto parcial (ILIKE) en catálogos grandes
CREATE INDEX IF NOT EXISTS idx_articulos_proveedor ON public.articulos (proveedor);
CREATE INDEX IF NOT EXISTS idx_articulos_tamano ON public.articulos (tamano);
CREATE INDEX IF NOT EXISTS idx_articulos_empaque ON public.articulos (empaque);
