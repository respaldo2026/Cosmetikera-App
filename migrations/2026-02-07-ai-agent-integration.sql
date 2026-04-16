-- =====================================================
-- MIGRACIÓN COMPLETA: INTEGRACIÓN AGENTE DE IA (DANY)
-- =====================================================
-- Fecha: 2026-02-07
-- Propósito: Preparar la base de datos para Make.com + Agente IA
-- Autor: Arquitecto de Software Senior
-- =====================================================

-- =====================================================
-- PARTE 1: ACTUALIZAR TABLA LEADS
-- =====================================================

-- 1.1: Agregar columna telefono si no existe (con UNIQUE para evitar duplicados)
DO $$ 
BEGIN
    -- Verificar si la columna telefono existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'leads' 
        AND column_name = 'telefono'
    ) THEN
        ALTER TABLE public.leads ADD COLUMN telefono VARCHAR(20);
        RAISE NOTICE 'Columna telefono agregada a tabla leads';
    ELSE
        RAISE NOTICE 'Columna telefono ya existe en tabla leads';
    END IF;
END $$;

-- 1.2: Crear índice UNIQUE en telefono (permite NULL pero evita duplicados)
-- Antes, eliminar duplicados existentes dejando el más reciente
WITH duplicados AS (
    SELECT
        id,
        telefono,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY telefono
            ORDER BY created_at DESC NULLS LAST, id
        ) AS rn
    FROM public.leads
    WHERE telefono IS NOT NULL
)
DELETE FROM public.leads l
USING duplicados d
WHERE l.id = d.id
  AND d.rn > 1;

DROP INDEX IF EXISTS idx_leads_telefono_unique;
CREATE UNIQUE INDEX idx_leads_telefono_unique ON public.leads(telefono) 
WHERE telefono IS NOT NULL;

-- 1.3: Agregar columna whatsapp_id para tracking de conversaciones
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'leads' 
        AND column_name = 'whatsapp_id'
    ) THEN
        ALTER TABLE public.leads ADD COLUMN whatsapp_id VARCHAR(100);
        RAISE NOTICE 'Columna whatsapp_id agregada a tabla leads';
    END IF;
END $$;

-- 1.4: Agregar columnas de metadatos para el bot
ALTER TABLE public.leads 
    ADD COLUMN IF NOT EXISTS ultima_interaccion TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS origen_bot BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS conversacion_activa BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS metadatos_bot JSONB DEFAULT '{}';

-- 1.5: Índices para mejorar búsquedas del bot
CREATE INDEX IF NOT EXISTS idx_leads_telefono ON public.leads(telefono);
CREATE INDEX IF NOT EXISTS idx_leads_estado ON public.leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_conversacion_activa ON public.leads(conversacion_activa);
CREATE INDEX IF NOT EXISTS idx_leads_ultima_interaccion ON public.leads(ultima_interaccion DESC);

-- 1.6: FUNCIÓN UPSERT para el bot (Crear o Actualizar por teléfono)
CREATE OR REPLACE FUNCTION public.upsert_lead_por_telefono(
    p_telefono VARCHAR(20),
    p_nombre TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_interes TEXT DEFAULT NULL,
    p_canal TEXT DEFAULT 'WhatsApp',
    p_estado TEXT DEFAULT 'nuevo',
    p_notas TEXT DEFAULT NULL,
    p_whatsapp_id VARCHAR(100) DEFAULT NULL,
    p_metadatos_bot JSONB DEFAULT '{}'
)
RETURNS TABLE (
    id UUID,
    nombre TEXT,
    telefono TEXT,
    email TEXT,
    interes TEXT,
    canal TEXT,
    estado TEXT,
    notas TEXT,
    whatsapp_id TEXT,
    origen_bot BOOLEAN,
    conversacion_activa BOOLEAN,
    ultima_interaccion TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_lead_id UUID;
    v_exists BOOLEAN;
BEGIN
    -- Verificar si el lead existe por teléfono
    SELECT leads.id INTO v_lead_id
    FROM public.leads
    WHERE leads.telefono = p_telefono;
    
    v_exists := FOUND;
    
    IF v_exists THEN
        -- ACTUALIZAR lead existente
        UPDATE public.leads
        SET 
            nombre = COALESCE(p_nombre, nombre),
            email = COALESCE(p_email, email),
            interes = COALESCE(p_interes, interes),
            estado = COALESCE(p_estado, estado),
            notas = CASE 
                WHEN p_notas IS NOT NULL THEN 
                    CASE 
                        WHEN notas IS NULL THEN p_notas
                        ELSE notas || E'\n---\n' || p_notas
                    END
                ELSE notas
            END,
            whatsapp_id = COALESCE(p_whatsapp_id, whatsapp_id),
            conversacion_activa = true,
            ultima_interaccion = NOW(),
            metadatos_bot = metadatos_bot || p_metadatos_bot
        WHERE leads.id = v_lead_id;
    ELSE
        -- INSERTAR nuevo lead
        INSERT INTO public.leads (
            nombre, telefono, email, interes, canal, estado, notas,
            whatsapp_id, origen_bot, conversacion_activa, ultima_interaccion,
            metadatos_bot, created_at
        )
        VALUES (
            p_nombre, p_telefono, p_email, p_interes, p_canal, p_estado, p_notas,
            p_whatsapp_id, true, true, NOW(),
            p_metadatos_bot, NOW()
        )
        RETURNING leads.id INTO v_lead_id;
    END IF;
    
    -- Retornar el lead (creado o actualizado)
    RETURN QUERY
    SELECT 
        l.id, l.nombre, l.telefono, l.email, l.interes, l.canal, l.estado, l.notas,
        l.whatsapp_id, l.origen_bot, l.conversacion_activa, l.ultima_interaccion,
        l.created_at
    FROM public.leads l
    WHERE l.id = v_lead_id;
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.upsert_lead_por_telefono TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_lead_por_telefono TO anon;
GRANT EXECUTE ON FUNCTION public.upsert_lead_por_telefono TO service_role;

COMMENT ON FUNCTION public.upsert_lead_por_telefono IS 
'Función para Make.com: Crea o actualiza un lead basado en el teléfono. Ideal para bots de WhatsApp.';


-- =====================================================
-- PARTE 2: TABLA MARKETING_ASSETS (Marketing Center)
-- =====================================================

-- 2.1: Crear tabla marketing_assets
CREATE TABLE IF NOT EXISTS public.marketing_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Información del asset
    titulo TEXT NOT NULL,
    descripcion TEXT,
    tipo_asset VARCHAR(50) NOT NULL CHECK (tipo_asset IN (
        'flyer', 'pdf', 'imagen', 'video', 'documento', 'otro'
    )),
    
    -- Storage (Supabase Storage)
    url_archivo TEXT NOT NULL,
    nombre_archivo TEXT NOT NULL,
    tamano_bytes BIGINT,
    mime_type VARCHAR(100),
    
    -- Para la IA (Descripción semántica)
    descripcion_ia TEXT NOT NULL,
    keywords TEXT[], -- Para búsqueda
    
    -- Relación con cursos/programas
    programa_id INTEGER REFERENCES public.programas(id) ON DELETE SET NULL,
    curso_id INTEGER REFERENCES public.cursos(id) ON DELETE SET NULL,
    
    -- Estado y visibilidad
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'archivado')),
    visible_para_ia BOOLEAN DEFAULT true,
    
    -- Metadatos
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    categoria VARCHAR(50), -- 'promocional', 'informativo', 'legal', etc
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2: Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_marketing_assets_estado ON public.marketing_assets(estado);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_tipo ON public.marketing_assets(tipo_asset);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_visible_ia ON public.marketing_assets(visible_para_ia);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_programa ON public.marketing_assets(programa_id);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_curso ON public.marketing_assets(curso_id);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_keywords ON public.marketing_assets USING GIN(keywords);

-- 2.3: Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_marketing_assets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_marketing_assets_timestamp ON public.marketing_assets;
CREATE TRIGGER trigger_update_marketing_assets_timestamp
    BEFORE UPDATE ON public.marketing_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_marketing_assets_timestamp();

-- 2.4: Políticas RLS para marketing_assets
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;

-- Lectura: Usuarios autenticados y anónimos (para Make.com con Service Key)
DROP POLICY IF EXISTS "marketing_assets_select_all" ON public.marketing_assets;
CREATE POLICY "marketing_assets_select_all" ON public.marketing_assets
    FOR SELECT
    USING (true); -- Todos pueden leer (Make.com usará Service Key)

-- Insertar: Solo admins
DROP POLICY IF EXISTS "marketing_assets_insert_admin" ON public.marketing_assets;
CREATE POLICY "marketing_assets_insert_admin" ON public.marketing_assets
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE perfiles.id = auth.uid()
            AND perfiles.rol IN ('admin', 'director', 'administrativo')
        )
    );

-- Actualizar: Solo admins
DROP POLICY IF EXISTS "marketing_assets_update_admin" ON public.marketing_assets;
CREATE POLICY "marketing_assets_update_admin" ON public.marketing_assets
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE perfiles.id = auth.uid()
            AND perfiles.rol IN ('admin', 'director', 'administrativo')
        )
    );

-- Eliminar: Solo admins
DROP POLICY IF EXISTS "marketing_assets_delete_admin" ON public.marketing_assets;
CREATE POLICY "marketing_assets_delete_admin" ON public.marketing_assets
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE perfiles.id = auth.uid()
            AND perfiles.rol IN ('admin', 'director')
        )
    );


-- =====================================================
-- PARTE 3: VISTA DE CURSOS PARA IA
-- =====================================================

-- 3.1: Vista SQL con resumen de cursos activos (formato texto plano)
DROP VIEW IF EXISTS public.vw_cursos_para_ia CASCADE;
CREATE VIEW public.vw_cursos_para_ia AS
SELECT 
    c.id,
    c.nombre,
    c.descripcion,
    c.horario,
    c.cupos,
    c.precio,
    c.precio_inscripcion,
    c.precio_mensualidad,
    c.estado,
    c.fecha_inicio,
    c.fecha_fin,
    p.nombre_completo as profesor_nombre,
    prog.nombre as programa_nombre,
    
    -- Formato texto para la IA
    FORMAT(
        'Curso: %s | Programa: %s | Profesor: %s | Horario: %s | Cupos disponibles: %s | Precio: $%s | Estado: %s | Inicio: %s',
        c.nombre,
        COALESCE(prog.nombre, 'Sin programa'),
        COALESCE(p.nombre_completo, 'Por asignar'),
        COALESCE(c.horario, 'Por definir'),
        COALESCE(c.cupos::TEXT, 'Ilimitados'),
        COALESCE(TO_CHAR(c.precio, 'FM999,999,999'), 'Consultar'),
        c.estado,
        COALESCE(TO_CHAR(c.fecha_inicio, 'DD/MM/YYYY'), 'Por confirmar')
    ) as resumen_texto_ia,
    
    -- Cupos matriculados
    COUNT(m.id) as matriculados,
    (c.cupos - COUNT(m.id)) as cupos_disponibles
    
FROM public.cursos c
LEFT JOIN public.perfiles p ON c.profesor_id = p.id
LEFT JOIN public.programas prog ON c.programa_id = prog.id
LEFT JOIN public.matriculas m ON c.id = m.curso_id AND m.estado = 'activo'
WHERE c.estado IN ('activo', 'proximo')
GROUP BY c.id, c.nombre, c.descripcion, c.horario, c.cupos, c.precio, 
         c.precio_inscripcion, c.precio_mensualidad, c.estado, 
         c.fecha_inicio, c.fecha_fin, p.nombre_completo, prog.nombre;

COMMENT ON VIEW public.vw_cursos_para_ia IS 
'Vista optimizada para el Agente IA: Devuelve cursos activos en formato texto plano consumible por Make.com';

-- 3.2: Función para obtener solo el texto plano (más simple para Make)
CREATE OR REPLACE FUNCTION public.get_cursos_para_ia_texto()
RETURNS TABLE (resumen_texto TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        STRING_AGG(resumen_texto_ia, E'\n\n') as resumen_texto
    FROM public.vw_cursos_para_ia;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cursos_para_ia_texto TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cursos_para_ia_texto TO anon;
GRANT EXECUTE ON FUNCTION public.get_cursos_para_ia_texto TO service_role;

COMMENT ON FUNCTION public.get_cursos_para_ia_texto IS 
'Función para Make.com: Devuelve todos los cursos activos en un solo string de texto separado por líneas';


-- =====================================================
-- PARTE 4: FUNCIÓN PARA OBTENER MATERIAL DE MARKETING
-- =====================================================

-- 4.1: Función para que la IA busque assets relevantes
CREATE OR REPLACE FUNCTION public.get_marketing_assets_para_ia(
    p_programa TEXT DEFAULT NULL,
    p_keyword TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    titulo TEXT,
    descripcion_ia TEXT,
    url_archivo TEXT,
    tipo_asset VARCHAR(50)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ma.id,
        ma.titulo,
        ma.descripcion_ia,
        ma.url_archivo,
        ma.tipo_asset
    FROM public.marketing_assets ma
    LEFT JOIN public.programas prog ON ma.programa_id = prog.id
    WHERE ma.estado = 'activo' 
        AND ma.visible_para_ia = true
        AND (p_programa IS NULL OR prog.nombre ILIKE '%' || p_programa || '%')
        AND (p_keyword IS NULL OR ma.descripcion_ia ILIKE '%' || p_keyword || '%' 
             OR ma.titulo ILIKE '%' || p_keyword || '%'
             OR p_keyword = ANY(ma.keywords))
    ORDER BY ma.created_at DESC
    LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_marketing_assets_para_ia TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketing_assets_para_ia TO anon;
GRANT EXECUTE ON FUNCTION public.get_marketing_assets_para_ia TO service_role;


-- =====================================================
-- PARTE 5: POLÍTICAS RLS PARA LEADS (ASEGURAR ACCESO API)
-- =====================================================

-- Asegurar que las políticas RLS de leads permiten acceso con Service Key
-- (Service Key bypasses RLS, pero es buena práctica tener políticas permisivas)

-- Verificar si RLS está habilitado
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Política permisiva para SELECT con Service Key (Make.com)
DROP POLICY IF EXISTS "leads_api_select_all" ON public.leads;
CREATE POLICY "leads_api_select_all" ON public.leads
    FOR SELECT
    USING (true); -- Service Key puede leer todo

-- Política permisiva para INSERT con Service Key
DROP POLICY IF EXISTS "leads_api_insert_all" ON public.leads;
CREATE POLICY "leads_api_insert_all" ON public.leads
    FOR INSERT
    WITH CHECK (true); -- Service Key puede insertar

-- Política permisiva para UPDATE con Service Key
DROP POLICY IF EXISTS "leads_api_update_all" ON public.leads;
CREATE POLICY "leads_api_update_all" ON public.leads
    FOR UPDATE
    USING (true); -- Service Key puede actualizar


-- =====================================================
-- PARTE 6: VERIFICACIÓN Y DOCUMENTACIÓN
-- =====================================================

-- 6.1: Verificar que todo se creó correctamente
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '=== VERIFICACIÓN DE MIGRACIÓN ===';
    
    -- Verificar columnas en leads
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name IN ('telefono', 'whatsapp_id');
    RAISE NOTICE 'Columnas en leads: % de 2 esperadas', v_count;
    
    -- Verificar tabla marketing_assets
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_name = 'marketing_assets';
    RAISE NOTICE 'Tabla marketing_assets: %', CASE WHEN v_count > 0 THEN 'OK' ELSE 'ERROR' END;
    
    -- Verificar vista
    SELECT COUNT(*) INTO v_count
    FROM information_schema.views
    WHERE table_name = 'vw_cursos_para_ia';
    RAISE NOTICE 'Vista vw_cursos_para_ia: %', CASE WHEN v_count > 0 THEN 'OK' ELSE 'ERROR' END;
    
    -- Verificar funciones
    SELECT COUNT(*) INTO v_count
    FROM information_schema.routines
    WHERE routine_name IN ('upsert_lead_por_telefono', 'get_cursos_para_ia_texto', 'get_marketing_assets_para_ia');
    RAISE NOTICE 'Funciones creadas: % de 3 esperadas', v_count;
    
    RAISE NOTICE '=== MIGRACIÓN COMPLETADA ===';
END $$;

-- 6.2: Mostrar resumen de endpoints para Make.com
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'ENDPOINTS PARA MAKE.COM (usar Service Key)';
    RAISE NOTICE '==================================================';
    RAISE NOTICE '';
    RAISE NOTICE '1. UPSERT LEAD (POST):';
    RAISE NOTICE '   URL: https://[PROJECT].supabase.co/rest/v1/rpc/upsert_lead_por_telefono';
    RAISE NOTICE '   Body: {"p_telefono": "+573001234567", "p_nombre": "Juan", ...}';
    RAISE NOTICE '';
    RAISE NOTICE '2. GET CURSOS (GET):';
    RAISE NOTICE '   URL: https://[PROJECT].supabase.co/rest/v1/rpc/get_cursos_para_ia_texto';
    RAISE NOTICE '';
    RAISE NOTICE '3. GET MARKETING ASSETS (POST):';
    RAISE NOTICE '   URL: https://[PROJECT].supabase.co/rest/v1/rpc/get_marketing_assets_para_ia';
    RAISE NOTICE '   Body: {"p_programa": "Manicure", "p_keyword": "promocion"}';
    RAISE NOTICE '';
    RAISE NOTICE '4. SELECT LEADS (GET):';
    RAISE NOTICE '   URL: https://[PROJECT].supabase.co/rest/v1/leads?telefono=eq.+573001234567';
    RAISE NOTICE '';
    RAISE NOTICE '==================================================';
END $$;
