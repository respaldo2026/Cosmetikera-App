const SUPABASE_URL = "https://gzrogwpbkkynhuostxle.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cm9nd3Bia2t5bmh1b3N0eGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM0OTk2OCwiZXhwIjoyMDkxOTI1OTY4fQ.H-lDbJalRCpSp1-HBCKrY9gf4ahOENAck409NUQikb0";

// Primero testear la función actual para confirmar el bug
async function main() {
  console.log("=== TEST función actual ===");
  const testRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_clientes_cumplean%C3%B1os_proximos`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ dias_offset: 0 }),
  });
  const testText = await testRes.text();
  console.log("Status:", testRes.status);
  console.log("Body:", testText.slice(0, 300));

  // Si el endpoint de produccion ya tiene el bug, necesitamos aplicar el fix.
  // La unica forma sin CLI es via la Management API de Supabase (necesita token de acceso personal).
  // Alternativa: ejecutar via el endpoint /pg que no suele estar habilitado.
  // Lo mejor: aplicar el fix en el código del route.ts para que no dependa de la función SQL.
  console.log("\n=== Verificando fix alternativo ===");
  console.log("La función SQL tiene bug, necesitamos arreglarlo via SQL Editor de Supabase Dashboard");
  console.log("O podemos hacer el fix en el código TypeScript directamente.");
}

main().catch(console.error);
