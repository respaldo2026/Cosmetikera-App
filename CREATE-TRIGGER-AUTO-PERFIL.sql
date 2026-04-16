-- =====================================================
-- CREAR TRIGGER AUTOMÁTICO PARA NUEVOS USUARIOS
-- Ejecuta esto en Supabase SQL Editor
-- =====================================================

-- 1️⃣ CREAR LA FUNCIÓN que se ejecuta cuando se crea un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (
    id,
    email,
    nombre_completo,
    rol,
    activo,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.user_metadata->>'nombre_completo', NEW.email),
    COALESCE(NEW.user_metadata->>'rol', 'estudiante'),
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Si falla, solo logueamos pero no bloqueamos el signup
  RAISE WARNING 'Error en handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2️⃣ ELIMINAR TRIGGER ANTERIOR si existe (para evitar duplicados)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3️⃣ CREAR EL TRIGGER que ejecuta la función
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 4️⃣ VERIFICAR que el trigger fue creado
SELECT 
  tgname as trigger_name,
  tgisinternal as is_internal
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Si ves una fila con on_auth_user_created, ¡está listo! ✅
