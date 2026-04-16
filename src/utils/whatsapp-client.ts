/**
 * Cliente para enviar mensajes por WhatsApp Cloud API desde el frontend
 * 
 * IMPORTANTE: 
 * - Este cliente NO incluye el API key (por seguridad del frontend)
 * - El endpoint /api/whatsapp/send validará la sesión del usuario
 * - Solo usuarios autenticados pueden enviar mensajes
 */

import type { WhatsAppSendRequest, WhatsAppSendResponse } from "@/types/whatsapp";

/**
 * Envía un mensaje de texto por WhatsApp Cloud API
 */
export async function enviarMensajeWhatsApp(
  phone: string,
  message: string
): Promise<WhatsAppSendResponse> {
  const response = await fetch("/api/whatsapp/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone,
      type: "text",
      message,
    } as WhatsAppSendRequest),
  });

  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }

  return response.json();
}

/**
 * Envía una imagen por WhatsApp Cloud API
 */
export async function enviarImagenWhatsApp(
  phone: string,
  imageUrl: string,
  caption?: string
): Promise<WhatsAppSendResponse> {
  const response = await fetch("/api/whatsapp/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone,
      type: "image",
      mediaUrl: imageUrl,
      caption,
    } as WhatsAppSendRequest),
  });

  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }

  return response.json();
}

/**
 * Envía un PDF por WhatsApp Cloud API
 */
export async function enviarPDFWhatsApp(
  phone: string,
  pdfUrl: string,
  caption?: string
): Promise<WhatsAppSendResponse> {
  const response = await fetch("/api/whatsapp/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone,
      type: "pdf",
      mediaUrl: pdfUrl,
      caption,
    } as WhatsAppSendRequest),
  });

  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }

  return response.json();
}

/**
 * Envía mensaje con botones interactivos por WhatsApp Cloud API
 */
export async function enviarBotonesWhatsApp(
  phone: string,
  message: string,
  buttons: Array<{ id: string; title: string }>
): Promise<WhatsAppSendResponse> {
  const response = await fetch("/api/whatsapp/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone,
      type: "buttons",
      message,
      buttons,
    } as WhatsAppSendRequest),
  });

  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }

  return response.json();
}
