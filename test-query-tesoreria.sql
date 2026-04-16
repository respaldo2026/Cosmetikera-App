-- ================================================
-- SIMULAR QUERY DE TESORERÍA
-- ================================================
-- Esto prueba el query exacto que usa la página de tesorería
-- ================================================

-- =============================================
-- 1. QUERY BÁSICO (sin joins)
-- =============================================
SELECT 
    id,
    estudiante_id,
    matricula_id,
    monto,
    estado,
    metodo_pago,
    fecha_pago,
    numero_cuota,
    periodo_pagado
FROM pagos
ORDER BY fecha_pago DESC NULLS LAST;

-- Si esto falla = problema en columnas faltantes

-- =============================================
-- 2. QUERY CON JOINS (como en tesorería)
-- =============================================
SELECT 
    p.*,
    prf.nombre_completo,
    c.nombre as curso
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
ORDER BY p.fecha_pago DESC NULLS LAST;

-- Si esto falla = problema en las relaciones

-- =============================================
-- 3. VERIFICAR SI FALTA EL CAMPO estudiante_id
-- =============================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'pagos'
AND column_name = 'estudiante_id';

-- Debe existir

-- =============================================
-- 4. VERIFICAR QUE LOS PAGOS TIENEN estudiante_id
-- =============================================
SELECT 
    id,
    estudiante_id,
    matricula_id,
    monto,
    CASE 
        WHEN estudiante_id IS NULL THEN '❌ FALTA'
        ELSE '✅ OK'
    END as tiene_estudiante
FROM pagos;

-- Si alguno dice "❌ FALTA" = problema

-- =============================================
-- 5. VERIFICAR QUE PERFILES TIENE LOS ESTUDIANTES
-- =============================================
SELECT 
    p.id as pago_id,
    p.estudiante_id,
    prf.id as perfil_existe,
    prf.nombre_completo
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
WHERE prf.id IS NULL;

-- Si hay resultados = pagos huérfanos sin estudiante

-- =============================================
-- 6. FILTRAR SOLO PAGOS CON ESTADO "pagado"
-- =============================================
-- Esto es lo que DEBERÍA mostrar tesorería
SELECT 
    p.id,
    p.numero_cuota,
    p.periodo_pagado,
    p.monto,
    p.estado,
    p.fecha_pago,
    prf.nombre_completo,
    c.nombre as curso
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
WHERE p.estado = 'pagado'
ORDER BY p.fecha_pago DESC NULLS LAST;

-- Debe aparecer 1 pago (tu inscripción de $190,000)

-- ================================================
-- DIAGNÓSTICO:
-- ================================================
-- Si query 6 muestra 1 pago pero tesorería está vacía:
-- - Problema de RLS (aún bloqueado)
-- - Problema de caché del navegador
-- - Error en el componente React
--
-- Si query 6 está vacío:
-- - Los pagos no tienen estudiante_id
-- - Los pagos están mal creados
-- ================================================
