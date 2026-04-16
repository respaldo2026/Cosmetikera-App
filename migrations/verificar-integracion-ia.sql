-- =====================================================
-- SCRIPT DE VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================

-- 1. Estructura de tabla leads
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
ORDER BY ordinal_position;

-- 2. Índices en leads
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'leads'
ORDER BY indexname;

-- 3. Tabla marketing_assets y columnas
SELECT COUNT(*) as existe
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'marketing_assets';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'marketing_assets'
ORDER BY ordinal_position;

-- 4. Vista vw_cursos_para_ia
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public' AND table_name = 'vw_cursos_para_ia';

SELECT nombre, horario, cupos_disponibles, LEFT(resumen_texto_ia, 100) || '...' as resumen_preview
FROM vw_cursos_para_ia
LIMIT 2;

-- 5. Funciones
SELECT routine_name, routine_type, data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'upsert_lead_por_telefono',
    'get_cursos_para_ia_texto',
    'get_marketing_assets_para_ia'
  )
ORDER BY routine_name;

-- 6. RLS y políticas
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('leads', 'marketing_assets');

SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'leads'
ORDER BY policyname;

SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'marketing_assets'
ORDER BY policyname;

-- 7. Probar upsert_lead_por_telefono
SELECT * FROM upsert_lead_por_telefono(
  p_telefono := '+57300TEST123',
  p_nombre := 'Test Verificación',
  p_email := 'test@verificacion.com',
  p_interes := 'Prueba Sistema',
  p_canal := 'WhatsApp',
  p_estado := 'nuevo',
  p_notas := 'Lead de prueba creado por script de verificación',
  p_metadatos_bot := '{"test": true, "fecha": "2026-02-07"}'::jsonb
);

SELECT * FROM upsert_lead_por_telefono(
  p_telefono := '+57300TEST123',
  p_notas := 'Nota adicional: Actualización exitosa'
);

DELETE FROM leads WHERE telefono = '+57300TEST123';

-- 8. Probar get_cursos_para_ia_texto
SELECT LEFT(resumen_texto, 200) || '...' as preview_texto
FROM get_cursos_para_ia_texto();

-- 9. Probar get_marketing_assets_para_ia
INSERT INTO marketing_assets (
  titulo,
  tipo_asset,
  url_archivo,
  nombre_archivo,
  descripcion_ia,
  estado,
  visible_para_ia
) VALUES (
  'Test Asset',
  'flyer',
  'https://test.com/test.jpg',
  'test.jpg',
  'Asset de prueba para verificación del sistema',
  'activo',
  true
);

SELECT titulo, tipo_asset, descripcion_ia
FROM get_marketing_assets_para_ia(
  p_programa := NULL,
  p_keyword := 'prueba'
);

DELETE FROM marketing_assets WHERE titulo = 'Test Asset';

-- 10. Storage bucket marketing
SELECT id, name, public
FROM storage.buckets
WHERE name = 'marketing';
