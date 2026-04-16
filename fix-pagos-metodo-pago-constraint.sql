-- ================================================
-- FIX: Actualizar constraint de métodos de pago
-- Para permitir todos los métodos configurados
-- ================================================

-- 1. Eliminar constraint antiguo
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_pago_check;

-- 2. Crear nuevo constraint más permisivo
-- Permite NULL (para pagos pendientes) o cualquier valor en lowercase
-- que esté en la lista de métodos válidos
ALTER TABLE pagos 
ADD CONSTRAINT pagos_metodo_pago_check 
CHECK (
    metodo_pago IS NULL OR 
    LOWER(metodo_pago) IN ('efectivo', 'nequi', 'transferencia', 'sistecredito', 'tarjeta', 'qr', 'otro')
);

-- 3. Normalizar valores existentes a lowercase
UPDATE pagos 
SET metodo_pago = LOWER(metodo_pago)
WHERE metodo_pago IS NOT NULL;

-- 4. Verificación
SELECT DISTINCT metodo_pago 
FROM pagos 
WHERE metodo_pago IS NOT NULL
ORDER BY metodo_pago;

-- Mensaje de confirmación
SELECT 'Constraint actualizado correctamente. Métodos permitidos: efectivo, nequi, transferencia, sistecredito, tarjeta, qr, otro' as resultado;
