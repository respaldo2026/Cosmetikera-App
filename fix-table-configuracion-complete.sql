-- Script completo para arreglar la tabla configuracion

-- 1. Primero, asegurarse de que existan todas las columnas necesarias
ALTER TABLE configuracion
ADD COLUMN IF NOT EXISTS nombre_academia TEXT,
ADD COLUMN IF NOT EXISTS ruc TEXT,
ADD COLUMN IF NOT EXISTS telefono TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS sitio_web TEXT,
ADD COLUMN IF NOT EXISTS ticket_titulo TEXT,
ADD COLUMN IF NOT EXISTS ticket_nota TEXT,
ADD COLUMN IF NOT EXISTS ticket_pie TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS youtube TEXT,
ADD COLUMN IF NOT EXISTS moneda TEXT,
ADD COLUMN IF NOT EXISTS impuesto NUMERIC,
ADD COLUMN IF NOT EXISTS dias_gracia_pago INTEGER,
ADD COLUMN IF NOT EXISTS mora_por_dia NUMERIC,
ADD COLUMN IF NOT EXISTS ticket_campos JSONB,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Obtener el id UUID de la fila existente (o crear una si no existe)
-- El app usa upsert con id específico, así que necesitamos saber cuál es
-- Primero verifiquemos qué existe

-- 3. Ver la fila actual (si existe)
SELECT id FROM configuracion LIMIT 1;

-- 4. Si no existe ninguna fila, crear una con un UUID generado
INSERT INTO configuracion 
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM configuracion)
LIMIT 1;

-- 5. Ver todas las filas y sus IDs
SELECT id FROM configuracion;

-- 6. Ver todas las columnas de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'configuracion'
ORDER BY ordinal_position;

-- 7. Verificar políticas RLS para que permitan UPDATE/INSERT
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'configuracion'
ORDER BY policyname;
