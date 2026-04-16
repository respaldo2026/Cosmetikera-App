# 📱 Plan de Trabajo WhatsApp - Mientras Espera Aprobación del Número

**Estado Actual (Febrero 2026):** ✅ API Cloud configurada | ⏳ Número de prueba (FB) | ⏳ Aprobación del número real

---

## 🎯 Visión General

Mientras espera la aprobación del número real, pueden:
1. **Crear todas las plantillas de mensajes** en la BD
2. **Implementar funciones de envío** para cada caso de uso
3. **Integrar con Make** para automatizaciones
4. **Preparar webhooks** para recibir respuestas
5. **Testing exhaustivo** con el número de prueba

El mismo número se usará para:
- 🤖 **Make:** Agente que responde publicidad de redes
- 📱 **App:** Información de cursos, recordatorios de pago, confirmaciones, notificaciones

---

## 📋 Tareas Organizadas por Prioridad

### **FASE 1: PLANTILLAS DE MENSAJES** (3-4 días)
Crear y almacenar todas las plantillas que se necesitarán

#### 1.1️⃣ Crear Plantillas en la BD
**Archivo:** `create-plantillas-whatsapp.sql` (ya existe)

**Plantillas a crear:**
```sql
-- Ya debe estar en la BD:
✅ plantillas_whatsapp (tabla)

-- Insertar estos templates:
```

| Tipo | Nombre | Descripción | Uso |
|------|--------|-------------|-----|
| 1 | `inscripcion_confirmada` | Confirmación de inscripción | App |
| 2 | `recordatorio_pago` | Recordatorio de cuota vencida | App / Automático |
| 3 | `pago_recibido` | Confirmación de pago | App / Automático |
| 4 | `informacion_curso` | Datos del curso solicitado | App |
| 5 | `formulario_interes` | Lead interesado (desde Make) | Make |
| 6 | `seguimiento_leads` | Seguimiento de leads (Make) | Make |
| 7 | `certificado_disponible` | Certificado listo | App / Automático |
| 8 | `bienvenida_nuevo_estudiante` | Bienvenida al curso | App |
| 9 | `recordatorio_clase` | Recordatorio de clase próxima | Automático |
| 10 | `cierre_inscripcion` | Cierre de inscripción | Automático |

**Estructura de cada plantilla:**
```json
{
  "nombre": "inscripcion_confirmada",
  "descripcion": "Se envía cuando un estudiante se inscribe",
  "plantilla": "Hola {{nombre}},\n\n¡Bienvenido a {{nombre_curso}}!\n\nTus datos:\n- Inicio: {{fecha_inicio}}\n- Horario: {{horario}}\n- Mensualidad: {{mensualidad}}\n\nResponde este mensaje si tienes dudas.",
  "variables": ["nombre", "nombre_curso", "fecha_inicio", "horario", "mensualidad"],
  "tipo": "transaccional",
  "activa": true
}
```

**Action:** Ejecutar SQL o usar UI de Supabase para insertar cada uno

---

### **FASE 2: FUNCIONES DE ENVÍO** (2-3 días)
Implementar servicios para enviar cada tipo de mensaje

#### 2.1️⃣ Crear Módulo `whatsapp-messages-module.ts`
**Ubicación:** `src/services/whatsapp-messages-module.ts`

**Propósito:** Función específica para cada caso de uso

```typescript
// Ejemplos de funciones a crear:

export const enviarConfirmacionInscripcion = async (
  userId: string,
  courseData: { nombre: string; fecha_inicio: string; horario: string }
) => {
  // 1. Obtener teléfono del usuario
  // 2. Obtener plantilla "inscripcion_confirmada"
  // 3. Reemplazar variables
  // 4. Enviar por WhatsApp
  // 5. Guardar log en BD (tabla whatsapp_mensajes)
}

export const enviarReminderPago = async (
  userId: string,
  monthData: { mes: string; monto: number }
) => { ... }

export const enviarConfirmacionPago = async (
  paymentId: string
) => { ... }

export const enviarInformacionCurso = async (
  phoneNumber: string,
  courseId: string
) => { ... }

export const enviarSeguimientoLead = async (
  leadId: string,
  mensaje: string
) => { ... }
```

---

### **FASE 3: TABLA DE LOGS** (1 día)
Rastrear todos los mensajes enviados

#### 3.1️⃣ Crear Tabla `whatsapp_mensajes`
```sql
CREATE TABLE IF NOT EXISTS public.whatsapp_mensajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    telefono VARCHAR(20) NOT NULL,
    tipo VARCHAR(50) NOT NULL,  -- 'inscripcion', 'pago', etc
    plantilla_id UUID REFERENCES plantillas_whatsapp(id),
    mensaje_texto TEXT NOT NULL,
    estado VARCHAR(20) DEFAULT 'enviado',  -- 'enviado', 'fallido', 'leído'
    message_id VARCHAR(100),  -- ID de WhatsApp
    metadatos JSONB,  -- Datos adicionales (curso, pago, etc)
    respuesta_esperada BOOLEAN DEFAULT false,
    respuesta_recibida TEXT,
    creado_en TIMESTAMP DEFAULT now(),
    actualizado_en TIMESTAMP DEFAULT now()
);
```

---

### **FASE 4: INTEGRACIONES EN LA APP** (2-3 días)
Conectar los servicios con los flujos de la app

#### 4.1️⃣ Inscripciones
**Archivo:** Encontrar donde se crea la inscripción

**Agregar:**
```typescript
// Después de crear inscripción en BD
await enviarConfirmacionInscripcion(userId, courseData);
```

#### 4.2️⃣ Pagos
**Archivo:** Lógica de procesamiento de pagos

**Agregar:**
```typescript
// Cuando se recibe pago
await enviarConfirmacionPago(paymentId);

// Recordatorio automático (scheduler)
// Ejecutar diariamente a las 10 AM
```

#### 4.3️⃣ Información de Cursos (Página de Cursos)
**Agregar botón:** "📱 Enviarme por WhatsApp"

```typescript
// Cuando usuario hace click
const handleEnviarPorWhatsApp = async (courseId: string) => {
  await enviarInformacionCurso(userPhone, courseId);
  // Mostrar confirmación
};
```

---

### **FASE 5: PREPARAR PARA MAKE** (2 días)
Endpoints y estructura para que Make pueda interactuar

#### 5.1️⃣ Endpoint de Webhook Entrante
**Ubicación:** `src/app/api/whatsapp/webhook/route.ts`

**Propósito:** Recibir mensajes de usuarios (Make lo maneja ahora, pero necesitamos la estructura)

```typescript
// POST /api/whatsapp/webhook
// {
//   "messages": [{
//     "from": "573001234567",
//     "text": { "body": "Hola, me interesa el curso..." },
//     "timestamp": "1234567890"
//   }]
// }

// Guardar en tabla: whatsapp_conversaciones
```

#### 5.2️⃣ Tabla de Conversaciones
```sql
CREATE TABLE IF NOT EXISTS public.whatsapp_conversaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telefono VARCHAR(20) NOT NULL,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo_contacto VARCHAR(50),  -- 'cliente', 'lead', 'estudiante'
    ultimo_mensaje_in TEXT,
    ultimo_mensaje_out TEXT,
    ultima_interaccion TIMESTAMP DEFAULT now(),
    estado VARCHAR(20) DEFAULT 'activa',  -- 'activa', 'pausada', 'cerrada'
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    metadatos JSONB,
    creado_en TIMESTAMP DEFAULT now()
);
```

#### 5.3️⃣ Endpoint para que Make Envíe Mensajes
**Usar:** `/api/whatsapp/send` (ya existe) ✅

**Make configuration en el webhook de Make:**
```json
{
  "phone": "{{trigger.from}}",
  "type": "text",
  "message": "Respuesta del agente de Make..."
}
```

---

### **FASE 6: TESTING CON NÚMERO DE PRUEBA** (2-3 días)
Probar todo antes del número real

#### 6.1️⃣ Plan de Testing

**Casos a probar:**
- ✅ Enviar texto simple
- ✅ Enviar con plantilla
- ✅ Variables se reemplazan correctamente
- ✅ Se guarda en logs
- ✅ Se puede recibir respuesta (webhook)
- ✅ Make puede enviar mensajes
- ✅ Números con y sin WhatsApp
- ✅ Manejo de errores

**Números para testing:**
- Tu número personal (pruebas básicas)
- Número de un amigo (pruebas de recepción)
- Números sin WhatsApp (validar error)

---

### **FASE 7: AUTOMATIZACIONES** (2-3 días)
Procesos automáticos que se ejecutan sin intervención

#### 7.1️⃣ Recordatorios de Pago
```typescript
// Ejecutar cada día a las 10 AM (usando Vercel Cron o similar)
export async function handlePaymentReminders() {
  const pagos = await supabase
    .from('pagos')
    .select('*')
    .eq('estado', 'pendiente')
    .lt('fecha_vencimiento', today + 3 days);
    
  for (const pago of pagos) {
    await enviarReminderPago(pago.usuario_id, {
      mes: pago.mes,
      monto: pago.monto
    });
  }
}
```

#### 7.2️⃣ Recordatorios de Clases
```typescript
// Ejecutar 1 hora antes de cada clase
export async function handleClassReminders() {
  const clases = await getClasesProximas(1);
  // Enviar a todos los inscritos
}
```

#### 7.3️⃣ Confirmación de Certificados
```typescript
// Cuando se marque un estudiante como graduado
await enviarCertificadoDisponible(userId);
```

---

## 🛠️ Orden de Implementación Recomendado

### **SEMANA 1:**
1. ✅ **Lunes:** Crear todas las plantillas en BD (FASE 1)
2. ✅ **Martes-Miércoles:** Módulo de funciones de envío (FASE 2)
3. ✅ **Jueves:** Tabla de logs (FASE 3)
4. ✅ **Viernes:** Testing inicial

### **SEMANA 2:**
1. ✅ **Lunes-Martes:** Integración con inscripciones y pagos (FASE 4)
2. ✅ **Miércoles:** Preparar estructura para Make (FASE 5)
3. ✅ **Jueves-Viernes:** Testing exhaustivo (FASE 6)

### **SEMANA 3:**
1. ✅ **Lunes-Miércoles:** Automatizaciones (FASE 7)
2. ✅ **Jueves:** Documentación
3. ✅ **Viernes:** Listo para número real

---

## 📊 Checklist por Fase

### FASE 1: PLANTILLAS ✅
- [ ] Tabla `plantillas_whatsapp` creada
- [ ] 10 plantillas insertadas
- [ ] Probadas en la BD

### FASE 2: FUNCIONES ✅
- [ ] `whatsapp-messages-module.ts` creado
- [ ] 5+ funciones específicas implementadas
- [ ] Tipos TypeScript definidos
- [ ] Manejo de errores

### FASE 3: LOGS ✅
- [ ] Tabla `whatsapp_mensajes` creada
- [ ] RLS policies configuradas
- [ ] Logs se guardan en cada envío

### FASE 4: INTEGRACIONES ✅
- [ ] Inscripción → WhatsApp
- [ ] Pago → WhatsApp
- [ ] Info curso → WhatsApp
- [ ] Testing manual

### FASE 5: MAKE ✅
- [ ] Tabla `whatsapp_conversaciones` creada
- [ ] Webhook entrante listo
- [ ] Make puede enviar mensajes
- [ ] Logs de conversaciones

### FASE 6: TESTING ✅
- [ ] 8+ casos probados
- [ ] No hay errores críticos
- [ ] Respuestas funcionan

### FASE 7: AUTOMATIZACIONES ✅
- [ ] Recordatorios de pago automáticos
- [ ] Recordatorios de clases
- [ ] Certificados
- [ ] Cron jobs configurados

---

## 💡 Ventajas de Hacer Esto Ahora

✅ Cuando llegue el número real, **ya está todo listo**
✅ Aprovechas el número de prueba para **testing completo**
✅ **Ganas experiencia** con la API antes de producción
✅ Los usuarios **reciben confirmaciones inmediatas**
✅ **Reducen carga** de atencion manual
✅ **Mejoras en retención** de estudiantes
✅ **Automatizaciones** que ahorran tiempo

---

## 🔐 Consideraciones de Seguridad

- [ ] No guardar teléfonos sin consentimiento
- [ ] Implementar RGPD/GDPR compliance
- [ ] Logs encriptados en BD
- [ ] API key de Make rotada periódicamente
- [ ] Rate limiting en endpoints
- [ ] Validación de números telefónicos

---

## 📞 Cuando Llegue el Número Real

1. Cambiar `WHATSAPP_PHONE_NUMBER_ID` en `.env`
2. Cambiar `WHATSAPP_ACCESS_TOKEN` en `.env`
3. **TODO LO DEMÁS YA FUNCIONA** ✅
4. Ejecutar testing final
5. Notificar a usuarios (opcional)

---

**Estimado Total:** 2-3 semanas de trabajo (puede ser menos con equipo)
**Bloqueadores:** Ninguno - todo se puede hacer ahora con número de prueba
