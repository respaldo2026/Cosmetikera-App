-- ========================================
-- BORRAR LOS 6 USUARIOS SELECCIONADOS
-- ========================================

DO $$
DECLARE
    usuarios_a_borrar TEXT[] := ARRAY[
        'admin@academia.crystal',
        'cosmetiikera@gmail.com',
        'dulceamor@gmail.com',
        'marylin@academia.com',
        'newsocialmedia2.0@gmail.com',
        'prueba@gmail.com'
    ];
    email_actual TEXT;
    user_id_to_delete UUID;
    contador INT := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '🗑️ INICIANDO ELIMINACIÓN DE USUARIOS';
    RAISE NOTICE '========================================';
    
    -- Iterar sobre cada email
    FOREACH email_actual IN ARRAY usuarios_a_borrar
    LOOP
        -- Obtener el ID del usuario por email
        SELECT id INTO user_id_to_delete
        FROM auth.users
        WHERE email = email_actual;
        
        IF user_id_to_delete IS NULL THEN
            RAISE NOTICE '⚠️ No encontrado: %', email_actual;
            CONTINUE;
        END IF;
        
        RAISE NOTICE '🔍 Eliminando: % (ID: %)', email_actual, user_id_to_delete;
        
        -- 1. Eliminar dependencias
        DELETE FROM matriculas WHERE estudiante_id = user_id_to_delete;
        DELETE FROM grupos_estudiantes WHERE estudiante_id = user_id_to_delete;
        DELETE FROM asistencias WHERE estudiante_id = user_id_to_delete;
        DELETE FROM pagos WHERE estudiante_id = user_id_to_delete;
        DELETE FROM grupos WHERE profesor_id = user_id_to_delete;
        DELETE FROM nomina WHERE profesor_id = user_id_to_delete;
        
        -- 2. Eliminar perfil
        DELETE FROM perfiles WHERE id = user_id_to_delete;
        
        -- 3. Eliminar de auth.users
        DELETE FROM auth.users WHERE id = user_id_to_delete;
        
        contador := contador + 1;
        RAISE NOTICE '✅ Eliminado: %', email_actual;
        
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PROCESO COMPLETADO';
    RAISE NOTICE 'Total eliminados: % de %', contador, array_length(usuarios_a_borrar, 1);
    RAISE NOTICE '========================================';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error durante la eliminación: %', SQLERRM;
        RAISE NOTICE 'Continuando con el siguiente usuario...';
END $$;

-- Verificar usuarios restantes
SELECT 
    '✅ USUARIOS RESTANTES EN AUTH' as resultado,
    u.id,
    u.email,
    u.email_confirmed_at,
    p.nombre_completo,
    p.rol
FROM auth.users u
LEFT JOIN perfiles p ON p.id = u.id
ORDER BY u.created_at DESC;

-- Contar usuarios por rol
SELECT 
    '📊 RESUMEN POR ROL' as resultado,
    COUNT(*) FILTER (WHERE rol = 'admin') as admins,
    COUNT(*) FILTER (WHERE rol = 'profesor') as profesores,
    COUNT(*) FILTER (WHERE rol = 'estudiante') as estudiantes,
    COUNT(*) as total_perfiles
FROM perfiles;
