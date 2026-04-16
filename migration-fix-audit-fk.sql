-- =====================================================
-- FIX: RELACIÓN AUDIT LOGS -> PERFILES
-- Permite que el frontend muestre el nombre del usuario
-- en lugar de solo el ID
-- =====================================================

-- 1. Intentar eliminar la restricción anterior (si existe con nombre por defecto)
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_changed_by_fkey;

-- 2. Crear nueva restricción apuntando a la tabla pública 'perfiles'
ALTER TABLE audit_logs 
  ADD CONSTRAINT audit_logs_changed_by_fkey 
  FOREIGN KEY (changed_by) 
  REFERENCES public.perfiles(id);