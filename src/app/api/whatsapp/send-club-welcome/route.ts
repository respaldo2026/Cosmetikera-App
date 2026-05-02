/**
 * POST /api/whatsapp/send-club-welcome
 * 
 * Envía plantilla de WhatsApp (aprobada por Meta) de bienvenida al club
 * cuando un cliente se fideliza/inscribe.
 * 
 * Cumple normas de Meta:
 * - Usa plantilla pre-aprobada "club_welcome_es"
 * - Variable: cedula para acceso a la app
 * - Se envía solo 1 vez por cliente
 * - Registra auditoría completa
 * 
 * Llamada desde:
 * - Make.com (cuando se inscriba cliente al club)
 * - Admin manualmente
 * 
 * Payload:
 * {
 *   "perfil_id": "uuid",
 *   "cedula": "1234567890",
 *   "telefono": "+57 310 4239494" (opcional)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/utils/whatsapp-memory";

interface SendClubWelcomeRequest {
  perfil_id: string;
  cedula: string;
  telefono?: string; // Si viene en payload, usar ese. Si no, buscar en DB
}

interface SendClubWelcomeResponse {
  success: boolean;
  message?: string;
  error?: string;
  whatsapp_response?: unknown;
  already_sent?: boolean;
}

type WelcomeLockResult = {
  acquired: boolean;
  alreadySent?: boolean;
  inProgress?: boolean;
};

/**
 * Verifica si ya existe una bienvenida enviada para evitar duplicados.
 */
async function wasWelcomeAlreadySent(supabase: any, perfilId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("notificaciones_enviadas")
    .select("id, estado")
    .eq("perfil_id", perfilId)
    .eq("tipo", "bienvenida_club")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[Club Welcome] No se pudo validar duplicado de bienvenida:", error.message);
    return false;
  }

  const estado = String((data as any)?.estado || "").toLowerCase();
  return estado === "enviado";
}

async function wasWelcomeAlreadySentBroad(
  supabase: any,
  args: { perfilId: string; phone: string; cedula: string },
): Promise<boolean> {
  const normalizedPhone = normalizePhone(args.phone);
  const cedulaNeedle = String(args.cedula || "").trim();

  // 1) Revisión directa por perfil + tipo (idempotencia primaria)
  if (await wasWelcomeAlreadySent(supabase, args.perfilId)) return true;

  // 2) Respaldo por teléfono + cédula en auditoría, para escenarios con llamadas repetidas
  //    desde múltiples orígenes o migraciones incompletas en constraints.
  const { data: notifRows } = await supabase
    .from("notificaciones_enviadas")
    .select("estado,mensaje,telefono")
    .eq("tipo", "bienvenida_club")
    .order("created_at", { ascending: false })
    .limit(200);

  const alreadyInNotifications = (notifRows || []).some((row: any) => {
    const estado = String(row?.estado || "").toLowerCase();
    const mensaje = String(row?.mensaje || "");
    const rowPhone = normalizePhone(String(row?.telefono || ""));
    const samePhone = Boolean(normalizedPhone) && rowPhone === normalizedPhone;
    const hasCedula = cedulaNeedle ? mensaje.includes(cedulaNeedle) : false;
    return estado === "enviado" && samePhone && hasCedula;
  });

  if (alreadyInNotifications) return true;

  // 3) Respaldo final por historial de conversación template
  const { data: templateRows } = await supabase
    .from("whatsapp_conversation_history")
    .select("mensaje,telefono")
    .eq("tipo_mensaje", "template")
    .order("created_at", { ascending: false })
    .limit(200);

  const alreadyInConversation = (templateRows || []).some((row: any) => {
    const mensaje = String(row?.mensaje || "");
    const rowPhone = normalizePhone(String(row?.telefono || ""));
    const samePhone = Boolean(normalizedPhone) && rowPhone === normalizedPhone;
    const hasCedula = cedulaNeedle ? mensaje.includes(cedulaNeedle) : false;
    const isWelcomeTemplate = mensaje.toLowerCase().includes("club_welcome") || mensaje.toLowerCase().includes("bienvenida");
    return samePhone && hasCedula && isWelcomeTemplate;
  });

  return alreadyInConversation;
}

/**
 * Toma un candado lógico en notificaciones_enviadas para evitar doble envío por concurrencia.
 *
 * Estrategia:
 * - `INSERT` inicial por (perfil_id,tipo) con estado "procesando".
 * - Si falla por UNIQUE, se revisa estado actual:
 *   - enviado -> no reenviar.
 *   - procesando -> otra request ya está ejecutando el envío.
 *   - error -> se permite reintento tomando nuevamente estado "procesando".
 */
async function acquireWelcomeSendLock(
  supabase: any,
  perfilId: string,
  phone: string,
  cedula: string,
): Promise<WelcomeLockResult> {
  const pendingPayload = {
    perfil_id: perfilId,
    tipo: "bienvenida_club",
    telefono: phone,
    mensaje: `Plantilla: club_welcome_es | Cédula: ${cedula}`,
    estado: "procesando",
  };

  const { error: insertError } = await supabase
    .from("notificaciones_enviadas")
    .insert(pendingPayload);

  if (!insertError) {
    return { acquired: true };
  }

  if (insertError.code !== "23505") {
    console.warn("[Club Welcome] Error adquiriendo lock de envío:", insertError.message);
    return { acquired: false };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("notificaciones_enviadas")
    .select("id, estado")
    .eq("perfil_id", perfilId)
    .eq("tipo", "bienvenida_club")
    .maybeSingle();

  if (fetchError) {
    console.warn("[Club Welcome] No se pudo consultar lock existente:", fetchError.message);
    return { acquired: false };
  }

  const estado = String((existing as any)?.estado || "").toLowerCase();
  if (estado === "enviado") {
    return { acquired: false, alreadySent: true };
  }
  if (estado === "procesando") {
    return { acquired: false, inProgress: true };
  }

  // Permite reintento si estaba en error (o estado desconocido)
  const { error: retryError } = await supabase
    .from("notificaciones_enviadas")
    .update({ estado: "procesando", telefono: phone, mensaje: pendingPayload.mensaje })
    .eq("perfil_id", perfilId)
    .eq("tipo", "bienvenida_club");

  if (retryError) {
    console.warn("[Club Welcome] No se pudo tomar lock para reintento:", retryError.message);
    return { acquired: false };
  }

  return { acquired: true };
}

/**
 * Valida autenticación (API key o sesión autenticada)
 */
async function validateRequest(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.WHATSAPP_API_KEY;

  if (apiKey) {
    return apiKey === expectedKey;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // No necesitamos mutar cookies
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  return !error && Boolean(data.user?.id);
}

/**
 * Obtiene teléfono del perfil desde Supabase
 */
async function getProfilePhone(
  supabase: any,
  perfilId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("telefono")
    .eq("id", perfilId)
    .single();

  if (error) {
    console.error("[Club Welcome] Error obteniendo teléfono:", error);
    return null;
  }

  return data?.telefono || null;
}

/**
 * Envía mensaje por WhatsApp Cloud API usando plantilla pre-aprobada por Meta
 */
async function sendWhatsAppMessage(
  phone: string,
  cedula: string
): Promise<{ success: boolean; response?: unknown; error?: string }> {
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return { success: false, error: "Credenciales de WhatsApp faltantes" };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
    const normalizedPhone = phone.replace(/\D/g, "");

    // Usar plantilla pre-aprobada en Meta
    // Nombre: club_welcome_es
    // Variable {{1}}: cedula
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
          name: "club_welcome_es", // Nombre de la plantilla en Meta
          language: {
            code: "es", // Español
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: cedula, // {{1}} en la plantilla
                },
              ],
            },
          ],
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Club Welcome] Error WhatsApp:", data);
      return {
        success: false,
        error: data.error?.message || "Error enviando mensaje",
        response: data,
      };
    }

    return { success: true, response: data };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Club Welcome] Exception:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Registra la notificación en la BD
 */
async function logNotification(
  supabase: any,
  perfilId: string,
  phone: string,
  mensaje: string,
  whatsappResponse: unknown,
  success: boolean
) {
  const { error } = await supabase
    .from("notificaciones_enviadas")
    .upsert(
      {
        perfil_id: perfilId,
        tipo: "bienvenida_club",
        telefono: phone,
        mensaje,
        estado: success ? "enviado" : "error",
        respuesta_whatsapp: whatsappResponse,
      },
      { onConflict: "perfil_id,tipo" }
    );

  if (error) {
    console.error("[Club Welcome] Error registrando notificación:", error);
  }
}

/**
 * Registra la inscripción al club
 */
async function logClubInscription(
  supabase: any,
  perfilId: string,
  notificationSent: boolean
) {
  const { error } = await supabase
    .from("club_inscripciones")
    .upsert(
      {
        perfil_id: perfilId,
        notificacion_enviada: notificationSent,
      },
      { onConflict: "perfil_id" }
    );

  if (error) {
    console.error("[Club Welcome] Error registrando inscripción:", error);
  }
}

async function logConversationTemplate(perfilId: string, phone: string, cedula: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const normalizedPhone = normalizePhone(phone);
  const { data: existing } = await service
    .from("whatsapp_conversation_history")
    .select("id")
    .eq("perfil_id", perfilId)
    .eq("tipo_mensaje", "template")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return;

  await service.from("whatsapp_conversation_history").insert({
    telefono: normalizedPhone,
    perfil_id: perfilId,
    rol: "agente",
    mensaje: `Plantilla enviada: club_welcome_es | Cédula: ${cedula}`,
    tipo_mensaje: "template",
    intento: null,
  });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SendClubWelcomeResponse>> {
  try {
    // 1. Validar autenticación
    if (!(await validateRequest(request))) {
      return NextResponse.json(
        { success: false, error: "No autorizado" } as SendClubWelcomeResponse,
        { status: 401 }
      );
    }

    // 2. Parsear payload
    const body: SendClubWelcomeRequest = await request.json();

    if (!body.perfil_id || !body.cedula) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan campos requeridos: perfil_id, cedula",
        } as SendClubWelcomeResponse,
        { status: 400 }
      );
    }

    // 3. Conectar a Supabase con service role para evitar bloqueos por RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuración de Supabase service role faltante",
        } as SendClubWelcomeResponse,
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 4. Obtener teléfono
    const phone =
      body.telefono || (await getProfilePhone(supabase, body.perfil_id));

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró teléfono para el perfil",
        } as SendClubWelcomeResponse,
        { status: 404 }
      );
    }

    // 4.1 Idempotencia reforzada: evita reenvíos aunque existan llamadas duplicadas
    const alreadySent = await wasWelcomeAlreadySentBroad(supabase, {
      perfilId: body.perfil_id,
      phone,
      cedula: body.cedula,
    });
    if (alreadySent) {
      return NextResponse.json(
        {
          success: true,
          already_sent: true,
          message: "La plantilla de bienvenida ya había sido enviada para este cliente",
        } as SendClubWelcomeResponse,
        { status: 200 }
      );
    }

    // 5. Candado anti-concurrencia: evita doble envío simultáneo de plantilla
    const lock = await acquireWelcomeSendLock(supabase, body.perfil_id, phone, body.cedula);
    if (!lock.acquired) {
      if (lock.alreadySent) {
        return NextResponse.json(
          {
            success: true,
            already_sent: true,
            message: "La plantilla de bienvenida ya había sido enviada para este cliente",
          } as SendClubWelcomeResponse,
          { status: 200 }
        );
      }

      if (lock.inProgress) {
        return NextResponse.json(
          {
            success: true,
            already_sent: true,
            message: "Ya existe un envío de bienvenida en proceso para este cliente",
          } as SendClubWelcomeResponse,
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "No se pudo asegurar el envío único de la plantilla. Intenta nuevamente.",
        } as SendClubWelcomeResponse,
        { status: 409 }
      );
    }

    // 6. Enviar plantilla de WhatsApp (pre-aprobada por Meta)
    // Plantilla: "club_welcome_es"
    // Variable: cedula
    const whatsappResult = await sendWhatsAppMessage(phone, body.cedula);

    // 7. Construir mensaje para auditoría (para notificaciones_enviadas)
    const mensajeAuditoria = `Plantilla: club_welcome_es | Cédula: ${body.cedula}`;

    // 8. Registrar notificación
    await logNotification(
      supabase,
      body.perfil_id,
      phone,
      mensajeAuditoria,
      whatsappResult.response,
      whatsappResult.success
    );

    // 9. Registrar inscripción al club
    await logClubInscription(supabase, body.perfil_id, whatsappResult.success);

    if (whatsappResult.success) {
      try {
        await logConversationTemplate(body.perfil_id, phone, body.cedula);
      } catch (logError) {
        console.warn("[Club Welcome] No se pudo registrar historial de conversación", logError);
      }
    }

    if (!whatsappResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: whatsappResult.error,
          whatsapp_response: whatsappResult.response,
        } as SendClubWelcomeResponse,
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Mensaje de bienvenida enviado correctamente",
        whatsapp_response: whatsappResult.response,
      } as SendClubWelcomeResponse,
      { status: 200 }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Club Welcome] Exception:", errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg } as SendClubWelcomeResponse,
      { status: 500 }
    );
  }
}
