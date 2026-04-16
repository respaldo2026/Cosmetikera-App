#!/usr/bin/env node

/**
 * Script para probar el envío de mensajes con WhatsApp API
 */

require('dotenv').config({ path: '.env.local' });

const https = require('https');

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const TEST_PHONE = '573006402575'; // Número autorizado

console.log('\n📱 PRUEBA DE ENVÍO DE MENSAJE WHATSAPP\n');
console.log('═'.repeat(60));

// Prueba 1: Enviar mensaje de texto simple
function sendTextMessage() {
    const payload = JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: TEST_PHONE,
        type: 'text',
        text: {
            preview_url: true,
            body: '¡Hola! Este es un mensaje de prueba desde Academia Crystal. 🎓'
        }
    });

    const options = {
        hostname: 'graph.facebook.com',
        path: `/v18.0/${PHONE_NUMBER_ID}/messages`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    console.log('\n1️⃣  ENVIANDO MENSAJE DE TEXTO...');
    console.log(`   Para: ${TEST_PHONE}`);

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                const result = JSON.parse(data);
                console.log('   ✅ ¡Mensaje enviado exitosamente!');
                console.log(`   ID del mensaje: ${result.messages[0].id}`);
            } else {
                console.log(`   ❌ Error HTTP ${res.statusCode}`);
                console.log(`   Respuesta: ${data}`);
            }
        });
    });

    req.on('error', (error) => {
        console.log(`   ❌ Error: ${error.message}`);
    });

    req.write(payload);
    req.end();
}

// Prueba 2: Enviar plantilla (hello_world)
function sendTemplateMessage() {
    const payload = JSON.stringify({
        messaging_product: 'whatsapp',
        to: TEST_PHONE,
        type: 'template',
        template: {
            name: 'hello_world',
            language: {
                code: 'en_US'
            }
        }
    });

    const options = {
        hostname: 'graph.facebook.com',
        path: `/v18.0/${PHONE_NUMBER_ID}/messages`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    console.log('\n2️⃣  ENVIANDO PLANTILLA (hello_world)...');
    console.log(`   Para: ${TEST_PHONE}`);

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                const result = JSON.parse(data);
                console.log('   ✅ ¡Plantilla enviada exitosamente!');
                console.log(`   ID del mensaje: ${result.messages[0].id}`);
            } else {
                console.log(`   ❌ Error HTTP ${res.statusCode}`);
                console.log(`   Respuesta: ${data}`);
            }
        });
    });

    req.on('error', (error) => {
        console.log(`   ❌ Error: ${error.message}`);
    });

    req.write(payload);
    req.end();
}

console.log(`\n📋 Configuración:`);
console.log(`   Phone ID: ${PHONE_NUMBER_ID}`);
console.log(`   Token: ${ACCESS_TOKEN ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`   Número de prueba: ${TEST_PHONE}`);
console.log('═'.repeat(60));

// Ejecutar pruebas
sendTextMessage();

setTimeout(() => {
    sendTemplateMessage();
}, 2000);

console.log('\n⚠️  IMPORTANTE:');
console.log('   - Cambia TEST_PHONE por tu número real para probar');
console.log('   - El número debe estar en formato internacional: 573001234567');
console.log('   - Para enviar mensajes de texto, necesitas permiso de Meta');
console.log('   - La plantilla "hello_world" debe estar disponible\n');
console.log('═'.repeat(60) + '\n');
