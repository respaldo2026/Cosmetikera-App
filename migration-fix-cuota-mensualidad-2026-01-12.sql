-- ================================================
-- MIGRATION: Corregir función generar_cuotas_automaticas
-- Fecha: 2026-01-12
-- Propósito: Usar precio_mensualidad de programas directamente en lugar de calcular
-- ================================================

-- Recrear la función con la lógica correcta
DROP TRIGGER IF EXISTS trigger_generar_cuotas ON matriculas;
DROP FUNCTION IF EXISTS generar_cuotas_automaticas() CASCADE;

CREATE OR REPLACE FUNCTION generar_cuotas_automaticas()
RETURNS TRIGGER AS $$
DECLARE
    duracion_meses INTEGER;
    precio_inscripcion NUMERIC(10,2);
    precio_cuota NUMERIC(10,2);
    fecha_base DATE;
    fecha_vencimiento_cuota DATE;
    i INTEGER;
BEGIN
    -- Obtener duración del programa (en meses), valor de inscripción y valor de mensualidad
    SELECT 
        COALESCE(CAST(NULLIF(REGEXP_REPLACE(p.duracion, '[^0-9]', '', 'g'), '') AS INTEGER), 1),
        COALESCE(p.precio_inscripcion, 50000),
        COALESCE(p.precio_mensualidad, 0)
    INTO duracion_meses, precio_inscripcion, precio_cuota
    FROM cursos c
    LEFT JOIN programas p ON c.programa_id = p.id
    WHERE c.id = NEW.curso_id;

    -- Si no hay duración definida, usar 1 mes por defecto
    IF duracion_meses IS NULL OR duracion_meses = 0 THEN
        duracion_meses := 1;
    END IF;

    -- Usar fecha de inicio del curso como base, o fecha actual
    SELECT COALESCE(fecha_inicio, CURRENT_DATE)
    INTO fecha_base
    FROM cursos
    WHERE id = NEW.curso_id;

    -- 1. INSERTAR INSCRIPCIÓN (PENDIENTE - debe pagarse para completar matrícula financiera)
    INSERT INTO pagos (
        estudiante_id,
        matricula_id,
        monto,
        periodo_pagado,
        numero_cuota,
        fecha_vencimiento,
        fecha_pago,
        estado,
        metodo_pago,
        observaciones
    ) VALUES (
        NEW.estudiante_id,
        NEW.id,
        precio_inscripcion,
        'Inscripción',
        0,
        fecha_base,
        NULL,
        'pendiente',
        NULL,
        'Matrícula académica registrada. Pendiente pago de inscripción para completar matrícula financiera.'
    );

    -- 2. GENERAR CUOTAS MENSUALES (una por cada mes de duración)
    FOR i IN 1..duracion_meses LOOP
        fecha_vencimiento_cuota := DATE_TRUNC('month', fecha_base + INTERVAL '1 month' * (i - 1)) + INTERVAL '4 days';

        INSERT INTO pagos (
            estudiante_id,
            matricula_id,
            monto,
            periodo_pagado,
            numero_cuota,
            fecha_vencimiento,
            estado,
            metodo_pago,
            observaciones
        ) VALUES (
            NEW.estudiante_id,
            NEW.id,
            precio_cuota,
            'Mes ' || i,
            i,
            fecha_vencimiento_cuota,
            'pendiente',
            NULL,
            'Cuota mensual generada automáticamente'
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para ejecutar la función al insertar matrícula
CREATE TRIGGER trigger_generar_cuotas
    AFTER INSERT ON matriculas
    FOR EACH ROW
    EXECUTE FUNCTION generar_cuotas_automaticas();

-- ================================================
-- FIN DE LA MIGRATION
-- ================================================
