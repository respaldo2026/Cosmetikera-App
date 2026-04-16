-- ================================================
-- CREAR NUEVOS USUARIOS CON ROL ESPECIFICADO
-- ================================================
-- USO: Reemplaza los datos y ejecuta

-- OPCIÓN 1: CREAR PROFESOR
-- Ejecuta en Supabase Authentication > Users > Add User
-- Email: profesor@academia.com
-- Password: CEDULA_PROFESOR
-- Luego ejecuta este SQL:

INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud
)
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'profesor@academia.com',
    crypt('CEDULA_AQUI', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"nombre_completo":"Nombre del Profesor","rol":"profesor","identificacion":"CEDULA_AQUI"}',
    FALSE,
    'authenticated',
    'authenticated'
)
RETURNING id;

-- ================================================
-- OPCIÓN 2: CREAR ESTUDIANTE
-- Email: estudiante@academia.com
-- Password: CEDULA_ESTUDIANTE

INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud
)
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'estudiante@academia.com',
    crypt('CEDULA_AQUI', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"nombre_completo":"Nombre del Estudiante","rol":"estudiante","identificacion":"CEDULA_AQUI"}',
    FALSE,
    'authenticated',
    'authenticated'
)
RETURNING id;

-- ================================================
-- OPCIÓN 3: CREAR ADMINISTRATIVO
-- Email: admin@academia.com
-- Password: CEDULA_ADMIN

INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud
)
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'admin@academia.com',
    crypt('CEDULA_AQUI', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"nombre_completo":"Nombre del Admin","rol":"administrativo","identificacion":"CEDULA_AQUI"}',
    FALSE,
    'authenticated',
    'authenticated'
)
RETURNING id;

-- ================================================
-- VERIFICAR USUARIOS CREADOS CON SUS PERFILES
-- ================================================

SELECT 
    u.email as auth_email,
    p.nombre_completo,
    p.rol,
    p.identificacion,
    CASE 
        WHEN p.id IS NOT NULL THEN '✅ Con Perfil'
        ELSE '❌ Sin Perfil'
    END as estado
FROM auth.users u
LEFT JOIN perfiles p ON u.id = p.id
WHERE u.email NOT LIKE '%@supabase%'
ORDER BY u.created_at DESC;
