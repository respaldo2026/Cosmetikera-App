-- ================================================
-- VERIFICACIÓN ESPECÍFICA: ESTUDIANTE MARYIN
-- ================================================

-- 1. Buscar el ID del estudiante MARYIN
SELECT 
    'PASO 1: ID de MARYIN' as paso,
    id,
    nombre_completo,
    email,
    rol
FROM perfiles
WHERE nombre_completo ILIKE '%MARYIN%' OR nombre_completo ILIKE '%MARVIN%';

-- 2. Ver matrículas de MARYIN (usar el ID del paso anterior)
SELECT 
    'PASO 2: Matrículas de MARYIN' as paso,
    m.id as matricula_id,
    m.estudiante_id,
    m.curso_id,
    m.estado,
    c.nombre as curso_nombre,
    c.duracion as duracion_ciclos
FROM matriculas m
LEFT JOIN cursos c ON m.curso_id = c.id
WHERE m.estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518';  -- Reemplaza con el ID del PASO 1

-- 3. Ver TODOS los pagos de MARYIN
SELECT 
    'PASO 3: Pagos de MARYIN' as paso,
    p.id,
    p.numero_cuota,
    p.periodo_pagado,
    p.monto,
    p.estado,
    p.fecha_pago,
    p.matricula_id,
    p.estudiante_id,
    p.created_at
FROM pagos p
WHERE p.estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518'  -- Reemplaza con el ID del PASO 1
ORDER BY p.numero_cuota;

-- 4. Contar cuántos pagos tiene por estado
SELECT 
    'PASO 4: Conteo por estado' as paso,
    estado,
    COUNT(*) as cantidad,
    SUM(monto) as total
FROM pagos
WHERE estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518'  -- Reemplaza con el ID del PASO 1
GROUP BY estado;

-- 5. Ver el trigger: ¿se generaron los pagos automáticamente?
SELECT 
    'PASO 5: Verificar trigger' as paso,
    COUNT(*) as total_pagos_generados,
    COUNT(CASE WHEN numero_cuota = 0 THEN 1 END) as inscripciones,
    COUNT(CASE WHEN numero_cuota > 0 THEN 1 END) as cuotas_mensuales
FROM pagos
WHERE estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518';  -- Reemplaza con el ID del PASO 1

-- 6. Ver si hay problemas con el campo estudiante_id
SELECT 
    'PASO 6: Validar estudiante_id' as paso,
    p.id,
    p.estudiante_id,
    p.matricula_id,
    m.estudiante_id as estudiante_id_desde_matricula,
    CASE 
        WHEN p.estudiante_id = m.estudiante_id THEN 'OK'
        ELSE 'MISMATCH'
    END as validacion
FROM pagos p
LEFT JOIN matriculas m ON p.matricula_id = m.id
WHERE p.estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518'  -- Reemplaza con el ID del PASO 1
   OR m.estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518';

-- 7. Probar la query EXACTA que usa el frontend
SELECT 
    'PASO 7: Query del frontend' as paso,
    p.id, 
    p.created_at, 
    p.estudiante_id, 
    p.fecha_pago, 
    p.fecha_vencimiento, 
    p.matricula_id, 
    p.periodo_pagado, 
    p.numero_cuota, 
    p.monto, 
    p.metodo_pago, 
    p.referencia, 
    p.observaciones, 
    p.estado,
    m.id as mat_id,
    c.nombre as curso_nombre
FROM pagos p
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
WHERE p.estudiante_id = '2a1b4310-1bab-4968-bf9e-aafa29f8d518'  -- Reemplaza con el ID del PASO 1
ORDER BY p.created_at DESC;
