import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  // ── Detalle de conversación por teléfono ──────────────────────────
  if (phone) {
    const { data, error } = await supabase
      .from("whatsapp_conversation_history")
      .select(
        "id, telefono, rol, mensaje, tipo_mensaje, intento, created_at, perfil_id"
      )
      .eq("telefono", phone)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
        const { data: perfilByPhone } = await supabase
          .from("perfiles")
          .select("nombre")
          .or(`telefono.eq.${phone},celular.eq.${phone}`)
          .limit(1)
          .single();
        clientName = perfilByPhone?.nombre || "";
      }
    }

    return NextResponse.json({ messages: data || [], clientName });
  }

  // ── Lista de conversaciones (una por teléfono) ──────────────────
  // Obtener último mensaje de cada teléfono
  const { data: rawMessages, error } = await supabase
    .from("whatsapp_conversation_history")
    .select("id, telefono, rol, mensaje, created_at, perfil_id")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    if (!conversationMap.has(msg.telefono)) {
      conversationMap.set(msg.telefono, {
        telefono: msg.telefono,
        ultimo_mensaje: msg.mensaje,
        ultimo_rol: msg.rol,
        created_at: msg.created_at,
        perfil_id: msg.perfil_id || null,
        total: 0,
      });
    }
    const entry = conversationMap.get(msg.telefono)!;
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
    supabase
      .from("perfiles")
      .select("id, nombre, telefono, celular")
      .or(
        phoneList
          .map((p) => `telefono.eq.${p},celular.eq.${p}`)
          .join(",")
      )
      .limit(500),
  ]);

  const perfilByIdMap = new Map<string, string>();
  for (const p of perfilRes.data || []) {
    if (p.id) perfilByIdMap.set(p.id, p.nombre || "");
  }

  const perfilByPhoneMap = new Map<string, string>();
  for (const p of phonePerfRes.data || []) {
    if (p.telefono) perfilByPhoneMap.set(p.telefono, p.nombre || "");
    if (p.celular) perfilByPhoneMap.set(p.celular, p.nombre || "");
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
          c.telefono.includes(search) ||
          c.nombre.toLowerCase().includes(search.toLowerCase())
      )
    : enriched;

  return NextResponse.json({ conversations: filtered });
}
