-- ================================================
-- CORRECCIÓN DE FUNCIÓN verificar_riesgo_asistencia
-- ================================================
-- Este script corrige el trigger que causa el error en asistencias
-- Ejecuta este script ANTES de seed-data.sql
-- ================================================

-- Primero, eliminar todos los triggers relacionados
DROP TRIGGER IF EXISTS verificar_riesgo_asistencia_trigger ON asistencias;
DROP TRIGGER IF EXISTS on_asistencia_update ON asistencias;

-- Eliminar la función anterior con CASCADE para eliminar dependencias
DROP FUNCTION IF EXISTS verificar_riesgo_asistencia() CASCADE;

-- Recrear la función de estadísticas primero
CREATE OR REPLACE FUNCTION obtener_estadisticas_asistencia(p_estudiante_id UUID, p_curso_id BIGINT)
RETURNS TABLE (
    total_clases BIGINT,
    clases_asistidas BIGINT,
    clases_ausentes BIGINT,
    porcentaje_asistencia NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_clases,
        COUNT(*) FILTER (WHERE a.estado = 'presente') as clases_asistidas,
        COUNT(*) FILTER (WHERE a.estado = 'ausente') as clases_ausentes,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE a.estado = 'presente')::NUMERIC / COUNT(*)::NUMERIC * 100), 2)
            ELSE 
                0
        END as porcentaje_asistencia
    FROM asistencias a
    INNER JOIN matriculas m ON a.matricula_id = m.id
    WHERE m.estudiante_id = p_estudiante_id 
    AND m.curso_id = p_curso_id;
END;
$$ LANGUAGE plpgsql;

-- Recrear la función correctamente
-- La tabla asistencias tiene matricula_id, no estudiante_id y curso_id directamente
-- Necesitamos obtener esos datos desde la tabla matriculas

CREATE OR REPLACE FUNCTION verificar_riesgo_asistencia()
RETURNS TRIGGER AS $$
DECLARE
    v_total_clases BIGINT;
    v_clases_asistidas BIGINT;
    v_clases_ausentes BIGINT;
    v_porcentaje_asistencia NUMERIC;
    v_estudiante_id UUID;
    v_curso_id BIGINT;
BEGIN
    -- Obtener estudiante_id y curso_id desde la matrícula
    SELECT estudiante_id, curso_id 
    INTO v_estudiante_id, v_curso_id
    FROM matriculas 
    WHERE id = NEW.matricula_id;
    
    -- Si no se encuentra la matrícula, retornar
    IF v_estudiante_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Obtener estadísticas de asistencia
    SELECT * INTO v_total_clases, v_clases_asistidas, v_clases_ausentes, v_porcentaje_asistencia
    FROM obtener_estadisticas_asistencia(v_estudiante_id, v_curso_id);
    
    -- Verificar si el porcentaje de asistencia es bajo (menos del 75%)
    IF v_porcentaje_asistencia < 75 THEN
        -- Aquí puedes agregar lógica adicional, como enviar notificaciones
        -- Por ahora solo registramos en el log
        RAISE NOTICE 'Alerta: Estudiante % tiene % de asistencia en curso %', 
            v_estudiante_id, v_porcentaje_asistencia, v_curso_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
CREATE TRIGGER verificar_riesgo_asistencia_trigger
    AFTER INSERT OR UPDATE ON asistencias
    FOR EACH ROW
    EXECUTE FUNCTION verificar_riesgo_asistencia();

-- ================================================
-- FIN DE CORRECCIÓN
-- ================================================
