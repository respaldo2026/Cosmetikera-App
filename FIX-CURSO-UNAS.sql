-- ===================================================
-- FIX: Completar información del curso de uñas
-- ===================================================

-- 1️⃣ Actualizar el PROGRAMA con precios
UPDATE programas 
SET 
    precio_inscripcion = 100000,  -- ⬅️ AJUSTA EL PRECIO REAL
    precio_mensualidad = 150000,  -- ⬅️ AJUSTA EL PRECIO REAL
    duracion = '5 meses',
    duracion_horas = 60,
    total_clases = 20
WHERE nombre = 'Artista Integral en Uñas';

-- 2️⃣ Actualizar el CURSO/GRUPO con horario, cupos y fechas
-- NOTA: Los precios se toman del PROGRAMA, no del grupo
UPDATE cursos 
SET 
    horario = 'Miércoles 4:00 PM - 7:00 PM',  -- ⬅️ AJUSTA EL HORARIO REAL
    precio_inscripcion = NULL,                -- Los precios vienen del programa padre
    precio_mensualidad = NULL,                -- Los precios vienen del programa padre
    descripcion = '✨ Grupo inicial del programa Artista Integral en Uñas. Aprende técnicas profesionales desde cero. Incluye kit de productos mensual, camiseta y certificación.',
    cupos = 15,
    estado = 'activo',
    fecha_inicio = '2026-02-18',
    fecha_fin = '2026-07-18'
WHERE nombre = 'Artista Integral en Uñas - Mié 4:00 PM';

-- ===================================================
-- VERIFICACIÓN: Comprobar que los datos quedaron bien
-- ===================================================

-- Ver el curso completo
SELECT 
    c.id,
    c.nombre,
    prog.nombre as programa_nombre,
    c.horario,
    c.cupos,
    c.precio_inscripcion,
    c.precio_mensualidad,
    c.estado,
    c.fecha_inicio,
    c.fecha_fin,
    c.descripcion
FROM cursos c
LEFT JOIN programas prog ON c.programa_id = prog.id
WHERE c.nombre ILIKE '%uña%';

-- Ver cómo lo ve el agente (vista optimizada)
SELECT 
    nombre,
    programa_nombre,
    horario,
    cupos_disponibles,
    precio_inscripcion,
    precio_mensualidad,
    fecha_inicio,
    resumen_texto_ia
FROM vw_cursos_para_ia
WHERE nombre ILIKE '%uña%';

-- ===================================================
-- SUCCESS MESSAGE
-- ===================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Curso de uñas actualizado correctamente';
    RAISE NOTICE '📝 Verifica que los precios y horarios sean correctos';
    RAISE NOTICE '🔄 El agente ahora verá la información completa';
END $$;
