-- ========================================
-- OPTIMIZACIÓN DE RENDIMIENTO: ÍNDICES EN BASE DE DATOS
-- ========================================
-- Estos índices acelerarán las consultas más comunes
-- Ejecutar en Supabase SQL Editor

-- 1. ÍNDICES PARA BÚSQUEDAS Y FILTROS COMUNES

-- Perfiles: búsquedas por rol y email
CREATE INDEX IF NOT EXISTS idx_perfiles_rol ON perfiles(rol);
CREATE INDEX IF NOT EXISTS idx_perfiles_email ON perfiles(email);
CREATE INDEX IF NOT EXISTS idx_perfiles_nombre_completo ON perfiles USING gin(to_tsvector('spanish', nombre_completo));

-- Matrículas: filtros por estado y fechas
CREATE INDEX IF NOT EXISTS idx_matriculas_estado ON matriculas(estado);
CREATE INDEX IF NOT EXISTS idx_matriculas_estudiante_id ON matriculas(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_curso_id ON matriculas(curso_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_created_at ON matriculas(created_at DESC);

-- Pagos: consultas por estado y fechas
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_vencimiento ON pagos(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_pagos_matricula_id ON pagos(matricula_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estudiante_id ON pagos(estudiante_id);

-- Cursos: filtros por estado y profesor
CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
CREATE INDEX IF NOT EXISTS idx_cursos_profesor_id ON cursos(profesor_id);
CREATE INDEX IF NOT EXISTS idx_cursos_programa_id ON cursos(programa_id);
CREATE INDEX IF NOT EXISTS idx_cursos_fecha_inicio ON cursos(fecha_inicio);

-- Asistencias: consultas por matrícula
CREATE INDEX IF NOT EXISTS idx_asistencias_matricula_id ON asistencias(matricula_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_estado ON asistencias(estado);

-- Clases: consultas por curso y fecha
CREATE INDEX IF NOT EXISTS idx_clases_curso_id ON clases(curso_id);
CREATE INDEX IF NOT EXISTS idx_clases_fecha_hora ON clases(fecha_hora);

-- Pagos nómina: por profesor y fecha
CREATE INDEX IF NOT EXISTS idx_pagos_nomina_profesor_id ON pagos_nomina(profesor_id);
CREATE INDEX IF NOT EXISTS idx_pagos_nomina_fecha_pago ON pagos_nomina(fecha_pago DESC);

-- 2. ÍNDICES COMPUESTOS PARA CONSULTAS COMPLEJAS

-- Matrículas activas por curso
CREATE INDEX IF NOT EXISTS idx_matriculas_curso_estado ON matriculas(curso_id, estado);

-- Pagos pendientes por estudiante
CREATE INDEX IF NOT EXISTS idx_pagos_estudiante_estado ON pagos(estudiante_id, estado);

-- Cursos activos por profesor
CREATE INDEX IF NOT EXISTS idx_cursos_profesor_estado ON cursos(profesor_id, estado);

-- 3. ANÁLISIS DE RENDIMIENTO

-- Ver qué índices existen actualmente
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Ver tamaño de las tablas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) as bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY bytes DESC;

-- 4. ESTADÍSTICAS PARA MEJOR PLANIFICACIÓN DE CONSULTAS

ANALYZE perfiles;
ANALYZE matriculas;
ANALYZE pagos;
ANALYZE cursos;
ANALYZE asistencias;

-- 5. VERIFICAR IMPACTO (ejecutar después de crear índices)

-- Ejemplo: Explicar una consulta común
EXPLAIN ANALYZE
SELECT p.*, m.id as matricula_id
FROM perfiles p
INNER JOIN matriculas m ON m.estudiante_id = p.id
WHERE p.rol = 'estudiante' AND m.estado = 'activo';

-- 6. MANTENIMIENTO PERIÓDICO (opcional - ejecutar mensualmente)

-- Reindexar para mantener rendimiento óptimo
-- NOTA: REINDEX también requiere ejecutarse fuera de transacción
-- Ejecutar estos comandos uno por uno en sesiones separadas si es necesario:
-- REINDEX TABLE perfiles;
-- REINDEX TABLE matriculas;
-- REINDEX TABLE pagos;
-- REINDEX TABLE cursos;

-- VACUUM no puede ejecutarse en bloque de transacción
-- PostgreSQL tiene autovacuum que maneja esto automáticamente
-- Si necesitas ejecutar VACUUM manualmente, hazlo fuera de este script
