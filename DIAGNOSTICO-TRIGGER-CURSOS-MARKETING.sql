-- ====================================================
-- DIAGNÓSTICO: Trigger/función que toca marketing_centro al editar cursos
-- ====================================================

-- Triggers en tabla cursos
SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name,
  pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'cursos'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- Funciones que mencionan marketing_centro
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%marketing_centro%'
ORDER BY p.proname;
