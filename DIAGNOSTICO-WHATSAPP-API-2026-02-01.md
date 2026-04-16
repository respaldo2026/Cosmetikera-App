# 🔍 DIAGNÓSTICO API WHATSAPP - 1 Feb 2026

## ❌ Resultado: API NO ESTÁ FUNCIONANDO

### Problema Identificado
**Error HTTP 400: Invalid OAuth access token - Cannot parse access token**

El access token configurado en `.env.local` es inválido. Esto puede ocurrir por:
1. **Token expirado** - Los tokens de Meta/WhatsApp expiran después de cierto tiempo
2. **Token incorrecto** - El token no fue generado correctamente
3. **Datos de configuración desincronizados** - El Phone ID no coincide con el token

---

## 📋 Estado Actual de la Configuración

### Variables de Entorno ✅
```
WHATSAPP_PHONE_NUMBER_ID: 925756067295565 ✅ Configurado
WHATSAPP_ACCESS_TOKEN: [202 caracteres] ❌ INVÁLIDO/EXPIRADO
WHATSAPP_WABA_ID: 1635512034083590 ✅ Configurado
WHATSAPP_API_KEY: crystal_whatsapp_2026_X9aP7Lq82 ✅ Configurado
```

### Integración en el Código ✅
- **Cliente WhatsApp (web.me)**: `src/utils/whatsapp.ts` - ✅ FUNCIONA
  - Abre enlace wa.me directamente en el navegador
  - No requiere API de Meta
  
- **API Meta WhatsApp**: `src/modules/comunicacion/whatsapp.service.ts` - ❌ NO FUNCIONA
  - Requiere token válido para enviar mensajes automáticos
  - Actualmente inactivo

---

## 🔧 SOLUCIÓN: Generar Nuevo Access Token

### Paso 1: Acceder a Meta Business Suite
1. Ir a: https://business.facebook.com/
2. Iniciar sesión con la cuenta empresarial

### Paso 2: Obtener el Nuevo Token
1. Ir a **Configuración** → **Apps y sitios web** → **Apps**
2. Seleccionar la app de WhatsApp (Academia Crystal)
3. Ir a **Configuración** → **Básica**
4. En **Tokens de acceso de aplicación**, copiar el token

### Paso 3: Generar Token de Teléfono
1. Ir a **WhatsApp** → **Configuración** → **API**
2. En la sección "Phone Number ID", generar un nuevo token permanente
3. Copiar el token de acceso

### Paso 4: Actualizar .env.local
Reemplazar el token actual:
```env
# ANTES:
WHATSAPP_ACCESS_TOKEN=EAATPWNbkGbYBQmZAcBbHx9S0YZABPQnApZAjD8o960xJdgJi4dvZCor3AUUhrQ1XWaDy1c65OwIS3hAXc6wEQcQe5qpO07vqcobJYss1eoaZBvFjgELZCHACyJ2OVZCij1bOaTIVrE4JQKTXEZBndg8tCebAmd49A4hqbZClEE3kcZCiorxEZCUFS1Gd4UbX3g60gZDZD

# DESPUÉS: (Reemplazar con el nuevo token)
WHATSAPP_ACCESS_TOKEN=[NUEVO_TOKEN_AQUI]
```

### Paso 5: Verificar Nuevamente
```bash
npm run test:whatsapp
```

---

## 📊 Uso Actual de WhatsApp en la Aplicación

### 1. Contacto Directo (✅ Funciona)
**Archivo**: `src/utils/whatsapp.ts`
- Método: Abre wa.me en navegador
- No requiere API
- Usa: `enviarWhatsapp(telefono, mensaje)`

```typescript
// Ejemplo:
enviarWhatsapp("573001234567", "Hola, tengo una pregunta sobre mi inscripción");
```

### 2. Plantillas de WhatsApp (❌ Requiere API válida)
**Archivo**: `src/constants/whatsappTemplates.ts`
- Método: Usar plantillas predefinidas de Meta
- Requiere: Access token válido
- Usa: `enviarWhatsappConPlantilla(telefono, nombrePlantilla, variables)`

Plantillas configuradas:
- `inscripcion_academica` - Confirmación de inscripción
- `actualizacion_pagos` - Notificación de pago
- `recordatorio_curso` - Recordatorio de clase

---

## 🚀 Próximos Pasos

### Inmediatos (Crítico)
1. [ ] Generar nuevo access token en Meta Business Suite
2. [ ] Actualizar `.env.local` con el nuevo token
3. [ ] Ejecutar `node test-whatsapp-api.js` para verificar
4. [ ] Desplegar cambios a producción

### A Mediano Plazo
1. [ ] Configurar webhooks para recibir mensajes
2. [ ] Crear plantillas de mensajes en Meta
3. [ ] Implementar sistema de notificaciones automáticas
4. [ ] Probar envío de mensajes a números reales

### Consideraciones de Seguridad
- ⚠️ **NO hacer commit** del access token en el repositorio
- ✅ Usar variables de entorno en `.env.local` y `.env.production`
- ✅ Rotar el token cada 3-6 meses
- ✅ Monitorear el uso en Meta Business Suite

---

## 📞 Documentación de Referencia

- **Meta WhatsApp API**: https://developers.facebook.com/docs/whatsapp/cloud-api/
- **Phone IDs**: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers
- **Access Tokens**: https://developers.facebook.com/docs/facebook-login/access-tokens

---

**Fecha del diagnóstico**: 1 de febrero de 2026  
**Estado**: ❌ API NO OPERATIVA - Requiere nuevo token
