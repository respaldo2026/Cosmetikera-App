#!/usr/bin/env node
/**
 * Script para probar envío simple de template
 * Uso: node scripts/probar-template-simple.js <telefono> <nombre_template> [variable1] [variable2] ...
 * Ejemplo: node scripts/probar-template-simple.js "573000000757" "inscripcion_confirmada" "Juan" "Curso Python"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

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

const PHONE_NUMBER_ID = envVars.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = envVars.WHATSAPP_ACCESS_TOKEN;
const WABA_ID = envVars.WHATSAPP_WABA_ID;

if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
  console.error('❌ Error: Faltan variables de WhatsApp en .env.local');
  process.exit(1);
}

// Parsear argumentos
const [, , phoneArg, templateName, ...variables] = process.argv;

if (!phoneArg || !templateName) {
  console.error('❌ Uso: node scripts/probar-template-simple.js <telefono> <template> [variables...]');
  console.error('   Ejemplo: node scripts/probar-template-simple.js "573000000757" "inscripcion_confirmada" "Juan" "Python"');
  process.exit(1);
}

const phone = phoneArg.replace(/\D/g, '');
if (!phone || phone.length < 10) {
  console.error('❌ Error: Teléfono inválido');
  process.exit(1);
}

console.log('\n🚀 Prueba de Template WhatsApp');
console.log('═'.repeat(60));
console.log(`📱 Teléfono: +${phone}`);
console.log(`📋 Template: ${templateName}`);
if (variables.length > 0) {
  console.log(`📝 Variables: ${variables.join(', ')}`);
}
console.log('═'.repeat(60) + '\n');

// Construir payload
const payload = {
  messaging_product: 'whatsapp',
  to: phone,
  type: 'template',
  template: {
    name: templateName,
    language: {
      code: 'es'
    }
  }
};

if (variables.length > 0) {
  payload.template.parameters = {
    body: {
      parameters: variables.map(v => ({
        type: 'text',
        text: String(v)
      }))
    }
  };
}

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
  try {
    console.log('📤 Enviando template...\n');
    
    const response = await makeRequest(
      'POST',
      `/v21.0/${PHONE_NUMBER_ID}/messages`,
      payload
    );

    if (response.status === 200) {
      const messageId = response.data?.messages?.[0]?.id;
      console.log('✅ Template enviado exitosamente');
      console.log(`📌 Message ID: ${messageId}`);
      console.log('\n📊 Respuesta completa:');
      console.log(JSON.stringify(response.data, null, 2));
      process.exit(0);
    } else {
      console.error('❌ Error al enviar template:');
      console.error(`Status: ${response.status}`);
      console.error('Response:');
      console.error(JSON.stringify(response.data, null, 2));
      
      // Intentar dar sugerencia según el error
      if (response.data?.error) {
        const err = response.data.error;
        if (err.code === 100) {
          console.error('\n💡 Sugerencia: El parámetro está inválido. Verifica el formato del template.');
        } else if (err.code === 2388024) {
          console.error('\n💡 Sugerencia: El template aún no está aprobado por Meta.');
        } else if (err.code === 131031) {
          console.error('\n💡 Sugerencia: El token de acceso está inválido o expirado.');
        }
      }
      
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error crítico:', error.message);
    process.exit(1);
  }
})();
