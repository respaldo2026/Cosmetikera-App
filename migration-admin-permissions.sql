-- ========================================
-- CREAR TABLA DE PERMISOS DE ADMINISTRADORES
-- ========================================

-- Crear tabla para permisos granulares de administradores
CREATE TABLE IF NOT EXISTS admin_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
    modulo TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(admin_id, modulo)
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_admin_permissions_admin_id ON admin_permissions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_modulo ON admin_permissions(modulo);

-- Comentarios
COMMENT ON TABLE admin_permissions IS 'Permisos granulares para cada administrador';
COMMENT ON COLUMN admin_permissions.admin_id IS 'ID del administrador (referencia a perfiles)';
COMMENT ON COLUMN admin_permissions.modulo IS 'Módulo al que tiene acceso (cursos, estudiantes, etc.)';

-- Deshabilitar RLS para desarrollo
ALTER TABLE admin_permissions DISABLE ROW LEVEL SECURITY;

-- O si prefieres RLS, crear políticas:
/*
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden ver permisos"
ON admin_permissions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM perfiles
        WHERE perfiles.id = auth.uid()
        AND perfiles.rol = 'admin'
    )
);

CREATE POLICY "Admins pueden modificar permisos"
ON admin_permissions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM perfiles
        WHERE perfiles.id = auth.uid()
        AND perfiles.rol = 'admin'
    )
);
*/

-- Verificar tabla creada
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'admin_permissions'
ORDER BY ordinal_position;

-- Datos de ejemplo (opcional)
-- Puedes descomentar esto para dar permisos completos al primer admin
/*
INSERT INTO admin_permissions (admin_id, modulo)
SELECT 
    p.id,
    m.modulo
FROM perfiles p
CROSS JOIN (
    VALUES 
        ('cursos'),
        ('estudiantes'),
        ('matriculas'),
        ('asistencias'),
        ('profesores'),
        ('tesoreria'),
        ('nomina'),
        ('perfiles'),
        ('leads')
) AS m(modulo)
WHERE p.rol = 'admin'
LIMIT 1;
*/
