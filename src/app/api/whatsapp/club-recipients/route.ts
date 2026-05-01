import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/utils/whatsapp-memory";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * GET /api/whatsapp/club-recipients
 * Devuelve la lista de clientes que recibieron la plantilla de bienvenida al club,
 * con sus nombres desde perfiles.
 */
export async function GET() {
  const supabase = getSupabase();

  // Obtener todas las notificaciones de bienvenida al club
  const { data: notifs, error } = await supabase
    .from("notificaciones_enviadas")
    .select("id, perfil_id, telefono, mensaje, estado, created_at, tipo")
    .eq("tipo", "bienvenida_club")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[club-recipients] Error fetching notificaciones_enviadas:", error);
    return NextResponse.json({ recipients: [], error: error.message });
  }

  const rows = (notifs || []) as Array<{
    id: string;
    perfil_id: string | null;
    telefono: string | null;
    mensaje: string | null;
    estado: string | null;
    created_at: string;
    tipo: string | null;
  }>;

  if (rows.length === 0) {
    return NextResponse.json({ recipients: [], total: 0 });
  }

  // Obtener nombres de perfiles
  const perfilIds = rows.map((r) => r.perfil_id).filter(Boolean) as string[];

  const { data: perfiles } = perfilIds.length > 0
    ? await supabase
        .from("perfiles")
        .select("id, nombre_completo, nombre, telefono")
        .in("id", perfilIds)
    : { data: [] };

  const perfilMap = new Map<string, string>();
  const perfilByPhoneMap = new Map<string, string>();
  const perfilByLast10Map = new Map<string, string>();
  for (const p of perfiles || []) {
    const nombre = (p.nombre_completo || p.nombre || "").trim();
    if (p.id && nombre) perfilMap.set(p.id, nombre);
    if (nombre && p.telefono) {
      const normalized = normalizePhone(String(p.telefono));
      if (normalized && !perfilByPhoneMap.has(normalized)) {
        perfilByPhoneMap.set(normalized, nombre);
      }
      const last10 = normalized.slice(-10);
      if (last10 && !perfilByLast10Map.has(last10)) {
        perfilByLast10Map.set(last10, nombre);
      }
    }
  }

  const missingPhones = rows
    .map((r) => normalizePhone(String(r.telefono || "")))
    .filter((t) => Boolean(t) && !perfilByPhoneMap.has(t));

  if (missingPhones.length > 0) {
    const last10Set = Array.from(new Set(missingPhones.map((t) => t.slice(-10)).filter(Boolean)));
    if (last10Set.length > 0) {
      const phoneOrFilters = last10Set.map((d) => `telefono.ilike.%${d}%`).join(",");
      const { data: perfilesByPhone } = await supabase
        .from("perfiles")
        .select("id, nombre_completo, nombre, telefono")
        .or(phoneOrFilters)
        .limit(500);

      for (const p of perfilesByPhone || []) {
        const nombre = (p.nombre_completo || p.nombre || "").trim();
        if (!nombre || !p.telefono) continue;
        const normalized = normalizePhone(String(p.telefono));
        if (!normalized) continue;
        if (!perfilByPhoneMap.has(normalized)) perfilByPhoneMap.set(normalized, nombre);
        const last10 = normalized.slice(-10);
        if (last10 && !perfilByLast10Map.has(last10)) perfilByLast10Map.set(last10, nombre);
      }
    }
  }

  const recipients = rows.map((row) => {
    const telefono = normalizePhone(String(row.telefono || ""));
    const nombre =
      (row.perfil_id ? perfilMap.get(row.perfil_id) : "") ||
      perfilByPhoneMap.get(telefono) ||
      perfilByLast10Map.get(telefono.slice(-10)) ||
      "";
    return {
      id: row.id,
      perfil_id: row.perfil_id,
      telefono,
      nombre,
      mensaje: row.mensaje || "Plantilla de bienvenida al club",
      estado: row.estado || "enviado",
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ recipients, total: recipients.length });
}
