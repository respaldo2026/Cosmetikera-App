-- ========================================
-- CREAR ADMIN - CRYSTAL DIAMANTE
-- Email: crystal.diamante.col@gmail.com
-- Password: 94540306
-- ========================================

-- PASO 1: Crear usuario en auth
DO $$
DECLARE
    nuevo_id UUID;
BEGIN
    -- Insertar en auth.users
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
        'crystal.diamante.col@gmail.com',
        crypt('94540306', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        FALSE,
        'authenticated',
        'authenticated'
    )
    RETURNING id INTO nuevo_id;
    
    -- Crear perfil automáticamente con el mismo ID
    INSERT INTO perfiles (
        id,
        nombre_completo,
        email,
        rol,
        identificacion,
        telefono
    )
    VALUES (
        nuevo_id,
        'Administrador Crystal',
        'crystal.diamante.col@gmail.com',
        'administrativo',
        '94540306',
        '3001234567'
    );
    
    RAISE NOTICE 'Usuario creado con ID: %', nuevo_id;
END $$;

-- PASO 2: Verificar que se creó correctamente
SELECT 
    u.id,
    u.email as auth_email,
    p.nombre_completo,
    p.rol,
    p.identificacion,
    CASE 
        WHEN p.id IS NOT NULL THEN 'OK ✅'
        ELSE 'SIN PERFIL ❌'
    END as estado
FROM auth.users u
LEFT JOIN perfiles p ON u.id = p.id
WHERE u.email = 'crystal.diamante.col@gmail.com';
