#!/usr/bin/env node

/**
 * Script para generar y validar token de WhatsApp API
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

console.log(`
╔════════════════════════════════════════════════════════════════╗
║       SOLUCIÓN: GENERAR TOKEN NUEVO DESDE META                ║
╚════════════════════════════════════════════════════════════════╝

EL PROBLEMA:
- Token actual: ❌ Rechazado por Meta (Error 190)
- Causa: Permisos insuficientes o token inválido

SOLUCIÓN PASO A PASO:

1️⃣  VE A ESTA URL:
   https://developers.facebook.com/apps/1353880376187318/whatsapp-business/wa-dev-console/

2️⃣  EN LA SECCIÓN "Token de acceso":
   ┌─────────────────────────────────────────────┐
   │ Haz clic en: [Generar token de acceso]      │
   │            (botón azul)                      │
   └─────────────────────────────────────────────┘

3️⃣  EN EL DIÁLOGO QUE APARECE:
   • De: Número de prueba: +1 555 169 7716
   • Para: DEJA EN BLANCO (para generar token permanente)
   • Haz clic: [Generar]

4️⃣  COPIA EL TOKEN COMPLETO (sin espacios)

5️⃣  ENVÍAMELO EXACTAMENTE COMO APARECE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INFORMACIÓN ACTUAL CORRECTA:
✅ App ID: 1353880376187318
✅ Phone Number ID (prueba): 79439873042811
✅ WABA ID: 1304198794719230
❌ Access Token: INVÁLIDO - NECESITA REGENERARSE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NOTA IMPORTANTE:
Si ves un cuadro rojo con error al intentar generar token
en el número +57 320 5617714, es porque:

⚠️  La aplicación está en modo "Desarrollo"
⚠️  Este número podría no estar completamente verificado
⚠️  En modo desarrollo, Meta solo permite usar números de prueba

SOLUCIONES:
A) Usar el número de prueba (+1 555 169 7716) para desarrollo
B) Cambiar la app de "Desarrollo" a "En producción" (requiere verificación)
C) Verificar el número +57 320 5617714 en Meta Business Suite

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

¿NECESITAS AYUDA?

Si el botón "Generar token de acceso" no funciona:
1. Recarga la página (F5 o Ctrl+R)
2. Inicia sesión nuevamente
3. Verifica que tu usuario sea "Admin" en Meta Business Suite

`);
