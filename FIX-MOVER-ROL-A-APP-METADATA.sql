npm-- ====================================================
-- FIX CRÍTICO: MOVER ROL A APP_METADATA
-- ====================================================
-- PROBLEMA: El rol está en user_metadata, pero el JWT solo
-- incluye app_metadata. Las políticas RLS no pueden ver el rol.
-- 
-- SOLUCIÓN: Copiar el rol de user_metadata a app_metadata
-- para que aparezca en el JWT.
-- ====================================================

-- 1. Actualizar TODOS los usuarios existentes
UPDATE auth.users
SET raw_app_meta_data = 
  raw_app_meta_data || 
  jsonb_build_object('rol', raw_user_meta_data->>'rol')
WHERE raw_user_meta_data->>'rol' IS NOT NULL;

-- 2. Verificar que el rol ahora está en app_metadata
SELECT 
  email,
  raw_app_meta_data->>'rol' as rol_en_app_metadata,
  raw_user_meta_data->>'rol' as rol_en_user_metadata
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 3. Crear una función para sincronizar automáticamente
CREATE OR REPLACE FUNCTION public.sync_rol_to_app_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Si hay un rol en user_metadata, copiarlo a app_metadata
  IF NEW.raw_user_meta_data->>'rol' IS NOT NULL THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data || 
      jsonb_build_object('rol', NEW.raw_user_meta_data->>'rol');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear trigger para que se ejecute en INSERT y UPDATE
DROP TRIGGER IF EXISTS trigger_sync_rol_to_app_metadata ON auth.users;
CREATE TRIGGER trigger_sync_rol_to_app_metadata
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_rol_to_app_metadata();

-- ====================================================
-- VERIFICACIÓN FINAL
-- ====================================================
SELECT 
  '✅ FIX COMPLETADO' as estado,
  COUNT(*) as usuarios_actualizados
FROM auth.users
WHERE raw_app_meta_data->>'rol' IS NOT NULL;

-- IMPORTANTE: Después de ejecutar esto, todos los usuarios
-- deben CERRAR SESIÓN Y VOLVER A ENTRAR para que el JWT
-- se regenere con el nuevo claim 'rol'.
-- ====================================================
