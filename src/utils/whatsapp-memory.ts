/**
 * Utility para obtener contexto de memoria del cliente
 * Usado para hacer el agente más amigable y personalizado
 */

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

function mergePreferenceValues(existing: unknown, patch: unknown): unknown {
  if (Array.isArray(existing) && Array.isArray(patch)) {
    return Array.from(new Set([...existing, ...patch].map((item) => JSON.stringify(item)))).map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    });
  }

  if (
    existing &&
    patch &&
    typeof existing === "object" &&
    typeof patch === "object" &&
    !Array.isArray(existing) &&
    !Array.isArray(patch)
  ) {
    const result: Record<string, unknown> = { ...(existing as Record<string, unknown>) };
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      result[key] = key in result ? mergePreferenceValues(result[key], value) : value;
    }
    return result;
  }

  return patch ?? existing;
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

function normalizeTrustLevel(value: unknown): "nuevo" | "conocido" | "leal" {
  const v = String(value || "nuevo").toLowerCase();
  if (v === "leal") return "leal";
  if (v === "conocido") return "conocido";
  return "nuevo";
}

function trustByVolume(totalMessages: number, fallback: unknown = "nuevo"): "nuevo" | "conocido" | "leal" {
  if (totalMessages >= 20) return "leal";
  if (totalMessages >= 5) return "conocido";
  return normalizeTrustLevel(fallback);
}

function normalizeHistoryRows(
  rows: Array<{ rol?: unknown; mensaje?: unknown; hora?: unknown; created_at?: unknown }>
): Array<{ rol: "cliente" | "agente"; mensaje: string; hora: string }> {
  return rows
    .map((row) => {
      const roleRaw = String(row.rol || "").toLowerCase();
      const rol: "cliente" | "agente" = roleRaw === "cliente" ? "cliente" : "agente";
      return {
        rol,
        mensaje: String(row.mensaje || "").trim(),
        hora: String(row.hora || row.created_at || new Date().toISOString()),
      };
    })
    .filter((row) => row.mensaje.length > 0);
}

/**
 * Obtiene el contexto del cliente desde Supabase
 */
export async function getCustomerContext(
  supabase: any,
  telefono: string,
  tenantId?: string,
): Promise<CustomerContext | null> {
  const phone = normalizePhone(telefono);

  // 1) Camino principal: RPC
  try {
    if (tenantId) {
      throw new Error("skip-rpc-for-tenant");
    }
    const { data, error } = await supabase.rpc("get_whatsapp_context", {
      p_telefono: phone,
      p_limit: 10,
    });

    if (error) {
      console.error("[Memory] Error obteniendo contexto por RPC, usando fallback:", error);
    } else if (data && data.length > 0) {
      const row = data[0];
      const parsed = safeParseJsonb(row.historial_reciente, []) as Array<{
        rol: unknown; mensaje: unknown; hora: unknown;
      }>;
      const historial = normalizeHistoryRows(parsed);
      const total = historial.length;

      return {
        nombre: row.nombre || undefined,
        nivelConfianza: trustByVolume(total, row.nivel_confianza),
        historialReciente: historial,
        preferencias: (safeParseJsonb(row.preferencias, {}) as Record<string, unknown>),
        ultimoTema: row.ultimo_tema || undefined,
        totalMensajes: total,
      };
    }

    if (data && data.length === 0) {
      // Continúa a fallback porque puede existir historial aunque falte fila en whatsapp_customer_memory
    }
  } catch (err) {
    console.error("[Memory] Exception RPC, usando fallback:", err);
  }

  // 2) Fallback robusto: lectura directa de tablas
  try {
    let memoryQuery = supabase
      .from("whatsapp_customer_memory")
      .select("nombre,nivel_confianza,preferencias,último_tema_tratado,total_mensajes")
      .eq("telefono", phone)
      .limit(1);

    let historyQuery = supabase
      .from("whatsapp_conversation_history")
      .select("rol,mensaje,created_at")
      .eq("telefono", phone)
      .order("created_at", { ascending: false })
      .limit(10);

    if (tenantId) {
      memoryQuery = memoryQuery.eq("tenant_id", tenantId);
      historyQuery = historyQuery.eq("tenant_id", tenantId);
    }

    const [memoryRes, historyRes] = await Promise.all([
      memoryQuery.maybeSingle(),
      historyQuery,
    ]);

    const fallbackHistory = normalizeHistoryRows(
      (historyRes.data || []).map((row: { rol: unknown; mensaje: unknown; created_at: unknown }) => ({
        rol: row.rol,
        mensaje: row.mensaje,
        created_at: row.created_at,
      }))
    ).sort((a, b) => new Date(a.hora).getTime() - new Date(b.hora).getTime());

    const total = Number(memoryRes.data?.total_mensajes || fallbackHistory.length || 0);
    const nombre = memoryRes.data?.nombre || undefined;
    const nivel = trustByVolume(total, memoryRes.data?.nivel_confianza);
    const preferencias = safeParseJsonb(memoryRes.data?.preferencias, {}) as Record<string, unknown>;
    const ultimoTema = memoryRes.data?.["último_tema_tratado"] || undefined;

    if (!nombre && fallbackHistory.length === 0) {
      return null;
    }

    return {
      nombre,
      nivelConfianza: nivel,
      historialReciente: fallbackHistory,
      preferencias,
      ultimoTema,
      totalMensajes: total,
    };
  } catch (fallbackErr) {
    console.error("[Memory] Fallback exception:", fallbackErr);
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
  temaTratado?: string,
  tenantId?: string,
): Promise<void> {
  const phone = normalizePhone(telefono);

  try {
    if (tenantId) {
      throw new Error("skip-rpc-for-tenant");
    }
    const { error } = await supabase.rpc("update_whatsapp_memory", {
      p_telefono: phone,
      p_perfil_id: perfilId || null,
      p_nombre: nombre || null,
      p_tema_tratado: temaTratado || null,
    });

    if (error) {
      console.error("[Memory] Error RPC actualizando memoria, usando fallback:", error);
      throw error;
    }
  } catch (err) {
    console.error("[Memory] Exception RPC, usando fallback:", err);

    // Fallback robusto: upsert manual en tabla de memoria
    try {
      const now = new Date().toISOString();

      let existingQuery = supabase
        .from("whatsapp_customer_memory")
        .select("id,total_mensajes,nivel_confianza,nombre")
        .eq("telefono", phone)
        .limit(1);

      if (tenantId) {
        existingQuery = existingQuery.eq("tenant_id", tenantId);
      }

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing?.id) {
        const totalMensajes = Number(existing.total_mensajes || 0) + 1;
        const nivelConfianza = trustByVolume(totalMensajes, existing.nivel_confianza);

        const { error: updateError } = await supabase
          .from("whatsapp_customer_memory")
          .update({
            perfil_id: perfilId || null,
            nombre: nombre || existing.nombre || null,
            total_mensajes: totalMensajes,
            nivel_confianza: nivelConfianza,
            ultima_interaccion: now,
            ["último_tema_tratado"]: temaTratado || null,
            updated_at: now,
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error("[Memory] Fallback update error:", updateError);
        }
      } else {
        const { error: insertError } = await supabase
          .from("whatsapp_customer_memory")
          .insert({
            tenant_id: tenantId || null,
            perfil_id: perfilId || null,
            telefono: phone,
            nombre: nombre || null,
            primer_contacto: now,
            ultima_interaccion: now,
            total_mensajes: 1,
            nivel_confianza: "nuevo",
            ["último_tema_tratado"]: temaTratado || null,
            preferencias: {},
            updated_at: now,
          });

        if (insertError) {
          console.error("[Memory] Fallback insert error:", insertError);
        }
      }
    } catch (fallbackErr) {
      console.error("[Memory] Fallback exception:", fallbackErr);
    }
  }
}

export async function mergeCustomerPreferences(
  supabase: any,
  telefono: string,
  patch: Record<string, unknown>,
  perfilId?: string,
  nombre?: string,
  tenantId?: string,
): Promise<void> {
  const phone = normalizePhone(telefono);
  if (!phone || !patch || Object.keys(patch).length === 0) return;

  try {
    let existingQuery = supabase
      .from("whatsapp_customer_memory")
      .select("id,nombre,preferencias")
      .eq("telefono", phone)
      .limit(1);

    if (tenantId) {
      existingQuery = existingQuery.eq("tenant_id", tenantId);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    const currentPreferences = safeParseJsonb(existing?.preferencias, {}) as Record<string, unknown>;
    const mergedPreferences = mergePreferenceValues(currentPreferences, patch) as Record<string, unknown>;
    const now = new Date().toISOString();

    if (existing?.id) {
      const { error } = await supabase
        .from("whatsapp_customer_memory")
        .update({
          perfil_id: perfilId || null,
          nombre: nombre || existing.nombre || null,
          preferencias: mergedPreferences,
          ultima_interaccion: now,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (error) {
        console.error("[Memory] Error actualizando preferencias:", error);
      }
      return;
    }

    const { error } = await supabase
      .from("whatsapp_customer_memory")
      .insert({
        tenant_id: tenantId || null,
        perfil_id: perfilId || null,
        telefono: phone,
        nombre: nombre || null,
        primer_contacto: now,
        ultima_interaccion: now,
        total_mensajes: 0,
        nivel_confianza: "nuevo",
        preferencias: mergedPreferences,
        updated_at: now,
      });

    if (error) {
      console.error("[Memory] Error insertando preferencias:", error);
    }
  } catch (err) {
    console.error("[Memory] Exception guardando preferencias:", err);
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
  tipo: string = "text",
  phoneNumberId?: string,
  tenantId?: string,
): Promise<void> {
  const phone = normalizePhone(telefono);
  const resolvedPhoneNumberId =
    phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null;

  try {
    const { error } = await supabase.from("whatsapp_conversation_history").insert({
      tenant_id: tenantId || null,
      perfil_id: perfilId || null,
      telefono: phone,
      rol,
      mensaje,
      tipo_mensaje: tipo,
      created_at: new Date().toISOString(),
      phone_number_id: resolvedPhoneNumberId,
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
