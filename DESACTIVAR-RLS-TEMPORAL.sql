-- ====================================================
-- DESACTIVAR RLS TEMPORALMENTE (SOLO PARA TESTING)
-- ====================================================
-- ⚠️ ESTO PERMITE QUE CUALQUIERA ELIMINE LEADS
-- ⚠️ SOLO USA ESTO TEMPORALMENTE
-- ====================================================

ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Verificar
SELECT 
  tablename,
  rowsecurity as rls_habilitado
FROM pg_tables
WHERE tablename = 'leads';

-- ====================================================
-- CUANDO TERMINES DE ELIMINAR, REACTIVA RLS:
-- ====================================================
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
