-- ============================================
-- FASE 1: PLANTILLAS DE MENSAJES
-- ============================================
-- Ejecutar en Supabase SQL Editor

-- Verificar que la tabla plantillas_whatsapp existe
-- (Debería estar creada ya)

-- Limpiar plantillas viejas (opcional)
-- DELETE FROM public.plantillas_whatsapp WHERE activa = false;

-- ============================================
-- INSERTAR PLANTILLAS PARA LA ACADEMIA
-- ============================================

-- 1. CONFIRMACIÓN DE INSCRIPCIÓN
INSERT INTO public.plantillas_whatsapp 
(nombre, descripcion, plantilla, variables, tipo, activa) 
VALUES 
(
  'inscripcion_confirmada',
  'Se envía cuando un estudiante se inscribe en un curso',
  '★ *ACADEMIA CRYSTAL* ★
• *INSCRIPCIÓN CONFIRMADA*
====================

Hola {{nombre}},

¡Bienvenido a {{nombre_curso}}! 🎉

📚 *DETALLES DEL CURSO:*
» *Programa:* {{nombre_curso}}
» *Inicio:* {{fecha_inicio}}
» *Horario:* {{horario}}
» *Mensualidad:* ${{mensualidad}}
» *Instructor:* {{instructor}}

💰 *PRIMER PAGO:*
Debes hacer tu primer pago de ${{mensualidad}} antes del {{fecha_pago}}

🎓 *QUE INCLUYE:*
• Certificado Físico y Digital
• Ceremonia de Grado
• Camiseta Uniforme
• Alquiler de Toga
• Kit de Productos

====================
➤ *¡ESTAMOS LISTOS PARA RECIBIRTE!*
» *RESPONDE ESTE MENSAJE* si tienes dudas

Saludos,
📱 Academia Crystal Diamante',
  ARRAY['nombre','nombre_curso','fecha_inicio','horario','mensualidad','instructor','fecha_pago'],
  'transaccional',
  true
);

-- 2. RECORDATORIO DE PAGO
INSERT INTO public.plantillas_whatsapp 
(nombre, descripcion, plantilla, variables, tipo, activa) 
VALUES 
(
  'recordatorio_pago',
  'Recordatorio de cuota próxima a vencer o vencida',
  '★ *ACADEMIA CRYSTAL* ★
• *RECORDATORIO DE PAGO*
====================

Hola {{nombre}},

💰 Te recordamos que tu cuota de {{mes}} está próxima a vencer:

» *Monto:* ${{monto}}
» *Vencimiento:* {{fecha_vencimiento}}
» *Curso:* {{nombre_curso}}

❗ *IMPORTANTE:*
Si ya realizaste el pago, ignora este mensaje.
De lo contrario, realiza el pago lo antes posible para no perder tu cupo.

📱 *Métodos de pago disponibles:*
• Transferencia bancaria
• Efectivo en la oficina
• Tarjeta de crédito

====================
» *RESPONDE ESTE MENSAJE* para consultas sobre pago
» O contáctanos al +57 300 123 4567

Saludos,
📱 Academia Crystal Diamante',
  ARRAY['nombre','mes','monto','fecha_vencimiento','nombre_curso'],
  'marketing',
  true
);

-- 3. CONFIRMACIÓN DE PAGO
INSERT INTO public.plantillas_whatsapp 
(nombre, descripcion, plantilla, variables, tipo, activa) 
VALUES 
(
  'pago_recibido',
  'Confirmación cuando se recibe un pago',
  '★ *ACADEMIA CRYSTAL* ★
• *PAGO CONFIRMADO*
====================

Hola {{nombre}},

✓ ¡Recibimos tu pago exitosamente! 🎉

💳 *DETALLES DE LA TRANSACCIÓN:*
» *Referencia:* {{referencia_pago}}
» *Monto:* ${{monto}}
» *Fecha:* {{fecha_pago}}
» *Concepto:* {{concepto}}

📚 *Tu matrícula está activa para:*
» {{nombre_curso}}
» Vigente hasta: {{fecha_vigencia}}

🎓 *Proximas acciones:*
• Presenta tu recibo en la primera clase
• Asegúrate de asistir el {{fecha_proxima_clase}}
• Trae tus útiles escolares

====================
» Si tienes dudas, RESPONDE ESTE MENSAJE
» O contáctanos en WhatsApp

¡Gracias por tu confianza!
📱 Academia Crystal Diamante',
  ARRAY['nombre','referencia_pago','monto','fecha_pago','concepto','nombre_curso','fecha_vigencia','fecha_proxima_clase'],
  'transaccional',
  true
);

-- 4. INFORMACIÓN DE CURSO
INSERT INTO public.plantillas_whatsapp 
(nombre, descripcion, plantilla, variables, tipo, activa) 
VALUES 
(
  'informacion_curso',
  'Envía información detallada de un curso al solicitante',
  '★ *ACADEMIA CRYSTAL* ★
• *INFORMACIÓN DEL CURSO*
====================

Hola {{nombre}},

Te compartimos la información del curso que te interesa:

📚 *{{nombre_curso}}*
{{descripcion_curso}}

» *Duración:* {{duracion}}
» *Horario:* {{horario}}
» *Modalidad:* {{modalidad}}
» *Requisitos:* {{requisitos}}

💰 *INVERSIÓN:*
» *Inscripción:* ${{costo_inscripcion}}
» *Mensualidad:* ${{costo_mensualidad}}
» *Duración total:* {{duracion_meses}} meses

👥 *Cupo disponible:* {{cupos_disponibles}} estudiantes

🎓 *QUE INCLUYE:*
{{que_incluye}}

📅 *PRÓXIMA COHORTE:*
» Inicio: {{fecha_proxima_cohorte}}
» Inscripciones hasta: {{fecha_cierre_inscripcion}}

====================
➤ *¿TE INTERESA INSCRIBIRTE?*
» Haz clic aquí: {{link_inscripcion}}
» O RESPONDE ESTE MENSAJE para más información

Saludos,
📱 Academia Crystal Diamante',
  ARRAY['nombre','nombre_curso','descripcion_curso','duracion','horario','modalidad','requisitos','costo_inscripcion','costo_mensualidad','duracion_meses','cupos_disponibles','que_incluye','fecha_proxima_cohorte','fecha_cierre_inscripcion','link_inscripcion'],
  'marketing',
  true
);

-- 5. FORMULARIO DE INTERÉS (Lead)
INSERT INTO public.plantillas_whatsapp 
(nombre, descripcion, plantilla, variables, tipo, activa) 
VALUES 
(
  'formulario_interes',
  'Lead interesado desde redes sociales (enviado por Make)',
  '★ *ACADEMIA CRYSTAL* ★
• *¡TENEMOS UNA OPORTUNIDAD PERFECTA PARA TI!*
====================

Hola {{nombre}},

Vi que te interesa {{curso_interes}} 👀

Te cuento que somos la mejor opción en {{ciudad}} para {{beneficio_principal}}

✨ *¿Por qué elegirnos?*
• {{beneficio_1}}
• {{beneficio_2}}
• {{beneficio_3}}
• Certificación reconocida

📅 *La próxima cohorte comienza:* {{fecha_inicio}}
🔥 Solo quedan {{cupos}} cupos disponibles

====================
🚀 *¿Quieres conocer más detalles?*
» Haz clic aquí: {{link_catalogo}}
» RESPONDE ESTE MENSAJE y te damos toda la info

¿Preguntas? Estamos para ayudarte 😊

Academia Crystal Diamante
📱 {{telefono_soporte}}',
  ARRAY['nombre','curso_interes','ciudad','beneficio_principal','beneficio_1','beneficio_2','beneficio_3','fecha_inicio','cupos','link_catalogo','telefono_soporte'],
  'marketing',
  true
);

-- 6. SEGUIMIENTO DE LEADS
INSERT INTO public.plantillas_whatsapp 
(nombre, descripcion, plantilla, variables, tipo, activa) 
VALUES 
(
  'seguimiento_leads',
  'Seguimiento automático para leads que no respondieron (Make)',
  '★ *ACADEMIA CRYSTAL* ★
• *ESPERA, TENEMOS UN DESCUENTO PARA TI*
====================

Hola {{nombre}},

Notamos que te interesó {{curso_interes}} pero aún no te has inscrito.

Queremos ayudarte a alcanzar tus metas. Por eso te ofrecemos:

🎁 *DESCUENTO EXCLUSIVO:*
{{descuento}}% de descuento en tu primera mensualidad

💰 *Nueva inversión:*
De ${{costo_original}} a solo ${{costo_con_descuento}}

⏰ *VÁLIDO HASTA:* {{fecha_expiracion}}

📚 *Lo que aprenderás:*
{{contenido_curso}}

====================
👉 *Asegura tu descuento ahora:*
» {{link_inscripcion}}

¿Tienes dudas?
» RESPONDE ESTE MENSAJE
» O llama al {{telefono_soporte}}

No dejes pasar esta oportunidad,
Academia Crystal Diamante 💎',
  ARRAY['nombre','curso_interes','descuento','costo_original','costo_con_descuento','fecha_expiracion','contenido_curso','link_inscripcion','telefono_soporte'],
  'marketing',
  true
);

-- 7. CERTIFICADO DISPONIBLE
INSERT INTO public.plantillas_whatsapp 
(nombre, descripcion, plantilla, variables, tipo, activa) 
VALUES 
(
  'certificado_disponible',
  'Notificación cuando el certificado está listo',
  '★ *ACADEMIA CRYSTAL* ★
• *¡TU CERTIFICADO ESTÁ LISTO!* 🎉
====================

Hola {{nombre}},

¡Felicitaciones! 🏆 Completaste exitosamente {{nombre_curso}}

Tu certificado está listo y disponible de dos formas:

📱 *CERTIFICADO DIGITAL:*
» Descargar aquí: {{link_certificado_digital}}
» En cualquier momento desde tu cuenta

📄 *CERTIFICADO FÍSICO:*
» Retíralo en nuestras oficinas
» Disponible a partir del {{fecha_disponible}}
» En horario de {{horario_atencion}}

📍 *UBICACIÓN:*
{{direccion_oficina}}

🎓 *TAMBIÉN TE INVITAMOS A:*
» Ceremonia de Grado: {{fecha_ceremonia}} a las {{hora_ceremonia}}
» Lugar: {{lugar_ceremonia}}
» Incluye: Toga, camiseta, foto oficial

====================
✅ *¿Necesitas más copias?*
» RESPONDE ESTE MENSAJE
» Costo por copia: ${{costo_copias}}

¡Esperamos verte en la ceremonia!
Academia Crystal Diamante 💎',
  ARRAY['nombre','nombre_curso','link_certificado_digital','fecha_disponible','horario_atencion','direccion_oficina','fecha_ceremonia','hora_ceremonia','lugar_ceremonia','costo_copias'],
  'transaccional',
  true
);

-- 8. BIENVENIDA NUEVO ESTUDIANTE
INSERT INTO public.plantillas_whatsapp 
(nombre, descripcion, plantilla, variables, tipo, activa) 
VALUES 
(
  'bienvenida_nuevo_estudiante',
  'Primer mensaje de bienvenida después de inscripción confirmada',
  '★ *ACADEMIA CRYSTAL* ★
• *¡BIENVENIDO!*
====================

Hola {{nombre}},

Estamos muy emocionados de que te unas a nuestra comunidad en {{nombre_curso}} 🎉

📱 *Este es tu canal directo con nosotros:*
» Dudas sobre el curso
» Recordatorios de clases
» Cambios de horario
» Actualizaciones importantes
» Notificaciones de pagos

📅 *TUS PRÓXIMAS CLASES:*
» {{fecha_proxima_clase_1}} - {{horario}}
» {{fecha_proxima_clase_2}} - {{horario}}
» {{fecha_proxima_clase_3}} - {{horario}}

📍 *UBICACIÓN:*
{{direccion_clases}}
Salón: {{numero_salon}}

👨‍🏫 *TU INSTRUCTOR:*
{{nombre_instructor}}

💬 *RESPONDE ESTE MENSAJE SI:*
» Tienes preguntas
» No puedes asistir a una clase
» Necesitas cambiar el horario

¡Nos vemos en la primera clase!
Academia Crystal Diamante 💎',
  ARRAY['nombre','nombre_curso','fecha_proxima_clase_1','fecha_proxima_clase_2','fecha_proxima_clase_3','horario','direccion_clases','numero_salon','nombre_instructor'],
  'transaccional',
  true
);

-- 9. RECORDATORIO DE CLASE
INSERT INTO public.plantillas_whatsapp 
(nombre, descripcion, plantilla, variables, tipo, activa) 
VALUES 
(
  'recordatorio_clase',
  'Recordatorio 1 hora antes de la clase',
  '🔔 *RECORDATORIO DE CLASE*

Hola {{nombre}},

Tu clase de {{nombre_curso}} comienza en 1 hora:

⏰ *HORA:* {{hora_clase}}
📍 *UBICACIÓN:* {{ubicacion}}
👨‍🏫 *INSTRUCTOR:* {{nombre_instructor}}

📌 *Por favor:*
✓ Llega 10 minutos antes
✓ Trae tus útiles
✓ Si no puedes asistir, avisa al instructor

¡Nos vemos pronto!',
  ARRAY['nombre','nombre_curso','hora_clase','ubicacion','nombre_instructor'],
  'transaccional',
  true
);

-- 10. CIERRE DE INSCRIPCIÓN
INSERT INTO public.plantillas_whatsapp 
(nombre, descripcion, plantilla, variables, tipo, activa) 
VALUES 
(
  'cierre_inscripcion',
  'Alerta de cierre próximo de inscripciones',
  '★ *ACADEMIA CRYSTAL* ★
• *⚠️ CIERRE DE INSCRIPCIONES PRÓXIMO*
====================

Hola {{nombre}},

¡ÚLTIMA OPORTUNIDAD! Las inscripciones para {{nombre_curso}} cierran en:

⏰ {{dias_restantes}} días ({{fecha_cierre}})

📚 *DETALLES:*
» Programa: {{nombre_curso}}
» Inicio: {{fecha_inicio}}
» Cupos restantes: {{cupos_restantes}}
» Inversión: ${{costo_total}}

🔥 *¿POR QUÉ APRESURARSE?*
• Pocos cupos disponibles
• Descuento especial válido solo hasta {{fecha_descuento}}
• Las próximas cohortes comienzan más tarde

====================
👉 *INSCRÍBETE YA:*
» {{link_inscripcion}}

¿Preguntas?
» RESPONDE ESTE MENSAJE
» O llama: {{telefono_soporte}}

No pierdas esta oportunidad,
Academia Crystal Diamante 💎',
  ARRAY['nombre','nombre_curso','dias_restantes','fecha_cierre','fecha_inicio','cupos_restantes','costo_total','fecha_descuento','link_inscripcion','telefono_soporte'],
  'marketing',
  true
);

-- Verificar que todas se insertaron
SELECT nombre, tipo, activa, created_at 
FROM public.plantillas_whatsapp 
ORDER BY created_at DESC 
LIMIT 10;
