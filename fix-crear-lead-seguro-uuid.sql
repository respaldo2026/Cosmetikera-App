-- Corregir tipo de retorno de la función crear_lead_seguro
-- El problema: la función declara id como INTEGER pero la tabla usa UUID

-- Primero eliminar la función existente
DROP FUNCTION IF EXISTS crear_lead_seguro(text,text,text,text,text,text,text);

-- Ahora recrearla con el tipo correcto
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
  id UUID,  -- ✅ CORREGIDO: era INTEGER, ahora es UUID
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

-- Verificar que se aplicó correctamente
SELECT 
  p.proname as nombre_funcion,
  pg_get_function_result(p.oid) as tipo_retorno
FROM pg_proc p
WHERE p.proname = 'crear_lead_seguro';
