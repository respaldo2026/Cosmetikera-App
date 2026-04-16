#!/usr/bin/env node

/**
 * Script para verificar la API de WhatsApp
 * Realiza pruebas de conectividad y funcionalidad
 */

require('dotenv').config({ path: '.env.local' });

const https = require('https');

// Configuración desde variables de entorno
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_WABA_ID = process.env.WHATSAPP_WABA_ID;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

console.log('\n📱 VERIFICACIÓN DE API WHATSAPP');
console.log('═'.repeat(50));

// 1. Verificar variables de entorno
console.log('\n1️⃣  VERIFICANDO VARIABLES DE ENTORNO:');
console.log(`   ✓ WHATSAPP_PHONE_NUMBER_ID: ${WHATSAPP_PHONE_NUMBER_ID ? '✅' : '❌'}`);
console.log(`   ✓ WHATSAPP_ACCESS_TOKEN: ${WHATSAPP_ACCESS_TOKEN ? '✅ (largo: ' + WHATSAPP_ACCESS_TOKEN.length + ' caracteres)' : '❌'}`);
console.log(`   ✓ WHATSAPP_WABA_ID: ${WHATSAPP_WABA_ID ? '✅' : '❌'}`);
console.log(`   ✓ WHATSAPP_API_KEY: ${WHATSAPP_API_KEY ? '✅' : '❌'}`);

if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_WABA_ID) {
    console.log('\n❌ Faltan variables de entorno críticas.');
    process.exit(1);
}

// 2. Probar conexión a la API de Meta WhatsApp
console.log('\n2️⃣  PROBANDO CONEXIÓN A META WHATSAPP API:');

function testMetaAPI() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'graph.facebook.com',
            path: `/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/?fields=display_phone_number,verified_name&access_token=${WHATSAPP_ACCESS_TOKEN}`,
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const result = JSON.parse(data);
                        console.log(`   ✅ Conexión exitosa`);
                        console.log(`      Número: ${result.display_phone_number}`);
                        console.log(`      Nombre: ${result.name}`);
                        resolve(true);
                    } catch (e) {
                        console.log(`   ❌ Respuesta inválida: ${data.substring(0, 100)}`);
                        resolve(false);
                    }
                } else {
                    console.log(`   ❌ Error HTTP ${res.statusCode}`);
                    console.log(`      Respuesta: ${data.substring(0, 200)}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ Error de conexión: ${error.message}`);
            resolve(false);
        });

        req.end();
    });
}

// 3. Probar estructura de mensaje
console.log('\n3️⃣  VERIFICANDO ESTRUCTURA DE MENSAJE:');

const mensajeEstructura = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "573001234567",
    "type": "template",
    "template": {
        "name": "hello_world",
        "language": {
            "code": "es_ES"
        }
    }
};

console.log(`   ✅ Estructura JSON válida:`);
console.log(`      ${JSON.stringify(mensajeEstructura, null, 2).split('\n').map(l => '      ' + l).join('\n')}`);

// 4. Resumen de configuración
console.log('\n4️⃣  RESUMEN DE CONFIGURACIÓN:');
console.log(`
   📊 Información de la cuenta:
   • Phone ID: ${WHATSAPP_PHONE_NUMBER_ID}
   • WABA ID: ${WHATSAPP_WABA_ID}
   • Token activo: ${WHATSAPP_ACCESS_TOKEN ? 'Sí' : 'No'}
   • API Key: ${WHATSAPP_API_KEY ? 'Configurada' : 'No'}

   🔗 Endpoints disponibles:
   • Meta API v18.0: https://graph.instagram.com/v18.0/
   • Base URL: https://graph.instagram.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages
`);

// Ejecutar prueba de conexión
(async () => {
    const metatApiOk = await testMetaAPI();

    console.log('\n5️⃣  RESULTADO FINAL:');
    console.log('═'.repeat(50));
    
    if (metatApiOk) {
        console.log('✅ API DE WHATSAPP ESTÁ FUNCIONANDO');
        console.log('\nPróximos pasos:');
        console.log('  1. Crear plantillas de mensajes en Meta Business Suite');
        console.log('  2. Probar envío de mensajes con plantillas');
        console.log('  3. Configurar webhooks para recibir mensajes');
    } else {
        console.log('❌ PROBLEMAS CON LA API DE WHATSAPP');
        console.log('\nPosibles soluciones:');
        console.log('  1. Verificar que el access token sea válido');
        console.log('  2. Verificar que el PHONE_NUMBER_ID sea correcto');
        console.log('  3. Verificar permisos en Meta Business Suite');
        console.log('  4. Revisar que la app de WhatsApp esté aprobada');
    }
    console.log('═'.repeat(50) + '\n');
})();
