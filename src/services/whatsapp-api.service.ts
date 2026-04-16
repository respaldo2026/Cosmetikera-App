/**
 * Servicio de WhatsApp Business API (Meta)
 * Permite enviar mensajes automáticos a través de la API de Meta
 */

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'template';
  text?: {
    preview_url?: boolean;
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
}

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

/**
 * Envía un mensaje de texto simple por WhatsApp
 * @param phoneNumber Número de teléfono (incluir código de país, ej: 573001234567)
 * @param message Mensaje de texto
 * @returns Promise con la respuesta de la API
 */
export async function sendWhatsAppTextMessage(
  phoneNumber: string,
  message: string
): Promise<WhatsAppResponse | null> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.error('[WhatsApp API] Credenciales no configuradas');
    return null;
  }

  // Limpiar el número de teléfono
  const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

  const payload: WhatsAppMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'text',
    text: {
      preview_url: true,
      body: message,
    },
  };

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[WhatsApp API] Error:', error);
      return null;
    }

    const data = await response.json();
    console.log('[WhatsApp API] Mensaje enviado exitosamente:', data);
    return data;
  } catch (error) {
    console.error('[WhatsApp API] Error de red:', error);
    return null;
  }
}

/**
 * Envía un mensaje usando una plantilla de WhatsApp
 * @param phoneNumber Número de teléfono
 * @param templateName Nombre de la plantilla (debe estar aprobada en Meta)
 * @param languageCode Código de idioma (ej: 'es', 'es_ES')
 * @param parameters Parámetros de la plantilla
 * @returns Promise con la respuesta de la API
 */
export async function sendWhatsAppTemplateMessage(
  phoneNumber: string,
  templateName: string,
  languageCode: string = 'es',
  parameters: string[] = []
): Promise<WhatsAppResponse | null> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.error('[WhatsApp API] Credenciales no configuradas');
    return null;
  }

  const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

  const payload: WhatsAppMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  };

  // Agregar componentes si hay parámetros
  if (parameters.length > 0) {
    payload.template!.components = [
      {
        type: 'body',
        parameters: parameters.map((text) => ({
          type: 'text',
          text,
        })),
      },
    ];
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[WhatsApp API] Error:', error);
      return null;
    }

    const data = await response.json();
    console.log('[WhatsApp API] Plantilla enviada exitosamente:', data);
    return data;
  } catch (error) {
    console.error('[WhatsApp API] Error de red:', error);
    return null;
  }
}

/**
 * Verifica si la API está configurada correctamente
 */
export function isWhatsAppAPIConfigured(): boolean {
  return !!(PHONE_NUMBER_ID && ACCESS_TOKEN);
}

/**
 * Obtiene información del número de teléfono de WhatsApp Business
 */
export async function getWhatsAppPhoneInfo() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.error('[WhatsApp API] Credenciales no configuradas');
    return null;
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[WhatsApp API] Error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[WhatsApp API] Error de red:', error);
    return null;
  }
}
