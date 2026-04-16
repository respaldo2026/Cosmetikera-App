-- ================================================
-- MIGRACIÓN COMBINADA
-- 1. Fix constraint pagos_metodo_pago_check
-- 2. Crear tabla plantillas_whatsapp
-- Fecha: 2025-01-10
-- ================================================

-- =============================================
-- PARTE 1: FIX CONSTRAINT PAGOS
-- =============================================

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

-- 4. Recrear trigger para generar cuotas con metodo_pago NULL
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
        metodo_pago,
        fecha_vencimiento,
        observaciones
    ) VALUES (
        NEW.id,
        0,
        COALESCE(v_precio_inscripcion, 0),
        'pendiente',
        NULL,
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
                metodo_pago,
                fecha_vencimiento,
                observaciones
            ) VALUES (
                NEW.id,
                i,
                v_monto_cuota,
                'pendiente',
                NULL,
                NEW.fecha_inicio + INTERVAL '1 month' * i,
                'Cuota ' || i || ' de ' || v_num_cuotas
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Recrear el trigger
DROP TRIGGER IF EXISTS trigger_generar_cuotas ON matriculas;
CREATE TRIGGER trigger_generar_cuotas
    AFTER INSERT ON matriculas
    FOR EACH ROW
    EXECUTE FUNCTION generar_cuotas_automaticas();

-- =============================================
-- PARTE 2: PLANTILLAS WHATSAPP
-- =============================================

-- 1. CREAR TABLA plantillas_whatsapp
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

-- 2. TRIGGER PARA ACTUALIZAR updated_at
DROP TRIGGER IF EXISTS update_plantillas_whatsapp_updated_at ON plantillas_whatsapp;
CREATE TRIGGER update_plantillas_whatsapp_updated_at
    BEFORE UPDATE ON plantillas_whatsapp
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. HABILITAR RLS
ALTER TABLE plantillas_whatsapp ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICA RLS PERMISIVA
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plantillas_whatsapp' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON plantillas_whatsapp FOR ALL USING (true);
    END IF;
END $$;

-- 5. INSERTAR PLANTILLAS POR DEFECTO
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

-- 6. CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_plantillas_whatsapp_nombre ON plantillas_whatsapp(nombre);
CREATE INDEX IF NOT EXISTS idx_plantillas_whatsapp_activa ON plantillas_whatsapp(activa);

-- =============================================
-- VERIFICACIÓN FINAL
-- =============================================

-- Verificar constraint de pagos
SELECT 
    'PAGOS CONSTRAINT' as verificacion,
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'pagos' 
  AND con.conname = 'pagos_metodo_pago_check';

-- Verificar plantillas creadas
SELECT 
    'PLANTILLAS WHATSAPP' as verificacion,
    COUNT(*) as total_plantillas,
    COUNT(*) FILTER (WHERE activa = true) as plantillas_activas
FROM plantillas_whatsapp;

-- =============================================
-- FIN DE LA MIGRACIÓN COMBINADA
-- =============================================
-- ✅ Constraint pagos arreglado (permite NULL)
-- ✅ Trigger actualizado
-- ✅ Tabla plantillas_whatsapp creada
-- ✅ 6 plantillas por defecto insertadas
-- =============================================
