# 📋 TEMPLATES DE WHATSAPP - CREAR EN META BUSINESS

**Fecha**: 2 de febrero de 2026  
**Status**: A crear en Meta Business Manager  
**Standard**: WhatsApp Business Cloud API (Official)

---

## ⚠️ IMPORTANTE

Estos templates **DEBEN ser creados y aprobados** por Meta antes de poder usarlos en producción. El proceso:

1. ✅ Ir a https://business.facebook.com/wa/manage/message-templates/
2. ✅ Click en "Crear"
3. ✅ Seleccionar idioma: **Español (es)**
4. ✅ Copiar exactamente la estructura de abajo
5. ✅ Meta los aprueba en 5-30 minutos
6. ✅ Usarlos en el código

---

## 📋 TEMPLATE 1: inscripcion_confirmada

**Nombre del template**: `inscripcion_confirmada`  
**Categoría**: TRANSACTIONAL  
**Idioma**: Español (es)

```
Cuerpo del mensaje (Body):

¡Felicitaciones {{1}}! 🎉

Tu inscripción al curso *{{2}}* ha sido confirmada exitosamente.

📅 *Detalles del curso:*
• Inicio: {{3}}
• Horario: {{4}}
• Mensualidad: {{5}}
• Instructor: {{6}}

💳 *Próximo pago:* {{7}}

¡Nos vemos pronto en clase! 📚

_Academia Crystal Diamante_
```

**Variables** (orden IMPORTANTE):
1. nombre (texto)
2. nombre_curso (texto)
3. fecha_inicio (texto)
4. horario (texto)
5. mensualidad (texto)
6. instructor (texto)
7. fecha_pago (texto)

**Footer**: (opcional, dejar vacío)

---

## 📋 TEMPLATE 2: pago_recibido

**Nombre del template**: `pago_recibido`  
**Categoría**: TRANSACTIONAL  
**Idioma**: Español (es)

```
Cuerpo del mensaje (Body):

¡Pago recibido correctamente! ✅

Hola {{1}}, confirmamos que recibimos tu pago.

💳 *Referencia:* {{2}}
💰 *Monto:* {{3}}
📅 *Fecha:* {{4}}
📝 *Concepto:* {{5}}

📖 *Curso:* {{6}}
⏰ *Vigencia hasta:* {{7}}
📅 *Próxima clase:* {{8}}

¡Gracias por tu puntualidad! 🙌

_Academia Crystal Diamante_
```

**Variables**:
1. nombre (texto)
2. referencia_pago (texto)
3. monto (texto)
4. fecha_pago (texto)
5. concepto (texto)
6. nombre_curso (texto)
7. fecha_vigencia (texto)
8. fecha_proxima_clase (texto)

---

## 📋 TEMPLATE 3: recordatorio_pago

**Nombre del template**: `recordatorio_pago`  
**Categoría**: MARKETING  
**Idioma**: Español (es)

```
Cuerpo del mensaje (Body):

Hola {{1}} 👋

Te recordamos que tu cuota de *{{2}}* está próxima a vencer.

💰 *Monto:* {{3}}
📅 *Fecha límite:* {{4}}
📖 *Curso:* {{5}}

Puedes pagar en línea o en nuestra oficina. ¡Gracias!

_Academia Crystal Diamante_
```

**Variables**:
1. nombre (texto)
2. mes (texto)
3. monto (texto)
4. fecha_vencimiento (texto)
5. nombre_curso (texto)

---

## 📋 TEMPLATE 4: formulario_interes

**Nombre del template**: `formulario_interes`  
**Categoría**: MARKETING  
**Idioma**: Español (es)

```
Cuerpo del mensaje (Body):

¡Hola {{1}}! 😊

Gracias por tu interés en *{{2}}* en {{3}}.

🎯 {{4}}

✨ *Beneficios:*
✅ {{5}}
✅ {{6}}
✅ {{7}}

📅 *Inicio:* {{8}}
👥 *Cupos limitados:* {{9}} disponibles

📚 *Ver más:* {{10}}

💬 ¿Dudas? {{11}}

_Academia Crystal Diamante_
```

**Variables**:
1. nombre (texto)
2. curso_interes (texto)
3. ciudad (texto)
4. beneficio_principal (texto)
5. beneficio_1 (texto)
6. beneficio_2 (texto)
7. beneficio_3 (texto)
8. fecha_inicio (texto)
9. cupos (texto)
10. link_catalogo (URL)
11. telefono_soporte (texto)

---

## 📋 TEMPLATE 5: bienvenida_nuevo_estudiante

**Nombre del template**: `bienvenida_nuevo_estudiante`  
**Categoría**: TRANSACTIONAL  
**Idioma**: Español (es)

```
Cuerpo del mensaje (Body):

¡Bienvenido a {{1}}, {{2}}! 🎉

Estamos emocionados de tenerte con nosotros.

📅 *Tus próximas clases:*
• {{3}}
• {{4}}
• {{5}}

⏰ *Horario:* {{6}}

📍 *Ubicación:*
{{7}}
Salón: {{8}}

👨‍🏫 *Tu instructor:* {{9}}

💡 *Tips para tu primera clase:*
✅ Llega 10 minutos antes
✅ Trae cuaderno y lápiz
✅ Actitud positiva 😊

¡Nos vemos pronto! 🚀

_Academia Crystal Diamante_
```

**Variables**:
1. nombre_curso (texto)
2. nombre (texto)
3. fecha_proxima_clase_1 (texto)
4. fecha_proxima_clase_2 (texto)
5. fecha_proxima_clase_3 (texto)
6. horario (texto)
7. direccion_clases (texto)
8. numero_salon (texto)
9. nombre_instructor (texto)

---

## 📋 TEMPLATE 6: recordatorio_clase

**Nombre del template**: `recordatorio_clase`  
**Categoría**: TRANSACTIONAL  
**Idioma**: Español (es)

```
Cuerpo del mensaje (Body):

¡Recordatorio de clase! ⏰

Hola {{1}}, tu clase de *{{2}}* comienza pronto.

🕐 *Hora:* {{3}}
📍 *Lugar:* {{4}}
👨‍🏫 *Instructor:* {{5}}

¡Te esperamos! 📚

_Academia Crystal Diamante_
```

**Variables**:
1. nombre (texto)
2. nombre_curso (texto)
3. hora_clase (texto)
4. ubicacion (texto)
5. nombre_instructor (texto)

---

## 📋 TEMPLATE 7: certificado_disponible

**Nombre del template**: `certificado_disponible`  
**Categoría**: TRANSACTIONAL  
**Idioma**: Español (es)

```
Cuerpo del mensaje (Body):

¡Felicitaciones {{1}}! 🎓

Tu certificado del curso *{{2}}* ya está disponible.

📱 *Certificado digital:* {{3}}
📅 *Disponible desde:* {{4}}

📍 *Retiro presencial:*
• Horario: {{5}}
• Dirección: {{6}}

🎉 *Ceremonia de graduación:*
• Fecha: {{7}}
• Hora: {{8}}
• Lugar: {{9}}

💡 Copias adicionales: {{10}}

¡Estamos muy orgullosos de ti! 🌟

_Academia Crystal Diamante_
```

**Variables**:
1. nombre (texto)
2. nombre_curso (texto)
3. link_certificado_digital (URL)
4. fecha_disponible (texto)
5. horario_atencion (texto)
6. direccion_oficina (texto)
7. fecha_ceremonia (texto)
8. hora_ceremonia (texto)
9. lugar_ceremonia (texto)
10. costo_copias (texto)

---

## ✅ CHECKLIST DE CREACIÓN

**Crear en orden** y marcar cuando Meta los apruebe:

- [ ] 1. inscripcion_confirmada - TRANSACTIONAL
- [ ] 2. pago_recibido - TRANSACTIONAL
- [ ] 3. recordatorio_pago - MARKETING
- [ ] 4. formulario_interes - MARKETING
- [ ] 5. bienvenida_nuevo_estudiante - TRANSACTIONAL
- [ ] 6. recordatorio_clase - TRANSACTIONAL
- [ ] 7. certificado_disponible - TRANSACTIONAL

---

## 🚀 PASOS PARA CREAR

1. **Ir a Meta Business Manager**: https://business.facebook.com
2. **Seleccionar app de WhatsApp** que sea tu oficial
3. **Tools → Menú Template**
4. **Crear Template** (verde, arriba a la derecha)
5. **Seleccionar idioma**: Español (es)
6. **Copiar exactamente** el body de arriba
7. **Agregar variables** clickeando en el body (se marcan automáticas)
8. **Seleccionar categoría**: TRANSACTIONAL o MARKETING
9. **Guardar y enviar a revisión**

**Tiempo aprox**: 2 minutos por template = 14 minutos total

---

## 📌 IMPORTANTE

- ✅ **NO cambiar el orden de variables** ({{1}}, {{2}}, {{3}}, etc.)
- ✅ **Usar TRANSACTIONAL** para confirmaciones/recordatorios
- ✅ **Usar MARKETING** para promociones/leads
- ✅ **Las variables deben ser numéricas en Meta** ({{1}}, {{2}})
- ✅ **El código las reemplazará automáticamente** por valores reales
- ✅ **Los emojis están permitidos** (mantenerlos como están)

---

## 🔗 LINKS ÚTILES

- Meta Business Manager: https://business.facebook.com
- WhatsApp API Docs: https://developers.facebook.com/docs/whatsapp
- Template Guidelines: https://developers.facebook.com/docs/whatsapp/message-templates/guidelines-and-best-practices

---

**Próximo paso**: Una vez creados todos los templates, ejecutar script para usar en producción.

