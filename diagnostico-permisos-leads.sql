-- Diagnóstico completo de permisos para secretaria en leads

-- 1. Ver todas las políticas actuales de leads
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'leads'
ORDER BY cmd, policyname;

-- 2. Verificar si RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'leads';

-- 3. Probar INSERT directo (esto debería fallar si las políticas bloquean)
-- NO EJECUTAR ESTA LÍNEA, SOLO ES PARA REFERENCIA
-- INSERT INTO leads (nombre, telefono, canal, estado) VALUES ('Test', '3001234567', 'WhatsApp', 'nuevo');

-- 4. Verificar permisos de tabla
SELECT 
  grantee, 
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'leads';
