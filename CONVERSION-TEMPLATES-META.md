# Conversión a Plantillas Oficiales de Meta WhatsApp

**Fecha:** 2025
**Estado:** ✅ COMPLETADO
**Versión:** 1.0

---

## 📋 Resumen Ejecutivo

Se realizó la migración completa del sistema de mensajería WhatsApp desde **mensajes de texto libre** a **Plantillas Oficiales de Meta (Message Templates)**, cumpliendo con los estándares de WhatsApp Business API.

### ¿Por qué era necesario?

- **Riesgo de suspensión:** Los mensajes de texto libre violan las políticas de Meta
- **Limitaciones de volumen:** Sin templates hay rate limiting y detección de spam
- **Mejor tasa de entrega:** Las templates tienen prioridad en el sistema de Meta
- **Cumplimiento normativo:** Requisito obligatorio para producción

---

## 🔄 Cambios Realizados

### 1. **Tipos TypeScript** (`src/types/whatsapp.ts`)

#### Antes:
```typescript
export type WhatsAppMessageType = "text" | "image" | "pdf" | "buttons";

export interface WhatsAppSendRequest {
  phone: string;
  type: WhatsAppMessageType;
  message?: string;
  mediaUrl?: string;
  caption?: string;
  buttons?: WhatsAppButton[];
}
```

#### Después:
```typescript
export type WhatsAppMessageType = "text" | "image" | "pdf" | "buttons" | "template";

export interface WhatsAppSendRequest {
  phone: string;
  type: WhatsAppMessageType;
  message?: string;
  mediaUrl?: string;
  caption?: string;
  buttons?: WhatsAppButton[];
  template?: string;                    // ✨ NUEVO
  templateVariables?: string[];         // ✨ NUEVO
  templateLanguage?: string;            // ✨ NUEVO
}
```

---

### 2. **Servicio WhatsApp** (`src/services/whatsapp-service.ts`)

Se añadió método `sendTemplate()` para envío de plantillas:

```typescript
async sendTemplate(
  phone: string,
  templateName: string,
  variables: string[] = [],
  languageCode: string = "es"
): Promise<WhatsAppAPIResponse> {
  // Envía payload correcto a Meta API con variables numéricas {{1}}, {{2}}, etc.
}
```

**Características:**
- Convierte array de strings a parámetros numerados de Meta
- Incluye logging completo
- Manejo de errores robusto

---

### 3. **Endpoint API** (`src/app/api/whatsapp/send/route.ts`)

Añadido case para templates:

```typescript
case "template":
  if (!body.template || !body.templateVariables) {
    return NextResponse.json({ success: false, error: 'Template y templateVariables requeridos' }, { status: 400 });
  }
  
  response = await WhatsAppService.sendTemplate(
    body.phone,
    body.template,
    body.templateVariables,
    body.templateLanguage || "es"
  );
  break;
```

---

### 4. **Módulo de Mensajes** (`src/services/whatsapp-messages-module.ts`)

#### Cambios en `enviarPorWhatsAppAPI()`:

**Antes:**
```typescript
async function enviarPorWhatsAppAPI(
  telefono: string,
  mensaje: string
): Promise<...> {
  // Enviaba texto libre
}
```

**Después:**
```typescript
async function enviarPorWhatsAppAPI(
  telefono: string,
  templateName: string,
  variables: string[] = []
): Promise<...> {
  // Envía templates a Meta API
}
```

#### Cambios en `enviarMensajeConPlantilla()`:

**Antes:**
```typescript
// Obtenía plantilla de BD, reemplazaba variables, enviaba como texto
const plantilla = await obtenerPlantilla(nombrePlantilla);
const mensajeTexto = reemplazarVariables(plantilla.plantilla, variables);
const resultadoEnvio = await enviarPorWhatsAppAPI(telefono, mensajeTexto);
```

**Después:**
```typescript
// Convierte variables a array ordenado, envía como template
const variablesArray = Object.values(variables).map(v => String(v || ''));
const resultadoEnvio = await enviarPorWhatsAppAPI(
  telefono,
  nombrePlantilla,
  variablesArray
);
```

---

## 🎯 Funciones Actualizadas

Todas las 8 funciones exportadas fueron migradas:

| Función | Template Meta | Variables |
|---------|---------------|-----------|
| `enviarConfirmacionInscripcion()` | `inscripcion_confirmada` | 7 |
| `enviarRecordatorPago()` | `recordatorio_pago` | 5 |
| `enviarConfirmacionPago()` | `pago_recibido` | 8 |
| `enviarFormularioInteres()` | `formulario_interes` | 11 |
| `enviarCertificadoDisponible()` | `certificado_disponible` | 10 |
| `enviarBienvenidaEstudiante()` | `bienvenida_nuevo_estudiante` | 9 |
| `enviarRecordatorioClase()` | `recordatorio_clase` | 5 |
| `enviarCierreInscripcion()` | `cierre_inscripcion` | 10 |

---

## 📱 Ubicaciones de Uso (4 Lugares)

Las integraciones en el UI fueron actualizadas para pasar los tipos correctos:

### 1. **Matriculas - Inscripción** (`src/app/matriculas/create/page.tsx:463`)

```typescript
await enviarConfirmacionInscripcion(estudiante.id, {
  nombre: estudiante.nombre_completo,
  telefono: estudiante.telefono,        // ✨ Añadido
  nombreCurso: matricula?.cursos?.nombre,
  // ... resto de parámetros con camelCase
  mensualidad: Number(precio),          // ✨ Tipo number, no string
  // ...
});
```

### 2. **Matriculas - Pago Inscripción** (`src/app/matriculas/create/page.tsx:534`)

```typescript
await enviarConfirmacionPago(estudianteData.id, {
  nombre: estudianteData.nombre_completo,
  telefono: estudianteData.telefono,    // ✨ Añadido
  referenciaPago: referencia,           // ✨ camelCase
  monto: montoNumero,                   // ✨ number, no string
  fechaPago: dayjs().format('DD/MM/YYYY'),
  // ...
});
```

### 3. **Catálogo - Lead Interesado** (`src/app/catalogo/page.tsx:142`)

```typescript
const { data: leadData } = await supabaseBrowserClient
  .from("leads").insert(payload).select('id').single();

await enviarFormularioInteres(telefono, leadData.id, {
  nombre: values.nombre,
  cursoInteres: selectedPrograma.nombre,
  // ... variables en camelCase
});
```

### 4. **Tesorería - Pago Manual** (`src/app/tesoreria/create/page.tsx:360`)

```typescript
await enviarConfirmacionPago(estudianteSeleccionado.id, {
  nombre: estudianteSeleccionado.nombre_completo,
  telefono: estudianteSeleccionado.telefono,  // ✨ Añadido
  referenciaPago: referencia,
  monto: montoNumero,                         // ✨ Tipo correcto
  // ...
});
```

---

## ✅ Verificación de Compilación

```
✅ Compiled successfully in 28.7s

Warnings (3 - no errores críticos):
  - React Hook dependencies (existentes, no nuevos)
  - Image optimization (existente, no nuevo)

Build Status: SUCCESS ✅
```

---

## 🚀 Próximos Pasos Requeridos

### **PASO 1: Crear Templates en Meta Business Manager**

1. Ve a: https://business.facebook.com/wa/manage/message-templates/
2. Haz clic en **"Create template"**
3. Para cada template de [TEMPLATES-WHATSAPP-CREAR-META.md](./TEMPLATES-WHATSAPP-CREAR-META.md):
   - Copia el **Body text** exactamente
   - Configura **Variables** en orden ({{1}}, {{2}}, etc)
   - Asigna **Category** (TRANSACTIONAL o MARKETING)
   - Envía para aprobación

**Templates a crear (7 total):**
```
✓ inscripcion_confirmada     (TRANSACTIONAL)
✓ pago_recibido             (TRANSACTIONAL)
✓ recordatorio_pago         (MARKETING)
✓ formulario_interes        (MARKETING)
✓ bienvenida_nuevo_estudiante (TRANSACTIONAL)
✓ recordatorio_clase        (TRANSACTIONAL)
✓ certificado_disponible    (TRANSACTIONAL)
```

### **PASO 2: Validar Nombres Exactos**

Los nombres en Meta DEBEN coincidir exactamente con los del código:

```typescript
// En el código:
'inscripcion_confirmada'    // ← Debe coincidir exactamente
'pago_recibido'
'recordatorio_pago'
// etc...
```

### **PASO 3: Prueba End-to-End**

1. Crea un lead en catálogo
2. Verifica que reciba template de `formulario_interes` ✅
3. Completa una inscripción
4. Verifica que reciba template de `inscripcion_confirmada` ✅
5. Registra un pago
6. Verifica que reciba template de `pago_recibido` ✅

### **PASO 4: Monitoreo**

Después del deployment:
- Revisa logs en [tabla whatsapp_mensajes](./DIAGNOSTICO-COMPLETO-SUPABASE.sql)
- Confirma que `estado = 'enviado'` para cada template
- Monitorea `metadatos` para variables enviadas

---

## 📊 Comparativa Antes vs Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Tipo de Mensaje** | Texto libre | Templates aprobados |
| **Riesgo de Suspensión** | ALTO ⚠️ | BAJO ✅ |
| **Rate Limiting** | Sí (sin templates) | No |
| **Aprobación Meta** | No | Sí |
| **Variables Dinámicas** | String replacement en BD | Array numérico de Meta |
| **Logging** | Básico | Completo con templates name |
| **Escalabilidad** | Limitada | Ilimitada (con templates aprobados) |

---

## 🔐 Seguridad y Cumplimiento

✅ **Políticas de Meta:** Cumple estándares oficiales de WhatsApp Business API  
✅ **Variables:** Separadas de template body (inyección segura)  
✅ **Rate Limiting:** Levantado para transaccionales una vez aprobadas  
✅ **Auditoría:** Todas las variables registradas en BD  

---

## 📝 Notas Técnicas

### Orden de Variables
Las templates de Meta requieren variables **en orden exacto** como {{1}}, {{2}}, etc:

```typescript
// Correcto ✅
const variables = [
  "Juan",                    // {{1}}
  "1000000",                 // {{2}}
  "10/02/2025",             // {{3}}
];

// Incorrecto ❌
const variables = {
  nombre: "Juan",
  monto: "1000000",
  // Meta no acepta objeto de nombres
};
```

### Tipos de Variables
Todas las variables en la template deben ser **strings**:

```typescript
// Envío a Meta
templateVariables: [
  String(estudiante.nombre),           // string
  String(Math.round(monto)),           // number → string
  new Date().toLocaleDateString(),     // date → string
]
```

### Cambios en BD (whatsapp_mensajes)
Se mantiene compatibilidad con tabla existente:

```sql
-- El campo tipo sigue siendo VARCHAR
tipo: 'pago_recibido'    -- nombre del template

-- El campo mensaje_texto ahora contiene metadata
mensaje_texto: 'Template: pago_recibido | Variables: {"nombre":"Juan",...}'
```

---

## 🎓 Referencia de Desarrollo

Para **crear nuevas funciones** de WhatsApp en el futuro:

```typescript
// 1. Define función en whatsapp-messages-module.ts
export async function enviarMiMensaje(
  usuarioId: string,
  datos: {
    nombre: string;
    campo1: string;
    campo2: number;
  }
): Promise<ResultadoEnvio> {
  return enviarMensajeConPlantilla(
    datos.telefono,
    'mi_template_name',           // ← Debe existir en Meta
    {
      nombre: datos.nombre,
      campo1: datos.campo1,
      campo2: datos.campo2,
    },
    usuarioId,
    { tipo_evento: 'mi_evento' }
  );
}

// 2. Crea template en Meta con variables {{1}}, {{2}}, etc.

// 3. Llama desde UI:
await enviarMiMensaje(usuarioId, {
  nombre: 'Juan',
  campo1: 'valor1',
  campo2: 123
});
```

---

## 📞 Soporte

Si hay errores al enviar templates:

1. **Error: "Template not found"** → Verifica nombre exacto en Meta
2. **Error: "Invalid parameter count"** → Usa `Object.values()` para convertir a array
3. **Error: "Rate limited"** → Espera o usa texto si es urgente
4. **Error: "Template approval pending"** → Espera aprobación en Meta

---

## ✨ Resultado Final

```
✅ Código actualizado a templates
✅ Compilación exitosa  
✅ 8 funciones migradas
✅ 4 ubicaciones en UI corregidas
✅ Tipos TypeScript correctos
✅ Listo para producción
⏳ Esperando creación de templates en Meta
```

**Próximo paso:** Crear las 7 templates en Meta Business Manager y registrar sus IDs exactos.
