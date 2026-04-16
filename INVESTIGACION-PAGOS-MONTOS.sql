-- ================================================
-- INVESTIGACIÓN: PAGOS CON MONTOS INCORRECTOS
-- ================================================
-- Ejecuta esto en Supabase para ver qué pagos se registraron
-- ================================================

-- =============================================
-- 1. TODOS LOS PAGOS CON DETALLES COMPLETOS
-- =============================================
SELECT 
    p.id,
    p.estudiante_id,
    p.matricula_id,
    p.numero_cuota,
    p.periodo_pagado,
    p.monto,
    p.estado,
    p.metodo_pago,
    p.fecha_pago,
    p.referencia,
    p.observaciones,
    p.created_at,
    prf.nombre_completo as estudiante,
    c.nombre as curso
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
ORDER BY p.created_at DESC
LIMIT 50;

-- =============================================
-- 2. SUMA TOTAL DE PAGOS (Sin filtro)
-- =============================================
-- Esto es lo que muestra el dashboard
SELECT 
    COUNT(*) as total_pagos,
    SUM(monto) as suma_total,
    AVG(monto) as monto_promedio,
    MIN(monto) as monto_minimo,
    MAX(monto) as monto_maximo
FROM pagos;

-- =============================================
-- 3. SUMA TOTAL POR ESTADO
-- =============================================
-- Ver cuánto suma cada estado
SELECT 
    estado,
    COUNT(*) as cantidad,
    SUM(monto) as total_monto
FROM pagos
GROUP BY estado
ORDER BY total_monto DESC;

-- =============================================
-- 4. PAGOS POR MATRÍCULA (para ver si hay duplicados)
-- =============================================
-- Ver qué pagos tiene cada matrícula
SELECT 
    m.id as matricula_id,
    m.estado as estado_matricula,
    prf.nombre_completo as estudiante,
    c.nombre as curso,
    c.precio as precio_curso,
    COUNT(p.id) as total_pagos,
    SUM(p.monto) as suma_pagos,
    STRING_AGG(p.numero_cuota::text, ', ') as cuotas_registradas,
    STRING_AGG(p.periodo_pagado, ', ') as periodos
FROM matriculas m
LEFT JOIN perfiles prf ON m.estudiante_id = prf.id
LEFT JOIN cursos c ON m.curso_id = c.id
LEFT JOIN pagos p ON m.id = p.matricula_id
GROUP BY m.id, m.estado, prf.nombre_completo, c.nombre, c.precio
ORDER BY m.created_at DESC
LIMIT 30;

-- =============================================
-- 5. PAGOS SIN REFERENCIA (posibles errores)
-- =============================================
-- Buscar pagos incompletos o raros
SELECT 
    id,
    estudiante_id,
    matricula_id,
    monto,
    estado,
    periodo_pagado,
    numero_cuota,
    metodo_pago,
    referencia,
    observaciones,
    created_at
FROM pagos
WHERE referencia IS NULL 
   OR observaciones IS NULL
   OR metodo_pago IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- =============================================
-- 6. PAGOS CON MONTO CERO O NEGATIVO
-- =============================================
-- Detectar datos inválidos
SELECT 
    id,
    monto,
    estado,
    periodo_pagado,
    numero_cuota,
    observaciones,
    created_at
FROM pagos
WHERE monto <= 0 OR monto IS NULL
ORDER BY created_at DESC;

-- =============================================
-- 7. ÚLTIMOS 10 PAGOS REGISTRADOS
-- =============================================
SELECT 
    p.id,
    p.monto,
    p.estado,
    p.numero_cuota,
    p.periodo_pagado,
    prf.nombre_completo,
    c.nombre as curso,
    p.created_at
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
ORDER BY p.created_at DESC
LIMIT 10;

-- =============================================
-- 8. MATRÍCULAS CREADAS PERO SIN PAGOS
-- =============================================
-- Investigar si el trigger está funcionando
SELECT 
    m.id as matricula_id,
    m.estudiante_id,
    m.estado,
    prf.nombre_completo,
    c.nombre as curso,
    c.precio,
    COUNT(p.id) as pagos_asociados,
    m.created_at
FROM matriculas m
LEFT JOIN perfiles prf ON m.estudiante_id = prf.id
LEFT JOIN cursos c ON m.curso_id = c.id
LEFT JOIN pagos p ON m.id = p.matricula_id
GROUP BY m.id, m.estudiante_id, m.estado, prf.nombre_completo, c.nombre, c.precio, m.created_at
HAVING COUNT(p.id) = 0
ORDER BY m.created_at DESC
LIMIT 20;

-- =============================================
-- 9. VER SI EL TRIGGER ESTÁ ACTIVO
-- =============================================
SELECT 
    tgname as trigger_name,
    tgenabled as is_enabled,
    (SELECT proname FROM pg_proc WHERE oid = tgfoid) as function_name
FROM pg_trigger
WHERE tgrelid = 'matriculas'::regclass;

-- =============================================
-- 10. COMPARAR MONTOS: MATRÍCULA vs PAGOS
-- =============================================
-- Ver si el monto inscrito coincide con lo que se pagó
SELECT 
    m.id as matricula_id,
    m.estudiante_id,
    c.nombre as curso,
    c.precio as precio_programado,
    COALESCE(prog.precio_inscripcion, 50000) as precio_inscripcion_programado,
    (SELECT monto FROM pagos p WHERE p.matricula_id = m.id AND p.numero_cuota = 0 LIMIT 1) as monto_inscripcion_pagado,
    (SELECT COUNT(*) FROM pagos p WHERE p.matricula_id = m.id) as total_cuotas_generadas,
    m.created_at
FROM matriculas m
LEFT JOIN cursos c ON m.curso_id = c.id
LEFT JOIN programas prog ON c.programa_id = prog.id
ORDER BY m.created_at DESC
LIMIT 20;

-- ================================================
-- FIN DE INVESTIGACIÓN
-- ================================================
-- Ejecuta cada query y comparte los resultados
-- para identificar el origen del problema
-- ================================================
