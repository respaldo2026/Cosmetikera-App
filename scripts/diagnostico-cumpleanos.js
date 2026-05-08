/**
 * Diagnóstico completo del sistema de cumpleaños.
 * Ejecutar: node scripts/diagnostico-cumpleanos.js
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sep(title) {
  console.log("\n" + "─".repeat(55));
  console.log("  " + title);
  console.log("─".repeat(55));
}

async function run() {
  console.log("🎂  Diagnóstico: Sistema de Cumpleaños WhatsApp");
  console.log("    Fecha actual:", new Date().toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  }));

  // ── 1. Variables de entorno necesarias ──────────────────────────
  sep("1. Variables de entorno");
  const vars = [
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_API_KEY",
    "CRON_SECRET",
    "WHATSAPP_TEMPLATE_CUMPLEANOS_2D",
    "WHATSAPP_TEMPLATE_CUMPLEANOS_1D",
    "WHATSAPP_TEMPLATE_CUMPLEANOS_HOY",
  ];
  for (const v of vars) {
    const val = process.env[v];
    if (val) {
      console.log(`  ✅ ${v} = ${v.includes("TOKEN") || v.includes("SECRET") || v.includes("KEY") ? "***" + val.slice(-4) : val}`);
    } else {
      console.log(`  ❌ ${v} — NO configurada`);
    }
  }

  // ── 2. Función SQL get_clientes_cumpleanos_proximos ─────────────
  sep("2. Función SQL get_clientes_cumpleanos_proximos");
  for (const offset of [0, 1, 2]) {
    const { data, error } = await supabase.rpc("get_clientes_cumpleanos_proximos", {
      dias_offset: offset,
    });
    if (error) {
      console.log(`  ❌ offset=${offset}: ERROR → ${error.message}`);
    } else {
      const count = (data || []).length;
      if (count > 0) {
        console.log(`  🎂 offset=${offset} días: ${count} cliente(s)`);
        (data || []).forEach((c) =>
          console.log(`       • ${c.nombre_completo || "Sin nombre"} | ${c.telefono || "Sin tel"} | ${c.fecha_nacimiento}`)
        );
      } else {
        console.log(`  ℹ️  offset=${offset} días: 0 clientes`);
      }
    }
  }

  // ── 3. Tabla cumpleaños_notificaciones ──────────────────────────
  sep("3. Últimos envíos registrados (cumpleaños_notificaciones)");
  const { data: notifs, error: notifErr } = await supabase
    .from("cumpleaños_notificaciones")
    .select("perfil_id, año_celebracion, enviado_2d_antes, fecha_2d_antes, enviado_1d_antes, fecha_1d_antes, enviado_dia_cumple, fecha_dia_cumple")
    .order("fecha_dia_cumple", { ascending: false, nullsFirst: false })
    .limit(10);

  if (notifErr) {
    console.log("  ❌ Error consultando tabla:", notifErr.message);
  } else if (!notifs || notifs.length === 0) {
    console.log("  ⚠️  Tabla vacía — nunca se ha enviado ningún cumpleaños");
  } else {
    console.log(`  ${notifs.length} registro(s) más recientes:`);
    for (const n of notifs) {
      const { data: p } = await supabase
        .from("perfiles")
        .select("nombre_completo, telefono")
        .eq("id", n.perfil_id)
        .single();
      console.log(`  📋 ${p?.nombre_completo || n.perfil_id}`);
      console.log(`       2d: ${n.enviado_2d_antes ? "✅ " + n.fecha_2d_antes : "❌ no enviado"}`);
      console.log(`       1d: ${n.enviado_1d_antes ? "✅ " + n.fecha_1d_antes : "❌ no enviado"}`);
      console.log(`       hoy: ${n.enviado_dia_cumple ? "✅ " + n.fecha_dia_cumple : "❌ no enviado"}`);
    }
  }

  // ── 4. Plantillas en Supabase ───────────────────────────────────
  sep("4. Plantillas de cumpleaños en plantillas_whatsapp");
  const { data: templates, error: tplErr } = await supabase
    .from("plantillas_whatsapp")
    .select("nombre, estado, idioma, categoria")
    .or("nombre.ilike.%cumple%,nombre.ilike.%birthday%")
    .order("nombre");

  if (tplErr) {
    console.log("  ❌ Error:", tplErr.message);
  } else if (!templates || templates.length === 0) {
    console.log("  ⚠️  No hay plantillas de cumpleaños en la tabla plantillas_whatsapp");
    console.log("     (Esto no impide el envío si los nombres están en las env vars o en el código)");
  } else {
    templates.forEach((t) =>
      console.log(`  📄 ${t.nombre} | estado: ${t.estado} | idioma: ${t.idioma} | cat: ${t.categoria}`)
    );
  }

  // ── 5. Configuración cron vercel.json ───────────────────────────
  sep("5. Cron configurado en vercel.json");
  try {
    const fs = require("fs");
    const vJson = JSON.parse(fs.readFileSync("vercel.json", "utf-8"));
    const crons = (vJson.crons || []).filter((c) => c.path.includes("cumpleano"));
    if (crons.length === 0) {
      console.log("  ❌ No hay crons de cumpleaños en vercel.json");
    } else {
      crons.forEach((c) =>
        console.log(`  ⏰ ${c.path} → ${c.schedule} (UTC)`)
      );
      console.log("  ℹ️  Los crons corren en UTC. Las 11:00 UTC = 6:00 AM Colombia (UTC-5)");
    }
  } catch {
    console.log("  ❌ No se pudo leer vercel.json");
  }

  // ── 6. Últimos registros en whatsapp_conversation_history ───────
  sep("6. Últimas plantillas de cumpleaños en historial de conversación");
  const { data: historial, error: histErr } = await supabase
    .from("whatsapp_conversation_history")
    .select("telefono, mensaje, created_at")
    .eq("tipo_mensaje", "template")
    .ilike("mensaje", "%cumple%")
    .order("created_at", { ascending: false })
    .limit(5);

  if (histErr) {
    console.log("  ❌ Error:", histErr.message);
  } else if (!historial || historial.length === 0) {
    console.log("  ⚠️  Ninguna plantilla de cumpleaños registrada en historial");
  } else {
    historial.forEach((h) =>
      console.log(`  📨 ${h.telefono} | ${new Date(h.created_at).toLocaleString("es-CO")} | ${h.mensaje}`)
    );
  }

  // ── 7. Resumen ──────────────────────────────────────────────────
  sep("7. Resumen y posibles problemas");
  const cronSecretOk = Boolean(process.env.CRON_SECRET);
  const phoneIdOk = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const tokenOk = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
  const apiKeyOk = Boolean(process.env.WHATSAPP_API_KEY);

  if (!cronSecretOk) console.log("  ⚠️  CRON_SECRET vacío → Vercel no podrá autenticar los crons en producción");
  if (!phoneIdOk)   console.log("  ❌ WHATSAPP_PHONE_NUMBER_ID vacío → el envío fallará");
  if (!tokenOk)     console.log("  ❌ WHATSAPP_ACCESS_TOKEN vacío → el envío fallará");
  if (!apiKeyOk)    console.log("  ⚠️  WHATSAPP_API_KEY vacío → el cron local fallará al llamar al endpoint interno");

  if (cronSecretOk && phoneIdOk && tokenOk && apiKeyOk) {
    console.log("  ✅ Variables principales OK");
  }

  console.log("\n  Para probar un envío manual (dry_run) ejecuta:");
  console.log(`  curl -X POST https://app.cosmetikera.com/api/whatsapp/send-birthday-reminder \\`);
  console.log(`    -H "x-api-key: $WHATSAPP_API_KEY" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"dias_offset":0,"dry_run":true}'`);
  console.log("");
}

run().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
