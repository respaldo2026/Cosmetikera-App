#!/usr/bin/env node
/**
 * Crea la plantilla "puntos_compra_es" en Meta WhatsApp Business Manager.
 *
 * Categoría: UTILITY (mensaje transaccional desencadenado por acción del usuario)
 * Variables:
 *   {{1}} = nombre del cliente
 *   {{2}} = puntos ganados en esta compra
 *   {{3}} = total de puntos acumulados
 *   {{4}} = nivel actual (Bronce / Plata / Oro / Diamante)
 *
 * Uso:
 *   node scripts/crear-template-puntos-compra.js
 *
 * Requisitos en .env.local:
 *   WHATSAPP_WABA_ID=<WhatsApp Business Account ID>
 *   WHATSAPP_ACCESS_TOKEN=<token de acceso permanente>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Cargar .env.local ──────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local');
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const [key, ...rest] = line.split('=');
    if (key && !key.startsWith('#')) envVars[key.trim()] = rest.join('=').trim();
  });
}

const WABA_ID = envVars.WHATSAPP_WABA_ID;
const ACCESS_TOKEN = envVars.WHATSAPP_ACCESS_TOKEN;

if (!WABA_ID || !ACCESS_TOKEN) {
  console.error('❌  Faltan WHATSAPP_WABA_ID o WHATSAPP_ACCESS_TOKEN en .env.local');
  process.exit(1);
}

// ── Definición de la plantilla ─────────────────────────────────────────────
const template = {
  name: 'puntos_compra_es',
  category: 'UTILITY',
  language: 'es',
  components: [
    {
      type: 'BODY',
      // Texto puramente transaccional: informa sobre acción ya realizada.
      // Sin frases promocionales para que Meta lo clasifique como UTILITY.
      text: 'Hola {{1}},\n\nGracias por tu compra en La Cosmetikera.\n\nPuntos ganados: +{{2}} pts\nTotal acumulado: {{3}} pts\nNivel: {{4}}',
    },
    {
      type: 'FOOTER',
      text: 'La Cosmetikera',
    },
  ],
};

// ── Enviar solicitud a la API de Meta ──────────────────────────────────────
function postTemplate(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'graph.facebook.com',
      path: `/v21.0/${WABA_ID}/message_templates`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log('📤  Enviando plantilla "puntos_compra_es" a Meta...\n');
  console.log('Cuerpo del mensaje:\n');
  console.log('─'.repeat(60));
  console.log(template.components[0].text);
  console.log('─'.repeat(60) + '\n');

  try {
    const { status, body } = await postTemplate(template);
    if (status === 200 || status === 201) {
      console.log('✅  Plantilla enviada con éxito. ID:', body.id || '(ver body)');
      console.log('Estado inicial:', body.status || 'PENDING');
      console.log('\nMeta revisará y aprobará la plantilla en minutos/horas.');
      console.log('Puedes verificar el estado en:');
      console.log(`  https://business.facebook.com/wa/manage/message-templates/\n`);
    } else {
      console.error('❌  Error al crear la plantilla (HTTP', status, ')');
      console.error(JSON.stringify(body, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error('❌  Error de red:', err.message);
    process.exit(1);
  }
})();
