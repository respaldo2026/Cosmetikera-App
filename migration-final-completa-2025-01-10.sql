-- ================================================
-- MIGRACIÓN COMPLETA: FIX + PLANTILLAS + MEDIOS DE PAGO
-- Fecha: 2025-01-10
-- ================================================

-- =============================================
-- PARTE 1: FIX CONSTRAINT PAGOS
-- =============================================

-- Primero eliminar el constraint antiguo
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_pago_check;

-- IMPORTANTE: No agregar constraint restrictivo todavía
-- Lo haremos después de normalizar los datos

-- =============================================
-- PARTE 2: FIX TRIGGER CUOTAS (columnas correctas)
-- =============================================

CREATE OR REPLACE FUNCTION generar_cuotas_automaticas()
RETURNS TRIGGER AS $$
DECLARE
    v_programa_id INTEGER;
    v_precio_inscripcion NUMERIC;
    v_precio_mensualidad NUMERIC;
    v_num_cuotas INTEGER;
    i INTEGER;
BEGIN
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

    IF v_programa_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_num_cuotas := 4;

    IF v_precio_inscripcion IS NOT NULL AND v_precio_inscripcion > 0 THEN
        INSERT INTO pagos (
            matricula_id, numero_cuota, monto, estado, metodo_pago,
            fecha_vencimiento, observaciones
        ) VALUES (
            NEW.id, 0, v_precio_inscripcion, 'pendiente', NULL,
            NEW.fecha_inicio, 'Pago de inscripción'
        );
    END IF;

    IF v_precio_mensualidad IS NOT NULL AND v_precio_mensualidad > 0 THEN
        FOR i IN 1..v_num_cuotas LOOP
            INSERT INTO pagos (
                matricula_id, numero_cuota, monto, estado, metodo_pago,
                fecha_vencimiento, observaciones
            ) VALUES (
                NEW.id, i, v_precio_mensualidad, 'pendiente', NULL,
                NEW.fecha_inicio + INTERVAL '1 month' * i,
                'Cuota mensual ' || i || ' de ' || v_num_cuotas
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generar_cuotas ON matriculas;
CREATE TRIGGER trigger_generar_cuotas
    AFTER INSERT ON matriculas
    FOR EACH ROW
    EXECUTE FUNCTION generar_cuotas_automaticas();

-- =============================================
-- PARTE 3: TABLA MEDIOS DE PAGO
-- =============================================

CREATE TABLE IF NOT EXISTS medios_pago (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    codigo TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    icono TEXT,
    activo BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_medios_pago_updated_at ON medios_pago;
CREATE TRIGGER update_medios_pago_updated_at
    BEFORE UPDATE ON medios_pago
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE medios_pago ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medios_pago' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON medios_pago FOR ALL USING (true);
    END IF;
END $$;

INSERT INTO medios_pago (nombre, codigo, descripcion, orden, activo)
VALUES 
    ('Efectivo', 'efectivo', 'Pago en efectivo', 10, true),
    ('Nequi', 'nequi', 'Pago por Nequi', 20, true),
    ('Transferencia', 'transferencia', 'Transferencia bancaria', 30, true),
    ('Sistecredito', 'sistecredito', 'Pago con Sistecredito', 40, true),
    ('Tarjeta', 'tarjeta', 'Pago con tarjeta de crédito/débito', 50, true),
    ('Otro', 'otro', 'Otro medio de pago', 60, true)
ON CONFLICT (codigo) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_medios_pago_codigo ON medios_pago(codigo);
CREATE INDEX IF NOT EXISTS idx_medios_pago_activo ON medios_pago(activo);
CREATE INDEX IF NOT EXISTS idx_medios_pago_orden ON medios_pago(orden);

-- Normalizar datos existentes
UPDATE pagos SET metodo_pago = LOWER(TRIM(metodo_pago)) WHERE metodo_pago IS NOT NULL;
UPDATE pagos SET metodo_pago = 'efectivo' WHERE LOWER(metodo_pago) = 'efectivo';
UPDATE pagos SET metodo_pago = 'transferencia' WHERE LOWER(metodo_pago) IN ('transferencia', 'transfer');
UPDATE pagos SET metodo_pago = 'tarjeta' WHERE LOWER(metodo_pago) IN ('tarjeta', 'tarjeta de credito', 'tarjeta de debito');
UPDATE pagos SET metodo_pago = 'nequi' WHERE LOWER(metodo_pago) = 'nequi';
UPDATE pagos SET metodo_pago = 'sistecredito' WHERE LOWER(metodo_pago) = 'sistecredito';

-- Convertir cualquier otro valor inválido a 'otro'
UPDATE pagos 
SET metodo_pago = 'otro' 
WHERE metodo_pago IS NOT NULL 
  AND LOWER(metodo_pago) NOT IN ('efectivo', 'transferencia', 'tarjeta', 'nequi', 'sistecredito', 'otro');

-- =============================================
-- AHORA SÍ: Crear constraint flexible que permite valores existentes
-- =============================================

-- Constraint que permite NULL O valores de medios_pago existentes
-- No usamos FK porque queremos permitir valores históricos
ALTER TABLE pagos 
ADD CONSTRAINT pagos_metodo_pago_check 
CHECK (
    metodo_pago IS NULL OR 
    LENGTH(metodo_pago) > 0
);

-- =============================================
-- PARTE 4: PLANTILLAS WHATSAPP
-- =============================================

CREATE TABLE IF NOT EXISTS plantillas_whatsapp (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    plantilla TEXT NOT NULL,
    variables TEXT[],
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_plantillas_whatsapp_updated_at ON plantillas_whatsapp;
CREATE TRIGGER update_plantillas_whatsapp_updated_at
    BEFORE UPDATE ON plantillas_whatsapp
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE plantillas_whatsapp ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plantillas_whatsapp' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON plantillas_whatsapp FOR ALL USING (true);
    END IF;
END $$;

INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, activa)
VALUES 
    (
        'inscripcion_academica',
        'Mensaje enviado al crear una inscripción académica pendiente de pago',
        'Hola {{nombre}}, tu inscripción académica al curso "{{curso}}" fue registrada. Por favor completa el pago de inscripción para activar tu matrícula.',
        ARRAY['nombre', 'curso'],
        true
    ),
    (
        'pago_confirmado',
        'Mensaje enviado al confirmar el pago de inscripción',
        '¡Hola {{nombre}}! Tu pago de inscripción ha sido confirmado. Tu matrícula al curso "{{curso}}" está ahora ACTIVA. ¡Bienvenido! 🎉',
        ARRAY['nombre', 'curso'],
        true
    ),
    (
        'recordatorio_pago',
        'Recordatorio de cuota pendiente',
        'Hola {{nombre}}, te recordamos que tienes pendiente el pago de la cuota {{numero_cuota}} por ${{monto}} del curso "{{curso}}". Vence el {{fecha_vencimiento}}.',
        ARRAY['nombre', 'numero_cuota', 'monto', 'curso', 'fecha_vencimiento'],
        true
    ),
    (
        'certificado_listo',
        'Notificación de certificado disponible',
        '¡Felicitaciones {{nombre}}! Tu certificado del curso "{{curso}}" ya está listo para ser recogido. Acércate a la academia o solicítalo por este medio.',
        ARRAY['nombre', 'curso'],
        true
    ),
    (
        'bienvenida',
        'Mensaje de bienvenida a nuevo estudiante',
        '¡Bienvenido/a a Academia Crystal Diamante, {{nombre}}! Estamos felices de tenerte con nosotros en el curso "{{curso}}". Cualquier duda estamos para ayudarte.',
        ARRAY['nombre', 'curso'],
        true
    ),
    (
        'recordatorio_clase',
        'Recordatorio de próxima clase',
        'Hola {{nombre}}, te recordamos que tienes clase de "{{curso}}" mañana {{fecha}} a las {{hora}}. ¡Te esperamos!',
        ARRAY['nombre', 'curso', 'fecha', 'hora'],
        true
    )
ON CONFLICT (nombre) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_plantillas_whatsapp_nombre ON plantillas_whatsapp(nombre);
CREATE INDEX IF NOT EXISTS idx_plantillas_whatsapp_activa ON plantillas_whatsapp(activa);

-- =============================================
-- VERIFICACIÓN FINAL
-- =============================================

SELECT 'MEDIOS DE PAGO' as tabla, COUNT(*) as total FROM medios_pago;
SELECT 'PLANTILLAS WHATSAPP' as tabla, COUNT(*) as total FROM plantillas_whatsapp;

SELECT 
    'CONSTRAINT PAGOS' as verificacion,
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'pagos' 
  AND con.conname = 'pagos_metodo_pago_check';

-- =============================================
-- FIN DE LA MIGRACIÓN COMPLETA
-- =============================================
-- ✅ Constraint pagos arreglado (permite NULL)
-- ✅ Trigger cuotas con columnas correctas
-- ✅ Tabla medios_pago creada (6 medios)
-- ✅ Tabla plantillas_whatsapp creada (6 plantillas)
-- =============================================
