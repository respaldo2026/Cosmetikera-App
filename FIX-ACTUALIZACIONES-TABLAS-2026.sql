-- ====================================================
-- FIX COMPLETO: PERMITIR ACTUALIZACIONES EN TABLAS
-- ====================================================
-- Problema: Los cambios no se guardan en Vercel
-- Causa: RLS policies insuficientes para UPDATE
-- Solución: Crear políticas UPDATE correctas
-- ====================================================

-- IMPORTANTE: Ejecutar en Supabase SQL Editor como admin

-- ====================================================
-- PASO 1: TABLA PERFILES (estudiantes, profesores)
-- ====================================================
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON perfiles;
DROP POLICY IF EXISTS "Users can view own profile" ON perfiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON perfiles;
DROP POLICY IF EXISTS "Only admins can insert" ON perfiles;
DROP POLICY IF EXISTS "perfiles_select" ON perfiles;
DROP POLICY IF EXISTS "perfiles_update" ON perfiles;
DROP POLICY IF EXISTS "perfiles_insert" ON perfiles;
DROP POLICY IF EXISTS "perfiles_delete" ON perfiles;

-- NUEVAS POLÍTICAS (permiten UPDATE)
-- SELECT: Ver propio perfil + admin/director/administrativo (via JWT) ven todo
CREATE POLICY "perfiles_select" ON perfiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- UPDATE: Actualizar propio perfil + admin/director/administrativo (via JWT) actualiza todo
CREATE POLICY "perfiles_update" ON perfiles
  FOR UPDATE
  USING (
    auth.uid() = id
    OR coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  )
  WITH CHECK (
    auth.uid() = id
    OR coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- INSERT: Solo admin/director/administrativo (via JWT) puede crear nuevos perfiles
CREATE POLICY "perfiles_insert" ON perfiles
  FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- DELETE: Solo admin/director (via JWT) puede eliminar
CREATE POLICY "perfiles_delete" ON perfiles
  FOR DELETE
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director')
  );

-- ====================================================
-- PASO 2: TABLA CURSOS (grupos)
-- ====================================================
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON cursos;
DROP POLICY IF EXISTS "Everyone views active courses" ON cursos;
DROP POLICY IF EXISTS "Professors view own courses" ON cursos;
DROP POLICY IF EXISTS "Admins view all courses" ON cursos;
DROP POLICY IF EXISTS "cursos_select" ON cursos;
DROP POLICY IF EXISTS "cursos_update" ON cursos;
DROP POLICY IF EXISTS "cursos_insert" ON cursos;
DROP POLICY IF EXISTS "cursos_delete" ON cursos;

-- SELECT: Ver cursos activos + profesor ve sus cursos + admin ve todo
CREATE POLICY "cursos_select" ON cursos
  FOR SELECT
  USING (
    estado IN ('activo', 'proximo')
    OR profesor_id = auth.uid()
    OR coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- UPDATE: Profesor actualiza sus cursos + admin actualiza todo
CREATE POLICY "cursos_update" ON cursos
  FOR UPDATE
  USING (
    profesor_id = auth.uid()
    OR coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  )
  WITH CHECK (
    profesor_id = auth.uid()
    OR coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- INSERT: Solo admin puede crear cursos
CREATE POLICY "cursos_insert" ON cursos
  FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- DELETE: Solo admin puede eliminar
CREATE POLICY "cursos_delete" ON cursos
  FOR DELETE
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director')
  );

-- ====================================================
-- PASO 3: TABLA MATRICULAS
-- ====================================================
ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON matriculas;
DROP POLICY IF EXISTS "Students view own enrollments" ON matriculas;
DROP POLICY IF EXISTS "Professors view their courses" ON matriculas;
DROP POLICY IF EXISTS "Admins view all" ON matriculas;
DROP POLICY IF EXISTS "matriculas_select" ON matriculas;
DROP POLICY IF EXISTS "matriculas_update" ON matriculas;
DROP POLICY IF EXISTS "matriculas_insert" ON matriculas;
DROP POLICY IF EXISTS "matriculas_delete" ON matriculas;

-- SELECT: Estudiante ve sus matrículas + profesor ve sus estudiantes + admin ve todo
CREATE POLICY "matriculas_select" ON matriculas
  FOR SELECT
  USING (
    estudiante_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM cursos c 
      WHERE c.id = matriculas.curso_id 
      AND c.profesor_id = auth.uid()
    )
    OR coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- UPDATE: Profesor/admin actualiza matrículas de sus estudiantes
CREATE POLICY "matriculas_update" ON matriculas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cursos c 
      WHERE c.id = matriculas.curso_id 
      AND c.profesor_id = auth.uid()
    )
    OR coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cursos c 
      WHERE c.id = matriculas.curso_id 
      AND c.profesor_id = auth.uid()
    )
    OR coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- INSERT: Admin puede crear matrículas
CREATE POLICY "matriculas_insert" ON matriculas
  FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- DELETE: Admin puede eliminar
CREATE POLICY "matriculas_delete" ON matriculas
  FOR DELETE
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director')
  );

-- ====================================================
-- PASO 4: TABLA LEADS
-- ====================================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON leads;
DROP POLICY IF EXISTS "leads_select" ON leads;
DROP POLICY IF EXISTS "leads_update" ON leads;
DROP POLICY IF EXISTS "leads_insert" ON leads;
DROP POLICY IF EXISTS "leads_delete" ON leads;

-- Solo admin/administrativo/director pueden ver/editar leads
CREATE POLICY "leads_select" ON leads
  FOR SELECT
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

CREATE POLICY "leads_update" ON leads
  FOR UPDATE
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  )
  WITH CHECK (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

CREATE POLICY "leads_insert" ON leads
  FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

CREATE POLICY "leads_delete" ON leads
  FOR DELETE
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director')
  );

-- ====================================================
-- PASO 5: TABLA CONFIGURACION
-- ====================================================
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON configuracion;
DROP POLICY IF EXISTS "configuracion_select" ON configuracion;
DROP POLICY IF EXISTS "configuracion_update" ON configuracion;
DROP POLICY IF EXISTS "configuracion_insert" ON configuracion;
DROP POLICY IF EXISTS "configuracion_delete" ON configuracion;

-- Solo admin puede ver/editar configuración
CREATE POLICY "configuracion_select" ON configuracion
  FOR SELECT
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director')
  );

CREATE POLICY "configuracion_update" ON configuracion
  FOR UPDATE
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director')
  )
  WITH CHECK (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director')
  );

CREATE POLICY "configuracion_insert" ON configuracion
  FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director')
  );

CREATE POLICY "configuracion_delete" ON configuracion
  FOR DELETE
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director')
  );

-- ====================================================
-- PASO 6: TABLA PAGOS (mantener RLS existente pero mejorar)
-- ====================================================
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Verificar políticas existentes y agregar UPDATE si falta
DROP POLICY IF EXISTS "Personal ve todos los pagos" ON pagos;
DROP POLICY IF EXISTS "Acceso total a pagos para usuarios autenticados" ON pagos;
DROP POLICY IF EXISTS "pagos_update" ON pagos;

-- SELECT: Estudiantes ven sus pagos, admin ve todo
DROP POLICY IF EXISTS "pagos_select_estudiante" ON pagos;
CREATE POLICY "pagos_select_estudiante" ON pagos
  FOR SELECT
  USING (
    estudiante_id = auth.uid()
  );

DROP POLICY IF EXISTS "pagos_select_admin" ON pagos;
CREATE POLICY "pagos_select_admin" ON pagos
  FOR SELECT
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- UPDATE: Solo admin puede actualizar pagos
CREATE POLICY "pagos_update" ON pagos
  FOR UPDATE
  USING (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  )
  WITH CHECK (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- INSERT: Solo admin puede crear pagos
DROP POLICY IF EXISTS "pagos_insert" ON pagos;
CREATE POLICY "pagos_insert" ON pagos
  FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt()->'app_metadata'->>'rol', auth.jwt()->>'rol', auth.jwt()->>'role') IN ('admin', 'director', 'administrativo')
  );

-- ====================================================
-- VERIFICACIÓN FINAL
-- ====================================================
SELECT 
  tablename,
  COUNT(*) as numero_policies
FROM pg_policies
WHERE tablename IN ('perfiles', 'cursos', 'matriculas', 'leads', 'configuracion', 'pagos')
GROUP BY tablename
ORDER BY tablename;

-- Mensaje de confirmación
SELECT 'FIX COMPLETADO ✅' as estado, 
       'Las políticas RLS ahora permiten UPDATE' as descripcion,
       'Prueba editar un estudiante en Vercel' as siguiente_paso;
