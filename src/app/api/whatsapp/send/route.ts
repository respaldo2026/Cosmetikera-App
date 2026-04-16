/**
 * POST /api/whatsapp/send
 * 
 * Endpoint para enviar mensajes por WhatsApp Cloud API
 * 
 * IMPORTANTE:
 * - Acepta llamadas desde Make (con x-api-key)
 * - Acepta llamadas desde el frontend (sin API key, validación por sesión si se implementa)
 * - NO recibe webhooks de WhatsApp (Make los maneja)
 */

import { NextRequest, NextResponse } from "next/server";
import { WhatsAppService } from "@/services/whatsapp-service";
import type { WhatsAppSendRequest, WhatsAppSendResponse } from "@/types/whatsapp";

/**
 * Valida que la solicitud venga de Make o del frontend autenticado
 */
function validateRequest(request: NextRequest): boolean {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.WHATSAPP_API_KEY;

  // Si hay API key en el header, validar que coincida (para Make)
  if (apiKey) {
    return apiKey === expectedKey;
  }

  // Si no hay API key, permitir (asumiendo que viene del frontend autenticado)
  // NOTA: Aquí puedes agregar validación de sesión si lo necesitas
  // const session = await getServerSession();
  // if (!session) return false;

  return true; // Permitir llamadas desde el frontend
}

/**
 * Handler principal del endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticación
    if (!validateRequest(request)) {
      return NextResponse.json(
        { success: false, error: "No autorizado" } as WhatsAppSendResponse,
        { status: 401 }
      );
    }

    // 2. Verificar credenciales de WhatsApp
    const credentialsCheck = WhatsAppService.checkCredentials();
    if (!credentialsCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `Configuración inválida: ${credentialsCheck.error}`,
        } as WhatsAppSendResponse,
        { status: 500 }
      );
    }

    // 3. Parsear payload
    const body: WhatsAppSendRequest = await request.json();

    // 4. Validar campos requeridos
    if (!body.phone || !body.type) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan campos requeridos: phone, type",
        } as WhatsAppSendResponse,
        { status: 400 }
      );
    }

    // 5. Ejecutar envío según el tipo
    let response;

    console.log(`[WhatsApp API] Procesando tipo: ${body.type}`, { phone: body.phone, template: body.template });

    switch (body.type) {
      case "text":
        if (!body.message) {
          return NextResponse.json(
            {
              success: false,
              error: "El tipo 'text' requiere el campo 'message'",
            } as WhatsAppSendResponse,
            { status: 400 }
          );
        }
        response = await WhatsAppService.sendText(body.phone, body.message);
        break;

      case "template":
        if (!body.template || !body.templateVariables) {
          return NextResponse.json(
            {
              success: false,
              error: "El tipo 'template' requiere 'template' (nombre) y 'templateVariables' (array)",
            } as WhatsAppSendResponse,
            { status: 400 }
          );
        }
        console.log(`[WhatsApp API] Enviando template '${body.template}' con ${body.templateVariables.length} variables`);
        response = await WhatsAppService.sendTemplate(
          body.phone,
          body.template,
          body.templateVariables,
          body.templateLanguage || "es"
        );
        console.log(`[WhatsApp API] Respuesta template:`, response);
        break;

      case "image":
        if (!body.mediaUrl) {
          return NextResponse.json(
            {
              success: false,
              error: "El tipo 'image' requiere el campo 'mediaUrl'",
            } as WhatsAppSendResponse,
            { status: 400 }
          );
        }
        response = await WhatsAppService.sendImage(
          body.phone,
          body.mediaUrl,
          body.caption
        );
        break;

      case "pdf":
        if (!body.mediaUrl) {
          return NextResponse.json(
            {
              success: false,
              error: "El tipo 'pdf' requiere el campo 'mediaUrl'",
            } as WhatsAppSendResponse,
            { status: 400 }
          );
        }
        response = await WhatsAppService.sendPDF(
          body.phone,
          body.mediaUrl,
          body.caption
        );
        break;

      case "buttons":
        if (!body.message || !body.buttons || body.buttons.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: "El tipo 'buttons' requiere 'message' y 'buttons' (array con 1-3 botones)",
            } as WhatsAppSendResponse,
            { status: 400 }
          );
        }
        response = await WhatsAppService.sendButtons(
          body.phone,
          body.message,
          body.buttons
        );
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Tipo de mensaje no soportado: ${body.type}`,
          } as WhatsAppSendResponse,
          { status: 400 }
        );
    }

    // 6. Responder con éxito
    return NextResponse.json({
      success: true,
      messageId: response.messages?.[0]?.id,
      phone: body.phone,
    } as WhatsAppSendResponse);

  } catch (error) {
    console.error("[WhatsApp API] Error completo:", {
      message: error instanceof Error ? error.message : "Error desconocido",
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido al enviar mensaje",
      } as WhatsAppSendResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/whatsapp/send
 * Endpoint de verificación (opcional)
 */
export async function GET() {
  const credentialsCheck = WhatsAppService.checkCredentials();

  return NextResponse.json({
    status: "ok",
    service: "WhatsApp Business Cloud API",
    configured: credentialsCheck.valid,
    error: credentialsCheck.error,
  });
}
