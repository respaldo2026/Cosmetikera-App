-- Agregar columnas faltantes a la tabla configuracion para guardar el logo y redes sociales

-- Verificar y agregar logo_url si no existe
ALTER TABLE configuracion
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Agregar/actualizar las columnas de redes sociales
ALTER TABLE configuracion
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT;

-- Verificar todas las columnas que necesitamos
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'configuracion'
ORDER BY ordinal_position;

-- También verificar que existan estas columnas base
-- Si no existen, crearlas
ALTER TABLE configuracion
ADD COLUMN IF NOT EXISTS nombre_academia TEXT,
ADD COLUMN IF NOT EXISTS telefono TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS ticket_titulo TEXT,
ADD COLUMN IF NOT EXISTS ticket_nota TEXT,
ADD COLUMN IF NOT EXISTS ticket_pie TEXT;
