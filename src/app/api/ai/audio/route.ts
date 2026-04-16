/**
 * POST /api/ai/audio
 *
 * Endpoint para procesar audio de WhatsApp:
 * 1. Descargar audio desde URL
 * 2. STT: Convertir audio → texto (Google Generative AI)
 * 3. Procesar con agente IA (personalidad + conocimiento)
 * 4. TTS: Convertir respuesta → audio (Elevenlabs)
 * 5. Devolver URL del audio generado
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { getAgentImageSuggestion, withMediaSuggestion } from "@/utils/agent-media-suggestions";
import { 
  getProgramsForAgent, 
  getCoursesForQuery, 
  getCoursesByProgram,
  detectProgramFromMessage,
  buildHierarchicalContext,
  buildHierarchicalContextWithPensum,
  getAcademyInfo,
  getMediosPago,
  getStudentContextByIdentification
} from "@/utils/supabase/agent-courses";

export const dynamic = "force-dynamic";

/**
 * Validar autenticación
 */
function validateRequest(request: NextRequest): boolean {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.WHATSAPP_API_KEY;
  if (apiKey && apiKey === expectedKey) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.includes("Bearer")) return true;

  return false;
}

function pickFirstNonEmptyString(...candidates: Array<any>): string {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }
  return "";
}

function normalizePhoneIdentifier(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "unknown";

  if (digits.length === 10 && digits.startsWith("3")) {
    return `57${digits}`;
  }

  if (digits.startsWith("00") && digits.length > 2) {
    return digits.slice(2);
  }

  return digits;
}

function extractStringsDeep(input: any, maxDepth = 4): string[] {
  const result: string[] = [];
  const visited = new Set<any>();

  const walk = (value: any, depth: number) => {
    if (depth < 0 || value == null) return;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) result.push(trimmed);
      return;
    }
    if (typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth - 1);
      return;
    }

    for (const v of Object.values(value)) {
      walk(v, depth - 1);
    }
  };

  walk(input, maxDepth);
  return result;
}

function findPhoneCandidateDeep(candidates: string[]): string {
  for (const value of candidates) {
    if (!value) continue;

    const normalized = String(value).trim();
    if (!normalized) continue;

    const fromJid = normalized.match(/(?:^|\s|:)(\d{10,15})(?:@c\.us|@s\.whatsapp\.net|@g\.us|@)/i);
    if (fromJid?.[1]) {
      return fromJid[1];
    }

    const fromQuotedPhone = normalized.match(/(?:\+|00)?\d{10,15}/);
    if (fromQuotedPhone?.[0]) {
      const digits = fromQuotedPhone[0].replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) {
        return digits;
      }
    }

    const digits = normalized.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) {
      return digits;
    }
  }

  return "";
}

function extractPhoneFromAudioBody(body: any): string {
  const webhookPhone = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  const webhookContactPhone = body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.wa_id;
  const nestedPhone = body?.messages?.[0]?.from;

  const extractPhoneCandidatesByKey = (input: any, maxDepth = 6): string[] => {
    const result: string[] = [];
    const visited = new Set<any>();
    const keyPattern = /(phone|telefono|whatsapp|wa_?id|from|sender|contact|chat|jid|author|participant|customer|cliente|remotejid)/i;

    const pushCandidate = (value: any) => {
      if (typeof value === "string" && value.trim()) {
        result.push(value.trim());
        return;
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        result.push(String(value));
      }
    };

    const walk = (value: any, depth: number) => {
      if (depth < 0 || value == null) return;
      if (typeof value !== "object") return;
      if (visited.has(value)) return;
      visited.add(value);

      if (Array.isArray(value)) {
        for (const item of value) walk(item, depth - 1);
        return;
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        if (keyPattern.test(key)) {
          pushCandidate(nestedValue);
        }
        walk(nestedValue, depth - 1);
      }
    };

    walk(input, maxDepth);
    return result;
  };

  const deepCandidates = extractStringsDeep({
    messages: body?.messages,
    entry: body?.entry,
    data: body?.data,
    payload: body?.payload,
    sender: body?.sender,
    contact: body?.contact,
    whatsapp: body?.whatsapp,
    metadata: body?.metadata,
  });

  const deepKeyCandidates = extractPhoneCandidatesByKey(body);

  const deepPhoneCandidate = findPhoneCandidateDeep([...deepKeyCandidates, ...deepCandidates]);

  const phone = pickFirstNonEmptyString(
    body?.phone,
    body?.phone_number,
    body?.phoneNumber,
    body?.telefono_whatsapp,
    body?.p_telefono,
    body?.numero,
    body?.numero_whatsapp,
    body?.from_number,
    body?.fromNumber,
    body?.whatsapp_id,
    body?.p_whatsapp_id,
    body?.telefono,
    body?.telefono_cliente,
    body?.sender?.phone,
    body?.sender?.wa_id,
    body?.sender?.id,
    body?.customer?.phone,
    body?.cliente?.telefono,
    body?.conversation?.phone_number,
    body?.conversation?.wa_id,
    body?.chat?.id,
    body?.chatId,
    body?.session_id,
    body?.sessionId,
    body?.chat_id,
    body?.chat?.jid,
    body?.chat?.remoteJid,
    body?.conversationId,
    body?.whatsapp?.from,
    body?.whatsapp?.wa_id,
    body?.whatsapp?.messages?.[0]?.from,
    body?.whatsapp?.messages?.[0]?.id,
    body?.metadata?.phone,
    body?.metadata?.wa_id,
    body?.metadata?.remote_jid,
    body?.metadata?.remoteJid,
    body?.metadata?.participant,
    body?.contact?.phone,
    body?.contact?.wa_id,
    body?.contact?.id,
    body?.data?.from,
    body?.data?.wa_id,
    body?.data?.phone,
    body?.data?.chat?.id,
    body?.data?.key?.remoteJid,
    body?.data?.key?.participant,
    body?.payload?.from,
    body?.payload?.phone,
    body?.payload?.wa_id,
    body?.payload?.chatId,
    body?.payload?.chat?.id,
    body?.payload?.telefono_whatsapp,
    body?.payload?.p_telefono,
    body?.payload?.p_whatsapp_id,
    body?.payload?.key?.remoteJid,
    body?.data?.telefono_whatsapp,
    body?.data?.p_telefono,
    body?.data?.p_whatsapp_id,
    body?.From,
    body?.from,
    body?.wa_id,
    nestedPhone,
    webhookPhone,
    webhookContactPhone,
    deepPhoneCandidate,
    "unknown"
  );

  const normalizedPhone = normalizePhoneIdentifier(phone);
  if (normalizedPhone === "unknown") {
    console.warn("[extractPhoneFromAudioBody] No se pudo extraer teléfono", {
      directPhone: body?.phone || body?.phone_number || body?.telefono || body?.from || body?.wa_id,
      deepKeyCandidates: deepKeyCandidates.slice(0, 10),
    });
  }

  return normalizedPhone;
}

function looksLikeHttpUrl(value: string): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

function extractAudioInputsFromBody(body: any): { mediaId: string; audioUrl: string } {
  const directMediaId = pickFirstNonEmptyString(
    body?.media_id,
    body?.mediaId,
    body?.audio_id,
    body?.audioId,
    body?.audio_media_id,
    body?.mensaje_audio,
    body?.p_media_id,
  );
  const directAudioUrl = pickFirstNonEmptyString(body?.audio_url, body?.audioUrl, body?.url, body?.audio_link);
  const legacyMessageField = pickFirstNonEmptyString(body?.mensaje_whatsapp);

  const webhookAudioNode = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.audio;
  const nestedAudioNode = body?.messages?.[0]?.audio;
  const deepStringCandidates = extractStringsDeep({
    audio: body?.audio,
    message: body?.message,
    messages: body?.messages,
    entry: body?.entry,
    payload: body?.payload,
    data: body?.data,
  }, 5);

  const fromWebhookMediaId = pickFirstNonEmptyString(
    webhookAudioNode?.id,
    nestedAudioNode?.id,
    webhookAudioNode?.media_id,
    nestedAudioNode?.media_id,
  );

  const fromWebhookAudioUrl = pickFirstNonEmptyString(
    webhookAudioNode?.url,
    nestedAudioNode?.url,
    webhookAudioNode?.link,
    nestedAudioNode?.link,
  );

  const deepUrlCandidate = deepStringCandidates.find((candidate) => looksLikeHttpUrl(candidate)) || "";

  const legacyMediaIdCandidate = legacyMessageField && !looksLikeHttpUrl(legacyMessageField)
    ? legacyMessageField
    : "";
  const legacyAudioUrlCandidate = legacyMessageField && looksLikeHttpUrl(legacyMessageField)
    ? legacyMessageField
    : "";

  const mediaId = pickFirstNonEmptyString(directMediaId, legacyMediaIdCandidate, fromWebhookMediaId);
  const audioUrl = pickFirstNonEmptyString(directAudioUrl, legacyAudioUrlCandidate, fromWebhookAudioUrl, deepUrlCandidate);

  return { mediaId, audioUrl };
}

/**
 * Obtener historial reciente de conversación
 */
async function getConversationHistory(supabase: any, phone: string, limit = 5): Promise<Array<{user: string, agent: string, agent_raw?: string, created_at?: string | null}>> {
  try {
    const { data, error } = await supabase
      .from("agent_conversations")
      .select("user_message, agent_response, created_at")
      .eq("phone_number", phone)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[getConversationHistory] Error:", error);
      return [];
    }

    return (data || []).reverse().map((row: any) => ({
      user: row.user_message,
      agent: stripMediaMarkersForPrompt(row.agent_response),
      agent_raw: row.agent_response,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.error("[getConversationHistory] Error:", err);
    return [];
  }
}

/**
 * Guardar mensaje en historial de conversación
 */
async function saveConversation(
  supabase: any,
  phone: string,
  userMessage: string,
  agentResponse: string,
  transcription?: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("agent_conversations")
      .insert({
        phone_number: phone,
        user_message: userMessage,
        agent_response: agentResponse,
        transcription: transcription || null,
      });

    if (error) {
      console.warn("[saveConversation] Error guardando:", error);
    } else {
      console.log("[saveConversation] Conversación guardada");
    }
  } catch (err) {
    console.warn("[saveConversation] Error:", err);
  }
}

function stripMediaMarkersForPrompt(value: string | null | undefined): string {
  if (!value) return "";

  return String(value)
    .replace(/\[📷\s+[^\]|\n]+\|[^\]\n]*\]\s*/g, "")
    .replace(/^\s*📷\s*https?:\/\/\S+\s*$/gim, "")
    .trim();
}

async function getWhatsAppMediaUrl(mediaId: string, accessToken: string): Promise<string> {
  try {
    console.log(`[getWhatsAppMediaUrl] Obteniendo URL para media: ${mediaId}`);
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    if (!data.url) {
      throw new Error("No URL returned from WhatsApp API");
    }

    console.log("[getWhatsAppMediaUrl] URL obtenida exitosamente");
    return data.url;
  } catch (err) {
    console.error("[getWhatsAppMediaUrl] Error:", err);
    throw err;
  }
}

/**
 * Descargar archivo de audio desde URL
 */
async function downloadAudio(audioUrl: string, bearerToken?: string): Promise<Buffer> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0",
    };

    // Si hay bearer token, agregarlo para autenticación de WhatsApp
    if (bearerToken) {
      headers["Authorization"] = `Bearer ${bearerToken}`;
    }

    console.log(`[downloadAudio] Descargando desde: ${audioUrl.split('?')[0]}...`);
    
    const response = await fetch(audioUrl, { headers });

    if (!response.ok) {
      console.error(`[downloadAudio] Status ${response.status}`);
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`[downloadAudio] Descargado: ${arrayBuffer.byteLength} bytes`);
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("[downloadAudio] Error:", err);
    throw err;
  }
}

/**
 * Convertir audio a texto (STT) usando Google Generative AI
 */
async function speechToText(apiKey: string, audioBuffer: Buffer): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Usar la misma lista de modelos que funciona en el endpoint de chat
  const modelCandidates = [
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash-002",
    "gemini-1.5-pro-002",
    process.env.GEMINI_MODEL_SUMMARY,
  ].filter(Boolean) as string[];

  const base64Audio = audioBuffer.toString("base64");
  let lastError: any = null;

  for (const modelName of modelCandidates) {
    try {
      console.log(`[speechToText] Intentando modelo: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "audio/ogg",
                  data: base64Audio,
                },
              },
              {
                text: "Transcribe este audio de WhatsApp a texto. Devuelve SOLO la transcripción, sin comentarios adicionales.",
              },
            ],
          },
        ],
      });

      const transcription = result.response.text().trim();
      console.log(`[speechToText] Éxito con modelo: ${modelName}`);
      console.log("[speechToText] Transcripción:", transcription.substring(0, 100));
      return transcription;
    } catch (err: any) {
      lastError = err;
      const errorMsg = String(err?.message || "").toLowerCase();
      console.warn(`[speechToText] Error con ${modelName}:`, errorMsg);

      if (errorMsg.includes("404") || errorMsg.includes("not found")) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("No available Gemini model for speech-to-text");
}

/**
 * Buscar chunks relevantes por keywords
 */
async function searchKnowledge(supabase: any, query: string, limit = 3): Promise<string[]> {
  try {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);

    if (!keywords.length) return [];

    const { data, error } = await supabase
      .from("agent_chunks")
      .select("content")
      .or(keywords.map((k) => `content.ilike.%${k}%`).join(","))
      .limit(limit);

    if (error) {
      console.error("[searchKnowledge] Error:", error);
      return [];
    }

    return (data || []).map((r: any) => r.content);
  } catch (err) {
    console.error("[searchKnowledge] Error:", err);
    return [];
  }
}

/**
 * Detectar si ya hay un saludo en el historial de conversación
 */
function hasGreetingInHistory(conversationHistory: Array<{user: string, agent: string, created_at?: string | null}>): boolean {
  if (!conversationHistory || conversationHistory.length === 0) return false;

  const greetings = /\b(hola|buen(?:os|as)?(?:\s+d[ií]as|\s+tardes|\s+noches)?|bienvenid[oa]|que\s+tal|hey|saludos|encantad[oa])\b/i;
  const today = getColombiaNowDate().toISOString().slice(0, 10);

  return conversationHistory.some((msg) => {
    const text = String(msg.agent || "");
    if (!greetings.test(text)) return false;
    if (!msg.created_at) return true;
    return String(msg.created_at).slice(0, 10) === today;
  });
}

function stripRepeatedGreetingPrefix(text: string, hasHistory: boolean): string {
  if (!hasHistory) return text;

  const greetingPrefix = /^\s*(?:[¡!¿?.,:;\-–—\s]|\p{Emoji_Presentation})*(?:hola(?:\s+de\s+nuevo)?|buen(?:os|as)?(?:\s+d[ií]as|\s+tardes|\s+noches)?|saludos)\b[\s!¡.,:;\-–—]*/iu;
  return String(text || "").replace(greetingPrefix, "").trim();
}

function applyTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(tokens, key)
      ? String(tokens[key] ?? "")
      : match;
  });
}

/**
 * Detectar señales de intención de compra o cierre
 * Retorna true si el usuario muestra intención de inscribirse/comprar
 */
function detectBuyingIntent(
  userMessage: string,
  conversationHistory: Array<{user: string, agent: string}> = []
): boolean {
  const message = userMessage.toLowerCase();
  
  // Señales directas de compra
  const directBuyingSignals = [
    /\b(quiero\s+(inscribirme|matricularme|inscribir|apuntarme|registrarme))/i,
    /\b(quiero\s+(registrar|registrarme|registrase|registrasse|inscribirme|inscribirse|inscribisse))/i,
    /\b(me\s+quiero\s+(inscribir|registrar))/i,
    /\b(cómo\s+(me\s+inscribo|hago\s+para\s+inscribirme|puedo\s+inscribirme))/i,
    /\b(como\s+me\s+(registro|registr[oó]))/i,
    /\b(dónde\s+(me\s+inscribo|puedo\s+inscribirme|pago))/i,
    /\b(donde\s+me\s+(registro|registr[oó]))/i,
    /\b(cuándo\s+puedo\s+(empezar|iniciar|comenzar))/i,
    /\b(me\s+(interesa|gustaría|quiero)\s+(el\s+)?curso)/i,
    /\b(ya\s+quiero\s+(iniciar|empezar|inscribirme|registrarme))/i,
    /\b(quiero\s+(información|más\s+info)\s+para\s+inscribirme)/i,
    /\b(voy\s+a\s+(inscribirme|matricularme|apuntarme))/i,
    /\b(quiero\s+agendar|agendar\s+(una\s+)?(cita|visita))/i,
    /\b(puedo\s+ir\s+a\s+(ver|visitar|conocer))/i,
    /\b(cuál\s+es\s+(la|su)\s+dirección)/i,
    /\b(dónde\s+(están\s+ubicados|quedan|se\s+encuentran))/i,
    /\b(me\s+convence|estoy\s+convencido|me\s+decidí)/i,
    /\b(sí\s+(quiero|me\s+interesa))/i,
    /\b(listo|perfecto|excelente),?\s+(quiero|me\s+inscribo)/i,
  ];
  
  // Verificar señales directas
  if (directBuyingSignals.some(pattern => pattern.test(message))) {
    return true;
  }
  
  // Señales indirectas: ha preguntado por costos Y horarios
  const hasAskedAboutPrice = conversationHistory.some(msg =>
    /\b(precio|costo|cuánto|valor|inversión|pago|cuota)/i.test(msg.user)
  );
  
  const hasAskedAboutSchedule = conversationHistory.some(msg =>
    /\b(horario|hora|cuándo|día|fecha|grupo|disponible|inicio)/i.test(msg.user)
  );
  
  // Si ya preguntó sobre precio y horarios, y ahora hace una pregunta positiva
  if (hasAskedAboutPrice && hasAskedAboutSchedule) {
    const positiveSignals = [
      /\b(perfecto|bien|entiendo|ok|vale|genial|excelente)/i,
      /\b(gracias|muchas\s+gracias)/i,
      /\b(me\s+(sirve|funciona|conviene))/i,
    ];
    
    if (positiveSignals.some(pattern => pattern.test(message))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Construir prompt del agente con personalidad + contexto de cursos + conocimiento + historial
 */
function buildAgentPrompt(
  settings: any,
  userMessage: string,
  knowledgeChunks: string[],
  conversationHistory: Array<{user: string, agent: string, created_at?: string | null}> = [],
  coursesContext: string = "",
  contextualDirective: string = ""
): string {
  const persona = settings?.persona_name || "Dany";
  const bio = settings?.persona_bio || "Asistente de la Academia Crystal.";
  const style = settings?.speaking_style || "";
  const systemPromptTemplate = (settings?.system_prompt || "").trim();
  const fallback = settings?.fallback_response || "";
  const greeting = settings?.greeting || "";
  
  // Detectar si ya hay un saludo previo
  const alreadyGreeted = hasGreetingInHistory(conversationHistory);
  
  // Detectar intención de compra/cierre
  const showsBuyingIntent = detectBuyingIntent(userMessage, conversationHistory);

  const nowInColombia = getColombiaNowDate();
  const expectedSlotGreeting = getTimeSlotGreeting(nowInColombia.getHours());

  const greetingRule = alreadyGreeted
    ? `YA SALUDASTE HOY (${expectedSlotGreeting}). No repitas saludos en este mismo día.`
    : greeting
    ? `Saluda SOLO UNA VEZ por día y con franja horaria coherente (${expectedSlotGreeting}). Si vas a saludar, usa este saludo base: "${greeting}". Luego responde sin volver a saludar.`
    : `Saluda SOLO UNA VEZ por día con franja horaria coherente (${expectedSlotGreeting}). Luego responde sin volver a saludar.`;

  let prompt = applyTemplate(systemPromptTemplate, {
    persona_name: persona,
    persona_bio: bio,
    speaking_style: style,
    fallback_response: fallback,
    greeting_rule: greetingRule,
    sales_protocol: "",
  });

  // Agregar contexto de cursos disponibles
  if (coursesContext) {
    prompt += `\n# INFORMACIÓN ACTUAL DE CURSOS:\n${coursesContext}\n`;
  }

  if (conversationHistory.length > 0) {
    prompt += `\n# Historial de conversación reciente:\n`;
    conversationHistory.forEach((msg) => {
      prompt += `\nUsuario: ${msg.user}\n${persona}: ${msg.agent}\n`;
    });
  }

  if (knowledgeChunks.length > 0) {
    prompt += `\n# Contexto disponible (base de conocimiento):\n`;
    knowledgeChunks.forEach((chunk, idx) => {
      prompt += `\n## Fragmento ${idx + 1}:\n${chunk.slice(0, 600)}\n`;
    });
  }

  if (contextualDirective) {
    prompt += `\n# DIRECTIVA CONTEXTUAL (PRIORIDAD ALTA):\n${contextualDirective}\n`;
  }

  prompt += `\n# Mensaje del usuario:\n${userMessage}\n\n# Tu respuesta (como ${persona}):`;

  return prompt;
}

function detectUserIntent(message: string): "precio" | "horario" | "temario" | "materiales" | "inscripcion" | "general" {
  const text = normalizeForMatch(message);
  const hasDurationIntent = /\b(cuanto dura|duracion|duracion del curso|meses|cuantas clases|cuantas sesiones|tiempo del curso)\b/i.test(text);
  const hasClassFrequencyIntent = /\b(cada cuanto|cuantas veces|cada semana|semanal|que dias son clases|cada cuantos dias|con que frecuencia)\b/i.test(text);
  const hasPriceIntent = /\b(precio|precios|costo|costos|vale|valor|valores|mensualidad|mensualidades|inscripcion|inscripciones|cuota|cuotas|inversion|cuanto vale|cuanto es|cuanto cuesta)\b/i.test(text) || /\b(se paga|cada mes|al mes|mes a mes|paga)\b/i.test(text);
  const hasEnrollmentIntent = /\b(inscrib|matricul|admisiones|contacto|whatsapp|separar\s+cupo|reservar\s+cupo|reservame|quiero\s+inscribirme)\b/i.test(text);
  const hasScheduleIntent = /\b(horario|hora|dias|dia|fecha|cuando\s+inicia|inicio|arranca|empieza|grupo|cupo|cupos|disponible|hoy\s+hay\s+clase|hay\s+clase\s+hoy|tengo\s+clase\s+hoy)\b/i.test(text);

  if (hasDurationIntent || hasClassFrequencyIntent) return "horario";
  if (hasEnrollmentIntent) return "inscripcion";
  if (hasPriceIntent) return "precio";
  if (hasScheduleIntent) return "horario";
  if (/\b(temario|contenido|que\s+aprendo|que\s+ven|modulos|ciclos|materias)\b/i.test(text)) return "temario";
  if (/\b(material|materiales|insumo|insumos|herramienta|herramientas|kit|implementos|lista\s+de\s+materiales)\b/i.test(text)) return "materiales";
  if (/\b(inscrib|matricul|admisiones|contacto|numero|whatsapp|separar\s+cupo|reservar\s+cupo)\b/i.test(text)) return "inscripcion";
  return "general";
}

function normalizeForMatch(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTodayClassQuestion(message: string): boolean {
  const text = normalizeForMatch(message);
  return /\b(hoy\s+hay\s+clase|hay\s+clase\s+hoy|tengo\s+clase\s+hoy|hoy\s+tengo\s+clase|clase\s+hoy)\b/i.test(text);
}

function isLikelyProgramOnlyReply(message: string): boolean {
  const text = normalizeForMatch(message);
  if (!text) return false;

  const tokenCount = text.split(" ").filter(Boolean).length;
  if (tokenCount > 4) return false;

  return !/\b(precio|horario|hora|material|temario|inscrip|matricul|pago|cuanto|cuando|donde)\b/i.test(text);
}

function isShortAffirmativeReply(message: string): boolean {
  const text = normalizeForMatch(message);
  if (!text) return false;

  const words = text.split(" ").filter(Boolean);
  if (words.length > 4) return false;

  if (/^s+i+$/i.test(text)) return true;
  if (/^s+i+p+$/i.test(text)) return true;

  return /^(si|dale|ok|okay|claro|listo|perfecto|de una|por favor|si por favor|claro que si)$/i.test(text);
}

function isClosureAcknowledgement(message: string, lastAgentMessage: string): boolean {
  if (!isShortAffirmativeReply(message)) return false;

  const normalizedLastAgent = normalizeForMatch(lastAgentMessage || "");
  if (!normalizedLastAgent) return false;

  return /\b(alguna otra duda|si necesitas algo|te esperamos|nos vemos|quedo atenta|quedo atento|quedo pendiente|cualquier duda|antes de iniciar|te guie con el proceso|te guie con inscripcion)\b/i.test(normalizedLastAgent);
}

function inferPendingTopicFromHistory(history: Array<{ user: string; agent: string }>): string {
  const lastAgent = String(history[history.length - 1]?.agent || "");
  const normalized = normalizeForMatch(lastAgent);

  if (!normalized) return "";
  if (/\b(alguna otra duda|si necesitas algo|antes de iniciar|te guie con el proceso|te guie con inscripcion|quedo atenta|quedo atento|nos vemos|te esperamos)\b/i.test(normalized)) return "";
  if (/\b(clase\s+por\s+clase|por\s+clase|temario\s+detallado)\b/i.test(normalized)) return "quiero el temario clase por clase";
  if (/\b(te reservo( un)? cupo|reservo( tu|el)? cupo|reservar tu cupo|te ayudo a reservar|separar cupo)\b/i.test(normalized)) return "quiero saber como me inscribo";
  if (/\b(inversion|inscripcion|mensualidad|precio|costa|valor)\b/i.test(normalized)) return "quiero saber la inversion";
  if (/\b(cupo|cupos|disponible|disponibles)\b/i.test(normalized)) return "quiero saber si hay cupos disponibles";
  if (/\b(proximo grupo|siguiente grupo|proximo curso|fecha confirmada|por confirmar)\b/i.test(normalized)) return "quiero saber el proximo grupo y su fecha";
  if (/\b(horario|dias|dia|hora)\b/i.test(normalized)) return "quiero saber dias y horario";
  if (/\b(materiales|material|insumo|kit)\b/i.test(normalized)) return "quiero saber materiales";
  if (/\b(temario|contenido|modulo|modulos|ciclo)\b/i.test(normalized)) return "quiero saber el temario";
  if (/\b(inscripcion|inscribirme|admisiones|matricula|matricularme|pago)\b/i.test(normalized)) return "quiero saber como me inscribo";

  return "";
}

function enrichMessageWithFollowUpContext(
  userMessage: string,
  history: Array<{ user: string; agent: string }>
): string {
  if (!isShortAffirmativeReply(userMessage)) {
    return userMessage;
  }

  const pendingTopic = inferPendingTopicFromHistory(history);
  if (!pendingTopic) {
    return userMessage;
  }

  return `${userMessage}. ${pendingTopic}.`;
}

function hasRecentTodayClassContext(
  history: Array<{ user: string; agent: string }>
): boolean {
  const recent = history.slice(-3);
  return recent.some((turn) => isTodayClassQuestion(turn?.user || ""));
}

function isCourseActiveOnDate(course: any, date: Date): boolean {
  const dayDate = new Date(date);
  dayDate.setHours(0, 0, 0, 0);

  const start = course?.fecha_inicio ? new Date(course.fecha_inicio) : null;
  const end = course?.fecha_fin ? new Date(course.fecha_fin) : null;

  if (start && !Number.isNaN(start.getTime())) {
    start.setHours(0, 0, 0, 0);
    if (dayDate < start) return false;
  }

  if (end && !Number.isNaN(end.getTime())) {
    end.setHours(0, 0, 0, 0);
    if (dayDate > end) return false;
  }

  return true;
}

function scheduleIncludesDay(horario: string | null | undefined, dayIndex: number): boolean {
  const text = normalizeForMatch(horario || "");
  if (!text) return false;

  if (
    dayIndex >= 1 &&
    dayIndex <= 5 &&
    /\b(lunes\s*a\s*viernes|lunes\s*-\s*viernes|lun\s*a\s*vie|l\s*a\s*v|lv)\b/i.test(text)
  ) {
    return true;
  }

  const dayTokens: Record<number, string[]> = {
    0: ["domingo", "dom"],
    1: ["lunes", "lun"],
    2: ["martes", "mar"],
    3: ["miercoles", "mie", "mier"],
    4: ["jueves", "jue"],
    5: ["viernes", "vie"],
    6: ["sabado", "sab"],
  };

  return (dayTokens[dayIndex] || []).some((token) => new RegExp(`\\b${token}\\b`, "i").test(text));
}

function formatDateShort(value: string | null | undefined): string {
  if (!value) return "";
  let date: Date;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-").map(Number);
    const year = parts[0] || 0;
    const month = parts[1] || 0;
    const day = parts[2] || 0;
    date = new Date(year, month - 1, day, 12, 0, 0); // Mediodía
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "";
  
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

function formatDateLong(value: string | null | undefined): string {
  if (!value) return "";
  
  let date: Date;

  // Manejo robusto de fechas YYYY-MM-DD sin desfase horario
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-").map(Number);
    const year = parts[0] || 0;
    const month = parts[1] || 0;
    const day = parts[2] || 0;
    date = new Date(year, month - 1, day, 12, 0, 0); // Mediodía local para evitar cambios de día
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "";

  const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const dayName = DAYS[date.getDay()];
  const day = date.getDate();
  const monthName = MONTHS[date.getMonth()];
  
  return `${dayName}, ${day} de ${monthName}`;
}

function extractExplicitStudentName(message: string): string | null {
  const text = String(message || "").trim();
  if (!text) return null;

  const match = text.match(/\b(?:soy|me\s+llamo|mi\s+nombre\s+es)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})\b/i);
  if (!match?.[1]) return null;

  const rawName = match[1]
    .trim()
    .replace(/[^a-záéíóúñ\s]/gi, "")
    .replace(/\s+/g, " ");

  if (!rawName || rawName.length < 2) return null;
  return rawName
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function resolvePreferredStudentName(
  userMessage: string,
  history: Array<{ user: string; agent: string }>
): string | null {
  const current = extractExplicitStudentName(userMessage);
  if (current) return current;

  for (let i = history.length - 1; i >= 0; i--) {
    const fromHistory = extractExplicitStudentName(history[i]?.user || "");
    if (fromHistory) return fromHistory;
  }

  return null;
}

function buildNameSafetyDirective(preferredName: string | null): string {
  return preferredName
    ? `NOMBRE VALIDADO DEL USUARIO: "${preferredName}". Si lo mencionas, usa SOLO ese nombre exacto.`
    : 'No hay nombre validado del usuario. NO inventes ni asumas nombres propios; responde sin llamar por nombre.';
}

function buildUpcomingStartDirective(detectedProgram: any | null, courses: any[]): string {
  if (!detectedProgram) {
    return 'Para consultas de inicio, si no hay programa detectado pide una aclaración breve sin inventar fechas.';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedProgram = normalizeForMatch(detectedProgram.nombre || "");
  const relatedCourses = (courses || []).filter((course) => {
    const sameProgramId = course?.programa_id && Number(course.programa_id) === Number(detectedProgram.id);
    const sameProgramName = normalizeForMatch(course?.programa_nombre || "").includes(normalizedProgram);
    return Boolean(sameProgramId || sameProgramName);
  });

  const upcoming = relatedCourses
    .filter((course) => {
      if (!course?.fecha_inicio) return false;
      const start = new Date(course.fecha_inicio);
      if (Number.isNaN(start.getTime())) return false;
      start.setHours(0, 0, 0, 0);
      return start >= today;
    })
    .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

  if (!upcoming.length) {
    return `PROXIMO INICIO VALIDADO para ${detectedProgram.nombre}: no hay fecha futura confirmada. Si preguntan por próximo inicio, responde "Por confirmar".`;
  }

  const next = upcoming[0];
  return `PROXIMO INICIO VALIDADO para ${detectedProgram.nombre}: ${formatDateLong(next.fecha_inicio) || formatDateShort(next.fecha_inicio)} | Horario: ${next.horario || "Por confirmar"}. Nunca uses como "próximo" una fecha pasada.`;
}

function formatCurrencyCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function isDurationQuestion(message: string): boolean {
  const text = normalizeForMatch(message);
  return /\b(cuanto dura|duracion|duracion del curso|meses|cuantas clases|cuantas sesiones|tiempo del curso)\b/i.test(text);
}

function isClassFrequencyQuestion(message: string): boolean {
  const text = normalizeForMatch(message);
  return /\b(cada cuanto|cuantas veces|cada semana|semanal|que dias son clases|cada cuantos dias|con que frecuencia|las clases son cada)\b/i.test(text);
}

function isCertificationQuestion(message: string): boolean {
  const text = normalizeForMatch(message);
  return /\b(que titulo sale|con que titulo|titulo obtengo|que certificado|certificado|diploma|tecnico|tecnica|graduo|se gradua)\b/i.test(text);
}

function inferClassFrequencyFromSchedule(schedule: string): string {
  const text = normalizeForMatch(schedule || "");
  if (!text) return "con la frecuencia del grupo disponible";

  if (/\b(lunes\s*a\s*viernes|lunes\s*-\s*viernes|lun\s*a\s*vie|l\s*a\s*v|lv)\b/i.test(text)) {
    return "de lunes a viernes";
  }
  if (/\b(sabados\s+y\s*domingos|fin\s+de\s+semana|fines\s+de\s+semana)\b/i.test(text)) {
    return "los fines de semana";
  }

  const days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
    .filter((day) => new RegExp(`\\b${day}\\b`, "i").test(text));

  if (days.length === 1) return `una vez por semana (${days[0]})`;
  if (days.length > 1 && days.length <= 3) return `${days.length} veces por semana (${days.join(", ")})`;
  if (days.length > 3) return "varias veces por semana";

  return `según este horario: ${schedule}`;
}

function wasPromptAskedRecently(history: Array<{ user: string; agent: string }>, prompt: string): boolean {
  const normalizedPrompt = normalizeForMatch(prompt);
  if (!normalizedPrompt) return false;

  const recentAgentMessages = (Array.isArray(history) ? history : [])
    .slice(-2)
    .map((item) => String(item?.agent || ""));

  return recentAgentMessages.some((msg) => {
    const normalizedMsg = normalizeForMatch(msg);
    if (!normalizedMsg) return false;

    const wordsA = new Set(normalizedMsg.split(" ").filter(Boolean));
    const wordsB = new Set(normalizedPrompt.split(" ").filter(Boolean));
    if (!wordsA.size || !wordsB.size) return false;

    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection += 1;
    }
    const base = Math.min(wordsA.size, wordsB.size);
    const overlapRatio = base ? intersection / base : 0;

    return overlapRatio >= 0.82;
  });
}

function isFastTrackQuestion(message: string): boolean {
  const text = normalizeForMatch(message);
  return /\b(mas rapido|más rapido|rapido|rápido|perfeccionamiento|intensivo|avanzado|express|acelerado)\b/i.test(text);
}

function isLocationQuestion(message: string): boolean {
  const text = normalizeForMatch(message);
  if (/\b(como llego|como puedo llegar|como llegar|mandame la ubicacion|enviame la ubicacion|pasame la ubicacion|comparteme la ubicacion|mandame ubicacion|enviame ubicacion|pasame ubicacion|comparteme ubicacion|mapa|google maps|maps app|ubicacion exacta|link de ubicacion|enlace de ubicacion|referencia para llegar)\b/i.test(text)) {
    return true;
  }
  if (/\b(donde se ubican|donde estan|donde quedan|direccion|ubicacion|ubicados|sede|en cali donde)\b/i.test(text)) {
    return true;
  }

  if (/\b(estan en|son de|quedan en|ubicados en|sede en)\b/i.test(text) && !/\b(pago|pagar|inscrib|matricul|precio|cuanto|valor|mensualidad)\b/i.test(text)) {
    return true;
  }

  if (/\bdonde\b/i.test(text) && !/\b(pago|pagar|inscrib|matricul|precio|cuanto|valor|mensualidad)\b/i.test(text)) {
    return true;
  }

  return false;
}

function isThanksOnlyMessage(message: string): boolean {
  const text = normalizeForMatch(message);
  if (!text) return false;
  if (!/\b(gracias|agradezco|muy amable)\b/i.test(text)) return false;
  if (/\b(horario|precio|costo|donde|como|inscrib|matricul|temario|material|fecha|inicio|pago)\b/i.test(text)) return false;
  const words = text.split(" ").filter(Boolean);
  return words.length <= 6;
}

function isCourseInfoRequest(message: string): boolean {
  const text = normalizeForMatch(message);
  return /\b(informacion del curso|quiero informacion|quiero info|dame informacion|cuentame del curso|sobre el curso|curso de)\b/i.test(text);
}

function isPaymentMethodsOrDatesQuestion(message: string): boolean {
  const text = normalizeForMatch(message);
  const asksMethods = /\b(medios\s+de\s+pago|formas\s+de\s+pago|metodos?\s+de\s+pago|nequi|bancolombia|sistecredito|daviplata|tarjeta|efectivo|transferencia)\b/i.test(text);
  const asksDates = /\b(fecha\s+de\s+pago|fechas\s+de\s+pago|cuando\s+se\s+paga|cuando\s+debo\s+pagar|vence|vencimiento|plazo\s+de\s+pago|hasta\s+cuando\s+pago|segunda\s+clase)\b/i.test(text);
  const asksHowToPay = /\b(como\s+pago|donde\s+pago|por\s+que\s+medio\s+pago|aceptan\s+nequi|aceptan\s+tarjeta|puedo\s+pagar\s+por|debo\s+pagar\s+todo\s+de\s+una|todo\s+de\s+una|de\s+contado|de\s+una\s+vez|palazo)\b/i.test(text);
  const mentionsFinancing = /\b(mensualidad|matricula|inscripcion|cuota|financi|abono|sistecredito|sistecr[eé]dito|sistecridito)\b/i.test(text);
  const mentionsPaymentAction = /\b(pago|pagar|abonar|cuanto\s+se\s+paga|medio\s+de\s+pago|formas\s+de\s+pago|de\s+una\s+vez|contado)\b/i.test(text);
  const asksFinancing = mentionsFinancing && mentionsPaymentAction;
  return asksMethods || asksDates || asksHowToPay || asksFinancing;
}

function isStepOneSelection(message: string): boolean {
  const text = normalizeForMatch(message);
  return /^(1|uno|paso\s*1|primer\s*paso)$/.test(text);
}

function buildPaymentMethodsAndDatesReply(): string {
  return `¡Claro! Te explico 🙌\n\n✅ La *matrícula* se paga anticipada; es la manera de *separar cupo*.\n✅ La *mensualidad* tiene plazo hasta la *segunda clase*.\n✅ Con el pago de la mensualidad te entregamos *kit de materiales mensual* para tus prácticas.\n✅ También manejamos *Sistecrédito*.\n\nSi quieres, te explico qué opción te conviene más según cómo prefieras pagar.`;
}

function isKitPurchaseQuestion(message: string): boolean {
  const text = normalizeForMatch(message);

  const mentionsMaterials = /\b(kit|kits|implemento|implementos|herramienta|herramientas|material|materiales|insumo|insumos)\b/i.test(text);
  const asksBuying = /\b(comprar|compro|comprarlo|comprarlos|debo comprar|hay que comprar|toca comprar|necesito comprar|traer|poner)\b/i.test(text);
  const asksIfProvided = /\b(lo dan|me lo dan|ustedes dan|ustedes lo dan|incluye|incluyen|proporcionan|les dan|se los dan)\b/i.test(text);

  return mentionsMaterials && (asksBuying || asksIfProvided);
}

function hasProgramCorrectionSignal(message: string): boolean {
  const text = normalizeForMatch(message);
  return /\b(no es|no era|no hablo de|no me refiero|no estoy preguntando por|eso no es|ese no es|esa no es)\b/i.test(text);
}

function extractCorrectedProgramName(message: string): string | null {
  const raw = String(message || "").trim();
  if (!raw) return null;

  const patterns = [
    /(?:eso|ese|esa|esto)?\s*no\s+es\s+([a-záéíóúñ0-9\s]{3,60})/i,
    /no\s+me\s+refiero\s+a\s+([a-záéíóúñ0-9\s]{3,60})/i,
    /no\s+hablo\s+de\s+([a-záéíóúñ0-9\s]{3,60})/i,
    /no\s+estoy\s+preguntando\s+por\s+([a-záéíóúñ0-9\s]{3,60})/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match?.[1]) continue;

    const candidate = match[1]
      .replace(/[.,;:!?].*$/, "")
      .replace(/\s+/g, " ")
      .trim();

    if (candidate.length >= 3) {
      return candidate;
    }
  }

  return null;
}

function extractProgramInquiryTopic(message: string): string | null {
  const normalized = normalizeForMatch(message);
  if (!normalized) return null;

  const patterns = [
    /(?:aprender|ensenan|ensenan|ensena|dictan|dan|ofrecen|tienen|hay)\s+([a-z0-9\s]{3,40})/i,
    /(?:curso|programa)\s+de\s+([a-z0-9\s]{3,40})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;

    const candidate = match[1]
      .replace(/\b(aqui|aca|en\s+cali|por\s+favor|me\s+podrias|me\s+puedes|si|no)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (/\b(uniforme|kit|inscripcion|mensualidad|precio|costo|valor|pago|pagar|cuota|horario|fecha|inicio|disponible|disponibles|dia|dias|lunes|martes|miercoles|jueves|viernes|sabado|domingo|hoy|manana|ayer|semana)\b/i.test(candidate)) {
      continue;
    }

    // Excluir: "otros métodos", "otras técnicas", etc. — no son nombres de programas
    if (/^(otros?|otras?)\b/i.test(candidate)) continue;

    if (candidate.length >= 3) return candidate;
  }

  return null;
}

function findProgramMatchByTopic(topic: string, programs: any[]): any | null {
  const normalizedTopic = normalizeForMatch(topic);
  if (!normalizedTopic || !Array.isArray(programs) || !programs.length) return null;

  const topicWords = normalizedTopic.split(" ").filter((word) => word.length >= 4);

  for (const program of programs) {
    const programName = normalizeForMatch(program?.nombre || "");
    if (!programName) continue;

    if (programName.includes(normalizedTopic) || normalizedTopic.includes(programName)) {
      return program;
    }

    if (topicWords.some((word) => programName.includes(word))) {
      return program;
    }
  }

  return null;
}

function buildAvailableProgramsPrompt(programs: any[], limit: number = 3): string {
  const names = (programs || [])
    .map((program) => String(program?.nombre || "").trim())
    .filter(Boolean)
    .slice(0, limit);

  if (!names.length) return "";
  return `Por ahora te puedo orientar en: *${names.join("*, *")}*.`;
}

function extractTemarioHighlights(rawTemario: string, maxItems?: number): string[] {
  const text = String(rawTemario || "").trim();
  if (!text) return [];

  const segments = text
    .replace(/\r/g, "\n")
    .replace(/[•▪◦·]/g, "\n")
    .replace(/\s*\|\s*/g, "\n")
    .replace(/\s+-\s+/g, "\n")
    .split(/\n+/)
    .map((item) =>
      item
        .replace(/\*+/g, "")
        .replace(/\(\s*\d+\s*h(?:oras?)?\s*\)/gi, "")
        .replace(/\b\d+\s*h(?:oras?)?\b/gi, "")
        .replace(/\b\d+\s*horas?\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .replace(/^[\s:;,.\-–]+|[\s:;,.\-–]+$/g, "")
        .trim()
    )
    .filter((item) => item.length >= 4)
    .filter((item) => !/^contenido\s+detallado\s+por\s+ciclos?$/i.test(item));

  const classSegments = segments.filter((item) => /^(\d{1,2})\s*[.)-]\s+/.test(item) || /^clase\s*\d{1,2}\b/i.test(item));

  if (classSegments.length > 0) {
    const uniqueClasses: string[] = [];
    const seenClassNumbers = new Set<string>();

    for (const segment of classSegments) {
      const classMatch = segment.match(/^(\d{1,2})\s*[.)-]\s+/) || segment.match(/^clase\s*(\d{1,2})\b/i);
      const classNumber = classMatch?.[1] || normalizeForMatch(segment);
      if (!classNumber || seenClassNumbers.has(classNumber)) continue;

      seenClassNumbers.add(classNumber);
      uniqueClasses.push(segment);

      if (typeof maxItems === "number" && maxItems > 0 && uniqueClasses.length >= maxItems) break;
    }

    return uniqueClasses;
  }

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    if (/^mes\s+\d+\b/i.test(segment)) continue;
    if (/^temario\s+detallado/i.test(segment)) continue;

    const key = normalizeForMatch(segment);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(segment);
    if (typeof maxItems === "number" && maxItems > 0 && unique.length >= maxItems) break;
  }

  return unique;
}

function extractTemarioClassCount(rawTemario: string): number {
  const text = String(rawTemario || "");
  if (!text) return 0;

  const lines = text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/\*+/g, "")
        .replace(/^[\s•▪◦·\-–]+/, "")
        .trim()
    )
    .filter(Boolean);

  const numbers = new Set<string>();
  for (const line of lines) {
    const match = line.match(/^(\d{1,2})\s*[.)-]\s+/) || line.match(/^clase\s*(\d{1,2})\b/i);
    if (match?.[1]) {
      numbers.add(match[1]);
    }
  }

  return numbers.size;
}

function inferTemarioCyclesCount(rawTemario: string): number {
  const text = normalizeForMatch(rawTemario || "");
  if (!text) return 0;

  const monthMatches = text.match(/\bmes\s+\d+\b/g) || [];
  if (monthMatches.length > 0) {
    return new Set(monthMatches.map((m) => m.trim())).size;
  }

  const cycleMatches = text.match(/\bciclo\s+\d+\b/g) || [];
  return new Set(cycleMatches.map((m) => m.trim())).size;
}

function extractTemarioMonthSummaries(rawTemario: string, maxMonths: number = 6): string[] {
  const text = String(rawTemario || "");
  if (!text) return [];

  const lines = text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/\*+/g, "").trim())
    .filter(Boolean);

  const summaries: string[] = [];
  const seenMonths = new Set<string>();

  for (const line of lines) {
    const monthMatch = line.match(/^mes\s*(\d{1,2})\s*[:\-]?\s*(.*)$/i);
    if (!monthMatch?.[1]) continue;

    const monthNumber = monthMatch[1];
    if (seenMonths.has(monthNumber)) continue;
    seenMonths.add(monthNumber);

    const monthTopic = (monthMatch[2] || "")
      .replace(/^[-:–\s]+/, "")
      .trim();

    summaries.push(monthTopic ? `Mes ${monthNumber}: ${monthTopic}` : `Mes ${monthNumber}`);
    if (summaries.length >= maxMonths) break;
  }

  return summaries;
}

function extractRequestedTemarioMonth(message: string): number | null {
  const text = normalizeForMatch(message);
  if (!text) return null;

  const monthMatch = text.match(/\bmes\s*(\d{1,2})\b/i);
  if (!monthMatch?.[1]) return null;

  const month = Number(monthMatch[1]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return month;
}

function inferTemarioMonthFromAgentPrompt(lastAgentMessage: string): number | null {
  const text = normalizeForMatch(lastAgentMessage || "");
  if (!text) return null;

  const asksNextMonth = text.match(/\b(?:tambien\s+el|tambien\s+mes|el)\s+mes\s*(\d{1,2})\b/i);
  if (asksNextMonth?.[1]) {
    const month = Number(asksNextMonth[1]);
    if (Number.isFinite(month) && month >= 1 && month <= 12) return month;
  }

  return null;
}

function splitTemarioIntoClassItems(rawBlock: string, maxItems: number = 12): string[] {
  const source = String(rawBlock || "")
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^mes\s*\d{1,2}\s*[:\-]?\s*/i, "")
    .replace(/^temario\s+por\s+clases?\s*/i, "")
    .trim();

  if (!source) return [];

  let segments = source
    .replace(/\s*[•▪◦·|;]+\s*/g, "\n")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    segments = source
      .replace(/\s*(\p{Extended_Pictographic})\s*/gu, "\n$1 ")
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const uniqueItems: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    const cleaned = segment
      .replace(/^temario\s+por\s+clases?\s*/i, "")
      .replace(/^mes\s*\d{1,2}\s*[:\-]?\s*/i, "")
      .replace(/^[-–:,.]+\s*/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (cleaned.length < 4) continue;

    const key = normalizeForMatch(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push(cleaned);

    if (uniqueItems.length >= maxItems) break;
  }

  return uniqueItems;
}

function extractTemarioMonthBlocks(rawTemario: string): Array<{ month: number; classes: string[] }> {
  const text = String(rawTemario || "").replace(/\r/g, "\n");
  if (!text) return [];

  const blocks: Array<{ month: number; classes: string[] }> = [];
  const regex = /mes\s*(\d{1,2})\s*[:\-]?\s*([\s\S]*?)(?=(?:\bmes\s*\d{1,2}\s*[:\-]?)|$)/gi;
  const seenMonths = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const month = Number(match[1]);
    if (!Number.isFinite(month) || month < 1 || month > 12 || seenMonths.has(month)) continue;

    const classes = splitTemarioIntoClassItems(match[2] || "", 12);
    if (!classes.length) continue;

    seenMonths.add(month);
    blocks.push({ month, classes });
  }

  return blocks.sort((a, b) => a.month - b.month);
}

function normalizeTemarioMonthBlocks(
  detectedProgram: any,
  rawTemario: string
): Array<{ month: number; classes: string[] }> {
  const monthBlocks = extractTemarioMonthBlocks(rawTemario);
  if (!monthBlocks.length) return [];

  const totalClasesDB = Number(detectedProgram?.total_clases ?? 0);
  const duracionMeses = Number(detectedProgram?.duracion_meses ?? 0);

  const allClasses = monthBlocks.flatMap((block) => block.classes);
  const classes = totalClasesDB > 0 ? allClasses.slice(0, totalClasesDB) : allClasses;

  const monthsTarget = duracionMeses > 0 ? duracionMeses : monthBlocks.length;
  if (monthsTarget <= 0 || !classes.length) return monthBlocks;

  const basePerMonth = Math.floor(classes.length / monthsTarget);
  const remainder = classes.length % monthsTarget;

  const normalized: Array<{ month: number; classes: string[] }> = [];
  let cursor = 0;

  for (let month = 1; month <= monthsTarget; month++) {
    const count = basePerMonth + (month <= remainder ? 1 : 0);
    const monthClasses = classes.slice(cursor, cursor + count);
    cursor += count;
    if (monthClasses.length) {
      normalized.push({ month, classes: monthClasses });
    }
  }

  return normalized;
}

function buildTemarioDetailedListReply(
  detectedProgram: any,
  rawTemario: string,
  options: { monthNumber?: number } = {}
): string | null {
  const monthBlocks = normalizeTemarioMonthBlocks(detectedProgram, rawTemario);
  if (!monthBlocks.length) return null;

  const requestedMonth = options.monthNumber;
  if (requestedMonth && !monthBlocks.some((block) => block.month === requestedMonth)) {
    const availableMonths = monthBlocks.map((block) => `Mes ${block.month}`).join(", ");
    return `📚 *Temario de ${detectedProgram.nombre}*\n\nTengo detalle disponible para: *${availableMonths}*.\n\n¿Cuál mes quieres que te comparta primero?`;
  }

  const selectedBlock = requestedMonth
    ? monthBlocks.find((block) => block.month === requestedMonth)
    : monthBlocks[0];

  if (!selectedBlock) return null;

  // Numeración continua: contar clases reales de meses anteriores
  const startClassNumber = monthBlocks
    .filter((block) => block.month < selectedBlock.month)
    .reduce((acc, block) => acc + block.classes.length, 0) + 1;

  const classesLines = selectedBlock.classes
    .map((classItem, index) => {
      const cleanName = classItem
        .replace(/\p{Extended_Pictographic}/gu, "")
        .replace(/\s+\d+\.?\s*$/, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      return `• ${startClassNumber + index}. ${cleanName}`;
    })
    .join("\n");

  const nextBlock = monthBlocks.find((block) => block.month > selectedBlock.month);
  const followup = nextBlock
    ? `¿Quieres que te comparta también el *Mes ${nextBlock.month}*?`
    : "¿Quieres que te comparta también la *inversión*?";

  return `📚 *Temario detallado de ${detectedProgram.nombre}*

🗓️ *MES ${selectedBlock.month}*
${classesLines}

${followup}`;
}

function buildTemarioCompleteReply(
  detectedProgram: any,
  rawTemario: string
): string | null {
  const monthBlocks = normalizeTemarioMonthBlocks(detectedProgram, rawTemario);
  if (!monthBlocks.length) return null;

  const totalClasesDB = Number(detectedProgram?.total_clases ?? 0);
  const duracionMeses = Number(detectedProgram?.duracion_meses ?? 0);

  let classCounter = 1;
  let clasesShown = 0;
  const monthSections = monthBlocks
    .map((block) => {
      const remaining = totalClasesDB > 0 ? totalClasesDB - clasesShown : block.classes.length;
      if (remaining <= 0) return null;
      const classesToShow = block.classes.slice(0, remaining);
      if (!classesToShow.length) return null;

      const lines = classesToShow
        .map((classItem) => {
          const cleanName = classItem
            .replace(/\p{Extended_Pictographic}/gu, "")
            .replace(/\s+\d+\.?\s*$/, "")
            .replace(/\s{2,}/g, " ")
            .trim();
          clasesShown++;
          return `\u2022 ${classCounter++}. ${cleanName}`;
        })
        .join("\n");
      return `\ud83d\uddd3\ufe0f *MES ${block.month}*\n${lines}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const totalLabel = totalClasesDB > 0 ? totalClasesDB : classCounter - 1;
  const duracionLabel = duracionMeses > 0 ? `${duracionMeses} meses \u00b7 ` : "";

  return `\ud83d\udcda *Temario completo de ${detectedProgram.nombre}* (${duracionLabel}${totalLabel} clases)\n\n${monthSections}\n\n\ud83d\udccc ¿Te cuento *inversión* u *horarios*?`;
}

function buildSeparaCupoPaymentReply(
  detectedProgram: any,
  academy: any,
  courses: any[]
): string {
  const admissionsContact = academy?.whatsapp || "+57 301 203 8582";
  const nequiNumber = "3006402575";

  const primaryCourse = detectedProgram ? pickPrimaryCourseForProgram(detectedProgram, courses) : null;
  const inscripcion = Number(detectedProgram?.precio_inscripcion ?? primaryCourse?.precio_inscripcion ?? 0);
  const hasPrice = inscripcion > 0;
  const insText = hasPrice ? formatCurrencyCOP(inscripcion) : null;
  const programLabel = detectedProgram?.nombre ? ` en *${detectedProgram.nombre}*` : "";

  const direccion = String(academy?.direccion || "").trim();
  const mapsUrl = String(academy?.maps_url || "").trim();
  const locationRef = "*La Cosmetikera (segundo piso)*, oriente de Cali, cerca a la Panadería Pablos Pam";

  const montoLine = insText ? `• Monto: *${insText}*` : `• Monto: te lo confirma Admisiones al contactarte`;
  const pagoEfectivoLine = insText ? `• Paga *${insText}* en efectivo` : `• Pago en efectivo (valor exacto te lo confirma Admisiones)`;

  const presencialBlock = [
    `📍 *Ir a la sede:*`,
    direccion ? `• Dirección: *${direccion}*` : `• Ubicación: ${locationRef}`,
    mapsUrl ? `• 🗺️ Mapa: ${mapsUrl}` : "",
    pagoEfectivoLine,
    `• Envía el comprobante a Admisiones: *${admissionsContact}*`,
  ].filter(Boolean).join("\n");

  const intro = insText
    ? `¡Perfecto! 🙌 Para separar tu cupo${programLabel}, el pago de inscripción es de *${insText}*.`
    : `¡Perfecto! 🙌 Para separar tu cupo${programLabel}, el pago de inscripción te lo confirma nuestro equipo de Admisiones.`;

  return `${intro}

Puedes hacerlo de estas formas:

💜 *Por Nequi:*
• Número: *${nequiNumber}*
${montoLine}
• Envía el comprobante a Admisiones: *${admissionsContact}*

${presencialBlock}

✅ Una vez confirmemos tu pago, ¡queda reservado tu cupo!`;
}

function buildInstagramFollowup(academy: any | null): string {
  const ig = String(academy?.instagram || "").trim();
  const fb = String(academy?.facebook || "").trim();

  const links: string[] = [];
  if (ig) {
    links.push(`📸 Instagram: ${/^https?:\/\//i.test(ig) ? ig : `https://${ig}`}`);
  }
  if (fb) {
    links.push(`👤 Facebook: ${/^https?:\/\//i.test(fb) ? fb : `https://${fb}`}`);
  }

  if (!links.length) return "";
  return `\n\n📲 Si quieres más info, también te comparto nuestras redes:\n${links.join("\n")}`;
}

function pickPrimaryCourseForProgram(detectedProgram: any | null, courses: any[]): any | null {
  if (!courses?.length) return null;

  const normalizedProgram = normalizeForMatch(detectedProgram?.nombre || "");
  const relatedCourses = detectedProgram
    ? courses.filter((course) => {
        const sameProgramId = course?.programa_id && Number(course.programa_id) === Number(detectedProgram.id);
        const sameProgramName = normalizeForMatch(course?.programa_nombre || "").includes(normalizedProgram);
        return Boolean(sameProgramId || sameProgramName);
      })
    : [...courses];

  if (!relatedCourses.length) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const withDate = relatedCourses
    .filter((course) => course?.fecha_inicio && !Number.isNaN(new Date(course.fecha_inicio).getTime()))
    .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

  const upcoming = withDate.find((course) => {
    const start = new Date(course.fecha_inicio);
    start.setHours(0, 0, 0, 0);
    return start >= today;
  });

  return upcoming || withDate[0] || relatedCourses[0] || null;
}

function pickHumanToneSeed(message: string, history: Array<{ user: string; agent: string }>): number {
  const source = `${normalizeForMatch(message)}|${history?.length || 0}`;
  let acc = 0;
  for (let i = 0; i < source.length; i++) {
    acc = (acc + source.charCodeAt(i)) % 997;
  }
  return acc % 3;
}

function buildFastTrackHumanReply(
  message: string,
  history: Array<{ user: string; agent: string }>,
  detectedProgram: any,
  duration: string,
  nextStart: string,
  schedule: string
): string {
  const tone = pickHumanToneSeed(message, history);

  if (tone === 0) {
    return `¡Claro! Buena pregunta 🙌\n\nEl programa *${detectedProgram.nombre}* que estás viendo dura *${duration}*.\n\nSi te interesa algo más rápido tipo *perfeccionamiento/intensivo*, te confirmo la opción activa para darte el dato exacto.\n\n📅 Inicio actual: ${nextStart}\n🕓 Horario actual: ${schedule}\n\n¿Quieres que te confirme ya la alternativa más corta disponible?`;
  }

  if (tone === 1) {
    return `Súper válido lo que preguntas 👌\n\nHoy en *${detectedProgram.nombre}* la duración es de *${duration}*.\n\nSi prefieres algo más ágil (perfeccionamiento/intensivo), te lo reviso al instante para darte una opción real y vigente.\n\n📅 Inicio actual: ${nextStart}\n🕓 Horario actual: ${schedule}\n\n¿Te comparto ahora mismo la opción más rápida?`;
  }

  return `Perfecto, te entiendo 💯\n\nEl plan *${detectedProgram.nombre}* está en *${duration}*.\n\nPara una ruta más corta de *perfeccionamiento*, te confirmo la disponibilidad actual y así avanzamos sobre algo concreto.\n\n📅 Inicio actual: ${nextStart}\n🕓 Horario actual: ${schedule}\n\n¿Quieres que te pase de una la opción más corta?`;
}

function buildIntentFocusedDirectResponse(
  message: string,
  detectedProgram: any | null,
  courses: any[],
  academy: any | null,
  history: Array<{ user: string; agent: string }> = [],
  programs: any[] = []
): string | null {
  if (isThanksOnlyMessage(message)) {
    return `Con gusto 😊 Cuando quieras, te ayudo con lo que necesites del curso.${buildInstagramFollowup(academy)}`;
  }

  if (detectedProgram && isLikelyProgramOnlyReply(message) && !/[?¿]/.test(message)) {
    const pendingTopic = inferPendingTopicFromHistory(history);
    if (/dias\s+y\s+horario|horario|inicio|fecha/.test(normalizeForMatch(pendingTopic))) {
      const primaryCourse = pickPrimaryCourseForProgram(detectedProgram, courses);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const hasUpcomingStart = Boolean(
        primaryCourse?.fecha_inicio &&
          !Number.isNaN(new Date(primaryCourse.fecha_inicio).getTime()) &&
          new Date(primaryCourse.fecha_inicio).setHours(0, 0, 0, 0) >= today.getTime()
      );
      const nextStart = hasUpcomingStart ? formatDateLong(primaryCourse?.fecha_inicio) || formatDateShort(primaryCourse?.fecha_inicio) : "Por confirmar";
      const schedule = primaryCourse?.horario || "Por confirmar";
      return `Perfecto 👌 Te confirmo *${detectedProgram.nombre}*:\n📅 *Próximo inicio:* ${nextStart}\n🕓 *Horario:* ${schedule}\n\n¿Quieres que sigamos con la *inversión* o con *inscripción*?`;
    }

    return `Perfecto 👌 Te refieres a *${detectedProgram.nombre}*.\n\nPara ayudarte mejor, ¿prefieres que empecemos por *horarios*, *inversión* o *inscripción*?`;
  }

  let intent = detectUserIntent(message);
  const normalizedMessage = normalizeForMatch(message);
  const lastAgentForFlow = history[history.length - 1]?.agent || "";
  if (isClosureAcknowledgement(message, lastAgentForFlow)) {
    return "Perfecto 😊 Quedo atenta. Nos vemos en la fecha acordada y, si necesitas algo antes, me escribes por aquí.";
  }
  const asksDuration = isDurationQuestion(message);
  const asksFastTrack = isFastTrackQuestion(message);
  let asksLocation = isLocationQuestion(message);
  const asksGeneralInfo = isCourseInfoRequest(message);
  const asksClassFrequency = isClassFrequencyQuestion(message);
  const asksCertification = isCertificationQuestion(message);
  const asksPaymentMethodsOrDates = isPaymentMethodsOrDatesQuestion(message);
  const asksStepOne = isStepOneSelection(message);
  const asksPrice = /\b(precio|cuanto|costo|valor|inscripcion|mensualidad|inversion)\b/i.test(normalizedMessage);
  const requestedTemarioMonth = extractRequestedTemarioMonth(message);
  const inferredTemarioMonthFromFlow = inferTemarioMonthFromAgentPrompt(lastAgentForFlow);
  const asksTemarioByClass = /\b(clase\s+por\s+clase|por\s+clase|temario\s+detallado|detalle\s+por\s+clase)\b/i.test(normalizedMessage);
  const asksCompleteTemario = new RegExp(
    [
      "\\b(?:",
      "temario|pensum|p[eé]nsum|plan\\s+de\\s+estudios|plan\\s+acad[eé]mico|syll?abus|m[oó]dulos|malla\\s+curricular|",
      "contenido(s)?\\s+(del|de\\s+(el|la))\\s+(curso|programa|ciclo)|",
      "listado\\s+(de\\s+(las?\\s+)?)?clases?|",
      "lista(do)?\\s+(completa?\\s+)?(de\\s+(las?\\s+)?)?clases?|",
      "clases?\\s+(del|de\\s+(el|la))\\s+(programa|curso|ciclo)|",
      "clases?\\s+mes\\s+por\\s+mes|",
      "todas?\\s+las\\s+clases?|",
      "(dame|env[ií]a(me)?|comp[áa]rte(me)?|manda(me)?|pasa(me)?)\\s+(por\\s+favor\\s+)?(el|la|las|los)?\\s*(lista(do)?|temario|pensum|clases?|contenido)|",
      "que\\s+(se\\s+ve(n)?|vemos|van\\s+a\\s+ver|veremos|vamos\\s+a\\s+ver|ense[ñn]an?|aprendo|aprender[eé](s|mos)?|incluye(n)?|cubre(n)?)\\s+(en\\s+(el\\s+)?)?(curso|programa|ciclo|clases?)?|",
      "que\\s+temas?\\s+(se\\s+)?(ense[ñn]an?|ven?|cubren?|incluyen?|tienen?|hay|tratan?)|",
      "que\\s+aprend(e|o|emos|er[eé]s?)(mos)?|",
      "que\\s+incluye\\s+(el\\s+)?(curso|programa|ciclo)|",
      "ver\\s+(todo(s)?\\s+)?(el\\s+)?(temario|contenido|clases?)|",
      "todo(s)?\\s+(el|los)\\s+(temario|contenido|clases?|m[oó]dulos?)|",
      "temario\\s+(completo|entero|del\\s+curso|del\\s+programa)|",
      "clases\\s+clase\\s+por\\s+clase",
      ")\\b",
    ].join(""),
    "i"
  ).test(normalizedMessage);
  const askedTemarioByClassBefore = /\b(quieres\s+que\s+te\s+lo\s+envie\s+tambien\s+clase\s+por\s+clase|clase\s+por\s+clase)\b/i.test(normalizeForMatch(lastAgentForFlow));
  const hasRecentTemarioFlow = /\b(temario|clase\s+por\s+clase|mes\s+\d{1,2})\b/i.test(normalizeForMatch(lastAgentForFlow));

  if (intent === "general" && isShortAffirmativeReply(message) && history.length > 0) {
    const pendingTopic = inferPendingTopicFromHistory(history);
    if (pendingTopic) {
      const inferredIntent = detectUserIntent(pendingTopic);
      if (inferredIntent !== "general") {
        intent = inferredIntent;
      }
      if (!asksLocation && isLocationQuestion(pendingTopic)) {
        asksLocation = true;
      }
    }
  }

  const inferredPendingTopic = inferPendingTopicFromHistory(history);
  const confirmsPaymentInfo = isShortAffirmativeReply(message)
    && /\b(medios\s+de\s+pago|formas\s+de\s+pago|fechas\s+de\s+pago|metodo\s+de\s+pago)\b/i.test(inferredPendingTopic);

  if (asksPaymentMethodsOrDates || confirmsPaymentInfo) {
    return buildPaymentMethodsAndDatesReply();
  }

  const confirmsStepOneFlow = asksStepOne
    && /\b(para\s+inscribirte|seguimos\s+este\s+orden|paso\s+1|confirmar\s+el\s+grupo\s+y\s+horario)\b/i.test(normalizeForMatch(lastAgentForFlow));

  if (confirmsStepOneFlow) {
    if (detectedProgram) {
      const primaryCourse = pickPrimaryCourseForProgram(detectedProgram, courses);
      const schedule = primaryCourse?.horario || "Por confirmar";
      return `¡Excelente! Vamos con el *paso 1* ✅\n\nPara *${detectedProgram.nombre}*, el horario registrado es: *${schedule}*.\n\n¿Te funciona ese grupo o prefieres que te muestre otra opción?`;
    }

    return "¡Excelente! Vamos con el *paso 1* ✅\n\nPara avanzar, confirmemos el *curso* y el *horario* que mejor te funcione. ¿Cuál curso deseas separar?";
  }
  const confirmsReserveFlow = isShortAffirmativeReply(message)
    && /\b(te reservo( un)? cupo|reservo( tu|el)? cupo|reservar tu cupo|te ayudo a reservar|separar cupo)\b/i.test(normalizeForMatch(lastAgentForFlow));

  const confirmsReserveFlowFromContext = /\b(inscribirme|separar\s+cupo|reservar\s+cupo|quiero\s+reservar)\b/i.test(normalizedMessage)
    && /\b(te reservo( un)? cupo|reservo( tu|el)? cupo|reservar tu cupo|te ayudo a reservar|separar cupo)\b/i.test(normalizeForMatch(lastAgentForFlow));

  if (confirmsReserveFlow || confirmsReserveFlowFromContext) {
    return buildSeparaCupoPaymentReply(detectedProgram, academy, courses);
  }

  if (intent === "inscripcion") {
    return buildSeparaCupoPaymentReply(detectedProgram, academy, courses);
  }

  if (asksLocation) {
    const locationReference = "Estamos ubicados en el *oriente de Cali*, cerca a la *Panadería Pablos Pam*, en *La Cosmetikera (segundo piso)*.";
    if (academy?.direccion) {
      if (academy?.maps_url) {
        return `¡Claro! 📍

${locationReference}
\nDirección: *${academy.direccion}*.
🗺️ Te comparto el mapa para que llegues fácil: ${academy.maps_url}

Si quieres, también te envío una referencia rápida para llegar 😊`;
      }
      return `¡Claro! 📍

${locationReference}
\nDirección: *${academy.direccion}*.

Si quieres, te comparto una referencia rápida para llegar más fácil 😊`;
    }
    return `¡Claro! 😊\n\n${locationReference}\n\nEnseguida te comparto la ubicación exacta por aquí.\n\nSi prefieres, también te envío el WhatsApp de admisiones para guiarte paso a paso.`;
  }

  const asksKitPurchase = isKitPurchaseQuestion(message);
  const asksMorningSchedule = /\b(manana|manana\s+temprano|por\s+la\s+manana|en\s+la\s+manana)\b/i.test(normalizedMessage)
    && /\b(horario|hora|grupo|noche|tarde|pm|solo|unico|4|7)\b/i.test(normalizedMessage);

  if (asksPrice && asksLocation) {
    const locationReference = "Estamos ubicados en el *oriente de Cali*, cerca a la *Panadería Pablos Pam*, en *La Cosmetikera (segundo piso)*.";
    const primaryCourse = detectedProgram ? pickPrimaryCourseForProgram(detectedProgram, courses) : null;
    const inscripcion = Number(detectedProgram?.precio_inscripcion ?? primaryCourse?.precio_inscripcion ?? 0);
    const mensualidad = Number(detectedProgram?.precio_mensualidad ?? primaryCourse?.precio_mensualidad ?? 0);
    const insText = inscripcion > 0 ? formatCurrencyCOP(inscripcion) : "Por confirmar";
    const menText = mensualidad > 0 ? formatCurrencyCOP(mensualidad) : "Por confirmar";

    const priceBlock = detectedProgram
      ? `💸 *${detectedProgram.nombre}*\n• Inscripción: *${insText}*\n• Mensualidad: *${menText}*`
      : `💸 *Precio:* te confirmo inscripción y mensualidad exactas según el curso que elijas.`;

    const mapsBlock = academy?.maps_url ? `\n🗺️ Mapa: ${academy.maps_url}` : "";
    const addressBlock = academy?.direccion ? `\nDirección: *${academy.direccion}*.` : "";

    return `¡Claro! Te respondo ambas de una 🙌\n\n${priceBlock}\n\n📍 ${locationReference}${addressBlock}${mapsBlock}\n\nSi quieres, te ayudo a elegir el horario que mejor te quede.`;
  }

  if (asksKitPurchase) {
    const programLabel = detectedProgram?.nombre ? ` para *${detectedProgram.nombre}*` : "";
    return `¡Buena pregunta! 👌\n\n✅ Sí, te damos *kit mensual de productos*${programLabel}.\n🧰 Sobre implementos/herramientas: no necesitas comprar todo de una; se maneja según clase y avance.\n\nSi quieres, te comparto la lista exacta de lo que ponemos nosotros y lo que podrías traer en el primer mes.`;
  }

  if (asksMorningSchedule) {
    if (!detectedProgram) {
      return "¡Te entiendo totalmente! 🙌 Si buscas *jornada de mañana* y no te funciona noche, te ayudo a revisarlo exacto.\n\nCompárteme el *curso* que te interesa y te confirmo si hay grupo en la mañana o la próxima apertura disponible.";
    }

    const morningCourse = pickPrimaryCourseForProgram(detectedProgram, courses);
    const currentSchedule = morningCourse?.horario || "Por confirmar";
    const nextStart = morningCourse?.fecha_inicio ? (formatDateLong(morningCourse.fecha_inicio) || formatDateShort(morningCourse.fecha_inicio)) : "Por confirmar";

    return `¡Claro! Gracias por contarlo 🙌\n\nSi buscas *jornada de mañana*, te confirmo lo que tengo activo para *${detectedProgram.nombre}*:\n📅 *Próximo inicio:* ${nextStart}\n🕓 *Horario registrado:* ${currentSchedule}\n\nSi ese horario no te funciona, te reviso ahora mismo si hay opción en mañana o próximo grupo. ¿Te lo confirmo?`;
  }

  const asksScheduleIntent = /\b(horario|horarios|hora|dias|dia|fecha|inicio|cuando inicia)\b/i.test(normalizedMessage);
  const asksEnrollmentIntent = /\b(inscripcion|inscribirme|inscrib|matricula|matricular|separar cupo|reservar cupo|admision)\b/i.test(normalizedMessage);
  if (asksScheduleIntent && asksEnrollmentIntent && detectedProgram) {
    const primaryCourse = pickPrimaryCourseForProgram(detectedProgram, courses);
    const nextStart = primaryCourse?.fecha_inicio ? (formatDateLong(primaryCourse.fecha_inicio) || formatDateShort(primaryCourse.fecha_inicio)) : "Por confirmar";
    const schedule = primaryCourse?.horario || "Por confirmar";

    return `Perfecto 🙌 Te respondo ambas para *${detectedProgram.nombre}*:\n\n📅 *Próximo inicio:* ${nextStart}\n🕓 *Horario:* ${schedule}\n\n📝 *Inscripción:* se separa cupo con el pago de matrícula y te guiamos paso a paso con el comprobante.\n\n¿Quieres que te pase ahora los *pasos exactos* para reservar?`;
  }

  // Detectar: "además de acrílico enseñan otros métodos/técnicas" → mostrar highlights del temario
  const asksOtherTechniques =
    /\b(ademas\s+de|aparte\s+de|mas\s+alla\s+de)\b/i.test(normalizedMessage) &&
    /\b(ensena[nr]?|dictan?|dan|tienen|ofrecen|aprend[eo])\b/i.test(normalizedMessage) &&
    /\b(otros?\s*(metodos?|tecnicas?|cursos?|temas?|cosas?)|mas\s*(metodos?|tecnicas?|temas?))/i.test(normalizedMessage);

  if (asksOtherTechniques) {
    const programsToHighlight = detectedProgram ? [detectedProgram] : programs.slice(0, 2);
    const sections: string[] = [];
    for (const prog of programsToHighlight) {
      const highlights = extractTemarioHighlights(prog.contenido || "", 6);
      if (highlights.length) {
        const cleanHighlights = highlights.map((h) =>
          h.replace(/^\d+[.)\-\s]+/, "").replace(/\p{Extended_Pictographic}/gu, "").trim()
        );
        sections.push(
          `*${prog.nombre}* (${prog.total_clases || "?"}  clases · ${prog.duracion_meses || "?"}  meses):\n` +
          cleanHighlights.map((h) => `• ${h}`).join("\n")
        );
      }
    }
    if (sections.length) {
      return (
        `¡Sí! Enseñamos mucho más que acrílico 💅\n\n` +
        sections.join("\n\n") +
        `\n\n¿Quieres que te comparta el *temario completo* o te cuento sobre fechas e inversión?`
      );
    }
  }

  const requestedTopic = extractProgramInquiryTopic(message);
  if (requestedTopic) {
    const matchedProgram = findProgramMatchByTopic(requestedTopic, programs);
    if (!matchedProgram) {
      const alternatives = buildAvailableProgramsPrompt(programs);
      return `¡Gracias por tu pregunta! 🙌\n\nEn este momento no tengo *${requestedTopic}* dentro de los programas activos.${alternatives ? `\n\n${alternatives}` : ""}\n\nSi quieres, te ayudo a elegir la opción más parecida a lo que buscas.`;
    }
  }

  if (!detectedProgram) {
    const correctedProgram = extractCorrectedProgramName(message);
    if (correctedProgram) {
      return `Entiendo, buscas *${correctedProgram}*. Gracias por corregirme 🙏\n\nAhora mismo no lo tengo identificado en los programas cargados. ¿Quieres que te comparta las opciones disponibles para elegir la correcta?`;
    }

    if (asksGeneralInfo) {
      const fallbackCourse = courses?.[0];
      const fallbackName = fallbackCourse?.programa_nombre || fallbackCourse?.nombre || "nuestros cursos de belleza";
      return `✨ *${fallbackName}*\n\nTe comparto la información clave al instante. ¿Prefieres que empecemos por *precio* o por *próximo inicio*?`;
    }
    if (intent === "temario") {
      return "¡Claro! Te comparto el temario en versión resumida. ¿De cuál curso quieres el contenido exacto?";
    }
    if (asksDuration || intent === "precio" || intent === "horario") {
      return "¡Claro! Te ayudo con eso. ¿De cuál curso quieres el dato exacto?";
    }
    return null;
  }

  const rawTemario = detectedProgram?.contenido || "";

  if (asksCompleteTemario) {
    const completeReply = buildTemarioCompleteReply(detectedProgram, rawTemario);
    if (completeReply) return completeReply;
  }

  const agentOfferedNextTemarioMonth = inferredTemarioMonthFromFlow !== null;
  const shouldSendDetailedTemario = Boolean(
    asksTemarioByClass
    || (isShortAffirmativeReply(message) && askedTemarioByClassBefore)
    || (isShortAffirmativeReply(message) && agentOfferedNextTemarioMonth)
    || (requestedTemarioMonth !== null && hasRecentTemarioFlow)
  );

  const targetTemarioMonth = requestedTemarioMonth
    ?? (isShortAffirmativeReply(message) && agentOfferedNextTemarioMonth ? inferredTemarioMonthFromFlow : null)
    ?? ((isShortAffirmativeReply(message) && askedTemarioByClassBefore) ? inferredTemarioMonthFromFlow : null);

  if (shouldSendDetailedTemario) {
    const detailedTemarioReply = buildTemarioDetailedListReply(detectedProgram, rawTemario, {
      monthNumber: targetTemarioMonth || undefined,
    });
    if (detailedTemarioReply) {
      return detailedTemarioReply;
    }
  }

  const primaryCourse = pickPrimaryCourseForProgram(detectedProgram, courses);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasUpcomingStart = Boolean(
    primaryCourse?.fecha_inicio &&
      !Number.isNaN(new Date(primaryCourse.fecha_inicio).getTime()) &&
      new Date(primaryCourse.fecha_inicio).setHours(0, 0, 0, 0) >= today.getTime()
  );

  if (asksFastTrack) {
    const duration = detectedProgram?.duracion || (detectedProgram?.duracion_horas ? `${detectedProgram.duracion_horas} horas` : "duración por confirmar");
    const nextStart = hasUpcomingStart ? formatDateLong(primaryCourse?.fecha_inicio) || formatDateShort(primaryCourse?.fecha_inicio) : "Por confirmar";
    const schedule = primaryCourse?.horario || "Por confirmar";

    return buildFastTrackHumanReply(message, history, detectedProgram, duration, nextStart, schedule);
  }

  if (asksDuration) {
    const duration = detectedProgram?.duracion || (detectedProgram?.duracion_horas ? `${detectedProgram.duracion_horas} horas` : null);
    const totalClasses = detectedProgram?.total_clases ? `${detectedProgram.total_clases} clases` : null;
    const nextStart = hasUpcomingStart ? formatDateLong(primaryCourse?.fecha_inicio) || formatDateShort(primaryCourse?.fecha_inicio) : "Por confirmar";
    const schedule = primaryCourse?.horario || "Por confirmar";

    return `📚 *${detectedProgram.nombre}*\n\n⏳ *Duración:* ${duration || "el tiempo definido en el plan académico"}${totalClasses ? ` (${totalClasses})` : ""}\n📅 *Próximo inicio:* ${nextStart}\n🕓 *Horario:* ${schedule}\n\n¿Quieres que te comparta ahora la *inversión*?`;
  }

  if (asksClassFrequency) {
    const schedule = primaryCourse?.horario || "Por confirmar";
    const nextStart = hasUpcomingStart ? formatDateLong(primaryCourse?.fecha_inicio) || formatDateShort(primaryCourse?.fecha_inicio) : "Por confirmar";
    const frequency = inferClassFrequencyFromSchedule(schedule);

    return `✅ Para *${detectedProgram.nombre}*, las clases son *${frequency}*.\n📅 *Próximo inicio:* ${nextStart}\n🕓 *Horario actual:* ${schedule}\n\n¿Quieres que te comparta también la *inversión*?`;
  }

  if (asksCertification) {
    return `🎓 Al finalizar *${detectedProgram.nombre}* recibes *certificado* emitido por la academia.\n\nSi quieres, también te confirmo duración, horarios y proceso de inscripción.`;
  }

  if (asksGeneralInfo || intent === "general") {
    const duration = detectedProgram?.duracion || (detectedProgram?.duracion_horas ? `${detectedProgram.duracion_horas} horas` : "duración según plan académico");
    const nextStart = hasUpcomingStart ? formatDateLong(primaryCourse?.fecha_inicio) || formatDateShort(primaryCourse?.fecha_inicio) : "Por confirmar";
    const schedule = primaryCourse?.horario || "Por confirmar";

    return `✨ *${detectedProgram.nombre}*\n\n✅ Formación práctica desde cero\n⏳ *Duración:* ${duration}\n📅 *Próximo inicio:* ${nextStart}\n🕓 *Horario:* ${schedule}\n\n¿Quieres conocer el precio de la inscripción y mensualidad?`;
  }

  if (intent === "temario") {
    const highlights = extractTemarioHighlights(rawTemario, 10);
    if (highlights.length > 0) {
      const explicitClasses = Number(detectedProgram?.total_clases ?? 0);
      const inferredClasses = extractTemarioClassCount(rawTemario);
      const totalClasses = explicitClasses > 0 ? explicitClasses : (inferredClasses > 0 ? inferredClasses : highlights.length);
      const monthSummaries = extractTemarioMonthSummaries(rawTemario, 6);
      const isLongTemario = totalClasses >= 12 || highlights.length >= 10;

      const explicitCycles = Number(detectedProgram?.total_ciclos ?? detectedProgram?.ciclos ?? 0);
      const inferredCycles = inferTemarioCyclesCount(rawTemario);
      const totalCycles = explicitCycles > 0 ? explicitCycles : inferredCycles;

      const summaryLine = totalCycles > 0
        ? `🧩 Este programa tiene *${totalCycles} ciclos* y *${totalClasses} clases*.`
        : `🧩 Este programa tiene *${totalClasses} clases* en su ruta formativa.`;

      const lines = highlights.map((item, index) => {
        const classNumberMatch = item.match(/^(\d{1,2})\s*[.)-]\s+/) || item.match(/^clase\s*(\d{1,2})\b/i);
        const classNumber = classNumberMatch?.[1] || String(index + 1);
        const cleanItem = item
          .replace(/^(\d{1,2})\s*[.)-]\s+/, "")
          .replace(/^clase\s*\d{1,2}\s*[:.-]?\s*/i, "")
          .trim();
        return `🔹 *Clase ${classNumber}:* ${cleanItem}`;
      }).join("\n");

      if (isLongTemario && monthSummaries.length > 0) {
        const monthLines = monthSummaries.map((item) => `🔹 *${item}*`).join("\n");
        return `📚 *Temario de ${detectedProgram.nombre}*\n\n${summaryLine}\n✨ Para que sea más claro, te lo resumo por meses:\n${monthLines}\n\n¿Quieres que te lo envíe también *clase por clase*?`;
      }

      return `📚 *Temario de ${detectedProgram.nombre}*\n\n${summaryLine}\n✨ Trataremos:\n${lines}\n\n💸 ¿Quieres conocer el precio de la inscripción y mensualidad?`;
    }

    return `📚 *Temario de ${detectedProgram.nombre}*\n\nTe comparto el contenido por *ciclos* de forma breve para que sea fácil de leer.\n\n¿Quieres conocer el precio de la inscripción y mensualidad?`;
  }

  if (intent === "precio") {
    const inscripcion = Number(detectedProgram?.precio_inscripcion ?? primaryCourse?.precio_inscripcion ?? 0);
    const mensualidad = Number(detectedProgram?.precio_mensualidad ?? primaryCourse?.precio_mensualidad ?? 0);
    const insText = inscripcion > 0 ? formatCurrencyCOP(inscripcion) : "Por confirmar";
    const menText = mensualidad > 0 ? formatCurrencyCOP(mensualidad) : "Por confirmar";

    const inscriptionIncludes = "Incluye: Camiseta, Certificado, Ceremonia de grado y alquiler de toga";
    const monthlyIncludes = "Incluye: Cada mes te damos kit de productos";

    const normalizedMessage = normalizeForMatch(message);
    const asksMonthlyConfirmation = /\b(cada mes|se paga|al mes|mensualidad|mensual)\b/i.test(normalizedMessage);
    const asksTotalToPay = /\b(por\s+todo|total|todo\s+junto|de\s+una\s+vez|de\s+una|completo|todo\s+el\s+curso)\b/i.test(normalizedMessage)
      && /\b(cuanto|cuanto\s+es|pagar|pago|se\s+paga|vale|valor|costo)\b/i.test(normalizedMessage);
    const asksPartialPayment = /\b(abono|abonar|pago parcial|cuota inicial|fraccionar|financiar|totalidad|pagar todo|pagar completo|de una)\b/i.test(normalizedMessage)
      && /\b(inscripcion|inscrip|curso|total)\b/i.test(normalizedMessage);

    if (asksMonthlyConfirmation) {
      return `✅ Sí, la *mensualidad* es ${menText}.\n🧴 *Cada mes te damos kit de productos.*\n\n¿Quieres que te comparta también los *medios de pago* y las *fechas de pago*?`;
    }

    if (asksTotalToPay) {
      const totalInicio = (inscripcion > 0 && mensualidad > 0)
        ? formatCurrencyCOP(inscripcion + mensualidad)
        : "Por confirmar";

      return `💸 Si pagas para iniciar con todo listo, sería:\n• *Inscripción:* ${insText}\n• *Mensualidad:* ${menText}\n• *Total inicial (inscripción + mensualidad):* ${totalInicio}\n\n✅ *Lo ideal* es pagar inscripción y mensualidad de una, porque con la mensualidad te entregamos el *kit de productos* para usar en clases.\n\nSi no te queda fácil, puedes pagar la mensualidad *hasta la segunda clase*, que es cuando se empiezan a usar los productos.`;
    }

    if (asksPartialPayment) {
      return `Buena pregunta 👌\n\n✅ *Lo ideal* es pagar *inscripción y mensualidad de una*, porque con la mensualidad te entregamos el *kit de productos* para usar en clases.\n\nSi no te queda fácil, puedes pagar la mensualidad *hasta la segunda clase* (ahí se empiezan a usar los productos).\n\nPara iniciar hoy, se maneja:\n💰 *Inscripción:* ${insText}\n💰 *Mensualidad:* ${menText}`;
    }

    const recentConversationText = (Array.isArray(history) ? history : [])
      .slice(-4)
      .map((item) => `${item?.user || ""} ${item?.agent || ""}`)
      .join(" ");
    const normalizedHistory = normalizeForMatch(recentConversationText);
    const lastAgentMessage = Array.isArray(history) && history.length > 0 ? history[history.length - 1]?.agent || "" : "";
    const normalizedLastAgent = normalizeForMatch(lastAgentMessage);

    const asksEnrollmentProcess = /\b(inscrib|inscrip|matricul|cupo|separar|reservar)\b/i.test(normalizedMessage);
    const asksPaymentMethods = /\b(pago|pagos|cuota|cuotas|tarjeta|efectivo|transferencia|nequi|daviplata|financi)\b/i.test(normalizedMessage);
    const asksDateOrSchedule = /\b(fecha|inicio|horario|hora|dias|días)\b/i.test(normalizedMessage);

    const historyMentionsEnrollment = /\b(inscrib|inscrip|matricul|cupo|separar|reservar)\b/i.test(normalizedHistory);
    const historyMentionsPayment = /\b(pago|pagos|cuota|cuotas|tarjeta|efectivo|transferencia|nequi|daviplata|financi)\b/i.test(normalizedHistory);
    const historyMentionsDateOrSchedule = /\b(fecha|inicio|horario|hora|dias|días)\b/i.test(normalizedHistory);

    const lastAgentAskedEnrollment = /\b(inscrib|inscrip|matricul|cupo|separar|reservar)\b/i.test(normalizedLastAgent);
    const lastAgentAskedPayment = /\b(pago|pagos|cuota|cuotas|tarjeta|efectivo|transferencia|nequi|daviplata|financi)\b/i.test(normalizedLastAgent);
    const lastAgentAskedDateOrSchedule = /\b(fecha|inicio|horario|hora|dias|días)\b/i.test(normalizedLastAgent);

    let nextStepType: "payment" | "enrollment" | "date" = "payment";

    let nextStepPrompt = "💳 ¿Prefieres que te comparta *formas de pago* o *cómo inscribirte*?";
    if (asksEnrollmentProcess || historyMentionsEnrollment) {
      nextStepPrompt = historyMentionsPayment
        ? "📅 ¿Quieres que te confirme también la *fecha de inicio* y *horario* disponible?"
        : "✅ ¿Quieres que te confirme los *medios de pago* y las *fechas de pago*?";
      nextStepType = historyMentionsPayment ? "date" : "payment";
    } else if (asksPaymentMethods || historyMentionsPayment) {
      nextStepPrompt = historyMentionsEnrollment
        ? "📅 ¿Quieres que te comparta también *fecha de inicio* y *horario*?"
        : "📝 ¿Quieres que te comparta los *pasos de inscripción* y cómo *separar cupo*?";
      nextStepType = historyMentionsEnrollment ? "date" : "enrollment";
    } else if (asksDateOrSchedule || historyMentionsDateOrSchedule) {
      nextStepPrompt = historyMentionsPayment
        ? "📝 ¿Quieres que te comparta los *pasos de inscripción* y cómo *separar cupo*?"
        : "✅ ¿Quieres que te confirme los *medios de pago* y las *fechas de pago*?";
      nextStepType = historyMentionsPayment ? "enrollment" : "payment";
    } else if (!historyMentionsPayment) {
      nextStepPrompt = "✅ ¿Quieres que te confirme los *medios de pago* y las *fechas de pago*?";
      nextStepType = "payment";
    } else if (!historyMentionsEnrollment) {
      nextStepPrompt = "📝 ¿Quieres que te comparta los *pasos de inscripción* y cómo *separar cupo*?";
      nextStepType = "enrollment";
    } else {
      nextStepPrompt = "📅 ¿Quieres que te confirme también la *fecha de inicio* y *horario* disponible?";
      nextStepType = "date";
    }

    if ((nextStepType === "payment" && lastAgentAskedPayment) || (nextStepType === "enrollment" && lastAgentAskedEnrollment) || (nextStepType === "date" && lastAgentAskedDateOrSchedule)) {
      if (nextStepType !== "payment" && !lastAgentAskedPayment) {
        nextStepPrompt = "✅ ¿Quieres que te confirme los *medios de pago* y las *fechas de pago*?";
      } else if (nextStepType !== "enrollment" && !lastAgentAskedEnrollment) {
        nextStepPrompt = "📝 ¿Quieres que te comparta los *pasos de inscripción* y cómo *separar cupo*?";
      } else if (nextStepType !== "date" && !lastAgentAskedDateOrSchedule) {
        nextStepPrompt = "📅 ¿Quieres que te confirme también la *fecha de inicio* y *horario* disponible?";
      }
    }

    const promptCandidates = [
      "✅ ¿Quieres que te confirme los *medios de pago* y las *fechas de pago*?",
      "📝 ¿Quieres que te comparta los *pasos de inscripción* y cómo *separar cupo*?",
      "📅 ¿Quieres que te confirme también la *fecha de inicio* y *horario* disponible?",
    ];
    if (wasPromptAskedRecently(history, nextStepPrompt)) {
      const alternative = promptCandidates.find((candidate) => !wasPromptAskedRecently(history, candidate));
      if (alternative) {
        nextStepPrompt = alternative;
      }
    }

    return `💸 *Inversión de ${detectedProgram.nombre}:*\n\n💰 *Inscripción:* ${insText}\n🎁 ${inscriptionIncludes}\n\n💰 *Mensualidad:* ${menText}\n🧴 ${monthlyIncludes}\n\n${nextStepPrompt}`;
  }

  if (intent === "horario") {
    const nextStart = hasUpcomingStart ? formatDateLong(primaryCourse?.fecha_inicio) || formatDateShort(primaryCourse?.fecha_inicio) : "Por confirmar";
    const schedule = primaryCourse?.horario || "Por confirmar";

    return `📚 *${detectedProgram.nombre}*\n\n📅 *Próximo inicio:* ${nextStart}\n🕓 *Horario:* ${schedule}\n\n💸 ¿Quieres que te confirme también la *inversión*?`;
  }

  return null;
}

function formatStudentCoursesList(studentContext: any): string {
  const enrollments = Array.isArray(studentContext?.enrollments) ? studentContext.enrollments : [];
  if (!enrollments.length) {
    return "No tienes cursos activos registrados en este momento.";
  }

  const lines = enrollments
    .slice(0, 6)
    .map((item: any) => {
      const schedule = [item?.diasSemana, item?.horaInicio && item?.horaFin ? `${item.horaInicio} - ${item.horaFin}` : item?.horaInicio]
        .filter(Boolean)
        .join(" | ");
      return `- ${item?.cursoNombre || "Curso"}${item?.programaNombre ? ` (${item.programaNombre})` : ""}${schedule ? ` | ${schedule}` : ""}`;
    })
    .join("\n");

  return `Tus cursos inscritos son:\n${lines}`;
}

function extractIdentificationFromText(message: string): string | null {
  const text = String(message || "").trim();
  if (!text) return null;

  const normalized = normalizeForMatch(text);
  const hasIdKeyword = /\b(cedula|identificacion|documento|dni|cc)\b/i.test(normalized);
  const looksLikeOnlyNumber = /^[\d\s.\-]{6,20}$/.test(text);

  if (!hasIdKeyword && !looksLikeOnlyNumber) {
    return null;
  }

  const matches = text.match(/\b\d[\d.\-\s]{5,20}\b/g) || [];
  const candidate = matches
    .map((item) => item.replace(/\D/g, ""))
    .find((digits) => digits.length >= 6 && digits.length <= 12);

  return candidate || null;
}

function hasStudentAccountIntent(message: string): boolean {
  const text = normalizeForMatch(message);
  return /\b(cuanto debo|deuda|saldo pendiente|mensualidad|proxima mensualidad|proximo pago|cuando debo pagar|proxima clase|siguiente clase|hoy hay clase|inscrita|inscrito|mis cursos|materiales)\b/i.test(text);
}

function resolveStudentIdentification(
  userMessage: string,
  history: Array<{ user: string; agent: string }>
): string | null {
  const direct = extractIdentificationFromText(userMessage);
  if (direct) return direct;

  if (!hasStudentAccountIntent(userMessage)) {
    return null;
  }

  for (let i = history.length - 1; i >= 0; i--) {
    const fromHistory = extractIdentificationFromText(history[i]?.user || "");
    if (fromHistory) {
      return fromHistory;
    }
  }

  return null;
}

function buildStudentDirectResponse(message: string, studentContext: any): string | null {
  if (!studentContext) return null;

  const text = normalizeForMatch(message);
  const asksDebt = /\b(cuanto debo|deuda|saldo pendiente|debo)\b/i.test(text);
  const asksNextPay = /\b(proxima mensualidad|proximo pago|cuando debo pagar|fecha de pago|vence|vencimiento)\b/i.test(text);
  const asksNextClass = /\b(proxima clase|siguiente clase|hoy hay clase|hoy tengo clase|clase hoy)\b/i.test(text);
  const asksEnrolledCourses = /\b(en que curso|que cursos|mis cursos|inscrita|inscrito)\b/i.test(text);

  if (asksDebt) {
    const deuda = Number(studentContext?.deudaTotal || 0);
    const next = studentContext?.nextMonthlyPayment;
    const extra = next
      ? `\nPróxima mensualidad: Cuota ${next.numeroCuota ?? "?"} | vence ${formatDateShort(next.fechaVencimiento)} | valor ${formatCurrencyCOP(Number(next.monto || 0))}.`
      : "\nNo tienes mensualidades pendientes registradas.";
    return `Tu deuda total pendiente es ${formatCurrencyCOP(deuda)}.${extra}`;
  }

  if (asksNextPay) {
    const next = studentContext?.nextMonthlyPayment;
    if (!next) {
      return "No tienes una mensualidad pendiente registrada en este momento.";
    }
    return `Tu próxima mensualidad es la cuota ${next.numeroCuota ?? "?"}, vence el ${formatDateShort(next.fechaVencimiento)} y el valor es ${formatCurrencyCOP(Number(next.monto || 0))}.`;
  }

  if (asksNextClass) {
    const nextClass = studentContext?.nextClass;
    if (!nextClass) {
      return `No pude calcular tu próxima clase con los horarios actuales. ${formatStudentCoursesList(studentContext)}`;
    }
    return `Tu próxima clase es ${nextClass.cursoNombre}${nextClass.programaNombre ? ` (${nextClass.programaNombre})` : ""}, el ${nextClass.fechaHoraTexto}.`;
  }

  if (asksEnrolledCourses) {
    return formatStudentCoursesList(studentContext);
  }

  return null;
}

function buildTodayClassDirectResponse(
  detectedProgram: any | null,
  courses: any[],
  now: Date
): string {
  if (!detectedProgram) {
    return "Para confirmarte si hoy hay clase, dime el curso en el que estás inscrita (por ejemplo: Uñas).";
  }

  const normalizedProgram = normalizeForMatch(detectedProgram.nombre || "");
  const relatedCourses = (courses || []).filter((course) => {
    const sameProgramId = course?.programa_id && Number(course.programa_id) === Number(detectedProgram.id);
    const sameProgramName = normalizeForMatch(course?.programa_nombre || "").includes(normalizedProgram);
    return Boolean(sameProgramId || sameProgramName);
  });

  if (relatedCourses.length === 0) {
    return `No encontré grupos activos de ${detectedProgram.nombre} en este momento. Si quieres, te comparto los próximos grupos.`;
  }

  const dayIndex = now.getDay();
  const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const dayName = dayNames[dayIndex] || "hoy";

  const activeCourses = relatedCourses.filter((course) => isCourseActiveOnDate(course, now));
  const candidates = activeCourses.length > 0 ? activeCourses : relatedCourses;
  const todayCourses = candidates.filter((course) => scheduleIncludesDay(course?.horario, dayIndex));

  if (todayCourses.length > 0) {
    const lines = todayCourses
      .slice(0, 4)
      .map((course) => `- ${course.nombre}${course.horario ? ` (${course.horario})` : ""}`)
      .join("\n");

    return `Sí, hoy ${dayName} sí hay clase de ${detectedProgram.nombre}.\n${lines}`;
  }

  const reference = candidates
    .slice(0, 4)
    .map((course) => {
      const start = formatDateShort(course?.fecha_inicio);
      const datePart = start ? ` | inicia: ${start}` : "";
      return `- ${course.nombre}${course.horario ? ` (${course.horario})` : ""}${datePart}`;
    })
    .join("\n");

  return `Hoy ${dayName} no aparece clase de ${detectedProgram.nombre} según los horarios registrados.\n${reference}`;
}

function isNextGroupQuestion(message: string): boolean {
  const text = normalizeForMatch(message);
  return /\b(cuando hay otro curso|cuando hay otro|otro curso|proximo grupo|siguiente grupo|proximo curso|nuevo grupo|cuando abren|cuando inicia el proximo)\b/i.test(text);
}

function hasRecentNextGroupContext(history: Array<{ user: string; agent: string }>): boolean {
  const recent = history.slice(-3);
  return recent.some((turn) => {
    const combined = `${turn?.user || ""} ${turn?.agent || ""}`;
    return /\b(otro curso|proximo grupo|siguiente grupo|proximo curso|grupo avanzado|por confirmar)\b/i.test(normalizeForMatch(combined));
  });
}

function shouldUseNextGroupDirectResponse(
  userMessage: string,
  detectedProgram: any | null,
  programs: any[],
  history: Array<{ user: string; agent: string }>
): boolean {
  if (isNextGroupQuestion(userMessage)) return true;

  const mentionsProgram = Boolean(detectProgramFromMessage(userMessage, programs));
  if (mentionsProgram && detectedProgram && isLikelyProgramOnlyReply(userMessage) && hasRecentNextGroupContext(history)) {
    return true;
  }

  return false;
}

function buildNextGroupDirectResponse(
  detectedProgram: any | null,
  courses: any[],
  now: Date
): string {
  if (!detectedProgram) {
    return "¡Claro! Te ayudo con eso. ¿De cuál curso quieres que te confirme el próximo grupo?";
  }

  const normalizedProgram = normalizeForMatch(detectedProgram.nombre || "");
  const relatedCourses = (courses || []).filter((course) => {
    const sameProgramId = course?.programa_id && Number(course.programa_id) === Number(detectedProgram.id);
    const sameProgramName = normalizeForMatch(course?.programa_nombre || "").includes(normalizedProgram);
    return Boolean(sameProgramId || sameProgramName);
  });

  if (!relatedCourses.length) {
    return `Te entiendo. En este momento no tengo grupos cargados de ${detectedProgram.nombre}. Si quieres, te aviso apenas publiquemos nueva fecha.`;
  }

  const nextWithDate = relatedCourses
    .filter((course) => course?.fecha_inicio && !Number.isNaN(new Date(course.fecha_inicio).getTime()))
    .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
    .find((course) => new Date(course.fecha_inicio).getTime() >= now.getTime() - 24 * 60 * 60 * 1000);

  if (nextWithDate) {
    const dateLabel = formatDateLong(nextWithDate.fecha_inicio) || formatDateShort(nextWithDate.fecha_inicio) || "Por confirmar";
    const horario = nextWithDate?.horario || "Por confirmar";
    return `Te entiendo, este grupo ya va avanzado.\n\n💎 ${detectedProgram.nombre}\n🗓️ Próximo grupo: ${dateLabel}\n⏰ Horario: ${horario}\n\nSi quieres, te dejo pendiente para avisarte apenas abran inscripciones.`;
  }

  return `Te entiendo, este grupo ya va avanzado.\n\n💎 ${detectedProgram.nombre}\n🗓️ Próximo grupo: Por confirmar\n⏰ Horario: Por confirmar\n\nApenas publiquemos nueva fecha, te la comparto de inmediato. ¿Quieres que te avise?`;
}

function shouldUseTodayClassDirectResponse(
  userMessage: string,
  detectedProgram: any | null,
  programs: any[],
  history: Array<{ user: string; agent: string }>
): boolean {
  if (isTodayClassQuestion(userMessage)) return true;

  const mentionsProgram = Boolean(detectProgramFromMessage(userMessage, programs));
  if (mentionsProgram && detectedProgram && isLikelyProgramOnlyReply(userMessage) && hasRecentTodayClassContext(history)) {
    return true;
  }

  return false;
}

function detectMaterialsScope(message: string): "tema" | "ciclo" | "general" {
  const text = message.toLowerCase();

  if (/\b(tema|clase|sesion|sesión|modulo|m[oó]dulo|leccion|lección)\b/i.test(text)) return "tema";
  if (/\b(ciclo|nivel|general|completo|kit|todos|todo\s+el\s+curso)\b/i.test(text)) return "ciclo";

  return "general";
}

type ObjectionType = "precio" | "tiempo" | "confianza" | "posponer" | "none";

function detectObjectionType(message: string): ObjectionType {
  const text = message.toLowerCase();

  if (/\b(caro|costoso|muy\s+caro|no\s+tengo\s+dinero|no\s+me\s+alcanza|esta\s+costoso)\b/i.test(text)) {
    return "precio";
  }
  if (/\b(no\s+tengo\s+tiempo|trabajo\s+todo\s+el\s+dia|no\s+puedo\s+por\s+horario|muy\s+ocupad[oa])\b/i.test(text)) {
    return "tiempo";
  }
  if (/\b(no\s+se\s+si\s+sirva|es\s+confiable|tienen\s+certificacion|es\s+legal|no\s+confio|me\s+da\s+duda)\b/i.test(text)) {
    return "confianza";
  }
  if (/\b(luego|despues|mas\s+adelante|lo\s+voy\s+a\s+pensar|te\s+aviso|otro\s+dia|por\s+ahora\s+no)\b/i.test(text)) {
    return "posponer";
  }

  return "none";
}

function resolveProgramFromContext(
  userMessage: string,
  programs: any[],
  conversationHistory: Array<{ user: string; agent: string }>
): any | null {
  const directProgram = detectProgramFromMessage(userMessage, programs);
  if (directProgram) return directProgram;

  if (hasProgramCorrectionSignal(userMessage)) return null;

  const isLikelyFollowUp = isShortAffirmativeReply(userMessage)
    || /\b(ese|esa|ese\s+curso|esa\s+carrera|horario|precio|cuanto|cuando|inscripcion|mensualidad|cupos|duracion|inversion|temario|materiales|ubicacion|direccion|donde|disponible|disponibles|dia|dias|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/i.test(
      userMessage
    );

  if (!isLikelyFollowUp || !conversationHistory.length) return null;

  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const current = conversationHistory[i];
    if (!current) continue;

    const fromUser = detectProgramFromMessage(current.user || "", programs);
    if (fromUser) return fromUser;

    const fromAgent = detectProgramFromMessage(current.agent || "", programs);
    if (fromAgent) return fromAgent;
  }

  return null;
}

function buildContextualDirective(userMessage: string, detectedProgram: any | null): string {
  const intent = detectUserIntent(userMessage);
  const materialsScope = intent === "materiales" ? detectMaterialsScope(userMessage) : "general";
  const objection = detectObjectionType(userMessage);
  const explicitBuyingIntent = detectBuyingIntent(userMessage, []);
  const asksNextGroup = isNextGroupQuestion(userMessage);
  const programName = detectedProgram?.nombre || null;

  const intentInstructionMap: Record<string, string> = {
    precio: 'Responde priorizando inscripción y mensualidad del curso solicitado. No des valor total salvo solicitud explícita.',
    horario: 'Responde priorizando fechas de inicio, días, horarios y cupos del curso solicitado.',
    temario: 'Responde priorizando contenido/temario por ciclos o módulos del curso solicitado. Si piden detalle por mes o clase, responde en lista vertical: una clase por línea (sin texto amontonado).',
    materiales:
      materialsScope === "tema"
        ? 'Responde priorizando SOLO "Materiales por Tema/Clase" del curso solicitado. Regla: "Clase N" = tema con orden N del ciclo consultado. Si no se especifica ciclo y hay ambigüedad, pide aclaración breve antes de listar materiales. Formato obligatorio: primero cantidad y unidad, luego el nombre del material.'
        : materialsScope === "ciclo"
        ? 'Responde priorizando SOLO "Materiales por Ciclo" del curso solicitado. Formato obligatorio: primero cantidad y unidad, luego el nombre del material.'
        : 'Responde con materiales del curso y pide una aclaración breve para definir si los quiere por ciclo o por tema/clase. Formato obligatorio: primero cantidad y unidad, luego el nombre del material.',
    inscripcion: 'Responde con resumen breve y guía de inscripción; si hay interés claro, cierra con Admisiones (más 57 301 203 8582).',
    general: 'Responde en formato claro por bloques enfocado en el curso solicitado.'
  };

  const focusLine = programName
    ? `Curso detectado: "${programName}". Debes responder enfocado en este curso y evitar respuestas genéricas.`
    : 'Si no detectas curso específico, pide solo una aclaración breve y concreta.';

  const objectionInstructionMap: Record<ObjectionType, string> = {
    precio: 'Objeción de precio detectada: responde con empatía, valor del curso y opción de iniciar con inscripción y mensualidad.',
    tiempo: 'Objeción de tiempo detectada: responde con empatía y propone horario o próximo grupo compatible.',
    confianza: 'Objeción de confianza detectada: responde con respaldo y credenciales usando solo datos disponibles.',
    posponer: 'Usuario pospone decisión: responde suave, resume valor y deja CTA corta para siguiente paso.',
    none: 'Sin objeción explícita: mantén tono consultivo y guía hacia avance natural de inscripción.'
  };

  return [
    `Intención detectada: ${intent.toUpperCase()}.`,
    `Objeción detectada: ${objection.toUpperCase()}.`,
    `Señal de compra explícita: ${explicitBuyingIntent ? "SÍ" : "NO"}.`,
    focusLine,
    intentInstructionMap[intent],
    objectionInstructionMap[objection],
    explicitBuyingIntent
      ? 'ACCIÓN OBLIGATORIA EN VOZ: Entrega el número de la academia/admisiones (más 57 301 203 8582) y guía el siguiente paso de inscripción.'
      : 'Si no hay señal explícita de compra, mantén modo informativo y consultivo.',
    asksNextGroup
      ? 'CASO ESPECIAL EN VOZ: Si pregunta por "otro curso" o "próximo grupo", NO des discurso largo. Responde natural y breve: reconoce que el grupo actual puede ir avanzado, comparte fecha/horario solo si están confirmados, y si no hay fecha indícalo claramente antes de cerrar con una pregunta corta.'
      : 'Mantén foco en resolver lo que preguntó, sin sobrecargar información.',
    'REGLA DE ORO EN VOZ: 1 intención del usuario = 1 bloque corto. No mezcles precio+duración+beneficios+temario en la misma respuesta salvo que lo pidan.',
    'Si hay objeción, usa esta secuencia en voz: empatía breve, dato concreto, propuesta simple, cierre con pregunta corta.',
    'Prohibido responder con frases genéricas como: "¿en qué curso estás interesado?" si el usuario ya mencionó uno.'
  ].join('\n');
}

/**
 * Generar respuesta con Gemini
 */
async function generateResponse(apiKey: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);

  const modelCandidates = [
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-002",
    "gemini-1.5-pro-002",
    process.env.GEMINI_MODEL_CHAT,
    process.env.GEMINI_MODEL_SUMMARY,
  ].filter(Boolean) as string[];

  let lastError: any = null;

  for (const candidate of modelCandidates) {
    try {
      console.log(`[generateResponse] Intentando modelo: ${candidate}`);
      const model = genAI.getGenerativeModel({ model: candidate });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      console.log(`[generateResponse] Éxito con modelo: ${candidate}`);
      return text || "Lo siento, no pude generar una respuesta.";
    } catch (err: any) {
      lastError = err;
      const errorMsg = String(err?.message || "").toLowerCase();
      console.warn(`[generateResponse] Error con ${candidate}:`, errorMsg);

      if (errorMsg.includes("404") || errorMsg.includes("not found")) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("No available Gemini model for chat");
}

/**
 * Convertir texto a audio (TTS) usando Elevenlabs
 */
async function textToSpeech(text: string): Promise<Buffer> {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey) {
    throw new Error("ELEVENLABS_API_KEY no configurada");
  }

  try {
    // Usar la voz default de Elevenlabs (Rachel)
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.7,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Elevenlabs error: ${response.status} - ${error}`);
    }

    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer);
  } catch (err) {
    console.error("[textToSpeech] Error:", err);
    throw err;
  }
}

/**
 * Eliminar emojis del texto para texto-a-voz (TTS)
 * Los emojis no se pronuncian bien en audio
 */
function removeEmojis(text: string): string {
  // Expresión regular usando códigos Unicode hexadecimales
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis misceláneos y símbolos
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Símbolos misceláneos
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticones
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transporte y símbolos de mapa
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Banderas
    // Limpiar espacios múltiples que quedan
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpiar texto para TTS y evitar pausas extra o caracteres raros
 */
function cleanForTTS(text: string): string {
  if (!text) return '';

  let output = removeEmojis(text);

  // Quitar markdown simple y símbolos comunes
  output = output
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/[~`_]/g, '')
    .replace(/^\s*[•\-]\s+/gm, '')
    .replace(/\s*✅\s*/g, ' ')
    .replace(/\s*•\s*/g, ' ');

  // Unificar saltos y evitar pausas largas
  output = output
    .replace(/\n+/g, '. ')
    .replace(/\s*\.\s*\.\s*\.+/g, '. ')
    .replace(/([!?])\1+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*([,.!?])\s*/g, '$1 ')
    .trim();

  return output;
}

/**
 * Sanitizar texto para JSON válido
 * Solo remover caracteres de control problemáticos
 * JSON.stringify ya maneja escape de comillas, saltos de línea, etc.
 */
/**
 * Sanitizar texto para JSON válido
 * Remover/reemplazar caracteres problemáticos antes de JSON.stringify
 */
function sanitizeForJSON(text: string | null | undefined): string {
  if (!text) return '';

  const str = String(text);

  // Preservar formato de WhatsApp (negrita/cursiva/monoespacio, emojis y saltos)
  // Solo remover caracteres de control inválidos para JSON.
  return str
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function cleanMarkdownForWhatsApp(text: string): string {
  if (!text) return "";
  return text.replace(/\*\*([^*]+)\*\*/g, "*$1*");
}

function formatPrices(text: string): string {
  if (!text) return "";
  return text.replace(/\$(\d+)(?![\d,.])/g, (match, number) => {
    const num = parseInt(number, 10);
    if (isNaN(num)) return match;
    return `$${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  });
}

function removeCOPCurrency(text: string): string {
  if (!text) return "";
  return text
    .replace(/[ \t]*COP\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function enforceCourseInfoBlocks(text: string): string {
  if (!text) return "";

  let output = String(text)
    .replace(/\*{2,}/g, "*")
    .replace(/(curso)\s+\*([^*\n]+)\*/gi, "$1 $2")
    .replace(/💎\s*\*([^*\n]+)\*/g, "💎 $1")
    .replace(/📅\s*([^\n*]+)\*([^\n*]+)\*/g, "📅 $1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const hasCoursePattern = /(💎|pr[oó]ximo\s+inicio|horario|inscripci[oó]n|mensualidad|s[ií]guenos|instagram)/i.test(output);
  if (!hasCoursePattern) return output;

  output = output
    .replace(/:\s*(?=💎)/g, ":\n\n")
    .replace(/\s*(🗓️\s*Pr[oó]ximo\s+inicio:?)/gi, "\n$1")
    .replace(/\s*(📅\s*)/g, "\n\n$1")
    .replace(/\s*(⏰\s*Horario:)/gi, "\n$1")
    .replace(/\s*(💰\s*Inscripci[oó]n:)/gi, "\n$1")
    .replace(/\s*(💰\s*Mensualidad:)/gi, "\n\n$1")
    .replace(/\s*(📲\s*S[ií]guenos)/gi, "\n\n$1")
    .replace(/\s*(¿Te\s+gustar[ií]a[^\n?]*\?\s*😊?)/i, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return output;
}

function enforceReadableLineBreaks(text: string): string {
  if (!text) return "";

  let output = String(text);
  const hasEmojiList = /(incluye\s*:|incluye)\s*(👚|📃|🎉|🎓|🧴|💅|📌|✅)/i.test(output);

  if (hasEmojiList) {
    output = output
      .replace(/(incluye\s*:?)\s*(?=(👚|📃|🎉|🎓|🧴|💅|📌|✅))/gi, "$1\n\n")
      .replace(/\s*(👚|📃|🎉|🎓|🧴|💅|📌|✅)\s*/g, "\n$1 ");
  }

  output = output
    .replace(/([.!?])\s+(¿)/g, "$1\n\n$2")
    // Separar bullets amontonados: "• texto • texto" → cada uno en su línea
    .replace(/([^\n])\s*[•·▪◦]\s+/g, "$1\n• ")
    // Separar bloques "Mes X –" que vienen pegados
    .replace(/([^\n])\s*(Mes\s+\d)/g, "$1\n\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return output;
}

function formatFinalWhatsAppResponse(text: string): string {
  let output = cleanMarkdownForWhatsApp(text || "");
  output = formatPrices(output);
  output = removeCOPCurrency(output);
  output = enforceCourseInfoBlocks(output);
  output = enforceReadableLineBreaks(output);
  return output;
}

function sanitizeAgentVisibleResponse(rawText: string, fallbackResponse: string): string {
  const fallback = (fallbackResponse || "Déjame confirmarlo y te respondo en breve.").trim();
  if (!rawText) return fallback;

  let output = stripMediaMarkersForPrompt(String(rawText)).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const leakedBlockPatterns: RegExp[] = [
    /🔒\s*MODO\s+RESPUESTA\s+A\s+PLANTILLAS[\s\S]*?cualquier\s+texto\s+de\s+ventas\.?/gi,
    /#\s*SYSTEM\s+PROMPT:[\s\S]*?(?=\n\s*(?:Usuario:|Mensaje del usuario:|#\s*Mensaje del usuario:|$))/gi,
    /#\s*DIRECTIVA\s+CONTEXTUAL[\s\S]*?(?=\n\s*(?:Usuario:|Mensaje del usuario:|#\s*Mensaje del usuario:|$))/gi,
    /#\s*🎯\s*INSTRUCCI[ÓO]N\s+DE\s+RESPUESTA:[\s\S]*?(?=\n\s*(?:Usuario:|Mensaje del usuario:|#\s*Mensaje del usuario:|$))/gi,
  ];

  for (const pattern of leakedBlockPatterns) {
    output = output.replace(pattern, " ");
  }

  const leakedLinePatterns: RegExp[] = [
    /cambia\s+a\s+modo\s+soporte\s+estudiante/i,
    /^\s*acceso\s+a\s+la\s+app\s*,?\s*$/i,
    /^\s*visualizacion\s+de\s+asistencias\/?notas\/?materiales\s*,?\s*$/i,
    /^\s*orientacion\s+basica\s+de\s+uso\s*\.?\s*$/i,
    /modo\s+respuesta\s+a\s+plantillas/i,
    /no\s+vender\s+cursos\s+ni\s+iniciar\s+discurso\s+comercial/i,
    /responder\s+corto,?\s+claro\s+y\s+operativo/i,
    /priorizar\s+ayuda\s+en\s+este\s+orden/i,
    /si\s+pide\s+datos\s+sensibles\s+o\s+no\s+se\s+puede\s+validar\s+identidad/i,
    /si\s+hay\s+problema\s+de\s+pago,?\s+bloqueo\s+de\s+cuenta\s+o\s+error\s+t[eé]cnico\s+persistente/i,
    /cerrar\s+siempre\s+con\s+una\s+pregunta\s+de\s+avance/i,
    /frases\s+prohibidas\s+en\s+este\s+modo/i,
    /te\s+interesa\s+inscribirte/i,
    /te\s+comparto\s+nuestros\s+cursos/i,
    /^\s*(intenci[oó]n|objeci[oó]n|se[ñn]al\s+de\s+compra\s+expl[ií]cita)\s+detectada\s*:/i,
    /^\s*acci[oó]n\s+obligatoria\s*:/i,
    /^\s*prohibido\s+responder\s+con\s*:/i,
    /^\s*\[📷\s*https?:\/\/\S+/i,
    /^\s*📷\s*https?:\/\/\S+/i,
    /^\s*https?:\/\/[^\s]*supabase[^\s]*\/storage\/v1\/object\/public\/marketing\//i,
  ];

  const cleanedLines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      return !leakedLinePatterns.some((pattern) => pattern.test(line));
    });

  output = cleanedLines.join("\n").trim();

  output = output
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  output = normalizeWhatsAppReadability(output);

  return enforceParagraphBlocks(output || fallback) || fallback;
}

function normalizeWhatsAppReadability(text: string): string {
  let output = String(text || "");

  output = output
    .replace(/\bhttps?:\s*\/\/\s*/gi, (match) => (match.toLowerCase().startsWith("https") ? "https://" : "http://"))
    .replace(/\bwww\.\s*/gi, "www.")
    .replace(/instagram\.\s*com/gi, "instagram.com")
    .replace(/facebook\.\s*com/gi, "facebook.com")
    .replace(/wa\.\s*me/gi, "wa.me")
    .replace(/(https?:\/\/[^\s\n]+)\n(?=[a-z0-9./_-])/gi, "$1")
    .replace(/([a-z0-9])\s*\.\s*([a-z0-9])/g, "$1.$2")
    .replace(/([a-z0-9])\s*\/\s*([a-z0-9])/g, "$1/$2");

  let previous = "";
  while (previous !== output) {
    previous = output;
    output = output.replace(/(\d)\s*[.]\s*(\d{3}\b)/g, "$1.$2");
  }

  return output;
}

function getColombiaNowDate(): Date {
  const colombiaIso = new Date().toLocaleString("sv-SE", {
    timeZone: "America/Bogota",
    hour12: false,
  });
  return new Date(colombiaIso.replace(" ", "T"));
}

function getTimeSlotGreeting(hour: number): "Buenos días" | "Buenas tardes" | "Buenas noches" {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function enforceParagraphBlocks(text: string): string {
  const input = (text || "").trim();
  if (!input) return "";

  const hasBlockBreaks = /\n\n/.test(input);
  if (hasBlockBreaks) {
    return input
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  const singleLine = input.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!singleLine) return "";

  const hasUrlLikeContent = /https?:\/\/|www\./i.test(singleLine);
  if (hasUrlLikeContent || singleLine.length < 220) {
    return singleLine;
  }

  const sentences = singleLine
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9💎📌👉])/u)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return sentences.join(" ").trim();

  const blocks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const block = sentences.slice(i, i + 2).join(" ").trim();
    if (block) blocks.push(block);
  }

  return blocks.join("\n\n").trim();
}

function normalizeForComparison(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlapRatio(a: string, b: string): number {
  const wordsA = new Set(normalizeForComparison(a).split(" ").filter(Boolean));
  const wordsB = new Set(normalizeForComparison(b).split(" ").filter(Boolean));
  if (!wordsA.size || !wordsB.size) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection += 1;
  }

  const base = Math.min(wordsA.size, wordsB.size);
  return base ? intersection / base : 0;
}

function isRepetitiveResponse(
  newResponse: string,
  history: Array<{ user: string; agent: string }>,
  newUserMessage: string
): boolean {
  const last = history[history.length - 1];
  if (!last?.agent) return false;

  const normalizedNewUser = normalizeForComparison(newUserMessage);
  const normalizedLastUser = normalizeForComparison(last.user || "");
  const userMessagesAreDifferent = normalizedNewUser && normalizedLastUser && normalizedNewUser !== normalizedLastUser;

  const overlap = wordOverlapRatio(newResponse, last.agent);
  const almostEqual = normalizeForComparison(newResponse) === normalizeForComparison(last.agent);

  return (almostEqual || overlap >= 0.9) && Boolean(userMessagesAreDifferent);
}

/**
 * Subir audio a Supabase storage y obtener URL pública
 */
async function uploadAudioToSupabase(
  supabase: any,
  audioBuffer: Buffer,
  filename: string
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from("agent_audio_responses")
      .upload(filename, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (error) {
      console.error("[uploadAudioToSupabase] Error:", error);
      throw error;
    }

    // Obtener URL pública
    const { data: publicUrl } = supabase.storage
      .from("agent_audio_responses")
      .getPublicUrl(data.path);

    return publicUrl?.publicUrl || "";
  } catch (err) {
    console.error("[uploadAudioToSupabase] Error:", err);
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación
    if (!validateRequest(req)) {
      return NextResponse.json({ 
        ok: false,
        error: "No autorizado" 
      }, { status: 401 });
    }

    // 2. Parsear body
    const body = await req.json();
    const { whatsapp_access_token } = body || {};
    const extractedAudioInputs = extractAudioInputsFromBody(body || {});
    const media_id = extractedAudioInputs.mediaId;
    const audio_url = extractedAudioInputs.audioUrl;
    const resolvedPhone = extractPhoneFromAudioBody(body || {});

    // Aceptar tanto media_id como audio_url para flexibilidad
    if (!media_id && !audio_url) {
      return NextResponse.json(
        { 
          ok: false,
          error: "Falta 'media_id' o 'audio_url' en el body" 
        },
        { status: 400 }
      );
    }

    // 3. Validar credenciales
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const whatsappToken = whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ 
        ok: false,
        error: "Faltan credenciales de Supabase" 
      }, { status: 500 });
    }
    if (!geminiKey) {
      return NextResponse.json({ 
        ok: false,
        error: "Falta GEMINI_API_KEY" 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    console.log("[POST /api/ai/audio] Iniciando procesamiento de audio...");

    // 4. Descargar audio
    let audioBuffer: Buffer;

    if (media_id && whatsappToken) {
      // Opción 2: Descargar desde WhatsApp Cloud API usando media_id
      console.log("[POST /api/ai/audio] Obteniendo URL del media desde WhatsApp...");
      const mediaUrl = await getWhatsAppMediaUrl(media_id, whatsappToken);
      
      console.log("[POST /api/ai/audio] Descargando audio desde WhatsApp...");
      audioBuffer = await downloadAudio(mediaUrl, whatsappToken);
    } else if (audio_url) {
      // Opción 1: Descargar directamente de la URL
      console.log("[POST /api/ai/audio] Descargando audio desde URL...");
      audioBuffer = await downloadAudio(audio_url, whatsappToken);
    } else {
      return NextResponse.json(
        { error: "Necesita media_id o audio_url, y WHATSAPP_ACCESS_TOKEN" },
        { status: 400 }
      );
    }

    console.log(`[POST /api/ai/audio] Audio descargado: ${audioBuffer.length} bytes`);

    // 5. STT: Convertir audio a texto
    console.log("[POST /api/ai/audio] Convirtiendo audio a texto (STT)...");
    const transcription = await speechToText(geminiKey, audioBuffer);

    // 6. Leer configuración del agente
    const { data: settings } = await supabase
      .from("agent_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const configuredSystemPrompt = (settings?.system_prompt || "").trim();
    if (!configuredSystemPrompt) {
      return NextResponse.json(
        {
          ok: false,
          error: "No hay prompt configurado. Defínelo en Marketing Center antes de usar el agente.",
        },
        { status: 400 }
      );
    }

    // 7. Obtener historial de conversación
    console.log("[POST /api/ai/audio] Leyendo historial de conversación...");
    const history = await getConversationHistory(supabase, resolvedPhone, 5);
    const effectiveTranscription = enrichMessageWithFollowUpContext(transcription, history);
    const preferredStudentName = resolvePreferredStudentName(transcription, history);
    const detectedIntent = detectUserIntent(effectiveTranscription);
    let mediaSuggestion: Awaited<ReturnType<typeof getAgentImageSuggestion>> = null;

    // 7.5. Obtener información JERÁRQUICA: todos los programas (primaria)
    console.log("[POST /api/ai/audio] Leyendo programas disponibles...");
    const programs = await getProgramsForAgent();

    const studentIdentification = resolveStudentIdentification(effectiveTranscription, history);
    const studentContext = studentIdentification
      ? await getStudentContextByIdentification(studentIdentification)
      : null;

    if (studentIdentification && !studentContext && hasStudentAccountIntent(effectiveTranscription)) {
      mediaSuggestion = await getAgentImageSuggestion(supabase, {
        message: effectiveTranscription,
        intent: detectedIntent,
        programId: null,
      });

      const notFoundMessage = `No encontré una estudiante con identificación ${studentIdentification}. Verifica el número de cédula y me lo vuelves a enviar.`;
      const finalNotFound = formatFinalWhatsAppResponse(notFoundMessage);
      await saveConversation(supabase, resolvedPhone, transcription, finalNotFound, transcription);

      const cleaned = cleanForTTS(finalNotFound);
      let audioUrl = "";
      try {
        if (process.env.ELEVENLABS_API_KEY) {
          const responseAudioBuffer = await textToSpeech(cleaned);
          const timestamp = Date.now();
          const filename = `responses/${timestamp}-${resolvedPhone}.mp3`;
          audioUrl = await uploadAudioToSupabase(supabase, responseAudioBuffer, filename);
        }
      } catch (ttsErr) {
        console.warn("[POST /api/ai/audio] Error en TTS para no-encontrado:", ttsErr);
      }

      return NextResponse.json(withMediaSuggestion({
        ok: true,
        transcription: sanitizeForJSON(transcription) || "",
        agent_response: sanitizeForJSON(finalNotFound) || "",
        audio_url: audioUrl || "",
        agent: sanitizeForJSON(settings?.persona_name || "Dany") || "Dany",
        historyLength: Number(history.length) || 0,
      }, mediaSuggestion));
    }

    // 7.6. Obtener cursos/grupos basado en lo que pregunta el usuario
    console.log("[POST /api/ai/audio] Detectando programa específico...");
    let detectedProgram = resolveProgramFromContext(effectiveTranscription, programs, history);
    let courses = detectedProgram
      ? await getCoursesByProgram(detectedProgram.id)
      : await getCoursesForQuery(effectiveTranscription, programs);

    const hasCorrectionSignal = hasProgramCorrectionSignal(effectiveTranscription);

    if (!detectedProgram && !hasCorrectionSignal && courses.length > 0) {
      const uniqueProgramIds = Array.from(new Set(courses.map((c) => c.programa_id).filter(Boolean)));
      if (uniqueProgramIds.length === 1) {
        const inferred = programs.find((p) => p.id === uniqueProgramIds[0]) || null;
        if (inferred) {
          detectedProgram = inferred;
          courses = await getCoursesByProgram(inferred.id);
        }
      }
    }

    if (!detectedProgram && studentContext?.enrolledProgramIds?.length === 1) {
      const inferredFromStudent = programs.find((p) => Number(p.id) === Number(studentContext.enrolledProgramIds[0])) || null;
      if (inferredFromStudent) {
        detectedProgram = inferredFromStudent;
        courses = await getCoursesByProgram(inferredFromStudent.id);
      }
    }

    mediaSuggestion = await getAgentImageSuggestion(supabase, {
      message: effectiveTranscription,
      intent: detectedIntent,
      programId: detectedProgram?.id || null,
    });

    // Anular imagen si es primer mensaje o saludo/afirmación corta
    if (mediaSuggestion) {
      const isFirstInteraction = history.length === 0;
      const trimmedTranscription = (transcription || "").trim();
      const isGreetingOrShortInput =
        /^(hola|hi|hey|buenos?\s*d[ií]as?|buenas?\s*(tardes?|noches?)|hello|holi|s[ií]p?|ok|okay|dale|listo|claro|perfecto|de\s+una|bien|ya|sip|genial|excelente|entendido|gracias|chao|bye)[\s!.?]*$/i.test(trimmedTranscription) ||
        trimmedTranscription.split(/\s+/).filter(Boolean).length <= 1;
      const normalizedTranscription = normalizeForMatch(trimmedTranscription);
      const isOperationalQuestion = /\b(pago|pagos|nequi|bancolombia|sistecredito|inscrip|inscripcion|paso\s*1|horario|hora|martes|miercoles|jueves|viernes|sabado|domingo|ubicacion|direccion|donde|maps|precio|valor|cuanto)\b/i.test(normalizedTranscription)
        || /^(1|uno|paso\s*1)$/i.test(normalizedTranscription);
      const lastAgentMessage = history[history.length - 1]?.agent || "";
      const isClosureAckInput = isClosureAcknowledgement(trimmedTranscription, lastAgentMessage);
      if (isFirstInteraction || isGreetingOrShortInput) {
        mediaSuggestion = null;
      }
      if (isOperationalQuestion) {
        mediaSuggestion = null;
      }
      if (isClosureAckInput) {
        mediaSuggestion = null;
      }
    }

    const directTodayResponse = shouldUseTodayClassDirectResponse(effectiveTranscription, detectedProgram, programs, history)
      ? buildTodayClassDirectResponse(detectedProgram, courses, new Date())
      : null;
    const directNextGroupResponse = shouldUseNextGroupDirectResponse(effectiveTranscription, detectedProgram, programs, history)
      ? buildNextGroupDirectResponse(detectedProgram, courses, new Date())
      : null;
    const directStudentResponse = buildStudentDirectResponse(effectiveTranscription, studentContext);
    
    // 7.7. Obtener información de la academia (dirección, redes, contacto)
    console.log("[POST /api/ai/audio] Obteniendo información de la academia...");
    const academy = await getAcademyInfo();

    let directIntentResponse = buildIntentFocusedDirectResponse(effectiveTranscription, detectedProgram, courses, academy, history, programs);
    if (directIntentResponse && isRepetitiveResponse(directIntentResponse, history, effectiveTranscription)) {
      const pendingTopic = inferPendingTopicFromHistory(history);
      if (pendingTopic) {
        const retriedDirectResponse = buildIntentFocusedDirectResponse(
          `${effectiveTranscription}. ${pendingTopic}.`,
          detectedProgram,
          courses,
          academy,
          history,
          programs
        );

        if (retriedDirectResponse && !isRepetitiveResponse(retriedDirectResponse, history, effectiveTranscription)) {
          directIntentResponse = retriedDirectResponse;
        }
      }

      if (directIntentResponse && isRepetitiveResponse(directIntentResponse, history, effectiveTranscription) && detectedProgram) {
        const forcedProgressResponse = buildIntentFocusedDirectResponse(
          `${effectiveTranscription}. quiero saber la inversion.`,
          detectedProgram,
          courses,
          academy,
          history,
          programs
        );

        if (forcedProgressResponse) {
          directIntentResponse = forcedProgressResponse;
        }
      }
    }
    
    // 7.8. Obtener medios de pago disponibles
    console.log("[POST /api/ai/audio] Obteniendo medios de pago...");
    const mediosPago = await getMediosPago();
    
    // 7.9. Contexto jerárquico CON PENSUM: info academia + medios pago + programas + grupos + temario detallado
    let hierarchicalContextBase = await buildHierarchicalContextWithPensum(programs, courses, detectedProgram, academy, mediosPago);
    let hierarchicalContext = studentContext?.contextText
      ? `${hierarchicalContextBase}\n\n${studentContext.contextText}`
      : hierarchicalContextBase;
    
    // 7.10. IMPORTANTE: Eliminar emojis del contexto para que el agente no los use en respuestas de audio
    hierarchicalContext = removeEmojis(hierarchicalContext);

    let agentResponse = directStudentResponse || directTodayResponse || directNextGroupResponse || directIntentResponse || "";
    if (!agentResponse) {
      // 8. Buscar conocimiento relevante
      const knowledgeChunks = await searchKnowledge(supabase, effectiveTranscription, 3);
      const studentDirective = studentContext
        ? 'Existe contexto de estudiante validado por identificación. Prioriza responder con sus cursos inscritos, su próxima clase y su estado real de pagos antes de información general.'
        : '';
      const contextualDirective = [
        buildContextualDirective(effectiveTranscription, detectedProgram),
        buildNameSafetyDirective(preferredStudentName),
        buildUpcomingStartDirective(detectedProgram, courses),
        studentDirective,
      ]
        .filter(Boolean)
        .join('\n');

      // 9. Generar respuesta del agente
      console.log("[POST /api/ai/audio] Generando respuesta del agente...");
      const prompt = buildAgentPrompt(
        settings || {},
        effectiveTranscription,
        knowledgeChunks,
        history,
        hierarchicalContext,
        contextualDirective
      );
      agentResponse = await generateResponse(geminiKey, prompt);

      if (isRepetitiveResponse(agentResponse, history, effectiveTranscription)) {
        console.warn("[anti-repeat-audio] Respuesta muy parecida. Regenerando...");
        const antiRepeatPrompt = `${prompt}

# ANTI-REPETICIÓN (OBLIGATORIO)
- Tu última respuesta fue demasiado parecida a la anterior.
- Responde específicamente a la nueva pregunta del usuario.
- Evita frases genéricas repetidas.
- Mantén respuesta natural para audio, concreta y útil.`;

        agentResponse = await generateResponse(geminiKey, antiRepeatPrompt);
      }
    }
    
    const fallbackResponse = settings?.fallback_response || "Déjame confirmarlo y te respondo en breve.";
    agentResponse = stripRepeatedGreetingPrefix(
      sanitizeAgentVisibleResponse(agentResponse, fallbackResponse),
      hasGreetingInHistory(history)
    );
    agentResponse = formatFinalWhatsAppResponse(agentResponse);

    // 9.5. IMPORTANTE: Eliminar emojis de la respuesta antes de convertir a audio
    const agentResponseClean = cleanForTTS(agentResponse);

    // 10. Guardar en historial de conversación (con emojis originales)
    await saveConversation(supabase, resolvedPhone, transcription, agentResponse, transcription);

    // 11. TTS: Convertir respuesta a audio (OPCIONAL - solo si Elevenlabs está configurado)
    let audioUrl = "";
    try {
      if (process.env.ELEVENLABS_API_KEY) {
        console.log("[POST /api/ai/audio] Convirtiendo respuesta a audio (TTS)...");
        // Usar la versión sin emojis para TTS
        const responseAudioBuffer = await textToSpeech(agentResponseClean);

        // 12. Subir audio a Supabase storage
        const timestamp = Date.now();
        const filename = `responses/${timestamp}-${resolvedPhone}.mp3`;
        console.log("[POST /api/ai/audio] Subiendo audio a Supabase:", filename);
        audioUrl = await uploadAudioToSupabase(supabase, responseAudioBuffer, filename);
      } else {
        console.warn("[POST /api/ai/audio] ELEVENLABS_API_KEY no configurada, omitiendo TTS");
      }
    } catch (ttsErr) {
      console.warn("[POST /api/ai/audio] Error en TTS, continuando sin audio:", ttsErr);
    }

    // Sanitizar respuesta para JSON válido
    const sanitizedResponse = sanitizeForJSON(agentResponse);
    const sanitizedTranscription = sanitizeForJSON(transcription);
    const sanitizedAgent = sanitizeForJSON(settings?.persona_name || "Dany");

    return NextResponse.json(withMediaSuggestion({
      ok: true,
      transcription: sanitizedTranscription || "",
      agent_response: sanitizedResponse || "",
      audio_url: audioUrl || "",
      agent: sanitizedAgent || "Dany",
      historyLength: Number(history.length) || 0,
    }, mediaSuggestion));
  } catch (error: any) {
    console.error("[POST /api/ai/audio] Error:", error);
    const errorMessage = error?.message || "Error procesando audio";
    return NextResponse.json(
      { 
        ok: false,
        error: String(errorMessage).substring(0, 200) // Limitar longitud del error
      },
      { status: 500 }
    );
  }
}
