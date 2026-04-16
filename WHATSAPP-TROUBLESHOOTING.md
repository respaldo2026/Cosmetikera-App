# 🔧 Solución de Problemas - WhatsApp Cloud API

## Error: "Account not registered" (Código 133010)

### ❌ Problema
```
WhatsApp API error: (#133010) Account not registered
```

### ✅ Causas y Soluciones

#### 1. **Número de Teléfono No Registrado**

El número al que intentas enviar **NO tiene WhatsApp** o está inactivo.

**Solución:**
- Verifica que el número tenga WhatsApp instalado y activo
- Prueba enviando a tu propio número primero
- Usa números que conozcas que tienen WhatsApp

**Ejemplo válido:**
```
573001234567  ✓ (Número colombiano con WhatsApp)
```

---

#### 2. **Formato de Número Incorrecto**

WhatsApp es muy estricto con el formato.

**Formato correcto:**
```
[Código país][Número sin espacios ni símbolos]

✓ 573001234567  (Colombia)
✓ 34912345678   (España)
✓ 525512345678  (México)

✗ +57 300 123 4567  (tiene espacios y +)
✗ 3001234567        (falta código país)
✗ 57-300-123-4567   (tiene guiones)
```

---

#### 3. **Credenciales Incorrectas**

Verifica tu `.env.local`:

```env
WHATSAPP_PHONE_NUMBER_ID=858541797335480
WHATSAPP_ACCESS_TOKEN=EAATPWNbkGbYBQ...
```

**Cómo verificar:**

1. Ve a [Meta for Developers](https://developers.facebook.com/)
2. Selecciona tu app
3. Ve a **WhatsApp > API Setup**
4. Verifica que:
   - El **Phone Number ID** coincida
   - El **Access Token** sea válido (no expirado)
   - El número esté **verificado**

---

#### 4. **Número No Verificado en Meta Dashboard**

Tu número de WhatsApp Business debe estar verificado.

**Pasos:**
1. Ve a Meta Dashboard > WhatsApp > Getting Started
2. Verifica que el número tenga un ✓ verde
3. Si no, sigue el proceso de verificación

---

#### 5. **Ventana de Conversación (24 horas)**

WhatsApp solo permite mensajes **sin plantilla aprobada** durante 24 horas después de que el usuario te escriba.

**Solución:**
- Si el usuario NO te ha escrito en las últimas 24h, necesitas usar **Message Templates** aprobados por Meta
- O el usuario debe iniciar la conversación primero

---

## Otros Errores Comunes

### Error 131031: Token Inválido

```
WhatsApp API error: (#131031) Invalid OAuth access token
```

**Solución:**
1. Ve a Meta Dashboard > WhatsApp > API Setup
2. Genera un nuevo **Access Token**
3. Actualiza `WHATSAPP_ACCESS_TOKEN` en `.env.local`
4. Reinicia el servidor

---

### Error 100: Parámetro Inválido

```
WhatsApp API error: (#100) Invalid parameter
```

**Causas:**
- Formato de número incorrecto
- Tipo de mensaje no soportado
- Payload malformado

**Solución:**
- Verifica que el número solo tenga dígitos
- Asegúrate de incluir el código de país
- Revisa los logs para ver el payload exacto

---

## 🧪 Cómo Probar

### 1. Probar con Tu Propio Número

Lo más seguro es enviar a tu propio número primero:

```javascript
const miNumero = "573001234567"; // TU número con WhatsApp
await enviarWhatsapp(miNumero, "Prueba desde la API");
```

Si funciona, la configuración está correcta.

---

### 2. Verificar Credenciales

Abre la consola del navegador (F12) y verás:

```
[WhatsApp Service] Error de API: {
  code: 133010,
  message: "Account not registered",
  type: "OAuthException",
  details: {...}
}
```

---

### 3. Probar la API Directamente

Usa curl para probar sin la app:

```bash
curl -X POST "https://graph.facebook.com/v21.0/858541797335480/messages" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "573001234567",
    "type": "text",
    "text": {
      "body": "Prueba directa"
    }
  }'
```

Si esto falla con el mismo error, el problema NO es tu código.

---

## 📋 Checklist de Verificación

Antes de intentar enviar mensajes:

- [ ] El número tiene WhatsApp instalado y activo
- [ ] El número está en formato internacional (57300...)
- [ ] `WHATSAPP_PHONE_NUMBER_ID` es correcto en `.env.local`
- [ ] `WHATSAPP_ACCESS_TOKEN` es válido y no expiró
- [ ] Tu número de WhatsApp Business está verificado en Meta
- [ ] El destinatario te ha escrito en las últimas 24h (o usas templates)
- [ ] Has probado enviando a tu propio número primero

---

## 🔍 Logs Detallados

En la consola verás información útil:

```
[WhatsApp Service] Error de API: {
  code: 133010,
  message: "Account not registered",
  type: "OAuthException",
  fbtrace_id: "ABC123..."
}
```

El `fbtrace_id` puedes usarlo para reportar el problema a Meta si persiste.

---

## 💡 Solución Rápida

**Si el error persiste:**

1. **Prueba con un número diferente** que sepas que tiene WhatsApp
2. **Verifica el formato:** Código país + número (sin espacios, sin +)
3. **Regenera el token** en Meta Dashboard
4. **Reinicia el servidor** después de cambiar `.env.local`

**Ejemplo de prueba:**

```typescript
// En src/app/catalogo/page.tsx, temporalmente:
const telefono = "TU_NUMERO_AQUI"; // Tu número real con WhatsApp
```

Si funciona con tu número, confirma que el problema es el número del destinatario.

---

## 📞 Contacto de Soporte

Si después de todo esto sigue fallando:

1. Revisa la [documentación oficial de Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/support)
2. Verifica el estado de la API en [Meta Status](https://metastatus.com/)
3. Contacta al soporte de Meta con el `fbtrace_id`

---

## ✅ Verificación Final

Una vez que funcione, verás en la consola:

```
[WhatsApp] ✓ Mensaje enviado desde número API Cloud: wamid.HBgN...
```

Y el usuario recibirá el mensaje **desde tu número de WhatsApp Business**.
