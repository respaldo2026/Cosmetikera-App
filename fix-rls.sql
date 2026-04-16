-- ================================================
-- FIX RLS - PERMITIR ACCESO ANÓNIMO
-- ================================================
-- Ejecuta esto en Supabase SQL Editor para solucionar los 404
-- ================================================

-- OPCIÓN 1: DESHABILITAR RLS TEMPORALMENTE (MÁS RÁPIDO PARA DESARROLLO)
ALTER TABLE perfiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE profesores_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion DISABLE ROW LEVEL SECURITY;
ALTER TABLE cursos DISABLE ROW LEVEL SECURITY;
ALTER TABLE matriculas DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos DISABLE ROW LEVEL SECURITY;
ALTER TABLE temas_curso DISABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_clase DISABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventario DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_nomina DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_profesores DISABLE ROW LEVEL SECURITY;

-- Si existen otras tablas, también deshabilitarlas:
ALTER TABLE IF EXISTS calificaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clases DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS movimientos_inventario DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notificaciones DISABLE ROW LEVEL SECURITY;

-- ================================================
-- VERIFICACIÓN: Consulta para confirmar RLS deshabilitado
-- ================================================
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Deberías ver rls_enabled = false en todas las tablas
-- ================================================
