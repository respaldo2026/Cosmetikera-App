/**
 * POST /api/whatsapp/send-puntos-compra
 *
 * Envía plantilla WhatsApp "puntos_compra_es" al cliente
 * cada vez que acumula puntos en una compra POS.
 *
 * Payload:
 * {
 *   "perfil_id": "uuid",
 *   "telefono": "3001234567",       // requerido (ya limpio, sin +57)
 *   "puntos_ganados": 15,           // puntos de ESTA compra
 *   "puntos_totales": 320,          // puntos totales tras la compra
 *   "nivel": "Plata"                // nivel actual
 * }
 *
 * Auth: header x-api-key (igual que send-club-welcome)
 *
 * Reglas:
 * - Solo se envía si el cliente tiene teléfono
 * - No bloquea el flujo de venta (llamada fire-and-forget)
 * - Se registra en whatsapp_conversation_history para auditoría
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { normalizePhone } from "@/utils/whatsapp-memory";

interface SendPuntosRequest {
  perfil_id: string;
  telefono: string;
  puntos_ganados: number;
  puntos_totales: number;
  nivel: string;
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function validateRequest(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.WHATSAPP_API_KEY;

  if (apiKey) {
    return apiKey === expectedKey;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return false;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });

  const { data, error } = await supabase.auth.getUser();
  return !error && Boolean(data.user?.id);
}

// ── Obtener nombre del cliente ──────────────────────────────────────────────
async function getNombreCliente(perfilId: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return "Cliente";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data } = await supabase
    .from("perfiles")
    .select("nombre_completo")
    .eq("id", perfilId)
    .maybeSingle();

  const nombre = String(data?.nombre_completo || "").split(" ")[0] || "Cliente";
  return nombre;
}

// ── Enviar plantilla por WhatsApp Cloud API ────────────────────────────────
async function sendPuntosWhatsApp(
  phone: string,
  nombre: string,
  puntosGanados: number,
  puntosTotal: number,
  nivel: string
): Promise<{ success: boolean; response?: unknown; error?: string }> {
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return { success: false, error: "Credenciales de WhatsApp no configuradas" };
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return { success: false, error: "Teléfono inválido" };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "template",
        template: {
          name: "puntos_compra_es",
          language: { code: "es" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: nombre },                           // {{1}}
                { type: "text", text: String(puntosGanados) },            // {{2}}
                { type: "text", text: String(puntosTotal) },              // {{3}}
                { type: "text", text: nivel },                            // {{4}}
              ],
            },
          ],
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Puntos Compra] Error WhatsApp API:", data);
      return { success: false, error: data?.error?.message || "Error enviando mensaje", response: data };
    }

    return { success: true, response: data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Puntos Compra] Exception:", msg);
    return { success: false, error: msg };
  }
}

// ── Auditoría en whatsapp_conversation_history ─────────────────────────────
async function logConversation(
  perfilId: string,
  phone: string,
  puntosGanados: number,
  puntosTotal: number,
  nivel: string,
  success: boolean
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await supabase.from("whatsapp_conversation_history").insert({
    telefono: normalizePhone(phone),
    perfil_id: perfilId,
    rol: "agente",
    mensaje: `Plantilla enviada: puntos_compra_es | +${puntosGanados} pts | Total: ${puntosTotal} pts | Nivel: ${nivel} | ${success ? "OK" : "ERROR"}`,
    tipo_mensaje: "template",
    intento: null,
  });
}

// ── Handler principal ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    if (!(await validateRequest(request))) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    let body: SendPuntosRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
    }

    const { perfil_id, telefono, puntos_ganados, puntos_totales, nivel } = body;

    if (!perfil_id || !telefono || !puntos_ganados || !puntos_totales || !nivel) {
      return NextResponse.json(
        { success: false, error: "Faltan campos: perfil_id, telefono, puntos_ganados, puntos_totales, nivel" },
        { status: 400 }
      );
    }

    const nombre = await getNombreCliente(perfil_id);
    const result = await sendPuntosWhatsApp(telefono, nombre, puntos_ganados, puntos_totales, nivel);

    // Auditoría (no-throw)
    logConversation(perfil_id, telefono, puntos_ganados, puntos_totales, nivel, result.success).catch(() => {});

    if (result.success) {
      return NextResponse.json({ success: true, message: "Mensaje de puntos enviado" });
    }

    return NextResponse.json(
      { success: false, error: result.error, whatsapp_response: result.response },
      { status: 502 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Puntos Compra] Error interno:", msg);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
