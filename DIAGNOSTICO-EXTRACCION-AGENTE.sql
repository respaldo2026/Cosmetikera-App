-- ====================================================
-- DIAGNÓSTICO: EXTRACCIÓN DE DATOS DEL AGENTE IA
-- ====================================================
-- Ejecutar en Supabase SQL Editor

-- 1) RESUMEN DE VOLUMEN POR TABLA/FUENTE
SELECT 'programas_activos' AS fuente, COUNT(*)::int AS total
FROM programas
WHERE activo = true
UNION ALL
SELECT 'grupos_vw_cursos_para_ia_activos', COUNT(*)::int
FROM vw_cursos_para_ia
WHERE estado = 'activo'
UNION ALL
SELECT 'configuracion', COUNT(*)::int
FROM configuracion
UNION ALL
SELECT 'medios_pago_activos', COUNT(*)::int
FROM medios_pago
WHERE activo = true
UNION ALL
SELECT 'pensum', COUNT(*)::int
FROM pensum
WHERE activo = true
UNION ALL
SELECT 'pensum_cursos', COUNT(*)::int
FROM pensum_cursos
UNION ALL
SELECT 'agent_settings', COUNT(*)::int
FROM agent_settings
UNION ALL
SELECT 'agent_chunks', COUNT(*)::int
FROM agent_chunks;

-- 2) ÚLTIMOS PROGRAMAS ACTIVOS
SELECT id, nombre, activo, precio_inscripcion, precio_mensualidad, updated_at
FROM programas
WHERE activo = true
ORDER BY updated_at DESC NULLS LAST, id DESC
LIMIT 10;

-- 3) GRUPOS ACTIVOS QUE EL AGENTE LEE (vista)
SELECT id, nombre, programa_nombre, estado, fecha_inicio, horario, cupos_disponibles
FROM vw_cursos_para_ia
WHERE estado = 'activo'
ORDER BY fecha_inicio ASC NULLS LAST, id DESC
LIMIT 20;

-- 4) CONFIGURACIÓN DE ACADEMIA QUE USA EL AGENTE (toma la más reciente)
SELECT id, nombre_academia, direccion, telefono, whatsapp, updated_at
FROM configuracion
ORDER BY updated_at DESC NULLS LAST
LIMIT 1;

-- 5) MEDIOS DE PAGO ACTIVOS
SELECT id, nombre, codigo, activo, orden
FROM medios_pago
WHERE activo = true
ORDER BY orden ASC;

-- 6) TEMARIO DISPONIBLE (pensum + cursos)
SELECT p.programa_id, p.numero_ciclo, p.nombre_ciclo, p.activo, COUNT(pc.id)::int AS cursos_en_ciclo
FROM pensum p
LEFT JOIN pensum_cursos pc ON pc.pensum_id = p.id
WHERE p.activo = true
GROUP BY p.programa_id, p.numero_ciclo, p.nombre_ciclo, p.activo
ORDER BY p.programa_id, p.numero_ciclo;

-- 7) CONFIG DEL AGENTE
SELECT id, persona_name, LEFT(system_prompt, 120) AS prompt_preview, updated_at
FROM agent_settings
WHERE id = 1;

-- 8) CONTEXTO SEMÁNTICO (chunks)
SELECT COUNT(*)::int AS chunks_total, MAX(created_at) AS ultimo_chunk
FROM agent_chunks;

-- 9) CONVERSACIONES RECIENTES (ver si guarda y lee historial)
SELECT phone_number, user_message, LEFT(agent_response, 140) AS respuesta, created_at
FROM agent_conversations
ORDER BY created_at DESC
LIMIT 10;
