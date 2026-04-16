# 🚨 SOLUCIÓN: Token de WhatsApp Inválido

**Status**: ❌ API NO FUNCIONA - Token rechazado por Meta

## Error Específico
```
Error Code 190: Invalid OAuth access token - Cannot parse access token
```

Este error significa que Meta **no puede procesar el token** que tenemos configurado. El token está:
- Expirado
- Corrupto
- Generado con la app/permisos equivocados
- Sin acceso a la API de WhatsApp

---

## ✅ Solución Paso a Paso

### 1️⃣ Acceder a Meta Business Suite
**URL**: https://business.facebook.com/

### 2️⃣ Ir a Configuración de la Aplicación
```
Inicio 
→ Configuración 
→ Apps y Sitios Web 
→ Apps
→ Buscar "Academia Crystal" (o tu app de WhatsApp)
```

### 3️⃣ Generar Nuevo Access Token
**Opción A: Token en Meta Business Suite**
```
Inicio
→ Configuración
→ Sistema
→ Cuentas de Usuario
→ Tu usuario
→ Generar Token de Acceso Permanente
→ Seleccionar permisos:
  ✅ whatsapp_business_messaging
  ✅ whatsapp_business_management
```

**Opción B: Token desde la App**
```
Apps y Sitios Web
→ Academia Crystal (app)
→ Configuración
→ Básica
→ Token de Acceso de Aplicación
→ Copiar Token
```

### 4️⃣ Verificar Permisos
Asegurate que el token tenga estos permisos:
- `whatsapp_business_messaging` - Para enviar mensajes
- `whatsapp_business_management` - Para gestionar la cuenta

### 5️⃣ Copiar el Token
El token debe:
- ✅ Comenzar con `EAAX...` o `EAA...`
- ✅ Tener entre 190-210 caracteres
- ✅ NO contener espacios ni saltos de línea
- ✅ NO tener caracteres especiales al inicio/final

**Ejemplo válido:**
```
EAATPWNbkGbYBQmZAcBbHx9S0YZABPQnApZAjD8o960xJdgJi4dvZCor3AUUhrQ1XWaDy...
```

### 6️⃣ Actualizar .env.local
```bash
WHATSAPP_ACCESS_TOKEN=PEGA_EL_NUEVO_TOKEN_AQUI_SIN_ESPACIOS
```

### 7️⃣ Verificar que Funcionó
```bash
node test-whatsapp-api.js
```

Deberías ver:
```
✅ Conexión exitosa
   Número: +57XXXXXXXXX
   Nombre: Academia Crystal
```

---

## 🔍 Verificaciones Previas

Antes de generar el token, verifica:

### ✅ Tu App está en el nivel correcto
```
Meta Business Suite
→ Mi Cuenta
→ Acceso de Usuarios
→ Información general
```

Deberías ver un rol como:
- **Admin** ✅ (acceso total)
- **Editor** ✅ (acceso parcial)
- **Analista** ❌ (solo lectura)

### ✅ La Aplicación de WhatsApp está aprobada
```
Apps
→ Academia Crystal (app)
→ Configuración
→ Básica
→ Estado: Activa / En desarrollo
```

### ✅ La Cuenta de Negocio está conectada
```
WhatsApp Manager
→ Configuración
→ Cuentas de Negocio
→ Academia Crystal (debería estar verde)
```

---

## 📊 Resumen de IDs Correctos

Estos IDs debe ser correctos:

| ID | Valor | Estado |
|---|---|---|
| **PHONE_NUMBER_ID** | `925756067295565` | ✅ Correcto |
| **WABA_ID** | `1635512034083590` | ✅ Correcto |
| **ACCESS_TOKEN** | `EAA...` | ❌ **INVÁLIDO** |
| **API_KEY** | `crystal_whatsapp_2026_X9aP7Lq82` | ✅ Correcto |

---

## 🆘 Si Sigue Sin Funcionar

### Causas Comunes:

1. **Token del usuario equivocado**
   - El token debe generarse con una cuenta que tenga rol Admin en el Business Suite

2. **Permisos insuficientes**
   - Verifica que el token incluya `whatsapp_business_messaging`

3. **Aplicación en fase "Prueba"**
   - La app debe estar en estado "En desarrollo" o "Activa"

4. **WABA no está verificada**
   - Contacta a Meta para verificar la Cuenta de Negocio

5. **IP Bloqueada**
   - En algunos casos, Meta puede bloquear IPs específicas

### Contacto de Soporte Meta:
https://www.facebook.com/help/contact/support-tools

---

## 📝 Checklist Final

- [ ] Accedí a https://business.facebook.com/
- [ ] Encontré la app "Academia Crystal"
- [ ] Generé un nuevo Access Token Permanente
- [ ] Seleccioné permisos de WhatsApp
- [ ] Copié el token completo (sin espacios)
- [ ] Actualicé `.env.local` con el nuevo token
- [ ] Ejecuté `node test-whatsapp-api.js`
- [ ] Recibí confirmación ✅ de conexión exitosa

---

**Última actualización**: 1 de febrero de 2026  
**Estado**: Requiere nuevo token de Meta
