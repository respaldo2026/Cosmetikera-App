# 🤖 Configurar Agente IA en Make con Personalidad del Marketing Center

**Objetivo:** Que Make use la personalidad y conocimiento configurados en Marketing Center para responder mensajes de WhatsApp.

---

## ✅ Pre-requisitos

1. ✅ Marketing Center funcionando (personalidad guardada en Supabase)
2. ✅ Endpoint `/api/ai/chat` desplegado y funcionando
3. ✅ Variables de entorno configuradas:
   - `GEMINI_API_KEY`
   - `WHATSAPP_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## 📋 Configuración en Make (Escenario de Respuesta)

### Paso 1: Crear/Editar Escenario de WhatsApp

En tu escenario de Make donde recibes mensajes de WhatsApp:

```
[Webhook: Mensaje entrante de WhatsApp]
    ↓
[Router/Filter: ¿Es mensaje de usuario?]
    ↓
[HTTP Request: Llamar a /api/ai/chat]  ← NUEVO
    ↓
[HTTP Request: Enviar respuesta por /api/whatsapp/send]
```

---

### Paso 2: Configurar Módulo HTTP Request - Agente IA

**Agregar módulo después de recibir el mensaje:**

#### Configuración del Módulo:

**URL:**
```
https://tu-dominio-vercel.app/api/ai/chat
```
O si pruebas local:
```
http://localhost:3001/api/ai/chat
```

**Method:**
```
POST
```

**Headers:**
```json
{
  "x-api-key": "crystal_whatsapp_2026_X9aP7Lq82",
  "Content-Type": "application/json"
}
```

**Body Type:**
```
Raw
```

**Body (JSON):**
```json
{
  "message": "{{1.message}}",
  "phone": "{{1.from}}",
  "context": "whatsapp"
}
```

Donde:
- `{{1.message}}` = el texto del mensaje que recibiste del webhook
- `{{1.from}}` = el teléfono del usuario

---

### Paso 3: Parsear Respuesta del Agente

El endpoint `/api/ai/chat` devuelve:

```json
{
  "ok": true,
  "response": "¡Hola! Soy Dany, asistente de la Academia...",
  "agent": "Dany",
  "knowledgeUsed": true,
  "media_suggestion": {
    "type": "image",
    "mediaUrl": "https://...",
    "caption": "Así vivimos las clases en Academia Crystal ✨",
    "sendBeforeText": true,
    "intent": "horario"
  },
  "media_send_order": "image_then_text"
}
```

**En el siguiente módulo (enviar WhatsApp), usa:**
- Variable para el mensaje: `{{2.response}}`
- Donde `2` es el número del módulo HTTP que llamó a `/api/ai/chat`
- Si viene `{{2.media_suggestion.mediaUrl}}`, enviar primero imagen y luego el texto

---

### Paso 4: Enviar Respuesta por WhatsApp

**Orden recomendado (para reforzar confianza):**
1. Si existe `{{2.media_suggestion.mediaUrl}}` → enviar imagen (`type: image`)
2. Luego enviar el texto normal (`type: text`, `message: {{2.response}}`)

**HTTP Request - Enviar:**

**URL:**
```
https://tu-dominio-vercel.app/api/whatsapp/send
```

**Method:**
```
POST
```

**Headers:**
```json
{
  "x-api-key": "crystal_whatsapp_2026_X9aP7Lq82",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "phone": "{{1.from}}",
  "type": "text",
  "message": "{{2.response}}"
}
```

**HTTP Request adicional (imagen opcional):**

**Body:**
```json
{
  "phone": "{{1.from}}",
  "type": "image",
  "mediaUrl": "{{2.media_suggestion.mediaUrl}}",
  "caption": "{{2.media_suggestion.caption}}"
}
```

---

## 🧪 Testing

### Prueba 1: Cambiar Nombre del Agente

1. Ve a Marketing Center
2. En "Agente IA", cambia `Nombre del agente` de "Dany" a "Sofia"
3. Guarda
4. Envía mensaje de prueba en WhatsApp: "Hola, ¿quién eres?"
5. **Resultado esperado:** El agente responde "Hola, soy Sofia..."

### Prueba 2: Cambiar Prompt

1. Ve a Marketing Center
2. En "Prompt de sistema", agrega: "Siempre termina tus respuestas con un emoji 🎓"
3. Guarda
4. Envía mensaje: "¿Qué cursos ofrecen?"
5. **Resultado esperado:** La respuesta termina con 🎓

### Prueba 3: Verificar Conocimiento

1. Ve a Marketing Center
2. En "Conocimiento del agente", sube un PDF con info de cursos
3. Espera a que se indexe (debe decir "Documento indexado")
4. Envía mensaje: "¿Cuánto cuesta el curso de Python?"
5. **Resultado esperado:** Si el PDF tenía esa info, el agente la usa en su respuesta

---

## 🔍 Debugging

### Si las respuestas no cambian:

1. **Verifica que se guardó en Supabase:**
   ```sql
   SELECT persona_name, speaking_style, system_prompt 
   FROM agent_settings 
   WHERE id = 1;
   ```
   ¿Ves los cambios que hiciste?

2. **Prueba el endpoint directamente:**
   ```bash
   curl -X POST https://tu-dominio.app/api/ai/chat \
     -H "x-api-key: crystal_whatsapp_2026_X9aP7Lq82" \
     -H "Content-Type: application/json" \
     -d '{
       "message": "Hola, ¿quién eres?",
       "phone": "573001234567"
     }'
   ```
   ¿La respuesta usa la personalidad nueva?

3. **Revisa logs de Make:**
   - En el historial del escenario, abre una ejecución
   - Ve el módulo de `/api/ai/chat`
   - ¿Qué respuesta recibió?
   - ¿Usó esa respuesta para enviar el mensaje?

4. **Verifica la API key:**
   - En Make, asegura que el header `x-api-key` tenga el valor correcto
   - Debe coincidir con `WHATSAPP_API_KEY` en tu `.env.local`

---

## 📊 Variables de Make (recomendadas)

Crea estas variables en Make (Data Stores o Variables de escenario):

```
API_BASE_URL = https://tu-dominio-vercel.app
API_KEY = crystal_whatsapp_2026_X9aP7Lq82
```

Luego usa en URLs y headers:
```
URL: {{API_BASE_URL}}/api/ai/chat
Header x-api-key: {{API_KEY}}
```

---

## 🎯 Flujo Completo (Diagrama)

```
Usuario envía WhatsApp
    ↓
Meta Webhook → Make
    ↓
Make extrae: mensaje, teléfono
    ↓
Make POST /api/ai/chat
    ↓
API lee agent_settings (Supabase)
    ↓
API lee agent_chunks (conocimiento)
    ↓
API construye prompt personalizado
    ↓
API llama Gemini
    ↓
API devuelve respuesta a Make
    ↓
Make POST /api/whatsapp/send
    ↓
Meta envía respuesta al usuario
```

**Cualquier cambio en Marketing Center → se refleja en la próxima llamada**

---

## ⚡ Quick Fix: Si sigue sin funcionar

1. **Asegura que Make llame al endpoint correcto:**
   - Debe ser `/api/ai/chat` (no `/api/ai/generate`)
   - Verifica la URL completa en el módulo HTTP

2. **Reinicia el servidor Node (local):**
   ```bash
   Ctrl+C
   npm run dev
   ```

3. **En Vercel (producción):**
   - Haz un nuevo deploy
   - O fuerza redeploy del último commit

4. **Verifica que la migración se aplicó:**
   ```sql
   -- En Supabase SQL Editor:
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'agent_settings';
   ```
   Debe incluir: `persona_name`, `persona_bio`, `speaking_style`, `greeting`, `fallback_response`

---

## 📝 Resumen

**Lo que cambió:**
- Antes: Make tenía prompts hardcoded o usaba otro endpoint
- Ahora: Make llama a `/api/ai/chat` que lee dinámicamente de Supabase

**Ventaja:**
- Editas en Marketing Center
- Guardas
- **Las respuestas de Make cambian inmediatamente** sin reconfigurar el escenario

**No necesitas tocar Make cada vez que ajustas la personalidad ✅**

---

## 🆘 Soporte

Si después de seguir estos pasos las respuestas no cambian:

1. Pega en consola el log del módulo HTTP `/api/ai/chat` de Make
2. Pega el resultado de `SELECT * FROM agent_settings WHERE id=1` en Supabase
3. Verifica que el endpoint esté desplegado: `curl https://tu-dominio.app/api/ai/chat`

---

**¡Con esto Make debería usar la personalidad configurada en Marketing Center!** 🎉
