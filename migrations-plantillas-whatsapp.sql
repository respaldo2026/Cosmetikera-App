-- ================================================
-- MIGRACIÓN: PLANTILLAS WHATSAPP
-- Fecha: 2025-01-10
-- Descripción: Crear tabla para plantillas de mensajes WhatsApp
-- ================================================

-- 1. CREAR TABLA plantillas_whatsapp
CREATE TABLE IF NOT EXISTS plantillas_whatsapp (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    plantilla TEXT NOT NULL,
    variables TEXT[], -- Array de variables disponibles ej: ['nombre', 'curso', 'fecha']
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

-- ================================================
-- FIN DE LA MIGRACIÓN
-- ================================================
-- Ejecuta este script en Supabase SQL Editor
-- ================================================
