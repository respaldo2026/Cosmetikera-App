-- Ver qué datos tienen estos usuarios
SELECT 
  email,
  raw_user_meta_data,
  raw_app_meta_data
FROM auth.users
WHERE email IN ('estudiante@gmail.com', 'profesor@gmail.com');

-- Agregar el rol manualmente basado en el email
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"rol": "estudiante"}'::jsonb
WHERE email = 'estudiante@gmail.com';

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"rol": "profesor"}'::jsonb
WHERE email = 'profesor@gmail.com';

-- Verificar
SELECT email, raw_app_meta_data->>'rol' as rol
FROM auth.users
WHERE email IN ('estudiante@gmail.com', 'profesor@gmail.com');
