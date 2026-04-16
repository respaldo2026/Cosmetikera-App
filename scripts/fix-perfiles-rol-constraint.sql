-- Script para actualizar el constraint de rol en la tabla perfiles
-- Ejecutar esto en el SQL Editor de Supabase: https://app.supabase.com/project/[project-id]/sql/new

-- Primero, eliminar el constraint antiguo
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;

-- Crear el nuevo constraint que acepte todos los roles
ALTER TABLE perfiles 
ADD CONSTRAINT perfiles_rol_check CHECK (rol IN ('estudiante', 'profesor', 'admin', 'director', 'administrativo'));
