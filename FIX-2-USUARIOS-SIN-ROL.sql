-- Arreglar los 2 usuarios sin rol en app_metadata
UPDATE auth.users
SET raw_app_meta_data = 
  raw_app_meta_data || 
  jsonb_build_object('rol', raw_user_meta_data->>'rol')
WHERE email IN ('estudiante@gmail.com', 'profesor@gmail.com')
AND raw_user_meta_data->>'rol' IS NOT NULL;

-- Verificar
SELECT email, raw_app_meta_data->>'rol' as rol
FROM auth.users
WHERE email IN ('estudiante@gmail.com', 'profesor@gmail.com');
