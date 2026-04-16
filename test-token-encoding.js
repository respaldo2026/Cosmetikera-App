#!/usr/bin/env node

/**
 * Script para probar si el token de WhatsApp necesita URL encoding
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const querystring = require('querystring');

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

console.log('\n🧪 PRUEBA: Token con URL Encoding');
console.log('═'.repeat(60));

const tokenOriginal = WHATSAPP_ACCESS_TOKEN;
const tokenEncoded = encodeURIComponent(WHATSAPP_ACCESS_TOKEN);

console.log(`\nToken original: ${tokenOriginal.substring(0, 30)}...`);
console.log(`Token encoded:  ${tokenEncoded.substring(0, 30)}...`);
console.log(`\n¿Cambió con encoding? ${tokenOriginal !== tokenEncoded ? '❌ Sí (necesita encoding)' : '✅ No (ya está limpio)'}`);

// Prueba 1: Con token original
console.log('\n📍 Prueba 1: Con token ORIGINAL');
testToken(tokenOriginal, 'ORIGINAL');

// Prueba 2: Con token encoded
console.log('\n📍 Prueba 2: Con token URL-ENCODED');
testToken(tokenEncoded, 'ENCODED');

// Prueba 3: Intento directo sin encodeURIComponent
console.log('\n📍 Prueba 3: Con POST en lugar de GET');
testTokenPOST();

function testToken(token, label) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'graph.instagram.com',
            path: `/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/?fields=display_phone_number&access_token=${token}`,
            method: 'GET',
            headers: {
                'User-Agent': 'WhatsApp-Test/1.0'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.error) {
                        console.log(`   ❌ ${label}: ${result.error.message} (código: ${result.error.code})`);
                    } else {
                        console.log(`   ✅ ${label}: ¡ÉXITO! ${JSON.stringify(result)}`);
                    }
                } catch (e) {
                    console.log(`   ❌ ${label}: Respuesta inválida`);
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ ${label}: Error de conexión: ${error.message}`);
            resolve();
        });

        req.end();
    });
}

function testTokenPOST() {
    return new Promise((resolve) => {
        const postData = querystring.stringify({
            access_token: WHATSAPP_ACCESS_TOKEN
        });

        const options = {
            hostname: 'graph.instagram.com',
            path: `/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/?fields=display_phone_number`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.error) {
                        console.log(`   ❌ POST: ${result.error.message}`);
                    } else {
                        console.log(`   ✅ POST: ¡ÉXITO! ${JSON.stringify(result)}`);
                    }
                } catch (e) {
                    console.log(`   ❌ POST: Respuesta inválida`);
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ POST: Error de conexión: ${error.message}`);
            resolve();
        });

        req.write(postData);
        req.end();
    });
}

console.log('\n═'.repeat(60) + '\n');
