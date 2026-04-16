/**
 * TEST RÁPIDO: Enviar primer mensaje WhatsApp
 * 
 * INSTRUCCIONES:
 * 1. Asegúrate de haber ejecutado SQL-WHATSAPP-COMPLETO-EJECUTAR-AHORA.sql
 * 2. Reemplaza TU_TELEFONO con tu número (+57...)
 * 3. Ejecuta: node test-whatsapp-basico.js
 * 4. Revisa tu WhatsApp
 * 
 * IMPORTANTE: Este script se ejecuta desde la consola del navegador
 * porque usa fetch del cliente.
 */

// ============================================
// OPCIÓN 1: Copiar en Console del navegador
// ============================================

// Abre: http://localhost:3001 → F12 → Console → Pega esto:

async function testWhatsAppRapido() {
  console.log('🚀 Iniciando test de WhatsApp...');
  
  const TU_TELEFONO = '+573001234567'; // ⚠️ REEMPLAZA CON TU NÚMERO
  
  try {
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: TU_TELEFONO,
        type: 'text',
        message: '✅ TEST EXITOSO\\n\\n¡La integración WhatsApp está funcionando!\\n\\n_Enviado desde Academia Crystal_'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ ¡MENSAJE ENVIADO!', data);
      console.log('📱 Revisa tu WhatsApp ahora');
      console.log('MessageID:', data.messageId);
    } else {
      console.error('❌ Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Error crítico:', error);
  }
}

// Ejecutar el test
testWhatsAppRapido();

// ============================================
// OPCIÓN 2: Test usando el módulo (después de FASE 1+3)
// ============================================

// Este código se ejecuta cuando ya tienes las tablas creadas
// Copia en Console del navegador:

async function testModuloWhatsApp() {
  console.log('🚀 Test del módulo completo...');
  
  // Importar el módulo (solo funciona en código TypeScript de la app)
  const { enviarInformacionCurso } = await import('./src/services/whatsapp-messages-module');
  
  const TU_TELEFONO = '+573001234567'; // ⚠️ REEMPLAZA
  
  const resultado = await enviarInformacionCurso(
    TU_TELEFONO,
    {
      nombre: 'Juan Test',
      nombreCurso: 'Curso de Prueba',
      descripcionCurso: 'Este es un mensaje de prueba del sistema',
      duracion: '3 meses',
      horario: 'Lunes y Miércoles 7-9 PM',
      modalidad: 'Virtual',
      requisitos: 'Ninguno',
      costoInscripcion: 50000,
      costoMensualidad: 200000,
      duracionMeses: 3,
      cuposDisponibles: 20,
      queIncluye: 'Material digital, certificado',
      fechaProximaCohorte: 'Marzo 15, 2026',
      fechaCierreInscripcion: 'Marzo 10, 2026',
      linkInscripcion: 'https://academia-crystal.com/cursos/test'
    }
  );
  
  console.log(resultado.exito ? '✅ ÉXITO' : '❌ ERROR', resultado);
}

// ============================================
// OPCIÓN 3: Script Node.js (avanzado)
// ============================================

/**
 * Si quieres ejecutar desde Node.js (requiere dotenv):
 * 
 * 1. Instala: npm install node-fetch
 * 2. Ejecuta: node test-whatsapp-basico.js
 */

// Descomenta esto si usas Node.js:
/*
const fetch = require('node-fetch');

async function testWhatsAppNode() {
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const TU_TELEFONO = '+573001234567'; // ⚠️ REEMPLAZA
  
  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: TU_TELEFONO,
      type: 'text',
      text: {
        body: '✅ TEST DIRECTO A API\\n\\n¡Funciona!\\n\\n_Academia Crystal_'
      }
    })
  });
  
  const data = await response.json();
  console.log(data);
}

testWhatsAppNode();
*/

// ============================================
// VERIFICACIONES EN SUPABASE
// ============================================

/**
 * Después de enviar un mensaje, verifica en Supabase SQL Editor:
 * 
 * -- Ver último mensaje enviado
 * SELECT * FROM whatsapp_mensajes ORDER BY creado_en DESC LIMIT 1;
 * 
 * -- Ver todas las plantillas
 * SELECT nombre, activa FROM plantillas_whatsapp;
 * 
 * -- Ver estadísticas de hoy
 * SELECT * FROM vw_whatsapp_stats_diarias WHERE fecha = CURRENT_DATE;
 * 
 * -- Contar mensajes por estado
 * SELECT estado, COUNT(*) FROM whatsapp_mensajes GROUP BY estado;
 */

// ============================================
// TROUBLESHOOTING
// ============================================

/**
 * ❌ Error "Plantilla no encontrada":
 *    → Ejecutaste SQL-WHATSAPP-COMPLETO-EJECUTAR-AHORA.sql?
 *    → Verifica: SELECT COUNT(*) FROM plantillas_whatsapp;
 * 
 * ❌ Error "Failed to fetch":
 *    → El servidor está corriendo? (npm run dev)
 *    → Verifica .env.local tiene WHATSAPP_ACCESS_TOKEN
 * 
 * ❌ Error "Invalid phone number":
 *    → Formato debe ser: +57 + número (sin espacios ni guiones)
 *    → Ejemplo correcto: +573001234567
 * 
 * ❌ No llega el mensaje:
 *    → Revisa que el número de prueba de Facebook esté activo
 *    → Verifica en Meta Business Suite el estado
 *    → Comprueba que tu número esté verificado en la app de prueba
 * 
 * ✅ Mensaje enviado pero no guardado en BD:
 *    → Verifica que la tabla whatsapp_mensajes existe
 *    → Revisa permisos RLS en Supabase
 *    → Comprueba logs del servidor
 */

console.log(`
╔════════════════════════════════════════╗
║   TEST WHATSAPP - Academia Crystal     ║
╚════════════════════════════════════════╝

📋 PASOS:
1. ✅ SQL ejecutado en Supabase
2. ⏳ Reemplazar TU_TELEFONO arriba
3. ⏳ Copiar código en Console del navegador
4. ⏳ Ejecutar y revisar WhatsApp

💡 TIP: Usa OPCIÓN 1 primero (más simple)
`);
