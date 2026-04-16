-- ================================================
-- REESTRUCTURACIÓN: PROGRAMAS (nivel superior) y GRUPOS (nivel secundario)
-- ================================================
-- Los PROGRAMAS son los cursos académicos generales
-- Los GRUPOS son las cohortes específicas con horarios dentro de cada programa
-- Los estudiantes se matriculan en GRUPOS, no directamente en PROGRAMAS
-- ================================================

-- 1. CREAR TABLA PROGRAMAS (Nivel Superior - Cursos Académicos)
CREATE TABLE IF NOT EXISTS programas (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    duracion TEXT,
    duracion_horas INTEGER,
    precio NUMERIC(10,2),
    precio_inscripcion NUMERIC(10,2),
    precio_mensualidad NUMERIC(10,2),
    contenido TEXT,
    requisitos TEXT,
    certificacion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. AGREGAR CAMPO programa_id A LA TABLA cursos (que ahora representa GRUPOS)
ALTER TABLE cursos 
ADD COLUMN IF NOT EXISTS programa_id INTEGER REFERENCES programas(id) ON DELETE CASCADE;

-- 3. MIGRAR DATOS EXISTENTES: Extraer programas únicos de cursos actuales
INSERT INTO programas (nombre, descripcion, duracion, duracion_horas, precio, precio_inscripcion, precio_mensualidad)
SELECT DISTINCT ON (nombre)
    nombre,
    descripcion,
    duracion,
    duracion_horas,
    precio,
    precio_inscripcion,
    precio_mensualidad
FROM cursos
WHERE nombre IS NOT NULL
ON CONFLICT (nombre) DO NOTHING;

-- 4. ACTUALIZAR cursos existentes para vincularlos con programas
UPDATE cursos c
SET programa_id = p.id
FROM programas p
WHERE c.nombre = p.nombre;

-- 5. OPCIONAL: Renombrar columna nombre en cursos a nombre_grupo (para claridad)
-- DESCOMENTA la siguiente línea si quieres renombrar:
-- ALTER TABLE cursos RENAME COLUMN nombre TO nombre_grupo;

-- 6. CREAR ÍNDICES para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_cursos_programa_id ON cursos(programa_id);
CREATE INDEX IF NOT EXISTS idx_programas_activo ON programas(activo);

-- 7. COMENTARIOS EN LAS TABLAS (Documentación)
COMMENT ON TABLE programas IS 'Nivel superior: Programas académicos generales (ej: Micropigmentación)';
COMMENT ON TABLE cursos IS 'Nivel secundario: Grupos/Cohortes específicos con horarios dentro de cada programa';
COMMENT ON COLUMN cursos.programa_id IS 'Referencia al programa académico al que pertenece este grupo';
COMMENT ON COLUMN cursos.nombre IS 'Nombre del grupo/cohorte (puede mantener nombre del programa o usar identificador único como "Grupo A")';

-- ================================================
-- NOTAS DE IMPLEMENTACIÓN:
-- ================================================
-- 1. Las matrículas seguirán referenciando cursos.id (que ahora son grupos)
-- 2. Puedes mantener el campo 'nombre' en cursos o cambiarlo a 'nombre_grupo'
-- 3. Al crear un nuevo grupo, seleccionas primero el programa_id
-- 4. Los campos como precio, duracion se copian del programa o se pueden sobrescribir en el grupo
-- ================================================
