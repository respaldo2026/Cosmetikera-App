-- Verificar que la tabla configuracion tiene datos
SELECT id, nombre_academia, telefono, whatsapp, email, instagram, facebook, 
       logo_url, created_at, updated_at
FROM configuracion
ORDER BY created_at DESC;

-- Ver el tipo de datos de la columna id
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'configuracion' AND column_name = 'id';

-- Contar registros
SELECT COUNT(*) as total_registros FROM configuracion;
