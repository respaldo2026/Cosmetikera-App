-- ================================================
-- INVESTIGAR: ¿QUÉ MONTOS HAY EXACTAMENTE EN PAGOS?
-- ================================================

-- =============================================
-- 1. VER TODOS LOS PAGOS CON MONTOS DETALLADOS
-- =============================================
SELECT 
    id,
    numero_cuota,
    periodo_pagado,
    monto,
    estado,
    metodo_pago,
    created_at
FROM pagos
ORDER BY numero_cuota, created_at;

-- =============================================
-- 2. SUMA DE MONTOS POR ESTADO
-- =============================================
SELECT 
    estado,
    COUNT(*) as cantidad_pagos,
    SUM(monto) as suma_monto
FROM pagos
GROUP BY estado;

-- Resultado esperado:
-- pagado     | 1 | 190000 (tu inscripción)
-- pendiente  | 4 | 1040000 (cuotas mensuales)
-- TOTAL = 1,230,000

-- =============================================
-- 3. VER EL PAGO DE INSCRIPCIÓN ESPECÍFICO
-- =============================================
SELECT 
    id,
    estudiante_id,
    matricula_id,
    monto,
    estado,
    metodo_pago,
    referencia,
    fecha_pago,
    observaciones,
    created_at
FROM pagos
WHERE numero_cuota = 0;

-- =============================================
-- 4. VER LAS CUOTAS MENSUALES
-- =============================================
SELECT 
    numero_cuota,
    periodo_pagado,
    monto,
    estado,
    fecha_vencimiento
FROM pagos
WHERE numero_cuota > 0
ORDER BY numero_cuota;

-- =============================================
-- 5. VERIFICAR POLÍTICAS RLS ACTUALES
-- =============================================
SELECT 
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'pagos';

-- Debe haber SOLO 1 política

-- =============================================
-- 6. VER SI HAY DUPLICADOS
-- =============================================
SELECT 
    matricula_id,
    numero_cuota,
    COUNT(*) as veces_creado
FROM pagos
GROUP BY matricula_id, numero_cuota
HAVING COUNT(*) > 1;

-- Si hay resultados = pagos duplicados (problema)

-- ================================================
-- ANÁLISIS ESPERADO:
-- ================================================
-- Dashboard suma: $190,000 (inscripción) + $1,040,000 (4 cuotas) = $1,230,000
-- El problema es que dashboard NO filtra por estado="pagado"
-- Solo debería mostrar: $190,000 (lo que realmente se pagó)
-- ================================================
