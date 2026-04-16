-- ====================================================
-- VERIFICACIÓN RÁPIDA: Estado actual de RLS policies
-- ====================================================
-- Ejecuta esto para ver si el problema existe
-- ====================================================

-- 1️⃣ VER TODAS LAS POLÍTICAS ACTUALES
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles::text,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN (
  'perfiles', 
  'cursos', 
  'matriculas', 
  'leads', 
  'configuracion', 
  'pagos'
)
ORDER BY tablename, policyname;

-- 2️⃣ VERIFICACIÓN: ¿Tiene WITH CHECK para UPDATE?
-- Esto muestra si falta WITH CHECK (el problema principal)
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN cmd = 'UPDATE' AND with_check IS NULL THEN '❌ PROBLEMA: UPDATE sin WITH CHECK'
    WHEN cmd = 'UPDATE' AND with_check IS NOT NULL THEN '✅ OK: UPDATE con WITH CHECK'
    WHEN cmd IN ('SELECT', 'INSERT', 'DELETE') THEN '⚪ ' || cmd || ' (no necesita WITH CHECK)'
    ELSE '❓ Desconocido'
  END as status
FROM pg_policies
WHERE tablename IN (
  'perfiles', 
  'cursos', 
  'matriculas', 
  'leads', 
  'configuracion', 
  'pagos'
)
ORDER BY tablename, cmd;

-- 3️⃣ CONTAR POLÍTICAS POR TABLA
SELECT 
  tablename,
  COUNT(*) as total_policies,
  COUNTIF(cmd = 'SELECT') as select_policies,
  COUNTIF(cmd = 'UPDATE') as update_policies,
  COUNTIF(cmd = 'INSERT') as insert_policies,
  COUNTIF(cmd = 'DELETE') as delete_policies,
  CASE 
    WHEN COUNT(*) < 2 THEN '⚠️ Pocas políticas'
    WHEN COUNT(*) >= 4 THEN '✅ Bien configurado'
    ELSE '⚪ Moderado'
  END as recomendacion
FROM pg_policies
WHERE tablename IN (
  'perfiles', 
  'cursos', 
  'matriculas', 
  'leads', 
  'configuracion', 
  'pagos'
)
GROUP BY tablename
ORDER BY tablename;

-- 4️⃣ ESTADO DE RLS EN CADA TABLA
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_class
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE schemaname = 'public'
  AND tablename IN (
    'perfiles', 
    'cursos', 
    'matriculas', 
    'leads', 
    'configuracion', 
    'pagos'
  )
ORDER BY tablename;

-- 5️⃣ BÚSQUEDA: Políticas con "Enable all access" (las problemáticas)
SELECT 
  tablename,
  policyname,
  '⚠️ POLÍTICA PROBLEMÁTICA' as tipo
FROM pg_policies
WHERE policyname ILIKE '%enable%'
  OR policyname ILIKE '%all access%'
  OR qual = 'true'
ORDER BY tablename;

-- 6️⃣ RESUMEN EJECUTIVO
SELECT 
  '✅ VERIFICACIÓN COMPLETADA' as status,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('perfiles','cursos','matriculas','leads','configuracion','pagos')) as total_policies,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename IN ('perfiles','cursos','matriculas','leads','configuracion','pagos')
      AND cmd = 'UPDATE' 
      AND with_check IS NULL
    ) THEN '❌ PROBLEMA: Algunas UPDATE sin WITH CHECK'
    ELSE '✅ CORRECTO: Todas las UPDATE tienen WITH CHECK'
  END as diagnostico;

-- ====================================================
-- INTERPRETACIÓN DE RESULTADOS
-- ====================================================
-- Si ves "❌ PROBLEMA":
--   → Ejecuta: FIX-ACTUALIZACIONES-TABLAS-2026.sql
--
-- Si ves "✅ CORRECTO":
--   → El problema es otro, contacta soporte
--   → Revisa logs de Supabase (Realtime)
--   → Verifica console del navegador (F12)
--
-- Si hay error ejecutando esto:
--   → El usuario actual no tiene permisos de lectura
--   → Loguéate como Admin en Supabase
--   → Intenta de nuevo
-- ====================================================
