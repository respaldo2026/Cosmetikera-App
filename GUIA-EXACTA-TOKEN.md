# 🔑 GUÍA EXACTA - Obtener Access Token Válido

**Problema:** Token sigue siendo inválido (error 190)  
**Causa probable:** Estás copiando token de la sección equivocada en Meta  

---

## ✅ OPCIÓN 1: Token System User (RECOMENDADO)

### Paso 1: Ve a Business Manager

1. Abre: https://business.facebook.com/
2. Verifica que estés en la **Business Account correcta** (Academia Crystal Diamante)

### Paso 2: Crea/Obtén System User

**Ubicación exacta:**
- Esquina inferior izquierda → **Settings**
- Sidebar izquierdo → **Users** → **System users**
- Haz clic en **Create system user**

**Configuración:**
- Name: `whatsapp_api_automation`
- Role: **Admin** (importante)
- Haz clic en **Create**

### Paso 3: Genera Token para System User

Después de crear:
1. Haz clic en **Generate access tokens**
2. Selecciona tu **App de WhatsApp** (o crea una si no existe)
3. Selecciona estos scopes:
   ```
   ✅ whatsapp_business_messaging
   ✅ whatsapp_business_account_management
   ✅ business_management_api
   ✅ whatsapp_business_phone_numbers_api
   ```
4. Token expires: **Never** (para producción)
5. Haz clic en **Generate token**

### Paso 4: Copia el Token

**IMPORTANTE:** El token aparecerá SOLO UNA VEZ
- Cópialo completamente
- No dejes espacios
- Pégalo en `.env.local`

**El token será algo como:**
```
EAAJR2ZAnBZAY0BApR9nP7x5ZA8ZAz2j...
```

---

## ✅ OPCIÓN 2: Token Personal (Si lo anterior no funciona)

### Alternativa

Si no tienes acceso a System Users:

1. Ve a: https://business.facebook.com/
2. **Accounts** → **Users** (no System users)
3. Busca tu usuario
4. **Generate access tokens**
5. Permisos:
   ```
   ✅ whatsapp_business_messaging
   ✅ whatsapp_business_account_management
   ✅ business_management_api
   ```
6. Selecciona tu **Business Account** como permiso
7. Copia el token

---

## 🔍 VERIFICAR QUE SEA VÁLIDO

### Prueba 1: Desde terminal

```bash
npm run validar:config
```

Debería mostrar:
```
✅ Token es válido
✅ WABA_ID es válido
```

### Prueba 2: En cURL (manual)

```bash
curl -X GET "https://graph.instagram.com/me?access_token=TU_TOKEN_AQUI"
```

Debería mostrar tu usuario ID:
```json
{
  "id": "123456789",
  "name": "Tu Nombre"
}
```

---

## ⚠️ Errores Comunes

| Error | Solución |
|-------|----------|
| "Invalid token" | Token mal copiado (espacios, caracteres faltantes) |
| "Token expired" | Crea uno nuevo |
| "Insufficient permission" | Falta scope `whatsapp_business_messaging` |
| "Cannot parse token" | Token es de otra aplicación (Instagram, Facebook, etc) |

---

## 🎯 Paso a Paso Completo (VIDEO TEXT)

### 1️⃣ Abre Business Manager
```
https://business.facebook.com/ → Elige tu Business Account
```

### 2️⃣ Ve a System Users
```
Settings (esquina inferior izquierda)
  → Users
    → System users
      → Create system user
```

### 3️⃣ Configura el System User
```
Name: whatsapp_api_automation
Role: Admin
Haz clic: Create
```

### 4️⃣ Genera Token
```
(En el system user creado)
Generate access tokens
  → Selecciona tu app WhatsApp
  → Selecciona scopes: whatsapp_business_messaging, whatsapp_business_account_management
  → Token expires: Never (producción)
  → Generate token
```

### 5️⃣ Copia el Token
```
⚠️ Aparece SOLO UNA VEZ - Cópialo completo sin espacios
```

### 6️⃣ Actualiza .env.local
```env
WHATSAPP_ACCESS_TOKEN=EAAJR2ZAnBZAY0BApR9...
```

### 7️⃣ Valida
```bash
npm run validar:config
```

### 8️⃣ Crea Templates
```bash
npm run templates:crear
```

---

## 📞 Si Aún Hay Problemas

### Verifica el WABA_ID

En WhatsApp App Settings:
1. https://business.facebook.com/
2. Apps → WhatsApp
3. Settings → Account
4. Busca: "WhatsApp Business Account ID"
5. Debe coincidir con tu `.env.local`:
   ```env
   WHATSAPP_WABA_ID=1304198794719230
   ```

### Verifica que el Número esté Aprobado

1. WhatsApp App
2. Settings → Phone Numbers
3. Tu número debe estar con estado **CONFIRMED** o **APPROVED**

### Último recurso: Usa la API de Meta

```bash
curl -X GET "https://graph.instagram.com/me/owned_businesses?access_token=TU_TOKEN" | jq .
```

Debería mostrar tus business accounts.

---

## ✅ Checklist Final

Antes de crear templates:

- [ ] Access Token generado en System User
- [ ] Token tiene scope `whatsapp_business_messaging`
- [ ] Token fue copiado completo sin espacios
- [ ] Actualizado en `.env.local`
- [ ] Ejecuté `npm run validar:config` y pasó
- [ ] WABA_ID coincide con Meta
- [ ] Número WhatsApp está CONFIRMED en Meta

---

## 🚀 Una vez validado:

```bash
npm run templates:crear
```

Los 7 templates se crearán automáticamente. ✨
