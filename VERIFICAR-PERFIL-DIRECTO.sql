-- ====================================================
-- VERIFICAR PERFIL ESPECÍFICO (sin depender de auth.uid)
-- ====================================================

-- Tu user ID que vimos en los logs: 6c879be0-1965-48aa-83be-4d9419568372

-- 1. ¿Existe tu perfil?
SELECT 
  '1️⃣ TU PERFIL' as seccion,
  id,
  email,
  rol,
  nombre_completo,
  created_at
FROM perfiles
WHERE id = '6c879be0-1965-48aa-83be-4d9419568372';

-- 2. Contar cuántos perfiles con rol admin hay
SELECT 
  '2️⃣ TOTAL ADMINS' as seccion,
  COUNT(*) as total_admins
FROM perfiles
WHERE rol = 'admin';

-- 3. Ver TODOS los perfiles
SELECT 
  '3️⃣ TODOS LOS PERFILES' as seccion,
  id,
  email,
  rol,
  nombre_completo
FROM perfiles
ORDER BY 
  CASE rol
    WHEN 'admin' THEN 1
    WHEN 'director' THEN 2
    WHEN 'administrativo' THEN 3
    ELSE 4
  END,
  email;

-- 4. Verificar si el ID coincide (comparación directa)
SELECT 
  '4️⃣ MATCH DIRECTO' as seccion,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = '6c879be0-1965-48aa-83be-4d9419568372'
      AND rol IN ('admin', 'director', 'administrativo')
    ) THEN '✅ SÍ existe perfil con permisos'
    ELSE '❌ NO existe perfil con permisos'
  END as resultado;

-- 5. Ver el usuario en auth.users
SELECT 
  '5️⃣ AUTH.USERS' as seccion,
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE id = '6c879be0-1965-48aa-83be-4d9419568372';
