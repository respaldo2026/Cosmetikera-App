-- ================================================
-- MIGRACIÓN: Agregar columnas faltantes a tabla PAGOS
-- Fecha: 2026-01-12
-- Problema: El trigger intenta insertar numero_cuota y periodo_pagado pero estas columnas no existen
-- ================================================

-- 1. Verificar si las columnas existen, si no agregarlas
ALTER TABLE pagos
ADD COLUMN IF NOT EXISTS numero_cuota INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS periodo_pagado TEXT,
ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- 2. Crear índice en numero_cuota para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_pagos_numero_cuota ON pagos(numero_cuota);

-- 3. Crear índice compuesto: matricula_id + numero_cuota (muy útil para buscar cuotas específicas)
CREATE INDEX IF NOT EXISTS idx_pagos_matricula_numero ON pagos(matricula_id, numero_cuota);

-- 4. Crear índice en fecha_vencimiento para consultas de vencimiento
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_vencimiento ON pagos(fecha_vencimiento);

-- 5. Crear índice compuesto para búsquedas rápidas de estado
CREATE INDEX IF NOT EXISTS idx_pagos_estado_matricula ON pagos(estado, matricula_id);

-- 6. Verificar que la tabla tiene todas las columnas esperadas
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'pagos'
ORDER BY ordinal_position;
