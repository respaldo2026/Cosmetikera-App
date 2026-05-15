/**
 * Test manual del cron de cumpleaños
 * Uso: node scripts/_test-cron-birthday.js
 */
require("dotenv").config({ path: ".env.local" });

const BASE_URL = "https://cosmetikera-app.vercel.app";
const API_KEY = process.env.WHATSAPP_API_KEY;

async function testOffset(offset, label, dryRun = true) {
  console.log(`\n📋 Probando [${label}] (dias_offset=${offset}, dry_run=${dryRun})...`);
  try {
    const res = await fetch(`${BASE_URL}/api/whatsapp/send-birthday-reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ dias_offset: offset, dry_run: dryRun }),
    });
    const data = await res.json();
    console.log(`   Status HTTP: ${res.status}`);
    console.log(`   Respuesta:`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`   ❌ Error de red:`, err.message);
  }
}

async function testCronEndpoint(path, label) {
  const CRON_SECRET = process.env.CRON_SECRET;
  console.log(`\n⏰ Probando cron endpoint [${label}]: GET ${BASE_URL}${path}`);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json();
    console.log(`   Status HTTP: ${res.status}`);
    console.log(`   Respuesta:`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`   ❌ Error de red:`, err.message);
  }
}

async function main() {
  console.log("=" .repeat(60));
  console.log("TEST MANUAL: CRON DE CUMPLEAÑOS");
  console.log(`Fecha: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}`);
  console.log("=" .repeat(60));

  if (!API_KEY) {
    console.error("❌ WHATSAPP_API_KEY no encontrada en .env.local");
    process.exit(1);
  }

  // Test dry-run de los 3 offsets
  await testOffset(-2, "2 días antes", true);
  await testOffset(-1, "1 día antes", true);
  await testOffset(0, "Hoy", true);

  // Test de los endpoints de cron directo (con CRON_SECRET)
  console.log("\n" + "─".repeat(60));
  console.log("PROBANDO ENDPOINTS CRON (GET con Bearer token):");
  await testCronEndpoint("/api/cron/cumpleanos/hoy", "hoy");
}

main().catch(console.error);
