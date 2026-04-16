-- Script para crear tabla role_permissions en Supabase
-- Ejecutar esto en el SQL Editor de Supabase: https://app.supabase.com/project/[project-id]/sql/new

CREATE TABLE IF NOT EXISTS role_permissions (
    rol VARCHAR(50) PRIMARY KEY,
    permisos JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Permisos por defecto para cada rol
INSERT INTO role_permissions (rol, permisos) VALUES
('admin', '{
    "cursos": true,
    "estudiantes": true,
    "matriculas": true,
    "asistencias": true,
    "profesores": true,
    "tesoreria": true,
    "nomina": true,
    "perfiles": true,
    "leads": true,
    "inventario": true,
    "planificador": true,
    "portal-estudiante": true
}'::JSONB),
('director', '{
    "cursos": true,
    "estudiantes": true,
    "matriculas": true,
    "asistencias": true,
    "profesores": true,
    "tesoreria": true,
    "nomina": true,
    "perfiles": true,
    "leads": true,
    "inventario": true,
    "planificador": true
}'::JSONB),
('administrativo', '{
    "cursos": true,
    "estudiantes": true,
    "matriculas": true,
    "asistencias": true,
    "profesores": true,
    "tesoreria": true,
    "nomina": true,
    "leads": true
}'::JSONB),
('profesor', '{
    "asistencias": true,
    "portal-estudiante": true
}'::JSONB),
('estudiante', '{
    "portal-estudiante": true
}'::JSONB)
ON CONFLICT (rol) DO NOTHING;
