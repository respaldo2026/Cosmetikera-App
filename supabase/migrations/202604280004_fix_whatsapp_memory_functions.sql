-- =====================================================
-- FIX: Función update_whatsapp_memory
-- Corrige nivel_confianza automático por volumen de mensajes
-- =====================================================

CREATE OR REPLACE FUNCTION update_whatsapp_memory(
  p_telefono text,
  p_perfil_id uuid DEFAULT NULL,
  p_nombre text DEFAULT NULL,
  p_tema_tratado text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.whatsapp_customer_memory (
    perfil_id,
    telefono,
    nombre,
    primer_contacto,
    ultima_interaccion,
    total_mensajes,
    nivel_confianza,
    último_tema_tratado,
    updated_at
  )
  VALUES (
    p_perfil_id,
    p_telefono,
    COALESCE(p_nombre, (SELECT nombre FROM public.perfiles WHERE id = p_perfil_id LIMIT 1)),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    1,
    'nuevo',
    p_tema_tratado,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (telefono) DO UPDATE SET
    perfil_id          = COALESCE(p_perfil_id, whatsapp_customer_memory.perfil_id),
    nombre             = COALESCE(p_nombre, whatsapp_customer_memory.nombre),
    total_mensajes     = whatsapp_customer_memory.total_mensajes + 1,
    ultima_interaccion = CURRENT_TIMESTAMP,
    último_tema_tratado = COALESCE(p_tema_tratado, whatsapp_customer_memory.último_tema_tratado),
    -- Sube nivel de confianza automáticamente por volumen de mensajes pares
    nivel_confianza    = CASE
      WHEN whatsapp_customer_memory.total_mensajes + 1 >= 20 THEN 'leal'
      WHEN whatsapp_customer_memory.total_mensajes + 1 >= 5  THEN 'conocido'
      ELSE whatsapp_customer_memory.nivel_confianza
    END,
    updated_at         = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIX: Función get_whatsapp_context
-- Retorna historial en orden cronológico (ASC) con nivel de confianza actualizado
-- =====================================================

CREATE OR REPLACE FUNCTION get_whatsapp_context(
  p_telefono text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  nombre text,
  nivel_confianza text,
  historial_reciente jsonb,
  preferencias jsonb,
  ultimo_tema text
) AS $$
DECLARE
  v_historial jsonb;
BEGIN
  -- Historial en orden cronológico (más antiguo primero, últimos p_limit)
  SELECT jsonb_agg(
    jsonb_build_object(
      'rol',     h.rol,
      'mensaje', h.mensaje,
      'hora',    h.created_at
    ) ORDER BY h.created_at ASC
  ) INTO v_historial
  FROM (
    SELECT rol, mensaje, created_at
    FROM public.whatsapp_conversation_history
    WHERE telefono = p_telefono
    ORDER BY created_at DESC
    LIMIT p_limit
  ) h;

  RETURN QUERY
  SELECT
    wcm.nombre,
    wcm.nivel_confianza,
    COALESCE(v_historial, '[]'::jsonb),
    COALESCE(wcm.preferencias, '{}'::jsonb),
    wcm.último_tema_tratado
  FROM public.whatsapp_customer_memory wcm
  WHERE wcm.telefono = p_telefono;
END;
$$ LANGUAGE plpgsql STABLE;
