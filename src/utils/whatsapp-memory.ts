/**
 * Utility para obtener contexto de memoria del cliente
 * Usado para hacer el agente más amigable y personalizado
 */

import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

/**
 * Normaliza el número de teléfono a formato consistente (solo dígitos, con código país 57)
 * Make puede enviar: "+573104239494", "573104239494", "3104239494"
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length >= 11) return digits;
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}

/**
 * Parsea un valor que puede ser string JSON o ya ser un objeto/array (jsonb de Supabase)
 */
function safeParseJsonb(value: unknown, fallback: unknown = []): unknown {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value; // ya es objeto
}

export interface CustomerContext {
  nombre?: string;
  nivelConfianza: "nuevo" | "conocido" | "leal";
  historialReciente: Array<{
    rol: "cliente" | "agente";
    mensaje: string;
    hora: string;
  }>;
  preferencias: Record<string, any>;
  ultimoTema?: string;
  totalMensajes?: number;
}

/**
 * Obtiene el contexto del cliente desde Supabase
 */
export async function getCustomerContext(
  supabase: any,
  telefono: string
): Promise<CustomerContext | null> {
  try {
    const { data, error } = await supabase.rpc("get_whatsapp_context", {
      p_telefono: telefono,
      p_limit: 10,
    });

    if (error) {
      console.error("[Memory] Error obteniendo contexto:", error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0];
    const historial = safeParseJsonb(row.historial_reciente, []) as Array<{
      rol: "cliente" | "agente"; mensaje: string; hora: string;
    }>;
    const total = historial.length;
    // Calcular nivel de confianza por volumen de mensajes
    const nivel: "nuevo" | "conocido" | "leal" =
      total >= 20 ? "leal" : total >= 5 ? "conocido" : (row.nivel_confianza ?? "nuevo");

    return {
      nombre: row.nombre,
      nivelConfianza: nivel,
      historialReciente: historial,
      preferencias: (safeParseJsonb(row.preferencias, {}) as Record<string, unknown>),
      ultimoTema: row.ultimo_tema,
      totalMensajes: total,
    };
  } catch (err) {
    console.error("[Memory] Exception:", err);
    return null;
  }
}

/**
 * Actualiza la memoria del cliente después de procesar su mensaje
 */
export async function updateCustomerMemory(
  supabase: any,
  telefono: string,
  perfilId?: string,
  nombre?: string,
  temaTratado?: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc("update_whatsapp_memory", {
      p_telefono: telefono,
      p_perfil_id: perfilId || null,
      p_nombre: nombre || null,
      p_tema_tratado: temaTratado || null,
    });

    if (error) {
      console.error("[Memory] Error actualizando memoria:", error);
    }
  } catch (err) {
    console.error("[Memory] Exception:", err);
  }
}

/**
 * Registra un mensaje en el historial de conversación
 */
export async function logConversationMessage(
  supabase: any,
  telefono: string,
  perfilId: string | undefined,
  rol: "cliente" | "agente",
  mensaje: string,
  tipo: string = "text"
): Promise<void> {
  try {
    const { error } = await supabase.from("whatsapp_conversation_history").insert({
      perfil_id: perfilId || null,
      telefono,
      rol,
      mensaje,
      tipo_mensaje: tipo,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[Memory] Error registrando mensaje:", error);
    }
  } catch (err) {
    console.error("[Memory] Exception:", err);
  }
}

/**
 * Construye un prompt mejorado con contexto del cliente
 * Para que Gemini sea más amigable y personalizado
 */
export function buildContextualPrompt(
  basePrompt: string,
  context: CustomerContext | null
): string {
  if (!context) {
    return basePrompt;
  }

  let prompt = basePrompt;

  // Agregar información del cliente si es conocido
  if (context.nombre) {
    prompt += `\n\n## Cliente: ${context.nombre}`;
    prompt += `\nRelación: ${
      context.nivelConfianza === "leal"
        ? "Cliente leal"
        : context.nivelConfianza === "conocido"
          ? "Cliente conocido"
          : "Primer contacto"
    }`;
  }

  // Agregar contexto de conversación reciente
  if (context.historialReciente && context.historialReciente.length > 0) {
    prompt += "\n\n## Conversación Reciente:";
    context.historialReciente.slice(0, 5).forEach((msg) => {
      const rol = msg.rol === "cliente" ? "Cliente" : "Tú (Agente)";
      prompt += `\n${rol}: ${msg.mensaje}`;
    });
  }

  // Agregar tema tratado anteriormente
  if (context.ultimoTema) {
    prompt += `\n\n## Tema Anterior: ${context.ultimoTema}`;
    prompt += `\nContinúa siendo cercano y recuerda el contexto previo.`;
  }

  // Agregar instrucción de tono personalizado
  prompt += `\n\n## Tono:
- Si es cliente leal: Más cercano, familiar, aprovecha el nombre
- Si es cliente conocido: Amigable, reconoce que ya se conocen
- Si es primer contacto: Cálido pero profesional
- SIEMPRE usa el nombre si lo tienes
- SIEMPRE refiere a temas anteriores si es relevante
- Sé genuinamente amigable, no robótico`;

  return prompt;
}

/**
 * Extrae tema/intención de la respuesta para memoria
 */
export function extractThemeFromMessage(mensaje: string): string | null {
  const keywords: Record<string, string> = {
    // Productos
    cabello: "productos para cabello",
    champú: "productos para cabello",
    acondicionador: "productos para cabello",
    keratina: "productos para cabello",
    alisado: "productos para alisado",
    coloración: "tintes y coloración",
    tinte: "tintes y coloración",
    colorante: "tintes y coloración",
    hidratación: "tratamientos hidratantes",
    humedad: "tratamientos hidratantes",
    maquillaje: "productos de maquillaje",
    uñas: "cuidado de uñas",
    esmalte: "cuidado de uñas",
    gel: "cuidado de uñas",

    // Acciones
    compra: "interés en compra",
    precio: "consulta de precios",
    costo: "consulta de precios",
    envío: "consulta de envíos",
    promoción: "consulta de promociones",
    descuento: "consulta de descuentos",
    reclamación: "reclamo",
    problema: "soporte técnico",
    duda: "consulta general",
    pregunta: "consulta general",

    // Club
    puntos: "consulta del club",
    canje: "canje de puntos",
    nivel: "consulta de nivel",
    cumpleaños: "beneficio de cumpleaños",
  };

  const mensajeLower = mensaje.toLowerCase();
  for (const [keyword, theme] of Object.entries(keywords)) {
    if (mensajeLower.includes(keyword)) {
      return theme;
    }
  }

  return null;
}
