-- ================================================
-- DIAGNÓSTICO DE LOGIN Y AUTENTICACIÓN
-- ================================================

-- 1. Ver todos los usuarios en auth.users
SELECT 
    'PASO 1: Usuarios en auth.users' as paso,
    id,
    email,
    created_at,
    last_sign_in_at,
    email_confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 2. Ver perfiles con rol administrador
SELECT 
    'PASO 2: Administradores en perfiles' as paso,
    id,
    nombre_completo,
    email,
    rol,
    created_at
FROM perfiles
WHERE rol = 'administrador'
ORDER BY created_at DESC;

-- 3. Verificar si el usuario nuevo tiene perfil
SELECT 
    'PASO 3: Validar relación auth.users <-> perfiles' as paso,
    u.id as user_id,
    u.email as auth_email,
    p.id as perfil_id,
    p.nombre_completo,
    p.email as perfil_email,
    p.rol,
    CASE 
        WHEN p.id IS NULL THEN 'SIN PERFIL'
        WHEN u.id = p.id THEN 'OK'
        ELSE 'MISMATCH'
    END as validacion
FROM auth.users u
LEFT JOIN perfiles p ON u.id = p.id
WHERE u.email NOT LIKE '%@supabase%'
ORDER BY u.created_at DESC
LIMIT 10;

-- 4. Ver las políticas RLS en la tabla perfiles
SELECT 
    'PASO 4: Políticas RLS en perfiles' as paso,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'perfiles';

-- 5. Verificar si RLS está habilitado en perfiles
SELECT 
    'PASO 5: Estado RLS en perfiles' as paso,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'perfiles';

-- 6. Intentar SELECT como usuario anónimo (simular lo que hace el frontend)
-- Esto requiere ejecutar con rol anon
SET ROLE anon;
SELECT 
    'PASO 6: Test SELECT con rol anon' as paso,
    id,
    nombre_completo,
    email,
    rol
FROM perfiles
WHERE rol = 'administrador'
LIMIT 1;
RESET ROLE;
