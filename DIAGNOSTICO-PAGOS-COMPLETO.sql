-- ================================================
-- DIAGNOSTICO COMPLETO: SISTEMA DE PAGOS
-- ================================================
-- Ejecuta esto en Supabase SQL Editor
-- Copia los resultados si hay problemas
-- ================================================

-- ==========================================
-- TABLA 1: ESTRUCTURA DE TABLA PAGOS
-- ==========================================
-- Debe tener: id, estudiante_id, matricula_id, monto, estado, 
--             numero_cuota, periodo_pagado, fecha_vencimiento, fecha_pago, etc.
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'pagos'
ORDER BY ordinal_position;

-- ==========================================
-- TABLA 2: RLS POLICIES ACTIVAS
-- ==========================================
-- Debe haber SOLO 1 policy permisiva
SELECT 
    policyname,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'pagos';

-- ==========================================
-- TABLA 3: RLS HABILITADO?
-- ==========================================
-- Debe ser TRUE
SELECT 
    schemaname,
    tablename,
    (
        SELECT rowsecurity 
        FROM pg_class 
        WHERE relname = t.tablename 
        AND relnamespace = (
            SELECT oid FROM pg_namespace 
            WHERE nspname = t.schemaname
        )
    ) AS rls_enabled
FROM pg_tables t
WHERE t.tablename = 'pagos'
AND t.schemaname = 'public';

-- ==========================================
-- TABLA 4: TRIGGERS EN MATRICULAS
-- ==========================================
-- Debe haver trigger_generar_cuotas ENABLED
SELECT 
    tgname AS trigger_name,
    tgenabled AS is_enabled,
    (
        SELECT proname 
        FROM pg_proc 
        WHERE oid = tgfoid
    ) AS function_name
FROM pg_trigger
WHERE tgrelid = 'matriculas'::regclass;

-- ==========================================
-- TABLA 5: FUNCIÓN DE GENERACIÓN DE CUOTAS
-- ==========================================
-- Debe exister la función generar_cuotas_automaticas
SELECT 
    proname,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'generar_cuotas_automaticas';

-- ==========================================
-- TABLA 6: ÚLTIMOS 20 PAGOS REGISTRADOS
-- ==========================================
-- Para verificar que se están creando
SELECT 
    id,
    estudiante_id,
    matricula_id,
    numero_cuota,
    periodo_pagado,
    estado,
    monto,
    metodo_pago,
    fecha_pago,
    created_at
FROM pagos
ORDER BY created_at DESC
LIMIT 20;

-- ==========================================
-- TABLA 7: PAGOS DE INSCRIPCIÓN (numero_cuota = 0)
-- ==========================================
-- Todos los pagos de inscripción
SELECT 
    p.id,
    p.estudiante_id,
    p.matricula_id,
    p.numero_cuota,
    p.periodo_pagado,
    p.estado,
    p.monto,
    p.fecha_pago,
    prf.nombre_completo as estudiante,
    c.nombre as curso
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
WHERE p.numero_cuota = 0 OR LOWER(p.periodo_pagado) = 'inscripción'
ORDER BY p.created_at DESC
LIMIT 20;

-- ==========================================
-- TABLA 8: MATRÍCULAS Y SUS PAGOS
-- ==========================================
-- Ver relación matriculas → pagos
SELECT 
    m.id as matricula_id,
    m.estudiante_id,
    m.estado as estado_matricula,
    prf.nombre_completo,
    c.nombre as curso,
    COUNT(p.id) as total_pagos,
    COUNT(CASE WHEN p.estado = 'pagado' THEN 1 END) as pagos_pagados,
    COUNT(CASE WHEN p.estado = 'pendiente' THEN 1 END) as pagos_pendientes,
    MAX(p.created_at) as ultimo_pago
FROM matriculas m
LEFT JOIN perfiles prf ON m.estudiante_id = prf.id
LEFT JOIN cursos c ON m.curso_id = c.id
LEFT JOIN pagos p ON m.id = p.matricula_id
GROUP BY m.id, m.estudiante_id, m.estado, prf.nombre_completo, c.nombre
ORDER BY m.created_at DESC
LIMIT 20;

-- ==========================================
-- TABLA 9: ÍNDICES EN PAGOS
-- ==========================================
-- Debe haber varios índices para performance
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'pagos'
ORDER BY indexname;

-- ==========================================
-- TABLA 10: RESUMEN DE SALUD DEL SISTEMA
-- ==========================================
-- Diagnóstico rápido
SELECT 
    'Campos en tabla pagos' as categoria,
    COUNT(*)::text as cantidad
FROM information_schema.columns
WHERE table_name = 'pagos'
UNION ALL
SELECT 'RLS Policies',
    COUNT(*)::text
FROM pg_policies
WHERE tablename = 'pagos'
UNION ALL
SELECT 'Triggers en matriculas',
    COUNT(*)::text
FROM pg_trigger
WHERE tgrelid = 'matriculas'::regclass
UNION ALL
SELECT 'Total pagos registrados',
    COUNT(*)::text
FROM pagos
UNION ALL
SELECT 'Pagos pagados',
    COUNT(*)::text
FROM pagos
WHERE estado = 'pagado'
UNION ALL
SELECT 'Pagos pendientes',
    COUNT(*)::text
FROM pagos
WHERE estado = 'pendiente'
UNION ALL
SELECT 'Pagos de inscripción',
    COUNT(*)::text
FROM pagos
WHERE numero_cuota = 0 OR LOWER(periodo_pagado) ILIKE '%inscripci%';

-- ================================================
-- FIN DEL DIAGNÓSTICO
-- ================================================
-- Comparte estos resultados si algo falla
-- Date los pasos del fix completo en fix-rls-pagos.sql
-- ================================================
