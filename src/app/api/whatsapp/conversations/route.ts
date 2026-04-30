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
  perfil_id?: string | null;
};

async function getTemplateMessagesByPhone(
  supabase: ReturnType<typeof createClient>,
  normalizedPhone: string,
  rawPhone: string,
): Promise<ConversationMessage[]> {
  try {
    const { data } = await supabase
      .from("notificaciones_enviadas")
      .select("id, telefono, mensaje, created_at, perfil_id, estado")
      .eq("estado", "enviado")
      .order("created_at", { ascending: true })
      .limit(200);

    const targetPhones = new Set([normalizePhone(normalizedPhone), normalizePhone(rawPhone)]);

    return (data || [])
      .filter((row) => targetPhones.has(normalizePhone(String(row.telefono || ""))))
      .map((row) => ({
        id: `notif-${row.id}`,
        telefono: normalizePhone(String(row.telefono || normalizedPhone || rawPhone || "")),
        rol: "agente",
        mensaje: row.mensaje || "Plantilla enviada",
        tipo_mensaje: "template",
        intento: null,
        created_at: row.created_at || new Date().toISOString(),
        perfil_id: row.perfil_id || null,
      }));
  } catch {
    return [];
  }
}

async function getTemplateMessagesRecent(
  supabase: ReturnType<typeof createClient>,
): Promise<ConversationMessage[]> {
  try {
    const { data } = await supabase
      .from("notificaciones_enviadas")
      .select("id, telefono, mensaje, created_at, perfil_id, estado")
      .eq("estado", "enviado")
      .order("created_at", { ascending: false })
      .limit(1000);

    return (data || []).map((row) => ({
      id: `notif-${row.id}`,
      telefono: normalizePhone(String(row.telefono || "")),
      rol: "agente",
      mensaje: row.mensaje || "Plantilla enviada",
      tipo_mensaje: "template",
      intento: null,
      created_at: row.created_at || new Date().toISOString(),
      perfil_id: row.perfil_id || null,
    }));
  } catch {
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
      data = merged;
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
          .select("nombre")
          .eq("id", perfil_id)
          .single();
        clientName = perfil?.nombre || "";
      }
      if (!clientName) {
        const phoneForLike = normalizedPhone.slice(-10);
        const { data: perfilByPhone } = await supabase
          .from("perfiles")
          .select("nombre")
          .or(
            `telefono.eq.${normalizedPhone},celular.eq.${normalizedPhone},telefono.ilike.%${phoneForLike}%,celular.ilike.%${phoneForLike}%`
          )
          .limit(1)
          .single();
        clientName = perfilByPhone?.nombre || "";
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
      });
    }
    const entry = conversationMap.get(phoneKey)!;
    entry.total++;
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
          .select("id, nombre, telefono, celular")
          .in("id", perfilIds)
      : { data: [] },
    phoneList.length > 0
      ? supabase
          .from("perfiles")
          .select("id, nombre, telefono, celular")
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
    if (p.id) perfilByIdMap.set(p.id, p.nombre || "");
  }

  const perfilByPhoneMap = new Map<string, string>();
  for (const p of phonePerfRes.data || []) {
    if (p.telefono) perfilByPhoneMap.set(normalizePhone(String(p.telefono)), p.nombre || "");
    if (p.celular) perfilByPhoneMap.set(normalizePhone(String(p.celular)), p.nombre || "");
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
