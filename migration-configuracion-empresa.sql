-- ========================================
-- CREAR TABLA CONFIGURACIÓN EMPRESA
-- ========================================

-- Crear tabla para guardar configuración de la empresa
CREATE TABLE IF NOT EXISTS configuracion_empresa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    nit TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    ciudad TEXT,
    pais TEXT,
    sitio_web TEXT,
    descripcion TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentario de tabla
COMMENT ON TABLE configuracion_empresa IS 'Configuración general de la empresa/academia';

-- Deshabilitar RLS para que los administradores puedan acceder
ALTER TABLE configuracion_empresa DISABLE ROW LEVEL SECURITY;

-- O si prefieres usar RLS, crear política permisiva:
/*
ALTER TABLE configuracion_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden leer configuración empresa"
ON configuracion_empresa FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo admins pueden editar configuración empresa"
ON configuracion_empresa FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM perfiles
        WHERE perfiles.id = auth.uid()
        AND perfiles.rol = 'admin'
    )
);
*/

-- Insertar datos iniciales (puedes modificar estos valores)
INSERT INTO configuracion_empresa (
    nombre,
    nit,
    telefono,
    email,
    direccion,
    ciudad,
    pais,
    descripcion
) VALUES (
    'Academia Crystal',
    '',
    '',
    'contacto@academiacrystal.com',
    '',
    'Bogotá',
    'Colombia',
    'Academia de excelencia educativa'
)
ON CONFLICT (id) DO NOTHING;

-- Verificar
SELECT * FROM configuracion_empresa;
