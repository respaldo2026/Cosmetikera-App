-- Plantilla WhatsApp: Bienvenida portal profesor
-- Ejecutar una sola vez en Supabase SQL Editor

INSERT INTO public.plantillas_whatsapp (nombre, descripcion, plantilla, tipo, activa)
SELECT
  'bienvenida_portal_profesor',
  'Bienvenida al profesor con acceso a la app y usuario de ingreso',
  'Hola {{nombre}}, tu cuenta de profesor en Academia Crystal Diamante fue activada.\n\nIngresa a la plataforma: {{enlace_portal}}\nUsuario registrado: {{usuario}}\n\nEste mensaje corresponde a la activación de tu acceso.',
  'personalizado',
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.plantillas_whatsapp
  WHERE nombre = 'bienvenida_portal_profesor'
);

-- Si ya existe pero quieres actualizar su contenido, descomenta:
-- UPDATE public.plantillas_whatsapp
-- SET
--   descripcion = 'Bienvenida al profesor con acceso a la app y usuario de ingreso',
--   plantilla = 'Hola {{nombre}}, tu cuenta de profesor en Academia Crystal Diamante fue activada.\n\nIngresa a la plataforma: {{enlace_portal}}\nUsuario registrado: {{usuario}}\n\nEste mensaje corresponde a la activación de tu acceso.',
--   activa = true,
--   updated_at = now()
-- WHERE nombre = 'bienvenida_portal_profesor';
