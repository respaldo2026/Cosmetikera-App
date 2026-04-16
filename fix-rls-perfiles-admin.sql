-- ========================================
-- VERIFICAR Y ARREGLAR RLS PARA PERFILES
-- ========================================

-- 1. Ver las políticas actuales de la tabla perfiles
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
WHERE tablename = 'perfiles';

-- 2. Ver si RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'perfiles';

-- 3. SOLUCIÓN TEMPORAL: Deshabilitar RLS en perfiles (solo para pruebas)
-- ⚠️ ADVERTENCIA: Esto permite que cualquiera vea todos los perfiles
-- Solo usar en desarrollo/pruebas
ALTER TABLE perfiles DISABLE ROW LEVEL SECURITY;

-- 4. O crear política permisiva para administradores
-- (Mejor opción si quieres mantener RLS)
DROP POLICY IF EXISTS "admin_puede_ver_todos_perfiles" ON perfiles;
DROP POLICY IF EXISTS "admin_puede_modificar_todos_perfiles" ON perfiles;

CREATE POLICY "admin_puede_ver_todos_perfiles"
ON perfiles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM perfiles
        WHERE perfiles.id = auth.uid()
        AND perfiles.rol = 'admin'
    )
    OR perfiles.id = auth.uid()
);

CREATE POLICY "admin_puede_modificar_todos_perfiles"
ON perfiles FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM perfiles
        WHERE perfiles.id = auth.uid()
        AND perfiles.rol = 'admin'
    )
);

-- 5. Verificar cambios
SELECT 
    '✅ POLÍTICAS ACTUALIZADAS' as resultado,
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'perfiles';
