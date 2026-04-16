-- SCRIPT: Verificar que la tabla configuracion está completamente lista

-- 1. Ver estructura completa de la tabla
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'configuracion'
ORDER BY ordinal_position;

-- 2. Ver cuántos registros hay
SELECT COUNT(*) as cantidad_registros FROM configuracion;

-- 3. Si hay registros, ver los primeros
SELECT id, nombre_academia, telefono, email, instagram, facebook, logo_url, 
       created_at, updated_at
FROM configuracion
LIMIT 5;

-- 4. Ver si hay algún registro con id='1' (problema potencial)
SELECT id, typeof(id), nombre_academia
FROM configuracion
WHERE CAST(id AS TEXT) = '1';

-- 5. Ver los tipos de datos reales
SELECT id, typeof(id) as tipo_id
FROM configuracion;

-- 6. Ver las políticas RLS de configuracion
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'configuracion';
