-- ================================================================
-- HOTFIX RLS: ASISTENCIAS + HORAS (sesiones_clase) + CALIFICACIONES
-- Problema: 403 "new row violates row-level security policy"
-- Objetivo: permitir que ADMINISTRACIÓN y PROFESOR del curso puedan
--           registrar asistencias y horas dictadas.
-- ================================================================

-- 1) Asegurar RLS habilitado
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_clase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;

-- 2) Limpiar políticas previas para evitar conflictos
DROP POLICY IF EXISTS "acceso_total_asistencias" ON public.asistencias;
DROP POLICY IF EXISTS "acceso_total_desarrollo" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_select" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_select_all" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_select_staff_or_owner" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_insert_staff_or_teacher" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_update_staff_or_teacher" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_delete_staff_or_teacher" ON public.asistencias;

DROP POLICY IF EXISTS "Acceso total sesiones" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_select" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_select_all" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_update_prof" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_select_staff_or_teacher" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_insert_staff_or_teacher" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_update_staff_or_teacher" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_delete_staff_or_teacher" ON public.sesiones_clase;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.calificaciones;
DROP POLICY IF EXISTS "Estudiantes ven sus calificaciones" ON public.calificaciones;
DROP POLICY IF EXISTS "Profesores gestionan notas" ON public.calificaciones;
DROP POLICY IF EXISTS "calificaciones_select_staff_or_owner" ON public.calificaciones;
DROP POLICY IF EXISTS "calificaciones_insert_staff_or_teacher" ON public.calificaciones;
DROP POLICY IF EXISTS "calificaciones_update_staff_or_teacher" ON public.calificaciones;
DROP POLICY IF EXISTS "calificaciones_delete_staff_or_teacher" ON public.calificaciones;

-- ================================================================
-- 3) POLÍTICAS: ASISTENCIAS
-- ================================================================

CREATE POLICY "asistencias_select_staff_or_owner"
ON public.asistencias
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.cursos c ON c.id = m.curso_id
    WHERE m.id = asistencias.matricula_id
      AND c.profesor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    WHERE m.id = asistencias.matricula_id
      AND m.estudiante_id = auth.uid()
  )
);

CREATE POLICY "asistencias_insert_staff_or_teacher"
ON public.asistencias
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.cursos c ON c.id = m.curso_id
    WHERE m.id = asistencias.matricula_id
      AND c.profesor_id = auth.uid()
  )
);

CREATE POLICY "asistencias_update_staff_or_teacher"
ON public.asistencias
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.cursos c ON c.id = m.curso_id
    WHERE m.id = asistencias.matricula_id
      AND c.profesor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.cursos c ON c.id = m.curso_id
    WHERE m.id = asistencias.matricula_id
      AND c.profesor_id = auth.uid()
  )
);

CREATE POLICY "asistencias_delete_staff_or_teacher"
ON public.asistencias
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.cursos c ON c.id = m.curso_id
    WHERE m.id = asistencias.matricula_id
      AND c.profesor_id = auth.uid()
  )
);

-- ================================================================
-- 4) POLÍTICAS: SESIONES_CLASE (horas dictadas)
-- ================================================================

CREATE POLICY "sesiones_select_staff_or_teacher"
ON public.sesiones_clase
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR profesor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.cursos c
    WHERE c.id = sesiones_clase.curso_id
      AND c.profesor_id = auth.uid()
  )
);

CREATE POLICY "sesiones_insert_staff_or_teacher"
ON public.sesiones_clase
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR (
    EXISTS (
      SELECT 1
      FROM public.cursos c
      WHERE c.id = sesiones_clase.curso_id
        AND c.profesor_id = auth.uid()
    )
    AND (sesiones_clase.profesor_id IS NULL OR sesiones_clase.profesor_id = auth.uid())
  )
);

CREATE POLICY "sesiones_update_staff_or_teacher"
ON public.sesiones_clase
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR profesor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.cursos c
    WHERE c.id = sesiones_clase.curso_id
      AND c.profesor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR (
    EXISTS (
      SELECT 1
      FROM public.cursos c
      WHERE c.id = sesiones_clase.curso_id
        AND c.profesor_id = auth.uid()
    )
    AND (sesiones_clase.profesor_id IS NULL OR sesiones_clase.profesor_id = auth.uid())
  )
);

CREATE POLICY "sesiones_delete_staff_or_teacher"
ON public.sesiones_clase
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR profesor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.cursos c
    WHERE c.id = sesiones_clase.curso_id
      AND c.profesor_id = auth.uid()
  )
);

-- ================================================================
-- 5) POLÍTICAS: CALIFICACIONES (notas)
-- ================================================================

CREATE POLICY "calificaciones_select_staff_or_owner"
ON public.calificaciones
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.cursos c ON c.id = m.curso_id
    WHERE m.id = calificaciones.matricula_id
      AND c.profesor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    WHERE m.id = calificaciones.matricula_id
      AND m.estudiante_id = auth.uid()
  )
);

CREATE POLICY "calificaciones_insert_staff_or_teacher"
ON public.calificaciones
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.cursos c ON c.id = m.curso_id
    WHERE m.id = calificaciones.matricula_id
      AND c.profesor_id = auth.uid()
  )
);

CREATE POLICY "calificaciones_update_staff_or_teacher"
ON public.calificaciones
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.cursos c ON c.id = m.curso_id
    WHERE m.id = calificaciones.matricula_id
      AND c.profesor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.cursos c ON c.id = m.curso_id
    WHERE m.id = calificaciones.matricula_id
      AND c.profesor_id = auth.uid()
  )
);

CREATE POLICY "calificaciones_delete_staff_or_teacher"
ON public.calificaciones
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin', 'administrador', 'director', 'desarrollo',
        'secretaria', 'secretario', 'administrativo',
        'coordinador', 'coordinadora',
        'tesoreria', 'tesorero', 'caja', 'cajero'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.cursos c ON c.id = m.curso_id
    WHERE m.id = calificaciones.matricula_id
      AND c.profesor_id = auth.uid()
  )
);

-- 6) Verificación rápida
SELECT 'asistencias' AS tabla, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'asistencias'
UNION ALL
SELECT 'sesiones_clase' AS tabla, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'sesiones_clase'
UNION ALL
SELECT 'calificaciones' AS tabla, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'calificaciones'
ORDER BY tabla, policyname, cmd;
