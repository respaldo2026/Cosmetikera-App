-- ====================================================
-- VERIFICAR ACTIVIDAD DE UPDATES EN SUPABASE
-- ====================================================

-- 1. Ver actualización más reciente de la tabla perfiles
SELECT 
  id,
  nombre_completo,
  updated_at,
  rol
FROM perfiles 
ORDER BY updated_at DESC 
LIMIT 5;

-- 2. Ver quién fue el último que actualizó
SELECT 
  id,
  email,
  last_sign_in_at,
  created_at
FROM auth.users 
ORDER BY last_sign_in_at DESC 
LIMIT 3;

-- 3. Prueba un UPDATE manual directo para confirmar que funciona
-- Reemplaza EL_ID_DEL_ESTUDIANTE con un UUID real
-- UPDATE perfiles 
-- SET nombre_completo = nombre_completo || ' - Actualizado a las ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
--     updated_at = NOW()
-- WHERE id = 'EL_ID_DEL_ESTUDIANTE'
-- RETURNING id, nombre_completo, updated_at;

-- 4. Si el UPDATE anterior funcionó, deberías ver el nombre actualizado aquí
-- SELECT id, nombre_completo, updated_at 
-- FROM perfiles 
-- WHERE id = 'EL_ID_DEL_ESTUDIANTE';
