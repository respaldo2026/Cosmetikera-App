# Automatización: Mensaje de Bienvenida al Club La Cosmetikera

## Resumen
Cuando un cliente se inscribe en el Club La Cosmetikera, recibirá un **mensaje de WhatsApp automático** con:
- Plantilla **pre-aprobada por Meta** (cumple normas)
- Personalizada con su número de cédula
- Instrucciones para acceder a la app
- Beneficios del club (puntos, canjes, cumpleaños, etc.)

## Normas de Meta
✅ Usa plantilla pre-aprobada (no texto libre)
✅ Mensaje transaccional (se envía 1 vez por cliente)
✅ Cumple normas de seguridad y anti-spam
✅ Mayor garantía de entrega

## Paso 1: Crear Plantilla en Meta Business Manager

**IMPORTANTE:** Este paso es OBLIGATORIO antes de usar el endpoint.

1. Ir a **https://business.facebook.com**
2. **Apps > Apps and Assets** o **WhatsApp > Message Templates**
3. Click en **Create Template**
4. Completar formulario:
   - **Template Name**: `club_welcome_es`
   - **Category**: TRANSACTIONAL (o MARKETING)
   - **Language**: Spanish (es)
   - **Message Content** (copia tal cual):
   ```
   ¡Bienvenido a Club La Cosmetikera! 🎀

   Ahora puedes acceder a beneficios exclusivos:
   ✨ Acumula puntos en cada compra
   🎁 Canjes especiales cada mes
   🎂 Bonificaciones en tu cumpleaños
   🤝 Ganancias extra por referidas

   📱 Accede a la app con tu número de cédula: {{1}}

   Tu asesor personal está aquí para orientarte.
   ¡Que disfrutes siendo parte de nuestro club! 💕
   ```

5. **Submit for Review**
6. Esperar aprobación de Meta (~24-48 horas)

**Variable:** `{{1}}` = número de cédula

---

## Componentes Creados

### 1. **Plantilla de WhatsApp** (`plantillas_whatsapp` en Supabase)
- **Nombre**: "Bienvenida al Club"
- **Variable**: `{{cedula}}`
- **Referencia**: Plantilla `club_welcome_es` en Meta
- **Contenido**: Mensaje transaccional aprobado por Meta

**SQL ejecutado:**
```sql
INSERT INTO public.plantillas_whatsapp (nombre, descripcion, plantilla, variables, activa)
VALUES (
  'Bienvenida al Club',
  'Plantilla de Meta: club_welcome_es - Se envía cuando un cliente se inscribe al Club',
  'Plantilla pre-aprobada en Meta Business Manager',
  ARRAY['cedula'],
  true
);
```

⚠️ Esta tabla es de **referencia/auditoría**. El contenido real viene de Meta.

### 2. **Tabla `notificaciones_enviadas`**
- Rastrea todos los mensajes enviados
- Campos: `perfil_id`, `tipo`, `telefono`, `mensaje`, `estado`, `respuesta_whatsapp`, `intentos`
- Evita duplicados con `UNIQUE(perfil_id, tipo)`

### 3. **Tabla `club_inscripciones`**
- Registra cuándo se inscribió un cliente al club
- Campo `notificacion_enviada` para trackear si se envió el mensaje
- Sirve como auditoría

### 4. **Endpoint API**
**POST `/api/whatsapp/send-club-welcome`**

**Autenticación:**
- Header `x-api-key` con valor de `WHATSAPP_API_KEY` env var
- O sesión autenticada (usuario logged in)

**Payload esperado:**
```json
{
  "perfil_id": "uuid-del-cliente",
  "cedula": "1234567890",
  "telefono": "+57 310 4239494"  // opcional, se busca en perfiles si falta
}
```

**Qué hace:**
1. Valida autenticación
2. Busca teléfono del cliente (si no viene en payload)
3. **Envía plantilla pre-aprobada de Meta** (`club_welcome_es`)
4. Registra en `notificaciones_enviadas` (auditoría)
5. Registra en `club_inscripciones` (confirmación)

**Response:**
```json
{
  "success": true,
  "message": "Mensaje de bienvenida enviado correctamente",
  "whatsapp_response": {
    "messages": [{ "id": "wamid.xxx", "message_status": "accepted" }]
  }
}
```

**Errores posibles:**
- 401: No autorizado (API key inválida)
- 404: No se encontró teléfono
- 400: Plantilla no aprobada en Meta, o error de envío
- 500: Error de configuración

## Integración con Make.com

### ⚠️ Pre-requisito
**La plantilla `club_welcome_es` DEBE estar aprobada en Meta antes de continuar.**

### Opción 1: Automatización Manual (Recomendado al inicio)

1. **En Ventas → Registro de Cliente:**
   - Un admin presiona botón "Enviar Bienvenida al Club"
   - Esto llama POST `/api/whatsapp/send-club-welcome`

2. **En Make.com - Nuevo Escenario:**
   - **Trigger**: Manual (cuando presiona botón) o webhook de Supabase
   - **Acción 1**: Recuperar datos del cliente (cedula, telefono)
   - **Acción 2**: Llamar HTTP POST a `/api/whatsapp/send-club-welcome` con:
     ```json
     {
       "perfil_id": {{perfil.id}},
       "cedula": {{perfil.cedula}},
       "telefono": {{perfil.telefono}}
     }
     ```
   - **Headers**: 
     ```
     x-api-key: {{env.WHATSAPP_API_KEY}}
     Content-Type: application/json
     ```

### Opción 2: Automático con Webhook (Avanzado)

1. **Crear trigger en Supabase:**
   ```sql
   CREATE OR REPLACE TRIGGER trigger_club_inscripcion
   AFTER INSERT ON club_inscripciones
   FOR EACH ROW
   EXECUTE FUNCTION send_club_welcome_webhook();
   ```

2. **Crear función que llame webhook de Make:**
   ```sql
   CREATE OR REPLACE FUNCTION send_club_welcome_webhook()
   RETURNS TRIGGER AS $$
   BEGIN
     -- Llamar webhook de Make
     PERFORM http_post('https://hook.make.com/...',
       json_build_object(
         'perfil_id', NEW.perfil_id,
         'cedula', ...
       )
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

## Flujo Operativo Propuesto

### Paso 1: Cliente se inscribe en club (en la tienda)
- Se actualiza `perfiles` con datos de fidelización
- Se crea registro en `club_inscripciones`

### Paso 2: Admin ve notificación
- Opción A: Botón en UI de "Enviar Bienvenida al Club"
- Opción B: Make detecta automáticamente y envía

### Paso 3: Make.com envía mensaje
- Llama a `/api/whatsapp/send-club-welcome`
- Endpoint envía mensaje por WhatsApp Cloud API
- Registra en `notificaciones_enviadas` (éxito/error)

### Paso 4: Cliente recibe WhatsApp
```
¡Bienvenido a Club La Cosmetikera! 🎀

Ahora puedes acceder a beneficios exclusivos:
✨ Acumula puntos en cada compra
🎁 Canjes especiales cada mes
🎂 Bonificaciones en tu cumpleaños
🤝 Ganancias extra por referidas

📱 Accede a la app con tu número de cédula: 1234567890

Tu asesor personal está aquí para orientarte.
¡Que disfrutes siendo parte de nuestro club! 💕
```

## Variables de Entorno Requeridas

```env
WHATSAPP_PHONE_NUMBER_ID=1136369709553286
WHATSAPP_ACCESS_TOKEN=EAAC...  # (rotado)
WHATSAPP_API_KEY=tu-api-key-secreto
NEXT_PUBLIC_SUPABASE_URL=https://gzrogwpbkkynhuostxle.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Testing

### Pre-requisito
✅ Plantilla `club_welcome_es` aprobada en Meta

### 1. Desde Postman/cURL:
```bash
curl -X POST http://localhost:3000/api/whatsapp/send-club-welcome \
  -H "x-api-key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "perfil_id": "550e8400-e29b-41d4-a716-446655440000",
    "cedula": "1234567890",
    "telefono": "+57 310 4239494"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Mensaje de bienvenida enviado correctamente",
  "whatsapp_response": {
    "messages": [{
      "id": "wamid.HBEUGEpyXXXXXXXXXXXX",
      "message_status": "accepted"
    }]
  }
}
```

### 2. Desde Make.com:
1. Crear nuevo scenario
2. Add HTTP module → POST
3. URL: `https://app.cosmetikera.com/api/whatsapp/send-club-welcome`
4. Headers: 
   ```
   x-api-key: {tu-api-key}
   Content-Type: application/json
   ```
5. Body (JSON): payload de arriba

### 3. Verificar en el cliente
- ✅ Cliente debe recibir WhatsApp con plantilla aprobada
- ✅ Mensaje incluye cédula para acceso a app
- ✅ Timestamp de recepción en Meta Dashboard

## Monitoreo

### Ver notificaciones enviadas:
```sql
SELECT * FROM notificaciones_enviadas
WHERE tipo = 'bienvenida_club'
ORDER BY created_at DESC
LIMIT 50;
```

### Ver inscripciones al club:
```sql
SELECT 
  ci.perfil_id,
  p.nombre_completo,
  p.cedula,
  p.telefono,
  ci.fecha_inscripcion,
  ci.notificacion_enviada
FROM club_inscripciones ci
JOIN perfiles p ON ci.perfil_id = p.id
ORDER BY ci.fecha_inscripcion DESC;
```

## Próximos Pasos

1. ✅ **Migración SQL ejecutada** (`plantillas_whatsapp`, `notificaciones_enviadas`, `club_inscripciones`)
2. ✅ **Endpoint API creado** (`/api/whatsapp/send-club-welcome` con plantillas de Meta)
3. ⏳ **URGENTE: Crear plantilla en Meta** - `club_welcome_es` (ver "Paso 1" arriba)
4. ⏳ **Esperar aprobación de Meta** (~24-48 horas)
5. ⏳ **Setup Make.com** - Conectar escenario con endpoint
6. ⏳ **Testing** - Probar con cliente de prueba
7. ⏳ **Deploy a producción** - Actualizar env vars en servidor
8. ⏳ **Monitoreo continuo** - Revisar logs de `notificaciones_enviadas` y Meta Dashboard

---

**Creado:** 28 de abril de 2026
**Versión:** 2.0 (Plantillas de Meta)
**Normas:** ✅ Cumple políticas de Meta para mensajes transaccionales
