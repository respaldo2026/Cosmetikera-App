-- ========================================
-- BORRAR USUARIOS DE FORMA SEGURA
-- ========================================

-- OPCIÓN 1: Ver todos los usuarios primero
SELECT 
    u.id,
    u.email,
    u.created_at,
    p.nombre_completo,
    p.rol
FROM auth.users u
LEFT JOIN perfiles p ON p.id = u.id
ORDER BY u.created_at DESC;

-- ========================================
-- OPCIÓN 2: BORRAR UN USUARIO ESPECÍFICO
-- Reemplaza 'EMAIL_AQUI' con el email del usuario que quieres borrar
-- ========================================

DO $$
DECLARE
    user_id_to_delete UUID;
    email_to_delete TEXT := 'admin@academia.crystal'; -- ⚠️ CAMBIA ESTE EMAIL
BEGIN
    -- Obtener el ID del usuario por email
    SELECT id INTO user_id_to_delete
    FROM auth.users
    WHERE email = email_to_delete;
    
    IF user_id_to_delete IS NULL THEN
        RAISE NOTICE '❌ No se encontró usuario con email: %', email_to_delete;
        RETURN;
    END IF;
    
    RAISE NOTICE '🔍 Usuario encontrado: % (ID: %)', email_to_delete, user_id_to_delete;
    
    -- 1. Borrar todas las dependencias primero
    RAISE NOTICE '🗑️ Eliminando dependencias...';
    
    -- Eliminar de matriculas (si existe)
    DELETE FROM matriculas WHERE estudiante_id = user_id_to_delete;
    
    -- Eliminar de grupos_estudiantes (si existe)
    DELETE FROM grupos_estudiantes WHERE estudiante_id = user_id_to_delete;
    
    -- Eliminar de asistencias (si existe)
    DELETE FROM asistencias WHERE estudiante_id = user_id_to_delete;
    
    -- Eliminar de pagos (si existe)
    DELETE FROM pagos WHERE estudiante_id = user_id_to_delete;
    
    -- Eliminar de cualquier otra tabla relacionada
    DELETE FROM grupos WHERE profesor_id = user_id_to_delete;
    
    -- 2. Eliminar perfil
    RAISE NOTICE '🗑️ Eliminando perfil...';
    DELETE FROM perfiles WHERE id = user_id_to_delete;
    
    -- 3. Eliminar de auth.users
    RAISE NOTICE '🗑️ Eliminando usuario de auth...';
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    
    RAISE NOTICE '✅ Usuario eliminado exitosamente: %', email_to_delete;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error eliminando usuario: %', SQLERRM;
END $$;

-- ========================================
-- OPCIÓN 3: BORRAR TODOS LOS ADMINISTRADORES DE PRUEBA
-- ⚠️ CUIDADO: Esto borra TODOS los admins
-- ========================================

/*
DO $$
DECLARE
    admin_record RECORD;
BEGIN
    FOR admin_record IN 
        SELECT u.id, u.email, p.nombre_completo
        FROM auth.users u
        INNER JOIN perfiles p ON p.id = u.id
        WHERE p.rol = 'admin'
    LOOP
        -- Eliminar dependencias
        DELETE FROM matriculas WHERE estudiante_id = admin_record.id;
        DELETE FROM grupos_estudiantes WHERE estudiante_id = admin_record.id;
        DELETE FROM asistencias WHERE estudiante_id = admin_record.id;
        DELETE FROM pagos WHERE estudiante_id = admin_record.id;
        DELETE FROM grupos WHERE profesor_id = admin_record.id;
        
        -- Eliminar perfil
        DELETE FROM perfiles WHERE id = admin_record.id;
        
        -- Eliminar de auth
        DELETE FROM auth.users WHERE id = admin_record.id;
        
        RAISE NOTICE '✅ Eliminado: % (%)', admin_record.email, admin_record.nombre_completo;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Todos los administradores eliminados';
    RAISE NOTICE '========================================';
END $$;
*/

-- ========================================
-- OPCIÓN 4: BORRAR POR ID DIRECTAMENTE
-- ========================================

/*
-- Reemplaza 'UUID_AQUI' con el ID del usuario
DO $$
DECLARE
    user_id_to_delete UUID := 'UUID_AQUI'; -- ⚠️ PEGA EL UUID AQUÍ
BEGIN
    -- Eliminar dependencias
    DELETE FROM matriculas WHERE estudiante_id = user_id_to_delete;
    DELETE FROM grupos_estudiantes WHERE estudiante_id = user_id_to_delete;
    DELETE FROM asistencias WHERE estudiante_id = user_id_to_delete;
    DELETE FROM pagos WHERE estudiante_id = user_id_to_delete;
    DELETE FROM grupos WHERE profesor_id = user_id_to_delete;
    
    -- Eliminar perfil
    DELETE FROM perfiles WHERE id = user_id_to_delete;
    
    -- Eliminar de auth
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    
    RAISE NOTICE '✅ Usuario eliminado exitosamente';
END $$;
*/

-- Verificar que se eliminaron
SELECT 
    '✅ USUARIOS RESTANTES' as resultado,
    u.id,
    u.email,
    p.nombre_completo,
    p.rol
FROM auth.users u
LEFT JOIN perfiles p ON p.id = u.id
ORDER BY u.created_at DESC;
