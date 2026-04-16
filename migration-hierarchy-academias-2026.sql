-- ========================================================
-- MIGRATION: HIERARCHY - ACADEMIAS Y ROLES JERÁRQUICOS
-- Fecha: 14 Jan 2026
-- ========================================================
-- Este script crea la arquitectura de academias con jerarquía
-- de perfiles: Director > Administrador > Asesor > Profesor > Estudiante

-- PASO 1: CREAR TABLA ACADEMIAS
-- ========================================================
CREATE TABLE IF NOT EXISTS academias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    nit TEXT UNIQUE,
    direccion TEXT,
    telefono TEXT,
    email TEXT,
    ciudad TEXT,
    pais TEXT DEFAULT 'Colombia',
    moneda TEXT DEFAULT 'COP',
    website TEXT,
    instagram TEXT,
    facebook TEXT,
    director_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
    estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PASO 2: AGREGAR COLUMNAS A PERFILES
-- ========================================================
-- Agregar academia_id a perfiles para vincular usuario a academia
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS academia_id UUID REFERENCES academias(id) ON DELETE CASCADE;

-- Agregar nivel jerárquico (director, administrador, asesor, profesor, estudiante)
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS nivel_jerarquico TEXT 
    DEFAULT 'estudiante' 
    CHECK (nivel_jerarquico IN ('director', 'administrador', 'asesor', 'profesor', 'estudiante'));

-- Agregar referencia a supervisor (el director o admin que lo creó)
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS creado_por_id UUID REFERENCES perfiles(id) ON DELETE SET NULL;

-- Agregar permisos específicos (JSON para más flexibilidad)
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '{}'::jsonb;

-- PASO 3: CREAR INDICES
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_perfiles_academia ON perfiles(academia_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_nivel ON perfiles(nivel_jerarquico);
CREATE INDEX IF NOT EXISTS idx_perfiles_creado_por ON perfiles(creado_por_id);
CREATE INDEX IF NOT EXISTS idx_academias_director ON academias(director_id);
CREATE INDEX IF NOT EXISTS idx_academias_estado ON academias(estado);

-- PASO 4: TRIGGER PARA ACTUALIZAR updated_at EN ACADEMIAS
-- ========================================================
DROP TRIGGER IF EXISTS update_academias_updated_at ON academias;
CREATE TRIGGER update_academias_updated_at
    BEFORE UPDATE ON academias
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- PASO 5: RLS PARA ACADEMIAS
-- ========================================================
ALTER TABLE academias ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'academias' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON academias FOR ALL USING (true);
    END IF;
END $$;

-- PASO 6: DEFINIR PERMISOS POR DEFECTO
-- ========================================================
-- Función para asignar permisos por nivel
CREATE OR REPLACE FUNCTION obtener_permisos_por_nivel(p_nivel TEXT)
RETURNS JSONB AS $$
DECLARE
    v_permisos JSONB;
BEGIN
    CASE p_nivel
        WHEN 'director' THEN
            v_permisos := jsonb_build_object(
                'dashboard', true,
                'config_academia', true,
                'crear_perfiles', true,
                'gestionar_cursos', true,
                'registrar_pagos', true,
                'ver_reportes', true,
                'crear_matriculas', true,
                'gestionar_leads', true,
                'ver_nomina', true,
                'eliminar_usuarios', true
            );
        WHEN 'administrador' THEN
            v_permisos := jsonb_build_object(
                'dashboard', true,
                'config_academia', false,
                'crear_perfiles', false,
                'gestionar_cursos', true,
                'registrar_pagos', true,
                'ver_reportes', true,
                'crear_matriculas', true,
                'gestionar_leads', true,
                'ver_nomina', true,
                'eliminar_usuarios', false
            );
        WHEN 'asesor' THEN
            v_permisos := jsonb_build_object(
                'dashboard', false,
                'config_academia', false,
                'crear_perfiles', false,
                'gestionar_cursos', false,
                'registrar_pagos', true,
                'ver_reportes', false,
                'crear_matriculas', true,
                'gestionar_leads', true,
                'ver_nomina', false,
                'eliminar_usuarios', false
            );
        WHEN 'profesor' THEN
            v_permisos := jsonb_build_object(
                'dashboard', false,
                'config_academia', false,
                'crear_perfiles', false,
                'gestionar_cursos', false,
                'registrar_pagos', false,
                'ver_reportes', false,
                'crear_matriculas', false,
                'gestionar_leads', false,
                'ver_nomina', true,
                'eliminar_usuarios', false,
                'ver_mis_cursos', true,
                'cargar_asistencias', true
            );
        ELSE -- estudiante
            v_permisos := jsonb_build_object(
                'dashboard', false,
                'config_academia', false,
                'crear_perfiles', false,
                'gestionar_cursos', false,
                'registrar_pagos', false,
                'ver_reportes', false,
                'crear_matriculas', false,
                'gestionar_leads', false,
                'ver_nomina', false,
                'eliminar_usuarios', false,
                'ver_mis_cursos', true,
                'ver_pagos', true
            );
    END CASE;
    
    RETURN v_permisos;
END;
$$ LANGUAGE plpgsql;

-- PASO 7: FUNCIÓN PARA ACTUALIZAR EL TRIGGER DE PERFILES
-- ========================================================
-- Reemplazar el trigger anterior para capturar academia_id y rol
DROP TRIGGER IF EXISTS trigger_handle_new_user ON auth.users CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_academia_id UUID;
    v_rol TEXT;
    v_nombre_completo TEXT;
    v_identificacion TEXT;
    v_nivel_jerarquico TEXT;
    v_permisos JSONB;
BEGIN
    -- Obtener ID de la academia por defecto (Crystal Diamante)
    SELECT id INTO v_academia_id FROM academias WHERE nombre = 'Academia Crystal Diamante' LIMIT 1;
    
    -- Si no existe, usar NULL (se puede configurar luego)
    IF v_academia_id IS NULL THEN
        RAISE WARNING 'No se encontró Academia Crystal Diamante, asignando NULL';
    END IF;
    
    -- Extraer datos de raw_user_meta_data
    v_nombre_completo := COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email);
    v_identificacion := COALESCE(NEW.raw_user_meta_data->>'identificacion', NEW.email);
    v_rol := COALESCE(NEW.raw_user_meta_data->>'rol', 'estudiante');
    
    -- Mapear rol antiguo a nivel jerárquico nuevo
    CASE v_rol
        WHEN 'administrativo' THEN v_nivel_jerarquico := 'administrador';
        ELSE v_nivel_jerarquico := v_rol; -- profesor, estudiante, asesor, director
    END CASE;
    
    -- Obtener permisos por defecto para el nivel
    v_permisos := obtener_permisos_por_nivel(v_nivel_jerarquico);
    
    -- Crear perfil (asignar automáticamente a Crystal Diamante)
    INSERT INTO public.perfiles (
        id,
        nombre_completo,
        email,
        identificacion,
        rol,
        nivel_jerarquico,
        academia_id,
        permisos
    ) VALUES (
        NEW.id,
        v_nombre_completo,
        NEW.email,
        v_identificacion,
        v_rol,
        v_nivel_jerarquico,
        v_academia_id,
        v_permisos
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
CREATE TRIGGER trigger_handle_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- PASO 8: CREAR ACADEMIA POR DEFECTO (Academia Crystal Diamante)
-- ========================================================
-- Esta academia será la única por ahora
-- Más adelante podremos soportar multi-academia

DO $$
DECLARE
    v_academy_id UUID;
BEGIN
    -- Verificar si ya existe la academia
    SELECT id INTO v_academy_id FROM academias WHERE nombre = 'Academia Crystal Diamante' LIMIT 1;
    
    IF v_academy_id IS NULL THEN
        INSERT INTO academias (nombre, nit, ciudad, email, pais, moneda)
        VALUES (
            'Academia Crystal Diamante',
            '123456789',
            'Medellín',
            'info@academiacrystal.com',
            'Colombia',
            'COP'
        );
        RAISE NOTICE 'Academia Crystal Diamante creada exitosamente';
    ELSE
        RAISE NOTICE 'Academia Crystal Diamante ya existe con ID: %', v_academy_id;
    END IF;
END $$;

-- ========================================================
-- VERIFICACIÓN Y REPORTE
-- ========================================================
-- Para verificar que todo está correcto:
/*
SELECT 
    'ESTRUCTURA JERÁRQUICA CREADA EXITOSAMENTE' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'academias') as academias_table_exists,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'perfiles' AND column_name = 'academia_id') as academia_id_column_exists,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'perfiles' AND column_name = 'nivel_jerarquico') as nivel_jerarquico_column_exists;
*/
