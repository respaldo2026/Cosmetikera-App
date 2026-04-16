-- ========================================
-- CORREGIR PROFESORES SIN USUARIO DE AUTH
-- ========================================

-- 1. VER PROFESORES QUE NO TIENEN USUARIO EN AUTH
SELECT 
    p.id,
    p.nombre_completo,
    p.email,
    p.identificacion,
    p.created_at,
    CASE 
        WHEN au.id IS NULL THEN '❌ Sin usuario auth'
        ELSE '✅ Tiene usuario auth'
    END as estado_auth
FROM perfiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.rol = 'profesor'
ORDER BY p.created_at DESC;

-- 2. CREAR USUARIOS DE AUTH PARA PROFESORES SIN ACCESO
-- IMPORTANTE: Solo ejecuta esto si los profesores tienen email válido

-- Opción A: Crear usuarios con contraseña basada en identificación
DO $$
DECLARE
    profesor_record RECORD;
    new_user_id UUID;
BEGIN
    FOR profesor_record IN 
        SELECT 
            p.id,
            p.nombre_completo,
            p.email,
            p.identificacion
        FROM perfiles p
        LEFT JOIN auth.users au ON au.id = p.id
        WHERE p.rol = 'profesor' 
        AND au.id IS NULL
        AND p.email IS NOT NULL
        AND p.email != ''
    LOOP
        -- Crear usuario en auth.users
        INSERT INTO auth.users (
            id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            role,
            aud
        )
        VALUES (
            profesor_record.id,
            profesor_record.email,
            crypt(COALESCE(profesor_record.identificacion, 'profesor123'), gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object(
                'nombre_completo', profesor_record.nombre_completo,
                'rol', 'profesor'
            ),
            NOW(),
            NOW(),
            '',
            'authenticated',
            'authenticated'
        )
        ON CONFLICT (id) DO NOTHING;

        -- Crear identidad en auth.identities
        INSERT INTO auth.identities (
            id,
            user_id,
            provider_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        )
        VALUES (
            gen_random_uuid(),
            profesor_record.id,
            profesor_record.id::text,
            jsonb_build_object(
                'sub', profesor_record.id::text,
                'email', profesor_record.email,
                'email_verified', true,
                'provider', 'email'
            ),
            'email',
            NOW(),
            NOW(),
            NOW()
        )
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Usuario creado para: % (ID: %)', profesor_record.nombre_completo, profesor_record.id;
    END LOOP;
END $$;

-- 3. VERIFICAR RESULTADOS
SELECT 
    p.id,
    p.nombre_completo,
    p.email,
    p.identificacion,
    au.email as auth_email,
    au.email_confirmed_at,
    CASE 
        WHEN au.id IS NULL THEN '❌ Sin usuario'
        WHEN au.email_confirmed_at IS NULL THEN '⚠️ Email no confirmado'
        ELSE '✅ OK'
    END as estado
FROM perfiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.rol = 'profesor'
ORDER BY p.created_at DESC;

-- 4. INSTRUCCIONES PARA EL PROFESOR
-- Contraseña temporal será su número de identificación
-- Si no tiene identificación, será: profesor123
-- El profesor puede cambiar su contraseña desde el perfil

SELECT 
    'CREDENCIALES CREADAS:' as info,
    p.nombre_completo,
    p.email as usuario,
    COALESCE(p.identificacion, 'profesor123') as password_temporal
FROM perfiles p
INNER JOIN auth.users au ON au.id = p.id
WHERE p.rol = 'profesor'
ORDER BY p.nombre_completo;
