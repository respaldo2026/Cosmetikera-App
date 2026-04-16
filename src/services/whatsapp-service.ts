/**
 * WhatsAppService
 * 
 * Servicio centralizado para enviar mensajes por WhatsApp Business Cloud API
 * 
 * IMPORTANTE:
 * - Este servicio SOLO envía mensajes, NO recibe (Make maneja el webhook)
 * - Requiere WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN en .env
 * - Respeta la ventana de conversación de 24 horas de WhatsApp
 * 
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import type {
  WhatsAppTextMessage,
  WhatsAppImageMessage,
  WhatsAppDocumentMessage,
  WhatsAppInteractiveMessage,
  WhatsAppAPIResponse,
  WhatsAppAPIError,
  WhatsAppButton,
} from "@/types/whatsapp";

// ============================================
// CONFIGURACIÓN
// ============================================

const WHATSAPP_API_VERSION = "v21.0";
const WHATSAPP_API_BASE_URL = "https://graph.facebook.com";

/**
 * Obtiene las credenciales de WhatsApp desde variables de entorno
 */
function getWhatsAppCredentials() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "Faltan credenciales de WhatsApp. Configura WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN en .env"
    );
  }

  return { phoneNumberId, accessToken };
}

/**
 * Construye la URL del endpoint de mensajes
 */
function getMessagesEndpoint(): string {
  const { phoneNumberId } = getWhatsAppCredentials();
  return `${WHATSAPP_API_BASE_URL}/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
}

// ============================================
// FUNCIONES DE ENVÍO
// ============================================

/**
 * Envía un payload a la API de WhatsApp
 */
async function sendToWhatsAppAPI(
  payload: WhatsAppTextMessage | WhatsAppImageMessage | WhatsAppDocumentMessage | WhatsAppInteractiveMessage
): Promise<WhatsAppAPIResponse> {
  const { accessToken } = getWhatsAppCredentials();
  const endpoint = getMessagesEndpoint();

  console.log('[WhatsApp Service] Payload enviado a Meta API:', JSON.stringify(payload, null, 2));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as WhatsAppAPIError;
    
    // Log detallado del error
    console.error('[WhatsApp Service] Error de API:', {
      code: error.error.code,
      message: error.error.message,
      type: error.error.type,
      details: error.error.error_data,
      fbtrace_id: error.error.fbtrace_id
    });

    // Mensajes de error más claros según el código
    let errorMessage = error.error.message;
    
    if (error.error.code === 133010) {
      errorMessage = `El número de teléfono no está registrado en WhatsApp. Verifica que sea un número válido y activo.`;
    } else if (error.error.code === 131031) {
      errorMessage = `Token de acceso inválido o expirado. Genera un nuevo token en Meta Dashboard.`;
    } else if (error.error.code === 100) {
      errorMessage = `Parámetro inválido. Verifica el formato del número de teléfono.`;
    }
    
    throw new Error(errorMessage);
  }

  return data as WhatsAppAPIResponse;
}

/**
 * Normaliza el número de teléfono al formato internacional
 * Ej: "573001234567" o "+573001234567"
 */
export function normalizePhoneNumber(phone: string): string {
  // Remover caracteres no numéricos excepto el +
  let normalized = phone.replace(/[^\d+]/g, "");

  // Si empieza con +, está bien
  if (normalized.startsWith("+")) {
    return normalized.substring(1); // WhatsApp API no usa el +
  }

  // Si no tiene código de país, asumir Colombia (57)
  if (normalized.length === 10) {
    normalized = "57" + normalized;
  }

  return normalized;
}

/**
 * Valida que un número de teléfono sea potencialmente válido
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  if (!phone || phone.trim() === "") {
    return { valid: false, error: "El número de teléfono es requerido" };
  }

  const normalized = normalizePhoneNumber(phone);

  // Debe tener al menos 10 dígitos (código país + número)
  if (normalized.length < 10) {
    return { valid: false, error: "El número de teléfono es demasiado corto" };
  }

  // No debe tener más de 15 dígitos (estándar internacional E.164)
  if (normalized.length > 15) {
    return { valid: false, error: "El número de teléfono es demasiado largo" };
  }

  // Debe ser solo números
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, error: "El número de teléfono debe contener solo dígitos" };
  }

  return { valid: true };
}

// ============================================
// SERVICIO PÚBLICO
// ============================================

export const WhatsAppService = {
  /**
   * Envía un mensaje de texto simple
   */
  async sendText(phone: string, message: string): Promise<WhatsAppAPIResponse> {
    // Validar número antes de enviar
    const validation = validatePhoneNumber(phone);
    if (!validation.valid) {
      throw new Error(`Número inválido: ${validation.error}`);
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    const payload: WhatsAppTextMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "text",
      text: {
        preview_url: true, // Habilita preview de URLs
        body: message,
      },
    };

    console.log(`[WhatsApp] Enviando texto a ${normalizedPhone}`);
    const response = await sendToWhatsAppAPI(payload);
    console.log(`[WhatsApp] ✓ Mensaje enviado. ID: ${response.messages?.[0]?.id}`);

    return response;
  },

  /**
   * Envía una imagen por URL
   */
  async sendImage(
    phone: string,
    imageUrl: string,
    caption?: string
  ): Promise<WhatsAppAPIResponse> {
    const normalizedPhone = normalizePhoneNumber(phone);

    const payload: WhatsAppImageMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "image",
      image: {
        link: imageUrl,
        caption,
      },
    };

    console.log(`[WhatsApp] Enviando imagen a ${normalizedPhone}: ${imageUrl}`);
    const response = await sendToWhatsAppAPI(payload);
    console.log(`[WhatsApp] ✓ Imagen enviada. ID: ${response.messages?.[0]?.id}`);

    return response;
  },

  /**
   * Envía un documento PDF por URL
   */
  async sendPDF(
    phone: string,
    pdfUrl: string,
    caption?: string,
    filename?: string
  ): Promise<WhatsAppAPIResponse> {
    const normalizedPhone = normalizePhoneNumber(phone);

    const payload: WhatsAppDocumentMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "document",
      document: {
        link: pdfUrl,
        caption,
        filename: filename || "documento.pdf",
      },
    };

    console.log(`[WhatsApp] Enviando PDF a ${normalizedPhone}: ${pdfUrl}`);
    const response = await sendToWhatsAppAPI(payload);
    console.log(`[WhatsApp] ✓ PDF enviado. ID: ${response.messages?.[0]?.id}`);

    return response;
  },

  /**
   * Envía un mensaje interactivo con botones (máximo 3 botones)
   */
  async sendButtons(
    phone: string,
    message: string,
    buttons: WhatsAppButton[]
  ): Promise<WhatsAppAPIResponse> {
    const normalizedPhone = normalizePhoneNumber(phone);

    // Validación: máximo 3 botones
    if (buttons.length === 0 || buttons.length > 3) {
      throw new Error("Debes enviar entre 1 y 3 botones");
    }

    // Validación: título máximo 20 caracteres
    buttons.forEach((btn, index) => {
      if (btn.title.length > 20) {
        throw new Error(
          `El botón ${index + 1} excede 20 caracteres: "${btn.title}"`
        );
      }
    });

    const payload: WhatsAppInteractiveMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: message,
        },
        action: {
          buttons: buttons.map((btn) => ({
            type: "reply",
            reply: {
              id: btn.id,
              title: btn.title,
            },
          })),
        },
      },
    };

    console.log(
      `[WhatsApp] Enviando mensaje con ${buttons.length} botones a ${normalizedPhone}`
    );
    const response = await sendToWhatsAppAPI(payload);
    console.log(`[WhatsApp] ✓ Mensaje interactivo enviado. ID: ${response.messages?.[0]?.id}`);

    return response;
  },

  /**
   * Envía un mensaje usando template aprobado (recomendado para producción)
   * 
   * @param phone - Número de teléfono en formato internacional
   * @param templateName - Nombre del template en Meta Business Manager
   * @param variables - Array de valores para reemplazar {{1}}, {{2}}, etc.
   * @param languageCode - Código de idioma (default: "es")
   */
  async sendTemplate(
    phone: string,
    templateName: string,
    variables: string[] = [],
    languageCode: string = "es"
  ): Promise<WhatsAppAPIResponse> {
    const normalizedPhone = phone.replace(/\D/g, "");

    const payload: any = {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
      },
    };

    // Si hay variables, agregar components con estructura correcta
    if (variables.length > 0) {
      payload.template.components = [
        {
          type: "body",
          parameters: variables.map((value) => ({
            type: "text",
            text: String(value),
          })),
        },
      ];
    }

    console.log(
      `[WhatsApp] Enviando template '${templateName}' a ${normalizedPhone} con ${variables.length} variables`
    );
    const response = await sendToWhatsAppAPI(payload as any);
    console.log(
      `[WhatsApp] ✓ Template enviado. ID: ${response.messages?.[0]?.id}`
    );

    return response;
  },

  /**
   * Verifica que las credenciales estén configuradas
   */
  checkCredentials(): { valid: boolean; error?: string } {
    try {
      getWhatsAppCredentials();
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  },
};
