# 🔧 INSTRUCCIONES PARA GENERAR EL NUEVO TOKEN

## Paso 1: Ve a la pantalla que ves en tu última captura
La dirección debe ser:
```
https://developers.facebook.com/apps/[TU_APP_ID]/whatsapp-business/wa-dev-console/
```

Deberías ver:
- **App ID**: 1353880376187318
- Botón azul: **"Generar token de acceso"**

## Paso 2: Haz clic en "Generar token de acceso"

## Paso 3: En el cuadro de diálogo que aparece:
- **Selecciona el número de teléfono**: +57 320 5617714 (o 925756067295565)
- **Genera el token**
- **Copia el token completo** (sin espacios)

## Paso 4: Envíamelo
Una vez generes el token, envíamelo y lo actualizo en `.env.local`

---

## Información de Referencia

**IDs Actuales (Correctos):**
```
PHONE_NUMBER_ID: 925756067295565  ✅
WABA_ID: 16355120340823590        ✅
TOKEN ACTUAL: ❌ (RECHAZADO POR META)
```

**El token que me diste:**
- Comienza correctamente: `EAATPWNbkGbYBQ...`
- Tiene el formato válido
- PERO Meta lo rechaza (error 190)

Esto significa que el token **NO tiene los permisos necesarios** o fue generado de otra forma.

---

## Solución Rápida

Haz clic en el botón azul **"Generar token de acceso"** y sigue los pasos. El token que generes desde ahí debería funcionar.
