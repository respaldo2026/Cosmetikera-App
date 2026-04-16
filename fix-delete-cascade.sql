-- ================================================
-- FIX: HABILITAR ELIMINACIÓN EN CASCADA
-- ================================================
-- Actualiza las FKs para permitir borrar estudiantes desde UI
-- ================================================

-- =============================================
-- 1. MATRICULAS → Eliminar en cascada cuando se borra estudiante
-- =============================================

-- Primero eliminar los constraints actuales
ALTER TABLE matriculas 
DROP CONSTRAINT IF EXISTS matriculas_estudiante_id_fkey;

ALTER TABLE matriculas 
DROP CONSTRAINT IF EXISTS fk_matriculas_perfiles_v2;

-- Crear nuevo constraint con ON DELETE CASCADE
ALTER TABLE matriculas
ADD CONSTRAINT matriculas_estudiante_id_fkey
FOREIGN KEY (estudiante_id) 
REFERENCES perfiles(id) 
ON DELETE CASCADE;

-- =============================================
-- 2. PAGOS → Eliminar en cascada cuando se borra matrícula
-- =============================================

ALTER TABLE pagos 
DROP CONSTRAINT IF EXISTS pagos_matricula_id_fkey;

ALTER TABLE pagos
ADD CONSTRAINT pagos_matricula_id_fkey
FOREIGN KEY (matricula_id) 
REFERENCES matriculas(id) 
ON DELETE CASCADE;

-- =============================================
-- 3. ASISTENCIAS → Eliminar en cascada cuando se borra matrícula
-- =============================================

ALTER TABLE asistencias 
DROP CONSTRAINT IF EXISTS asistencias_matricula_id_fkey;

ALTER TABLE asistencias
ADD CONSTRAINT asistencias_matricula_id_fkey
FOREIGN KEY (matricula_id) 
REFERENCES matriculas(id) 
ON DELETE CASCADE;

-- =============================================
-- 4. CALIFICACIONES → Eliminar en cascada cuando se borra matrícula
-- =============================================

ALTER TABLE calificaciones 
DROP CONSTRAINT IF EXISTS calificaciones_matricula_id_fkey;

ALTER TABLE calificaciones
ADD CONSTRAINT calificaciones_matricula_id_fkey
FOREIGN KEY (matricula_id) 
REFERENCES matriculas(id) 
ON DELETE CASCADE;

-- =============================================
-- 5. NOTIFICACIONES → Eliminar en cascada cuando se borra perfil
-- =============================================

ALTER TABLE notificaciones 
DROP CONSTRAINT IF EXISTS notificaciones_perfil_id_fkey;

ALTER TABLE notificaciones
ADD CONSTRAINT notificaciones_perfil_id_fkey
FOREIGN KEY (perfil_id) 
REFERENCES perfiles(id) 
ON DELETE CASCADE;

-- =============================================
-- VERIFICACIÓN
-- =============================================

-- Ver todas las constraints actualizadas
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (
    tc.table_name IN ('matriculas', 'pagos', 'asistencias', 'calificaciones', 'notificaciones')
    OR ccu.table_name = 'perfiles'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- =============================================
-- FIN DEL FIX
-- =============================================
-- ✅ Ahora puedes eliminar estudiantes desde la UI
-- ✅ Se borrarán automáticamente:
--    - Matrículas del estudiante
--    - Pagos de esas matrículas
--    - Asistencias de esas matrículas
--    - Calificaciones de esas matrículas
--    - Notificaciones del estudiante
-- =============================================
