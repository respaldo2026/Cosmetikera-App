# Sistema de Memoria - Agente WhatsApp 🧠

## Resumen

El agente de WhatsApp ahora tiene **memoria de conversaciones** para ser más cercano y amigable:
- 📝 **Recuerda** conversaciones previas
- 👤 **Conoce** el nombre del cliente
- 💬 **Personaliza** cada respuesta
- 💝 **Diferencia** clientes nuevos vs leales

---

## Cómo Funciona

### 1️⃣ **Flujo de Interacción**

```
Cliente envía mensaje
    ↓
Agente recupera contexto (nombre, últimos mensajes, preferencias)
    ↓
Construye prompt mejorado con contexto
    ↓
Gemini genera respuesta personalizada
    ↓
Registra mensaje y respuesta en historial
    ↓
Actualiza "memoria" del cliente
    ↓
Cliente recibe respuesta amigable y contextualizada
```

### 2️⃣ **Componentes de Memoria**

| Componente | Función |
|------------|---------|
| `whatsapp_conversation_history` | Historial completo de chats (todos los mensajes) |
| `whatsapp_customer_memory` | Perfil del cliente: nombre, preferencias, nivel de confianza |
| `get_whatsapp_context()` | Obtiene contexto reciente (últimos 10 mensajes) |
| `update_whatsapp_memory()` | Actualiza perfil del cliente |
| `whatsapp-memory.ts` | Utility TypeScript para usar en API |

---

## Tablas de Base de Datos

### `whatsapp_conversation_history`
Historial de CADA mensaje:

```sql
id              -- UUID
perfil_id       -- Referencia a perfiles (si está autenticado)
telefono        -- Número de WhatsApp
rol             -- "cliente" o "agente"
mensaje         -- Contenido del mensaje
tipo_mensaje    -- "text", "image", "audio"
intento         -- Intención detectada (ej: "consulta_producto")
respuesta_ia    -- Respuesta generada por IA
sentimiento     -- "positive", "neutral", "negative"
created_at      -- Timestamp
```

### `whatsapp_customer_memory`
Perfil del cliente (UNO por cliente):

```sql
id                      -- UUID
perfil_id               -- Referencia a perfiles
telefono                -- Único por cliente
nombre                  -- Nombre recordado
primer_contacto         -- Cuándo empezó
ultima_interaccion      -- Último contacto
total_mensajes          -- Contador
preferencias            -- JSON {temas_favoritos, productos_interesados}
nivel_confianza         -- "nuevo" | "conocido" | "leal"
notas_personales        -- Anotaciones del equipo
contexto_conversacion   -- Resumen de temas tratados
ultimo_tema_tratado     -- Último tema mencionado
```

---

## Funciones SQL

### `get_whatsapp_context(telefono, limit=10)`
**Retorna:**
- `nombre` - Nombre del cliente
- `nivel_confianza` - Tipo de relación
- `historial_reciente` - Últimos N mensajes en JSON
- `preferencias` - Preferencias guardadas
- `ultimo_tema` - Último tema tratado

**Uso:**
```sql
SELECT * FROM get_whatsapp_context('+573104239494', 10);
```

### `update_whatsapp_memory(telefono, perfil_id?, nombre?, tema_tratado?)`
**Actualiza:**
- Nombre del cliente (si se detecta)
- Fecha de última interacción
- Contador de mensajes
- Tema tratado

**Uso:**
```sql
SELECT update_whatsapp_memory(
  '+573104239494',
  'uuid-perfil',
  'María García',
  'consulta de alisado'
);
```

---

## Utility TypeScript (`whatsapp-memory.ts`)

### Obtener Contexto
```typescript
import { getCustomerContext } from "@/utils/whatsapp-memory";

const context = await getCustomerContext(supabase, telefono);
console.log(context.nombre);          // "María García"
console.log(context.nivelConfianza);  // "leal"
console.log(context.ultimoTema);      // "consulta de alisado"
```

### Registrar Mensaje
```typescript
import { logConversationMessage } from "@/utils/whatsapp-memory";

await logConversationMessage(
  supabase,
  telefono,
  perfilId,
  "cliente",
  "Hola, quiero alisado",
  "text"
);
```

### Actualizar Memoria
```typescript
import { updateCustomerMemory } from "@/utils/whatsapp-memory";

await updateCustomerMemory(
  supabase,
  telefono,
  perfilId,
  "María García",
  "consulta de alisado"
);
```

### Construir Prompt Contextualizado
```typescript
import { buildContextualPrompt, extractThemeFromMessage } from "@/utils/whatsapp-memory";

const basePrompt = "Eres asesor de La Cosmetikera...";
const enhancedPrompt = buildContextualPrompt(basePrompt, context);

// El prompt ahora incluye:
// - Nombre del cliente
// - Últimos mensajes intercambiados
// - Tema anterior
// - Instrucciones de tono personalizado
```

### Extraer Tema
```typescript
import { extractThemeFromMessage } from "@/utils/whatsapp-memory";

const tema = extractThemeFromMessage("Quiero un alisado con keratina");
// Retorna: "productos para alisado"
```

---

## Integración en Endpoint de Chat

**Flujo mejorado en `/api/ai/chat`:**

```typescript
// 1. Recuperar contexto del cliente
const context = await getCustomerContext(supabase, phone);

// 2. Registrar mensaje del cliente
await logConversationMessage(supabase, phone, perfilId, "cliente", mensaje);

// 3. Construir prompt mejorado con contexto
const enhancedPrompt = buildContextualPrompt(basePrompt, context);

// 4. Generar respuesta con Gemini
const response = await gemini.generateContent(enhancedPrompt);

// 5. Registrar respuesta del agente
await logConversationMessage(supabase, phone, perfilId, "agente", response);

// 6. Extraer tema y actualizar memoria
const tema = extractThemeFromMessage(mensaje);
await updateCustomerMemory(supabase, phone, perfilId, nombre, tema);

// 7. Retornar respuesta
return { response, intent: tema };
```

---

## Ejemplos de Personalización

### Primer Contacto
```
Cliente: Hola, es la primera vez que me contacto
Agente: ¡Hola! Bienvenido a La Cosmetikera 🎀
        ¿Cuál es tu nombre para brindarte mejor atención?
```
*Tono: Cálido pero profesional*

### Cliente Conocido
```
Cliente: Necesito otro alisado
Agente: ¡Hola María! 😊 Veo que te fue bien con el alisado anterior.
        ¿Quieres la misma marca o probamos una diferente?
```
*Tono: Amigable, reconoce relación anterior*

### Cliente Leal (6+ meses)
```
Cliente: Hola, qué hay de nuevo
Agente: ¡Hola María! 💕 ¿Cómo está tu cabello? 
        Tengo una promoción especial para ti esta semana...
```
*Tono: Muy cercano, familiar, ofrece beneficios*

---

## Niveles de Confianza (Automáticos)

Se actualizan según interacciones:

| Nivel | Criterio |
|-------|----------|
| **nuevo** | 1er contacto |
| **conocido** | 2-5 interacciones O 2-6 semanas |
| **leal** | 6+ interacciones O 3+ meses OR cliente del club |

---

## Próximos Pasos

1. ✅ Migración SQL creada
2. ✅ Utilities TypeScript listos
3. ⏳ **Actualizar `/api/ai/chat`** para usar memoria
4. ⏳ Ejecutar migraciones en Supabase
5. ⏳ Testing con clientes reales

---

## Monitoreo

### Ver historial de cliente
```sql
SELECT * FROM whatsapp_conversation_history
WHERE telefono = '+573104239494'
ORDER BY created_at DESC
LIMIT 50;
```

### Ver perfil de memoria
```sql
SELECT nombre, nivel_confianza, total_mensajes, ultimo_tema_tratado
FROM whatsapp_customer_memory
WHERE telefono = '+573104239494';
```

### Ver evolución de cliente
```sql
SELECT 
  DATE(created_at) as fecha,
  COUNT(*) as mensajes,
  STRING_AGG(DISTINCT rol, ', ') as interaccion
FROM whatsapp_conversation_history
WHERE telefono = '+573104239494'
GROUP BY DATE(created_at)
ORDER BY fecha DESC;
```

---

**Creado:** 28 de abril de 2026
**Versión:** 1.0
**Objetivo:** Agente amigable, personalizado, con memoria
