#!/usr/bin/env node
/**
 * Crear solo el template pago_recibido_v2 con texto más largo
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

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

const template = {
  name: 'pago_recibido_v2',
  category: 'UTILITY',
  language: 'es',
  components: [
    {
      type: 'BODY',
      text: 'Hola {{1}},\n\nTe confirmamos que hemos recibido correctamente tu pago de ${{2}} correspondiente a {{3}}.\n\nReferencia: {{4}}\n\nMuchas gracias por tu confianza.'
    }
  ]
};

const makeRequest = (method, pathname, data) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.facebook.com',
      path: pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: responseData ? JSON.parse(responseData) : null
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
};

(async () => {
  console.log('\n⏳ Creando template: pago_recibido_v2 (UTILITY)\n');
  
  const payload = {
    name: template.name,
    language: template.language,
    category: template.category,
    components: template.components
  };

  try {
    const response = await makeRequest(
      'POST',
      `/v21.0/${WABA_ID}/message_templates`,
      payload
    );

    if (response.status === 200 || response.status === 201) {
      console.log(`✅ ${template.name}`);
      console.log(`   ID: ${response.data.id}\n`);
      console.log('✅ Todos los templates han sido creados exitosamente!');
      console.log('⏳ Esperando aprobación de Meta (24-48h)...\n');
    } else {
      console.log(`❌ ${template.name}`);
      console.log(`   Error: ${JSON.stringify(response.data, null, 2)}\n`);
    }
  } catch (error) {
    console.log(`❌ ${template.name}`);
    console.log(`   Error: ${error.message}\n`);
  }
})();
