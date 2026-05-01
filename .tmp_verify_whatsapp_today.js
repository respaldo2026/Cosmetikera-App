const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("FALTAN_ENV");
  process.exit(0);
}

const s = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");

  const start = `${y}-${m}-${d}T00:00:00.000Z`;
  const end = `${y}-${m}-${d}T23:59:59.999Z`;

  const [insc, notif, conv, perfiles] = await Promise.all([
    s.from("club_inscripciones")
      .select("perfil_id,created_at,notificacion_enviada")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(50),
    s.from("notificaciones_enviadas")
      .select("id,perfil_id,telefono,tipo,estado,created_at,mensaje")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(100),
    s.from("whatsapp_conversation_history")
      .select("id,perfil_id,telefono,tipo_mensaje,created_at,mensaje")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(100),
    s.from("perfiles")
      .select("id,nombre_completo,telefono,created_at")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const out = {
    hoy: { start, end },
    inscripciones: (insc.data || []).length,
    notificaciones: (notif.data || []).length,
    conversaciones: (conv.data || []).length,
    perfilesHoy: (perfiles.data || []).length,
    inscError: insc.error?.message || null,
    notifError: notif.error?.message || null,
    convError: conv.error?.message || null,
    perfilesError: perfiles.error?.message || null,
    inscRows: insc.data || [],
    notifRows: (notif.data || []).map((r) => ({
      id: r.id,
      perfil_id: r.perfil_id,
      telefono: r.telefono,
      tipo: r.tipo,
      estado: r.estado,
      created_at: r.created_at,
      mensaje: String(r.mensaje || "").slice(0, 90),
    })),
    convRows: (conv.data || []).map((r) => ({
      id: r.id,
      perfil_id: r.perfil_id,
      telefono: r.telefono,
      tipo_mensaje: r.tipo_mensaje,
      created_at: r.created_at,
      mensaje: String(r.mensaje || "").slice(0, 90),
    })),
    perfilesRows: (perfiles.data || []).map((r) => ({
      id: r.id,
      nombre_completo: r.nombre_completo,
      telefono: r.telefono,
      created_at: r.created_at,
    })),
  };

  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
