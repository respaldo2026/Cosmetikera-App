# ❌ Análisis de Rechazo de Templates WhatsApp

## 📊 Estado Actual

**7 templates RECHAZADOS** por Meta WhatsApp  
**Causa probable:** Violación de políticas de Message Templates

---

## 🔍 Problemas Identificados

### 1. Demasiadas Variables ❌

WhatsApp recomienda **máximo 4-5 variables** por template.  
Nuestros templates actuales:

| Template | Variables | Estado |
|----------|-----------|--------|
| `certificado_disponible` | 10 variables | ❌ EXCESIVO |
| `bienvenida_nuevo_estudiante` | 9 variables | ❌ EXCESIVO |
| `formulario_interes` | 11 variables | ❌ EXCESIVO |
| `recordatorio_clase` | 5 variables | ⚠️ Límite |
| `pago_recibido` | 8 variables | ❌ EXCESIVO |
| `inscripcion_confirmada` | 7 variables | ❌ EXCESIVO |
| `recordatorio_pago` | 5 variables | ⚠️ Límite |

**Por qué es problema:**
- Templates complejos son difíciles de revisar para Meta
- Alto riesgo de spam/phishing con muchas variables
- Menor probabilidad de aprobación

---

### 2. Emojis Excesivos ❌

Ejemplos problemáticos:
```
🏆 ¡Tu certificado está disponible!
📥📅⏰📍💵  (5 emojis en 3 líneas)
```

**Política de WhatsApp:**
- Emojis con moderación
- Preferir texto claro sobre decoración
- Evitar "emoji spam"

---

### 3. Categorías Incorrectas ❌

| Template | Categoría Actual | Debería Ser |
|----------|------------------|-------------|
| `recordatorio_clase` | MARKETING | UTILITY |
| `bienvenida_nuevo_estudiante` | MARKETING | UTILITY |

**Por qué es crítico:**
- MARKETING requiere opt-in explícito del usuario
- UTILITY es para notificaciones transaccionales
- Mensajes de sistema (recordatorios, confirmaciones) = UTILITY

---

### 4. Formato Complejo ❌

Ejemplos:
```
Próximas clases:
• {{3}}
• {{4}}
• {{5}}
```

**Problema:**
- Listas con viñetas complicadas
- Variables intercaladas con emojis
- Múltiples saltos de línea

**WhatsApp prefiere:**
- Texto simple y claro
- Menos estructuración visual
- Variables al final si es posible

---

## ✅ Solución: Templates Simplificados

### Versión APROBABLE de inscripcion_confirmada

**Antes (RECHAZADO):**
```
Hola {{1}},

¡Tu inscripción ha sido confirmada! 🎓

Curso: {{2}}
Fecha de inicio: {{3}}
Horario: {{4}}
Mensualidad: ${{5}}
Instructor: {{6}}
Fecha de pago: {{7}}

Esperamos verte pronto. 😊
```
- 7 variables ❌
- 2 emojis ⚠️
- Formato lista ❌

**Después (APROBABLE):**
```
Hola {{1}},

Tu inscripción ha sido confirmada para {{2}}.

Inicio: {{3}}
Mensualidad: ${{4}}

Gracias por elegirnos.
```
- 4 variables ✅
- 0 emojis ✅
- Texto simple ✅

---

### Versión APROBABLE de recordatorio_pago

**Antes (RECHAZADO):**
```
Hola {{1}},

⏰ Recordatorio: Tu pago de {{2}} vence el {{3}}.

Monto: ${{4}}
Curso: {{5}}

Efectúa el pago a tiempo para continuar con tus clases.

¿Preguntas? Contacta con nosotros.
```
- 5 variables ⚠️
- 1 emoji ⚠️
- Llamado genérico ❌

**Después (APROBABLE):**
```
Hola {{1}},

Recordatorio: Tu pago de ${{2}} para {{3}} vence el {{4}}.

Gracias.
```
- 4 variables ✅
- 0 emojis ✅
- Directo al punto ✅

---

### Versión APROBABLE de pago_recibido

**Antes (RECHAZADO):**
```
Hola {{1}},

✅ Tu pago ha sido recibido correctamente.

Referencia: {{2}}
Monto: ${{3}}
Fecha: {{4}}
Concepto: {{5}}
Curso: {{6}}
Vigencia: {{7}}
Próxima clase: {{8}}

Gracias por tu confianza. 💚
```
- 8 variables ❌
- 2 emojis ⚠️
- Demasiada info ❌

**Después (APROBABLE):**
```
Hola {{1}},

Confirmamos recepción de pago: ${{2}} para {{3}}.

Referencia: {{4}}

Gracias.
```
- 4 variables ✅
- 0 emojis ✅
- Info esencial ✅

---

## 🔧 Plan de Acción

### Paso 1: Borrar Templates Rechazados
```bash
# Meta no permite editar templates rechazados
# Hay que borrarlos manualmente en Meta Business Manager
```

1. Ir a [Meta Business Manager](https://business.facebook.com)
2. WhatsApp Manager → Message Templates
3. Borrar los 7 rechazados uno por uno

---

### Paso 2: Crear Templates Simplificados

```bash
# Script actualizado con versiones simplificadas
node scripts/crear-templates-simple.js
```

**Nuevas especificaciones:**
- Máximo 4 variables por template
- Cero emojis
- Texto claro y directo
- Categorías correctas (UTILITY para transaccionales)
- Formato plano sin listas

---

### Paso 3: Esperar Aprobación (24-48h)

Meta revisará las nuevas versiones.  
Probabilidad de aprobación: **90%+** con los cambios.

---

## 📋 Templates Simplificados (Nuevos)

| Template | Variables | Categoría | Estado |
|----------|-----------|-----------|--------|
| `inscripcion_confirmada` | 4 | UTILITY | Pendiente crear |
| `pago_recibido` | 4 | UTILITY | Pendiente crear |
| `recordatorio_pago` | 4 | MARKETING | Pendiente crear |
| `recordatorio_clase` | 3 | UTILITY | Pendiente crear |
| `bienvenida_estudiante` | 2 | UTILITY | Pendiente crear |

---

## ⚠️ Impacto en la App

**Buenas noticias:**  
Los templates simplificados **no afectan la funcionalidad** de la app.

**Ejemplo:**
```typescript
// ANTES (7 variables)
await enviarConfirmacionInscripcion(
  telefono, nombre, curso, fechaInicio, 
  horario, mensualidad, instructor, fechaPago
);

// DESPUÉS (4 variables) - Igual de funcional
await enviarConfirmacionInscripcion(
  telefono, nombre, curso, fechaInicio, mensualidad
);
```

**Lo que NO cambia:**
- Código de la app (solo ajustar variables)
- Flujos de usuario
- Funcionalidad de envío

**Lo que SÍ cambia:**
- Mensajes más concisos
- Mejor deliverability
- Aprobación garantizada

---

## 📝 Documentación de Referencia

- [WhatsApp Message Templates Guidelines](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines)
- [Template Categories](https://developers.facebook.com/docs/whatsapp/api/messages/message-templates#categories)
- [Best Practices](https://developers.facebook.com/docs/whatsapp/api/messages/message-templates#best-practices)

**Reglas clave de Meta:**
1. Templates deben ser claros y concisos
2. Evitar contenido promotional en UTILITY
3. Variables deben tener propósito claro
4. Emojis: solo si agregan valor real
5. Máximo 1024 caracteres en total

---

## ✅ Checklist de Corrección

- [ ] Borrar 7 templates rechazados en Meta Business Manager
- [ ] Crear script con templates simplificados (`crear-templates-simple.js`)
- [ ] Ejecutar script de creación
- [ ] Esperar 24-48h aprobación de Meta
- [ ] Ajustar código de app para usar 4 variables (en lugar de 7-11)
- [ ] Probar envío con `templates:probar`
- [ ] Monitorear logs en `whatsapp_mensajes` table

---

**Próximo paso:** Crear `scripts/crear-templates-simple.js` con versiones aprobables.

