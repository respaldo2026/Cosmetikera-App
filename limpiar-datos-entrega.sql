-- Script para limpiar datos de prueba antes de entrega
-- Elimina: profesores, estudiantes, matrículas, pagos y leads
-- Mantiene: programas, cursos, configuraciones, admins

BEGIN;

-- 1. Eliminar movimientos financieros relacionados con pagos
DELETE FROM movimientos_financieros 
WHERE pago_id IS NOT NULL;

-- 2. Eliminar todos los pagos
DELETE FROM pagos;

-- 3. Eliminar todas las matrículas
DELETE FROM matriculas;

-- 4. Eliminar calificaciones de estudiantes
DELETE FROM calificaciones;

-- 5. Eliminar asistencias de estudiantes
DELETE FROM asistencias;

-- 6. Eliminar todos los leads
DELETE FROM leads;

-- 7. Eliminar sesiones de clase de profesores que serán eliminados
DELETE FROM sesiones_clase
WHERE profesor_id IN (SELECT id FROM perfiles WHERE rol IN ('estudiante', 'profesor'));

-- 8. Eliminar perfiles de estudiantes y profesores directamente
DELETE FROM perfiles 
WHERE rol IN ('estudiante', 'profesor');

-- 9. Eliminar usuarios de auth.users (requiere permisos de service_role)
-- NOTA: Esta línea podría fallar si no tienes permisos de service_role
-- En ese caso, elimina manualmente desde Supabase Dashboard → Authentication
-- DELETE FROM auth.users WHERE id IN (
--   SELECT id FROM perfiles WHERE rol IN ('estudiante', 'profesor')
-- );

-- Verificar resultados
SELECT 'Pagos restantes:' as tabla, COUNT(*) as cantidad FROM pagos
UNION ALL
SELECT 'Matrículas restantes:', COUNT(*) FROM matriculas
UNION ALL
SELECT 'Perfiles estudiante/profesor:', COUNT(*) FROM perfiles WHERE rol IN ('estudiante', 'profesor')
UNION ALL
SELECT 'Leads restantes:', COUNT(*) FROM leads
UNION ALL
SELECT 'Programas (mantener):', COUNT(*) FROM programas
UNION ALL
SELECT 'Cursos (mantener):', COUNT(*) FROM cursos;

COMMIT;

-- Mensaje final
SELECT '✓ Limpieza completada. Datos de estudiantes, profesores, matrículas, pagos y leads eliminados.' as resultado;
