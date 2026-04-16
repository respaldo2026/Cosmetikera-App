-- ================================================
-- MIGRACIÓN: STUDENT PORTAL
-- Fecha: 2025-12-26
-- Descripción: Agrega tabla de calificaciones y campos necesarios para portal de estudiante
-- ================================================

-- 1. CREAR TABLA CALIFICACIONES
CREATE TABLE IF NOT EXISTS calificaciones (
    id SERIAL PRIMARY KEY,
    matricula_id INTEGER REFERENCES matriculas(id) ON DELETE CASCADE NOT NULL,
    tema_id INTEGER REFERENCES temas_curso(id) ON DELETE SET NULL,
    calificacion NUMERIC(5,2) CHECK (calificacion >= 0 AND calificacion <= 100),
    tipo_evaluacion TEXT CHECK (tipo_evaluacion IN ('taller', 'quiz', 'examen', 'participacion', 'otro')),
    fecha_evaluacion DATE NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(matricula_id, tema_id, tipo_evaluacion, fecha_evaluacion)
);

-- Ajuste idempotente: asegurar columnas mínimas si la tabla ya existía sin ellas
ALTER TABLE calificaciones
    ADD COLUMN IF NOT EXISTS calificacion NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS tipo_evaluacion TEXT,
    ADD COLUMN IF NOT EXISTS fecha_evaluacion DATE,
    ADD COLUMN IF NOT EXISTS observaciones TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ajuste idempotente: asegura que tema_id exista y tenga el tipo correcto según la PK de temas_curso
DO $$
BEGIN
    -- Detectar tipo de la PK de temas_curso
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'temas_curso'
          AND column_name = 'id'
          AND data_type = 'uuid'
    ) THEN
        -- Si temas_curso.id es UUID, aseguramos que calificaciones.tema_id sea UUID
        ALTER TABLE calificaciones
            ADD COLUMN IF NOT EXISTS tema_id UUID;
        ALTER TABLE calificaciones
            DROP CONSTRAINT IF EXISTS calificaciones_tema_id_fkey;
        ALTER TABLE calificaciones
            ALTER COLUMN tema_id TYPE UUID USING tema_id::uuid;
        ALTER TABLE calificaciones
            ADD CONSTRAINT calificaciones_tema_id_fkey
            FOREIGN KEY (tema_id) REFERENCES temas_curso(id) ON DELETE SET NULL;
    ELSE
        -- Si temas_curso.id es INTEGER (serial), mantenemos INTEGER
        ALTER TABLE calificaciones
            ADD COLUMN IF NOT EXISTS tema_id INTEGER;
        ALTER TABLE calificaciones
            DROP CONSTRAINT IF EXISTS calificaciones_tema_id_fkey;
        ALTER TABLE calificaciones
            ADD CONSTRAINT calificaciones_tema_id_fkey
            FOREIGN KEY (tema_id) REFERENCES temas_curso(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. AGREGAR COLUMNAS A PERFILES PARA NOTIFICACIONES
ALTER TABLE perfiles 
    ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS fecha_baja TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS motivo_baja TEXT,
    ADD COLUMN IF NOT EXISTS foto_url TEXT,
    ADD COLUMN IF NOT EXISTS notif_whatsapp BOOLEAN DEFAULT true;

-- 3. CREAR TABLA DE NOTIFICACIONES (OPTIONAL - para historial)
CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    perfil_id UUID,
    tipo TEXT CHECK (tipo IN ('asistencia', 'calificacion', 'aviso', 'certificado')),
    mensaje TEXT NOT NULL,
    enviado BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_envio TIMESTAMP WITH TIME ZONE,
    UNIQUE(perfil_id, tipo, fecha_creacion)
);

-- Ajuste idempotente: si notificaciones existe sin perfil_id o sin FK, añadirlos
ALTER TABLE notificaciones
    ADD COLUMN IF NOT EXISTS perfil_id UUID;
ALTER TABLE notificaciones
    DROP CONSTRAINT IF EXISTS notificaciones_perfil_id_fkey;
ALTER TABLE notificaciones
    ADD CONSTRAINT notificaciones_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE;

-- Ajuste idempotente: asegurar columnas básicas en notificaciones
ALTER TABLE notificaciones
    ADD COLUMN IF NOT EXISTS tipo TEXT,
    ADD COLUMN IF NOT EXISTS mensaje TEXT,
    ADD COLUMN IF NOT EXISTS enviado BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS fecha_envio TIMESTAMPTZ;

-- 4. CREAR INDICES PARA RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_calificaciones_matricula ON calificaciones(matricula_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_tema ON calificaciones(tema_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_fecha ON calificaciones(fecha_evaluacion);
CREATE INDEX IF NOT EXISTS idx_notificaciones_perfil ON notificaciones(perfil_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_enviado ON notificaciones(enviado);

-- 5. TRIGGER PARA ACTUALIZAR updated_at EN CALIFICACIONES
DROP TRIGGER IF EXISTS update_calificaciones_updated_at ON calificaciones;
CREATE TRIGGER update_calificaciones_updated_at
    BEFORE UPDATE ON calificaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. HABILITAR RLS EN NUEVAS TABLAS
ALTER TABLE calificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS RLS PERMISIVAS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calificaciones' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON calificaciones FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notificaciones' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON notificaciones FOR ALL USING (true);
    END IF;
END $$;

-- ================================================
-- DATOS DE EJEMPLO (OPCIONAL - comentar si ya existen datos)
-- ================================================

-- Insertar algunas calificaciones de ejemplo (si la tabla está vacía)
-- INSERT INTO calificaciones (matricula_id, tema_id, calificacion, tipo_evaluacion, fecha_evaluacion, observaciones)
-- VALUES 
--     (1, 1, 85.5, 'examen', '2025-12-20', 'Buen desempeño'),
--     (1, 2, 92.0, 'quiz', '2025-12-22', 'Excelente'),
--     (2, 1, 78.0, 'examen', '2025-12-20', 'Necesita mejorar');

-- ================================================
-- FIN DE LA MIGRACIÓN
-- ================================================
-- Ejecuta este script en Supabase SQL Editor
-- Luego reinicia la app para que se reconozcan los cambios
-- ================================================
