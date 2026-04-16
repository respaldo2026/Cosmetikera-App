-- ========================================
-- CREAR PERFILES PARA USUARIOS HUÉRFANOS
-- ========================================
-- Este script crea perfiles para usuarios que están en auth.users
-- pero no tienen registro en la tabla perfiles

-- 1. Ver usuarios en auth.users SIN perfil
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    u.created_at,
    'SIN PERFIL' as estado
FROM auth.users u
LEFT JOIN perfiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- 2. Crear perfiles para usuarios huérfanos
-- Asignarles rol='admin' por defecto
INSERT INTO perfiles (id, email, rol, nombre_completo)
SELECT 
    u.id,
    u.email,
    'admin' as rol,
    COALESCE(u.raw_user_meta_data->>'nombre_completo', 'Administrador') as nombre_completo
FROM auth.users u
LEFT JOIN perfiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 3. Verificar que se crearon
SELECT 
    p.id,
    p.nombre_completo,
    p.email,
    p.rol,
    p.created_at,
    '✅ PERFIL CREADO' as estado
FROM perfiles p
ORDER BY p.created_at DESC;

-- 4. Contar por rol
SELECT 
    COUNT(*) FILTER (WHERE rol = 'admin') as admins,
    COUNT(*) FILTER (WHERE rol = 'profesor') as profesores,
    COUNT(*) FILTER (WHERE rol = 'estudiante') as estudiantes,
    COUNT(*) as total
FROM perfiles;
