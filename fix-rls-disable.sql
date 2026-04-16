-- ================================================
-- FIX: PROBLEMAS CON RLS
-- ================================================
-- Deshabilita RLS en todas las tablas para desarrollo
-- En producción, configura políticas más restrictivas
-- ================================================

-- Deshabilitar RLS en todas las tablas
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

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON perfiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON profesores_info;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON configuracion;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON cursos;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON matriculas;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON pagos;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON temas_curso;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON sesiones_clase;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON asistencias;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON inventario;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON pagos_nomina;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON pagos_profesores;

-- ================================================
-- RESULTADO
-- ================================================
-- ✅ RLS deshabilitado en todas las tablas
-- ✅ Los SELECTs, INSERTs, UPDATEs y DELETEs ahora funcionarán
-- ⚠️ EN PRODUCCIÓN: habilita RLS y configura políticas restrictivas
-- ================================================

SELECT 'RLS deshabilitado correctamente' AS resultado;
