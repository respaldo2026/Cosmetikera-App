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
import { WhatsAppService } from "@/services/whatsapp-service";

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
  switch (diasOffset) {
    case -2:
      return "cumpleaños_recordatorio_2d_es";
    case -1:
      return "cumpleaños_recordatorio_1d_es";
    case 0:
      return "cumpleaños_celebracion_es";
    default:
      return "";
  }
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
  diasOffset: -2 | -1 | 0
): Promise<{ success: boolean; error?: string }> {
  const templateName = getTemplateName(diasOffset);

  try {
    // Enviar plantilla (sin variables, son genéricas)
    const result = await WhatsAppService.sendTemplate(
      telefono,
      templateName,
      [],
      "es"
    );

    return {
      success: result.messages && result.messages.length > 0,
      error: result.error?.message || undefined,
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

    // 3. Conectar a Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuración de Supabase faltante",
        } as BirthdayReminderResponse,
        { status: 500 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    // 4. Obtener clientes con cumpleaños en el offset especificado
    const { data: clientes, error: fetchError } = await supabase.rpc(
      "get_clientes_cumpleaños_proximos",
      { dias_offset: body.dias_offset }
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
            body.dias_offset
          );

          if (result.success) {
            // Registrar en auditoría
            await recordBirthdayNotification(
              supabase,
              cliente.perfil_id,
              body.dias_offset,
              true
            );
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
