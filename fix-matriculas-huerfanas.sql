-- ================================================
-- FIX: LIMPIAR MATRÍCULAS HUÉRFANAS
-- ================================================
-- Elimina matrículas que apuntan a estudiantes o cursos inexistentes
-- ================================================

-- 1. Ver matrículas con estudiantes inexistentes
SELECT 
    m.id as matricula_id,
    m.estudiante_id,
    m.curso_id,
    m.created_at
FROM matriculas m
LEFT JOIN perfiles p ON m.estudiante_id = p.id
WHERE p.id IS NULL;

-- 2. Ver matrículas con cursos inexistentes
SELECT 
    m.id as matricula_id,
    m.estudiante_id,
    m.curso_id,
    m.created_at
FROM matriculas m
LEFT JOIN cursos c ON m.curso_id = c.id
WHERE c.id IS NULL;

-- 3. Eliminar matrículas huérfanas (estudiante no existe)
DELETE FROM matriculas
WHERE estudiante_id NOT IN (SELECT id FROM perfiles);

-- 4. Eliminar matrículas huérfanas (curso no existe)
DELETE FROM matriculas
WHERE curso_id NOT IN (SELECT id FROM cursos);

-- 5. Verificar que todas las matrículas ahora tengan referencias válidas
SELECT 
    COUNT(*) as total_matriculas_validas,
    COUNT(DISTINCT m.estudiante_id) as estudiantes_unicos,
    COUNT(DISTINCT m.curso_id) as cursos_unicos
FROM matriculas m
INNER JOIN perfiles p ON m.estudiante_id = p.id
INNER JOIN cursos c ON m.curso_id = c.id;

-- ================================================
-- FIN DEL FIX
-- ================================================
