import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/utils/whatsapp-memory";

type ConversationMessage = {
  id: string;
  telefono: string;
  rol: string;
  mensaje: string;
  tipo_mensaje: string | null;
  intento?: string | null;
  created_at: string;
  perfil_id: string | null;
};

function isRelevantSentNotification(row: {
  tipo?: string | null;
  estado?: string | null;
  mensaje?: string | null;
}): boolean {
  const tipo = String(row.tipo || "").toLowerCase();
  const estado = String(row.estado || "").toLowerCase();
  const mensaje = String(row.mensaje || "").toLowerCase();

  const isWelcomeLike =
    tipo === "bienvenida_club" ||
    tipo.includes("bienvenida") ||
    tipo.includes("welcome") ||
    tipo.includes("registro") ||
    tipo.includes("portal");

  const messageLooksTemplate =
    mensaje.includes("plantilla") ||
    mensaje.includes("bienvenida") ||
    mensaje.includes("registro");

  if (estado === "enviado" && (isWelcomeLike || messageLooksTemplate)) return true;
  if (isWelcomeLike || messageLooksTemplate) return true;

  return false;
}

function buildPhoneVariants(input: string): Set<string> {
  const normalized = normalizePhone(input);
  const variants = new Set<string>();
  if (!normalized) return variants;
  variants.add(normalized);
  const last10 = normalized.slice(-10);
  if (last10) variants.add(last10);
  if (last10.length === 10) {
    variants.add(`57${last10}`);
  }
  return variants;
}

function pickProfileNameForPhone(
  profiles: Array<{ nombre?: string | null; nombre_completo?: string | null; telefono?: string | null }>,
  targetPhone: string,
): string {
  if (!profiles.length) return "";

  const normalizedTarget = normalizePhone(targetPhone);
  const targetLast10 = normalizedTarget.slice(-10);

  const withNormalized = profiles
    .map((p) => ({
      normalized: normalizePhone(String(p.telefono || "")),
      nombre: String((p as any).nombre_completo || p.nombre || "").trim(),
    }))
    .filter((p) => Boolean(p.normalized) && Boolean(p.nombre));

  const exact = withNormalized.find((p) => p.normalized === normalizedTarget);
  if (exact?.nombre) return exact.nombre;

  const byLast10 = withNormalized.find((p) => p.normalized.slice(-10) === targetLast10);
  if (byLast10?.nombre) return byLast10.nombre;

  return "";
}

function extractNameFromTemplateMessage(message: string): string {
  const text = String(message || "").trim();
  if (!text) return "";

  const match = text.match(/bienvenida\s+enviada\s+a\s+(.+)$/i);
  if (!match?.[1]) return "";

  return match[1].trim();
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

    const targetPhones = new Set<string>([
      ...Array.from(buildPhoneVariants(normalizedPhone)),
      ...Array.from(buildPhoneVariants(rawPhone)),
    ]);

    return rows
      .filter((row) => isRelevantSentNotification(row))
      .filter((row) => {
        const rowPhone = normalizePhone(String(row.telefono || ""));
        const rowVariants = buildPhoneVariants(rowPhone);
        for (const candidate of rowVariants) {
          if (targetPhones.has(candidate)) return true;
        }
        return false;
      })
      .map((row) => ({
        id: `notif-${row.id}`,
        telefono: normalizePhone(String(row.telefono || normalizedPhone || rawPhone || "")),
        rol: "agente",
        mensaje: row.mensaje || "📩 Mensaje enviado al cliente",
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
      .filter((row) => isRelevantSentNotification(row))
      .map((row) => ({
        id: `notif-${row.id}`,
        telefono: normalizePhone(String(row.telefono || "")),
        rol: "agente",
        mensaje: row.mensaje || "📩 Mensaje enviado al cliente",
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
          .select("nombre, nombre_completo, telefono")
          .or(
            `telefono.eq.${normalizedPhone},telefono.ilike.%${phoneForLike}%`
          )
          .limit(20);
        clientName = pickProfileNameForPhone((perfilByPhone || []) as any, normalizedPhone);
      }
      if (!clientName) {
        const fromTemplate = (data as ConversationMessage[])
          .filter((m) => String(m.tipo_mensaje || "") === "template")
          .map((m) => extractNameFromTemplateMessage(String(m.mensaje || "")))
          .find((name) => Boolean(name));
        clientName = fromTemplate || "";
      }
    }

    return NextResponse.json({ messages: data || [], clientName });
  }

  // ── Lista de conversaciones (una por teléfono) ──────────────────
  // Obtener último mensaje de cada teléfono
  let { data: rawMessages, error } = await supabase
    .from("whatsapp_conversation_history")
    .select("id, telefono, rol, mensaje, tipo_mensaje, created_at, perfil_id")
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
          tipo_mensaje: "text",
          created_at: new Date(baseTime).toISOString(),
          perfil_id: null,
        },
        {
          id: `${row.id}-a`,
          telefono: normalizePhone(row.phone_number || ""),
          rol: "agente",
          mensaje: row.agent_response || "",
          tipo_mensaje: "text",
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
      nombre_inferido: string;
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
        nombre_inferido: extractNameFromTemplateMessage(String(msg.mensaje || "")),
      });
    }
    const entry = conversationMap.get(phoneKey)!;
    entry.total++;
    // Si hay un mensaje de tipo template en la conversación, marcarla como tal
    if ((msg as any).tipo_mensaje === "template") {
      entry.es_plantilla = true;
      if (!entry.nombre_inferido) {
        entry.nombre_inferido = extractNameFromTemplateMessage(String(msg.mensaje || ""));
      }
    }
  }

  let conversations = Array.from(conversationMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Enriquecer con nombre del cliente
  const perfilIds = conversations
    .map((c) => c.perfil_id)
    .filter(Boolean) as string[];

  const [perfilRes, phonePerfRes] = await Promise.all([
    perfilIds.length > 0
      ? supabase
          .from("perfiles")
          .select("id, nombre, nombre_completo, telefono")
          .in("id", perfilIds)
      : { data: [] },
    conversations.length > 0
      ? supabase
          .from("perfiles")
          .select("id, nombre, nombre_completo, telefono")
          .not("telefono", "is", null)
          .limit(10000)
      : { data: [] },
  ]);

  const perfilByIdMap = new Map<string, string>();
  for (const p of perfilRes.data || []) {
    if (p.id) perfilByIdMap.set(p.id, ((p as any).nombre_completo || p.nombre || "").trim());
  }

  const perfilByPhoneMap = new Map<string, string>();
  const perfilByLast10Map = new Map<string, string>();
  for (const p of phonePerfRes.data || []) {
    const nombre = ((p as any).nombre_completo || p.nombre || "").trim();
    if (!nombre || !p.telefono) continue;
    const normalized = normalizePhone(String(p.telefono));
    if (!normalized) continue;
    if (!perfilByPhoneMap.has(normalized)) perfilByPhoneMap.set(normalized, nombre);
    const last10 = normalized.slice(-10);
    if (last10 && !perfilByLast10Map.has(last10)) perfilByLast10Map.set(last10, nombre);
  }

  const enriched = conversations.map((c) => ({
    ...c,
    nombre:
      (c.perfil_id ? perfilByIdMap.get(c.perfil_id) : "") ||
      perfilByPhoneMap.get(c.telefono) ||
      perfilByLast10Map.get(c.telefono.slice(-10)) ||
      c.nombre_inferido ||
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
