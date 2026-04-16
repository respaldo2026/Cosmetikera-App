-- Verificar y corregir permisos de secretaria para enviar WhatsApp (crear leads)

-- 1. Verificar si la función existe
SELECT proname, proowner::regrole as owner, prosecdef 
FROM pg_proc 
WHERE proname = 'crear_lead_seguro';

-- 2. Recrear la función con permisos correctos
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

  -- Permitir: admin, director, administrativo, secretaria
  IF v_user_rol NOT IN ('admin', 'director', 'administrativo', 'secretaria') THEN
    RAISE EXCEPTION 'No tienes permisos para crear leads. Tu rol: %', v_user_rol;
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

-- 3. Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION crear_lead_seguro TO authenticated;
GRANT EXECUTE ON FUNCTION crear_lead_seguro TO anon;

-- 4. Verificar políticas RLS de la tabla leads
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'leads'
ORDER BY policyname;

-- 5. Si no existe política de INSERT para secretaria, crearla
DO $$
BEGIN
  -- Eliminar política anterior si existe
  DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
  
  -- Crear nueva política que permita INSERT a roles administrativos
  CREATE POLICY "leads_insert_policy"
    ON leads
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM perfiles
        WHERE perfiles.id = auth.uid()
        AND perfiles.rol IN ('admin', 'director', 'administrativo', 'secretaria')
      )
    );
END $$;

-- 6. Verificar que el usuario secretaria tiene el rol correcto en su perfil
SELECT id, email, rol 
FROM perfiles 
WHERE rol = 'secretaria'
LIMIT 5;
