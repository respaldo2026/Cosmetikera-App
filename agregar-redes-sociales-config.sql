-- Agregar columnas de redes sociales a la tabla configuracion

-- Verificar si las columnas existen
-- Si no existen, crearlas

ALTER TABLE configuracion
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT;

-- Verificar que se agregaron correctamente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'configuracion' 
AND column_name IN ('instagram', 'facebook')
ORDER BY column_name;
