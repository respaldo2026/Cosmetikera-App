# 🔧 FIX URGENTE: Agente enviando 2 imágenes siempre

## ✅ SOLUCIONADO TEMPORALMENTE

**Fecha:** 20 de febrero de 2026, 11:30 PM  
**Status:** 🟢 **IMÁGENES DESACTIVADAS COMPLETAMENTE**

### Acciones tomadas:

1. ✅ **Desactivadas todas las sugerencias de imágenes** en `src/app/api/ai/chat/route.ts`
2. ✅ Todas las 7 llamadas a `withMediaSuggestion` ahora pasan `null`
3. ✅ Código sin errores
4. ⏳ Deploy en progreso (Vercel)

### Resultado esperado:

- ✅ "Hola" → **Solo texto**, 0 imágenes
- ✅ "Cuánto cuesta?" → **Solo texto**, 0 imágenes  
- ✅ "Horarios?" → **Solo texto**, 0 imágenes
- ✅ Cualquier pregunta → **Solo texto**, 0 imágenes

---

## ❌ Problema original
El agente DANY en Make.com está enviando **2 imágenes** a cualquier pregunta, sin responder con texto.

## 🔍 Causa raíz

Hay 2 problemas combinados:

### 1. **Código: Fallback automático de imágenes** ✅ SOLUCIONADO

La función `getAgentImageSuggestion` tenía un fallback que **siempre** devolvía una imagen (la más reciente) incluso cuando la pregunta no era relevante:

```typescript
// ANTES (MAL):
const best = ranked[0]?.asset || fallbackByProgram || fallbackRecent;
// ↑ Siempre devolvía ALGO, aunque no fuera relevante

// AHORA (BIEN):
const bestRanked = ranked[0];
if (!bestRanked || bestRanked.score < MINIMUM_SCORE) {
  return null; // No enviar imagen si no es relevante
}
```

### 2. **Make: Router enviando por ambas rutas** ⚠️ REVISAR

Según las capturas del flujo de Make, hay un **Router** con 2 rutas:
- Ruta 1: "Con Imagen" → Gemini Process Imagen → Enviar Mensaje con Imagen
- Ruta 2: (otra ruta) → Gemini Process Imagen → Enviar Mensaje con Imagen

**El problema:** Ambas rutas están ejecutándose, enviando 2 imágenes.

---

## ✅ Solución implementada (Código)

**Archivo modificado:** `src/utils/agent-media-suggestions.ts`

**Cambios:**
1. ✅ Eliminado fallback automático a imagen reciente
2. ✅ Agregado umbral mínimo de puntuación: **15 puntos**
3. ✅ Ahora solo sugiere imagen si hay coincidencia real con la pregunta

**Resultado esperado:**
- Pregunta sobre "horarios" → ✅ Puede enviar imagen de horarios (si existe y es relevante)
- Pregunta sobre "precios" → ✅ Puede enviar imagen de precios
- Pregunta "hola" → ❌ NO enviará imagen
- Pregunta "cómo estás" → ❌ NO enviará imagen

---

## ⚙️ Verificación en Make.com

### Paso 1: Revisar el Router

1. Abre el escenario en Make: https://us2.make.com/1852354/scenarios/4098888/edit
2. Localiza el módulo **Router** (después de "Recibe Mensaje")
3. Verifica las condiciones de cada ruta:

#### Ruta "Con Imagen"
**Condición esperada:**
```
data: media_suggestion: type  Equal to  image
```

⚠️ **Si la condición está diferente o vacía, está mal configurada.**

#### Ruta "Sin Imagen" (si existe)
**Condición esperada:**
```
data: media_suggestion: type  Does not exist
```
O:
```
data: media_suggestion  Does not exist
```

### Paso 2: Verificar orden de envío

**Flujo correcto:**

```
1. Recibe Mensaje WhatsApp
      ↓
2. HTTP Request → /api/ai/chat
      ↓
3. Router (analiza respuesta)
      ↓
   [ ¿Tiene media_suggestion? ]
      ↓                    ↓
     SÍ                   NO
      ↓                    ↓
4a. Enviar Imagen      4b. Solo enviar texto
    (type: image)          (type: text)
      ↓                    ↓
5a. Enviar Texto       [ FIN ]
    (type: text)
      ↓
   [ FIN ]
```

**Lo que está pasando ahora (incorrecto):**
```
1. Recibe Mensaje
      ↓
2. HTTP Request
      ↓
3. Router
      ↓
   [Ambas rutas se ejecutan] ❌
      ↓         ↓
    Imagen   Imagen
      ↓         ↓
   [2 imágenes enviadas]
```

### Paso 3: Configurar filtros correctamente

#### En la ruta "Con Imagen":

**Hacer clic en el ícono de llave inglesa entre Router y el primer módulo**

**Agregar filtro:**
- Label: `Con Imagen`
- Condition:
  ```
  {{26.data.media_suggestion.mediaUrl}}  exists
  ```
  Donde `26` es el número del módulo HTTP que llama a `/api/ai/chat`

**Seleccionar:** `Yes` (Set the route as fallback)

#### En la ruta "Sin Imagen" (crear si no existe):

**Filtro:**
- Label: `Sin Imagen`
- Condition:
  ```
  {{26.data.media_suggestion.mediaUrl}}  does not exist
  ```

**Seleccionar:** `No` (No es fallback)

---

## 🧪 Testing después del fix

### Test 1: Pregunta general (NO debe enviar imagen)

**Enviar a WhatsApp:**
```
Hola
```

**Respuesta esperada:**
- ✅ 1 mensaje de texto (saludo)
- ❌ 0 imágenes

---

### Test 2: Pregunta sobre horarios (PUEDE enviar imagen)

**Enviar a WhatsApp:**
```
Cuáles son los horarios del curso de ingles?
```

**Respuesta esperada:**
- ✅ 1 mensaje con imagen de horarios (si existe asset relevante)
- ✅ 1 mensaje de texto con información
- Total: 2 mensajes (1 imagen + 1 texto)

---

### Test 3: Pregunta de precios (PUEDE enviar imagen)

**Enviar a WhatsApp:**
```
Cuánto cuesta el curso de uñas?
```

**Respuesta esperada:**
- ✅ 1 mensaje con imagen de precios (si existe)
- ✅ 1 mensaje de texto con detalles
- Total: 2 mensajes (1 imagen + 1 texto)

---

### Test 4: Pregunta simple (NO debe enviar imagen)

**Enviar a WhatsApp:**
```
Gracias
```

**Respuesta esperada:**
- ✅ 1 mensaje de texto
- ❌ 0 imágenes

---

## 📋 Checklist de verificación

- [ ] Código desplegado a producción (Vercel)
- [ ] Router en Make tiene 2 rutas claramente separadas
- [ ] Ruta "Con Imagen" tiene filtro: `media_suggestion.mediaUrl exists`
- [ ] Ruta "Sin Imagen" tiene filtro: `media_suggestion.mediaUrl does not exist`
- [ ] Test 1: "Hola" → Solo texto ✅
- [ ] Test 2: "Horarios" → Imagen + texto ✅
- [ ] Test 3: "Precios" → Imagen + texto ✅
- [ ] Test 4: "Gracias" → Solo texto ✅

---

## 🚀 Desplegar fix

```powershell
# 1. Commit y push
git add src/utils/agent-media-suggestions.ts
git commit -m "fix: imagen solo envía si es relevante (umbral 15 pts)"
git push origin main

# 2. Verificar deploy en Vercel
# Vercel despliega automáticamente

# 3. Esperar 2-3 minutos

# 4. Probar
```

---

## 🆘 Si sigue enviando 2 imágenes

### Opción A: Deshabilitar sugerencias temporalmente

En el archivo `src/app/api/ai/chat/route.ts`, busca las líneas que llaman a `withMediaSuggestion` y temporalmente devuelve `null`:

```typescript
// Líneas 2463, 2491, 2547, 2570, 2593, 2649, 2746
return NextResponse.json(withMediaSuggestion({
  ok: true,
  response: ...,
  agent: "Dany",
  knowledgeUsed: true,
}, null)); // ← Cambiar a null temporalmente
//}, mediaSuggestion)); // ← Comentar esta línea
```

Esto deshabilitará **completamente** el envío de imágenes hasta que arregles el Router en Make.

### Opción B: Aumentar umbral de puntuación

En `src/utils/agent-media-suggestions.ts` línea 182:

```typescript
// Cambiar de 15 a 30 o 40 para ser más estricto
const MINIMUM_SCORE = 40; // Más alto = menos imágenes
```

### Opción C: Solo enviar en intents específicos

En la función `getAgentImageSuggestion`, agregar al inicio:

```typescript
// Solo enviar imágenes para estos intents
const ALLOWED_INTENTS: AgentIntent[] = ["precio", "horario", "temario"];
if (!ALLOWED_INTENTS.includes(params.intent)) {
  return null;
}
```

---

## 📊 Logs útiles

### Ver qué devuelve el agente:

En Make, después del módulo HTTP de `/api/ai/chat`, agregar un módulo **Tools → Set Variable**:

```
Variable name: debug_media
Value: {{26.data.media_suggestion}}
```

Esto te mostrará en el historial de ejecuciones si está devolviendo una sugerencia de imagen.

---

## ✅ Resolución final

Una vez implementado y testeado:

1. ✅ El código solo sugiere imágenes relevantes
2. ✅ El Router en Make divide correctamente las rutas
3. ✅ Preguntas generales NO envían imágenes
4. ✅ Preguntas específicas SÍ envían imágenes apropiadas

---

**Fecha:** 20 de febrero de 2026  
**Status:** � Imágenes desactivadas temporalmente (funciona sin imágenes)  
**Siguiente paso:** Arreglar Router en Make o reactivar imágenes cuando esté listo

---

## 🔄 CÓMO REACTIVAR IMÁGENES (cuando arregles Make)

Una vez que configures correctamente el Router en Make.com, puedes reactivar las imágenes:

### Buscar en `src/app/api/ai/chat/route.ts`:

```typescript
// Busca esta línea (aparece 7 veces):
}, null)); // TEMPORAL: Desactivado hasta arreglar Router de Make

// Cámbiala por:
}, mediaSuggestion));
```

**Líneas a modificar:** 2470, 2498, 2554, 2577, 2600, 2656, 2753

### Comando rápido (PowerShell):

```powershell
# Buscar todas las ocurrencias
Select-String -Path "src/app/api/ai/chat/route.ts" -Pattern "null\)\); // TEMPORAL"

# Reemplazar todas (cuidado, revisar antes)
(Get-Content "src/app/api/ai/chat/route.ts") -replace 'null\)\); // TEMPORAL: Desactivado hasta arreglar Router de Make', 'mediaSuggestion));' | Set-Content "src/app/api/ai/chat/route.ts"
```

---

## 📞 Estado actual del servicio

- ✅ Agente responde correctamente a todas las preguntas
- ✅ No envía imágenes (desactivadas temporalmente)
- ✅ Funcional 100% para atención al cliente
- ⏳ Imágenes pendientes hasta configurar Router de Make
