-- ===================================================
-- DIAGNÓSTICO: Verificar datos del curso de uñas
-- ===================================================

-- 1️⃣ Ver todos los cursos (grupos) activos
SELECT 
    c.id,
    c.nombre,
    c.programa_id,
    prog.nombre as programa_nombre,
    c.horario,
    c.cupos,
    c.precio,
    c.precio_inscripcion,
    c.precio_mensualidad,
    c.estado,
    c.fecha_inicio,
    c.fecha_fin,
    p.nombre_completo as profesor_nombre
FROM cursos c
LEFT JOIN programas prog ON c.programa_id = prog.id
LEFT JOIN perfiles p ON c.profesor_id = p.id
WHERE c.nombre ILIKE '%uña%'
   OR c.nombre ILIKE '%nail%'
ORDER BY c.created_at DESC;

-- 2️⃣ Ver QUÉ ve el agente (desde la vista que usa el agente)
SELECT 
    *
FROM vw_cursos_para_ia
WHERE nombre ILIKE '%uña%'
   OR nombre ILIKE '%nail%';

-- 3️⃣ Ver TODOS los cursos activos que el agente puede ver
SELECT 
    id,
    nombre,
    programa_nombre,
    horario,
    fecha_inicio,
    cupos_disponibles,
    estado
FROM vw_cursos_para_ia
ORDER BY fecha_inicio DESC NULLS LAST;

-- 4️⃣ Ver todos los programas activos
SELECT 
    id,
    nombre,
    descripcion,
    precio_inscripcion,
    precio_mensualidad,
    duracion,
    activo
FROM programas
WHERE activo = true
ORDER BY nombre;

-- ===================================================
-- POSIBLES PROBLEMAS Y SOLUCIONES
-- ===================================================

-- ❌ PROBLEMA 1: El curso no tiene estado "activo" o "proximo"
-- Solución: Actualizar el estado del curso
-- UPDATE cursos SET estado = 'activo' WHERE nombre ILIKE '%uña%';

-- ❌ PROBLEMA 2: El curso no está vinculado a un programa
-- Solución: Asignar un programa al curso
-- UPDATE cursos SET programa_id = [ID_DEL_PROGRAMA] WHERE nombre ILIKE '%uña%';

-- ❌ PROBLEMA 3: El curso no tiene horario, precio o fecha de inicio
-- Solución: Completar la información
-- UPDATE cursos 
-- SET horario = 'Lunes y Miércoles 4:00 PM - 6:00 PM',
--     precio_inscripcion = 100000,
--     precio_mensualidad = 150000,
--     fecha_inicio = '2026-02-20'
-- WHERE nombre ILIKE '%uña%';

-- ===================================================
-- CONSULTA MAESTRA: Ver TODO el contexto del agente
-- ===================================================
SELECT 
    '📚 PROGRAMAS' as seccion,
    nombre as titulo,
    descripcion,
    NULL as horario,
    NULL::numeric as precio_inscripcion,
    NULL::numeric as precio_mensualidad,
    NULL as fecha_inicio
FROM programas
WHERE activo = true

UNION ALL

SELECT 
    '📖 GRUPOS/CURSOS' as seccion,
    nombre as titulo,
    descripcion,
    horario,
    precio_inscripcion,
    precio_mensualidad,
    fecha_inicio::text
FROM cursos
WHERE estado IN ('activo', 'proximo')
ORDER BY seccion, titulo;
