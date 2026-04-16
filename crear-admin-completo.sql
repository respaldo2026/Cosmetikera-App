-- ====================================================
-- CREAR USUARIO ADMINISTRADOR COMPLETO
-- ====================================================

-- 1. Crear usuario en auth.users con Supabase Admin
-- IMPORTANTE: Ejecuta esto en el SQL Editor de Supabase
-- Email: crystal.diamante.col@gmail.com
-- Password: TU_CEDULA (reemplaza con tu cédula real)

-- Este paso requiere usar la función de Supabase para crear usuarios
-- Ve a Authentication > Users > Add User (botón verde)
-- O usa este SQL si tienes permisos:

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
    role
)
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'crystal.diamante.col@gmail.com',
    crypt('TU_CEDULA_AQUI', gen_salt('bf')), -- REEMPLAZA TU_CEDULA_AQUI con tu cédula
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    FALSE,
    'authenticated'
)
RETURNING id;

-- 2. IMPORTANTE: Copia el ID que te devolvió el query anterior
-- Y úsalo en el siguiente INSERT (reemplaza 'ID_DEL_USUARIO_AQUI')

-- 3. Crear el perfil asociado
INSERT INTO perfiles (
    id, -- Mismo ID del usuario de auth.users
    nombre_completo,
    email,
    rol,
    identificacion,
    telefono,
    created_at,
    updated_at
)
VALUES (
    'ID_DEL_USUARIO_AQUI', -- REEMPLAZA con el ID que obtuviste arriba
    'Administrador Crystal Diamante',
    'crystal.diamante.col@gmail.com',
    'administrativo', -- El rol debe ser 'administrativo', no 'administrador'
    'TU_CEDULA_AQUI', -- REEMPLAZA con tu cédula
    '3001234567', -- OPCIONAL: tu teléfono
    NOW(),
    NOW()
);

-- 4. Verificar que se creó correctamente
SELECT 
    u.id,
    u.email as auth_email,
    p.nombre_completo,
    p.rol
FROM auth.users u
LEFT JOIN perfiles p ON u.id = p.id
WHERE u.email = 'crystal.diamante.col@gmail.com';
