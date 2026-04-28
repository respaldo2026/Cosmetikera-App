-- =====================================================
-- SISTEMA DE MEMORIA - Agente WhatsApp La Cosmetikera
-- Almacena historial de conversaciones por cliente
-- =====================================================

-- 1. Tabla para almacenar historial de conversaciones
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid        REFERENCES public.perfiles(id) ON DELETE CASCADE,
  telefono        text        NOT NULL,
  
  -- Rol en conversación: "cliente" o "agente"
  rol             text        NOT NULL CHECK (rol IN ('cliente', 'agente')),
  
  -- Contenido del mensaje
  mensaje         text        NOT NULL,
  tipo_mensaje    text        DEFAULT 'text', -- text, image, audio, etc
  
  -- Metadata
  intento         text,       -- Intención detectada (ej: "consulta_producto", "reclamo")
  respuesta_ia    text,       -- Respuesta generada si es agente
  sentimiento     text,       -- Sentimiento del cliente: positive, neutral, negative
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  
  -- Índices para búsquedas rápidas
  CONSTRAINT check_rol CHECK (rol IN ('cliente', 'agente'))
);

CREATE INDEX idx_whatsapp_conv_perfil ON public.whatsapp_conversation_history(perfil_id);
CREATE INDEX idx_whatsapp_conv_telefono ON public.whatsapp_conversation_history(telefono);
CREATE INDEX idx_whatsapp_conv_created ON public.whatsapp_conversation_history(created_at DESC);

ALTER TABLE public.whatsapp_conversation_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total whatsapp_conversation_history" ON public.whatsapp_conversation_history;
CREATE POLICY "Acceso total whatsapp_conversation_history"
  ON public.whatsapp_conversation_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Tabla para preferencias y perfil del cliente (memoria)
CREATE TABLE IF NOT EXISTS public.whatsapp_customer_memory (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid        UNIQUE REFERENCES public.perfiles(id) ON DELETE CASCADE,
  telefono        text        NOT NULL UNIQUE,
  
  -- Info personal recordada
  nombre          text,       -- Nombre del cliente (para ser cercano)
  primer_contacto timestamptz,  -- Primera interacción
  ultima_interaccion timestamptz,
  total_mensajes  integer DEFAULT 0,
  
  -- Preferencias recordadas
  preferencias    jsonb DEFAULT '{}', -- {temas_favoritos: [], productos_interesados: [], etc}
  
  -- Estado de relación
  nivel_confianza text DEFAULT 'nuevo', -- nuevo, conocido, leal
  notas_personales text,  -- Anotaciones del equipo
  
  -- Contexto para IA
  contexto_conversacion text, -- Resumen de temas tratados
  último_tema_tratado text,   -- Último tema de conversación
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_customer_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total whatsapp_customer_memory" ON public.whatsapp_customer_memory;
CREATE POLICY "Acceso total whatsapp_customer_memory"
  ON public.whatsapp_customer_memory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Función para obtener contexto del cliente (últimas 10 mensajes)
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
  v_perfil_id uuid;
  v_historial jsonb;
BEGIN
  -- Obtener perfil_id
  SELECT perfil_id INTO v_perfil_id 
  FROM public.whatsapp_customer_memory 
  WHERE telefono = p_telefono;

  -- Construir historial JSON de últimos mensajes
  SELECT jsonb_agg(
    jsonb_build_object(
      'rol', rol,
      'mensaje', mensaje,
      'hora', created_at
    ) ORDER BY created_at DESC
  ) INTO v_historial
  FROM (
    SELECT rol, mensaje, created_at
    FROM public.whatsapp_conversation_history
    WHERE telefono = p_telefono
    ORDER BY created_at DESC
    LIMIT p_limit
  ) t;

  RETURN QUERY
  SELECT 
    wcm.nombre,
    wcm.nivel_confianza,
    COALESCE(v_historial, '[]'::jsonb),
    wcm.preferencias,
    wcm.último_tema_tratado
  FROM public.whatsapp_customer_memory wcm
  WHERE wcm.telefono = p_telefono;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Función para actualizar memoria después de cada conversación
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
    total_mensajes,
    nivel_confianza,
    último_tema_tratado
  )
  VALUES (
    p_perfil_id,
    p_telefono,
    COALESCE(p_nombre, (SELECT nombre_completo FROM public.perfiles WHERE id = p_perfil_id)),
    CURRENT_TIMESTAMP,
    1,
    'nuevo',
    p_tema_tratado
  )
  ON CONFLICT (telefono) DO UPDATE SET
    perfil_id = COALESCE(p_perfil_id, EXCLUDED.perfil_id),
    nombre = COALESCE(p_nombre, whatsapp_customer_memory.nombre),
    total_mensajes = whatsapp_customer_memory.total_mensajes + 1,
    ultima_interaccion = CURRENT_TIMESTAMP,
    último_tema_tratado = COALESCE(p_tema_tratado, whatsapp_customer_memory.último_tema_tratado),
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para registrar automáticamente mensajes en historial
CREATE OR REPLACE FUNCTION log_whatsapp_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Esta función se llamará desde el endpoint de chat
  -- Se registra en whatsapp_conversation_history
  INSERT INTO public.whatsapp_conversation_history (
    perfil_id,
    telefono,
    rol,
    mensaje,
    tipo_mensaje
  )
  VALUES (
    NEW.perfil_id,
    NEW.telefono,
    NEW.rol,
    NEW.mensaje,
    COALESCE(NEW.tipo_mensaje, 'text')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Comentarios para documentación
COMMENT ON TABLE public.whatsapp_conversation_history IS 'Historial completo de conversaciones de cliente con agente AI';
COMMENT ON TABLE public.whatsapp_customer_memory IS 'Perfil de memoria del cliente: nombre, preferencias, historial, nivel de confianza';
COMMENT ON FUNCTION get_whatsapp_context(text, integer) IS 'Obtiene contexto completo del cliente: nombre, historial reciente, preferencias';
COMMENT ON FUNCTION update_whatsapp_memory(text, uuid, text, text) IS 'Actualiza memoria del cliente después de interacción';
