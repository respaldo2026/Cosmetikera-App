-- ============================================================================
-- FIX: Row Level Security para bucket 'marketing' en Supabase Storage
-- ============================================================================
-- Problema: Error "new row violates row-level security policy" al subir archivos
-- Solución: Crear políticas que permitan a usuarios autenticados subir archivos
-- ============================================================================

-- 1. Verificar que el bucket existe y es público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'marketing';

-- 2. ELIMINAR políticas existentes que puedan estar causando conflicto
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir archivos" ON storage.objects;
DROP POLICY IF EXISTS "Archivos de marketing son públicos para lectura" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus propios archivos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios archivos" ON storage.objects;
DROP POLICY IF EXISTS "Admins pueden eliminar cualquier archivo de marketing" ON storage.objects;

-- 3. CREAR políticas correctas para el bucket 'marketing'

-- Permitir INSERT (upload) a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden subir archivos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'marketing');

-- Permitir SELECT (download/list) a todos (público)
CREATE POLICY "Archivos de marketing son públicos para lectura"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'marketing');

-- Permitir UPDATE a usuarios autenticados (para sus propios archivos)
CREATE POLICY "Usuarios pueden actualizar sus propios archivos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'marketing' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'marketing' AND auth.uid() = owner);

-- Permitir DELETE a usuarios autenticados (para sus propios archivos)
CREATE POLICY "Usuarios pueden eliminar sus propios archivos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'marketing' AND auth.uid() = owner);

-- Política especial: Admins pueden eliminar cualquier archivo
CREATE POLICY "Admins pueden eliminar cualquier archivo de marketing"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'marketing' 
  AND EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE perfiles.id = auth.uid() 
    AND perfiles.rol = 'admin'
  )
);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Ejecutar esto después de aplicar la migración para verificar:
/*
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
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%marketing%'
ORDER BY policyname;
*/
