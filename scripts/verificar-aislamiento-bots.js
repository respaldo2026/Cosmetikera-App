// Script: verificar-aislamiento-bots.js
// Verifica si el aislamiento por phone_number_id está activo en Supabase.

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=".repeat(60));
  console.log("DIAGNÓSTICO: AISLAMIENTO DE BOTS POR phone_number_id");
  console.log("=".repeat(60));
  console.log(`WHATSAPP_PHONE_NUMBER_ID configurado: ${ownPhoneId || "(no configurado)"}`);
  console.log("");

  // 1. Verificar si la columna phone_number_id existe
  console.log("1. Verificando si existe la columna phone_number_id...");
  const { data: colCheck, error: colErr } = await supabase
    .from("whatsapp_conversation_history")
    .select("phone_number_id")
    .limit(1);

  if (colErr) {
    if (colErr.message && colErr.message.includes("phone_number_id")) {
      console.log("   ❌ La columna phone_number_id NO existe en la tabla.");
      console.log("   ⚠️  Debes ejecutar la migration en el Dashboard de Supabase:");
      console.log("   supabase/migrations/202605080001_add_phone_number_id_to_conversation_history.sql");
      console.log("");
      console.log("   SQL a ejecutar:");
      console.log("   ALTER TABLE whatsapp_conversation_history ADD COLUMN IF NOT EXISTS phone_number_id TEXT;");
      console.log("   CREATE INDEX IF NOT EXISTS idx_wch_phone_number_id ON whatsapp_conversation_history (phone_number_id);");
      console.log("   CREATE INDEX IF NOT EXISTS idx_wch_telefono_phone_number_id ON whatsapp_conversation_history (telefono, phone_number_id);");
    } else {
      console.log(`   ❌ Error inesperado: ${colErr.message}`);
    }
    return;
  }
  console.log("   ✅ La columna phone_number_id EXISTS en la tabla.\n");

  // 2. Contar registros totales
  const { count: totalCount } = await supabase
    .from("whatsapp_conversation_history")
    .select("*", { count: "exact", head: true });
  console.log(`2. Total de registros en whatsapp_conversation_history: ${totalCount ?? "?"}`);

  // 3. Contar registros SIN phone_number_id (potencialmente mezclados)
  const { count: sinPhoneId } = await supabase
    .from("whatsapp_conversation_history")
    .select("*", { count: "exact", head: true })
    .is("phone_number_id", null);
  console.log(`   - Sin phone_number_id (NULL): ${sinPhoneId ?? "?"}`);

  // 4. Distribución por phone_number_id
  console.log("\n3. Distribución por phone_number_id:");
  const { data: distribucion, error: distErr } = await supabase
    .from("whatsapp_conversation_history")
    .select("phone_number_id")
    .order("phone_number_id", { ascending: true });

  if (distErr) {
    console.log(`   ❌ Error: ${distErr.message}`);
  } else {
    const grupos = {};
    for (const row of distribucion || []) {
      const key = row.phone_number_id || "(NULL)";
      grupos[key] = (grupos[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(grupos)) {
      const esPropio = key === ownPhoneId;
      const marca = esPropio ? "✅ ESTE BOT" : key === "(NULL)" ? "⚠️  Sin asignar" : "🔴 OTRO BOT";
      console.log(`   [${marca}] ${key} → ${count} mensajes`);
    }
    const cantidadBots = Object.keys(grupos).filter(k => k !== "(NULL)").length;
    if (cantidadBots > 1) {
      console.log("\n   ⚠️  HAY MENSAJES DE MÁS DE UN BOT EN LA MISMA TABLA.");
      console.log("   El filtro por phone_number_id debería aislarlos correctamente.");
    } else if (cantidadBots === 1) {
      console.log("\n   ✅ Solo se ven mensajes de un único phone_number_id (excluyendo NULL).");
    }
  }

  // 5. Últimas conversaciones visibles con el phone_number_id del bot Cosmetikera
  if (ownPhoneId) {
    console.log(`\n4. Últimas 5 conversaciones de ESTE bot (${ownPhoneId}):`);
    const { data: propios, error: propiosErr } = await supabase
      .from("whatsapp_conversation_history")
      .select("telefono, rol, mensaje, created_at")
      .eq("phone_number_id", ownPhoneId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (propiosErr) {
      console.log(`   ❌ Error: ${propiosErr.message}`);
    } else if (!propios?.length) {
      console.log("   (Sin mensajes con este phone_number_id aún)");
    } else {
      for (const m of propios) {
        const fecha = new Date(m.created_at).toLocaleString("es-CO", { timeZone: "America/Bogota" });
        console.log(`   [${fecha}] ${m.rol} | ${m.telefono} → "${String(m.mensaje || "").slice(0, 60)}"`);
      }
    }

    // 6. Verificar si hay mensajes de otros phone_number_id que se colarían sin filtro
    console.log(`\n5. Mensajes de OTROS bots (distintos a ${ownPhoneId}) que podrían mezclarse:`);
    const { data: ajenos, error: ajenosErr } = await supabase
      .from("whatsapp_conversation_history")
      .select("telefono, phone_number_id, created_at")
      .neq("phone_number_id", ownPhoneId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (ajenosErr) {
      console.log(`   ❌ Error: ${ajenosErr.message}`);
    } else if (!ajenos?.length) {
      console.log("   ✅ No hay mensajes de otros bots. ¡No hay mezcla posible!");
    } else {
      console.log(`   ⚠️  Hay ${ajenos.length} mensajes de otros bots (muestra):`);
      for (const m of ajenos) {
        const fecha = new Date(m.created_at).toLocaleString("es-CO", { timeZone: "America/Bogota" });
        console.log(`   [${fecha}] phone_id=${m.phone_number_id || "NULL"} | tel=${m.telefono}`);
      }
      console.log("   El filtro en el código los aísla. Estos NO aparecen en la pantalla de Cosmetikera.");
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("DIAGNÓSTICO COMPLETO");
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
