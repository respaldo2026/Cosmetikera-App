#!/usr/bin/env node

/**
 * Diagnóstico detallado del problema con WhatsApp API
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WABA_ID = process.env.WHATSAPP_WABA_ID;

console.log('\n🔬 DIAGNÓSTICO DETALLADO DE WHATSAPP API\n');

// Análisis del token
console.log('1️⃣  ANÁLISIS DEL TOKEN:');
console.log(`   Longitud: ${TOKEN.length} caracteres`);
console.log(`   Comienza con: ${TOKEN.substring(0, 10)}`);
console.log(`   Termina con: ${TOKEN.substring(TOKEN.length - 10)}`);
console.log(`   Contiene "EAAXXX": ${TOKEN.includes('EAAXXX') ? '❌ Sí (genérico)' : '✅ No'}`);

// Intentar con endpoints diferentes
console.log('\n2️⃣  PRUEBAS DE ENDPOINTS:');

testEndpoint(`/me/?fields=id`, 'Información del usuario');
testEndpoint(`/v18.0/${PHONE_ID}`, 'Información del Phone Number');
testEndpoint(`/v18.0/${WABA_ID}`, 'Información del WABA');
testEndpoint(`/v18.0/${PHONE_ID}/phone_numbers`, 'Lista de números de teléfono');

function testEndpoint(path, description) {
    return new Promise((resolve) => {
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
                        console.log(`      Código de error: ${result.error.code}`);
                        if (result.error.error_subcode) {
                            console.log(`      Error subcode: ${result.error.error_subcode}`);
                        }
                    } else {
                        console.log(`   ✅ ${description}`);
                        console.log(`      Respuesta: ${JSON.stringify(result).substring(0, 80)}...`);
                    }
                } catch (e) {
                    console.log(`   ❌ ${description} - Respuesta inválida`);
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ ${description} - ${error.message}`);
            resolve();
        });

        req.setTimeout(5000);
        req.end();
    });
}

// Esperar a que se completen todas las pruebas
setTimeout(() => {
    console.log(`
3️⃣  ANÁLISIS DEL PROBLEMA:

   El error "Invalid OAuth access token - Cannot parse access token" 
   significa que Meta **no puede procesar el token**.

   CAUSAS POSIBLES:
   ❌ 1. El token está CORROMPIDO o MAL COPIADO
      → Busca espacios, saltos de línea o caracteres faltantes
      → Re-copia el token exactamente como aparece en Meta

   ❌ 2. El token TIENE PERMISOS INSUFICIENTES
      → Asegúrate de seleccionar: whatsapp_business_messaging
      → Y: whatsapp_business_management

   ❌ 3. El token ES PARA OTRA APLICACIÓN
      → Verifica que el token sea de la app de Academia Crystal
      → No de otra app o de Facebook Login

   ❌ 4. PHONE_NUMBER_ID ESTÁ MAL
      → ID actual: ${PHONE_ID}
      → Verifica que sea el número de teléfono CORRECTO en Meta

   ❌ 5. WABA_ID NO COINCIDE
      → ID actual: ${WABA_ID}
      → Verifica que sea la Cuenta de Negocio CORRECTA

4️⃣  QUÉ DEBES VERIFICAR EN META:

   [ ] El token comience exactamente con "EAAXXX..." (sin EAAXXX literal)
   [ ] No tenga espacios ni saltos de línea
   [ ] El PHONE_NUMBER_ID sea el correcto (verificar en WhatsApp Manager)
   [ ] El WABA_ID sea correcto (verificar en WhatsApp Manager)
   [ ] La app esté aprobada/activa
   [ ] Tu usuario tenga rol "Admin" en el Business Suite
   [ ] El token sea permanente (no temporal)

5️⃣  PRÓXIMOS PASOS:

   1. Copia el token de Meta Business Suite nuevamente
   2. Pégalo EXACTAMENTE en .env.local sin espacios
   3. Verifica PHONE_NUMBER_ID y WABA_ID en WhatsApp Manager
   4. Ejecuta: node test-whatsapp-api.js

   Si sigue sin funcionar, podría ser:
   - Problema de cuenta Meta (contactar soporte)
   - App sin aprobación
   - Permisos insuficientes en la app
`);
}, 2000);
