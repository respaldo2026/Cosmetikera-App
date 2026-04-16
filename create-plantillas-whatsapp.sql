-- Crear tabla plantillas_whatsapp si no existe
CREATE TABLE IF NOT EXISTS public.plantillas_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  plantilla TEXT NOT NULL,
  tipo TEXT DEFAULT 'personalizado', -- personalizado, lead, programa
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Agregar columnas faltantes si no existen
ALTER TABLE public.plantillas_whatsapp
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'personalizado';

ALTER TABLE public.plantillas_whatsapp
ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;

-- Agregar RLS si no existe
ALTER TABLE public.plantillas_whatsapp ENABLE ROW LEVEL SECURITY;

-- Crear políticas de RLS
DROP POLICY IF EXISTS "Todos pueden ver plantillas activas" ON public.plantillas_whatsapp;
CREATE POLICY "Todos pueden ver plantillas activas" ON public.plantillas_whatsapp
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Solo admin puede modificar plantillas" ON public.plantillas_whatsapp;
CREATE POLICY "Solo admin puede modificar plantillas" ON public.plantillas_whatsapp
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');

-- Insertar plantillas por defecto si no existen
INSERT INTO public.plantillas_whatsapp (nombre, descripcion, plantilla, tipo, activa)
VALUES 
  (
    'Plantilla Lead Inicial',
    'Mensaje de bienvenida para nuevos leads',
    '👋 ¡Hola {nombre}!

📱 SÍGUENOS EN REDES
{redes_sociales}

✨ ACADEMIA {nombre_academia}
Formamos profesionales en belleza y estética.

📝 PROGRAMAS DISPONIBLES
Contamos con diversos programas especializados adaptados a tus necesidades.

💬 ¿Te gustaría conocer más sobre nuestros programas?
Escribenos y te ayudaremos a encontrar la mejor opción para ti.

📱 {telefono}
📧 {email}

¡Te esperamos! 🎉
💾 Agréganos a contactos para ver nuestros estados',
    'lead',
    true
  ),
  (
    'Plantilla Consulta de Programa',
    'Mensaje detallado para quien pregunta por un programa específico',
    '👋 ¡Hola {nombre}!

📱 SÍGUENOS EN REDES
{redes_sociales}

✨ ACADEMIA {nombre_academia}
Formamos profesionales en belleza y estética.

📝 {programa_nombre}
{programa_descripcion}

📅 ESTRUCTURA DEL PROGRAMA
• Duración: {programa_duracion}
• Total de clases: {programa_clases}

📦 QUÉ INCLUYE
• Kit completo de productos cada mes
• Todos los materiales necesarios
• Certificación al finalizar

💰 INVERSIÓN
• Inscripción: {programa_inscripcion}
• Mensualidad: {programa_mensualidad}

¿Deseas más información? 💬

📱 {telefono}
📧 {email}

¡Te esperamos! 🎉
💾 Agréganos a contactos para ver nuestros estados',
    'programa',
    true
  )
ON CONFLICT DO NOTHING;
