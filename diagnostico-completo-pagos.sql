-- ================================================
-- DIAGNÓSTICO COMPLETO - POR QUÉ NO SE VEN LOS PAGOS
-- ================================================

-- =============================================
-- 1. VERIFICAR QUE EL PAGO EXISTE
-- =============================================
SELECT 
    'PASO 1: Verificar pago existe' as paso,
    COUNT(*) as total_pagos,
    COUNT(CASE WHEN estado = 'pagado' THEN 1 END) as pagos_pagados,
    COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pagos_pendientes,
    SUM(monto) as suma_total
FROM pagos;

-- =============================================
-- 2. VER TODOS LOS DATOS DEL PAGO PAGADO
-- =============================================
SELECT 
    'PASO 2: Datos completos del pago' as paso,
    p.*
FROM pagos p
WHERE p.estado = 'pagado'
LIMIT 5;

-- =============================================
-- 3. VERIFICAR FOREIGN KEYS Y JOINS
-- =============================================
SELECT 
    'PASO 3: Join con perfiles' as paso,
    p.id,
    p.monto,
    p.estado,
    p.estudiante_id,
    p.matricula_id,
    p.created_at,
    prf.nombre_completo,
    prf.id as perfil_id_existe
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
WHERE p.estado = 'pagado';

-- =============================================
-- 4. VERIFICAR JOIN CON MATRICULAS Y CURSOS
-- =============================================
SELECT 
    'PASO 4: Join con matriculas y cursos' as paso,
    p.id,
    p.monto,
    p.estado,
    p.matricula_id,
    m.id as mat_id_existe,
    m.curso_id,
    c.nombre as curso_nombre
FROM pagos p
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
WHERE p.estado = 'pagado';

-- =============================================
-- 5. QUERY EXACTA DE TESORERÍA
-- =============================================
SELECT 
    'PASO 5: Query tesorería completa' as paso,
    p.*,
    prf.nombre_completo,
    c.nombre as curso_nombre
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
ORDER BY p.created_at DESC;

-- =============================================
-- 6. VERIFICAR POLÍTICAS RLS ACTIVAS
-- =============================================
SELECT 
    'PASO 6: Políticas RLS' as paso,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'pagos';

-- =============================================
-- 7. VERIFICAR SI RLS ESTÁ HABILITADO
-- =============================================
SELECT 
    'PASO 7: Estado RLS' as paso,
    schemaname,
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables
WHERE tablename = 'pagos';

-- =============================================
-- 8. PROBAR QUERY SIN JOINS (SOLO PAGOS)
-- =============================================
SELECT 
    'PASO 8: Pagos sin joins' as paso,
    id,
    monto,
    estado,
    estudiante_id,
    matricula_id,
    created_at
FROM pagos
ORDER BY created_at DESC;

-- =============================================
-- 9. CONTAR REGISTROS POR CADA TABLA
-- =============================================
SELECT 
    'PASO 9: Conteo de registros' as paso,
    (SELECT COUNT(*) FROM pagos) as total_pagos,
    (SELECT COUNT(*) FROM matriculas) as total_matriculas,
    (SELECT COUNT(*) FROM perfiles WHERE rol = 'estudiante') as total_estudiantes;

-- =============================================
-- 10. VERIFICAR ESTRUCTURA DE FOREIGN KEYS
-- =============================================
SELECT 
    'PASO 10: Foreign keys en pagos' as paso,
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='pagos';
