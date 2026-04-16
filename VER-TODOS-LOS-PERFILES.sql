-- ====================================================
-- VER TODOS LOS PERFILES Y SUS ROLES
-- ====================================================
-- Esta query NO depende de auth.uid(), así podemos ver
-- si tu usuario TIENE perfil con rol válido

SELECT 
  id,
  email,
  rol,
  nombre_completo,
  created_at,
  CASE 
    WHEN rol IN ('admin', 'director', 'administrativo') THEN '✅ PUEDE ELIMINAR'
    ELSE '❌ NO PUEDE ELIMINAR'
  END as permisos_eliminar
FROM perfiles
ORDER BY 
  CASE rol
    WHEN 'admin' THEN 1
    WHEN 'director' THEN 2
    WHEN 'administrativo' THEN 3
    ELSE 4
  END,
  email;

-- ====================================================
-- Si no ves tu usuario con rol admin, créalo así:
-- ====================================================

-- Primero, busca tu user ID en auth.users:
-- SELECT id, email FROM auth.users WHERE email = 'TU-EMAIL@AQUI.COM';

-- Luego, inserta o actualiza tu perfil:
-- INSERT INTO perfiles (id, email, rol, nombre_completo)
-- VALUES (
--   'PEGA-AQUI-EL-ID-DE-AUTH-USERS',
--   'tu-email@aqui.com',
--   'admin',
--   'Tu Nombre Completo'
-- )
-- ON CONFLICT (id) DO UPDATE SET rol = 'admin';
