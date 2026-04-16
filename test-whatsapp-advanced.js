#!/usr/bin/env node

/**
 * Script avanzado de diagnóstico de WhatsApp API
 * Pruebas adicionales para identificar el problema
 */

require('dotenv').config({ path: '.env.local' });

const https = require('https');

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_WABA_ID = process.env.WHATSAPP_WABA_ID;

console.log('\n🔬 DIAGNÓSTICO AVANZADO WHATSAPP API');
console.log('═'.repeat(60));

// Verificar formato del token
console.log('\n1️⃣  ANÁLISIS DEL TOKEN:');
console.log(`   Longitud: ${WHATSAPP_ACCESS_TOKEN.length} caracteres`);
console.log(`   Primeros 20 caracteres: ${WHATSAPP_ACCESS_TOKEN.substring(0, 20)}...`);
console.log(`   Últimos 20 caracteres: ...${WHATSAPP_ACCESS_TOKEN.substring(WHATSAPP_ACCESS_TOKEN.length - 20)}`);

// Verificar que no tenga espacios o caracteres inválidos
if (WHATSAPP_ACCESS_TOKEN.includes('\n') || WHATSAPP_ACCESS_TOKEN.includes(' ')) {
    console.log('   ⚠️  ADVERTENCIA: Token contiene espacios o saltos de línea');
}

// Verificar estructura del token (debe empezar con EAAXXX para tokens de Meta)
if (!WHATSAPP_ACCESS_TOKEN.startsWith('EAA')) {
    console.log('   ⚠️  ADVERTENCIA: Token no comienza con "EAA" (puede ser inválido)');
} else {
    console.log('   ✅ Token parece ser formato Meta válido (comienza con EAA)');
}

// Prueba 1: Intentar con el WABA_ID en lugar de PHONE_NUMBER_ID
console.log('\n2️⃣  PRUEBA CON WABA_ID:');
testAPIEndpoint(`/v18.0/${WHATSAPP_WABA_ID}/?fields=name,currency`);

// Prueba 2: Intentar obtener información de la cuenta
console.log('\n3️⃣  PRUEBA CON PHONE_NUMBER_ID:');
testAPIEndpoint(`/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/?fields=display_phone_number,name`);

// Prueba 3: Intentar acceder al WABA con campos simples
console.log('\n4️⃣  PRUEBA ME (USUARIO ACTUAL):');
testAPIEndpoint(`/me/?fields=id,name`);

function testAPIEndpoint(path) {
    return new Promise((resolve) => {
        const fullPath = path + (path.includes('?') ? '&' : '?') + `access_token=${WHATSAPP_ACCESS_TOKEN}`;
        
        const options = {
            hostname: 'graph.instagram.com',
            path: fullPath,
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`   Path: ${path.split('?')[0]}`);
                console.log(`   Status: ${res.statusCode}`);
                
                try {
                    const result = JSON.parse(data);
                    if (result.error) {
                        console.log(`   ❌ Error: ${result.error.message}`);
                        console.log(`      Código: ${result.error.code}`);
                        if (result.error.error_subcode) {
                            console.log(`      Subcódigo: ${result.error.error_subcode}`);
                        }
                    } else {
                        console.log(`   ✅ Éxito`);
                        console.log(`      ${JSON.stringify(result, null, 2).split('\n').slice(0, 3).join('\n      ')}`);
                    }
                } catch (e) {
                    console.log(`   Respuesta: ${data.substring(0, 100)}`);
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ Error de conexión: ${error.message}`);
            resolve();
        });

        req.end();
    });
}

// Análisis final
console.log('\n\n5️⃣  CHECKLIST DE CONFIGURACIÓN:');
console.log(`
   □ Token comienza con "EAA" (formato Meta)
   □ Token tiene más de 150 caracteres
   □ Token no contiene espacios ni saltos de línea
   □ Phone Number ID es correcto
   □ WABA ID es correcto
   
   POSIBLES CAUSAS DEL ERROR:
   ✗ Token expirado (expiran después de 60 días sin uso)
   ✗ Token generado con la app equivocada
   ✗ Token sin permisos necesarios (whatsapp_business_messaging)
   ✗ Cuenta de negocio (WABA) sin activar
   ✗ Aplicación de WhatsApp aún en fase de desarrollo
   
   SOLUCIONES:
   1. Generar nuevo token en: https://business.facebook.com/
   2. En Meta Business Suite → Configuración → Sistema → Cuentas de Usuario
   3. Generar Token de Acceso Permanente
   4. Asegurar permisos: whatsapp_business_messaging, whatsapp_business_management
`);

console.log('═'.repeat(60) + '\n');
