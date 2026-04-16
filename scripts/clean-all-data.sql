-- Script para limpiar toda la data de prueba
-- Ejecutar en: https://app.supabase.com → SQL Editor

-- Limpiar en orden (respetando foreign keys)
TRUNCATE TABLE asistencias CASCADE;
TRUNCATE TABLE temas_curso CASCADE;
TRUNCATE TABLE sesiones_clase CASCADE;
TRUNCATE TABLE pagos_nomina CASCADE;
TRUNCATE TABLE matriculas CASCADE;
TRUNCATE TABLE cursos CASCADE;
TRUNCATE TABLE pagos CASCADE;
TRUNCATE TABLE perfiles CASCADE;

-- Verificar que todo está vacío
SELECT 'asistencias' as tabla, COUNT(*) as registros FROM asistencias
UNION ALL
SELECT 'temas_curso', COUNT(*) FROM temas_curso
UNION ALL
SELECT 'sesiones_clase', COUNT(*) FROM sesiones_clase
UNION ALL
SELECT 'pagos_nomina', COUNT(*) FROM pagos_nomina
UNION ALL
SELECT 'matriculas', COUNT(*) FROM matriculas
UNION ALL
SELECT 'cursos', COUNT(*) FROM cursos
UNION ALL
SELECT 'pagos', COUNT(*) FROM pagos
UNION ALL
SELECT 'perfiles', COUNT(*) FROM perfiles;
