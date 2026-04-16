/**
 * Envía un mensaje por WhatsApp usando la API de WhatsApp Cloud
 * IMPORTANTE: Ahora usa la API oficial desde el número configurado, no WhatsApp Web
 */
export async function enviarWhatsapp(numero: string, mensaje: string) {
  if (!numero) return;

  try {
    // Normalizar número
    let phoneStr = String(numero).replace(/[^\d]/g, "");
    if (!phoneStr.startsWith("57")) {
      phoneStr = `57${phoneStr}`;
    }

    // Llamar a la API de WhatsApp Cloud (sin API key, viene del frontend)
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: phoneStr,
        type: 'text',
        message: mensaje,
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('[WhatsApp] ✓ Mensaje enviado desde número API Cloud:', result.messageId);
      return result;
    } else {
      console.error('[WhatsApp] ✗ Error al enviar:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('[WhatsApp] Error crítico al enviar mensaje:', error);
    throw error; // Propagar el error para manejo en el componente
  }
}
