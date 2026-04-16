#!/usr/bin/env node
/**
 * Script para obtener los detalles completos de los templates rechazados
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
  console.log('🔍 Obteniendo detalles de templates rechazados...\n');
  
  // Obtener lista de templates
  const response = await makeRequest('GET', `/${WABA_ID}/message_templates?limit=100`);
  
  if (response.status !== 200 || !response.data?.data) {
    console.error('❌ Error obteniendo templates');
    return;
  }

  const rejected = response.data.data.filter(t => t.status === 'REJECTED');
  
  console.log(`Templates rechazados: ${rejected.length}\n`);
  console.log('='.repeat(80) + '\n');

  for (const template of rejected) {
    console.log(`📋 ${template.name}`);
    console.log(`   ID: ${template.id}`);
    console.log(`   Categoría: ${template.category}`);
    
    // Obtener detalles completos de este template
    const detailsResponse = await makeRequest('GET', `/${template.id}?fields=id,name,status,category,language,rejection_reason,quality_score,components`);
    
    if (detailsResponse.status === 200 && detailsResponse.data) {
      const details = detailsResponse.data;
      
      if (details.rejection_reason) {
        console.log(`\n   ⚠️  RAZÓN DE RECHAZO:`);
        console.log(`   ${details.rejection_reason}\n`);
      } else {
        console.log(`   (Sin razón de rechazo específica)\n`);
      }
      
      if (details.quality_score) {
        console.log(`   📊 Calidad: ${details.quality_score.score} (${details.quality_score.date})`);
      }
    }
    
    console.log('─'.repeat(80) + '\n');
    
    // Esperar 100ms entre requests para no saturar la API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n💡 PROBLEMAS COMUNES DE RECHAZO EN WHATSAPP:\n');
  console.log('1. Demasiadas variables (máximo 4-5 recomendado)');
  console.log('2. Contenido con emojis excesivos');
  console.log('3. Categoría incorrecta (UTILITY para transaccionales, MARKETING para promocionales)');
  console.log('4. Texto muy largo o con formato complejo');
  console.log('5. Uso de variables en lugares no permitidos (ej: en saludos)');
  console.log('6. Plantillas que parecen spam o phishing');
  console.log('7. No seguir las mejores prácticas de formato de Meta\n');
})();
