-- ========================================
-- VERIFICAR ESTADO DE RLS Y PERFILES
-- ========================================

-- 1. Verificar si RLS está habilitado en perfiles
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity = true THEN '🔒 RLS HABILITADO (PUEDE BLOQUEAR)'
        ELSE '✅ RLS DESHABILITADO (OK)'
    END as estado_rls
FROM pg_tables
WHERE tablename = 'perfiles';

-- 2. Ver TODOS los perfiles (sin importar RLS)
SELECT 
    p.id,
    p.nombre_completo,
    p.email,
    p.rol,
    p.identificacion,
    p.created_at
FROM perfiles p
ORDER BY p.created_at DESC;

-- 3. Si RLS está habilitado, deshabilitarlo
-- Descomenta las siguientes líneas:

/*
ALTER TABLE perfiles DISABLE ROW LEVEL SECURITY;
SELECT '✅ RLS DESHABILITADO EXITOSAMENTE' as resultado;
*/

-- 4. Verificar usuarios en auth con emails confirmados
SELECT 
    u.email,
    u.email_confirmed_at,
    CASE 
        WHEN u.email_confirmed_at IS NOT NULL THEN '✅ CONFIRMADO'
        ELSE '❌ SIN CONFIRMAR'
    END as estado_confirmacion,
    p.nombre_completo,
    p.rol
FROM auth.users u
LEFT JOIN perfiles p ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 10;
