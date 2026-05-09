// Script: verificar-cumpleanos.js
// Diagnóstico completo del sistema de mensajes automáticos de cumpleaños.

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const cronSecret = process.env.CRON_SECRET;
const whatsappApiKey = process.env.WHATSAPP_API_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=".repeat(60));
  console.log("DIAGNÓSTICO: SISTEMA DE MENSAJES DE CUMPLEAÑOS");
  console.log("=".repeat(60));
  const hoy = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
  console.log(`Fecha actual (Bogotá): ${hoy}\n`);

  // ── 1. Verificar función SQL ────────────────────────────────────
  console.log("1. Probando función SQL get_clientes_cumpleanos_proximos...");
  let funcionOk = false;
  for (const offset of [0, -1, -2]) {
    const { data, error } = await supabase.rpc("get_clientes_cumpleanos_proximos", {
      dias_offset: offset,
    });
    if (error) {
      console.log(`   ❌ Error con offset=${offset}: ${error.message}`);
      if (error.message.includes("out of range") || error.message.includes("feb")) {
        console.log("   ⚠️  Posible bug Feb-29. La migration fix NO está aplicada en Supabase.");
        console.log("   → Ejecuta supabase/migrations/202605080002_fix_cumpleanos_feb29.sql");
      }
    } else {
      console.log(`   ✅ offset=${offset}: ${data?.length ?? 0} clientes encontrados`);
      if (data?.length) {
        for (const c of data.slice(0, 3)) {
          console.log(`      - ${c.nombre_completo} | tel: ${c.telefono} | cumple en ${c.dias_para_cumpleanos} días`);
        }
      }
      funcionOk = true;
    }
  }

  // ── 2. Clientes con cumpleaños HOY ─────────────────────────────
  console.log("\n2. Clientes con cumpleaños HOY (offset=0):");
  const { data: hoyData, error: hoyErr } = await supabase.rpc("get_clientes_cumpleanos_proximos", {
    dias_offset: 0,
  });
  if (hoyErr) {
    console.log(`   ❌ Error: ${hoyErr.message}`);
  } else if (!hoyData?.length) {
    console.log("   (ninguno cumple hoy)");
  } else {
    for (const c of hoyData) {
      console.log(`   🎂 ${c.nombre_completo} | ${c.telefono} | nació: ${c.fecha_nacimiento}`);
    }
  }

  // ── 3. Verificar tabla de notificaciones enviadas ───────────────
  console.log("\n3. Historial de notificaciones de cumpleaños enviadas:");
  const { data: notif, error: notifErr } = await supabase
    .from("cumpleanos_notificaciones")
    .select("perfil_id, tipo_envio, fecha_envio, estado, error_detalle")
    .order("fecha_envio", { ascending: false })
    .limit(10);

  if (notifErr) {
    if (notifErr.message.includes("does not exist") || notifErr.message.includes("relation")) {
      console.log("   ❌ La tabla 'cumpleanos_notificaciones' NO existe.");
      console.log("   Esto significa que el sistema nunca ha registrado envíos.");
    } else {
      console.log(`   ❌ Error: ${notifErr.message}`);
    }
  } else if (!notif?.length) {
    console.log("   ⚠️  La tabla existe pero está VACÍA — ningún mensaje de cumpleaños ha sido enviado aún.");
  } else {
    console.log(`   Total registros (últimos 10):`);
    for (const n of notif) {
      const fecha = new Date(n.fecha_envio).toLocaleString("es-CO", { timeZone: "America/Bogota" });
      const estado = n.estado === "enviado" ? "✅" : "❌";
      console.log(`   ${estado} [${fecha}] tipo=${n.tipo_envio} | perfil=${n.perfil_id}`);
      if (n.error_detalle) console.log(`      Error: ${n.error_detalle}`);
    }
  }

  // ── 4. Verificar si hay mensajes de cumpleaños en historial WhatsApp ─
  console.log("\n4. Mensajes de cumpleaños en whatsapp_conversation_history:");
  const { data: waMsgs, error: waErr } = await supabase
    .from("whatsapp_conversation_history")
    .select("telefono, mensaje, created_at, phone_number_id")
    .ilike("mensaje", "%cumpleaños%")
    .order("created_at", { ascending: false })
    .limit(5);

  if (waErr) {
    console.log(`   ❌ Error: ${waErr.message}`);
  } else if (!waMsgs?.length) {
    console.log("   (sin mensajes de cumpleaños registrados en historial)");
  } else {
    for (const m of waMsgs) {
      const fecha = new Date(m.created_at).toLocaleString("es-CO", { timeZone: "America/Bogota" });
      console.log(`   [${fecha}] ${m.telefono} → "${String(m.mensaje).slice(0, 70)}"`);
    }
  }

  // ── 5. Verificar config del cron ─────────────────────────────
  console.log("\n5. Configuración del cron (vercel.json):");
  console.log("   /api/cron/cumpleanos/2d → 0 11 * * *  (cada día a las 11:00 UTC)");
  console.log("   /api/cron/cumpleanos/1d → 5 11 * * *  (cada día a las 11:05 UTC)");
  console.log("   /api/cron/cumpleanos/hoy → 10 11 * * * (cada día a las 11:10 UTC)");
  console.log("   11:00 UTC = 6:00 AM Colombia (UTC-5)");
  console.log(`\n   CRON_SECRET configurado: ${cronSecret ? "✅ SÍ" : "❌ NO (necesario para Vercel cron)"}`);
  console.log(`   WHATSAPP_API_KEY configurada: ${whatsappApiKey ? "✅ SÍ" : "❌ NO"}`);
  console.log(`   WHATSAPP_PHONE_NUMBER_ID: ${ownPhoneId ? `✅ ${ownPhoneId}` : "❌ NO configurado"}`);

  // ── 6. Prueba en seco (dry_run) del endpoint ──────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  console.log(`\n6. Simulando dry_run del endpoint de cumpleaños (${appUrl})...`);
  if (!whatsappApiKey) {
    console.log("   ⚠️  WHATSAPP_API_KEY no configurada, saltando prueba de endpoint.");
  } else {
    try {
      const res = await fetch(`${appUrl}/api/whatsapp/send-birthday-reminder`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": whatsappApiKey,
        },
        body: JSON.stringify({ dias_offset: 0, dry_run: true }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`   ✅ Endpoint responde OK (${res.status})`);
        console.log(`   Enviados: ${body.enviados ?? "?"} | Fallidos: ${body.fallidos ?? "?"}`);
        if (body.detalles?.length) {
          for (const d of body.detalles) {
            console.log(`   - ${d.nombre} → ${d.resultado}`);
          }
        } else {
          console.log(`   Respuesta: ${JSON.stringify(body).slice(0, 200)}`);
        }
      } else {
        console.log(`   ❌ Endpoint devolvió ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`   ⚠️  No se pudo conectar al servidor local (¿está corriendo npm run dev?): ${e.message}`);
      console.log("   Esto es normal en diagnóstico sin servidor activo.");
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
