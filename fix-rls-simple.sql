-- ================================================
-- FIX URGENTE: LIMPIAR RLS CONFLICTIVO
-- ================================================
-- El problema: hay 4 policies RLS cuando debería haber 1
-- Solución: eliminar TODAS y crear una sola
-- ================================================

-- =============================================
-- PASO 1: DESHABILITAR RLS COMPLETAMENTE
-- =============================================
ALTER TABLE pagos DISABLE ROW LEVEL SECURITY;

-- =============================================
-- PASO 2: ELIMINAR ABSOLUTAMENTE TODAS LAS POLÍTICAS
-- =============================================
-- Eliminar por nombre específico si las conocemos
DROP POLICY IF EXISTS "Estudiantes ven sus pagos" ON pagos;
DROP POLICY IF EXISTS "Personal ve todos los pagos" ON pagos;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON pagos;
DROP POLICY IF EXISTS "Acceso total a pagos para usuarios autenticados" ON pagos;

-- Eliminar cualquier otra policy que pueda existir
-- (ejecutar como último recurso si aún hay policies)
DO $$ 
DECLARE 
    policy_rec RECORD;
BEGIN
    FOR policy_rec IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'pagos'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_rec.policyname || '" ON pagos';
    END LOOP;
END $$;

-- =============================================
-- PASO 3: HABILITAR RLS NUEVAMENTE
-- =============================================
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PASO 4: CREAR UNA ÚNICA POLICY PERMISIVA
-- =============================================
CREATE POLICY "Acceso completo a pagos" ON pagos
FOR ALL 
USING (true)
WITH CHECK (true);

-- =============================================
-- PASO 5: VERIFICAR QUE SOLO HAY 1 POLICY
-- =============================================
SELECT 
    policyname,
    permissive,
    roles
FROM pg_policies
WHERE tablename = 'pagos';

-- Resultado esperado: Solo 1 fila con "Acceso completo a pagos"

-- =============================================
-- PASO 6: VERIFICAR QUE RLS ESTÁ HABILITADO
-- =============================================
SELECT 
    schemaname,
    tablename,
    (
        SELECT rowsecurity 
        FROM pg_class 
        WHERE relname = 'pagos'
    ) AS rls_enabled
FROM pg_tables
WHERE tablename = 'pagos'
AND schemaname = 'public';

-- =============================================
-- PASO 7: VER TODOS LOS PAGOS (VERIFICACIÓN FINAL)
-- =============================================
SELECT 
    COUNT(*) as total_pagos,
    COUNT(CASE WHEN estado = 'pagado' THEN 1 END) as pagados,
    COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
    COUNT(CASE WHEN numero_cuota = 0 THEN 1 END) as pagos_inscripcion
FROM pagos;

-- ================================================
-- FIN DEL FIX RLS
-- ================================================
-- ✅ Todas las políticas conflictivas eliminadas
-- ✅ Una única policy permisiva creada
-- ✅ RLS habilitado correctamente
-- ================================================
