#!/usr/bin/env node

/**
 * Diagnóstico de API - Verificar qué es lo que Meta rechaza exactamente
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WABA_ID = process.env.WHATSAPP_WABA_ID;

console.log(`
╔════════════════════════════════════════════════════════════════╗
║         ANÁLISIS PROFUNDO DEL ERROR 190                        ║
╚════════════════════════════════════════════════════════════════╝

Error 190 = Invalid OAuth access token

CAUSAS POSIBLES:
1. Token generado de una APP diferente
2. Token sin permisos de WhatsApp
3. Token de un usuario diferente al propietario de la app
4. Token expirado o revocado
5. PHONE_ID incorrecto o desasociado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INFORMACIÓN ACTUAL:
Token longitud: ${TOKEN.length}
Token comienza con: ${TOKEN.substring(0, 20)}...
Token termina con: ...${TOKEN.substring(TOKEN.length - 20)}

Phone ID: ${PHONE_ID}
WABA ID: ${WABA_ID}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRUEBAS A REALIZAR:
`);

// Prueba 1: Verificar si el token es válido en general
console.log('\n1️⃣  Verificando si el token es válido en general...');
testEndpoint('/me', 'Información del usuario (token)');

// Prueba 2: Con Phone ID
console.log('\n2️⃣  Verificando Phone ID...');
testEndpoint(`/v18.0/${PHONE_ID}`, 'Información del Phone Number');

// Prueba 3: Con WABA ID
console.log('\n3️⃣  Verificando WABA ID...');
testEndpoint(`/v18.0/${WABA_ID}`, 'Información del WABA');

// Prueba 4: Intentar obtener lista de números
console.log('\n4️⃣  Intentando obtener lista de números...');
testEndpoint(`/v18.0/${WABA_ID}/phone_numbers`, 'Números disponibles en WABA');

function testEndpoint(path, description) {
    const fullUrl = path + (path.includes('?') ? '&' : '?') + `access_token=${TOKEN}`;
    
    const options = {
        hostname: 'graph.instagram.com',
        path: fullUrl,
        method: 'GET'
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (result.error) {
                    console.log(`   ❌ ${description}`);
                    console.log(`      Error: ${result.error.message}`);
                    console.log(`      Código: ${result.error.code}`);
                } else {
                    console.log(`   ✅ ${description}`);
                    const keys = Object.keys(result).slice(0, 3);
                    console.log(`      Datos: ${keys.join(', ')}`);
                }
            } catch (e) {
                console.log(`   ❌ ${description} - Respuesta inválida`);
            }
        });
    });

    req.on('error', (error) => {
        console.log(`   ❌ ${description} - ${error.message}`);
    });

    req.end();
}

setTimeout(() => {
    console.log(`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONCLUSIÓN:
Si TODOS los endpoints retornan error 190, entonces:

⚠️  El token NO es válido
⚠️  O fue generado incorrectamente
⚠️  O está asociado a otra aplicación

ACCIONES A TOMAR:

A) Verificar que el token sea de la aplicación CORRECTA:
   ✓ App ID debe ser: 1353880376187318
   ✓ El token debe generarse DESDE esta app
   ✓ NO de otra app o de Facebook Login

B) Regenerar el token:
   1. Ve a: https://developers.facebook.com/apps/1353880376187318/
   2. En el menú izquierdo: WhatsApp → Inicio rápido
   3. Haz clic en "Generar token de acceso"
   4. COPIA EXACTAMENTE el token generado
   5. SIN espacios, SIN saltos de línea

C) Si sigue sin funcionar:
   ✓ Contacta a Meta Support
   ✓ Problema podría ser de la app o la cuenta
   ✓ Podrías necesitar recriar la app desde cero

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}, 2000);
