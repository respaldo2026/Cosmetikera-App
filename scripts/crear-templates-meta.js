#!/usr/bin/env node

/**
 * Script para crear Message Templates en Meta WhatsApp Business
 * 
 * Uso: node scripts/crear-templates-meta.js
 * 
 * Este script crea los 7 templates aprobados oficialmente por Meta.
 * Respeta la división de roles:
 * - MARKETING: Make responde (leads, publicidad)
 * - TRANSACTIONAL: App envía (confirmaciones, recordatorios, info)
 */

const fs = require('fs');
const path = require('path');

// Cargar .env.local manualmente
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

require('dotenv').config({ path: envPath });

const https = require('https');

// ============================================
// CONFIGURACIÓN
// ============================================

const WABA_ID = process.env.WHATSAPP_WABA_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = 'v21.0';

if (!WABA_ID || !ACCESS_TOKEN) {
  console.error('❌ Error: WHATSAPP_WABA_ID o WHATSAPP_ACCESS_TOKEN no configurados en .env.local');
  process.exit(1);
}

// ============================================
// TEMPLATES A CREAR
// ============================================

const TEMPLATES = [
  {
    name: 'inscripcion_confirmada',
    category: 'UTILITY',
    language: 'es',
    body: {
      text: 'Hola {{1}},\n\n¡Tu inscripción ha sido confirmada! 🎓\n\nCurso: {{2}}\nFecha de inicio: {{3}}\nHorario: {{4}}\nMensualidad: ${{5}}\nInstructor: {{6}}\nFecha de pago: {{7}}\n\nEsperamos verte pronto. 😊'
    },
    footer: 'Academia Crystal Diamante'
  },
  {
    name: 'pago_recibido',
    category: 'UTILITY',
    language: 'es',
    body: {
      text: 'Hola {{1}},\n\n✅ Tu pago ha sido recibido correctamente.\n\nReferencia: {{2}}\nMonto: ${{3}}\nFecha: {{4}}\nConcepto: {{5}}\nCurso: {{6}}\nVigencia: {{7}}\nPróxima clase: {{8}}\n\nGracias por tu confianza. 💚'
    },
    footer: 'Academia Crystal Diamante'
  },
  {
    name: 'recordatorio_pago',
    category: 'MARKETING',
    language: 'es',
    body: {
      text: 'Hola {{1}},\n\n⏰ Recordatorio: Tu pago de {{2}} vence el {{3}}.\n\nMonto: ${{4}}\nCurso: {{5}}\n\nEfectúa el pago a tiempo para continuar con tus clases.\n\n¿Preguntas? Contacta con nosotros.'
    },
    footer: 'Academia Crystal Diamante'
  },
  {
    name: 'formulario_interes',
    category: 'MARKETING',
    language: 'es',
    body: {
      text: 'Hola {{1}},\n\nGracias por tu interés en {{2}}. 🙏\n\n📍 Ciudad: {{3}}\n💡 Beneficios principales:\n• {{4}}\n• {{5}}\n• {{6}}\n• {{7}}\n\n📅 Fecha de inicio: {{8}}\n🎯 Cupos disponibles: {{9}}\n\n🔗 Más info: {{10}}\n📞 Soporte: {{11}}\n\n¡Hablamos pronto! 😊'
    },
    footer: 'Academia Crystal Diamante'
  },
  {
    name: 'bienvenida_nuevo_estudiante',
    category: 'UTILITY',
    language: 'es',
    body: {
      text: 'Bienvenido {{1}},\n\n¡Nos alegra que empieces con nosotros! 🎉\n\nCurso: {{2}}\nPróximas clases:\n• {{3}}\n• {{4}}\n• {{5}}\n\nHorario: {{6}}\n📍 Ubicación: {{7}}\nSalón: {{8}}\n👨‍🏫 Instructor: {{9}}\n\nEsperamos tu asistencia. ¡Mucho éxito! 💪'
    },
    footer: 'Academia Crystal Diamante'
  },
  {
    name: 'recordatorio_clase',
    category: 'UTILITY',
    language: 'es',
    body: {
      text: 'Hola {{1}},\n\n⏰ ¡Tu clase comienza en 1 hora!\n\n📚 Curso: {{2}}\n⏰ Hora: {{3}}\n📍 Ubicación: {{4}}\n👨‍🏫 Instructor: {{5}}\n\nNo olvides asistir. 😊'
    },
    footer: 'Academia Crystal Diamante'
  },
  {
    name: 'certificado_disponible',
    category: 'UTILITY',
    language: 'es',
    body: {
      text: 'Felicitaciones {{1}},\n\n🏆 ¡Tu certificado está disponible!\n\nCurso: {{2}}\n\n📥 Descarga digital: {{3}}\n📅 Disponible desde: {{4}}\n⏰ Horario de atención: {{5}}\n📍 Dirección: {{6}}\n\n🎓 Ceremonia de grados:\n📅 Fecha: {{7}}\n⏰ Hora: {{8}}\n📍 Lugar: {{9}}\n💵 Copias adicionales: {{10}}\n\n¡Estamos orgullosos de tu logro! 🎉'
    },
    footer: 'Academia Crystal Diamante'
  }
];

// ============================================
// UTILIDADES
// ============================================

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.facebook.com',
      path: `/${API_VERSION}${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: parsed,
            headers: res.headers,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// ============================================
// CREAR TEMPLATES
// ============================================

async function crearTemplate(template) {
  const body = {
    name: template.name,
    category: template.category,
    language: template.language,
    components: [
      {
        type: 'BODY',
        text: template.body.text,
      },
      {
        type: 'FOOTER',
        text: template.footer,
      },
    ],
  };

  console.log(`\n⏳ Creando template: ${template.name} (${template.category})`);

  try {
    const response = await makeRequest('POST', `/${WABA_ID}/message_templates`, body);

    if (response.status === 200 || response.status === 201) {
      console.log(`✅ ${template.name}`);
      console.log(`   ID: ${response.data.id}`);
      console.log(`   Status: PENDING_REVIEW`);
      return { success: true, name: template.name, id: response.data.id };
    } else {
      console.log(`❌ ${template.name}`);
      console.log(`   Error: ${JSON.stringify(response.data)}`);
      return { success: false, name: template.name, error: response.data };
    }
  } catch (error) {
    console.log(`❌ ${template.name}`);
    console.log(`   Error crítico: ${error.message}`);
    return { success: false, name: template.name, error: error.message };
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🚀 Script para crear Message Templates en Meta WhatsApp\n');
  console.log(`📱 WABA ID: ${WABA_ID}`);
  console.log(`🔑 Access Token: ${ACCESS_TOKEN.substring(0, 20)}...`);
  console.log(`📦 API Version: ${API_VERSION}\n`);

  console.log('📋 Templates a crear:');
  console.log('   MARKETING (Make responde):');
  console.log('   • recordatorio_pago');
  console.log('   • formulario_interes\n');
  console.log('   TRANSACTIONAL (App envía):');
  console.log('   • inscripcion_confirmada');
  console.log('   • pago_recibido');
  console.log('   • bienvenida_nuevo_estudiante');
  console.log('   • recordatorio_clase');
  console.log('   • certificado_disponible\n');

  console.log('=' + '='.repeat(69));

  const resultados = [];

  // Procesar templates con delay para evitar rate limiting
  for (const template of TEMPLATES) {
    const resultado = await crearTemplate(template);
    resultados.push(resultado);

    // Esperar 2 segundos entre llamadas para evitar rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 RESUMEN:\n');

  const exitosos = resultados.filter((r) => r.success);
  const fallidos = resultados.filter((r) => !r.success);

  console.log(`✅ Exitosos: ${exitosos.length}/${resultados.length}`);
  if (exitosos.length > 0) {
    exitosos.forEach((r) => {
      console.log(`   • ${r.name} (ID: ${r.id})`);
    });
  }

  if (fallidos.length > 0) {
    console.log(`\n❌ Fallidos: ${fallidos.length}/${resultados.length}`);
    fallidos.forEach((r) => {
      console.log(`   • ${r.name}`);
      if (typeof r.error === 'string') {
        console.log(`     ${r.error}`);
      } else {
        console.log(`     ${JSON.stringify(r.error)}`);
      }
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📝 PRÓXIMOS PASOS:\n');

  if (exitosos.length > 0) {
    console.log('1. Los templates fueron enviados para aprobación');
    console.log('2. Meta revisará cada template (24-48 horas típico)');
    console.log('3. Recibirás notificación cuando estén aprobados');
    console.log('4. Una vez aprobados, puedes enviar mensajes vía API\n');

    console.log('🔍 Verificar estado:\n');
    console.log(`   curl -X GET "https://graph.instagram.com/v21.0/${WABA_ID}/message_templates?access_token=${ACCESS_TOKEN.substring(0, 20)}..."`);
  }

  console.log('\n💡 Notas importantes:\n');
  console.log('• MARKETING templates pueden requerir más tiempo de aprobación');
  console.log('• TRANSACTIONAL templates usualmente se aprueban rápido');
  console.log('• Si falla, verifica que WABA_ID y ACCESS_TOKEN sean correctos');
  console.log('• El ACCESS_TOKEN debe tener permisos whatsapp_business_messaging\n');

  process.exit(fallidos.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\n❌ Error crítico:', error.message);
  process.exit(1);
});
