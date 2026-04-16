-- Fix: Agregar campo updated_at a tabla matriculas
-- Ejecutar en Supabase SQL Editor

-- Agregar columna updated_at si no existe
ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Actualizar registros existentes para que tengan un valor
UPDATE matriculas SET updated_at = created_at WHERE updated_at IS NULL;

-- Verificar que el trigger existe y funciona
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'matriculas';

-- Opcional: habilitar borrado en cascada para que no se bloqueen eliminaciones
-- (ejecutar solo si quieres que al borrar matrícula/estudiante se borren sus pagos/asistencias)

-- Pagos referenciando matrícula: ON DELETE CASCADE
DO $$
DECLARE
	fk_name text;
BEGIN
	SELECT constraint_name INTO fk_name
	FROM information_schema.constraint_column_usage
	WHERE table_name = 'pagos' AND column_name = 'matricula_id';

	IF fk_name IS NOT NULL THEN
		EXECUTE format('ALTER TABLE pagos DROP CONSTRAINT %I', fk_name);
	END IF;

	EXECUTE 'ALTER TABLE pagos
			 ADD CONSTRAINT pagos_matricula_fkey
			 FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE';
END $$;

-- Pagos referenciando estudiante: ON DELETE CASCADE (si quieres limpiar pagos al borrar estudiante)
DO $$
DECLARE
	fk_name text;
BEGIN
	SELECT constraint_name INTO fk_name
	FROM information_schema.constraint_column_usage
	WHERE table_name = 'pagos' AND column_name = 'estudiante_id';

	IF fk_name IS NOT NULL THEN
		EXECUTE format('ALTER TABLE pagos DROP CONSTRAINT %I', fk_name);
	END IF;

	EXECUTE 'ALTER TABLE pagos
			 ADD CONSTRAINT pagos_estudiante_fkey
			 FOREIGN KEY (estudiante_id) REFERENCES perfiles(id) ON DELETE CASCADE';
END $$;

-- Asistencias referenciando matrícula: ON DELETE CASCADE
DO $$
DECLARE
	fk_name text;
BEGIN
	SELECT constraint_name INTO fk_name
	FROM information_schema.constraint_column_usage
	WHERE table_name = 'asistencias' AND column_name = 'matricula_id';

	IF fk_name IS NOT NULL THEN
		EXECUTE format('ALTER TABLE asistencias DROP CONSTRAINT %I', fk_name);
	END IF;

	EXECUTE 'ALTER TABLE asistencias
			 ADD CONSTRAINT asistencias_matricula_fkey
			 FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE';
END $$;
