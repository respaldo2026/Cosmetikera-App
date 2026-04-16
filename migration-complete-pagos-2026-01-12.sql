-- ================================================
-- MIGRACIÓN COMPLETA: Arreglar pagos no visibles
-- Fecha: 2026-01-12
-- Versión: 1.0
-- ================================================
-- PROBLEMA:
-- Los pagos registrados por estudiantes NO aparecen en Tesorería, 
-- Dashboard ni perfil del estudiante porque la tabla pagos estaba incompleta
--
-- SOLUCIÓN:
-- 1. Agregar columnas faltantes a tabla pagos
-- 2. Crear tabla programas (faltaba)
-- 3. Agregar referencias a programas en tabla cursos
-- 4. Crear función y trigger generar_cuotas_automaticas()
-- 5. Crear índices para optimizar búsquedas
-- ================================================

-- ================================================
-- PASO 1: Crear tabla PROGRAMAS (si no existe)
-- ================================================
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

COMMENT ON TABLE programas IS 'Programas académicos generales (ej: Micropigmentación, Manicure, etc)';

-- ================================================
-- PASO 2: Agregar referencia a programas en tabla cursos
-- ================================================
ALTER TABLE cursos
ADD COLUMN IF NOT EXISTS programa_id INTEGER REFERENCES programas(id) ON DELETE CASCADE;

-- ================================================
-- PASO 3: Agregar columnas faltantes a tabla PAGOS
-- ================================================
ALTER TABLE pagos
ADD COLUMN IF NOT EXISTS numero_cuota INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS periodo_pagado TEXT,
ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- ================================================
-- PASO 4: Crear índices para optimizar búsquedas
-- ================================================

-- Índices en tabla programas
CREATE INDEX IF NOT EXISTS idx_programas_activo ON programas(activo);

-- Índices adicionales en tabla cursos
CREATE INDEX IF NOT EXISTS idx_cursos_programa_id ON cursos(programa_id);

-- Índices en tabla pagos (para el trigger)
CREATE INDEX IF NOT EXISTS idx_pagos_numero_cuota ON pagos(numero_cuota);
CREATE INDEX IF NOT EXISTS idx_pagos_matricula_numero ON pagos(matricula_id, numero_cuota);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_vencimiento ON pagos(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_pagos_estado_matricula ON pagos(estado, matricula_id);

-- ================================================
-- PASO 5: Habilitar RLS en tabla programas (si no está habilitado)
-- ================================================
ALTER TABLE programas ENABLE ROW LEVEL SECURITY;

-- Crear política permisiva para programas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'programas' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON programas FOR ALL USING (true);
    END IF;
END $$;

-- ================================================
-- PASO 5.5: Eliminar trigger primero (si existe)
-- ================================================
DROP TRIGGER IF EXISTS trigger_generar_cuotas ON matriculas;

-- ================================================
-- PASO 6: Crear FUNCIÓN generar_cuotas_automaticas()
-- ================================================
DROP FUNCTION IF EXISTS generar_cuotas_automaticas() CASCADE;

CREATE FUNCTION generar_cuotas_automaticas()
RETURNS TRIGGER AS $$
DECLARE
    duracion_meses INTEGER;
    precio_programa NUMERIC(10,2);
    precio_inscripcion NUMERIC(10,2);
    precio_cuota NUMERIC(10,2);
    fecha_base DATE;
    fecha_vencimiento_cuota DATE;
    i INTEGER;
BEGIN
    -- Obtener duración del programa (en meses), precio y valor de inscripción
    SELECT 
        COALESCE(CAST(NULLIF(REGEXP_REPLACE(p.duracion, '[^0-9]', '', 'g'), '') AS INTEGER), 1),
        COALESCE(p.precio, 0),
        COALESCE(p.precio_inscripcion, 50000)
    INTO duracion_meses, precio_programa, precio_inscripcion
    FROM cursos c
    LEFT JOIN programas p ON c.programa_id = p.id
    WHERE c.id = NEW.curso_id;

    -- Si no hay duración definida, usar 1 mes por defecto
    IF duracion_meses IS NULL OR duracion_meses = 0 THEN
        duracion_meses := 1;
    END IF;

    -- Calcular precio por cuota (SIN incluir inscripción)
    IF precio_programa > 0 AND duracion_meses > 0 THEN
        precio_cuota := precio_programa / duracion_meses;
    ELSE
        precio_cuota := 0;
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

-- ================================================
-- PASO 7: Crear TRIGGER para ejecutar la función
-- ================================================
CREATE TRIGGER trigger_generar_cuotas
    AFTER INSERT ON matriculas
    FOR EACH ROW
    EXECUTE FUNCTION generar_cuotas_automaticas();

-- ================================================
-- PASO 8: Verificación (ejecutar después de correr el script)
-- ================================================
-- Descomenta las siguientes líneas para verificar:

/*
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'programas'
) as tabla_programas_existe;

SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagos' AND column_name = 'numero_cuota'
) as columna_numero_cuota_existe;

SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generar_cuotas_automaticas'
) as funcion_existe;

SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generar_cuotas'
) as trigger_existe;
*/

-- ================================================
-- FIN DE LA MIGRACIÓN
-- ================================================
-- Todas las columnas y funciones están creadas.
-- Ahora puedes crear matrículas y los pagos se generarán automáticamente.
-- ================================================
