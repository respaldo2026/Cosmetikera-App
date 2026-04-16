// Servicio de comunicación: notificaciones centralizadas
export function mostrarNotificacion(tipo: "success" | "error" | "info" | "warning", mensaje: string) {
  // Aquí podrías integrar con un sistema de notificaciones global, toast, etc.
  // Por ahora, usa window.alert como stub
  if (tipo === "error") {
    window.alert("Error: " + mensaje);
  } else if (tipo === "success") {
    window.alert("Éxito: " + mensaje);
  } else {
    window.alert(mensaje);
  }
}
