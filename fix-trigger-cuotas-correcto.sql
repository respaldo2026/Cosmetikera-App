-- ================================================
-- FIX TRIGGER: generar_cuotas_automaticas
-- Corregir nombres de columnas según estructura real
-- ================================================

CREATE OR REPLACE FUNCTION generar_cuotas_automaticas()
RETURNS TRIGGER AS $$
DECLARE
    v_programa_id INTEGER;
    v_precio_inscripcion NUMERIC;
    v_precio_mensualidad NUMERIC;
    v_num_cuotas INTEGER;
    i INTEGER;
BEGIN
    -- Obtener datos del curso y programa
    SELECT 
        c.programa_id,
        p.precio_inscripcion,
        p.precio_mensualidad
    INTO 
        v_programa_id,
        v_precio_inscripcion,
        v_precio_mensualidad
    FROM cursos c
    JOIN programas p ON p.id = c.programa_id
    WHERE c.id = NEW.curso_id;

    -- Si no hay datos del programa, salir
    IF v_programa_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calcular número de cuotas mensuales
    -- Si el curso dura 4 meses, genera 4 cuotas
    -- Puedes ajustar esta lógica según necesites
    v_num_cuotas := 4; -- Por defecto 4 cuotas, ajusta según necesites

    -- 1. Crear pago de inscripción (cuota 0) con metodo_pago NULL
    IF v_precio_inscripcion IS NOT NULL AND v_precio_inscripcion > 0 THEN
        INSERT INTO pagos (
            matricula_id,
            numero_cuota,
            monto,
            estado,
            metodo_pago,
            fecha_vencimiento,
            observaciones
        ) VALUES (
            NEW.id,
            0,
            v_precio_inscripcion,
            'pendiente',
            NULL,
            NEW.fecha_inicio,
            'Pago de inscripción'
        );
    END IF;

    -- 2. Generar cuotas mensuales si hay precio de mensualidad
    IF v_precio_mensualidad IS NOT NULL AND v_precio_mensualidad > 0 THEN
        FOR i IN 1..v_num_cuotas LOOP
            INSERT INTO pagos (
                matricula_id,
                numero_cuota,
                monto,
                estado,
                metodo_pago,
                fecha_vencimiento,
                observaciones
            ) VALUES (
                NEW.id,
                i,
                v_precio_mensualidad,
                'pendiente',
                NULL,
                NEW.fecha_inicio + INTERVAL '1 month' * i,
                'Cuota mensual ' || i || ' de ' || v_num_cuotas
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
DROP TRIGGER IF EXISTS trigger_generar_cuotas ON matriculas;
CREATE TRIGGER trigger_generar_cuotas
    AFTER INSERT ON matriculas
    FOR EACH ROW
    EXECUTE FUNCTION generar_cuotas_automaticas();

-- ================================================
-- VERIFICACIÓN
-- ================================================
SELECT 
    'TRIGGER ACTUALIZADO' as status,
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'trigger_generar_cuotas';

-- ================================================
-- NOTAS:
-- - Usa precio_inscripcion (no precio_curso)
-- - Usa precio_mensualidad para las cuotas
-- - Genera 4 cuotas por defecto (ajustable)
-- - Todos los pagos se crean con metodo_pago = NULL
-- ================================================
