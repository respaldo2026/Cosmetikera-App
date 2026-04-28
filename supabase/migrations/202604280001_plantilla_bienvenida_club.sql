-- =====================================================
-- PLANTILLA DE BIENVENIDA AL CLUB - La Cosmetikera
-- =====================================================

-- 1. Insertar plantilla de WhatsApp para bienvenida al club
INSERT INTO public.plantillas_whatsapp (nombre, descripcion, plantilla, variables, activa)
VALUES (
  'Bienvenida al Club',
  'Plantilla transaccional de Meta: club_welcome_es - Se envía cuando un cliente se inscribe al club',
  '¡Bienvenido a Club La Cosmetikera! 🎀

Tu inscripción ha sido completada.

📲 ACCEDE A TU CUENTA:
App: https://app.cosmetikera.com

🔑 MÉTODO DE INGRESO:
Usuario: Tu número de cédula
Contraseña: La que registraste

Si necesitas ayuda, contacta a nuestro equipo.',
  ARRAY['cedula'],
  true
);

-- 2. Tabla para rastrear notificaciones enviadas
CREATE TABLE IF NOT EXISTS public.notificaciones_enviadas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid        NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo            text        NOT NULL,
  telefono        text        NOT NULL,
  mensaje         text,
  estado          text        NOT NULL DEFAULT 'enviado',
  respuesta_whatsapp jsonb,
  intentos        integer     NOT NULL DEFAULT 1,
  proximo_intento timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(perfil_id, tipo)
);

ALTER TABLE public.notificaciones_enviadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total notificaciones_enviadas" ON public.notificaciones_enviadas;
CREATE POLICY "Acceso total notificaciones_enviadas"
  ON public.notificaciones_enviadas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Tabla auxiliar para trackear inscripciones al club
CREATE TABLE IF NOT EXISTS public.club_inscripciones (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid        NOT NULL UNIQUE REFERENCES public.perfiles(id) ON DELETE CASCADE,
  fecha_inscripcion timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid,
  notificacion_enviada boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_inscripciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total club_inscripciones" ON public.club_inscripciones;
CREATE POLICY "Acceso total club_inscripciones"
  ON public.club_inscripciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
