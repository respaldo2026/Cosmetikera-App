-- ---------------------------------------------------------------------------
-- 💎 MIGRACIÓN MAESTRA ACADEMIA CRYSTAL - 2026
-- Consolida: Pagos, Programas, Pensum, Materiales, Portal Estudiante y Nómina
-- ---------------------------------------------------------------------------

-- 1. ESTRUCTURA ACADÉMICA (PROGRAMAS Y CURSOS)
-- Garantiza que exista la entidad superior 'programas'
CREATE TABLE IF NOT EXISTS programas (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    duracion TEXT,
    duracion_horas INTEGER,
    precio NUMERIC(10,2),
    precio_inscripcion NUMERIC(10,2),
    precio_mensualidad NUMERIC(10,2),
    contenido TEXT,
    requisitos TEXT,
    certificacion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vincula cursos (grupos) con programas
ALTER TABLE cursos 
ADD COLUMN IF NOT EXISTS programa_id INTEGER REFERENCES programas(id) ON DELETE SET NULL;

-- 2. FIX CRÍTICO DE PAGOS Y TESORERÍA
-- Agrega columnas faltantes para que funcionen las cuotas automáticas
ALTER TABLE pagos
ADD COLUMN IF NOT EXISTS numero_cuota INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS periodo_pagado TEXT,
ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- Índices para optimizar tesorería
CREATE INDEX IF NOT EXISTS idx_pagos_matricula ON pagos(matricula_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);

-- 3. GESTIÓN DE PENSUM Y MATERIAL DIDÁCTICO
CREATE TABLE IF NOT EXISTS pensum (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    programa_id INTEGER REFERENCES programas(id),
    numero_ciclo INTEGER,
    nombre_ciclo VARCHAR,
    descripcion TEXT,
    duracion_semanas INTEGER,
    total_horas INTEGER,
    orden INTEGER,
    activo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS pensum_cursos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pensum_id UUID REFERENCES pensum(id),
    nombre_curso VARCHAR,
    horas INTEGER,
    creditos INTEGER,
    tipo_curso VARCHAR -- obligatorio/electivo
);

CREATE TABLE IF NOT EXISTS material_didactico (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    programa_id INTEGER REFERENCES programas(id),
    pensum_id UUID REFERENCES pensum(id),
    titulo VARCHAR,
    tipo_material VARCHAR, -- documento/video/imagen
    url_archivo TEXT,
    visible BOOLEAN DEFAULT true,
    subido_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PORTAL DEL ESTUDIANTE (CALIFICACIONES Y ENTREGAS)
-- Tabla para registrar notas
CREATE TABLE IF NOT EXISTS calificaciones (
    id SERIAL PRIMARY KEY,
    matricula_id INTEGER REFERENCES matriculas(id),
    tema_id INTEGER, -- Referencia a temas_curso si existe
    calificacion NUMERIC(5,2),
    tipo_evaluacion VARCHAR, -- examen, quiz, taller
    fecha_evaluacion DATE DEFAULT CURRENT_DATE,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para entrega de uniformes/kits
CREATE TABLE IF NOT EXISTS entregas_materiales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estudiante_id UUID REFERENCES auth.users(id), -- o perfiles(id)
    tipo_material VARCHAR, -- camiseta, kit
    descripcion TEXT,
    talla VARCHAR,
    mes_ciclo VARCHAR,
    fecha_entrega DATE DEFAULT CURRENT_DATE,
    entregado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de notificaciones para el portal
CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    perfil_id UUID REFERENCES auth.users(id),
    tipo VARCHAR, -- asistencia, pago, academico
    mensaje TEXT,
    leido BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. NÓMINA DE PROFESORES
-- Asegurar estructura para registro de horas
CREATE TABLE IF NOT EXISTS sesiones_clase (
    id SERIAL PRIMARY KEY,
    curso_id INTEGER REFERENCES cursos(id),
    fecha DATE,
    hora_inicio TIME,
    hora_fin TIME,
    tema_tratado TEXT,
    observaciones TEXT,
    registrado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagos_nomina (
    id SERIAL PRIMARY KEY,
    profesor_id UUID REFERENCES auth.users(id),
    periodo_inicio DATE,
    periodo_fin DATE,
    horas_totales NUMERIC(10,2),
    valor_hora NUMERIC(10,2),
    total_pagar NUMERIC(10,2),
    estado VARCHAR DEFAULT 'pendiente', -- pendiente, pagado
    fecha_pago DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. LÓGICA AUTOMÁTICA (TRIGGERS Y FUNCIONES)

-- Función para generar cuotas automáticas (Fix Pagos)
CREATE OR REPLACE FUNCTION generar_cuotas_automaticas()
RETURNS TRIGGER AS $$
DECLARE
    v_programa_id INTEGER;
    v_precio_inscripcion NUMERIC;
    v_precio_mensualidad NUMERIC;
    v_duracion_meses INTEGER;
    v_fecha_inicio DATE;
    i INTEGER;
BEGIN
    -- Obtener datos del programa a través del curso
    SELECT c.programa_id, c.fecha_inicio 
    INTO v_programa_id, v_fecha_inicio
    FROM cursos c 
    WHERE c.id = NEW.curso_id;

    -- Si no hay programa asociado, usar valores por defecto o salir
    IF v_programa_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Obtener precios del programa
    SELECT precio_inscripcion, precio_mensualidad, 
           CAST(REGEXP_REPLACE(duracion, '[^0-9]', '', 'g') AS INTEGER) -- Extraer número de "3 meses"
    INTO v_precio_inscripcion, v_precio_mensualidad, v_duracion_meses
    FROM programas 
    WHERE id = v_programa_id;

    -- 1. Generar cobro de Inscripción (Cuota 0)
    INSERT INTO pagos (
        estudiante_id, matricula_id, monto, estado, 
        numero_cuota, periodo_pagado, fecha_vencimiento
    ) VALUES (
        NEW.estudiante_id, NEW.id, v_precio_inscripcion, 'pendiente',
        0, 'Inscripción', CURRENT_DATE
    );

    -- 2. Generar cuotas mensuales si el pago es en cuotas
    IF NEW.tipo_pago = 'cuotas' THEN
        FOR i IN 1..COALESCE(v_duracion_meses, 1) LOOP
            INSERT INTO pagos (
                estudiante_id, matricula_id, monto, estado, 
                numero_cuota, periodo_pagado, fecha_vencimiento
            ) VALUES (
                NEW.estudiante_id, NEW.id, v_precio_mensualidad, 'pendiente',
                i, 'Mes ' || i, (v_fecha_inicio + (i || ' month')::INTERVAL)::DATE
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

-- 7. SEGURIDAD (RLS) - Habilitar acceso básico

-- Habilitar RLS en tablas críticas
ALTER TABLE programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_didactico ENABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden ver programas
DROP POLICY IF EXISTS "Programas visibles para todos" ON programas;
CREATE POLICY "Programas visibles para todos" ON programas FOR SELECT USING (true);

-- Política: Estudiantes ven sus propias calificaciones
DROP POLICY IF EXISTS "Estudiantes ven sus calificaciones" ON calificaciones;
CREATE POLICY "Estudiantes ven sus calificaciones" ON calificaciones FOR SELECT 
USING (
    matricula_id IN (SELECT id FROM matriculas WHERE estudiante_id = auth.uid())
);

-- Política: Profesores gestionan calificaciones de sus cursos
DROP POLICY IF EXISTS "Profesores gestionan notas" ON calificaciones;
CREATE POLICY "Profesores gestionan notas" ON calificaciones FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM matriculas m
        JOIN cursos c ON m.curso_id = c.id
        WHERE m.id = calificaciones.matricula_id
        AND c.profesor_id = auth.uid()
    )
);

-- Verificación final
SELECT 'MIGRACIÓN COMPLETADA EXITOSAMENTE' as estado;