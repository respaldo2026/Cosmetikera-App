-- ================================================
-- DIAGNOSIS: Verificar estado del trigger y función
-- Fecha: 2026-01-12
-- Propósito: Diagnosticar por qué no se generan cuotas automáticas
-- ================================================

-- 1. VERIFICAR que la tabla matriculas tiene la columna observaciones
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matriculas' AND column_name = 'observaciones'
) AS "¿Existe columna observaciones en matriculas?";

-- 2. VERIFICAR que existe la función generar_cuotas_automaticas
SELECT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'generar_cuotas_automaticas'
) AS "¿Existe función generar_cuotas_automaticas?";

-- 3. VERIFICAR que existe el trigger trigger_generar_cuotas
SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_generar_cuotas'
) AS "¿Existe trigger trigger_generar_cuotas?";

-- 4. VER TODAS LAS MATRICULAS CREADAS
SELECT 
    m.id,
    m.estudiante_id,
    m.curso_id,
    m.fecha_inicio,
    m.estado,
    m.created_at,
    (SELECT COUNT(*) FROM pagos WHERE matricula_id = m.id) as "Pagos generados"
FROM matriculas m
ORDER BY m.created_at DESC
LIMIT 10;

-- 5. VER LOS PAGOS GENERADOS POR CADA MATRÍCULA
SELECT 
    m.id as matricula_id,
    COUNT(p.id) as total_pagos,
    STRING_AGG(p.periodo_pagado, ', ') as periodos,
    STRING_AGG(p.numero_cuota::text, ', ') as cuotas,
    STRING_AGG(p.estado, ', ') as estados
FROM matriculas m
LEFT JOIN pagos p ON m.id = p.matricula_id
GROUP BY m.id
ORDER BY m.created_at DESC
LIMIT 10;

-- 6. VER TODAS LAS COLUMNAS DE LA TABLA PAGOS
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pagos'
ORDER BY ordinal_position;

-- ================================================
-- INSTRUCCIONES:
-- Ejecuta este script completo en Supabase SQL Editor
-- Analiza los resultados para ver dónde está el problema
-- ================================================
