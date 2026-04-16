// Servicio de comunicación: envío de emails (stub)
export async function enviarEmail(destinatario: string, asunto: string, mensaje: string) {
  // Aquí iría la integración real con SendGrid, SMTP, etc.
  // Por ahora, solo loguea y simula éxito
  console.log(`Enviando email a ${destinatario}: ${asunto}\n${mensaje}`);
  return true;
}
