-- ============================================
-- SQL CONSOLIDADO FASE 1 + 3: EJECUTAR EN SUPABASE
-- ============================================
-- INSTRUCCIONES:
-- 1. Abre Supabase Dashboard → SQL Editor
-- 2. Copia TODO este contenido
-- 3. Ejecuta
-- 4. Verifica: SELECT COUNT(*) FROM plantillas_whatsapp; → Debe dar 10
-- 5. Verifica: SELECT COUNT(*) FROM whatsapp_mensajes; → Debe dar 0 (vacía)
-- ============================================

-- ============================================
-- FASE 1: PLANTILLAS DE MENSAJES
-- ============================================

-- Asegurar que la tabla existe
CREATE TABLE IF NOT EXISTS plantillas_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  plantilla TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  categoria TEXT,
  activa BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Compatibilidad con esquema existente (si la tabla ya existe)
ALTER TABLE plantillas_whatsapp ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE plantillas_whatsapp ADD COLUMN IF NOT EXISTS variables TEXT[] DEFAULT '{}';
ALTER TABLE plantillas_whatsapp ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE plantillas_whatsapp ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;
ALTER TABLE plantillas_whatsapp ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE plantillas_whatsapp ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT NOW();

-- Limpiar plantillas existentes (opcional, comentar si quieres mantener)
-- DELETE FROM plantillas_whatsapp;

-- ============================================
-- INSERT DE 10 PLANTILLAS
-- ============================================

-- 1. INSCRIPCIÓN CONFIRMADA
INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, categoria, activa) VALUES
('inscripcion_confirmada', 
'Confirmación de inscripción a curso', 
'¡Felicitaciones {{nombre}}! 🎉

Tu inscripción al curso *{{nombre_curso}}* ha sido confirmada exitosamente.

📅 *Detalles del curso:*
• Inicio: {{fecha_inicio}}
• Horario: {{horario}}
• Mensualidad: ${{mensualidad}}
• Instructor: {{instructor}}

💳 *Próximo pago:* {{fecha_pago}}

¡Nos vemos pronto en clase! 📚

_Academia Crystal Diamante_',
ARRAY['nombre', 'nombre_curso', 'fecha_inicio', 'horario', 'mensualidad', 'instructor', 'fecha_pago'],
'inscripciones',
true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  plantilla = EXCLUDED.plantilla,
  variables = EXCLUDED.variables,
  categoria = EXCLUDED.categoria,
  activa = EXCLUDED.activa,
  actualizado_en = NOW();

-- 2. RECORDATORIO DE PAGO
INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, categoria, activa) VALUES
('recordatorio_pago',
'Recordatorio de cuota mensual pendiente',
'Hola {{nombre}} 👋

Te recordamos que tu cuota de *{{mes}}* está próxima a vencer.

💰 *Monto:* ${{monto}}
📅 *Fecha límite:* {{fecha_vencimiento}}
📖 *Curso:* {{nombre_curso}}

Puedes pagar en línea o en nuestra oficina. ¡Gracias!

_Academia Crystal Diamante_',
ARRAY['nombre', 'mes', 'monto', 'fecha_vencimiento', 'nombre_curso'],
'pagos',
true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  plantilla = EXCLUDED.plantilla,
  variables = EXCLUDED.variables,
  categoria = EXCLUDED.categoria,
  activa = EXCLUDED.activa,
  actualizado_en = NOW();

-- 3. PAGO RECIBIDO
INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, categoria, activa) VALUES
('pago_recibido',
'Confirmación de pago exitoso',
'¡Pago recibido correctamente! ✅

Hola {{nombre}}, confirmamos que recibimos tu pago.

💳 *Referencia:* {{referencia_pago}}
💰 *Monto:* ${{monto}}
📅 *Fecha:* {{fecha_pago}}
📝 *Concepto:* {{concepto}}

📖 *Curso:* {{nombre_curso}}
⏰ *Vigencia hasta:* {{fecha_vigencia}}
📅 *Próxima clase:* {{fecha_proxima_clase}}

¡Gracias por tu puntualidad! 🙌

_Academia Crystal Diamante_',
ARRAY['nombre', 'referencia_pago', 'monto', 'fecha_pago', 'concepto', 'nombre_curso', 'fecha_vigencia', 'fecha_proxima_clase'],
'pagos',
true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  plantilla = EXCLUDED.plantilla,
  variables = EXCLUDED.variables,
  categoria = EXCLUDED.categoria,
  activa = EXCLUDED.activa,
  actualizado_en = NOW();

-- 4. INFORMACIÓN DE CURSO
INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, categoria, activa) VALUES
('informacion_curso',
'Información detallada de un curso',
'Hola {{nombre}}! 👋

Te enviamos la información del curso *{{nombre_curso}}*:

📖 *Descripción:*
{{descripcion_curso}}

⏱️ *Duración:* {{duracion}}
📅 *Horario:* {{horario}}
🖥️ *Modalidad:* {{modalidad}}
📋 *Requisitos:* {{requisitos}}

💰 *Costos:*
• Inscripción: ${{costo_inscripcion}}
• Mensualidad: ${{costo_mensualidad}}
• Duración: {{duracion_meses}} meses

👥 *Cupos disponibles:* {{cupos_disponibles}}

✨ *Incluye:*
{{que_incluye}}

📅 *Próxima cohorte:* {{fecha_proxima_cohorte}}
🚨 *Cierre inscripción:* {{fecha_cierre_inscripcion}}

🔗 *Inscríbete aquí:* {{link_inscripcion}}

¿Tienes preguntas? ¡Estamos para ayudarte!

_Academia Crystal Diamante_',
ARRAY['nombre', 'nombre_curso', 'descripcion_curso', 'duracion', 'horario', 'modalidad', 'requisitos', 'costo_inscripcion', 'costo_mensualidad', 'duracion_meses', 'cupos_disponibles', 'que_incluye', 'fecha_proxima_cohorte', 'fecha_cierre_inscripcion', 'link_inscripcion'],
'informacion',
true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  plantilla = EXCLUDED.plantilla,
  variables = EXCLUDED.variables,
  categoria = EXCLUDED.categoria,
  activa = EXCLUDED.activa,
  actualizado_en = NOW();

-- 5. FORMULARIO DE INTERÉS (para Make)
INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, categoria, activa) VALUES
('formulario_interes',
'Respuesta automática a lead interesado',
'¡Hola {{nombre}}! 😊

Gracias por tu interés en *{{curso_interes}}* en {{ciudad}}.

🎯 *{{beneficio_principal}}*

✨ *Beneficios:*
✅ {{beneficio_1}}
✅ {{beneficio_2}}
✅ {{beneficio_3}}

📅 *Inicio:* {{fecha_inicio}}
👥 *Cupos limitados:* {{cupos}} disponibles

📚 *Ver catálogo completo:* {{link_catalogo}}

💬 ¿Tienes dudas? Escríbenos al {{telefono_soporte}}

_Academia Crystal Diamante_',
ARRAY['nombre', 'curso_interes', 'ciudad', 'beneficio_principal', 'beneficio_1', 'beneficio_2', 'beneficio_3', 'fecha_inicio', 'cupos', 'link_catalogo', 'telefono_soporte'],
'leads',
true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  plantilla = EXCLUDED.plantilla,
  variables = EXCLUDED.variables,
  categoria = EXCLUDED.categoria,
  activa = EXCLUDED.activa,
  actualizado_en = NOW();

-- 6. SEGUIMIENTO DE LEADS
INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, categoria, activa) VALUES
('seguimiento_leads',
'Seguimiento automático después de 2 días',
'Hola {{nombre}} 👋

¿Ya revisaste la información de *{{curso_interes}}*?

Nos encantaría resolver tus dudas. Las inscripciones cierran el {{fecha_cierre}}.

¿Te gustaría agendar una llamada? 📞

_Academia Crystal Diamante_',
ARRAY['nombre', 'curso_interes', 'fecha_cierre'],
'leads',
true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  plantilla = EXCLUDED.plantilla,
  variables = EXCLUDED.variables,
  categoria = EXCLUDED.categoria,
  activa = EXCLUDED.activa,
  actualizado_en = NOW();

-- 7. CERTIFICADO DISPONIBLE
INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, categoria, activa) VALUES
('certificado_disponible',
'Notificación de certificado listo',
'¡Felicitaciones {{nombre}}! 🎓

Tu certificado del curso *{{nombre_curso}}* ya está disponible.

📱 *Certificado digital:* {{link_certificado_digital}}
📅 *Disponible desde:* {{fecha_disponible}}

📍 *Retiro presencial:*
• Horario: {{horario_atencion}}
• Dirección: {{direccion_oficina}}

🎉 *Ceremonia de graduación:*
• Fecha: {{fecha_ceremonia}}
• Hora: {{hora_ceremonia}}
• Lugar: {{lugar_ceremonia}}

💡 Copias adicionales: ${{costo_copias}}

¡Estamos muy orgullosos de ti! 🌟

_Academia Crystal Diamante_',
ARRAY['nombre', 'nombre_curso', 'link_certificado_digital', 'fecha_disponible', 'horario_atencion', 'direccion_oficina', 'fecha_ceremonia', 'hora_ceremonia', 'lugar_ceremonia', 'costo_copias'],
'certificados',
true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  plantilla = EXCLUDED.plantilla,
  variables = EXCLUDED.variables,
  categoria = EXCLUDED.categoria,
  activa = EXCLUDED.activa,
  actualizado_en = NOW();

-- 8. BIENVENIDA NUEVO ESTUDIANTE
INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, categoria, activa) VALUES
('bienvenida_nuevo_estudiante',
'Bienvenida después de inscripción',
'¡Bienvenido a {{nombre_curso}}, {{nombre}}! 🎉

Estamos emocionados de tenerte con nosotros.

📅 *Tus próximas clases:*
• {{fecha_proxima_clase_1}}
• {{fecha_proxima_clase_2}}
• {{fecha_proxima_clase_3}}

⏰ *Horario:* {{horario}}

📍 *Ubicación:*
{{direccion_clases}}
Salón: {{numero_salon}}

👨‍🏫 *Tu instructor:* {{nombre_instructor}}

💡 *Tips para tu primera clase:*
✅ Llega 10 minutos antes
✅ Trae cuaderno y lápiz
✅ Actitud positiva 😊

¡Nos vemos pronto! 🚀

_Academia Crystal Diamante_',
ARRAY['nombre', 'nombre_curso', 'fecha_proxima_clase_1', 'fecha_proxima_clase_2', 'fecha_proxima_clase_3', 'horario', 'direccion_clases', 'numero_salon', 'nombre_instructor'],
'estudiantes',
true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  plantilla = EXCLUDED.plantilla,
  variables = EXCLUDED.variables,
  categoria = EXCLUDED.categoria,
  activa = EXCLUDED.activa,
  actualizado_en = NOW();

-- 9. RECORDATORIO DE CLASE
INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, categoria, activa) VALUES
('recordatorio_clase',
'Recordatorio 1 hora antes de clase',
'¡Recordatorio de clase! ⏰

Hola {{nombre}}, tu clase de *{{nombre_curso}}* comienza pronto.

🕐 *Hora:* {{hora_clase}}
📍 *Lugar:* {{ubicacion}}
👨‍🏫 *Instructor:* {{nombre_instructor}}

¡Te esperamos! 📚

_Academia Crystal Diamante_',
ARRAY['nombre', 'nombre_curso', 'hora_clase', 'ubicacion', 'nombre_instructor'],
'clases',
true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  plantilla = EXCLUDED.plantilla,
  variables = EXCLUDED.variables,
  categoria = EXCLUDED.categoria,
  activa = EXCLUDED.activa,
  actualizado_en = NOW();

-- 10. CIERRE DE INSCRIPCIÓN
INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, categoria, activa) VALUES
('cierre_inscripcion',
'Alerta de cierre próximo de inscripciones',
'🚨 *¡Últimos días para inscribirte!* 🚨

Hola {{nombre}},

Las inscripciones para *{{nombre_curso}}* cierran en *{{dias_restantes}} días*.

📅 *Fecha límite:* {{fecha_cierre}}
📅 *Inicio del curso:* {{fecha_inicio}}
👥 *Cupos restantes:* {{cupos_restantes}}

💰 *Inversión total:* ${{costo_total}}
🎁 *Descuento válido hasta:* {{fecha_descuento}}

🔗 *Inscríbete ya:* {{link_inscripcion}}

¿Necesitas ayuda? 📞 {{telefono_soporte}}

¡No te quedes fuera! ⚡

_Academia Crystal Diamante_',
ARRAY['nombre', 'nombre_curso', 'dias_restantes', 'fecha_cierre', 'fecha_inicio', 'cupos_restantes', 'costo_total', 'fecha_descuento', 'link_inscripcion', 'telefono_soporte'],
'inscripciones',
true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  plantilla = EXCLUDED.plantilla,
  variables = EXCLUDED.variables,
  categoria = EXCLUDED.categoria,
  activa = EXCLUDED.activa,
  actualizado_en = NOW();

-- ============================================
-- FASE 3: TABLAS DE LOGS Y CONVERSACIONES
-- ============================================

-- Tabla de mensajes enviados (creación compatible con tipo de plantillas_whatsapp.id)
DO $$
DECLARE
  v_type TEXT;
  v_fk_type TEXT;
BEGIN
  SELECT data_type
  INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'plantillas_whatsapp'
    AND column_name = 'id';

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'plantillas_whatsapp.id no existe. Verifica la tabla antes de continuar.';
  END IF;

  v_fk_type := CASE v_type
    WHEN 'uuid' THEN 'UUID'
    WHEN 'integer' THEN 'INTEGER'
    WHEN 'bigint' THEN 'BIGINT'
    WHEN 'smallint' THEN 'SMALLINT'
    ELSE NULL
  END;

  IF v_fk_type IS NULL THEN
    RAISE EXCEPTION 'Tipo de plantillas_whatsapp.id no soportado: %', v_type;
  END IF;

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      telefono TEXT NOT NULL,
      tipo TEXT NOT NULL, -- Nombre de la plantilla
      plantilla_id %s REFERENCES plantillas_whatsapp(id) ON DELETE SET NULL,
      mensaje_texto TEXT NOT NULL,
      estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'entregado', 'leido', 'fallido')),
      message_id TEXT, -- ID de WhatsApp Cloud API
      metadatos JSONB DEFAULT '{}',
      respuesta_esperada BOOLEAN DEFAULT false,
      creado_en TIMESTAMPTZ DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ DEFAULT NOW()
    );
  $f$, v_fk_type);
END $$;

-- Tabla de conversaciones (agrupación por teléfono)
CREATE TABLE IF NOT EXISTS whatsapp_conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono TEXT UNIQUE NOT NULL,
  lead_id UUID, -- Si es un lead
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Si es un estudiante
  total_mensajes_enviados INT DEFAULT 0,
  total_mensajes_recibidos INT DEFAULT 0,
  ultimo_mensaje_enviado TIMESTAMPTZ,
  ultimo_mensaje_recibido TIMESTAMPTZ,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'bloqueado')),
  metadatos JSONB DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_usuario ON whatsapp_mensajes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_telefono ON whatsapp_mensajes(telefono);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_tipo ON whatsapp_mensajes(tipo);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_estado ON whatsapp_mensajes(estado);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_creado ON whatsapp_mensajes(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_message_id ON whatsapp_mensajes(message_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversaciones_telefono ON whatsapp_conversaciones(telefono);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversaciones_usuario ON whatsapp_conversaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversaciones_lead ON whatsapp_conversaciones(lead_id);

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_whatsapp_mensajes_updated_at ON whatsapp_mensajes;
CREATE TRIGGER update_whatsapp_mensajes_updated_at
  BEFORE UPDATE ON whatsapp_mensajes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_conversaciones_updated_at ON whatsapp_conversaciones;
CREATE TRIGGER update_whatsapp_conversaciones_updated_at
  BEFORE UPDATE ON whatsapp_conversaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================

ALTER TABLE whatsapp_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_whatsapp ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios ven solo sus mensajes
DROP POLICY IF EXISTS "Usuarios ven sus propios mensajes" ON whatsapp_mensajes;
CREATE POLICY "Usuarios ven sus propios mensajes" ON whatsapp_mensajes
  FOR SELECT
  USING (auth.uid() = usuario_id);

-- Política: Admin ve todos los mensajes
DROP POLICY IF EXISTS "Administradores ven todo" ON whatsapp_mensajes;
CREATE POLICY "Administradores ven todo" ON whatsapp_mensajes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol = 'administrador'
    )
  );

-- Política: Sistema puede insertar
DROP POLICY IF EXISTS "Sistema puede insertar mensajes" ON whatsapp_mensajes;
CREATE POLICY "Sistema puede insertar mensajes" ON whatsapp_mensajes
  FOR INSERT
  WITH CHECK (true);

-- Políticas para plantillas (todos pueden leer)
DROP POLICY IF EXISTS "Plantillas públicas lectura" ON plantillas_whatsapp;
CREATE POLICY "Plantillas públicas lectura" ON plantillas_whatsapp
  FOR SELECT
  USING (activa = true);

-- Políticas para conversaciones
DROP POLICY IF EXISTS "Usuarios ven sus conversaciones" ON whatsapp_conversaciones;
CREATE POLICY "Usuarios ven sus conversaciones" ON whatsapp_conversaciones
  FOR SELECT
  USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Administradores ven todas conversaciones" ON whatsapp_conversaciones;
CREATE POLICY "Administradores ven todas conversaciones" ON whatsapp_conversaciones
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol = 'administrador'
    )
  );

-- ============================================
-- VISTAS PARA ANÁLISIS
-- ============================================

-- Vista 1: Estadísticas diarias
CREATE OR REPLACE VIEW vw_whatsapp_stats_diarias AS
SELECT
  DATE(creado_en) AS fecha,
  tipo,
  estado,
  COUNT(*) AS total_mensajes,
  COUNT(DISTINCT usuario_id) AS usuarios_unicos,
  COUNT(DISTINCT telefono) AS telefonos_unicos
FROM whatsapp_mensajes
GROUP BY DATE(creado_en), tipo, estado
ORDER BY fecha DESC, tipo, estado;

-- Vista 2: Usuarios más activos
CREATE OR REPLACE VIEW vw_whatsapp_usuarios_activos AS
SELECT
  m.usuario_id,
  m.telefono,
  COUNT(*) AS total_mensajes,
  COUNT(DISTINCT m.tipo) AS tipos_mensajes,
  MAX(m.creado_en) AS ultimo_mensaje,
  COUNT(CASE WHEN m.estado = 'enviado' THEN 1 END) AS enviados,
  COUNT(CASE WHEN m.estado = 'fallido' THEN 1 END) AS fallidos
FROM whatsapp_mensajes m
WHERE m.creado_en >= NOW() - INTERVAL '30 days'
GROUP BY m.usuario_id, m.telefono
ORDER BY total_mensajes DESC
LIMIT 50;

-- Vista 3: Leads más comprometidos
CREATE OR REPLACE VIEW vw_whatsapp_leads_activos AS
SELECT
  telefono,
  total_mensajes_enviados,
  total_mensajes_recibidos,
  (total_mensajes_recibidos::FLOAT / NULLIF(total_mensajes_enviados, 0)) AS tasa_respuesta,
  ultimo_mensaje_enviado,
  ultimo_mensaje_recibido,
  estado
FROM whatsapp_conversaciones
WHERE total_mensajes_enviados > 0
ORDER BY total_mensajes_recibidos DESC, tasa_respuesta DESC
LIMIT 50;

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

-- Verificar plantillas creadas
SELECT COUNT(*) AS total_plantillas, 
       COUNT(CASE WHEN activa THEN 1 END) AS activas
FROM plantillas_whatsapp;

-- Verificar tablas creadas
SELECT 
  'whatsapp_mensajes' AS tabla, 
  COUNT(*) AS registros 
FROM whatsapp_mensajes
UNION ALL
SELECT 
  'whatsapp_conversaciones' AS tabla, 
  COUNT(*) AS registros 
FROM whatsapp_conversaciones
UNION ALL
SELECT 
  'plantillas_whatsapp' AS tabla, 
  COUNT(*) AS registros 
FROM plantillas_whatsapp;

-- ============================================
-- ¡LISTO! ✅
-- ============================================
-- SIGUIENTE PASO: Ir a tu app y probar el módulo
-- Ver archivo: test-whatsapp-basico.js
-- ============================================
