-- Tabla para almacenar permisos por rol
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rol VARCHAR(50) NOT NULL UNIQUE,
  permisos JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índice para búsquedas rápidas por rol
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_rol ON role_permissions(rol);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_role_permissions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_role_permissions_timestamp
BEFORE UPDATE ON role_permissions
FOR EACH ROW
EXECUTE FUNCTION update_role_permissions_timestamp();

-- Inicialización de permisos por defecto
-- Admin: acceso a todo
INSERT INTO role_permissions (rol, permisos) VALUES (
  'admin',
  '{
    "cursos": true,
    "estudiantes": true,
    "matriculas": true,
    "asistencias": true,
    "profesores": true,
    "tesoreria": true,
    "caja": true,
    "nomina": true,
    "perfiles": true,
    "leads": true,
    "inventario": true,
    "planificador": true,
    "portal-estudiante": true
  }'::jsonb
) ON CONFLICT (rol) DO UPDATE SET permisos = EXCLUDED.permisos;

-- Director: acceso a casi todo menos nómina
INSERT INTO role_permissions (rol, permisos) VALUES (
  'director',
  '{
    "cursos": true,
    "estudiantes": true,
    "matriculas": true,
    "asistencias": true,
    "profesores": true,
    "tesoreria": true,
    "caja": true,
    "nomina": false,
    "perfiles": true,
    "leads": true,
    "inventario": true,
    "planificador": true,
    "portal-estudiante": false
  }'::jsonb
) ON CONFLICT (rol) DO UPDATE SET permisos = EXCLUDED.permisos;

-- Administrativo: gestión académica y financiera
INSERT INTO role_permissions (rol, permisos) VALUES (
  'administrativo',
  '{
    "cursos": true,
    "estudiantes": true,
    "matriculas": true,
    "asistencias": true,
    "profesores": false,
    "tesoreria": true,
    "caja": true,
    "nomina": false,
    "perfiles": false,
    "leads": true,
    "inventario": true,
    "planificador": false,
    "portal-estudiante": false
  }'::jsonb
) ON CONFLICT (rol) DO UPDATE SET permisos = EXCLUDED.permisos;

-- Profesor: solo su información y estudiantes
INSERT INTO role_permissions (rol, permisos) VALUES (
  'profesor',
  '{
    "cursos": true,
    "estudiantes": true,
    "matriculas": true,
    "asistencias": true,
    "profesores": false,
    "tesoreria": false,
    "caja": false,
    "nomina": true,
    "perfiles": false,
    "leads": false,
    "inventario": false,
    "planificador": true,
    "portal-estudiante": false
  }'::jsonb
) ON CONFLICT (rol) DO UPDATE SET permisos = EXCLUDED.permisos;

-- Estudiante: solo portal
INSERT INTO role_permissions (rol, permisos) VALUES (
  'estudiante',
  '{
    "cursos": false,
    "estudiantes": false,
    "matriculas": false,
    "asistencias": false,
    "profesores": false,
    "tesoreria": false,
    "caja": false,
    "nomina": false,
    "perfiles": false,
    "leads": false,
    "inventario": false,
    "planificador": false,
    "portal-estudiante": true
  }'::jsonb
) ON CONFLICT (rol) DO UPDATE SET permisos = EXCLUDED.permisos;

-- Política RLS para role_permissions: solo admin puede ver/editar
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Si es admin o director, permitir lectura
CREATE POLICY "admin_director_read_role_permissions"
  ON role_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE perfiles.id = auth.uid() 
      AND perfiles.rol IN ('admin', 'director')
    )
  );

-- Solo admin puede actualizar
CREATE POLICY "admin_update_role_permissions"
  ON role_permissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE perfiles.id = auth.uid() 
      AND perfiles.rol = 'admin'
    )
  );

-- Solo admin puede insertar
CREATE POLICY "admin_insert_role_permissions"
  ON role_permissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE perfiles.id = auth.uid() 
      AND perfiles.rol = 'admin'
    )
  );
