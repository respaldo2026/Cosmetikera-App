-- ====================================================
-- FIX: Políticas RLS para tabla LEADS
-- Permite que admin, director y administrativo puedan crear leads
-- Incluye función auxiliar para crear leads de forma segura
-- ====================================================

-- Habilitar RLS si no está habilitado
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON leads;
DROP POLICY IF EXISTS "leads_select" ON leads;
DROP POLICY IF EXISTS "leads_update" ON leads;
DROP POLICY IF EXISTS "leads_insert" ON leads;
DROP POLICY IF EXISTS "leads_delete" ON leads;

-- Política para SELECT: admin, director, administrativo y secretaria pueden ver leads
CREATE POLICY "leads_select" ON leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo', 'secretaria')
    )
  );

-- Política para INSERT: admin, director, administrativo y secretaria pueden crear leads
CREATE POLICY "leads_insert" ON leads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo', 'secretaria')
    )
  );

-- Política para UPDATE: admin, director, administrativo y secretaria pueden actualizar leads
CREATE POLICY "leads_update" ON leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo', 'secretaria')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director', 'administrativo', 'secretaria')
    )
  );

-- Política para DELETE: solo admin y director pueden eliminar leads
CREATE POLICY "leads_delete" ON leads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('admin', 'director')
    )
  );

-- Crear función para insertar leads con seguridad
CREATE OR REPLACE FUNCTION crear_lead_seguro(
  p_nombre TEXT,
  p_telefono TEXT,
  p_email TEXT DEFAULT NULL,
  p_interes TEXT DEFAULT NULL,
  p_canal TEXT DEFAULT 'WhatsApp',
  p_notas TEXT DEFAULT NULL,
  p_estado TEXT DEFAULT 'nuevo'
)
RETURNS TABLE (
  id INTEGER,
  nombre TEXT,
  telefono TEXT,
  email TEXT,
  interes TEXT,
  canal TEXT,
  notas TEXT,
  estado TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_rol TEXT;
BEGIN
  -- Verificar que el usuario tiene rol administrativo
  SELECT rol INTO v_user_rol
  FROM perfiles
  WHERE perfiles.id = auth.uid();

  IF v_user_rol NOT IN ('admin', 'director', 'administrativo', 'secretaria') THEN
    RAISE EXCEPTION 'No tienes permisos para crear leads';
  END IF;

  -- Insertar el lead
  RETURN QUERY
  INSERT INTO leads (nombre, telefono, email, interes, canal, notas, estado)
  VALUES (p_nombre, p_telefono, p_email, p_interes, p_canal, p_notas, p_estado)
  RETURNING 
    leads.id,
    leads.nombre,
    leads.telefono,
    leads.email,
    leads.interes,
    leads.canal,
    leads.notas,
    leads.estado,
    leads.created_at;
END;
$$;

-- Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION crear_lead_seguro TO authenticated;

-- Verificar políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'leads'
ORDER BY policyname;
