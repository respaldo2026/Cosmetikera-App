-- ====================================================
-- DIAGNÓSTICO UNIFICADO: Todo en una sola consulta
-- ====================================================

WITH 
-- 1. Tu sesión
mi_sesion AS (
  SELECT 
    '1. 🔑 MI SESIÓN' as seccion,
    auth.uid()::text as dato_1,
    auth.role()::text as dato_2,
    current_user::text as dato_3,
    ''::text as dato_4
),
-- 2. Tu perfil
mi_perfil AS (
  SELECT 
    '2. 👤 MI PERFIL' as seccion,
    COALESCE(id::text, '❌ NO TIENES PERFIL') as dato_1,
    COALESCE(email, 'Sin email') as dato_2,
    COALESCE(rol, '❌ SIN ROL') as dato_3,
    CASE 
      WHEN id IS NULL THEN '❌ NO TIENES PERFIL'
      WHEN rol IS NULL THEN '❌ ROL NULL'
      WHEN rol NOT IN ('admin', 'director', 'administrativo') THEN '❌ Rol "' || rol || '" no puede eliminar'
      ELSE '✅ Tu perfil está OK'
    END as dato_4
  FROM perfiles
  WHERE id = auth.uid()
),
-- 3. Política DELETE
politica AS (
  SELECT 
    '3. 🔒 POLÍTICA DELETE' as seccion,
    policyname::text as dato_1,
    CASE 
      WHEN qual LIKE '%admin%' AND qual LIKE '%director%' AND qual LIKE '%administrativo%' THEN '✅ Política OK'
      ELSE '❌ Política incorrecta'
    END as dato_2,
    SUBSTRING(qual::text, 1, 50) as dato_3,
    ''::text as dato_4
  FROM pg_policies
  WHERE tablename = 'leads' AND cmd = 'DELETE'
),
-- 4. Contar leads
contador_leads AS (
  SELECT 
    '4. 📊 ESTADÍSTICAS' as seccion,
    'Total leads'::text as dato_1,
    COUNT(*)::text as dato_2,
    ''::text as dato_3,
    ''::text as dato_4
  FROM leads
)

-- Combinar todo
SELECT * FROM mi_sesion
UNION ALL
SELECT * FROM mi_perfil
UNION ALL
SELECT * FROM politica
UNION ALL
SELECT * FROM contador_leads;

-- ====================================================
-- Si la consulta anterior no muestra datos en "MI PERFIL":
-- Ejecuta esto por separado:
-- ====================================================

-- SELECT auth.uid(), 'Este es tu ID de usuario';

-- SELECT * FROM perfiles WHERE id = auth.uid();

-- Si no devuelve nada, ejecuta:
-- INSERT INTO perfiles (id, email, rol, nombre_completo)
-- VALUES (auth.uid(), 'TU-EMAIL@AQUI.COM', 'admin', 'Tu Nombre');
