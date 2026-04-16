-- ================================================
-- FIX: AGREGAR COLUMNA ESTADO A TABLA PAGOS
-- ================================================
-- Permite rastrear pagos pendientes, pagados, vencidos, etc.
-- ================================================

-- 1. Agregar columna estado si no existe
ALTER TABLE pagos 
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente' 
CHECK (estado IN ('pendiente', 'pagado', 'vencido', 'cancelado'));

-- 2. Actualizar pagos existentes que tienen fecha_pago a 'pagado'
UPDATE pagos 
SET estado = 'pagado' 
WHERE estado IS NULL AND fecha_pago IS NOT NULL;

-- 3. Asegurar que los pagos sin fecha_pago tengan estado 'pendiente'
UPDATE pagos 
SET estado = 'pendiente' 
WHERE estado IS NULL;

-- 4. Actualizar CHECK constraint para pagos_metodo_pago_check
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_pago_check;

ALTER TABLE pagos
ADD CONSTRAINT pagos_metodo_pago_check 
CHECK (
    metodo_pago IS NULL OR 
    LOWER(metodo_pago) IN ('efectivo', 'transferencia', 'tarjeta', 'nequi', 'sistecredito', 'otro')
);

-- 5. Verificar la tabla
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pagos' 
ORDER BY ordinal_position;
