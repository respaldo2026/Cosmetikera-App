-- ========================================================================
-- CORRECCIONES ARQUITECTURA AGENTE IA - PRIORIDAD ALTA
-- ========================================================================
-- Fecha: 2026-02-08
-- Basado en: AUDITORIA-ARQUITECTURA-IA-AGENT.md
-- Propósito: Corregir gaps críticos en esquema para agente conversacional
-- ========================================================================

-- ========================================================================
-- PASO 0: ELIMINAR FUNCIÓN PROBLEMÁTICA
-- ========================================================================
-- Esta función existe y causa conflicto porque busca 'actualizado_en' en vez de 'updated_at'
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- ========================================================================
-- PARTE 1: CORRECCIONES A TABLA 'WHATSAPP_MENSAJES'
-- ========================================================================

-- 1.1: Agregar campo 'role' para distinguir user vs assistant
ALTER TABLE public.whatsapp_mensajes
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'
CHECK (role IN ('user', 'assistant', 'system'));

COMMENT ON COLUMN public.whatsapp_mensajes.role IS 
'Identifica quién envió el mensaje: user (cliente), assistant (bot), system (notificación)';

-- 1.2: Agregar Foreign Key a tabla 'leads'
ALTER TABLE public.whatsapp_mensajes
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_lead_id 
ON public.whatsapp_mensajes(lead_id);

COMMENT ON COLUMN public.whatsapp_mensajes.lead_id IS 
'Relación directa con tabla leads para memoria conversacional';

-- 1.3: Crear índice compuesto para queries de historial
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_lead_creado 
ON public.whatsapp_mensajes(lead_id, creado_en DESC);

-- 1.4: Migrar datos existentes (asociar mensajes a leads por telefono)
UPDATE public.whatsapp_mensajes wm
SET lead_id = l.id
FROM public.leads l
WHERE wm.telefono = l.telefono
  AND wm.lead_id IS NULL;

-- ========================================================================
-- PARTE 2: CORRECCIONES A TABLA 'LEADS'
-- ========================================================================

-- 2.1: Agregar campo 'contexto_ia' para resumen de conversación
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS contexto_ia TEXT;

COMMENT ON COLUMN public.leads.contexto_ia IS 
'Resumen de conversación anterior para continuidad. Ejemplo: "Preguntó por cejas, presupuesto $300k, prefiere horario tarde"';

-- 2.2: Crear UNIQUE INDEX en whatsapp_id (permitir NULL pero evitar duplicados)
DROP INDEX IF EXISTS idx_leads_whatsapp_id_unique;
CREATE UNIQUE INDEX idx_leads_whatsapp_id_unique 
ON public.leads(whatsapp_id) 
WHERE whatsapp_id IS NOT NULL;

-- 2.3: Trigger para actualizar ultima_interaccion automáticamente
CREATE OR REPLACE FUNCTION public.actualizar_ultima_interaccion_lead()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.conversacion_activa != OLD.conversacion_activa 
       OR NEW.metadatos_bot != OLD.metadatos_bot THEN
        NEW.ultima_interaccion = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_ultima_interaccion ON public.leads;
CREATE TRIGGER trigger_actualizar_ultima_interaccion
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.actualizar_ultima_interaccion_lead();

-- ========================================================================
-- PARTE 3: NUEVA TABLA 'FAQ' (PREGUNTAS FRECUENTES)
-- ========================================================================

CREATE TABLE IF NOT EXISTS public.faq (
    id SERIAL PRIMARY KEY,
    pregunta TEXT NOT NULL,
    respuesta TEXT NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    keywords TEXT[], -- Palabras clave para búsqueda
    activo BOOLEAN DEFAULT true,
    prioridad INTEGER DEFAULT 0, -- Mayor = más importante
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_faq_categoria ON public.faq(categoria);
CREATE INDEX IF NOT EXISTS idx_faq_activo ON public.faq(activo);
CREATE INDEX IF NOT EXISTS idx_faq_keywords ON public.faq USING GIN(keywords);

-- Full-text search en español
CREATE INDEX IF NOT EXISTS idx_faq_pregunta_fts 
ON public.faq USING GIN(to_tsvector('spanish', pregunta));

CREATE INDEX IF NOT EXISTS idx_faq_respuesta_fts 
ON public.faq USING GIN(to_tsvector('spanish', respuesta));

-- Row Level Security
ALTER TABLE public.faq ENABLE ROW LEVEL SECURITY;

-- Política: Lectura pública (para el agente con Service Key)
DROP POLICY IF EXISTS "FAQ es visible para API Service Key" ON public.faq;
CREATE POLICY "FAQ es visible para API Service Key" ON public.faq
    FOR SELECT
    TO anon, authenticated
    USING (activo = true);

-- Política: Solo admins pueden modificar
DROP POLICY IF EXISTS "Solo admins gestionan FAQ" ON public.faq;
CREATE POLICY "Solo admins gestionan FAQ" ON public.faq
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() 
            AND perfiles.rol = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() 
            AND perfiles.rol = 'admin'
        )
    );

COMMENT ON TABLE public.faq IS 
'Preguntas frecuentes con respuestas predefinidas para el agente IA. El bot buscará aquí antes de inventar respuestas.';

-- ========================================================================
-- PARTE 4: DATOS SEED PARA FAQ
-- ========================================================================

INSERT INTO public.faq (pregunta, respuesta, categoria, keywords, prioridad) VALUES
('¿Aceptan pagos en cuotas?', 'Sí, aceptamos pagos hasta en 3 cuotas sin interés. También puedes pagar con tarjeta de crédito, Nequi, transferencia o efectivo.', 'pagos', ARRAY['cuotas', 'financiación', 'pago', 'mensualidades'], 10),
('¿Los cursos incluyen materiales?', 'Sí, todos nuestros cursos incluyen el kit completo de materiales y productos necesarios para practicar desde el primer día.', 'cursos', ARRAY['materiales', 'incluye', 'kit', 'productos'], 10),
('¿Dan certificado al finalizar?', 'Sí, al completar el 80% de asistencia y aprobar las prácticas, recibes certificado oficial avalado por Academia Crystal Daniela.', 'certificacion', ARRAY['certificado', 'diploma', 'avalado'], 9),
('¿Cuál es el horario de atención?', 'Nuestro horario de atención es de lunes a viernes de 8:00 AM a 6:00 PM, y sábados de 9:00 AM a 2:00 PM.', 'general', ARRAY['horario', 'atencion', 'abierto'], 5),
('¿Dónde están ubicados?', 'Estamos ubicados en [DIRECCIÓN COMPLETA]. Puedes llegar en TransMilenio o buses que pasan por la Avenida [NOMBRE].', 'general', ARRAY['ubicacion', 'direccion', 'donde'], 8),
('¿Puedo recuperar clases perdidas?', 'Sí, puedes recuperar clases perdidas en otros grupos del mismo curso o acceder a las grabaciones (si aplica). Debes avisar con anticipación.', 'cursos', ARRAY['recuperar', 'clases', 'perdidas', 'falta'], 7),
('¿Tienen cursos online?', 'Actualmente nuestros cursos son 100% presenciales para garantizar la mejor práctica y supervisión. No ofrecemos modalidad online.', 'cursos', ARRAY['online', 'virtual', 'distancia'], 6),
('¿Qué edad mínima se requiere?', 'La edad mínima para inscribirte es 16 años. Los menores de edad deben venir con su acudiente para firmar documentos.', 'requisitos', ARRAY['edad', 'menor', 'requisito'], 7),
('¿Necesito experiencia previa?', 'No, nuestros cursos están diseñados para principiantes. Empezamos desde cero con teoría y práctica guiada.', 'requisitos', ARRAY['experiencia', 'principiante', 'requisito'], 9),
('¿Cuánto dura un curso?', 'La duración varía según el curso. Los cursos básicos son de 8 semanas (2 clases por semana), y los programas completos de 3 a 6 meses.', 'cursos', ARRAY['duracion', 'tiempo', 'cuanto'], 8)
ON CONFLICT DO NOTHING;

-- ========================================================================
-- PARTE 5: FUNCIÓN PARA OBTENER HISTORIAL LIMITADO
-- ========================================================================

-- Función especializada para el agente IA (solo últimos N mensajes)
CREATE OR REPLACE FUNCTION public.get_historial_conversacion_ia(
    p_telefono VARCHAR(20) DEFAULT NULL,
    p_lead_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    role VARCHAR(20),
    mensaje_texto TEXT,
    creado_en TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wm.role::VARCHAR(20),
        wm.mensaje_texto::TEXT,
        wm.creado_en::TIMESTAMPTZ
    FROM public.whatsapp_mensajes wm
    WHERE 
        (p_telefono IS NOT NULL AND wm.telefono = p_telefono)
        OR (p_lead_id IS NOT NULL AND wm.lead_id = p_lead_id)
    ORDER BY wm.creado_en DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_historial_conversacion_ia IS 
'Retorna últimos N mensajes para construir contexto del agente IA. Evita saturar el prompt con miles de mensajes.';

-- ========================================================================
-- PARTE 6: FUNCIÓN PARA BUSCAR EN FAQ
-- ========================================================================

CREATE OR REPLACE FUNCTION public.buscar_faq_ia(
    p_query TEXT,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    pregunta TEXT,
    respuesta TEXT,
    relevancia REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.pregunta,
        f.respuesta,
        ts_rank(
            to_tsvector('spanish', f.pregunta || ' ' || f.respuesta),
            plainto_tsquery('spanish', p_query)
        ) AS relevancia
    FROM public.faq f
    WHERE f.activo = true
      AND (
          to_tsvector('spanish', f.pregunta || ' ' || f.respuesta) @@ plainto_tsquery('spanish', p_query)
          OR EXISTS (
              SELECT 1 FROM unnest(f.keywords) AS keyword 
              WHERE p_query ILIKE '%' || keyword || '%'
          )
      )
    ORDER BY relevancia DESC, f.prioridad DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.buscar_faq_ia IS 
'Busca respuestas relevantes en FAQ usando full-text search. El agente debe llamar esto ANTES de generar respuesta.';

-- ========================================================================
-- PARTE 7: OPTIMIZAR TABLA CURSOS PARA IA
-- ========================================================================

-- Agregar campo resumen_ia a tabla cursos
ALTER TABLE public.cursos
ADD COLUMN IF NOT EXISTS resumen_ia TEXT;

COMMENT ON COLUMN public.cursos.resumen_ia IS 
'Resumen optimizado para el agente IA. Debe incluir: técnicas, duración, precio, fecha inicio, cupos.';

-- Actualizar cursos existentes con resumen auto-generado
UPDATE public.cursos
SET resumen_ia = 
    nombre || ': ' || COALESCE(descripcion, 'Sin descripción') || 
    '. Duración: ' || COALESCE(duracion, 'consultar') ||
    '. Precio: $' || COALESCE(precio::TEXT, 'consultar') ||
    '. Cupos disponibles: ' || COALESCE(cupos::TEXT, 'consultar') ||
    CASE 
        WHEN fecha_inicio IS NOT NULL THEN '. Próximo inicio: ' || TO_CHAR(fecha_inicio, 'DD-Mon-YYYY')
        ELSE ''
    END
WHERE resumen_ia IS NULL;

-- ========================================================================
-- PARTE 8: VISTA CONSOLIDADA PARA EL AGENTE
-- ========================================================================

-- Vista que combina cursos, marketing_assets y FAQ para el agente
DROP VIEW IF EXISTS public.vw_knowledge_base_completa CASCADE;
CREATE VIEW public.vw_knowledge_base_completa AS
SELECT 
    'curso' AS tipo_contenido,
    c.id::TEXT AS referencia_id,
    c.nombre AS titulo,
    COALESCE(
        c.resumen_ia,
        c.nombre || ': ' || COALESCE(c.descripcion, '') || 
        '. Precio: $' || COALESCE(c.precio::TEXT, 'consultar') || 
        '. Cupos: ' || COALESCE(cupos::TEXT, 'consultar') ||
        '. Estado: ' || COALESCE(c.estado, 'activo')
    ) AS contenido,
    ARRAY[c.nombre, COALESCE(c.descripcion, ''), COALESCE(c.estado, '')] AS keywords
FROM public.cursos c
WHERE c.estado IN ('activo', 'proximo')

UNION ALL

SELECT 
    'marketing' AS tipo_contenido,
    ma.id::TEXT AS referencia_id,
    ma.titulo AS titulo,
    COALESCE(ma.descripcion_ia, ma.descripcion, ma.titulo) AS contenido,
    ma.keywords AS keywords
FROM public.marketing_assets ma
WHERE ma.visible_para_ia = true AND ma.estado = 'publicado'

UNION ALL

SELECT 
    'faq' AS tipo_contenido,
    f.id::TEXT AS referencia_id,
    f.pregunta AS titulo,
    f.pregunta || ' - ' || f.respuesta AS contenido,
    f.keywords AS keywords
FROM public.faq f
WHERE f.activo = true;

COMMENT ON VIEW public.vw_knowledge_base_completa IS 
'Vista consolidada de toda la información disponible para el agente IA: cursos, marketing y FAQ.';

-- ========================================================================
-- PARTE 9: ACTUALIZAR RLS PARA API SERVICE KEY
-- ========================================================================

-- Asegurar que whatsapp_mensajes permita INSERT con Service Key
DROP POLICY IF EXISTS "Service Key puede insertar mensajes" ON public.whatsapp_mensajes;
CREATE POLICY "Service Key puede insertar mensajes" 
ON public.whatsapp_mensajes
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Service Key puede leer mensajes" ON public.whatsapp_mensajes;
CREATE POLICY "Service Key puede leer mensajes" 
ON public.whatsapp_mensajes
FOR SELECT
TO anon, authenticated
USING (true);

-- ========================================================================
-- VERIFICACIÓN FINAL
-- ========================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Correcciones aplicadas exitosamente:';
    RAISE NOTICE '   - whatsapp_mensajes ahora tiene campo role y lead_id';
    RAISE NOTICE '   - leads ahora tiene contexto_ia y trigger de ultima_interaccion';
    RAISE NOTICE '   - Tabla FAQ creada con % datos seed', (SELECT COUNT(*) FROM public.faq);
    RAISE NOTICE '   - Funciones get_historial_conversacion_ia y buscar_faq_ia creadas';
    RAISE NOTICE '   - Vista vw_knowledge_base_completa disponible';
    RAISE NOTICE '   - RLS actualizado para Service Key access';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Verifica con estas queries:';
    RAISE NOTICE '   SELECT * FROM public.faq;';
    RAISE NOTICE '   SELECT * FROM public.vw_knowledge_base_completa LIMIT 5;';
END $$;
