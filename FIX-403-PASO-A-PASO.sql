-- ============================================================
-- PASO A PASO: Solucionar error 403 en cursos
-- ============================================================

-- PASO 1: Verificar estado actual
SELECT 
  tablename,
  rowsecurity as rls_activado
FROM pg_tables
WHERE tablename = 'cursos';

-- PASO 2: Deshabilitar RLS completamente
ALTER TABLE cursos DISABLE ROW LEVEL SECURITY;

-- PASO 3: Verificar que se deshabilitó
SELECT 
  tablename,
  rowsecurity as rls_activado,
  CASE 
    WHEN rowsecurity = false THEN '✅ LISTO - Ahora recarga tu app (Ctrl+Shift+R)'
    ELSE '❌ AÚN ACTIVADO - Ejecuta el script completo de nuevo'
  END as estado
FROM pg_tables
WHERE tablename = 'cursos';

-- RESULTADO ESPERADO: rowsecurity = false
-- Si ves "true", ejecuta todo el script de nuevo
