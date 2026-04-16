-- ================================================================
-- FIX ERRORES DE SEGURIDAD SUPABASE - LINTER
-- Fecha: 2026-02-11
-- ================================================================
-- Este script resuelve los errores reportados por el database linter:
-- 1. Habilitar RLS en tablas que tienen políticas pero RLS deshabilitado
-- 2. Habilitar RLS en tablas públicas sin protección
-- 3. Revisar vistas SECURITY DEFINER (comentadas para revisión manual)
-- ================================================================

-- ================================================================
-- PARTE 1: HABILITAR RLS EN TABLAS CON POLÍTICAS EXISTENTES
-- ================================================================
-- Estas tablas YA TIENEN políticas RLS, solo falta habilitar RLS

-- Limpieza de políticas demasiado permisivas reportadas
DROP POLICY IF EXISTS "acceso_total_asistencias" ON public.asistencias;
DROP POLICY IF EXISTS "acceso_total_desarrollo" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_select" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_select_all" ON public.asistencias;

DROP POLICY IF EXISTS "Acceso Total Inventario" ON public.inventario;
DROP POLICY IF EXISTS "Acceso total inventario" ON public.inventario;
DROP POLICY IF EXISTS "acceso_total_desarrollo" ON public.inventario;

DROP POLICY IF EXISTS "Acceso total movimientos" ON public.movimientos_inventario;

DROP POLICY IF EXISTS "Acceso total nomina" ON public.pagos_nomina;
DROP POLICY IF EXISTS "acceso_total_desarrollo" ON public.pagos_nomina;
DROP POLICY IF EXISTS "pagos_nomina_select" ON public.pagos_nomina;
DROP POLICY IF EXISTS "pagos_nomina_select_all" ON public.pagos_nomina;

DROP POLICY IF EXISTS "Acceso total sesiones" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_select" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_select_all" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_update_prof" ON public.sesiones_clase;

DROP POLICY IF EXISTS "acceso_total_temas" ON public.temas_curso;

ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_nomina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_clase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temas_curso ENABLE ROW LEVEL SECURITY;

-- Reponer políticas esenciales en asistencias y sesiones_clase
-- (este script las elimina arriba; sin recrearlas produce 403 al insertar)
DROP POLICY IF EXISTS "asistencias_select_staff_or_owner" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_insert_staff_or_teacher" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_update_staff_or_teacher" ON public.asistencias;
DROP POLICY IF EXISTS "asistencias_delete_staff_or_teacher" ON public.asistencias;

CREATE POLICY "asistencias_select_staff_or_owner"
ON public.asistencias
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin','administrador','director','desarrollo',
        'secretaria','secretario','administrativo',
        'coordinador','coordinadora','tesoreria','tesorero','caja','cajero'
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
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin','administrador','director','desarrollo',
        'secretaria','secretario','administrativo',
        'coordinador','coordinadora','tesoreria','tesorero','caja','cajero'
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
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin','administrador','director','desarrollo',
        'secretaria','secretario','administrativo',
        'coordinador','coordinadora','tesoreria','tesorero','caja','cajero'
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
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin','administrador','director','desarrollo',
        'secretaria','secretario','administrativo',
        'coordinador','coordinadora','tesoreria','tesorero','caja','cajero'
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
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin','administrador','director','desarrollo',
        'secretaria','secretario','administrativo',
        'coordinador','coordinadora','tesoreria','tesorero','caja','cajero'
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

DROP POLICY IF EXISTS "sesiones_select_staff_or_teacher" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_insert_staff_or_teacher" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_update_staff_or_teacher" ON public.sesiones_clase;
DROP POLICY IF EXISTS "sesiones_delete_staff_or_teacher" ON public.sesiones_clase;

CREATE POLICY "sesiones_select_staff_or_teacher"
ON public.sesiones_clase
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin','administrador','director','desarrollo',
        'secretaria','secretario','administrativo',
        'coordinador','coordinadora','tesoreria','tesorero','caja','cajero'
      )
  )
  OR profesor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.cursos c
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
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin','administrador','director','desarrollo',
        'secretaria','secretario','administrativo',
        'coordinador','coordinadora','tesoreria','tesorero','caja','cajero'
      )
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.cursos c
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
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin','administrador','director','desarrollo',
        'secretaria','secretario','administrativo',
        'coordinador','coordinadora','tesoreria','tesorero','caja','cajero'
      )
  )
  OR profesor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.cursos c
    WHERE c.id = sesiones_clase.curso_id
      AND c.profesor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin','administrador','director','desarrollo',
        'secretaria','secretario','administrativo',
        'coordinador','coordinadora','tesoreria','tesorero','caja','cajero'
      )
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.cursos c
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
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.rol, '')) IN (
        'admin','administrador','director','desarrollo',
        'secretaria','secretario','administrativo',
        'coordinador','coordinadora','tesoreria','tesorero','caja','cajero'
      )
  )
  OR profesor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.cursos c
    WHERE c.id = sesiones_clase.curso_id
      AND c.profesor_id = auth.uid()
  )
);

-- ================================================================
-- PARTE 2: HABILITAR RLS EN TABLAS PÚBLICAS SIN PROTECCIÓN
-- ================================================================
-- Estas tablas están expuestas públicamente sin RLS

-- Marketing y Leads
ALTER TABLE public.marketing_centro ENABLE ROW LEVEL SECURITY;

-- Profesores
ALTER TABLE public.profesores_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_profesores ENABLE ROW LEVEL SECURITY;

-- Clases y Académico
ALTER TABLE public.clases ENABLE ROW LEVEL SECURITY;

-- Permisos y Configuración
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_academia ENABLE ROW LEVEL SECURITY;

-- Agente IA
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_chunks ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- PARTE 3: CREAR POLÍTICAS BÁSICAS PARA TABLAS SIN POLÍTICAS
-- ================================================================
-- Las tablas que solo tenían RLS deshabilitado ya tienen sus políticas.
-- Aquí creamos políticas para las que NO tenían ninguna.

-- -------------------- marketing_centro --------------------
-- Acceso total para administradores y desarrollo
DROP POLICY IF EXISTS "Acceso total marketing" ON public.marketing_centro;
CREATE POLICY "Acceso total marketing"
ON public.marketing_centro
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director')
  )
);

-- -------------------- profesores_info --------------------
-- Profesores pueden ver su propia info, admins todo
DROP POLICY IF EXISTS "Profesores ven su info" ON public.profesores_info;
CREATE POLICY "Profesores ven su info"
ON public.profesores_info
FOR SELECT
TO authenticated
USING (
  auth.uid() = perfil_id
  OR auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director')
  )
);

DROP POLICY IF EXISTS "Admins modifican profesores_info" ON public.profesores_info;
CREATE POLICY "Admins modifican profesores_info"
ON public.profesores_info
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director')
  )
);

-- -------------------- clases --------------------
-- Todos pueden ver clases, solo admins las modifican
DROP POLICY IF EXISTS "Ver clases" ON public.clases;
CREATE POLICY "Ver clases"
ON public.clases
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins gestionan clases" ON public.clases;
CREATE POLICY "Admins gestionan clases"
ON public.clases
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director')
  )
);

-- -------------------- pagos_profesores --------------------
-- Profesores ven sus propios pagos, admins todo
DROP POLICY IF EXISTS "Profesores ven sus pagos" ON public.pagos_profesores;
CREATE POLICY "Profesores ven sus pagos"
ON public.pagos_profesores
FOR SELECT
TO authenticated
USING (
  profesor_id IN (
    SELECT id FROM public.perfiles WHERE id = auth.uid()
  )
  OR auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director')
  )
);

DROP POLICY IF EXISTS "Admins gestionan pagos profesores" ON public.pagos_profesores;
CREATE POLICY "Admins gestionan pagos profesores"
ON public.pagos_profesores
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director')
  )
);

-- -------------------- admin_permissions --------------------
-- Solo desarrollo y administrador pueden ver/modificar permisos
DROP POLICY IF EXISTS "Solo admins ven permisos" ON public.admin_permissions;
CREATE POLICY "Solo admins ven permisos"
ON public.admin_permissions
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador')
  )
);

-- -------------------- lead_state --------------------
-- Acceso total para roles con permisos de marketing
DROP POLICY IF EXISTS "Acceso lead_state" ON public.lead_state;
CREATE POLICY "Acceso lead_state"
ON public.lead_state
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director', 'comunicador')
  )
);

-- -------------------- role_permissions --------------------
-- Solo desarrollo puede ver/modificar permisos de roles
DROP POLICY IF EXISTS "Solo desarrollo ve role_permissions" ON public.role_permissions;
CREATE POLICY "Solo desarrollo ve role_permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol = 'desarrollo'
  )
);

-- -------------------- configuracion_academia --------------------
-- Todos pueden leer, solo admins modifican
DROP POLICY IF EXISTS "Todos leen configuracion" ON public.configuracion_academia;
CREATE POLICY "Todos leen configuracion"
ON public.configuracion_academia
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins insertan configuracion" ON public.configuracion_academia;
CREATE POLICY "Admins insertan configuracion"
ON public.configuracion_academia
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director')
  )
);

DROP POLICY IF EXISTS "Admins actualizan configuracion" ON public.configuracion_academia;
CREATE POLICY "Admins actualizan configuracion"
ON public.configuracion_academia
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director')
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director')
  )
);

DROP POLICY IF EXISTS "Admins eliminan configuracion" ON public.configuracion_academia;
CREATE POLICY "Admins eliminan configuracion"
ON public.configuracion_academia
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador', 'director')
  )
);

-- -------------------- agent_settings --------------------
-- Solo desarrollo y administrador pueden gestionar el agente IA
DROP POLICY IF EXISTS "Admins gestionan agent_settings" ON public.agent_settings;
CREATE POLICY "Admins gestionan agent_settings"
ON public.agent_settings
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador')
  )
);

-- -------------------- agent_documents --------------------
DROP POLICY IF EXISTS "Admins gestionan agent_documents" ON public.agent_documents;
CREATE POLICY "Admins gestionan agent_documents"
ON public.agent_documents
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador')
  )
);

-- -------------------- agent_chunks --------------------
DROP POLICY IF EXISTS "Admins gestionan agent_chunks" ON public.agent_chunks;
CREATE POLICY "Admins gestionan agent_chunks"
ON public.agent_chunks
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.perfiles WHERE rol IN ('desarrollo', 'administrador')
  )
);

-- ================================================================
-- PARTE 4: REVISIÓN DE VISTAS SECURITY DEFINER
-- ================================================================
-- Las siguientes vistas usan SECURITY DEFINER, lo cual puede ser intencional
-- para bypassear RLS y dar acceso a datos agregados.
-- 
-- RECOMENDACIÓN: Revisar cada vista y determinar si SECURITY DEFINER es necesario.
-- Si NO es necesario, recrear la vista sin esa opción.
-- 
-- Vistas afectadas:
-- - vw_knowledge_base_completa
-- - v_pensum_completo
-- - vista_estado_cuotas
-- - vw_whatsapp_leads_activos
-- - v_entregas_materiales_completa
-- - vw_whatsapp_stats_diarias
-- - v_grupos_con_pensum
-- - v_material_completo
-- - vw_movimientos_saldos_diarios
-- - vw_cursos_para_ia
-- - vw_whatsapp_usuarios_activos
--
-- Para cambiar una vista de SECURITY DEFINER a SECURITY INVOKER:
-- 
-- ALTER VIEW nombre_vista SET (security_invoker = on);
-- 
-- O recrear la vista agregando "WITH (security_invoker = on)" en la definición.
-- 
-- NOTA: Solo hacer esto si la vista NO necesita permisos elevados.

-- ================================================================
-- VERIFICACIÓN FINAL
-- ================================================================

-- Ver todas las tablas con RLS habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'marketing_centro', 'profesores_info', 'clases', 'asistencias',
    'inventario', 'temas_curso', 'pagos_nomina', 'sesiones_clase',
    'movimientos_inventario', 'admin_permissions', 'lead_state',
    'role_permissions', 'pagos_profesores', 'agent_settings',
    'agent_documents', 'agent_chunks', 'configuracion_academia'
  )
ORDER BY tablename;

-- Ver columnas de tablas relevantes (para no adivinar nombres)
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'marketing_centro', 'profesores_info', 'clases', 'asistencias',
    'inventario', 'temas_curso', 'pagos_nomina', 'sesiones_clase',
    'movimientos_inventario', 'admin_permissions', 'lead_state',
    'role_permissions', 'pagos_profesores', 'agent_settings',
    'agent_documents', 'agent_chunks', 'configuracion_academia',
    'perfiles'
  )
ORDER BY table_name, ordinal_position;

-- Ver políticas por tabla
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'marketing_centro', 'profesores_info', 'clases', 'asistencias',
    'inventario', 'temas_curso', 'pagos_nomina', 'sesiones_clase',
    'movimientos_inventario', 'admin_permissions', 'lead_state',
    'role_permissions', 'pagos_profesores', 'agent_settings',
    'agent_documents', 'agent_chunks', 'configuracion_academia'
  )
ORDER BY tablename, policyname;

-- ================================================================
-- NOTAS IMPORTANTES
-- ================================================================
-- 
-- 1. Este script habilita RLS en todas las tablas reportadas.
-- 
-- 2. Las políticas creadas son BÁSICAS y restrictivas. Ajusta según necesidades.
-- 
-- 3. Las vistas SECURITY DEFINER NO se modifican automáticamente porque
--    pueden ser intencionales para dar acceso a datos agregados.
--    Revisa cada una manualmente.
-- 
-- 4. Después de ejecutar este script, PRUEBA el acceso desde la aplicación
--    con diferentes roles para asegurar que todo funciona correctamente.
-- 
-- 5. Si alguna funcionalidad deja de funcionar, es probable que necesites
--    ajustar las políticas RLS para ese caso específico.
-- 
-- ================================================================
