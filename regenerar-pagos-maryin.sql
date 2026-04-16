-- =====================================================
-- REGENERAR PAGOS PARA MARYIN (después de actualizar duración)
-- =====================================================

-- 1. Primero: Eliminar los pagos existentes
DELETE FROM pagos 
WHERE estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518';

-- 2. Luego: Actualizar la matrícula para que el trigger se ejecute nuevamente
UPDATE matriculas 
SET updated_at = NOW()
WHERE estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518';

-- 3. Verificar que se generaron 6 pagos
SELECT 
    COUNT(*) as total_pagos,
    COUNT(CASE WHEN numero_cuota = 0 THEN 1 END) as inscripciones,
    COUNT(CASE WHEN numero_cuota > 0 THEN 1 END) as cuotas_mensuales,
    SUM(monto) as total_monto
FROM pagos
WHERE estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518';

-- 4. Ver detalle de los pagos
SELECT 
    numero_cuota,
    periodo_pagado,
    monto,
    estado,
    created_at
FROM pagos
WHERE estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518'
ORDER BY numero_cuota;
