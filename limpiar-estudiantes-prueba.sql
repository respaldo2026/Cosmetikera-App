-- ================================================
-- SCRIPT: LIMPIEZA DE ESTUDIANTES DE PRUEBA
-- ================================================
-- Este script elimina estudiantes y todos sus datos relacionados
-- de forma segura respetando las relaciones de la base de datos
-- ================================================

-- =============================================
-- PASO 1: VER ESTUDIANTES DE PRUEBA
-- =============================================
-- Primero identifica los estudiantes que quieres eliminar
-- Descomenta esta query para ver la lista:

-- SELECT 
--     p.id,
--     p.nombre_completo,
--     p.identificacion,
--     p.email,
--     p.created_at,
--     COUNT(DISTINCT m.id) as num_matriculas,
--     COUNT(DISTINCT pg.id) as num_pagos
-- FROM perfiles p
-- LEFT JOIN matriculas m ON m.estudiante_id = p.id
-- LEFT JOIN pagos pg ON pg.matricula_id = m.id
-- WHERE p.rol = 'estudiante'
-- GROUP BY p.id, p.nombre_completo, p.identificacion, p.email, p.created_at
-- ORDER BY p.created_at DESC;

-- =============================================
-- PASO 2: ELIMINAR ESTUDIANTE ESPECÍFICO POR ID
-- =============================================
-- Reemplaza el número con el ID del estudiante que quieres eliminar

DO $$
DECLARE
    v_estudiante_id UUID := 'REEMPLAZA-CON-EL-ID-DEL-ESTUDIANTE'; -- Cambia esto
    v_matriculas_ids INTEGER[];
BEGIN
    -- Obtener todos los IDs de matrículas del estudiante
    SELECT ARRAY_AGG(id) INTO v_matriculas_ids
    FROM matriculas
    WHERE estudiante_id = v_estudiante_id;
    
    -- 1. Eliminar pagos de las matrículas
    IF v_matriculas_ids IS NOT NULL THEN
        DELETE FROM pagos
        WHERE matricula_id = ANY(v_matriculas_ids);
        
        RAISE NOTICE 'Pagos eliminados';
    END IF;
    
    -- 2. Eliminar asistencias si existen
    DELETE FROM asistencias
    WHERE matricula_id = ANY(v_matriculas_ids);
    
    RAISE NOTICE 'Asistencias eliminadas';
    
    -- 3. Eliminar calificaciones si existen
    DELETE FROM calificaciones
    WHERE matricula_id = ANY(v_matriculas_ids);
    
    RAISE NOTICE 'Calificaciones eliminadas';
    
    -- 4. Eliminar matrículas
    DELETE FROM matriculas
    WHERE estudiante_id = v_estudiante_id;
    
    RAISE NOTICE 'Matrículas eliminadas';
    
    -- 5. Eliminar notificaciones del estudiante si existen
    DELETE FROM notificaciones
    WHERE perfil_id = v_estudiante_id;
    
    RAISE NOTICE 'Notificaciones eliminadas';
    
    -- 6. Finalmente eliminar el perfil del estudiante
    DELETE FROM perfiles
    WHERE id = v_estudiante_id;
    
    RAISE NOTICE 'Perfil de estudiante eliminado correctamente';
END $$;

-- =============================================
-- PASO 3: ELIMINAR MÚLTIPLES ESTUDIANTES POR CRITERIO
-- =============================================
-- Elimina estudiantes creados hoy (estudiantes de prueba recientes)
-- DESCOMENTA SOLO CUANDO ESTÉS SEGURO

-- DO $$
-- DECLARE
--     estudiante RECORD;
-- BEGIN
--     FOR estudiante IN 
--         SELECT id, nombre_completo 
--         FROM perfiles 
--         WHERE rol = 'estudiante' 
--           AND created_at >= CURRENT_DATE  -- Creados hoy
--           -- AND nombre_completo ILIKE '%prueba%'  -- O por nombre
--     LOOP
--         -- Eliminar pagos
--         DELETE FROM pagos
--         WHERE matricula_id IN (
--             SELECT id FROM matriculas WHERE estudiante_id = estudiante.id
--         );
--         
--         -- Eliminar asistencias
--         DELETE FROM asistencias
--         WHERE matricula_id IN (
--             SELECT id FROM matriculas WHERE estudiante_id = estudiante.id
--         );
--         
--         -- Eliminar calificaciones
--         DELETE FROM calificaciones
--         WHERE matricula_id IN (
--             SELECT id FROM matriculas WHERE estudiante_id = estudiante.id
--         );
--         
--         -- Eliminar matrículas
--         DELETE FROM matriculas WHERE estudiante_id = estudiante.id;
--         
--         -- Eliminar notificaciones
--         DELETE FROM notificaciones WHERE perfil_id = estudiante.id;
--         
--         -- Eliminar perfil
--         DELETE FROM perfiles WHERE id = estudiante.id;
--         
--         RAISE NOTICE 'Eliminado: %', estudiante.nombre_completo;
--     END LOOP;
-- END $$;

-- =============================================
-- PASO 4: ELIMINAR TODOS LOS DATOS DE PRUEBA DE HOY
-- =============================================
-- CUIDADO: Esto elimina TODO lo creado hoy
-- DESCOMENTA SOLO SI ESTÁS 100% SEGURO

-- -- Eliminar pagos de matrículas creadas hoy
-- DELETE FROM pagos
-- WHERE matricula_id IN (
--     SELECT id FROM matriculas WHERE created_at >= CURRENT_DATE
-- );

-- -- Eliminar asistencias de matrículas creadas hoy
-- DELETE FROM asistencias
-- WHERE matricula_id IN (
--     SELECT id FROM matriculas WHERE created_at >= CURRENT_DATE
-- );

-- -- Eliminar calificaciones de matrículas creadas hoy
-- DELETE FROM calificaciones
-- WHERE matricula_id IN (
--     SELECT id FROM matriculas WHERE created_at >= CURRENT_DATE
-- );

-- -- Eliminar matrículas creadas hoy
-- DELETE FROM matriculas WHERE created_at >= CURRENT_DATE;

-- -- Eliminar estudiantes creados hoy
-- DELETE FROM perfiles 
-- WHERE rol = 'estudiante' 
--   AND created_at >= CURRENT_DATE;

-- =============================================
-- VERIFICACIÓN POST-ELIMINACIÓN
-- =============================================
-- Ver cuántos estudiantes quedan
SELECT 
    'TOTAL ESTUDIANTES' as info,
    COUNT(*) as cantidad
FROM perfiles 
WHERE rol = 'estudiante';

-- Ver estudiantes creados hoy
SELECT 
    'ESTUDIANTES CREADOS HOY' as info,
    COUNT(*) as cantidad
FROM perfiles 
WHERE rol = 'estudiante' 
  AND created_at >= CURRENT_DATE;

-- ================================================
-- INSTRUCCIONES DE USO:
-- ================================================
-- OPCIÓN 1 - Eliminar un estudiante específico:
--   1. Ejecuta el SELECT del PASO 1 para ver los IDs
--   2. Copia el ID del estudiante
--   3. Pégalo en la variable v_estudiante_id del PASO 2
--   4. Ejecuta solo el PASO 2
--
-- OPCIÓN 2 - Eliminar varios por criterio:
--   1. Descomenta el código del PASO 3
--   2. Ajusta el criterio (fecha, nombre, etc.)
--   3. Ejecuta solo el PASO 3
--
-- OPCIÓN 3 - Borrar todo de hoy:
--   1. ¡CUIDADO! Esto borra TODO
--   2. Descomenta el PASO 4
--   3. Ejecuta solo el PASO 4
-- ================================================
