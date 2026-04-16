-- ================================================
-- DEBUG: POR QUÉ NO APARECE EL PAGO EN TESORERÍA
-- ================================================
-- Verifica si el problema está en:
-- 1. El trigger no crea el pago
-- 2. El pago se crea pero con monto incorrecto
-- 3. El pago se crea pero está oculto por RLS
-- 4. El formulario no actualiza correctamente
-- ================================================

-- =============================================
-- PASO 1: CONFIRMAR QUE EL TRIGGER EXISTE
-- =============================================
SELECT 
    tgname,
    tgenabled,
    (SELECT proname FROM pg_proc WHERE oid = tgfoid) as function_name
FROM pg_trigger
WHERE tgrelid = 'matriculas'::regclass
AND tgname = 'trigger_generar_cuotas';

-- Si está vacío = TRIGGER NO EXISTE (problema crítico)
-- Si tgenabled = false = TRIGGER DESHABILITADO (problema crítico)

-- =============================================
-- PASO 2: VER TODAS LAS MATRÍCULAS
-- =============================================
SELECT 
    m.id,
    m.estudiante_id,
    m.estado,
    m.created_at,
    (SELECT COUNT(*) FROM pagos WHERE matricula_id = m.id) as pagos_generados,
    (SELECT COUNT(*) FROM pagos WHERE matricula_id = m.id AND numero_cuota = 0) as pagos_inscripcion,
    (SELECT SUM(monto) FROM pagos WHERE matricula_id = m.id) as suma_pagos
FROM matriculas m
ORDER BY m.created_at DESC
LIMIT 10;

-- Si "pagos_generados" = 0 = EL TRIGGER NO ESTÁ CREANDO PAGOS (problema crítico)

-- =============================================
-- PASO 3: VER LOS PAGOS DE INSCRIPCIÓN
-- =============================================
SELECT 
    id,
    matricula_id,
    numero_cuota,
    periodo_pagado,
    monto,
    estado,
    metodo_pago,
    created_at
FROM pagos
WHERE numero_cuota = 0
ORDER BY created_at DESC
LIMIT 10;

-- =============================================
-- PASO 4: BUSCAR PAGOS HUÉRFANOS (sin matrícula)
-- =============================================
SELECT 
    id,
    matricula_id,
    monto,
    estado,
    numero_cuota,
    created_at
FROM pagos
WHERE matricula_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- =============================================
-- PASO 5: VER LA FUNCIÓN DEL TRIGGER
-- =============================================
SELECT 
    proname,
    prosrc
FROM pg_proc
WHERE proname = 'generar_cuotas_automaticas';

-- Si está vacío = FUNCIÓN NO EXISTE (problema crítico)

-- =============================================
-- PASO 6: CONTAR RESULTADOS TOTALES
-- =============================================
SELECT 
    'Total matrículas' as entity,
    COUNT(*) as cantidad
FROM matriculas
UNION ALL
SELECT 'Total pagos',
    COUNT(*)
FROM pagos
UNION ALL
SELECT 'Pagos inscripción',
    COUNT(*)
FROM pagos
WHERE numero_cuota = 0
UNION ALL
SELECT 'Pagos estado "pagado"',
    COUNT(*)
FROM pagos
WHERE estado = 'pagado'
UNION ALL
SELECT 'Pagos estado "pendiente"',
    COUNT(*)
FROM pagos
WHERE estado = 'pendiente'
UNION ALL
SELECT 'Políticas RLS en pagos',
    COUNT(*)
FROM pg_policies
WHERE tablename = 'pagos';

-- ================================================
-- INSTRUCCIONES:
-- ================================================
-- 1. Ejecuta PASO 1: Si trigger existe?
--    - SI: continúa a PASO 2
--    - NO: El trigger NO EXISTE = necesitas ejecutar fix-rls-pagos.sql
-- 
-- 2. Ejecuta PASO 2: ¿Cuántos pagos se crearon?
--    - > 0: El trigger SÍ está creando pagos
--    - 0: El trigger NO está creando pagos = necesitas fix-rls-pagos.sql
--
-- 3. Ejecuta PASO 4: ¿Hay pagos sin matricula?
--    - SI hay: El UPDATE está fallando
--    - NO hay: El UPDATE está funcionando
--
-- 4. Ejecuta PASO 6: Resumen general de salud
--
-- Comparte los resultados si no funciona
-- ================================================
