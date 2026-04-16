-- ================================================
-- DEBUG: INVESTIGAR POR QUÉ NO SE VE EL PAGO
-- ================================================
-- Este script ayuda a diagnosticar el problema
-- ================================================

-- =============================================
-- 1. VERIFICAR ESTRUCTURA DE TABLA PAGOS
-- =============================================
-- Ver todas las columnas
\d pagos;

-- =============================================
-- 2. VERIFICAR RLS ACTUAL EN PAGOS
-- =============================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    qual AS "Condición",
    with_check AS "With Check"
FROM pg_policies
WHERE tablename = 'pagos'
ORDER BY policyname;

-- =============================================
-- 3. VER SI RLS ESTÁ HABILITADO
-- =============================================
SELECT 
    t.tablename,
    t.schemaname,
    (SELECT rowsecurity FROM pg_class 
     WHERE relname = t.tablename AND relnamespace = (
        SELECT oid FROM pg_namespace WHERE nspname = t.schemaname
     )
    ) AS rls_enabled
FROM pg_tables t
WHERE t.tablename = 'pagos';

-- =============================================
-- 4. BUSCAR TODOS LOS PAGOS SIN FILTRO
-- =============================================
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

-- =============================================
-- 5. BUSCAR ESPECÍFICAMENTE PAGOS DE INSCRIPCIÓN
-- =============================================
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
WHERE numero_cuota = 0
   OR periodo_pagado ILIKE 'inscripcion%'
ORDER BY created_at DESC
LIMIT 20;

-- =============================================
-- 6. VER TODAS LAS MATRÍCULAS CON SUS PAGOS
-- =============================================
SELECT 
    m.id as matricula_id,
    m.estudiante_id,
    m.estado as estado_matricula,
    m.fecha_inicio,
    c.nombre as curso,
    COUNT(p.id) as total_pagos,
    MAX(CASE WHEN p.estado = 'pagado' THEN 1 ELSE 0 END) as tiene_pagos_confirmados
FROM matriculas m
LEFT JOIN cursos c ON m.curso_id = c.id
LEFT JOIN pagos p ON m.id = p.matricula_id
GROUP BY m.id, m.estudiante_id, m.estado, m.fecha_inicio, c.nombre
ORDER BY m.created_at DESC
LIMIT 20;

-- =============================================
-- 7. VERIFICAR SI EXISTEN ÍNDICES EN PAGOS
-- =============================================
\d pagos;

-- =============================================
-- 8. VER TODAS LAS CONSTRAINTS EN PAGOS
-- =============================================
SELECT
    table_name,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'pagos';

-- =============================================
-- NOTA: Ejecuta este script en Supabase SQL Editor
-- y copia los resultados aquí para debugging
-- ================================================
