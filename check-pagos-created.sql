-- ================================================
-- DIAGNOSIS DETALLADA: Verificar si se crean pagos
-- Fecha: 2026-01-12
-- ================================================

-- 1. VER TODAS LAS MATRICULAS RECIENTES
SELECT 
    m.id,
    m.estudiante_id,
    m.curso_id,
    m.fecha_inicio,
    m.estado,
    m.created_at,
    c.nombre as curso_nombre,
    p_est.nombre_completo as estudiante_nombre
FROM matriculas m
LEFT JOIN cursos c ON m.curso_id = c.id
LEFT JOIN perfiles p_est ON m.estudiante_id = p_est.id
ORDER BY m.created_at DESC
LIMIT 5;

-- 2. VER CUÁNTOS PAGOS EXISTEN POR CADA MATRÍCULA
SELECT 
    m.id as matricula_id,
    COUNT(p.id) as total_pagos,
    STRING_AGG(p.numero_cuota::text, ', ' ORDER BY p.numero_cuota) as cuotas,
    STRING_AGG(p.periodo_pagado, ', ' ORDER BY p.numero_cuota) as periodos,
    STRING_AGG(p.estado, ', ' ORDER BY p.numero_cuota) as estados,
    STRING_AGG(p.monto::text, ', ' ORDER BY p.numero_cuota) as montos
FROM matriculas m
LEFT JOIN pagos p ON m.id = p.matricula_id
GROUP BY m.id
ORDER BY m.created_at DESC
LIMIT 5;

-- 3. VER TODOS LOS PAGOS DE LA MATRÍCULA MÁS RECIENTE
WITH ultima_matricula AS (
    SELECT id FROM matriculas ORDER BY created_at DESC LIMIT 1
)
SELECT 
    p.id,
    p.numero_cuota,
    p.periodo_pagado,
    p.monto,
    p.estado,
    p.fecha_vencimiento,
    p.fecha_pago,
    p.observaciones
FROM pagos p, ultima_matricula um
WHERE p.matricula_id = um.id
ORDER BY p.numero_cuota;

-- 4. VERIFICAR SI EL TRIGGER ESTÁ ACTIVO
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trigger_generar_cuotas';

-- ================================================
-- Interpreta los resultados:
-- - Si no hay pagos en resultado 2: El trigger no está funcionando
-- - Si hay pagos pero montos en 0: La función no está leyendo precio_mensualidad
-- - Si hay pagos pero no aparecen en UI: Problema en el frontend
-- ================================================
