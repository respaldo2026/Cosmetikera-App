/**
 * Normaliza datos de formularios:
 * - Email: siempre minúscula
 * - Otros campos texto: siempre mayúscula
 */

export function normalizarDatosFormulario(datos: Record<string, any>): Record<string, any> {
  const resultado = { ...datos };
  const camposEmail = ["email", "email_alterno"];
  const camposMayuscula = [
    "nombre",
    "nombre_completo",
    "nombre_academia",
    "nombre_negocio",
    "direccion",
    "telefono",
    "ruc",
    "cedula",
    "razon_social",
    "descripcion",
    "titulo",
    "title",
  ];

  for (const [clave, valor] of Object.entries(resultado)) {
    if (typeof valor !== "string" || !valor) continue;

    // Emails: minúscula
    if (camposEmail.includes(clave)) {
      resultado[clave] = valor.toLowerCase().trim();
    }
    // Otros campos: mayúscula
    else if (camposMayuscula.includes(clave)) {
      resultado[clave] = valor.toUpperCase().trim();
    }
  }

  return resultado;
}
