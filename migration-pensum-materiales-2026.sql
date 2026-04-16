-- =====================================================
-- SISTEMA DE PENSUM Y MATERIAL DIDÁCTICO
-- Permite crear pensum por ciclo en programas y subir materiales
-- =====================================================

-- 1️⃣ TABLA PENSUM (Plan de estudios por ciclo)
CREATE TABLE IF NOT EXISTS public.pensum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id INTEGER NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
  numero_ciclo INTEGER NOT NULL, -- 1, 2, 3, etc.
  nombre_ciclo VARCHAR(100), -- "Ciclo 1", "Fase Inicial", etc.
  descripcion TEXT,
  
  -- Duración y carga académica
  duracion_semanas INTEGER, -- Duración del ciclo en semanas
  total_horas INTEGER, -- Total de horas del ciclo
  
  -- Orden y estado
  orden INTEGER, -- Para mantener orden de ciclos
  activo BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint para evitar duplicados
  UNIQUE(programa_id, numero_ciclo)
);

-- 2️⃣ TABLA PENSUM_CURSOS (Cursos que pertenecen a cada ciclo del pensum)
CREATE TABLE IF NOT EXISTS public.pensum_cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pensum_id UUID NOT NULL REFERENCES public.pensum(id) ON DELETE CASCADE,
  curso_id INTEGER REFERENCES public.cursos(id) ON DELETE SET NULL,
  
  -- Información del curso en este ciclo (opcional si el curso no existe aún)
  nombre_curso VARCHAR(255) NOT NULL,
  descripcion TEXT,
  horas INTEGER, -- Horas de este curso en el pensum
  creditos INTEGER, -- Créditos académicos
  tipo_curso VARCHAR(50), -- "obligatorio", "electivo", "complementario"
  
  -- Orden en el pensum
  orden INTEGER,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3️⃣ TABLA MATERIAL_DIDACTICO (Material de apoyo para programas)
CREATE TABLE IF NOT EXISTS public.material_didactico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id INTEGER NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
  pensum_id UUID REFERENCES public.pensum(id) ON DELETE CASCADE, -- Opcional: asociado a un ciclo específico
  
  -- Información del material
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo_material VARCHAR(50) NOT NULL, -- "documento", "video", "imagen", "presentacion", "recurso", "otro"
  
  -- Almacenamiento del archivo
  nombre_archivo VARCHAR(255) NOT NULL,
  url_archivo TEXT NOT NULL, -- URL pública en Supabase Storage
  tamano_bytes INTEGER, -- Tamaño en bytes
  mime_type VARCHAR(100), -- "application/pdf", "video/mp4", etc.
  
  -- Control de acceso
  visible BOOLEAN DEFAULT true,
  orden INTEGER, -- Para ordenar la visualización
  
  -- Quién lo subió
  subido_por UUID REFERENCES public.perfiles(id),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4️⃣ TABLA GRUPO_PENSUM (Asociación entre grupos y pensum)
CREATE TABLE IF NOT EXISTS public.grupo_pensum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id INTEGER NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  pensum_id UUID NOT NULL REFERENCES public.pensum(id) ON DELETE CASCADE,
  
  -- Timestamp
  asignado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Para registrar quién lo asignó
  asignado_por UUID REFERENCES public.perfiles(id),
  
  UNIQUE(grupo_id, pensum_id)
);

-- ========================================
-- ÍNDICES PARA MEJORAR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_pensum_programa ON public.pensum(programa_id);
CREATE INDEX IF NOT EXISTS idx_pensum_numero_ciclo ON public.pensum(numero_ciclo);
CREATE INDEX IF NOT EXISTS idx_pensum_cursos_pensum ON public.pensum_cursos(pensum_id);
CREATE INDEX IF NOT EXISTS idx_pensum_cursos_curso ON public.pensum_cursos(curso_id);
CREATE INDEX IF NOT EXISTS idx_material_programa ON public.material_didactico(programa_id);
CREATE INDEX IF NOT EXISTS idx_material_pensum ON public.material_didactico(pensum_id);
CREATE INDEX IF NOT EXISTS idx_material_tipo ON public.material_didactico(tipo_material);
CREATE INDEX IF NOT EXISTS idx_grupo_pensum_grupo ON public.grupo_pensum(grupo_id);
CREATE INDEX IF NOT EXISTS idx_grupo_pensum_pensum ON public.grupo_pensum(pensum_id);

-- ========================================
-- RLS (Row Level Security)
-- ========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.pensum ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pensum_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_didactico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_pensum ENABLE ROW LEVEL SECURITY;

-- PENSUM: Todos pueden ver, solo admins pueden crear/editar
CREATE POLICY "Todos pueden ver pensum" ON public.pensum
  FOR SELECT USING (true);

CREATE POLICY "Admins pueden crear pensum" ON public.pensum
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

CREATE POLICY "Admins pueden editar pensum" ON public.pensum
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

CREATE POLICY "Admins pueden eliminar pensum" ON public.pensum
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

-- PENSUM_CURSOS: Todos pueden ver, solo admins pueden modificar
CREATE POLICY "Todos pueden ver pensum_cursos" ON public.pensum_cursos
  FOR SELECT USING (true);

CREATE POLICY "Admins pueden modificar pensum_cursos" ON public.pensum_cursos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

CREATE POLICY "Admins pueden actualizar pensum_cursos" ON public.pensum_cursos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

CREATE POLICY "Admins pueden eliminar pensum_cursos" ON public.pensum_cursos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

-- MATERIAL_DIDACTICO: Todos pueden ver visible=true, admins pueden crear/editar
CREATE POLICY "Todos pueden ver material visible" ON public.material_didactico
  FOR SELECT USING (visible OR EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid()
    AND rol IN ('admin', 'administrativo')
  ));

CREATE POLICY "Admins pueden subir material" ON public.material_didactico
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

CREATE POLICY "Admins pueden editar material" ON public.material_didactico
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

CREATE POLICY "Admins pueden eliminar material" ON public.material_didactico
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

-- GRUPO_PENSUM: Todos pueden ver, solo admins pueden modificar
CREATE POLICY "Todos pueden ver grupo_pensum" ON public.grupo_pensum
  FOR SELECT USING (true);

CREATE POLICY "Admins pueden asignar pensum a grupos" ON public.grupo_pensum
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

CREATE POLICY "Admins pueden editar grupo_pensum" ON public.grupo_pensum
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

CREATE POLICY "Admins pueden eliminar grupo_pensum" ON public.grupo_pensum
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

-- ========================================
-- TRIGGERS PARA ACTUALIZAR updated_at
-- ========================================

CREATE OR REPLACE FUNCTION public.update_pensum_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pensum_updated_at
  BEFORE UPDATE ON public.pensum
  FOR EACH ROW
  EXECUTE FUNCTION update_pensum_updated_at();

CREATE OR REPLACE FUNCTION public.update_pensum_cursos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pensum_cursos_updated_at
  BEFORE UPDATE ON public.pensum_cursos
  FOR EACH ROW
  EXECUTE FUNCTION update_pensum_cursos_updated_at();

CREATE OR REPLACE FUNCTION public.update_material_didactico_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_material_didactico_updated_at
  BEFORE UPDATE ON public.material_didactico
  FOR EACH ROW
  EXECUTE FUNCTION update_material_didactico_updated_at();

-- ========================================
-- VISTAS ÚTILES
-- ========================================

-- Vista: Pensum completo con detalles
CREATE OR REPLACE VIEW public.v_pensum_completo AS
SELECT 
  p.id,
  p.programa_id,
  prog.nombre as programa_nombre,
  p.numero_ciclo,
  p.nombre_ciclo,
  p.descripcion,
  p.duracion_semanas,
  p.total_horas,
  p.activo,
  COUNT(DISTINCT pc.id) as total_cursos,
  COUNT(DISTINCT gp.id) as total_grupos_asignados,
  p.created_at,
  p.updated_at
FROM public.pensum p
LEFT JOIN public.programas prog ON p.programa_id = prog.id
LEFT JOIN public.pensum_cursos pc ON p.id = pc.pensum_id
LEFT JOIN public.grupo_pensum gp ON p.id = gp.pensum_id
GROUP BY p.id, prog.nombre;

-- Vista: Material didáctico con detalles
CREATE OR REPLACE VIEW public.v_material_completo AS
SELECT 
  md.id,
  md.programa_id,
  prog.nombre as programa_nombre,
  md.pensum_id,
  p.nombre_ciclo,
  md.titulo,
  md.descripcion,
  md.tipo_material,
  md.nombre_archivo,
  md.tamano_bytes,
  md.mime_type,
  md.visible,
  prof.nombre_completo as subido_por_nombre,
  md.created_at,
  md.updated_at
FROM public.material_didactico md
LEFT JOIN public.programas prog ON md.programa_id = prog.id
LEFT JOIN public.pensum p ON md.pensum_id = p.id
LEFT JOIN public.perfiles prof ON md.subido_por = prof.id;

-- Vista: Grupos con su pensum asignado
CREATE OR REPLACE VIEW public.v_grupos_con_pensum AS
SELECT 
  c.id as grupo_id,
  c.nombre as grupo_nombre,
  c.programa_id,
  prog.nombre as programa_nombre,
  gp.pensum_id,
  p.numero_ciclo,
  p.nombre_ciclo,
  c.estado,
  c.fecha_inicio,
  c.fecha_fin,
  gp.asignado_en
FROM public.cursos c
LEFT JOIN public.programas prog ON c.programa_id = prog.id
LEFT JOIN public.grupo_pensum gp ON c.id = gp.grupo_id
LEFT JOIN public.pensum p ON gp.pensum_id = p.id;

-- ========================================
-- FUNCIÓN: Copiar pensum a un grupo
-- ========================================

CREATE OR REPLACE FUNCTION public.asignar_pensum_a_grupo(
  p_grupo_id INTEGER,
  p_pensum_id UUID
)
RETURNS TABLE(
  exito BOOLEAN,
  mensaje VARCHAR
) AS $$
DECLARE
  v_grupo RECORD;
  v_pensum RECORD;
BEGIN
  -- Validar que el grupo existe
  SELECT * INTO v_grupo FROM public.cursos WHERE id = p_grupo_id;
  IF v_grupo IS NULL THEN
    RETURN QUERY SELECT false, 'Grupo no encontrado'::VARCHAR;
    RETURN;
  END IF;

  -- Validar que el pensum existe
  SELECT * INTO v_pensum FROM public.pensum WHERE id = p_pensum_id;
  IF v_pensum IS NULL THEN
    RETURN QUERY SELECT false, 'Pensum no encontrado'::VARCHAR;
    RETURN;
  END IF;

  -- Validar que son del mismo programa
  IF v_grupo.programa_id != v_pensum.programa_id THEN
    RETURN QUERY SELECT false, 'El pensum debe ser del mismo programa que el grupo'::VARCHAR;
    RETURN;
  END IF;

  -- Asignar pensum al grupo
  BEGIN
    INSERT INTO public.grupo_pensum (grupo_id, pensum_id, asignado_por)
    VALUES (p_grupo_id, p_pensum_id, auth.uid())
    ON CONFLICT (grupo_id, pensum_id) DO NOTHING;

    RETURN QUERY SELECT true, 'Pensum asignado correctamente al grupo'::VARCHAR;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, 'Error al asignar pensum: '::VARCHAR || SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCIÓN: Obtener cursos de un pensum
-- ========================================

CREATE OR REPLACE FUNCTION public.obtener_cursos_pensum(p_pensum_id UUID)
RETURNS TABLE(
  id UUID,
  nombre_curso VARCHAR,
  descripcion TEXT,
  horas INTEGER,
  creditos INTEGER,
  tipo_curso VARCHAR,
  orden INTEGER,
  curso_id INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.nombre_curso,
    pc.descripcion,
    pc.horas,
    pc.creditos,
    pc.tipo_curso,
    pc.orden,
    pc.curso_id
  FROM public.pensum_cursos pc
  WHERE pc.pensum_id = p_pensum_id
  ORDER BY pc.orden ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCIÓN: Obtener materiales de un programa
-- ========================================

CREATE OR REPLACE FUNCTION public.obtener_materiales_programa(p_programa_id INTEGER)
RETURNS TABLE(
  id UUID,
  titulo VARCHAR,
  descripcion TEXT,
  tipo_material VARCHAR,
  nombre_archivo VARCHAR,
  url_archivo TEXT,
  pensum_id UUID,
  nombre_ciclo VARCHAR,
  subido_por_nombre VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    md.id,
    md.titulo,
    md.descripcion,
    md.tipo_material,
    md.nombre_archivo,
    md.url_archivo,
    md.pensum_id,
    p.nombre_ciclo,
    prof.nombre_completo,
    md.created_at
  FROM public.material_didactico md
  LEFT JOIN public.pensum p ON md.pensum_id = p.id
  LEFT JOIN public.perfiles prof ON md.subido_por = prof.id
  WHERE md.programa_id = p_programa_id AND md.visible = true
  ORDER BY md.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- VERIFICACIÓN
-- ========================================

SELECT 'Migración de pensum y material didáctico completada ✅' as status;
