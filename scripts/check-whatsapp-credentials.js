#!/usr/bin/env node
/**
 * Diagnóstico: Verifica credenciales de WhatsApp
 * Uso: node scripts/check-whatsapp-credentials.js
 */

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function check(name, value) {
  if (value) {
    log('green', `  ✅ ${name}: ${value.substring(0, 20)}...`);
    return true;
  } else {
    log('red', `  ❌ ${name}: FALTANTE`);
    return false;
  }
}

console.log('\n');
log('cyan', '═'.repeat(60));
log('blue', '  VERIFICACIÓN DE CREDENCIALES WHATSAPP');
log('cyan', '═'.repeat(60));

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'WHATSAPP_API_KEY',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
];

const optional = [
  'CRON_SECRET',
];

log('yellow', '\n📋 VARIABLES REQUERIDAS:\n');

let allOk = true;
required.forEach(name => {
  const value = process.env[name];
  if (!check(name, value)) allOk = false;
});

log('yellow', '\n📋 VARIABLES OPCIONALES:\n');
optional.forEach(name => {
  const value = process.env[name];
  if (value) {
    log('green', `  ✅ ${name}: Configurada`);
  } else {
    log('yellow', `  ⚠️  ${name}: No configurada (recomendada)`);
  }
});

log('yellow', '\n📋 ENDPOINTS QUE USAN CREDENCIALES:\n');
console.log(`
  Bienvenida Club:
    - Requiere: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN
    - Endpoint: POST /api/whatsapp/send-club-welcome
    - Plantilla: club_welcome_es

  Cumpleaños:
    - Requiere: WHATSAPP_API_KEY (para validar en endpoint)
    - Endpoint: GET /api/cron/cumpleanos/[offset]
    - Plantillas: cumpleanos_recordatorio_2d_es, cumpleanos_recordatorio_1d_es, cumpleanos_celebracion_es

  Otros mensajes:
    - Requiere: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
    - Endpoint: POST /api/whatsapp/send
`);

if (allOk) {
  log('green', '\n✅ TODAS LAS CREDENCIALES ESTÁN CONFIGURADAS\n');
  log('green', 'Próximos pasos:');
  console.log(`
    1. Verifica en Vercel > Settings > Environment Variables
    2. Haz un test:
       curl -X POST http://localhost:3000/api/whatsapp/send-club-welcome \\
         -H "x-api-key: $WHATSAPP_API_KEY" \\
         -H "Content-Type: application/json" \\
         -d '{
           "perfil_id": "test-uuid",
           "cedula": "1234567890",
           "telefono": "573001234567"
         }'
    3. Revisa logs en Vercel para errores específicos
  `);
} else {
  log('red', '\n❌ FALTAN CREDENCIALES\n');
  log('red', 'Acción requerida:');
  console.log(`
    1. Ve a Vercel > Project Settings > Environment Variables
    2. Añade las variables que faltan:
       - WHATSAPP_PHONE_NUMBER_ID: Tu Phone Number ID de Meta Business
       - WHATSAPP_ACCESS_TOKEN: Tu Token de acceso de Meta
       - WHATSAPP_API_KEY: Una clave de API para validar requests internos
    3. Haz deploy nuevamente
    4. Vuelve a ejecutar este script para verificar
  
    Para obtener credenciales:
    - Ir a https://business.facebook.com
    - WhatsApp > Settings > API Setup
    - Copia: Phone Number ID y Access Token
  `);
}

console.log('\n');
