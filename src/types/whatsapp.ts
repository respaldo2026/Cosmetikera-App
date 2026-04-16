/**
 * Tipos TypeScript para WhatsApp Business Cloud API
 * Documentación oficial: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

// ============================================
// TIPOS PARA ENVÍO DE MENSAJES
// ============================================

export type WhatsAppMessageType = "text" | "image" | "pdf" | "buttons" | "template";

/**
 * Payload genérico para solicitud de envío desde Make
 */
export interface WhatsAppSendRequest {
  phone: string;
  type: WhatsAppMessageType;
  message?: string;
  mediaUrl?: string;
  caption?: string;
  buttons?: WhatsAppButton[];
  template?: string;
  templateVariables?: string[];
  templateLanguage?: string;
}

/**
 * Botón interactivo (reply button)
 */
export interface WhatsAppButton {
  id: string;
  title: string; // Máximo 20 caracteres
}

// ============================================
// TIPOS PARA API DE META
// ============================================

/**
 * Payload para enviar mensaje de texto
 */
export interface WhatsAppTextMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: {
    preview_url: boolean;
    body: string;
  };
}

/**
 * Payload para enviar imagen
 */
export interface WhatsAppImageMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "image";
  image: {
    link: string;
    caption?: string;
  };
}

/**
 * Payload para enviar documento (PDF)
 */
export interface WhatsAppDocumentMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "document";
  document: {
    link: string;
    caption?: string;
    filename?: string;
  };
}

/**
 * Payload para enviar mensaje interactivo con botones
 */
export interface WhatsAppInteractiveMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "interactive";
  interactive: {
    type: "button";
    body: {
      text: string;
    };
    action: {
      buttons: Array<{
        type: "reply";
        reply: {
          id: string;
          title: string;
        };
      }>;
    };
  };
}

/**
 * Respuesta exitosa de la API de WhatsApp
 */
export interface WhatsAppAPIResponse {
  messaging_product: "whatsapp";
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

/**
 * Error de la API de WhatsApp
 */
export interface WhatsAppAPIError {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      messaging_product: string;
      details: string;
    };
    error_subcode?: number;
    fbtrace_id: string;
  };
}

// ============================================
// TIPOS PARA RESPUESTAS DE LA APP
// ============================================

export interface WhatsAppSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  phone?: string;
}
