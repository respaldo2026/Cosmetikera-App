# 📝 Guía: Crear Plantillas Manualmente en Meta Business Manager

## 🌐 Ir a Meta Business Manager

1. Abre [business.facebook.com](https://business.facebook.com)
2. Selecciona **"Asesor Crystal Diamante"** (tu negocio)
3. En el menú lateral izquierdo, busca **WhatsApp**
4. Abre **WhatsApp Manager**
5. Haz clic en **"Plantillas de mensajes"** (o Message Templates)
6. Haz clic en botón azul **"Crear plantilla"** (o Create template)

---

## 📋 Plantillas a Crear

### PLANTILLA 1: inscripcion_confirmada_v2

**Tipo:** UTILITY (Transaccional)  
**Idioma:** Spanish

**Nombre de la plantilla:**
```
inscripcion_confirmada_v2
```

**Contenido del cuerpo del mensaje:**
```
Hola {{1}},

Tu inscripción ha sido confirmada para {{2}}.

Inicio: {{3}}
Mensualidad: ${{4}}

Gracias por elegirnos.
```

**Variables esperadas:**
1. Nombre estudiante
2. Nombre curso
3. Fecha inicio
4. Monto mensualidad

---

### PLANTILLA 2: recordatorio_clase_v2

**Tipo:** UTILITY (Transaccional)  
**Idioma:** Spanish

**Nombre de la plantilla:**
```
recordatorio_clase_v2
```

**Contenido del cuerpo del mensaje:**
```
Hola {{1}},

Recordatorio: Tu clase de {{2}} es hoy a las {{3}}.

Te esperamos.
```

**Variables esperadas:**
1. Nombre estudiante
2. Nombre curso
3. Hora clase

---

### PLANTILLA 3: certificado_disponible_v2

**Tipo:** UTILITY (Transaccional)  
**Idioma:** Spanish

**Nombre de la plantilla:**
```
certificado_disponible_v2
```

**Contenido del cuerpo del mensaje:**
```
Felicitaciones {{1}},

Tu certificado para {{2}} está disponible.

Descarga: {{3}}

Estamos orgullosos de tu logro.
```

**Variables esperadas:**
1. Nombre estudiante
2. Nombre curso
3. Link descarga

---

### PLANTILLA 4: pago_recibido_v2

**Tipo:** UTILITY (Transaccional)  
**Idioma:** Spanish

**Nombre de la plantilla:**
```
pago_recibido_v2
```

**Contenido del cuerpo del mensaje:**
```
Hola {{1}},

Te confirmamos que hemos recibido correctamente tu pago de ${{2}} correspondiente a {{3}}.

Referencia: {{4}}

Muchas gracias por tu confianza.
```

**Variables esperadas:**
1. Nombre estudiante
2. Monto pago
3. Nombre curso
4. Referencia/ID pago

---

### PLANTILLA 5: recordatorio_pago_v2

**Tipo:** MARKETING (Promocional)  
**Idioma:** Spanish

**Nombre de la plantilla:**
```
recordatorio_pago_v2
```

**Contenido del cuerpo del mensaje:**
```
Hola {{1}},

Recordatorio: Tu pago de ${{2}} para {{3}} vence el {{4}}.

Gracias.
```

**Variables esperadas:**
1. Nombre estudiante
2. Monto pago
3. Nombre curso
4. Fecha vencimiento

---

### PLANTILLA 6: formulario_interes_v2

**Tipo:** MARKETING (Promocional)  
**Idioma:** Spanish

**Nombre de la plantilla:**
```
formulario_interes_v2
```

**Contenido del cuerpo del mensaje:**
```
Hola {{1}},

Gracias por tu interés en {{2}}.

Inicio: {{3}}

Te contactaremos pronto.
```

**Variables esperadas:**
1. Nombre persona
2. Nombre curso
3. Fecha inicio

---

### PLANTILLA 7: formulario_interes_v3 (con botones)

**Tipo:** MARKETING (Promocional)  
**Idioma:** Spanish

**Nombre de la plantilla:**
```
formulario_interes_v3
```

**Contenido del cuerpo del mensaje:**
```
Hola {{1}},

Gracias por tu interes en {{2}}.

Inicio: {{3}}
Duracion: {{4}}
Modalidad: {{5}}

Si respondes, te enviamos el detalle de horarios y costos.
```

**Variables esperadas:**
1. Nombre persona
2. Nombre curso
3. Fecha inicio o "Por confirmar"
4. Duracion (ej. "4 meses")
5. Modalidad (ej. "Presencial Cali" o "Virtual")

**Botones:**
- Quick reply: "Quiero mas info"
- CTA URL (opcional, cuando tengas dominio listo): "Ver programa" -> https://tudominio.com/programas

Notas Meta:
- Texto del boton coincide con el cuerpo.
- URL con dominio propio, sin acortadores.
- Sin emojis ni claims agresivos.

---

## ✅ Pasos para Crear Cada Plantilla

### Paso 1: Haz clic en "Crear plantilla"

---

### Paso 2: Configura los datos básicos

| Campo | Valor |
|-------|-------|
| **Nombre** | (Usa el nombre exacto de arriba) |
| **Idioma** | Spanish |
| **Categoría** | UTILITY O MARKETING (según plantilla) |

---

### Paso 3: Agrega el cuerpo del mensaje

1. Haz clic en **"Agregar cuerpo"**
2. Copia el contenido exacto de la sección **Contenido del cuerpo del mensaje**
3. Meta detectará automáticamente las variables {{1}}, {{2}}, etc.

---

### Paso 4: Envía para revisión

1. Haz clic en **"Enviar"**
2. Meta te mostrará un resumen
3. Confirma que las variables estén correctas
4. Haz clic en **"Enviar para revisión"**

---

## 📌 Puntos Importantes

✅ **Copia exactamente** el texto (incluidos espacios en blanco)  
✅ **No uses emojis**  
✅ **No cambies los {{1}}, {{2}}, {{3}}, etc**  
✅ **Usa UTILITY para transaccionales** (confirmaciones, pagos, recordatorios)  
✅ **Usa MARKETING para promocionales** (recordatorio pago, formulario interés)  
✅ **Idioma: Spanish**

❌ **No uses acentos incorrectos** (copy/paste desde aquí es seguro)  
❌ **No agregues variables adicionales**  
❌ **No uses templates de otros idiomas**

---

## ⏳ Después de Crear

1. **Meta revisará en 24-48 horas**
2. Volverán a estado **APPROVED** o **REJECTED**
3. Si todas son APPROVED, la app comenzará a usarlas automáticamente
4. Verifica el estado ejecutando:
   ```bash
   npm run templates:listar
   ```

---

## 🆘 Si Una Plantilla es Rechazada

Si Meta rechaza alguna plantilla:

1. **Intenta con formato más simple**
   - Menos variables
   - Menos líneas
   - Texto más corto

2. **Ejemplo:** Si `pago_recibido_v2` es rechazada, intenta:
   ```
   Hola {{1}},
   
   Pago de ${{2}} recibido para {{3}}.
   
   Gracias.
   ```

3. **Contacta a Meta Support** si varias son rechazadas

---

## 📱 En la App (Después de Aprobación)

El código ya está 100% listo. Solo necesita actualizar los nombres de templates:

**Cambiar de:**
```typescript
await enviarConfirmacionInscripcion(telefono, nombre, curso, fecha, horario, mensualidad, instructor, fechaPago);
```

**A:**
```typescript
await enviarConfirmacionInscripcion(telefono, nombre, curso, fecha, mensualidad);
```

(Con 4 variables en lugar de 8)

---

## 📊 Resumen Quick Copy-Paste

Puedes copiar directamente el contenido desde abajo para cada plantilla:

**inscripcion_confirmada_v2:**
```
Hola {{1}},

Tu inscripción ha sido confirmada para {{2}}.

Inicio: {{3}}
Mensualidad: ${{4}}

Gracias por elegirnos.
```

**recordatorio_clase_v2:**
```
Hola {{1}},

Recordatorio: Tu clase de {{2}} es hoy a las {{3}}.

Te esperamos.
```

**certificado_disponible_v2:**
```
Felicitaciones {{1}},

Tu certificado para {{2}} está disponible.

Descarga: {{3}}

Estamos orgullosos de tu logro.
```

**pago_recibido_v2:**
```
Hola {{1}},

Te confirmamos que hemos recibido correctamente tu pago de ${{2}} correspondiente a {{3}}.

Referencia: {{4}}

Muchas gracias por tu confianza.
```

**recordatorio_pago_v2:**
```
Hola {{1}},

Recordatorio: Tu pago de ${{2}} para {{3}} vence el {{4}}.

Gracias.
```

**formulario_interes_v2:**
```
Hola {{1}},

Gracias por tu interés en {{2}}.

Inicio: {{3}}

Te contactaremos pronto.
```

---

¡Listo! Crea las plantillas manualmente y avísame cuando estén APPROVED. 🚀
