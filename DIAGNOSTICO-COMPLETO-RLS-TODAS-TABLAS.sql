-- ============================================================
-- DIAGNÓSTICO COMPLETO: Verificar RLS en todas las tablas
-- ============================================================
-- Ejecutar en SQL Editor de Supabase

-- 1. Ver tu usuario y rol actual
SELECT 
  auth.uid() as mi_user_id,
  auth.email() as mi_email,
  (SELECT rol FROM perfiles WHERE id = auth.uid()) as mi_rol;

-- 2. Ver todas las tablas con RLS habilitado
SELECT 
  tablename,
  rowsecurity as rls_activado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'cursos', 'matriculas', 'pagos', 'asistencias', 
    'leads', 'configuracion', 'programas', 'perfiles',
    'pagos_nomina', 'cuotas', 'escenarios_rentabilidad'
  )
ORDER BY tablename;

-- 3. Ver políticas INSERT para cada tabla
SELECT 
  tablename,
  policyname,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'INSERT'
  AND tablename IN (
    'cursos', 'matriculas', 'pagos', 'asistencias', 
    'leads', 'configuracion', 'programas'
  )
ORDER BY tablename, policyname;

-- 4. TEST: ¿Qué tablas puedo insertar?
-- Descomenta cada bloque para probar

/*
-- Test CURSOS (ya tiene solución API)
INSERT INTO cursos (nombre, programa_id, cupo_maximo, precio, estado)
VALUES ('TEST', (SELECT id FROM programas LIMIT 1), 20, 0, 'proximo');
DELETE FROM cursos WHERE nombre = 'TEST';
*/

/*
-- Test MATRICULAS
INSERT INTO matriculas (curso_id, estudiante_id, estado)
VALUES (
  (SELECT id FROM cursos LIMIT 1),
  auth.uid(),
  'activo'
);
DELETE FROM matriculas WHERE estudiante_id = auth.uid() AND estado = 'activo';
*/

/*
-- Test PAGOS
INSERT INTO pagos (estudiante_id, monto, metodo_pago, estado)
VALUES (auth.uid(), 100, 'efectivo', 'pendiente');
DELETE FROM pagos WHERE estudiante_id = auth.uid() AND monto = 100;
*/

/*
-- Test LEADS
INSERT INTO leads (nombre, telefono, estado)
VALUES ('Test Lead', '1234567890', 'nuevo');
DELETE FROM leads WHERE nombre = 'Test Lead';
*/

-- 5. Resumen: ¿Cuáles están bloqueadas?
SELECT 
  t.tablename,
  t.rowsecurity as rls_activo,
  COUNT(p.policyname) FILTER (WHERE p.cmd = 'INSERT') as politicas_insert,
  CASE 
    WHEN t.rowsecurity = false THEN '✅ RLS deshabilitado - Sin restricciones'
    WHEN COUNT(p.policyname) FILTER (WHERE p.cmd = 'INSERT') = 0 THEN '❌ BLOQUEADO - Sin políticas INSERT'
    ELSE '⚠️ Con políticas INSERT - Verificar permisos'
  END as estado
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'cursos', 'matriculas', 'pagos', 'asistencias', 
    'leads', 'configuracion', 'programas'
  )
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
