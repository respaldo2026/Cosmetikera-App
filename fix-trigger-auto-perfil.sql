-- ========================================
-- VERIFICAR Y REPARAR TRIGGER AUTO PERFIL
-- ========================================

-- 1. Ver si el trigger existe
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%perfil%' OR trigger_name LIKE '%user%'
ORDER BY trigger_name;

-- 2. Ver funciones relacionadas con perfiles
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name LIKE '%perfil%' OR routine_name LIKE '%user%'
ORDER BY routine_name;

-- 3. CREAR/RECREAR TRIGGER AUTOMÁTICO
-- Esto asegura que cada vez que se cree un usuario en auth.users,
-- se cree automáticamente su perfil

-- Primero, eliminar si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Crear función que maneja la creación del perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insertar perfil automáticamente
    INSERT INTO public.perfiles (
        id,
        email,
        nombre_completo,
        rol
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nombre_completo', 'Usuario'),
        COALESCE(NEW.raw_user_meta_data->>'rol', 'estudiante')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        nombre_completo = COALESCE(EXCLUDED.nombre_completo, perfiles.nombre_completo);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger que ejecuta la función
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. Verificar que se creó correctamente
SELECT 
    '✅ TRIGGER CREADO EXITOSAMENTE' as resultado,
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 5. Mensaje final
SELECT '✅ De ahora en adelante, cada usuario creado tendrá su perfil automáticamente' as confirmacion;
