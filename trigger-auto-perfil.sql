-- ================================================
-- TRIGGER AUTOMÁTICO: CREAR PERFIL AL CREAR USUARIO
-- ================================================
-- Cuando se crea un usuario en auth.users, automáticamente
-- se crea su registro en perfiles con el rol especificado

-- 1. Crear función que maneje el trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insertar un nuevo perfil con los datos del usuario
    INSERT INTO public.perfiles (
        id,
        email,
        nombre_completo,
        rol,
        identificacion,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email),
        -- El rol se toma de los metadatos, si no existe defecto a 'estudiante'
        COALESCE(NEW.raw_user_meta_data->>'rol', 'estudiante'),
        COALESCE(NEW.raw_user_meta_data->>'identificacion', NULL),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING; -- Si ya existe, no hacer nada
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear trigger en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Verificar que el trigger existe
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table = 'users'
ORDER BY trigger_name;

