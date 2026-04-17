-- Migración: agregar descuento_porcentaje a la tabla articulos
-- Ejecutar en: Supabase Dashboard → SQL Editor

ALTER TABLE articulos
  ADD COLUMN IF NOT EXISTS descuento_porcentaje numeric(5,2) DEFAULT NULL;

-- Verificar que quedó bien
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'articulos'
  AND column_name IN ('descuento_porcentaje', 'promocion_texto');
