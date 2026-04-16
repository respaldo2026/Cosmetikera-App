-- ============================================================
-- SOLUCIÓN RÁPIDA: Permitir crear grupos (cursos) - 2026-02-12
-- ============================================================
-- Ejecutar este script en el SQL Editor de Supabase

-- Eliminar política restrictiva actual
DROP POLICY IF EXISTS "cursos_insert" ON cursos;
DROP POLICY IF EXISTS "cursos_insert_temp" ON cursos;
DROP POLICY IF EXISTS "cursos_insert_final" ON cursos;

-- Crear política que permite a usuarios autenticados crear cursos
CREATE POLICY "cursos_insert_all_auth" ON cursos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Mensaje de confirmación
SELECT '✅ Política actualizada. Ahora puedes crear grupos sin problemas.' as resultado;
