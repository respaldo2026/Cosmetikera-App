-- =====================================================
-- SISTEMA DE ENTREGA DE MATERIALES (Camisetas y Kits)
-- Ejecuta esto en Supabase SQL Editor
-- =====================================================

-- 1️⃣ CREAR TABLA para registrar entregas
CREATE TABLE IF NOT EXISTS public.entregas_materiales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo_material VARCHAR(20) NOT NULL CHECK (tipo_material IN ('camiseta', 'kit')),
  
  -- Información del kit/camiseta
  descripcion TEXT,
  talla VARCHAR(10), -- Para camisetas: XS, S, M, L, XL, XXL
  mes_ciclo VARCHAR(20), -- Para kits: "Enero 2026", "Ciclo 1", etc.
  
  -- Control de entrega
  fecha_entrega TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  entregado_por UUID REFERENCES public.perfiles(id), -- Profesor o admin que entregó
  observaciones TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2️⃣ ÍNDICES para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_entregas_estudiante ON public.entregas_materiales(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_entregas_tipo ON public.entregas_materiales(tipo_material);
CREATE INDEX IF NOT EXISTS idx_entregas_fecha ON public.entregas_materiales(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_entregas_mes_ciclo ON public.entregas_materiales(mes_ciclo);

-- 3️⃣ RLS (Row Level Security) - Todos pueden ver
ALTER TABLE public.entregas_materiales ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden ver las entregas
CREATE POLICY "Todos pueden ver entregas" ON public.entregas_materiales
  FOR SELECT USING (true);

-- Política: Solo profesores y admins pueden insertar
CREATE POLICY "Profesores y admins pueden registrar entregas" ON public.entregas_materiales
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('profesor', 'admin', 'administrativo')
    )
  );

-- Política: Solo quien entregó o admins pueden actualizar
CREATE POLICY "Solo quien entregó o admins pueden actualizar" ON public.entregas_materiales
  FOR UPDATE USING (
    entregado_por = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

-- Política: Solo admins pueden eliminar
CREATE POLICY "Solo admins pueden eliminar entregas" ON public.entregas_materiales
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
      AND rol IN ('admin', 'administrativo')
    )
  );

-- 4️⃣ TRIGGER para actualizar updated_at
CREATE OR REPLACE FUNCTION update_entregas_materiales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_entregas_materiales_updated_at
  BEFORE UPDATE ON public.entregas_materiales
  FOR EACH ROW
  EXECUTE FUNCTION update_entregas_materiales_updated_at();

-- 5️⃣ VISTA para consultas fáciles con nombres
CREATE OR REPLACE VIEW public.v_entregas_materiales_completa AS
SELECT 
  em.*,
  e.nombre_completo as estudiante_nombre,
  e.identificacion as estudiante_cedula,
  e.email as estudiante_email,
  p.nombre_completo as entregado_por_nombre,
  p.rol as entregado_por_rol
FROM public.entregas_materiales em
LEFT JOIN public.perfiles e ON em.estudiante_id = e.id
LEFT JOIN public.perfiles p ON em.entregado_por = p.id;

-- 6️⃣ FUNCIÓN para obtener resumen de entregas por estudiante
CREATE OR REPLACE FUNCTION obtener_resumen_entregas(p_estudiante_id UUID)
RETURNS TABLE(
  tiene_camiseta BOOLEAN,
  fecha_camiseta TIMESTAMP WITH TIME ZONE,
  total_kits INTEGER,
  ultimo_kit_mes VARCHAR(20),
  ultimo_kit_fecha TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS(SELECT 1 FROM entregas_materiales WHERE estudiante_id = p_estudiante_id AND tipo_material = 'camiseta') as tiene_camiseta,
    (SELECT MAX(fecha_entrega) FROM entregas_materiales WHERE estudiante_id = p_estudiante_id AND tipo_material = 'camiseta') as fecha_camiseta,
    (SELECT COUNT(*)::INTEGER FROM entregas_materiales WHERE estudiante_id = p_estudiante_id AND tipo_material = 'kit') as total_kits,
    (SELECT mes_ciclo FROM entregas_materiales WHERE estudiante_id = p_estudiante_id AND tipo_material = 'kit' ORDER BY fecha_entrega DESC LIMIT 1) as ultimo_kit_mes,
    (SELECT MAX(fecha_entrega) FROM entregas_materiales WHERE estudiante_id = p_estudiante_id AND tipo_material = 'kit') as ultimo_kit_fecha;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ VERIFICACIÓN
SELECT 'Tabla entregas_materiales creada correctamente' as status;
SELECT COUNT(*) as total_entregas FROM public.entregas_materiales;
