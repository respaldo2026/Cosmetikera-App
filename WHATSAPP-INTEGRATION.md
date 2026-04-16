# Guía de Integración con WhatsApp Business Cloud API

## 📋 Descripción

Esta integración permite que **Make** solicite a la aplicación el envío de mensajes por WhatsApp (texto, imágenes, PDFs, botones interactivos) usando el mismo número conectado.

**Importante:**
- ✅ La app **SOLO ENVÍA** mensajes (no recibe)
- ✅ Make maneja el webhook de WhatsApp (recepción de mensajes)
- ✅ Make decide cuándo y qué enviar
- ❌ La app NO responde automáticamente

---

## 🏗️ Arquitectura

```
Usuario de WhatsApp
       ↓
    WhatsApp
       ↓
   [Webhook] → Make (gestiona conversación)
                ↓ (cuando sea necesario)
           POST /api/whatsapp/send
                ↓
           Tu App Next.js
                ↓
          WhatsApp Cloud API
                ↓
          Usuario recibe mensaje
```

---

## 📁 Archivos Creados

### 1. Tipos TypeScript
**`src/types/whatsapp.ts`**
- Define todos los tipos para requests, responses y payloads de la API

### 2. Servicio Centralizado
**`src/services/whatsapp-service.ts`**
- `WhatsAppService.sendText()` - Enviar texto simple
- `WhatsAppService.sendImage()` - Enviar imagen por URL
- `WhatsAppService.sendPDF()` - Enviar documento PDF
- `WhatsAppService.sendButtons()` - Enviar mensaje con botones (máx 3)
- `WhatsAppService.checkCredentials()` - Verificar configuración

### 3. Endpoint API
**`src/app/api/whatsapp/send/route.ts`**
- `POST /api/whatsapp/send` - Recibe solicitudes de Make
- `GET /api/whatsapp/send` - Verificación de estado

---

## ⚙️ Configuración

### 1. Obtener Credenciales de WhatsApp

1. Ve a [Meta for Developers](https://developers.facebook.com/)
2. Crea o selecciona tu app
3. Ve a **WhatsApp > API Setup**
4. Copia:
   - **Phone Number ID** (no es el número de teléfono, es un ID largo)
   - **Access Token** (genera un token permanente)

### 2. Configurar Variables de Entorno

Agrega a tu archivo `.env.local`:

```env
# WhatsApp Business Cloud API
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxx
WHATSAPP_API_KEY=clave_secreta_compartida_con_make
```

**Importante:**
- `WHATSAPP_PHONE_NUMBER_ID`: ID del número (aparece en Meta Dashboard)
- `WHATSAPP_ACCESS_TOKEN`: Token de acceso (puede ser temporal o permanente)
- `WHATSAPP_API_KEY`: Clave secreta que Make enviará en header `x-api-key`

### 3. Verificar Configuración

Inicia el servidor:
```bash
npm run dev
```

Prueba el endpoint de verificación:
```bash
curl http://localhost:3001/api/whatsapp/send
```

Respuesta esperada:
```json
{
  "status": "ok",
  "service": "WhatsApp Business Cloud API",
  "configured": true
}
```

---

## 🚀 Uso desde Make

### Endpoint Principal

```
POST https://tu-dominio.com/api/whatsapp/send
```

### Headers Requeridos

```
Content-Type: application/json
x-api-key: tu_clave_secreta (la de WHATSAPP_API_KEY)
```

### Ejemplos de Payloads

#### 1. Enviar Texto Simple

```json
{
  "phone": "573001234567",
  "type": "text",
  "message": "¡Hola! Gracias por tu interés en nuestros cursos."
}
```

#### 2. Enviar Imagen

```json
{
  "phone": "573001234567",
  "type": "image",
  "mediaUrl": "https://tu-dominio.com/images/pensum-curso.jpg",
  "caption": "Este es el pensum del curso de inglés nivel A1"
}
```

#### 3. Enviar PDF

```json
{
  "phone": "573001234567",
  "type": "pdf",
  "mediaUrl": "https://tu-dominio.com/pdfs/precios-2026.pdf",
  "caption": "Lista de precios actualizada"
}
```

#### 4. Enviar Mensaje con Botones

```json
{
  "phone": "573001234567",
  "type": "buttons",
  "message": "¿Qué información te gustaría recibir?",
  "buttons": [
    { "id": "ver_pensum", "title": "Ver Pensum" },
    { "id": "ver_precios", "title": "Ver Precios" },
    { "id": "hablar_asesor", "title": "Hablar con Asesor" }
  ]
}
```

**Restricciones de botones:**
- Mínimo 1, máximo 3 botones
- Título máximo 20 caracteres
- ID único para cada botón

### Respuesta Exitosa

```json
{
  "success": true,
  "messageId": "wamid.HBgNNTczMDA...",
  "phone": "573001234567"
}
```

### Respuesta con Error

```json
{
  "success": false,
  "error": "El tipo 'image' requiere el campo 'mediaUrl'"
}
```

---

## 🔧 Flujo Recomendado en Make

### Escenario 1: Usuario solicita pensum

```
1. Usuario envía: "Quiero ver el pensum"
2. Make recibe el mensaje (webhook)
3. Make identifica la intención
4. Make llama a tu API:
   POST /api/whatsapp/send
   {
     "phone": "573001234567",
     "type": "image",
     "mediaUrl": "https://tu-dominio.com/pensum-ingles.jpg",
     "caption": "Aquí está el pensum del curso"
   }
5. Usuario recibe la imagen
```

### Escenario 2: Presentar opciones

```
1. Usuario dice: "Hola"
2. Make recibe y responde (usando Make)
3. Make envía botones a través de tu API:
   POST /api/whatsapp/send
   {
     "phone": "573001234567",
     "type": "buttons",
     "message": "¿En qué podemos ayudarte?",
     "buttons": [
       {"id": "info_cursos", "title": "Info de Cursos"},
       {"id": "precios", "title": "Precios"},
       {"id": "inscripcion", "title": "Inscribirme"}
     ]
   }
4. Usuario hace clic en un botón
5. Make recibe el callback y actúa
```

---

## 🔒 Seguridad

### Autenticación con API Key

El endpoint valida que Make envíe el header:
```
x-api-key: tu_clave_secreta
```

Si no coincide con `WHATSAPP_API_KEY`, responde `401 Unauthorized`.

### Recomendaciones

1. **Usa HTTPS** en producción (Vercel lo maneja automáticamente)
2. **Rota la API key** periódicamente
3. **No expongas las variables de entorno** en el frontend
4. **Limita el rate limit** en Make si es necesario
5. **Monitorea los logs** de envíos fallidos

---

## 🐛 Debugging

### Ver logs del servicio

Los logs aparecen en la terminal donde corre `npm run dev`:

```
[WhatsApp] Enviando texto a 573001234567
[WhatsApp] ✓ Mensaje enviado. ID: wamid.HBgNNTczMDA...
```

### Verificar credenciales

```bash
curl http://localhost:3001/api/whatsapp/send
```

Si `configured: false`, revisa que las variables de entorno estén correctas.

### Errores comunes

#### Error: "Faltan credenciales de WhatsApp"
- ✅ Verifica que `.env.local` tenga `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_ACCESS_TOKEN`

#### Error: "WhatsApp API error: Invalid OAuth access token"
- ✅ El token expiró o es inválido. Genera uno nuevo en Meta Dashboard

#### Error: "No autorizado"
- ✅ Make no está enviando el header `x-api-key` correcto

#### Error: "El tipo 'buttons' requiere 'message' y 'buttons'"
- ✅ El payload de Make está incompleto

---

## 📊 Limitaciones de WhatsApp

### Ventana de Conversación (24 horas)

WhatsApp permite enviar mensajes sin plantilla aprobada **solo durante 24 horas** después de que el usuario te escriba.

**Solución:**
- Make debe registrar el timestamp del último mensaje del usuario
- Si pasaron más de 24 horas, usar plantillas aprobadas (Message Templates)

### Tipos de Archivos Soportados

- **Imágenes**: JPG, PNG (máx 5 MB)
- **Documentos**: PDF (máx 100 MB)
- **Videos**: MP4, 3GP (máx 16 MB)
- **Audio**: AAC, MP3, AMR, OGG (máx 16 MB)

Esta integración implementa **imagen** y **PDF**. Para otros tipos, extender `WhatsAppService`.

---

## 🚀 Próximos Pasos

### 1. Probar en Local

```bash
npm run dev
```

Usa Postman o curl para probar el endpoint.

### 2. Configurar Make

- Crea un módulo HTTP Request en Make
- URL: `https://tu-dominio.com/api/whatsapp/send`
- Método: POST
- Headers: `x-api-key` con tu clave
- Body: JSON según el tipo de mensaje

### 3. Deploy a Producción

```bash
git add .
git commit -m "feat: Integración WhatsApp Business Cloud API"
git push origin main
```

Vercel desplegará automáticamente.

### 4. Usar en Producción

Cambia la URL en Make de `localhost:3001` a tu dominio real.

---

## 📚 Recursos

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Tipos de Mensajes Soportados](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/message-templates)
- [Configurar Webhook](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Meta for Developers](https://developers.facebook.com/)

---

## ✅ Checklist de Implementación

- [x] Crear tipos TypeScript (`src/types/whatsapp.ts`)
- [x] Crear servicio WhatsApp (`src/services/whatsapp-service.ts`)
- [x] Crear endpoint API (`src/app/api/whatsapp/send/route.ts`)
- [x] Agregar variables de entorno (`.env.example`)
- [ ] Configurar credenciales en `.env.local`
- [ ] Obtener Phone Number ID de Meta Dashboard
- [ ] Obtener Access Token de Meta Dashboard
- [ ] Crear API key para Make
- [ ] Probar endpoint localmente
- [ ] Configurar Make para usar el endpoint
- [ ] Desplegar a producción
- [ ] Probar flujo completo con un número real

---

## 🎯 Casos de Uso Recomendados

### Academia Crystal Diamante

1. **Envío de Pensum**: Imagen con el pensum del curso
2. **Lista de Precios**: PDF con precios actualizados
3. **Material Informativo**: Imágenes o PDFs con información
4. **Botones de Acción**: "Ver Cursos", "Hablar con Asesor", "Inscribirme"
5. **Confirmaciones**: Mensajes de texto con datos de inscripción

---

¿Necesitas ayuda? Revisa los logs en la terminal o inspecciona las respuestas del endpoint.
