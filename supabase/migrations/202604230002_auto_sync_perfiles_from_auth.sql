-- Sincroniza automáticamente auth.users -> public.perfiles
-- Cubre usuarios nuevos y también backfill de usuarios existentes sin perfil.

CREATE OR REPLACE FUNCTION public.sync_perfil_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  meta jsonb;
  v_rol text;
  v_nombre text;
  v_telefono text;
  v_identificacion text;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  v_rol := lower(
    COALESCE(
      NULLIF(meta->>'rol', ''),
      CASE
        WHEN lower(COALESCE(NEW.email, '')) = 'admin@gmail.com' THEN 'administrador'
        ELSE 'cliente'
      END
    )
  );

  IF v_rol IN ('admin', 'director', 'administrativo') THEN
    v_rol := 'administrador';
  ELSIF v_rol IN ('secretaria', 'asesor') THEN
    v_rol := 'vendedor';
  ELSIF v_rol IN ('estudiante', 'egresado') THEN
    v_rol := 'cliente';
  ELSIF v_rol NOT IN ('administrador', 'marketing', 'vendedor', 'cliente') THEN
    v_rol := 'cliente';
  END IF;

  v_nombre := COALESCE(
    NULLIF(meta->>'nombre_completo', ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'Usuario'
  );

  v_telefono := NULLIF(meta->>'telefono', '');
  v_identificacion := NULLIF(COALESCE(meta->>'identificacion', meta->>'cedula'), '');

  INSERT INTO public.perfiles (
    id,
    email,
    nombre_completo,
    rol,
    telefono,
    identificacion,
    activo,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_nombre,
    v_rol,
    v_telefono,
    v_identificacion,
    true,
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email,
    nombre_completo = COALESCE(NULLIF(public.perfiles.nombre_completo, ''), EXCLUDED.nombre_completo),
    rol = COALESCE(public.perfiles.rol, EXCLUDED.rol),
    telefono = COALESCE(public.perfiles.telefono, EXCLUDED.telefono),
    identificacion = COALESCE(public.perfiles.identificacion, EXCLUDED.identificacion),
    activo = COALESCE(public.perfiles.activo, true),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_sync_perfil ON auth.users;
CREATE TRIGGER on_auth_user_created_sync_perfil
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_perfil_from_auth_user();

DROP TRIGGER IF EXISTS on_auth_user_updated_sync_perfil ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync_perfil
AFTER UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_perfil_from_auth_user();

-- Backfill para usuarios ya existentes en auth.users que no tengan perfil aún.
INSERT INTO public.perfiles (
  id,
  email,
  nombre_completo,
  rol,
  telefono,
  identificacion,
  activo,
  updated_at
)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'nombre_completo', ''), split_part(COALESCE(u.email, ''), '@', 1), 'Usuario') AS nombre_completo,
  CASE
    WHEN lower(COALESCE(u.raw_user_meta_data->>'rol', '')) IN ('admin', 'director', 'administrativo') THEN 'administrador'
    WHEN lower(COALESCE(u.raw_user_meta_data->>'rol', '')) IN ('secretaria', 'asesor') THEN 'vendedor'
    WHEN lower(COALESCE(u.raw_user_meta_data->>'rol', '')) IN ('estudiante', 'egresado') THEN 'cliente'
    WHEN lower(COALESCE(u.raw_user_meta_data->>'rol', '')) IN ('administrador', 'marketing', 'vendedor', 'cliente') THEN lower(u.raw_user_meta_data->>'rol')
    WHEN lower(COALESCE(u.email, '')) = 'admin@gmail.com' THEN 'administrador'
    ELSE 'cliente'
  END AS rol,
  NULLIF(u.raw_user_meta_data->>'telefono', '') AS telefono,
  NULLIF(COALESCE(u.raw_user_meta_data->>'identificacion', u.raw_user_meta_data->>'cedula'), '') AS identificacion,
  true,
  now()
FROM auth.users u
LEFT JOIN public.perfiles p ON p.id = u.id
WHERE p.id IS NULL;
