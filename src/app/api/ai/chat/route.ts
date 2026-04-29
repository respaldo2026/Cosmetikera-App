import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import {
  getAgentImageSuggestion,
  withMediaSuggestion,
  type AgentIntent,
} from "@/utils/agent-media-suggestions";
import {
  getCustomerContext,
  logConversationMessage,
  buildContextualPrompt,
  extractThemeFromMessage,
  updateCustomerMemory,
  normalizePhone,
} from "@/utils/whatsapp-memory";

function normalize(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toDisplayName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractCustomerName(message: string): string | null {
  const raw = String(message || "").trim();
  if (!raw) return null;

  const match = raw.match(/(?:me\s+llamo|mi\s+nombre\s+es|soy)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]{2,}(?:\s+[a-zA-ZáéíóúÁÉÍÓÚñÑ]{2,}){0,2})/i);
  if (!match?.[1]) return null;

  const candidate = toDisplayName(match[1]);
  return candidate.length >= 2 ? candidate : null;
}

function looksRepeatedAnswer(current: string, previous: string): boolean {
  const a = normalize(current).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const b = normalize(previous).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length > 30 && b.length > 30 && (a.includes(b) || b.includes(a));
}

function detectIntent(message: string): AgentIntent {
  const m = normalize(message);
  if (/precio|cuanto|valor|costo|vale|promocion|oferta|descuento|economico|barato/.test(m)) return "precio";
  if (/hora|horario|cuando|dia|fecha|agenda|atienden|abren|cierran/.test(m)) return "horario";
  if (/rutina|pasos|orden|como usar|aplicar|primero|despues|protocolo/.test(m)) return "temario";
  if (/material|kit|insumo|herramienta|ingrediente|composicion|formula/.test(m)) return "materiales";
  if (/inscripcion|matricula|registr|cupo|reserv|agendar|cita/.test(m)) return "inscripcion";
  if (/requisito|necesito|debo llevar|condicion|contraindicacion|alergia/.test(m)) return "requisitos";

  // Consultas comunes de belleza (mujeres y hombres)
  if (/acne|grano|espinilla|mancha|melasma|arruga|poro|piel grasa|piel seca|piel mixta|brillo|rosacea|sensibilidad|dermatitis/.test(m)) return "general";
  if (/caida|quiebre|frizz|caspa|reseco|ondulado|rizado|alisado|keratina|botox capilar|tinte|decoloracion|matiz|tonalizar|barba|cuero cabelludo|porosidad|afro/.test(m)) return "general";
  if (/maquillaje|base|corrector|labial|pestanas|cejas|uñas|unas|acrilicas|acrilico|gel|semipermanente|esmalte|perfume|fragancia|duracion|transferencia|oxidacion/.test(m)) return "general";

  return "general";
}

function buildBeautyKnowledgeContext(): string {
  return [
    "- Marco de asesoria profesional: Diagnosticar -> Recomendar -> Explicar uso -> Confirmar preferencia/presupuesto.",
    "- Piel grasa/acne: limpieza suave, niacinamida, acido salicilico, hidratante ligera no comedogenica, protector solar diario.",
    "- Piel seca/sensible: limpiador cremoso, ceramidas, acido hialuronico, pantenol, protector solar hidratante.",
    "- Manchas/melasma: vitamina C de dia + protector solar de amplio espectro; de noche despigmentantes suaves segun tolerancia.",
    "- Anti-edad: retinoides nocturnos progresivos + antioxidantes de dia + fotoproteccion estricta.",
    "- Cabello con frizz/resequedad: shampoo suave, mascarilla nutritiva 2-3 veces/semana, sellado con leave-in/aceite ligero.",
    "- Tintes: evaluar base natural/teñida, historial químico y objetivo de tono; recomendar cuidado de color y mantenimiento.",
    "- Decoloracion: priorizar salud capilar, evaluar elasticidad/porosidad, recomendar protección de enlaces, matizante e hidratación intensiva.",
    "- Alisados/keratina: validar estado del cabello antes del proceso, recomendar shampoo sin sal/sulfatos y protector térmico para prolongar resultado.",
    "- Cabello afro/rizado: enfoque en hidratación + nutrición + definición; sugerir técnicas de bajo calor, leave-in y sellado para evitar quiebre.",
    "- Caida capilar: identificar si es quiebre o caida de raiz; sugerir rutina fortalecedora y recomendar consulta profesional si es persistente.",
    "- Cuero cabelludo graso/caspa: limpieza regular, activos anticaspa, evitar exceso de calor y acumulacion de residuos.",
    "- Maquillaje larga duracion: preparar piel, base por tipo de piel, sellar por zonas, fijador para eventos.",
    "- Uñas acrílicas: evaluar estado de uña natural, recomendar preparación correcta, control de grosor y mantenimiento/relleno.",
    "- Uñas en gel/semipermanente: preparación suave, curado correcto, sellado y retiro seguro para evitar daño de lámina ungueal.",
    "- Unas: base tratante segun necesidad (fortalecer/hidratar/proteger), color, top coat para duracion.",
    "- Fragancias: recomendar por ocasion (dia/noche), intensidad deseada y clima (calido/fresco).",
    "- Regla de seguridad: no dar diagnosticos medicos ni promesas absolutas; ante irritacion importante sugerir evaluacion dermatologica.",
    "- Regla de combinacion: si recomiendas activos potentes, sugiere introducirlos gradualmente y vigilar tolerancia.",
    "- Cierre comercial consultivo: ofrecer 2-3 opciones, mencionar beneficio principal, precio y siguiente paso de compra.",
  ].join("\n");
}

type CatalogArticle = {
  nombre?: string | null;
  categoria?: string | null;
  marca?: string | null;
  referencia?: string | null;
  codigo_barras?: string | null;
  descripcion?: string | null;
  precio_venta?: number | null;
  stock?: number | null;
  descuento_porcentaje?: number | null;
  promocion_texto?: string | null;
  activo?: boolean | null;
  updated_at?: string | null;
};

const STOPWORDS = new Set([
  "de",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "por",
  "para",
  "con",
  "sin",
  "que",
  "cual",
  "cuanto",
  "cuesta",
  "precio",
  "vale",
  "del",
  "al",
  "me",
  "mi",
  "quiero",
  "tienen",
  "tienes",
  "hay",
  "en",
  "y",
  "o",
]);

function getSearchTokens(message: string): string[] {
  return normalize(message)
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, "").trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function rankArticles(
  articles: CatalogArticle[],
  tokens: string[],
  intent: AgentIntent,
): CatalogArticle[] {
  const scored = articles.map((article) => {
    const searchable = normalize(
      [
        article.nombre,
        article.marca,
        article.categoria,
        article.referencia,
        article.codigo_barras,
        article.descripcion,
        article.promocion_texto,
      ]
        .filter(Boolean)
        .join(" "),
    );

    let score = 0;
    for (const token of tokens) {
      if (normalize(article.nombre).includes(token)) score += 10;
      if (normalize(article.marca).includes(token)) score += 6;
      if (normalize(article.categoria).includes(token)) score += 5;
      if (normalize(article.referencia).includes(token)) score += 8;
      if (searchable.includes(token)) score += 2;
    }

    if (Number(article.descuento_porcentaje || 0) > 0) score += 3;
    if (intent === "precio") score += 2;
    if (Number(article.stock || 0) > 0) score += 1;

    return { article, score };
  });

  const matched = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (Number(b.article.descuento_porcentaje || 0) !== Number(a.article.descuento_porcentaje || 0)) {
        return Number(b.article.descuento_porcentaje || 0) - Number(a.article.descuento_porcentaje || 0);
      }
      return new Date(String(b.article.updated_at || 0)).getTime() - new Date(String(a.article.updated_at || 0)).getTime();
    })
    .map((item) => item.article);

  if (matched.length >= 20) return matched.slice(0, 40);

  const offers = articles
    .filter((a) => Number(a.descuento_porcentaje || 0) > 0)
    .sort((a, b) => Number(b.descuento_porcentaje || 0) - Number(a.descuento_porcentaje || 0));

  const recent = [...articles].sort(
    (a, b) => new Date(String(b.updated_at || 0)).getTime() - new Date(String(a.updated_at || 0)).getTime(),
  );

  const result: CatalogArticle[] = [...matched];
  for (const candidate of [...offers, ...recent]) {
    if (result.length >= 40) break;
    if (!result.includes(candidate)) result.push(candidate);
  }

  return result;
}

function buildProductContext(
  articles: CatalogArticle[],
  message: string,
  intent: AgentIntent,
): string {
  const tokens = getSearchTokens(message);
  const ranked = rankArticles(articles, tokens, intent).slice(0, 35);

  return ranked
    .map((p) => {
      const precio = formatCOP(Number(p.precio_venta || 0));
      const stock = Number(p.stock || 0);
      const stockText = stock > 0 ? `stock: ${stock}` : "stock: agotado";
      const descuento = Number(p.descuento_porcentaje || 0) > 0 ? ` | descuento: ${p.descuento_porcentaje}%` : "";
      const promoText = p.promocion_texto ? ` | promo: ${String(p.promocion_texto)}` : "";

      return `- ${p.nombre || "Artículo"} | marca: ${p.marca || "N/A"} | categoria: ${p.categoria || "general"} | precio: ${precio} | ${stockText}${descuento}${promoText}`;
    })
    .join("\n");
}

function buildSalesAdvisoryContext(
  articles: CatalogArticle[],
  message: string,
  intent: AgentIntent,
): string {
  const tokens = getSearchTokens(message);
  const top = rankArticles(articles, tokens, intent).slice(0, 3);

  if (top.length === 0) {
    return "(sin coincidencias claras para asesoria)";
  }

  return top
    .map((p) => {
      const beneficio = String(p.descripcion || p.promocion_texto || "").replace(/\s+/g, " ").trim();
      const beneficioCorto = beneficio ? beneficio.slice(0, 140) : "Producto de alta rotacion en tienda.";
      const recomendacion = p.categoria
        ? `Sugerir segun necesidad en categoria ${p.categoria}.`
        : "Validar objetivo del cliente para recomendar la opcion correcta.";

      return `- ${p.nombre || "Articulo"} | beneficio: ${beneficioCorto}${beneficio.length > 140 ? "..." : ""} | recomendacion: ${recomendacion}`;
    })
    .join("\n");
}

function buildHeuristicFallbackResponse(params: {
  customerName: string;
  message: string;
  intent: AgentIntent;
  articles: CatalogArticle[];
  lastBotMessage?: string;
}): string {
  const { customerName, message, intent, articles } = params;
  const greeting = customerName ? `Hola ${customerName}` : "Hola";
  const top = rankArticles(articles, getSearchTokens(message), intent).slice(0, 2);
  const normalizedMessage = normalize(message);

  const hasSkinConcern = /acne|grano|espinilla|mancha|melasma|arruga|poro|piel grasa|piel seca|piel mixta|brillo/.test(normalizedMessage);
  const hasHairConcern = /caida|quiebre|frizz|caspa|reseco|ondulado|rizado|alisado|tinte|decoloracion/.test(normalizedMessage);
  const hasMakeupConcern = /maquillaje|base|corrector|labial|pestanas|cejas|esmalte/.test(normalizedMessage);
  const hasColorConcern = /tinte|coloracion|decoloracion|mechas|balayage|matiz|tonalizar|rubio|castano|negro|rojizo/.test(normalizedMessage);
  const hasStraighteningConcern = /alisado|keratina|botox capilar|planchado|repolarizacion/.test(normalizedMessage);
  const hasAfroConcern = /afro|rizo tipo 3|rizo tipo 4|coily|crespo/.test(normalizedMessage);
  const hasNailTechConcern = /acrilicas|acrilico|uñas en gel|unas en gel|semipermanente|polygel|gel x/.test(normalizedMessage);
  const asksPoints = /puntos|club|fidelizacion|canje|beneficio/.test(normalizedMessage);
  const asksName = /sabes\s+mi\s+nombre|cual\s+es\s+mi\s+nombre|mi\s+nombre\??/.test(normalizedMessage);
  const asksNails = /uñas|unas|nail|semipermanente|acrilicas/.test(normalizedMessage);
  const isGreeting = /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hello|hey)\b/.test(normalizedMessage);
  const isShortQuestion = normalizedMessage.split(/\s+/).filter(Boolean).length <= 2;

  // --- Detección de continuidad conversacional ---
  const lastBot = normalize(params.lastBotMessage || "");
  const isFollowUpHair = /cabello|pelo|shampoo|mascarilla|frizz|caida|rizado|ondulado|tinte|decoloracion|alisado|keratina|afro/.test(lastBot);
  const isFollowUpSkin = /piel|acne|manchas|serum|hidratante|poro|grasa|seca|mixta/.test(lastBot);
  const isFollowUpNails = /unas|esmalte|semipermanente|gel|acrilica|acrilicas|polygel|gel x|nail/.test(lastBot);
  const isFollowUpMakeup = /maquillaje|base|corrector|evento|diario/.test(lastBot);
  const msgWords = normalizedMessage.split(/\s+/).filter(Boolean).length;
  const isShortFollowUp = msgWords <= 6 && lastBot.length > 10;

  // --- Respuesta inteligente a mensajes de seguimiento (sin necesidad de Gemini) ---
  if (isShortFollowUp && isFollowUpHair && !hasHairConcern) {
    const hairType = message.trim();
    return `💇 ¡Perfecto! Para cabello *${hairType}* te recomiendo:\n1) *Shampoo sin sulfatos* suave para ese tipo de cabello\n2) *Mascarilla hidratante* 2 veces por semana 💧\n3) *Sérum o aceite vegetal* en las puntas\n¿Tienes más preocupación: frizz, caída o resequedad?`;
  }

  if (isShortFollowUp && isFollowUpNails && !hasNailTechConcern && !asksNails) {
    return `💅 Perfecto. Sobre lo que veníamos de *uñas*, dime si prefieres:
1) *Acrílicas* (más estructura)
2) *Gel/semipermanente* (acabado flexible)
3) *Natural fortalecida*
Y te recomiendo el protocolo ideal.`;
  }

  if (isShortFollowUp && isFollowUpSkin && !hasSkinConcern) {
    const skinType = message.trim();
    return `✨ ¡Entendido! Para piel *${skinType}* la rutina ideal es:\n1) *Limpieza suave* mañana y noche\n2) *Hidratante ligera* no comedogénica\n3) *Protector solar* diario ☀️\n¿Te preocupa más el acné, las manchas o la resequedad?`;
  }

  if (isShortFollowUp && isFollowUpNails && !asksNails) {
    const nailDetail = message.trim();
    return `💅 ¡Entendido! Para uñas *${nailDetail}* te sugiero:\n1) *Base nutritiva* protege la lámina\n2) *Esmalte de larga duración* con color definido\n3) *Top coat* brillo y sellado final\n¿Quieres acabado natural, elegante o llamativo?`;
  }

  if (isShortFollowUp && isFollowUpMakeup && !hasMakeupConcern) {
    return `💄 ¡Listo! Para *${message.trim()}* te recomiendo:\n1) *Base ligera* de larga duración\n2) *Corrector hidratante* que nivela el tono\n3) *Polvo fijador* para sellado suave\n¿Lo quieres para uso diario o para un evento especial?`;
  }

  const closeByIntent =
    hasSkinConcern
      ? "¿Tu piel es grasa, seca o mixta para afinarte la recomendación?"
      : hasHairConcern
      ? "¿Tu cabello es liso, ondulado o rizado para recomendarte mejor?"
      : hasMakeupConcern
      ? "¿Lo quieres para uso diario o para ocasión especial?"
      : "¿Te gustaría que te recomiende 2 opciones según tu necesidad exacta?";

  if (intent === "precio" && top.length > 0) {
    const lines = top.map((p) => {
      const price = formatCOP(Number(p.precio_venta || 0));
      const discount = Number(p.descuento_porcentaje || 0) > 0 ? ` (${p.descuento_porcentaje}% OFF)` : "";
            return `• *${p.nombre || "Producto"}*: ${price}${discount}`;
    });
    return `${greeting}. Te comparto opciones reales:\n${lines.join("\n")}\n${closeByIntent}`;
  }

  if ((intent === "materiales" || intent === "temario") && top.length > 0) {
    const p = top[0];
    if (!p) {
      return `${greeting}. Entiendo tu consulta y te puedo recomendar opciones concretas. ${closeByIntent}`;
    }
    return `${greeting}. Para eso te recomiendo ${p.nombre || "esta opción"}, porque ${p.descripcion || "funciona muy bien para ese objetivo"}. ${closeByIntent}`;
  }

  if (intent === "horario") {
    return `${greeting}. Te ayudo con el horario de atención enseguida. Si quieres, de una vez te dejo preseleccionados productos según tu necesidad para que compres más rápido.`;
  }

  if (asksName) {
    if (customerName) {
      return `😊 Sí, te tengo registrado como *${customerName}*. ¿Quieres que te recomiende algo para piel, cabello, maquillaje o uñas hoy?`;
    }
    return `😊 Aún no tengo tu nombre guardado. Cuéntame: *¿cómo te llamas?* Así personalizo mejor cada recomendación.`;
  }

  if (asksPoints) {
    return `🎁 Te ayudo con tus *puntos del Club*. Para validarlos sin error, compárteme tu *cédula* y te indico saldo, nivel y opciones de canje.`;
  }

  if (asksNails) {
    if (top.length > 0) {
      const p = top[0];
      const price = p ? formatCOP(Number(p.precio_venta || 0)) : "";
      const priceText = price && Number(p?.precio_venta || 0) > 0 ? ` a *${price}*` : "";
      return `💅 ¡Claro! Para *uñas* tenemos *${p?.nombre || "opciones disponibles"}*${priceText}. ${p?.descripcion ? String(p.descripcion).slice(0, 100) : "Excelente para fortalecer y dar duración."}\nTambién podemos asesorarte en:\n1) *Fortalecer*: base vitaminada\n2) *Duración*: semipermanente\n3) *Acabado*: top coat gel\n¿Quieres acabado natural, elegante o llamativo?`;
    }
    return `💅 ¡Claro! Para *uñas* te recomiendo según objetivo:\n1) *Fortalecer*: base vitaminada\n2) *Duración*: esmalte semipermanente\n3) *Acabado profesional*: top coat gel\n¿Quieres acabado natural, elegante o llamativo?`;
  }

  // Responder útil aunque no haya coincidencias en catálogo
  if (hasSkinConcern && top.length === 0) {
     return `✨ ${greeting}. Para *acné/manchas/resequedad* te sugiero esta rutina:\n1) *Limpieza suave*\n2) *Hidratante no comedogénica*\n3) *Protector solar diario* ☀️\nSi me dices si tu piel es grasa, seca o mixta, te la personalizo.`;
  }

  if (hasHairConcern && top.length === 0) {
     return `💇 ${greeting}. Para *frizz/caída/resequedad* del cabello te sirve:\n1) *Shampoo suave*\n2) *Mascarilla hidratante* 2-3 veces/semana\n3) *Protector térmico* antes de calor 🔥\n¿Tu cabello es liso, ondulado o rizado?`;
  }

  if (hasColorConcern && top.length === 0) {
    return `🎨 ${greeting}. Para *tinte/decoloración* te recomiendo este plan base:\n1) Evaluar historial químico y estado actual\n2) Usar *tratamiento reparador* post proceso\n3) Mantener color con *shampoo para color* + matizante según tono\n¿Buscas cubrir canas, cambio total o corrección de color?`;
  }

  if (hasStraighteningConcern && top.length === 0) {
    return `✨ ${greeting}. Para *alisados/keratina* lo ideal es:\n1) Revisar porosidad y resistencia del cabello\n2) Elegir proceso según objetivo (control frizz vs alisado profundo)\n3) Mantener con *shampoo sin sal/sulfatos* y protector térmico\n¿Quieres resultado natural o efecto liso intenso?`;
  }

  if (hasAfroConcern && top.length === 0) {
    return `🌀 ${greeting}. Para *cabello afro/rizado* te funciona:\n1) Hidratación por capas (leave-in + crema)\n2) Sellado ligero para retener humedad\n3) Definición sin calor excesivo\n¿Tu objetivo principal es definición, crecimiento o menos quiebre?`;
  }

  if (hasNailTechConcern && top.length === 0) {
    return `💅 ${greeting}. Para *uñas acrílicas/gel* te sugiero:\n1) Preparación correcta de uña natural\n2) Producto según durabilidad deseada\n3) Retiro técnico para evitar daño\n¿Prefieres duración máxima, acabado natural o diseño artístico?`;
  }

  if (hasMakeupConcern && top.length === 0) {
     return `💄 ${greeting}. En *maquillaje* te guío según tu tipo de piel:\n1) *Base ligera* de larga duración\n2) *Corrector hidratante*\n3) *Sellado suave*\n¿Lo quieres para uso diario o para evento?`;
  }

  if (top.length > 0) {
    const p = top[0];
    if (!p) {
      return `${greeting}. Te puedo recomendar opciones concretas según tu necesidad. ${closeByIntent}`;
    }
    const price = formatCOP(Number(p.precio_venta || 0));
     return `✅ ${greeting}. Según lo que me cuentas, una muy buena opción es *${p.nombre || "este producto"}* (${price}). ${p.descripcion ? String(p.descripcion).slice(0, 110) : "Te da muy buen resultado y buena relación calidad-precio."} ${closeByIntent}`;
  }

  if (isGreeting || isShortQuestion) {
     return `👋 ${greeting}. Aquí estoy para ayudarte con *belleza* de forma práctica: piel, cabello, maquillaje, uñas y barba. Cuéntame tu necesidad puntual (ej: acné, resequedad, frizz, caída o presupuesto) y te respondo con pasos concretos.`;
  }

    return `✨ ${greeting}. Claro que sí, te asesoro en *belleza* para mujer u hombre: piel, cabello, maquillaje, barba, uñas y rutinas. Cuéntame qué te preocupa (acné, manchas, frizz, caída o resequedad) y te doy opciones concretas.`;
}

function isAuthorized(req: NextRequest): boolean {
  const received = req.headers.get("x-api-key") || "";
  const expected = process.env.WHATSAPP_API_KEY || process.env.AGENT_API_KEY || "";

  // Si no hay llave configurada en servidor, permitir (modo transición)
  if (!expected) return true;

  // Si hay llave esperada, exigir coincidencia
  return received === expected;
}

async function generateWithModelFallback(
  genAI: GoogleGenerativeAI,
  prompt: string,
): Promise<string> {
  const candidates = [
    process.env.GEMINI_MODEL_CHAT,
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-002",
    "gemini-1.5-pro",
  ].filter(Boolean) as string[];

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: candidate });
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout-${candidate}`)), 7000),
        ),
      ]);
      const text = result.response.text().trim();
      if (text) return text;
    } catch (err) {
      lastError = err;
      const message = String((err as Error)?.message || "").toLowerCase();
      if (
        message.includes("404") ||
        message.includes("not found") ||
        message.includes("unsupported") ||
        message.includes("429") ||
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("resource exhausted") ||
        message.includes("timeout-")
      ) {
        continue;
      }
      throw err;
    }
  }

  // Si no hubo modelo disponible o todos fallaron por cuota/límite,
  // devolvemos vacío y la ruta aplicará un mensaje fallback en vez de 500.
  if (lastError) {
    console.warn("[ai/chat] Gemini no disponible, usando fallback de texto", lastError);
  }
  return "";
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const message = String(
      body?.mensaje_whatsapp || body?.message_body || body?.message || body?.texto || ""
    ).trim();

    if (!message) {
      return NextResponse.json({ error: "mensaje_whatsapp requerido" }, { status: 400 });
    }

    // Extraer ID del cliente y número de teléfono
    const perfil_id = body?.perfil_id || body?.customer_id || "";
    const nameFromPayload = toDisplayName(
      String(body?.nombre || body?.contact_name || body?.profile_name || "").trim()
    );
    const rawTelefono = String(
      body?.telefono ||
        body?.phone ||
        body?.numero_whatsapp ||
        body?.telefono_whatsapp ||
        body?.wa_id ||
        ""
    );
    const telefono = rawTelefono ? normalizePhone(rawTelefono) : "";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Faltan credenciales Supabase" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [assetsRes, articulosRes] = await Promise.all([
      supabase
        .from("marketing_assets")
        .select("id,titulo,descripcion,descripcion_ia,tipo_asset,url_archivo,keywords,categoria,programa_id,estado,visible_para_ia,created_at")
        .eq("visible_para_ia", true)
        .limit(80),
      supabase
        .from("articulos")
        .select("nombre,categoria,marca,referencia,codigo_barras,descripcion,precio_venta,stock,descuento_porcentaje,promocion_texto,activo,updated_at")
        .or("activo.is.null,activo.eq.true")
        .order("updated_at", { ascending: false })
        .limit(1500),
    ]);

    const intent = detectIntent(message);

    const assets = Array.isArray(assetsRes.data) ? assetsRes.data : [];
    const articulos = Array.isArray(articulosRes.data) ? (articulosRes.data as CatalogArticle[]) : [];

    const contextoAssets = assets
      .slice(0, 20)
      .map((a) => {
        const kws = Array.isArray(a.keywords) ? a.keywords.join(", ") : String(a.keywords || "");
        return `- ${a.titulo || "Material"} | categoria: ${a.categoria || "general"} | desc: ${a.descripcion_ia || a.descripcion || ""} | keywords: ${kws}`;
      })
      .join("\n");

    const contextoArticulos = buildProductContext(articulos, message, intent);
    const contextoAsesoria = buildSalesAdvisoryContext(articulos, message, intent);
    const contextoBellezaExperta = buildBeautyKnowledgeContext();

    // ===== INTEGRACIÓN DE MEMORIA =====
    let customerContext = null;
    let customerName = "";
    let trustLevel = "nuevo";
    let previousTheme = "";
    const extractedName = extractCustomerName(message);

    if (telefono) {
      try {
        customerContext = await getCustomerContext(supabase, telefono);
        if (customerContext) {
          customerName = customerContext.nombre || "";
          trustLevel = customerContext.nivelConfianza || "nuevo";
          previousTheme = customerContext.ultimoTema || "";
        }
      } catch (memoryError) {
        console.warn("[ai/chat] Error recuperando contexto del cliente", memoryError);
      }
    }

    // Prioridad de nombre: mensaje actual > payload > memoria previa
    customerName = extractedName || nameFromPayload || customerName;

    let responseText = "";

    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);

      // Construir prompt con personalización por relación
      let toneInstruction = "";
      if (trustLevel === "leal") {
        toneInstruction =
          "Este es un cliente muy leal. Usa su nombre, recuerda temas previos, sé muy personal y cálido. Busca profundizar la relación.";
      } else if (trustLevel === "conocido") {
        toneInstruction =
          "Este es un cliente conocido. Usa su nombre naturalmente, refiere temas previos si es relevante, sé amable y confiable.";
      } else {
        toneInstruction =
          "Este es un cliente nuevo. Sé acogedor, intenta identificar sus necesidades, presenta opciones concretas.";
      }

      // Construir historial de conversación previo en orden cronológico consistente
      const historialPrevio = customerContext?.historialReciente ?? [];
      const historialOrdenado = [...historialPrevio]
        .sort((a, b) => new Date(a.hora).getTime() - new Date(b.hora).getTime())
        .slice(-8);
      const customerMemoryContext = historialOrdenado.length > 0
          ? `--- Historial REAL de esta conversación con ${customerName || "el cliente"} ---\n${historialOrdenado
              .map((m: { rol: string; mensaje: string }) =>
                `${m.rol === "cliente" ? "👤 Cliente" : "🤖 Asesor"}: ${m.mensaje}`
              )
              .join("\n")}\n--- Fin historial ---\nÚltimo tema tratado: ${previousTheme || "ninguno"}\nNivel de relación: ${trustLevel}`
          : `(primera vez que escribe este número)\nNivel: ${trustLevel}`;

      const prompt = [
        "Eres Dany, asesora virtual experta en belleza integral de La Cosmetikera (WhatsApp).",
        toneInstruction,
        "Reglas OBLIGATORIAS:",
        "- Responde en español colombiano natural, cálido y conversacional, máximo 4-6 líneas.",
        "- Haz respuestas didácticas y fáciles de aplicar en casa.",
        "- Usa de 1 a 3 emojis útiles por respuesta (sin saturar).",
        "- Resalta palabras clave con formato de WhatsApp: *palabra clave*.",
        "- Si explicas rutina, usa mini pasos claros: 1) ... 2) ... 3) ...",
        "- Evita repetir saludos largos en cada mensaje; responde directo al punto cuando ya hay contexto.",
        "- Si preguntan por su nombre, reconócelo si está disponible; si no, pide el nombre en una pregunta corta.",
        "- Si preguntan por puntos/club, solicita cédula para validar saldo y canjes.",
        "- Atiende tanto a mujeres como a hombres con lenguaje inclusivo y cercano.",
        "- Asesora por necesidad real: piel, cabello, maquillaje, uñas, barba, rutina y fragancias.",
        "- Si detectas problema (acné, manchas, frizz, caída, resequedad, sensibilidad), primero valida necesidad y luego recomienda.",
        "- Antes de recomendar, haz mini diagnóstico con 1-2 preguntas clave (tipo de piel/cabello, objetivo, frecuencia de uso, presupuesto).",
        "- Entrega recomendación en formato asesor: problema -> rutina sugerida -> producto(s) del catálogo -> beneficio -> cómo usar.",
        "- Especialízate en: cabello (tintes, decoloración, alisados, afro/rizado, cuidado capilar), uñas (acrílicas, gel, semipermanente) y diagnóstico de rutina.",
        "- Si el cliente responde corto (ej: 'sí', 'ese', 'ondulado', 'afro', 'en gel'), NO pierdas el hilo: conecta con la última pregunta y continúa la asesoría.",
        "- Si el cliente pide consejo general, responde con criterio técnico de belleza y aterriza en productos reales del catálogo.",
        "- USA el historial de conversación para dar continuidad REAL (no repitas saludos si ya conversaron).",
        "- Si el cliente ya preguntó algo antes, recuérdalo y conecta la respuesta.",
        "- No inventes precios ni stock; usa SOLO el contexto de productos dado.",
        "- Si hay precio disponible, SIEMPRE dilo en formato $X.XXX COP.",
        "- Si hay descuento, menciónalo siempre (genera urgencia).",
        "- Al dar precio: agrega 1 beneficio clave del producto + recomendación breve de uso.",
        "- Cierra siempre con una pregunta útil para seguir asesorando o concretar compra.",
        "- Si no tienes el producto, di exactamente qué tienes similar y ofrece alternativas.",
        "- Nunca hagas afirmaciones médicas absolutas ni prometas resultados imposibles.",
        "",
        "[CONOCIMIENTO TÉCNICO DE BELLEZA - úsalo para asesorar mejor]:",
        contextoBellezaExperta,
        "",
        customerName ? `[CLIENTE: ${customerName}]` : "[CLIENTE: nuevo]",
        customerMemoryContext,
        "",
        `[MENSAJE ACTUAL del cliente]: ${message}`,
        `[Intención detectada]: ${intent}`,
        "",
        "[CATÁLOGO DISPONIBLE - úsalo para responder con precios reales]:",
        contextoArticulos || "(catálogo no disponible)",
        "",
        "[ASESORÍA COMERCIAL - top productos relevantes]:",
        contextoAsesoria || "(sin coincidencias)",
        "",
        assets.length > 0 ? "[MATERIALES DE MARKETING]:" : "",
        assets.length > 0 ? (contextoAssets || "") : "",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        responseText = await generateWithModelFallback(genAI, prompt);
      } catch (modelError) {
        console.warn("[ai/chat] Error no recuperable de Gemini", modelError);
        responseText = "";
      }
    }

    // Último mensaje del agente (para contexto de continuidad)
    const lastAgentMessage = [...(customerContext?.historialReciente || [])]
      .reverse()
      .find((m: { rol: string; mensaje: string }) => m.rol === "agente")?.mensaje ?? "";

    if (!responseText) {
      responseText = buildHeuristicFallbackResponse({
        customerName,
        message,
        intent,
        articles: articulos,
        lastBotMessage: lastAgentMessage,
      });
    }

    // Evitar respuestas repetidas consecutivas cuando Gemini/fallback se estancan

    if (lastAgentMessage && looksRepeatedAnswer(responseText, lastAgentMessage)) {
      responseText = buildHeuristicFallbackResponse({
        customerName,
        message,
        intent,
        articles: articulos,
        lastBotMessage: lastAgentMessage,
      });
    }

    // ===== REGISTRAR MENSAJES EN MEMORIA =====
    if (telefono) {
      try {
        const detectedTheme = extractThemeFromMessage(message);
        // Guardar mensaje del cliente + respuesta del agente + actualizar memoria en paralelo
        await Promise.all([
          logConversationMessage(supabase, telefono, perfil_id || undefined, "cliente", message),
          logConversationMessage(supabase, telefono, perfil_id || undefined, "agente", responseText),
          // SIEMPRE actualizar memoria (incrementa contador → sube nivel de confianza)
          updateCustomerMemory(supabase, telefono, perfil_id || undefined, customerName || undefined, detectedTheme || undefined),
        ]);

        // Compatibilidad con despliegues que aún usan tabla legacy de conversaciones
        const legacyInsert = await supabase.from("agent_conversations").insert({
          phone_number: telefono,
          user_message: message,
          agent_response: responseText,
          created_at: new Date().toISOString(),
        });

        if (legacyInsert.error) {
          console.warn("[ai/chat] Legacy agent_conversations no disponible:", legacyInsert.error.message);
        }
      } catch (logError) {
        console.warn("[ai/chat] Error registrando mensajes en memoria", logError);
      }
    }

    // Sugerencia de imagen para la rama "Con imagen"
    const mediaSuggestion = await getAgentImageSuggestion(supabase, {
      message,
      intent,
    });

    const payload = withMediaSuggestion(
      {
        response: responseText,
        intent,
      },
      mediaSuggestion,
    );

    return NextResponse.json(payload);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 },
    );
  }
}
