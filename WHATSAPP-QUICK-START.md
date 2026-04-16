# 🚀 WhatsApp Integration - Guía Rápida para Make

## Estado Actual

- ✅ Código compilado sin errores
- ✅ Variables de entorno configuradas
- ✅ Endpoint listo: `POST /api/whatsapp/send`
- ✅ Servicio WhatsAppService con 4 métodos

---

## 📋 Configuración Base en Make

### URL
```
POST https://tu-dominio.com/api/whatsapp/send
```

### Headers
```
Content-Type: application/json
x-api-key: crystal_whatsapp_2026_X9aP7Lq82
```

---

## 💬 Ejemplos de Payload

### 1️⃣ Enviar Texto Simple

```json
{
  "phone": "573001234567",
  "type": "text",
  "message": "¡Hola! Gracias por tu interés en nuestros cursos."
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "messageId": "wamid.HBgNNTczMDA...",
  "phone": "573001234567"
}
```

---

### 2️⃣ Enviar Imagen (Pensum)

```json
{
  "phone": "573001234567",
  "type": "image",
  "mediaUrl": "https://tu-dominio.com/images/pensum-ingles.jpg",
  "caption": "Pensum del curso de Inglés A1"
}
```

**Requisitos:**
- URL debe ser pública (accesible)
- Formatos: JPG, PNG
- Máximo: 5 MB

---

### 3️⃣ Enviar PDF (Precios)

```json
{
  "phone": "573001234567",
  "type": "pdf",
  "mediaUrl": "https://tu-dominio.com/pdfs/precios-2026.pdf",
  "caption": "Lista de precios actualizada 2026"
}
```

**Requisitos:**
- URL pública
- Máximo: 100 MB

---

### 4️⃣ Enviar Botones Interactivos

```json
{
  "phone": "573001234567",
  "type": "buttons",
  "message": "¿Qué información necesitas?",
  "buttons": [
    { "id": "btn_pensum", "title": "Ver Pensum" },
    { "id": "btn_precios", "title": "Ver Precios" },
    { "id": "btn_asesor", "title": "Hablar Asesor" }
  ]
}
```

**Restricciones:**
- Mínimo: 1 botón
- Máximo: 3 botones
- Título: máximo 20 caracteres

---

## 🔄 Flujo Recomendado en Make

```
1. Usuario envía mensaje por WhatsApp
   ↓ (Make recibe por webhook - ya existe)
   
2. Make procesa el mensaje
   ↓ (Identifica intención, contexto, etc.)
   
3. Make decide qué información enviar
   ↓
   
4. Make hace HTTP Request a tu API
   ↓ (POST /api/whatsapp/send)
   
5. Tu app envía mensaje por WhatsApp Cloud API
   ↓
   
6. Usuario recibe el mensaje
   ↓ (imagen, PDF, botones, texto, etc.)
   
7. Si hay botones, usuario hace clic
   ↓ (Make recibe callback por webhook)
   
8. Ciclo se repite...
```

---

## 🔢 Formato de Números Telefónicos

La app **normaliza automáticamente** los números, pero mejor envía en este formato:

✅ **Correcto:**
- `573001234567` (código país + número)
- `573211234567` (Colombia con cualquier código)

❌ **No es necesario:**
- `+573001234567` (la app lo convierte)
- `03001234567` (la app agrega 57 si es 10 dígitos)

**Si el número es de otro país:**
```
España:     34912345678
México:     525512345678
Argentina:  541112345678
```

---

## ✅ Validaciones Importantes

### Antes de enviar a Make:

| Campo | Validación | Ejemplo |
|-------|-----------|---------|
| `phone` | Obligatorio, formato int'l | `573001234567` |
| `type` | Obligatorio | `text`, `image`, `pdf`, `buttons` |
| `message` | Requerido si type=text o buttons | "Hola" |
| `mediaUrl` | Requerido si type=image o pdf | URL pública |
| `buttons` | Requerido si type=buttons | Array 1-3 items |
| `x-api-key` | Header obligatorio | `crystal_whatsapp_2026_X9aP7Lq82` |

---

## ❌ Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `No autorizado` | API key incorrecta o falta header | Verifica `x-api-key` en headers |
| `Faltan campos requeridos: phone, type` | Payload incompleto | Incluye `phone` y `type` obligatoriamente |
| `El tipo 'image' requiere el campo 'mediaUrl'` | Falta URL de archivo | Agrega `mediaUrl` si es tipo image/pdf |
| `Debes enviar entre 1 y 3 botones` | Array inválido | Envía 1, 2 o 3 botones máximo |
| `El botón excede 20 caracteres` | Título muy largo | Acorta a máximo 20 caracteres |
| `WhatsApp API error: Invalid OAuth token` | Token expirado o inválido | Genera nuevo token en Meta Dashboard |

---

## 🕐 Ventana de Conversación (Importante)

WhatsApp solo permite enviar mensajes **sin plantilla aprobada** durante **24 horas** después de que el usuario te escriba.

```
Hora 0: Usuario te escribe → puedes responder sin plantilla
Hora 1-23: Puedes seguir respondiendo sin plantilla
Hora 24+: Necesitas plantilla aprobada por Meta
```

**Recomendación en Make:**
1. Registra `timestamp` de cada mensaje entrante
2. Antes de enviar, calcula si estamos dentro de 24 horas
3. Si pasó, cambia a usar `Message Templates`

---

## 🔐 Seguridad

### Variables de Entorno (No expongas)

```env
WHATSAPP_PHONE_NUMBER_ID=858541797335480        # ID del número
WHATSAPP_ACCESS_TOKEN=EAATPWNbkGbYBQ...        # Token secreto
WHATSAPP_API_KEY=crystal_whatsapp_2026_X9aP7Lq82  # Clave para Make
```

### Buenas Prácticas

✅ **Protege la API key**
- No la compartas públicamente
- Usa HTTPS en producción (Vercel lo hace)
- Rota periódicamente

✅ **Valida en Make**
- Verifica que el número sea válido antes de enviar
- Evita envíos duplicados
- Registra intentos fallidos

✅ **Rate Limiting**
- WhatsApp permite límites según tu cuenta
- No hagas spam
- Respetar ventana de 24 horas

---

## 🧪 Probar Localmente (Opcional)

Si quieres probar antes de configurar Make:

### Terminal 1: Inicia servidor
```bash
npm run dev
```

### Terminal 2: Prueba el endpoint

```bash
# Verificar que esté listo
curl http://localhost:3001/api/whatsapp/send

# Enviar texto (reemplaza number con uno real)
curl -X POST http://localhost:3001/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: crystal_whatsapp_2026_X9aP7Lq82" \
  -d '{
    "phone": "573001234567",
    "type": "text",
    "message": "Prueba desde curl"
  }'
```

---

## 📚 Documentación Completa

Para más detalles consulta:
- **[WHATSAPP-INTEGRATION.md](WHATSAPP-INTEGRATION.md)** — Guía técnica completa
- **[src/services/whatsapp-service.ts](src/services/whatsapp-service.ts)** — Código del servicio
- **[src/app/api/whatsapp/send/route.ts](src/app/api/whatsapp/send/route.ts)** — Código del endpoint

---

## 📝 Tipos Disponibles

```typescript
type WhatsAppMessageType = "text" | "image" | "pdf" | "buttons";
```

| Type | Campos Requeridos | Campos Opcionales |
|------|------------------|-------------------|
| `text` | phone, message | — |
| `image` | phone, mediaUrl | caption |
| `pdf` | phone, mediaUrl | caption |
| `buttons` | phone, message, buttons | — |

---

## 🎯 Checklist Antes de Ir a Producción

- [ ] Variables de entorno configuradas en servidor
- [ ] Token de WhatsApp validado en Meta Dashboard
- [ ] API key compartida solo con Make (servidor a servidor)
- [ ] HTTPS habilitado en dominio (Vercel = automático)
- [ ] Probaste un envío real de cada tipo
- [ ] Instalaste manejo de errores en Make
- [ ] Documentaste el flujo en Make
- [ ] Informaste al equipo sobre ventana de 24h

---

## 🚀 Próximo Paso

Configura el módulo HTTP en Make con los ejemplos arriba y ¡comienza a enviar mensajes!

**¿Necesitas ayuda?** Revisa los ejemplos JSON y copia/pega directamente en Make.
