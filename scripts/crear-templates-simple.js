#!/usr/bin/env node
/**
 * Script para crear Message Templates SIMPLIFICADOS en Meta WhatsApp
 * 
 * CAMBIOS vs versión anterior:
 * - Máximo 4 variables por template (antes: 7-11)
 * - Cero emojis (antes: múltiples)
 * - Texto simple y directo (antes: listas complejas)
 * - Categorías correctas (UTILITY para transaccionales)
 * 
 * Esto aumenta drásticamente la probabilidad de aprobación por Meta.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================
// CARGAR CREDENCIALES
// ============================================

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
  console.error('❌ Error: WHATSAPP_WABA_ID o WHATSAPP_ACCESS_TOKEN no configurados');
  process.exit(1);
}

// ============================================
// TEMPLATES SIMPLIFICADOS
// ============================================

const TEMPLATES = [
  // 1. Inscripción confirmada (UTILITY - Transaccional)
  {
    name: 'inscripcion_confirmada_v2',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: 'Hola {{1}},\n\nTu inscripción ha sido confirmada para {{2}}.\n\nInicio: {{3}}\nMensualidad: ${{4}}\n\nGracias por elegirnos.'
      }
    ]
  },

  // 2. Pago recibido (UTILITY - Transaccional)
  {
    name: 'pago_recibido_v2',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: 'Hola {{1}},\n\nConfirmamos recepción de pago: ${{2}} para {{3}}.\n\nReferencia: {{4}}\n\nGracias.'
      }
    ]
  },

  // 3. Recordatorio de clase (UTILITY - Transaccional)
  {
    name: 'recordatorio_clase_v2',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: 'Hola {{1}},\n\nRecordatorio: Tu clase de {{2}} es hoy a las {{3}}.\n\nTe esperamos.'
      }
    ]
  },

  // 4. Certificado disponible (UTILITY - Transaccional)
  {
    name: 'certificado_disponible_v2',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: 'Felicitaciones {{1}},\n\nTu certificado para {{2}} está disponible.\n\nDescarga: {{3}}\n\nEstamos orgullosos de tu logro.'
      }
    ]
  },

  // ============================================
  // MARKETING (Solo 2 - Los que Make responde)
  // ============================================

  // 5. Recordatorio de pago (MARKETING)
  {
    name: 'recordatorio_pago_v2',
    category: 'MARKETING',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: 'Hola {{1}},\n\nRecordatorio: Tu pago de ${{2}} para {{3}} vence el {{4}}.\n\nGracias.'
      }
    ]
  },

  // 6. Formulario de interés (MARKETING)
  {
    name: 'formulario_interes_v2',
    category: 'MARKETING',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: 'Hola {{1}},\n\nGracias por tu interés en {{2}}.\n\nInicio: {{3}}\n\nTe contactaremos pronto.'
      }
    ]
  }
];

// ============================================
// FUNCIONES DE API
// ============================================

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

// ============================================
// SCRIPT PRINCIPAL
// ============================================

(async () => {
  console.log('\n🚀 Script para crear Message Templates SIMPLIFICADOS');
  console.log('═'.repeat(70));
  console.log(`📱 WABA_ID: ${WABA_ID}`);
  console.log(`🔑 Access Token: ${ACCESS_TOKEN.substring(0, 30)}...`);
  console.log(`📦 API Version: v21.0\n`);

  console.log('📋 Templates a crear (versión simplificada):\n');
  console.log('   UTILITY (App envía):');
  TEMPLATES.filter(t => t.category === 'UTILITY').forEach(t => {
    const vars = (t.components[0].text.match(/\{\{\d+\}\}/g) || []).length;
    console.log(`   • ${t.name} (${vars} variables)`);
  });
  console.log('\n   MARKETING (Make responde):');
  TEMPLATES.filter(t => t.category === 'MARKETING').forEach(t => {
    const vars = (t.components[0].text.match(/\{\{\d+\}\}/g) || []).length;
    console.log(`   • ${t.name} (${vars} variables)`);
  });
  
  console.log('\n' + '═'.repeat(70) + '\n');

  const results = {
    success: [],
    failed: []
  };

  for (const template of TEMPLATES) {
    console.log(`⏳ Creando template: ${template.name} (${template.category})`);
    
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
        results.success.push(template.name);
      } else {
        console.log(`❌ ${template.name}`);
        console.log(`   Error: ${JSON.stringify(response.data)}\n`);
        results.failed.push({ name: template.name, error: response.data });
      }
    } catch (error) {
      console.log(`❌ ${template.name}`);
      console.log(`   Error crítico: ${error.message}\n`);
      results.failed.push({ name: template.name, error: error.message });
    }

    // Esperar 2 segundos entre requests (rate limiting)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // RESUMEN
  console.log('═'.repeat(70));
  console.log('\n📊 Resumen de Creación:\n');
  console.log(`✅ Exitosos: ${results.success.length}`);
  if (results.success.length > 0) {
    results.success.forEach(name => console.log(`   • ${name}`));
  }
  
  console.log(`\n❌ Fallidos: ${results.failed.length}`);
  if (results.failed.length > 0) {
    results.failed.forEach(item => {
      console.log(`   • ${item.name}`);
      if (item.error?.error) {
        console.log(`     ${item.error.error.message}`);
      }
    });
  }

  console.log('\n⏳ Próximo paso:');
  if (results.success.length > 0) {
    console.log('   Los templates creados están en revisión por Meta (24-48h)');
    console.log('   Verifica su estado con: npm run templates:listar');
  }
  
  console.log('\n' + '═'.repeat(70) + '\n');
})();
