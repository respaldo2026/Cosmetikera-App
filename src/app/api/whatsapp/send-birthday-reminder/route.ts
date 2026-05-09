/**
 * POST /api/whatsapp/send-birthday-reminder
 * 
 * Envía recordatorios de cumpleaños automáticos en 3 momentos:
 * - 2 días antes
 * - 1 día antes
 * - El día del cumpleaños
 * 
 * Usar con cron job diario (Make.com o Supabase Edge Function)
 * 
 * Payload:
 * {
 *   "dias_offset": -2 | -1 | 0,
 *   "dry_run": false  // true = simular sin enviar
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { WhatsAppService } from "@/services/whatsapp-service";
import { normalizePhone } from "@/utils/whatsapp-memory";

interface SendBirthdayReminderRequest {
  dias_offset: -2 | -1 | 0; // -2 = 2 días antes, -1 = 1 día antes, 0 = hoy
  dry_run?: boolean; // Simular sin enviar
}

interface BirthdayReminderResponse {
  success: boolean;
  message?: string;
  error?: string;
  enviados?: number;
  fallidos?: number;
  detalles?: Array<{
    perfil_id: string;
    nombre: string;
    resultado: "éxito" | "error";
    error_detalle?: string;
  }>;
}

const BIRTHDAY_TEMPLATE_BY_OFFSET: Record<-2 | -1 | 0, string> = {
  [-2]: process.env.WHATSAPP_TEMPLATE_CUMPLEANOS_2D || "cumpleanos_recordatorio_2d_es",
  [-1]: process.env.WHATSAPP_TEMPLATE_CUMPLEANOS_1D || "cumpleanos_recordatorio_1d_es",
  [0]: process.env.WHATSAPP_TEMPLATE_CUMPLEANOS_HOY || "cumpleanos_celebracion_es",
};

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
      setAll() {},
    },
  });

  const { data, error } = await supabase.auth.getUser();
  return !error && Boolean(data.user?.id);
}

/**
 * Obtiene el nombre de la plantilla según el offset de días
 */
function getTemplateName(diasOffset: -2 | -1 | 0): string {
  return BIRTHDAY_TEMPLATE_BY_OFFSET[diasOffset] || "";
}

/**
 * Obtiene la columna de auditoría según el offset
 */
function getAuditColumns(diasOffset: -2 | -1 | 0): {
  enviado: string;
  fecha: string;
} {
  switch (diasOffset) {
    case -2:
      return { enviado: "enviado_2d_antes", fecha: "fecha_2d_antes" };
    case -1:
      return { enviado: "enviado_1d_antes", fecha: "fecha_1d_antes" };
    case 0:
      return { enviado: "enviado_dia_cumple", fecha: "fecha_dia_cumple" };
    default:
      return { enviado: "", fecha: "" };
  }
}

/**
 * Envía recordatorio de cumpleaños usando plantilla Meta
 */
async function sendBirthdayReminder(
  supabase: any,
  perfilId: string,
  telefono: string,
  diasOffset: -2 | -1 | 0,
  nombreCliente?: string
): Promise<{ success: boolean; error?: string }> {
  const templateName = getTemplateName(diasOffset);

  try {
    // Enviar plantilla con nombre del cliente como {{1}}
    const params = nombreCliente ? [nombreCliente] : [];
    const result = await WhatsAppService.sendTemplate(
      telefono,
      templateName,
      params,
      "es"
    );

    return {
      success: result.messages && result.messages.length > 0,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Birthday] Error enviando plantilla ${templateName}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Registra el envío en auditoría
 */
async function recordBirthdayNotification(
  supabase: any,
  perfilId: string,
  diasOffset: -2 | -1 | 0,
  success: boolean
) {
  const columns = getAuditColumns(diasOffset);
  const year = new Date().getFullYear();

  const { error } = await supabase
    .from("cumpleaños_notificaciones")
    .upsert(
      {
        perfil_id: perfilId,
        año_celebracion: year,
        [columns.enviado]: success,
        [columns.fecha]: success ? new Date() : null,
      },
      { onConflict: "perfil_id,año_celebracion" }
    );

  if (error) {
    console.error(`[Birthday] Error registrando notificación:`, error);
  }
}

async function logBirthdayConversationTemplate(
  perfilId: string,
  telefono: string,
  diasOffset: -2 | -1 | 0,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const templateName = getTemplateName(diasOffset);
  await service.from("whatsapp_conversation_history").insert({
    telefono: normalizePhone(telefono),
    perfil_id: perfilId,
    rol: "agente",
    mensaje: `Plantilla enviada: ${templateName}`,
    tipo_mensaje: "template",
    intento: null,
    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
  });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<BirthdayReminderResponse>> {
  try {
    // 1. Validar autenticación
    if (!(await validateRequest(request))) {
      return NextResponse.json(
        { success: false, error: "No autorizado" } as BirthdayReminderResponse,
        { status: 401 }
      );
    }

    // 2. Parsear payload
    const body: SendBirthdayReminderRequest = await request.json();

    if (body.dias_offset === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "Campo requerido: dias_offset (-2, -1, o 0)",
        } as BirthdayReminderResponse,
        { status: 400 }
      );
    }

    if (![-2, -1, 0].includes(body.dias_offset)) {
      return NextResponse.json(
        {
          success: false,
          error: "dias_offset debe ser -2, -1, o 0",
        } as BirthdayReminderResponse,
        { status: 400 }
      );
    }

    // 3. Conectar a Supabase con service_role_key para evitar bloqueos RLS
    // (el cron de Vercel no tiene sesión de usuario, la clave anon devuelve 0 filas).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuración de Supabase faltante (SUPABASE_SERVICE_ROLE_KEY)",
        } as BirthdayReminderResponse,
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 4. Obtener clientes con cumpleaños en el offset especificado.
    // La función SQL devuelve diferencia en días como valor positivo (2,1,0),
    // mientras este endpoint acepta payload en formato negocio (-2,-1,0).
    const diasParaConsulta = body.dias_offset === 0 ? 0 : Math.abs(body.dias_offset);
    const { data: clientes, error: fetchError } = await supabase.rpc(
      "get_clientes_cumpleanos_proximos",
      { dias_offset: diasParaConsulta }
    );

    if (fetchError) {
      console.error("[Birthday] Error obteniendo clientes:", fetchError);
      return NextResponse.json(
        {
          success: false,
          error: `Error obteniendo clientes: ${fetchError.message}`,
        } as BirthdayReminderResponse,
        { status: 500 }
      );
    }

    if (!clientes || clientes.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: `No hay clientes con cumpleaños en ${body.dias_offset} días`,
          enviados: 0,
          fallidos: 0,
          detalles: [],
        } as BirthdayReminderResponse
      );
    }

    // 5. Enviar recordatorios (o simular si dry_run)
    const detalles: BirthdayReminderResponse["detalles"] = [];
    let enviados = 0;
    let fallidos = 0;

    for (const cliente of clientes) {
      try {
        if (!body.dry_run) {
          const result = await sendBirthdayReminder(
            supabase,
            cliente.perfil_id,
            cliente.telefono,
            body.dias_offset,
            cliente.nombre_completo
          );

          if (result.success) {
            // Registrar en auditoría
            await recordBirthdayNotification(
              supabase,
              cliente.perfil_id,
              body.dias_offset,
              true
            );
            try {
              await logBirthdayConversationTemplate(
                cliente.perfil_id,
                cliente.telefono,
                body.dias_offset,
              );
            } catch (logError) {
              console.warn("[Birthday] No se pudo registrar historial de conversación", logError);
            }
            enviados++;
            detalles.push({
              perfil_id: cliente.perfil_id,
              nombre: cliente.nombre_completo,
              resultado: "éxito",
            });
          } else {
            await recordBirthdayNotification(
              supabase,
              cliente.perfil_id,
              body.dias_offset,
              false
            );
            fallidos++;
            detalles.push({
              perfil_id: cliente.perfil_id,
              nombre: cliente.nombre_completo,
              resultado: "error",
              error_detalle: result.error,
            });
          }
        } else {
          // Dry run: solo simular
          enviados++;
          detalles.push({
            perfil_id: cliente.perfil_id,
            nombre: cliente.nombre_completo,
            resultado: "éxito",
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        fallidos++;
        detalles.push({
          perfil_id: cliente.perfil_id,
          nombre: cliente.nombre_completo,
          resultado: "error",
          error_detalle: errorMsg,
        });
      }
    }

    const offset_label =
      body.dias_offset === 0 ? "HOY" : `en ${Math.abs(body.dias_offset)} día(s)`;

    return NextResponse.json(
      {
        success: true,
        message: `${body.dry_run ? "[DRY RUN] " : ""}Recordatorios de cumpleaños enviados para ${offset_label}`,
        enviados,
        fallidos,
        detalles,
      } as BirthdayReminderResponse
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Birthday] Exception:", errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg } as BirthdayReminderResponse,
      { status: 500 }
    );
  }
}
