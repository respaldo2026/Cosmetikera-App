-- ================================================
-- FIX DEFINITIVO: Constraint pagos_metodo_pago_check
-- Permite NULL para pagos pendientes
-- ================================================

-- 1. Eliminar constraint antiguo
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_pago_check;

-- 2. Crear nuevo constraint que permite NULL
ALTER TABLE pagos 
ADD CONSTRAINT pagos_metodo_pago_check 
CHECK (
    metodo_pago IS NULL OR 
    LOWER(metodo_pago) IN ('efectivo', 'transferencia', 'tarjeta', 'otro')
);

-- 3. Actualizar cualquier valor inválido existente a NULL
UPDATE pagos 
SET metodo_pago = NULL 
WHERE metodo_pago IS NOT NULL 
  AND LOWER(metodo_pago) NOT IN ('efectivo', 'transferencia', 'tarjeta', 'otro');

-- 4. Verificar que el trigger genere pagos con metodo_pago NULL
-- (El trigger ya debe estar correcto, pero lo recreamos por seguridad)

CREATE OR REPLACE FUNCTION generar_cuotas_automaticas()
RETURNS TRIGGER AS $$
DECLARE
    v_programa_id INTEGER;
    v_precio_inscripcion NUMERIC;
    v_precio_curso NUMERIC;
    v_num_cuotas INTEGER;
    v_monto_cuota NUMERIC;
    i INTEGER;
BEGIN
    -- Obtener datos del curso y programa
    SELECT 
        c.programa_id,
        p.precio_inscripcion,
        p.precio_curso,
        p.numero_cuotas
    INTO 
        v_programa_id,
        v_precio_inscripcion,
        v_precio_curso,
        v_num_cuotas
    FROM cursos c
    JOIN programas p ON p.id = c.programa_id
    WHERE c.id = NEW.curso_id;

    -- Si no hay datos del programa, salir
    IF v_programa_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 1. Crear pago de inscripción (cuota 0) con metodo_pago NULL
    INSERT INTO pagos (
        matricula_id,
        numero_cuota,
        monto,
        estado,
        metodo_pago,  -- NULL para pagos pendientes
        fecha_vencimiento,
        observaciones
    ) VALUES (
        NEW.id,
        0,
        COALESCE(v_precio_inscripcion, 0),
        'pendiente',
        NULL,  -- NULL porque aún no se ha pagado
        NEW.fecha_inicio,
        'Pago de inscripción'
    );

    -- 2. Generar cuotas del curso
    IF v_num_cuotas > 0 AND v_precio_curso > 0 THEN
        v_monto_cuota := v_precio_curso / v_num_cuotas;
        
        FOR i IN 1..v_num_cuotas LOOP
            INSERT INTO pagos (
                matricula_id,
                numero_cuota,
                monto,
                estado,
                metodo_pago,  -- NULL para pagos pendientes
                fecha_vencimiento,
                observaciones
            ) VALUES (
                NEW.id,
                i,
                v_monto_cuota,
                'pendiente',
                NULL,  -- NULL porque aún no se ha pagado
                NEW.fecha_inicio + INTERVAL '1 month' * i,
                'Cuota ' || i || ' de ' || v_num_cuotas
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Recrear el trigger (por si acaso)
DROP TRIGGER IF EXISTS trigger_generar_cuotas ON matriculas;
CREATE TRIGGER trigger_generar_cuotas
    AFTER INSERT ON matriculas
    FOR EACH ROW
    EXECUTE FUNCTION generar_cuotas_automaticas();

-- ================================================
-- VERIFICACIÓN
-- ================================================
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'pagos' 
  AND con.conname = 'pagos_metodo_pago_check';

-- ================================================
-- FIN DEL FIX
-- ================================================
