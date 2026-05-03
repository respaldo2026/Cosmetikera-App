const SUPABASE_URL = "https://gzrogwpbkkynhuostxle.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cm9nd3Bia2t5bmh1b3N0eGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM0OTk2OCwiZXhwIjoyMDkxOTI1OTY4fQ.H-lDbJalRCpSp1-HBCKrY9gf4ahOENAck409NUQikb0";

async function main() {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/whatsapp_conversation_history?tipo_mensaje=eq.template&select=id,perfil_id,mensaje,created_at&order=created_at.asc`,
    { headers }
  );
  const all = await res.json();
  console.log("Total registros template:", all.length);

  const byPerfil = {};
  for (const r of all) {
    if (!byPerfil[r.perfil_id]) byPerfil[r.perfil_id] = [];
    byPerfil[r.perfil_id].push(r);
  }

  const toDelete = [];
  for (const [perfil_id, records] of Object.entries(byPerfil)) {
    if (records.length <= 1) continue;
    records.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const hasEnviado = records.some(r => r.mensaje && r.mensaje.toLowerCase().includes("plantilla enviada"));
    if (hasEnviado) {
      for (const r of records) {
        if (!r.mensaje || !r.mensaje.toLowerCase().includes("plantilla enviada")) {
          toDelete.push(r.id);
          console.log(`  BORRAR [${r.id.slice(0,8)}]: "${(r.mensaje||"").slice(0,70)}"`);
        }
      }
    }
  }

  console.log(`\nTotal a borrar: ${toDelete.length}`);
  if (toDelete.length === 0) { console.log("Nada que limpiar."); return; }

  for (let i = 0; i < toDelete.length; i += 20) {
    const batch = toDelete.slice(i, i + 20);
    const ids = batch.map(id => `"${id}"`).join(",");
    const delRes = await fetch(
      `${SUPABASE_URL}/rest/v1/whatsapp_conversation_history?id=in.(${ids})`,
      { method: "DELETE", headers }
    );
    console.log(`Lote ${Math.floor(i/20)+1} borrado, status: ${delRes.status}`);
  }
  console.log("Limpieza completa.");
}

main().catch(console.error);
