-- ============================================================
-- SOLUCIÓN INMEDIATA: Deshabilitar RLS temporalmente
-- ============================================================
-- Ejecuta esto en SQL Editor de Supabase AHORA

-- Deshabilitar RLS en la tabla cursos
ALTER TABLE cursos DISABLE ROW LEVEL SECURITY;

-- Verificar que se deshabilitó
SELECT 
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity = false THEN '✅ RLS deshabilitado - Ahora puedes crear grupos'
    ELSE '❌ RLS aún habilitado'
  END as estado
FROM pg_tables
WHERE tablename = 'cursos';
