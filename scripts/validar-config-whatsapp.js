#!/usr/bin/env node

/**
 * Script para validar que el Access Token y WABA_ID sean correctos
 * 
 * Uso: node scripts/validar-config-whatsapp.js
 */

const fs = require('fs');
const path = require('path');

// Cargar .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && !key.startsWith('#') && value) {
      process.env[key.trim()] = value;
    }
  });
}

const https = require('https');

const WABA_ID = process.env.WHATSAPP_WABA_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

console.log('🔍 Validando configuración WhatsApp\n');
console.log('=' .repeat(70));

console.log(`\n📋 Valores configurados en .env.local:\n`);
console.log(`  WABA_ID:           ${WABA_ID}`);
console.log(`  PHONE_NUMBER_ID:   ${PHONE_NUMBER_ID}`);
console.log(`  ACCESS_TOKEN:      ${ACCESS_TOKEN ? ACCESS_TOKEN.substring(0, 30) + '...' : 'NO CONFIGURADO'}`);

if (!WABA_ID || !ACCESS_TOKEN) {
  console.error('\n❌ Faltan variables en .env.local');
  process.exit(1);
}

console.log('\n' + '='.repeat(70));
console.log('\n🧪 Prueba 1: Validar Access Token\n');

// Prueba 1: Validar token
function checkToken() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'graph.instagram.com',
      path: '/me?fields=id,name,email&access_token=' + ACCESS_TOKEN,
      method: 'GET',
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.log(`❌ Error: ${parsed.error.message}`);
            console.log(`   Código: ${parsed.error.code}`);
            if (parsed.error.code === 190) {
              console.log('   → Token inválido, expirado o sin permisos');
            }
            resolve(false);
          } else {
            console.log(`✅ Token es válido`);
            console.log(`   Usuario ID: ${parsed.id}`);
            console.log(`   Nombre: ${parsed.name}`);
            resolve(true);
          }
        } catch (e) {
          console.log(`❌ Error parseando respuesta: ${e.message}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Error de red: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`❌ Timeout - Meta no responde`);
      resolve(false);
    });

    req.end();
  });
}

// Prueba 2: Validar WABA_ID
function checkWABA() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'graph.instagram.com',
      path: `/${WABA_ID}?fields=id,name,currency&access_token=${ACCESS_TOKEN}`,
      method: 'GET',
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.log(`❌ WABA_ID inválido o sin acceso`);
            console.log(`   Error: ${parsed.error.message}`);
            resolve(false);
          } else {
            console.log(`✅ WABA_ID es válido`);
            console.log(`   ID: ${parsed.id}`);
            console.log(`   Nombre: ${parsed.name}`);
            resolve(true);
          }
        } catch (e) {
          console.log(`❌ Error parseando: ${e.message}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Error de red: ${err.message}`);
      resolve(false);
    });

    req.end();
  });
}

async function main() {
  const tokenOk = await checkToken();

  console.log('\n' + '='.repeat(70));
  console.log('\n🧪 Prueba 2: Validar WABA_ID\n');

  const wabaOk = await checkWABA();

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 RESUMEN:\n');

  if (tokenOk && wabaOk) {
    console.log('✅ Configuración OK - Puedes crear templates');
    console.log('\n   Ejecuta: npm run templates:crear\n');
    process.exit(0);
  } else {
    console.log('❌ Hay problemas con la configuración\n');
    if (!tokenOk) {
      console.log('   ❌ Access Token inválido:');
      console.log('      1. Ve a: https://business.facebook.com');
      console.log('      2. Settings → User Access Tokens');
      console.log('      3. Generate nuevo token');
      console.log('      4. Asegúrate que tenga scope: whatsapp_business_messaging');
    }
    if (!wabaOk) {
      console.log('   ❌ WABA_ID inválido:');
      console.log('      1. Ve a WhatsApp Settings');
      console.log('      2. Busca "WhatsApp Business Account ID"');
      console.log('      3. Verifica que coincida con .env.local');
    }
    process.exit(1);
  }
}

main();
