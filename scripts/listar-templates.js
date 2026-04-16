#!/usr/bin/env node
/**
 * Script para listar todos los templates disponibles en Meta WhatsApp
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Cargar variables de .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    envVars[key] = valueParts.join('=').trim();
  }
});

const WABA_ID = envVars.WHATSAPP_WABA_ID;
const ACCESS_TOKEN = envVars.WHATSAPP_ACCESS_TOKEN;

if (!WABA_ID || !ACCESS_TOKEN) {
  console.error('❌ Error: WHATSAPP_WABA_ID o WHATSAPP_ACCESS_TOKEN no están configurados');
  process.exit(1);
}

console.log('🔍 Listando templates en Meta WhatsApp...\n');
console.log(`📱 WABA_ID: ${WABA_ID}`);
console.log(`🔑 Token: ${ACCESS_TOKEN.substring(0, 30)}...\n`);

const makeRequest = (method, path) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://graph.facebook.com/v21.0${path}`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

(async () => {
  try {
    const response = await makeRequest('GET', `/${WABA_ID}/message_templates?limit=100&fields=id,name,status,category,language,rejection_reason,components`);
    
    if (response.status === 200 && response.data?.data) {
      console.log(`✅ Templates encontrados: ${response.data.data.length}\n`);
      console.log('═'.repeat(80));
      
      response.data.data.forEach((template, index) => {
        console.log(`\n${index + 1}. ${template.name}`);
        console.log(`   Estado: ${template.status}`);
        console.log(`   Categoría: ${template.category}`);
        console.log(`   Idioma: ${template.language}`);
        console.log(`   ID: ${template.id}`);
        if (template.rejection_reason) {
          console.log(`   \n   ⚠️  RAZÓN DE RECHAZO:`);
          console.log(`   ${template.rejection_reason}`);
        }
        if (template.components) {
          const bodyComponent = template.components.find(c => c.type === 'BODY');
          if (bodyComponent) {
            console.log(`   \n   📄 Contenido:`);
            console.log(`   ${bodyComponent.text}`);
          }
        }
      });
      
      console.log('\n' + '═'.repeat(80));
      console.log('\n📊 Resumen:');
      const byStatus = {};
      response.data.data.forEach(t => {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      });
      Object.entries(byStatus).forEach(([status, count]) => {
        const emoji = status === 'APPROVED' ? '✅' : status === 'PENDING_REVIEW' ? '⏳' : '❌';
        console.log(`   ${emoji} ${status}: ${count}`);
      });
      
    } else {
      console.error('❌ Error obteniendo templates:');
      console.error(JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
