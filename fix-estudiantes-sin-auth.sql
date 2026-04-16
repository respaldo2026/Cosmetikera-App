-- ========================================
-- CORREGIR ESTUDIANTES SIN USUARIO DE AUTH
-- ========================================

-- 1. VER ESTUDIANTES QUE NO TIENEN USUARIO EN AUTH
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
WHERE p.rol = 'estudiante'
ORDER BY p.created_at DESC;

-- 2. CREAR USUARIOS DE AUTH PARA ESTUDIANTES SIN ACCESO
-- IMPORTANTE: Solo ejecuta esto si los estudiantes tienen email válido

DO $$
DECLARE
    estudiante_record RECORD;
BEGIN
    FOR estudiante_record IN 
        SELECT 
            p.id,
            p.nombre_completo,
            p.email,
            p.identificacion
        FROM perfiles p
        LEFT JOIN auth.users au ON au.id = p.id
        WHERE p.rol = 'estudiante' 
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
            estudiante_record.id,
            estudiante_record.email,
            crypt(COALESCE(estudiante_record.identificacion, 'estudiante123'), gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object(
                'nombre_completo', estudiante_record.nombre_completo,
                'rol', 'estudiante'
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
            estudiante_record.id,
            estudiante_record.id::text,
            jsonb_build_object(
                'sub', estudiante_record.id::text,
                'email', estudiante_record.email,
                'email_verified', true,
                'provider', 'email'
            ),
            'email',
            NOW(),
            NOW(),
            NOW()
        )
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Usuario creado para: % (ID: %)', estudiante_record.nombre_completo, estudiante_record.id;
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
WHERE p.rol = 'estudiante'
ORDER BY p.created_at DESC;

-- 4. INSTRUCCIONES PARA EL ESTUDIANTE
-- Contraseña temporal será su número de identificación
-- Si no tiene identificación, será: estudiante123
-- El estudiante puede cambiar su contraseña desde el portal

SELECT 
    'CREDENCIALES CREADAS:' as info,
    p.nombre_completo,
    p.email as usuario,
    COALESCE(p.identificacion, 'estudiante123') as password_temporal
FROM perfiles p
INNER JOIN auth.users au ON au.id = p.id
WHERE p.rol = 'estudiante'
ORDER BY p.nombre_completo;
