# ⚠️ ERROR 133010: Account not registered - SOLUCIÓN

## 🔴 El Problema

Estás viendo este error:
```
WhatsApp API error: (#133010) Account not registered
```

Esto significa que **el número al que intentas enviar NO tiene WhatsApp** o hay un problema con el formato/credenciales.

---

## ✅ SOLUCIÓN RÁPIDA (3 pasos)

### Paso 1: Verifica el Número

El error más común es que el número **no tiene WhatsApp activo**.

**Prueba con TU PROPIO número primero:**

1. Ve a `/catalogo`
2. Selecciona un programa
3. Haz clic en "Compartir por WhatsApp"
4. **Ingresa TU número de teléfono** (el que usas con WhatsApp)
5. Envía

**Formato correcto:**
```
✓ 573001234567  (Colombia - 10 dígitos después del 57)
✓ 3001234567    (Se agrega automáticamente el 57)

✗ +57 300 123 4567  (no uses espacios ni +)
✗ 57-300-123-4567   (no uses guiones)
```

Si funciona con tu número, confirma que el problema es el número del destinatario.

---

### Paso 2: Verifica las Credenciales

Abre tu `.env.local` y confirma:

```env
WHATSAPP_PHONE_NUMBER_ID=858541797335480
WHATSAPP_ACCESS_TOKEN=EAATPWNbkGbYBQ...  (debe ser largo)
```

**¿Cómo verificar si son correctas?**

1. Ve a [developers.facebook.com](https://developers.facebook.com/)
2. Selecciona tu app
3. Ve a **WhatsApp > API Setup**
4. Compara:
   - **Phone Number ID** debe coincidir
   - **Access Token** debe estar vigente (no expirado)

Si el token expiró:
- Genera uno nuevo
- Copia y pega en `.env.local`
- **Reinicia el servidor** (`npm run dev`)

---

### Paso 3: Verifica tu Número de WhatsApp Business

Tu número en Meta debe estar **verificado** y **activo**.

1. En Meta Dashboard, ve a WhatsApp > Getting Started
2. Verifica que tu número tenga un **✓ verde**
3. Si no, completa el proceso de verificación

---

## 🧪 PRUEBA DE DIAGNÓSTICO

Ejecuta esta prueba manual:

```bash
# Reemplaza con tus valores reales
curl -X POST "https://graph.facebook.com/v21.0/858541797335480/messages" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "TU_NUMERO_AQUI",
    "type": "text",
    "text": {
      "body": "Prueba directa desde curl"
    }
  }'
```

**Si esto funciona:** Tu configuración está correcta, el problema es el código.
**Si esto falla con 133010:** El problema son las credenciales o el número del destinatario.

---

## 📋 CHECKLIST COMPLETO

Marca cada punto:

- [ ] El número del destinatario **tiene WhatsApp instalado y activo**
- [ ] El número está en formato **internacional** (57300...)
- [ ] Has probado **con tu propio número** primero
- [ ] `WHATSAPP_PHONE_NUMBER_ID` es correcto en `.env.local`
- [ ] `WHATSAPP_ACCESS_TOKEN` **no ha expirado**
- [ ] Tu número de WhatsApp Business está **verificado** en Meta
- [ ] Has **reiniciado el servidor** después de cambiar `.env.local`

---

## 💡 ERRORES COMUNES

### 1. "El número no tiene WhatsApp"
**Solución:** Verifica que sea un número real con WhatsApp activo.

### 2. "Formato de número incorrecto"
**Solución:** Usa solo dígitos: `573001234567` (código país + número)

### 3. "Token expirado"
**Solución:** Genera un nuevo token en Meta Dashboard y actualiza `.env.local`

### 4. "Número no verificado"
**Solución:** Completa la verificación en Meta Dashboard > WhatsApp

---

## 🎯 MENSAJE DE ÉXITO

Cuando funcione correctamente, verás en la consola:

```
[WhatsApp] Enviando texto a 573001234567
[WhatsApp] ✓ Mensaje enviado desde número API Cloud: wamid.HBgN...
```

Y recibirás el mensaje **desde tu número de WhatsApp Business**.

---

## 📚 DOCUMENTACIÓN

- **Guía completa:** [WHATSAPP-TROUBLESHOOTING.md](WHATSAPP-TROUBLESHOOTING.md)
- **Guía rápida:** [WHATSAPP-QUICK-START.md](WHATSAPP-QUICK-START.md)
- **Documentación técnica:** [WHATSAPP-INTEGRATION.md](WHATSAPP-INTEGRATION.md)

---

## ❓ ¿TODAVÍA NO FUNCIONA?

Si después de seguir todos estos pasos sigue fallando:

1. **Revisa los logs detallados** en la consola del servidor
2. **Copia el `fbtrace_id`** del error (lo encontrarás en los logs)
3. **Contacta al soporte de Meta** con ese ID
4. **Verifica el estado de la API** en [metastatus.com](https://metastatus.com/)

**Recuerda:** El error 133010 casi siempre se debe a:
- El número del destinatario no tiene WhatsApp
- Formato de número incorrecto
- Token expirado o inválido

¡Prueba primero con tu propio número para descartar problemas!
