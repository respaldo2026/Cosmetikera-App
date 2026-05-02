#!/usr/bin/env node
/**
 * Script de diagnóstico: Verifica estado de flujos de mensajería WhatsApp
 * 
 * Uso:
 *   node scripts/check-whatsapp-flows.js
 * 
 * Revisa:
 * 1. Bienvenida al Club (club_welcome_es)
 * 2. Cumpleaños (-2, -1, 0 días)
 * 3. Configuración de Vercel Cron
 */

const https = require('https');

// Colores para consola
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

function header(title) {
  console.log('\n');
  log('cyan', '═'.repeat(60));
  log('blue', `  ${title}`);
  log('cyan', '═'.repeat(60));
}

async function checkEndpoint(name, path, method = 'GET') {
  return new Promise((resolve) => {
    const url = new URL(path, 'https://your-domain.vercel.app');
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: method,
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'YOUR_CRON_SECRET'}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ name, status: res.statusCode, data: json });
        } catch {
          resolve({ name, status: res.statusCode, data: data.substring(0, 100) });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ name, status: 0, error: error.message });
    });
    req.end();
  });
}

async function main() {
  header('DIAGNÓSTICO DE FLUJOS WHATSAPP');

  log('yellow', '\n⚠️  Este script verifica que los endpoints estén configurados correctamente.\n');

  // 1. Checklist de flujos
  header('1️⃣  FLUJO DE BIENVENIDA AL CLUB');
  log('blue', 'Endpoint: POST /api/whatsapp/send-club-welcome');
  log('blue', 'Disparo: Cuando cliente se inscribe al Club');
  log('blue', 'Plantilla: club_welcome_es (TRANSACTIONAL)');
  console.log(`
  ✅ Qué verificar en Supabase:
    - Tabla: whatsapp_conversation_history
    - Filtro: tipo_mensaje = 'template' Y plantilla = 'club_welcome_es'
    - Debe mostrar envíos a clientes recién creados

  ✅ Qué verificar en WhatsApp Business Manager:
    - Mensaje recibido en conversación con cliente
    - Debe contener variable {{1}} reemplazada con cédula
  `);

  header('2️⃣  FLUJO DE CUMPLEAÑOS');
  log('blue', 'Endpoint: GET /api/cron/cumpleanos/[offset]');
  log('blue', 'Disparo: Diariamente a las 06:00 AM (Bogotá)');
  log('blue', 'Plantillas:');
  console.log(`
    - cumpleanos_recordatorio_2d_es (2 días antes) ➜ {{1}} = nombre
    - cumpleanos_recordatorio_1d_es (1 día antes) ➜ {{1}} = nombre
    - cumpleanos_celebracion_es (día del cumpleaños) ➜ {{1}} = nombre
  
  ✅ Qué verificar en Vercel:
    - Proyecto > Cron Jobs
    - Deben aparecer 3 rutas:
      • /api/cron/cumpleanos/2d  (schedule: 0 11 * * *)
      • /api/cron/cumpleanos/1d  (schedule: 5 11 * * *)
      • /api/cron/cumpleanos/hoy (schedule: 10 11 * * *)

  ✅ Qué verificar en Supabase:
    - Tabla: cumpleaños_notificaciones
    - Debe mostrar: enviado_2d_antes, enviado_1d_antes, enviado_dia_cumple
    - Columnas de fecha_* con timestamp de envío
    - Tabla: whatsapp_conversation_history
      • Filtro: plantilla LIKE 'cumpleanos%'
      • Debe mostrar historial de envíos
  
  ✅ Qué verificar en Vercel Logs:
    - https://vercel.com/your-project/deployments
    - Buscar: "[Birthday]" o "send-birthday-reminder"
    - Debe mostrar: "enviados: X, fallidos: Y"
  `);

  header('3️⃣  OTROS FLUJOS AUTOMÁTICOS');
  log('blue', 'Endpoint: POST /api/whatsapp/send');
  log('blue', 'Disparo: Manualmente desde admin o Make.com');
  console.log(`
  ✅ Qué verificar en Supabase:
    - Tabla: whatsapp_conversation_history
    - Todos los mensajes salientes se registran aquí
    - Filtro: rol = 'agente' para ver solo mensajes de la app
  `);

  header('4️⃣  VARIABLES DE ENTORNO REQUERIDAS');
  console.log(`
  En Vercel > Settings > Environment Variables:
  
  ✅ Para cumpleaños (Cron):
    - CRON_SECRET        (recomendado, para autenticar cron)
    - WHATSAPP_API_KEY   (para llamar endpoint send-birthday-reminder)
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    - SUPABASE_SERVICE_ROLE_KEY

  ✅ Para bienvenida (Club):
    - WHATSAPP_API_KEY
    - WHATSAPP_PHONE_NUMBER_ID
    - WHATSAPP_ACCESS_TOKEN
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
  `);

  header('5️⃣  COMANDOS DE PRUEBA RÁPIDA');
  console.log(`
  🧪 Test local (solo cumpleaños -2 días):
    curl -X GET http://localhost:3000/api/cron/cumpleanos/2d \\
      -H "Authorization: Bearer $CRON_SECRET"

  🧪 Test en Vercel (usa dominio real):
    curl -X GET https://tu-app.vercel.app/api/cron/cumpleanos/2d \\
      -H "Authorization: Bearer $CRON_SECRET"

  🧪 Ejecutar dry_run (simular sin enviar):
    curl -X POST http://localhost:3000/api/whatsapp/send-birthday-reminder \\
      -H "x-api-key: $WHATSAPP_API_KEY" \\
      -H "Content-Type: application/json" \\
      -d '{"dias_offset":-2,"dry_run":true}'
  `);

  header('6️⃣  CHECKLIST DE VALIDACIÓN');
  console.log(`
  ✅ Bienvenida:
    □ Plantilla "club_welcome_es" creada en Meta Business Manager
    □ Aprobada (status: Approved)
    □ Tabla cumpleaños_notificaciones existe en Supabase
    □ Endpoint send-club-welcome responde 200 OK

  ✅ Cumpleaños:
    □ 3 plantillas creadas en Meta (2d, 1d, hoy)
    □ Todas aprobadas (status: Approved)
    □ vercel.json con 3 crons declarados
    □ CRON_SECRET configurada en Vercel
    □ WHATSAPP_API_KEY configurada
    □ Tabla cumpleaños_notificaciones existe
    □ Función RPC get_clientes_cumpleaños_proximos existe

  ✅ Logs y Auditoría:
    □ Vercel Logs muestran ejecuciones diarias
    □ Supabase muestra registros en cumpleaños_notificaciones
    □ whatsapp_conversation_history crece con cada envío
  `);

  header('7️⃣  TROUBLESHOOTING');
  console.log(`
  ❌ "No aparecen crons en Vercel":
    → Haz push de vercel.json a main
    → Espera 2 minutos para que Vercel lo lea
    → Revisa Deployments > Functions

  ❌ "Cron ejecuta pero no envía mensajes":
    → Verifica WHATSAPP_API_KEY en Vercel
    → Revisa Vercel Logs para errores
    → Confirma WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN

  ❌ "Plantilla rechazada por Meta":
    → Revisa mensaje de Meta en Business Manager
    → Usa docs/PLANTILLAS_META_CUMPLEAÑOS.md como referencia
    → Reenvía sin tildes ni caracteres especiales

  ❌ "Tabla cumpleaños_notificaciones vacía":
    → Verifica que la migración 202604280002_cumpleaños_automatizacion.sql se ejecutó
    → En Supabase SQL Editor:
       SELECT * FROM information_schema.tables WHERE table_name = 'cumpleaños_notificaciones';
  `);

  header('PRÓXIMOS PASOS');
  console.log(`
  1. Confirma que 3 templates están APPROVED en Meta
  2. Haz push de cambios (vercel.json + endpoint cron)
  3. Espera 2 minutos y verifica en Vercel > Deployments > Functions
  4. Ejecuta un cron test manual desde Vercel
  5. Revisa Vercel Logs para confirmar ejecución exitosa
  6. Valida en Supabase que se registraron envíos
  7. Pide a un cliente con cumpleaños próximo que verifique WhatsApp
  `);

  log('green', '\n✅ Script de diagnóstico completado. Revisa las instrucciones anteriores.\n');
}

main().catch((error) => {
  log('red', `Error: ${error.message}`);
  process.exit(1);
});
