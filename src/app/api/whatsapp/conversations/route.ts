import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/utils/whatsapp-memory";

type ConversationMessage = {
  id: string;
  telefono: string;
  rol: string;
  mensaje: string;
  tipo_mensaje?: string | null;
  intento?: string | null;
  created_at: string;
  perfil_id: string | null;
};

function isClubWelcomeNotification(row: {
  tipo?: string | null;
  mensaje?: string | null;
}): boolean {
  const tipo = String(row.tipo || "").toLowerCase();
  const mensaje = String(row.mensaje || "").toLowerCase();
  if (tipo === "bienvenida_club") return true;
  if (tipo.includes("bienvenida") && tipo.includes("club")) return true;
  if (tipo.includes("club_welcome")) return true;
  if (mensaje.includes("plantilla") && mensaje.includes("club")) return true;
  if (mensaje.includes("bienvenida") && mensaje.includes("club")) return true;
  return false;
}

async function getTemplateMessagesByPhone(
  supabase: any,
  normalizedPhone: string,
  rawPhone: string,
): Promise<ConversationMessage[]> {
  try {
    // Recuperar notificaciones recientes y filtrar por plantillas de bienvenida al club
    const { data, error } = await supabase
      .from("notificaciones_enviadas")
      .select("id, telefono, mensaje, created_at, perfil_id, estado, tipo")
      .order("created_at", { ascending: false })
      .limit(3000);

    if (error) {
      console.warn("[getTemplateMessagesByPhone] Query error:", error);
    }

    const rows = (data || []) as Array<{
      id: string | number;
      telefono?: string | null;
      mensaje?: string | null;
      created_at?: string | null;
      perfil_id?: string | null;
      estado?: string | null;
      tipo?: string | null;
    }>;

    const targetPhones = new Set([normalizePhone(normalizedPhone), normalizePhone(rawPhone)]);

    return rows
      .filter((row) => isClubWelcomeNotification(row))
      .filter((row) => targetPhones.has(normalizePhone(String(row.telefono || ""))))
      .map((row) => ({
        id: `notif-${row.id}`,
        telefono: normalizePhone(String(row.telefono || normalizedPhone || rawPhone || "")),
        rol: "agente",
        mensaje: row.mensaje || "🎉 Bienvenida al Club Fidelización",
        tipo_mensaje: "template",
        intento: null,
        created_at: row.created_at || new Date().toISOString(),
        perfil_id: row.perfil_id || null,
      }))
      .sort((a, b) =>
        new Date(String(a.created_at || 0)).getTime() - new Date(String(b.created_at || 0)).getTime()
      );
  } catch (err) {
    console.error("[getTemplateMessagesByPhone] Exception:", err);
    return [];
  }
}

async function getTemplateMessagesRecent(
  supabase: any,
): Promise<ConversationMessage[]> {
  try {
    // Recuperar notificaciones recientes y filtrar plantillas de bienvenida al club
    const { data, error } = await supabase
      .from("notificaciones_enviadas")
      .select("id, telefono, mensaje, created_at, perfil_id, estado, tipo")
      .order("created_at", { ascending: false })
      .limit(3000);

    if (error) {
      console.warn("[getTemplateMessagesRecent] Query error:", error);
    }

    const rows = (data || []) as Array<{
      id: string | number;
      telefono?: string | null;
      mensaje?: string | null;
      created_at?: string | null;
      perfil_id?: string | null;
      estado?: string | null;
      tipo?: string | null;
    }>;

    return rows
      .filter((row) => isClubWelcomeNotification(row))
      .map((row) => ({
        id: `notif-${row.id}`,
        telefono: normalizePhone(String(row.telefono || "")),
        rol: "agente",
        mensaje: row.mensaje || "🎉 Bienvenida al Club Fidelización",
        tipo_mensaje: "template",
        intento: null,
        created_at: row.created_at || new Date().toISOString(),
        perfil_id: row.perfil_id || null,
      }))
      .filter((row) => Boolean(row.telefono));
  } catch (err) {
    console.error("[getTemplateMessagesRecent] Exception:", err);
    return [];
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * GET /api/whatsapp/conversations
 * - Sin params: devuelve lista de conversaciones únicas (una por teléfono)
 * - ?phone=xxx: devuelve mensajes de ese número
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const phone = request.nextUrl.searchParams.get("phone");
  const search = request.nextUrl.searchParams.get("search") || "";
  const normalizedSearch = normalizePhone(search);

  // ── Detalle de conversación por teléfono ──────────────────────────
  if (phone) {
    const normalizedPhone = normalizePhone(phone);
    let { data, error } = await supabase
      .from("whatsapp_conversation_history")
      .select(
        "id, telefono, rol, mensaje, tipo_mensaje, intento, created_at, perfil_id"
      )
      .eq("telefono", normalizedPhone)
      .order("created_at", { ascending: true })
      .limit(200);

    // Compatibilidad: si no hubo resultados con normalización, intentar el valor original
    if ((!data || data.length === 0) && phone !== normalizedPhone) {
      const retry = await supabase
        .from("whatsapp_conversation_history")
        .select(
          "id, telefono, rol, mensaje, tipo_mensaje, intento, created_at, perfil_id"
        )
        .eq("telefono", phone)
        .order("created_at", { ascending: true })
        .limit(200);
      data = retry.data;
      error = retry.error;
    }

    const templateMessages = await getTemplateMessagesByPhone(supabase, normalizedPhone, phone);
    if (templateMessages.length > 0) {
      const merged = [...((data || []) as ConversationMessage[]), ...templateMessages].sort(
        (a, b) => new Date(String(a.created_at || 0)).getTime() - new Date(String(b.created_at || 0)).getTime(),
      );
      data = merged as any;
    }

    // Fallback a tabla legacy (agent_conversations) si la nueva tabla falla/no existe
    if (error || !data || data.length === 0) {
      const { data: legacyRows, error: legacyError } = await supabase
        .from("agent_conversations")
        .select("id, phone_number, user_message, agent_response, created_at")
        .eq("phone_number", normalizedPhone)
        .order("created_at", { ascending: true })
        .limit(200);

      if (legacyError) {
        return NextResponse.json({ error: legacyError.message }, { status: 500 });
      }

      const legacyMessages = (legacyRows || []).flatMap((row) => {
        const baseTime = new Date(row.created_at || new Date().toISOString()).getTime();
        return [
          {
            id: `${row.id}-u`,
            telefono: row.phone_number,
            rol: "cliente",
            mensaje: row.user_message || "",
            tipo_mensaje: "text",
            intento: null,
            created_at: new Date(baseTime).toISOString(),
            perfil_id: null,
          },
          {
            id: `${row.id}-a`,
            telefono: row.phone_number,
            rol: "agente",
            mensaje: row.agent_response || "",
            tipo_mensaje: "text",
            intento: null,
            created_at: new Date(baseTime + 1000).toISOString(),
            perfil_id: null,
          },
        ];
      });

      data = legacyMessages;
    }

    // Buscar nombre del cliente en perfiles
    let clientName = "";
    if (data && data.length > 0) {
      const perfil_id = data.find((m) => m.perfil_id)?.perfil_id;
      if (perfil_id) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("nombre, nombre_completo")
          .eq("id", perfil_id)
          .single();
        clientName = ((perfil as any)?.nombre_completo || (perfil as any)?.nombre || "").trim();
      }
      if (!clientName) {
        const phoneForLike = normalizedPhone.slice(-10);
        const { data: perfilByPhone } = await supabase
          .from("perfiles")
          .select("nombre, nombre_completo")
          .or(
            `telefono.eq.${normalizedPhone},celular.eq.${normalizedPhone},telefono.ilike.%${phoneForLike}%,celular.ilike.%${phoneForLike}%`
          )
          .limit(1)
          .single();
        clientName = ((perfilByPhone as any)?.nombre_completo || (perfilByPhone as any)?.nombre || "").trim();
      }
    }

    return NextResponse.json({ messages: data || [], clientName });
  }

  // ── Lista de conversaciones (una por teléfono) ──────────────────
  // Obtener último mensaje de cada teléfono
  let { data: rawMessages, error } = await supabase
    .from("whatsapp_conversation_history")
    .select("id, telefono, rol, mensaje, created_at, perfil_id")
    .order("created_at", { ascending: false })
    .limit(2000);

  const templateRecent = await getTemplateMessagesRecent(supabase);
  if (templateRecent.length > 0) {
    rawMessages = [...((rawMessages || []) as ConversationMessage[]), ...templateRecent]
      .sort((a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime())
      .slice(0, 2500);
  }

  // Fallback a tabla legacy cuando la nueva está vacía o no existe en producción
  if (error || !rawMessages || rawMessages.length === 0) {
    const { data: legacyRows, error: legacyError } = await supabase
      .from("agent_conversations")
      .select("id, phone_number, user_message, agent_response, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (legacyError) {
      return NextResponse.json({ error: legacyError.message }, { status: 500 });
    }

    rawMessages = (legacyRows || []).flatMap((row) => {
      const baseTime = new Date(row.created_at || new Date().toISOString()).getTime();
      return [
        {
          id: `${row.id}-u`,
          telefono: normalizePhone(row.phone_number || ""),
          rol: "cliente",
          mensaje: row.user_message || "",
          created_at: new Date(baseTime).toISOString(),
          perfil_id: null,
        },
        {
          id: `${row.id}-a`,
          telefono: normalizePhone(row.phone_number || ""),
          rol: "agente",
          mensaje: row.agent_response || "",
          created_at: new Date(baseTime + 1000).toISOString(),
          perfil_id: null,
        },
      ];
    });
  }

  // Agrupar por teléfono y tomar el más reciente
  const conversationMap = new Map<
    string,
    {
      telefono: string;
      ultimo_mensaje: string;
      ultimo_rol: string;
      created_at: string;
      perfil_id: string | null;
      total: number;
      es_plantilla: boolean;
    }
  >();

  for (const msg of rawMessages || []) {
    const phoneKey = normalizePhone(String(msg.telefono || ""));
    if (!phoneKey) continue;

    if (!conversationMap.has(phoneKey)) {
      conversationMap.set(phoneKey, {
        telefono: phoneKey,
        ultimo_mensaje: msg.mensaje,
        ultimo_rol: msg.rol,
        created_at: msg.created_at,
        perfil_id: msg.perfil_id || null,
        total: 0,
        es_plantilla: (msg as any).tipo_mensaje === "template",
      });
    }
    const entry = conversationMap.get(phoneKey)!;
    entry.total++;
    // Si hay un mensaje de tipo template en la conversación, marcarla como tal
    if ((msg as any).tipo_mensaje === "template") {
      entry.es_plantilla = true;
    }
  }

  let conversations = Array.from(conversationMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Enriquecer con nombre del cliente
  const perfilIds = conversations
    .map((c) => c.perfil_id)
    .filter(Boolean) as string[];

  const phoneList = conversations.map((c) => c.telefono);

  const [perfilRes, phonePerfRes] = await Promise.all([
    perfilIds.length > 0
      ? supabase
          .from("perfiles")
          .select("id, nombre, nombre_completo, telefono, celular")
          .in("id", perfilIds)
      : { data: [] },
    phoneList.length > 0
      ? supabase
          .from("perfiles")
          .select("id, nombre, nombre_completo, telefono, celular")
          .or(
            phoneList
              .map((p) => `telefono.eq.${p},celular.eq.${p}`)
              .join(",")
          )
          .limit(500)
      : { data: [] },
  ]);

  const perfilByIdMap = new Map<string, string>();
  for (const p of perfilRes.data || []) {
    if (p.id) perfilByIdMap.set(p.id, ((p as any).nombre_completo || p.nombre || "").trim());
  }

  const perfilByPhoneMap = new Map<string, string>();
  for (const p of phonePerfRes.data || []) {
    const nombre = ((p as any).nombre_completo || p.nombre || "").trim();
    if (p.telefono) perfilByPhoneMap.set(normalizePhone(String(p.telefono)), nombre);
    if (p.celular) perfilByPhoneMap.set(normalizePhone(String(p.celular)), nombre);
  }

  const enriched = conversations.map((c) => ({
    ...c,
    nombre:
      (c.perfil_id ? perfilByIdMap.get(c.perfil_id) : "") ||
      perfilByPhoneMap.get(c.telefono) ||
      "",
  }));

  // Aplicar filtro de búsqueda
  const filtered = search
    ? enriched.filter(
        (c) =>
          c.telefono.includes(normalizedSearch || search) ||
          c.nombre.toLowerCase().includes(search.toLowerCase())
      )
    : enriched;

  return NextResponse.json({ conversations: filtered });
}
