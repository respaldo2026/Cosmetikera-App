-- =====================================================
-- Crear tabla configuracion para La Cosmetikera
-- =====================================================
CREATE TABLE IF NOT EXISTS public.configuracion (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Datos del negocio / academia
  nombre_academia     text,
  logo_url            text,
  slogan              text,
  nit                 text,
  telefono            text,
  email               text,
  direccion           text,
  ciudad              text,
  pais                text DEFAULT 'Colombia',
  sitio_web           text,
  
  -- Redes sociales
  instagram           text,
  facebook            text,
  youtube             text,
  maps_url            text,
  
  -- Configuración de tickets / recibos
  ticket_campos       jsonb DEFAULT '{}',
  
  -- WhatsApp / notificaciones
  whatsapp_token      text,
  whatsapp_phone_id   text,
  whatsapp_activo     boolean DEFAULT false,
  
  -- Configuración de moneda
  moneda              text DEFAULT 'COP',
  simbolo_moneda      text DEFAULT '$',
  
  -- Timestamps
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_configuracion_updated_at ON public.configuracion;
CREATE TRIGGER set_configuracion_updated_at
  BEFORE UPDATE ON public.configuracion
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total configuracion autenticados" ON public.configuracion;
CREATE POLICY "Acceso total configuracion autenticados"
  ON public.configuracion FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica configuracion" ON public.configuracion;
CREATE POLICY "Lectura publica configuracion"
  ON public.configuracion FOR SELECT TO anon
  USING (true);

-- Insertar registro inicial con datos de la tienda
INSERT INTO public.configuracion (
  nombre_academia,
  nit,
  telefono,
  ciudad,
  pais,
  moneda,
  simbolo_moneda,
  ticket_campos
)
VALUES (
  'La Cosmetikera',
  '',
  '',
  'Colombia',
  'Colombia',
  'COP',
  '$',
  '{"logo":true,"nombreAcademia":true,"ruc":true,"direccion":true,"telefono":true,"email":true,"fecha":true,"concepto":true,"monto":true,"nota":true}'
)
ON CONFLICT DO NOTHING;
