# 🔐 Obtener Access Token Válido para WhatsApp API

**Estado actual:** El Access Token en `.env.local` está inválido o expirado  
**Error:** `Invalid OAuth 2.0 Access Token (Code 190)`

---

## ✅ Solución: Generar nuevo Access Token

### **Paso 1: Ve a Meta Business Manager**

1. Abre: https://business.facebook.com/
2. Selecciona tu **Business Account** (Academia Crystal Diamante)
3. Ve a **Settings → Business Settings** (esquina inferior izquierda)

---

### **Paso 2: Localiza tu WhatsApp Business Account**

En **Settings**, ve a:
```
Apps and Websites → Apps
```

Busca y selecciona tu app de WhatsApp (probablemente llamada como tu dominio o app).

---

### **Paso 3: Genera el Access Token**

1. En **Settings**, busca **API Keys** o **User Access Tokens**
2. Haz clic en **Generate Access Token**
3. Selecciona:
   - **Scope requeridos:**
     - ✅ `whatsapp_business_messaging`
     - ✅ `whatsapp_business_account_management`
     - ✅ `business_management_api`
   - **Versión de API:** v21.0 (o la más reciente)
4. Haz clic en **Generate**

---

### **Paso 4: Copia el nuevo token**

Meta generará un token largo (empieza con `EAA...`):

```
EAA...VClc54LBZCrMt0dQZAKPqZB4Szcwd54uZAoqDIwOqSWZA2n9epDVi1tAZDZD
```

**⚠️ IMPORTANTE:**
- Cópialo completamente (sin espacios)
- No lo compartas
- Guárdalo en `.env.local`

---

### **Paso 5: Actualiza `.env.local`**

Reemplaza la línea:

```env
WHATSAPP_ACCESS_TOKEN=EAA...VClc54LBZCrMt0dQZAKPqZB4Szcwd54uZAoqDIwOqSWZA2n9epDVi1tAZDZD
```

Con el nuevo token que copiaste.

**Ejemplo:**
```env
WHATSAPP_ACCESS_TOKEN=EAA__TU_NUEVO_TOKEN_AQUI___
```

---

### **Paso 6: Verifica el WABA_ID (en `.env.local`)**

Tu WABA ID actual es:
```
WHATSAPP_WABA_ID=1304198794719230
```

**Para confirmarlo:**
1. Ve a WhatsApp > **Settings → Account**
2. Busca **WhatsApp Business Account ID**
3. Debe coincidir con el que está en `.env.local`

Si es diferente, actualízalo también.

---

## 🚀 Una vez actualizado:

Ejecuta en terminal:

```bash
npm run templates:crear
```

El script creará automáticamente los 7 templates.

---

## 📋 Alternativa: Crear Templates Manualmente en Meta

Si prefieres no usar el script:

1. Ve a: https://business.facebook.com/wa/manage/message-templates/
2. Haz clic en **Create Template**
3. Para cada template (ver archivo [TEMPLATES-WHATSAPP-CREAR-META.md](./TEMPLATES-WHATSAPP-CREAR-META.md)):
   - Copia el **Body text** exacto
   - Configura variables {{1}}, {{2}}, etc.
   - Selecciona categoría (TRANSACTIONAL o MARKETING)
   - Haz clic **Submit for review**

---

## ⚠️ Solución de problemas

| Error | Solución |
|-------|----------|
| `Invalid OAuth 2.0 Access Token` | El token expiró. Genera uno nuevo. |
| `Insufficient permission` | Asegúrate que el token tenga scope `whatsapp_business_messaging` |
| `WABA ID not found` | Verifica que el WABA_ID sea correcto |
| `Template not approved` | Meta aún está revisándolo (24-48 horas) |

---

## 🔐 Seguridad

✅ **Nunca compartas tu Access Token**  
✅ **Cámbialo cada 90 días** (best practice)  
✅ **Revoca tokens antiguos** en Meta Business Manager  
✅ **Usa variables de entorno**, nunca hardcodeado en el código  

---

## 📞 Soporte Meta

Si el token sigue siendo inválido:

1. Verifica que tu **Business Account** esté verificado
2. Confirma que tu **número WhatsApp** está registrado y activo
3. Contacta a **Meta Support**: https://www.facebook.com/help

---

**Una vez actualizado el token, ejecuta:**
```bash
npm run templates:crear
```

¡Y listo! Los 7 templates se crearán automáticamente. ✨
