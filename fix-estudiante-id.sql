-- ================================================
-- FIX DEFINITIVO: CORREGIR ESTUDIANTE_ID Y VERIFICAR
-- ================================================

-- =============================================
-- PASO 1: Actualizar estudiante_id en TODOS los pagos
-- =============================================
UPDATE pagos p
SET estudiante_id = m.estudiante_id
FROM matriculas m
WHERE p.matricula_id = m.id
AND (p.estudiante_id IS NULL OR p.estudiante_id != m.estudiante_id);

-- =============================================
-- PASO 2: Verificar que se actualizó correctamente
-- =============================================
SELECT 
    p.id,
    p.numero_cuota,
    p.periodo_pagado,
    p.monto,
    p.estado,
    p.fecha_pago,
    p.estudiante_id,
    prf.nombre_completo,
    c.nombre as curso
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
WHERE p.estado = 'pagado'
ORDER BY p.fecha_pago DESC NULLS LAST;

-- RESULTADO ESPERADO: 1 fila con nombre_completo POBLADO

-- =============================================
-- PASO 3: Ver TODOS los pagos (para verificar dashboard)
-- =============================================
SELECT 
    estado,
    COUNT(*) as cantidad,
    SUM(monto) as suma_total
FROM pagos
GROUP BY estado
ORDER BY estado;

-- RESULTADO ESPERADO:
-- pagado     | 1 | 190000
-- pendiente  | 4 | 1040000

-- =============================================
-- PASO 4: Contar políticas RLS
-- =============================================
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE tablename = 'pagos';

-- DEBE SER: 1
