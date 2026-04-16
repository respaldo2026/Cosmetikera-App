-- ========================================
-- DIAGNÓSTICO COMPLETO - ADMINISTRADORES
-- ========================================

-- 1. Ver TODOS los usuarios en auth.users
SELECT 
    '📋 TODOS LOS USUARIOS EN AUTH' as seccion,
    u.id,
    u.email,
    u.email_confirmed_at,
    u.created_at,
    u.deleted_at,
    CASE 
        WHEN u.email_confirmed_at IS NULL THEN '❌ NO CONFIRMADO'
        ELSE '✅ CONFIRMADO'
    END as estado_email,
    CASE 
        WHEN u.deleted_at IS NOT NULL THEN '🗑️ ELIMINADO'
        ELSE '✅ ACTIVO'
    END as estado_usuario
FROM auth.users u
ORDER BY u.created_at DESC;

-- 2. Ver TODOS los perfiles
SELECT 
    '📋 TODOS LOS PERFILES' as seccion,
    p.id,
    p.nombre_completo,
    p.email,
    p.rol,
    p.identificacion,
    p.created_at
FROM perfiles p
ORDER BY p.created_at DESC;

-- 3. Ver perfiles con rol admin
SELECT 
    '👑 PERFILES CON ROL ADMIN' as seccion,
    p.id,
    p.nombre_completo,
    p.email,
    p.rol,
    p.identificacion,
    p.created_at
FROM perfiles p
WHERE p.rol = 'admin'
ORDER BY p.created_at DESC;

-- 4. Unión completa: auth.users + perfiles
SELECT 
    '🔗 UNIÓN COMPLETA' as seccion,
    u.id as user_id,
    u.email as email_auth,
    u.email_confirmed_at,
    CASE 
        WHEN u.email_confirmed_at IS NULL THEN '❌ NO CONFIRMADO'
        ELSE '✅ CONFIRMADO'
    END as estado_email,
    p.id as perfil_id,
    p.nombre_completo,
    p.email as email_perfil,
    p.rol,
    p.identificacion,
    CASE 
        WHEN p.id IS NULL THEN '❌ SIN PERFIL'
        WHEN u.id IS NULL THEN '❌ SIN AUTH'
        ELSE '✅ OK'
    END as estado_relacion
FROM auth.users u
FULL OUTER JOIN perfiles p ON p.id = u.id
WHERE p.rol = 'admin' OR u.email LIKE '%admin%' OR u.email LIKE '%crystal%'
ORDER BY u.created_at DESC;

-- 5. Contar registros
SELECT 
    '📊 CONTEO' as seccion,
    COUNT(*) FILTER (WHERE rol = 'admin') as total_perfiles_admin,
    COUNT(*) FILTER (WHERE rol = 'profesor') as total_profesores,
    COUNT(*) FILTER (WHERE rol = 'estudiante') as total_estudiantes,
    COUNT(*) as total_perfiles
FROM perfiles;

-- 6. Ver si hay problemas con emails no confirmados
SELECT 
    '⚠️ ADMINS SIN CONFIRMAR EMAIL' as seccion,
    COUNT(*) as cantidad_sin_confirmar
FROM auth.users u
INNER JOIN perfiles p ON p.id = u.id
WHERE p.rol = 'admin'
  AND u.email_confirmed_at IS NULL;
