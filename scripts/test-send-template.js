#!/usr/bin/env node

/**
 * Test: Enviar mensaje de prueba con plantilla APPROVED
 * Sirve para verificar que las plantillas están REALMENTE aprobadas
 */

const https = require('https');

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '794398730428114';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('❌ Error: WHATSAPP_ACCESS_TOKEN no está configurado');
  process.exit(1);
}

// Test phone (debe ser verificado en Meta)
const TEST_PHONE = '573000645757'; // Cambiar con un teléfono real de test

const TEMPLATES = [
  { name: 'inscripcion_confirmada_v2', vars: ['Juan', 'Python Avanzado', '15 febrero', '50000'] },
  { name: 'recordatorio_clase_v2', vars: ['Juan', 'Python', '10:00 AM'] },
  { name: 'pago_recibido_v2', vars: ['Juan', '50000', 'Python', 'REF-001'] },
  { name: 'certificado_disponible_v2', vars: ['Juan', 'Python', 'https://cert.example.com'] },
  { name: 'recordatorio_pago_v2', vars: ['Juan', '50000', 'Python', '28 febrero'] },
  { name: 'formulario_interes_v2', vars: ['Juan', 'Python', '15 febrero'] },
];

async function sendTemplate(templateName, variables) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to: TEST_PHONE,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'es_ES',
        },
        components: [
          {
            type: 'body',
            parameters: variables.map(v => ({ type: 'text', text: v })),
          },
        ],
      },
    });

    const options = {
      hostname: 'graph.facebook.com',
      path: `/v21.0/${PHONE_NUMBER_ID}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve({ success: true, id: response.messages?.[0]?.id });
          } else {
            resolve({
              success: false,
              error: response.error?.message || 'Error desconocido',
              code: response.error?.code,
            });
          }
        } catch (e) {
          resolve({ success: false, error: 'Parse error: ' + data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('📱 TEST: Enviar plantillas aprobadas\n');
  console.log(`📲 Teléfono de test: ${TEST_PHONE}`);
  console.log(`🔑 Token: ${ACCESS_TOKEN.substring(0, 20)}...`);
  console.log(`📱 Phone Number ID: ${PHONE_NUMBER_ID}\n`);

  let success = 0;
  let failed = 0;

  for (const template of TEMPLATES) {
    process.stdout.write(`⏳ Probando: ${template.name}... `);

    try {
      const result = await sendTemplate(template.name, template.vars);

      if (result.success) {
        console.log(`✅ APPROVED - ID: ${result.id}`);
        success++;
      } else {
        console.log(`❌ RECHAZADA: ${result.error}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      failed++;
    }

    // Delay entre requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   ✅ Exitosas: ${success}`);
  console.log(`   ❌ Fallidas: ${failed}`);

  if (success === TEMPLATES.length) {
    console.log('\n🎉 ¡TODAS LAS PLANTILLAS ESTÁN APROBADAS Y FUNCIONAN!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Algunas plantillas no están aprobadas o hay un problema');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
