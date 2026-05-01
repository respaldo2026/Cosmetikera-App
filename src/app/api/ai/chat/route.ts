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

type GreetingStyle =
  | "buenos_dias"
  | "buenas_tardes"
  | "buenas_noches"
  | "holi"
  | "que_mas"
  | "hola"
  | "none";

type BeautyDomain = "cabello" | "piel" | "unas" | "maquillaje";

function detectGreetingStyle(message: string): GreetingStyle {
  const m = normalize(message);
  if (!m) return "none";
  if (/\bbuenos\s+dias\b/.test(m)) return "buenos_dias";
  if (/\bbuenas\s+tardes\b/.test(m)) return "buenas_tardes";
  if (/\bbuenas\s+noches\b/.test(m)) return "buenas_noches";
  if (/\bholi\b/.test(m)) return "holi";
  if (/\bque\s+mas\b|\bq\s+mas\b|\bqlq\b/.test(m)) return "que_mas";
  if (/\bhola\b|\bbuenas\b|\bhello\b|\bhey\b/.test(m)) return "hola";
  return "none";
}

function buildHumanGreeting(style: GreetingStyle, customerName: string): string {
  const named = customerName ? ` ${customerName}` : "";
  switch (style) {
    case "buenos_dias":
      return `¡Buenos días${named}! ☀️`;
    case "buenas_tardes":
      return `¡Buenas tardes${named}! 🌸`;
    case "buenas_noches":
      return `¡Buenas noches${named}! ✨`;
    case "holi":
      return `¡Holi${named}! 😊`;
    case "que_mas":
      return `¡Qué más${named}! 😄`;
    case "hola":
      return `¡Hola${named}! 👋`;
    default:
      return customerName ? `Hola ${customerName}` : "Hola";
  }
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
  // Solo considerar repetición si son prácticamente idénticos (>90% similitud)
  if (a === b) return true;
  // Solo marcar como repetido si uno contiene al otro Y ambos son muy largos (>80 chars)
  if (a.length > 80 && b.length > 80 && a === b) return true;
  // Verificar similitud de inicio: si los primeros 60 chars son iguales es repetición
  if (a.length > 60 && b.length > 60 && a.slice(0, 60) === b.slice(0, 60)) return true;
  return false;
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

function detectBeautyDomain(message: string): BeautyDomain | null {
  const m = normalize(message);
  if (!m) return null;
  if (/unas|uñas|esmalte|acrilica|acrilicas|gel|semipermanente|polygel|top coat|manicure|nail/.test(m)) {
    return "unas";
  }
  if (/maquillaje|base|corrector|labial|rubor|polvo|primer|sombras|pestanas|cejas/.test(m)) {
    return "maquillaje";
  }
  if (/cabello|pelo|capilar|shampoo|acondicionador|mascarilla|frizz|caspa|caida|rizado|ondulado|afro|alisado|keratina|tinte|decoloracion/.test(m)) {
    return "cabello";
  }
  if (/piel|acne|grano|espinilla|mancha|melasma|arruga|poro|serum|hidratante|protector solar|facial/.test(m)) {
    return "piel";
  }
  return null;
}

function isDateTimeQuestion(message: string): boolean {
  const m = normalize(message);
  return /(que\s+dia\s+es\s+hoy|que\s+fecha\s+es\s+hoy|fecha\s+de\s+hoy|hoy\s+que\s+dia|hoy\s+es|sabes\s+que\s+dia|que\s+hora\s+es|hora\s+es|me\s+dices\s+la\s+hora)/.test(m);
}

function buildDateTimeDirectReply(customerName: string, message: string): string | null {
  if (!isDateTimeQuestion(message)) return null;

  const now = new Date();
  const dia = new Intl.DateTimeFormat("es-CO", { weekday: "long" }).format(now);
  const fecha = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);
  const hora = new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  const named = customerName ? ` ${customerName}` : "";
  return `Hola${named}. Hoy es ${dia}, ${fecha}, y son las ${hora}. ¿Quieres que te ayude también con uñas, piel, cabello o maquillaje?`;
}

function detectRejectedDomainsFromMessage(message: string): BeautyDomain[] {
  const m = normalize(message);
  if (!m) return [];
  if (!/(no\s+quiero|no\s+me\s+interesa|no\s+me\s+gusta|no\s+busco|no\s+deseo|no\s+necesito|sin\s+)/.test(m)) {
    return [];
  }

  const rejected: BeautyDomain[] = [];
  if (/cabello|pelo|capilar/.test(m)) rejected.push("cabello");
  if (/piel|facial|acne|mancha/.test(m)) rejected.push("piel");
  if (/unas|uñas|esmalte|gel|acrilica|acrilicas|manicure|nail/.test(m)) rejected.push("unas");
  if (/maquillaje|base|corrector|labial|rubor|primer|cejas|pestanas/.test(m)) rejected.push("maquillaje");
  return rejected;
}

function collectRejectedDomains(
  message: string,
  conversationHistory: Array<{ rol: string; mensaje: string }>,
): Set<BeautyDomain> {
  const result = new Set<BeautyDomain>();
  const historyClientMessages = conversationHistory
    .filter((row) => row.rol === "cliente")
    .slice(-12)
    .map((row) => String(row.mensaje || ""));

  for (const text of [...historyClientMessages, message]) {
    for (const domain of detectRejectedDomainsFromMessage(text)) {
      result.add(domain);
    }
  }

  return result;
}

function responseMentionsDomain(text: string, domain: BeautyDomain): boolean {
  const t = normalize(text);
  if (!t) return false;

  switch (domain) {
    case "cabello":
      return /cabello|pelo|shampoo|mascarilla|capilar|frizz|caida|keratina/.test(t);
    case "piel":
      return /piel|acne|mancha|serum|facial|hidratante|protector/.test(t);
    case "unas":
      return /unas|uñas|esmalte|acrilica|acrilicas|gel|semipermanente|polygel|manicure|nail/.test(t);
    case "maquillaje":
      return /maquillaje|base|corrector|labial|rubor|primer|sombras/.test(t);
    default:
      return false;
  }
}

function domainLabel(domain: BeautyDomain): string {
  switch (domain) {
    case "cabello":
      return "cabello";
    case "piel":
      return "piel";
    case "unas":
      return "uñas";
    case "maquillaje":
      return "maquillaje";
    default:
      return "esa categoría";
  }
}

function buildDomainFocusedReply(
  domain: BeautyDomain,
  customerName: string,
  message: string,
  articles: CatalogArticle[],
): string {
  const inventoryAdvice = buildDeterministicInventoryAdvisory(customerName, message, articles);
  if (inventoryAdvice && responseMentionsDomain(inventoryAdvice, domain)) {
    return inventoryAdvice;
  }

  const greeting = buildHumanGreeting(detectGreetingStyle(message), customerName);
  if (domain === "unas") {
    return `${greeting} Entendido, nos enfocamos solo en uñas. ¿Buscas fortalecer, duración o diseño? Te paso opciones con precio real y stock.`;
  }
  if (domain === "maquillaje") {
    return `${greeting} Entendido, vamos solo con maquillaje. ¿Lo quieres para uso diario o para evento? Así te doy opciones con precio real.`;
  }
  if (domain === "cabello") {
    return `${greeting} Entendido, vamos solo con cabello. ¿Tu prioridad es frizz, caída o resequedad? Te recomiendo opciones reales de inventario.`;
  }
  return `${greeting} Entendido, vamos solo con piel. ¿Tu piel es grasa, seca o mixta? Con eso te recomiendo opciones reales de tienda.`;
}

function isRepeatedAgainstRecentAgentMessages(current: string, historyRows: Array<{ rol: string; mensaje: string }>): boolean {
  const recentAgentMessages = historyRows
    .filter((row) => row.rol === "agente")
    .slice(-3)
    .map((row) => String(row.mensaje || ""));

  return recentAgentMessages.some((previous) => looksRepeatedAnswer(current, previous));
}

function enforceFinalResponseQuality(params: {
  responseText: string;
  customerName: string;
  message: string;
  articles: CatalogArticle[];
  historyRows: Array<{ rol: string; mensaje: string }>;
  rejectedDomains: Set<BeautyDomain>;
}): string {
  const { customerName, message, articles, historyRows, rejectedDomains } = params;
  let finalText = String(params.responseText || "").trim();

  const directDateTime = buildDateTimeDirectReply(customerName, message);
  if (directDateTime) {
    finalText = directDateTime;
  }

  const requestedDomain = detectBeautyDomain(message);

  if (requestedDomain && finalText && !responseMentionsDomain(finalText, requestedDomain) && !isDateTimeQuestion(message)) {
    finalText = buildDomainFocusedReply(requestedDomain, customerName, message, articles);
  }

  if (rejectedDomains.size > 0) {
    for (const rejected of rejectedDomains) {
      if (requestedDomain && rejected === requestedDomain) continue;

      if (responseMentionsDomain(finalText, rejected) && !isDateTimeQuestion(message)) {
        if (requestedDomain) {
          finalText = buildDomainFocusedReply(requestedDomain, customerName, message, articles);
        } else {
          const greeting = buildHumanGreeting(detectGreetingStyle(message), customerName);
          finalText = `${greeting} Entendido, no te hablaré de ${domainLabel(rejected)}. Dime en qué categoría sí quieres ayuda: uñas, maquillaje, piel o cabello.`;
        }
      }
    }
  }

  if (isRepeatedAgainstRecentAgentMessages(finalText, historyRows)) {
    if (requestedDomain) {
      finalText = buildDomainFocusedReply(requestedDomain, customerName, message, articles);
    } else {
      const alternative = buildDeterministicInventoryAdvisory(customerName, message, articles);
      if (alternative && !isRepeatedAgainstRecentAgentMessages(alternative, historyRows)) {
        finalText = alternative;
      }
    }
  }

  return finalText;
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
  id?: string | null;
  referencia?: string | null;
  codigo_barras?: string | null;
  descripcion?: string | null;
  precio_venta?: number | null;
  stock?: number | null;
  descuento_porcentaje?: number | null;
  promocion_texto?: string | null;
  activo?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function getArticleSortDate(article: CatalogArticle): number {
  return new Date(String(article.updated_at || article.created_at || 0)).getTime();
}

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

type CustomerBusinessContext = {
  perfilId?: string;
  nombre?: string;
  puntos?: number;
  totalCompras?: number;
  ultimasCompras?: Array<{ fecha: string; total: number }>;
};

function buildStrictPriceMatches(articles: CatalogArticle[], message: string): CatalogArticle[] {
  const tokens = getSearchTokens(message);
  if (tokens.length === 0) return [];

  const scored = articles
    .map((article) => {
      const nombre = normalize(article.nombre);
      const marca = normalize(article.marca);
      const referencia = normalize(article.referencia);
      const codigo = normalize(article.codigo_barras);
      const searchable = normalize(
        [article.nombre, article.marca, article.categoria, article.referencia, article.codigo_barras, article.descripcion]
          .filter(Boolean)
          .join(" "),
      );

      let score = 0;
      for (const token of tokens) {
        if (nombre.includes(token)) score += 12;
        if (marca.includes(token)) score += 8;
        if (referencia.includes(token)) score += 9;
        if (codigo.includes(token)) score += 9;
        if (searchable.includes(token)) score += 3;
      }

      return { article, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(b.article.descuento_porcentaje || 0) - Number(a.article.descuento_porcentaje || 0);
    })
    .map((item) => item.article);

  return scored.slice(0, 3);
}

function buildDeterministicPriceReply(customerName: string, message: string, articles: CatalogArticle[]): string | null {
  const matches = buildStrictPriceMatches(articles, message);
  if (matches.length === 0) return null;

  const greeting = customerName ? `Hola ${customerName}` : "Hola";
  const lines = matches.map((p) => {
    const price = formatCOP(Number(p.precio_venta || 0));
    const discount = Number(p.descuento_porcentaje || 0) > 0 ? ` (${p.descuento_porcentaje}% OFF)` : "";
    return `• *${p.nombre || "Producto"}*: ${price}${discount}`;
  });

  return `${greeting}. Te paso precio real de sistema:\n${lines.join("\n")}\n¿Te cotizo también alternativas similares en ese rango?`;
}

function buildDeterministicInventoryAdvisory(
  customerName: string,
  message: string,
  articles: CatalogArticle[],
): string | null {
  const m = normalize(message);
  const withStock = articles.filter((a) => Number(a.stock || 0) > 0);
  if (withStock.length === 0) return null;

  const concernProfiles = [
    {
      match: /frizz|caida|caspa|reseco|rizado|ondulado|afro|alisado|keratina|decoloracion|tinte|cabello|pelo/,
      label: "cabello",
      includes: ["cabello", "shampoo", "acondicionador", "keratina", "mascarilla", "tinte", "capilar"],
      question: "¿Tu objetivo principal es controlar frizz, caída o resequedad?",
    },
    {
      match: /acne|grano|espinilla|mancha|piel grasa|piel seca|piel mixta|rosacea|arruga|poro|serum|protector solar|limpiador/,
      label: "piel",
      includes: ["piel", "serum", "limpiador", "hidratante", "protector", "facial", "acido", "niacinamida"],
      question: "¿Tu piel es grasa, seca o mixta para ajustarte mejor la rutina?",
    },
    {
      match: /unas|uñas|acrilica|acrilicas|gel|semipermanente|esmalte|top coat|polygel/,
      label: "uñas",
      includes: ["uña", "unas", "esmalte", "gel", "semipermanente", "acril", "top coat", "base"],
      question: "¿Prefieres duración máxima, acabado natural o diseño llamativo?",
    },
    {
      match: /maquillaje|base|corrector|labial|cejas|pestanas|pestañas|polvo|rubor|primer/,
      label: "maquillaje",
      includes: ["maquillaje", "base", "corrector", "labial", "cejas", "pestanas", "primer", "polvo"],
      question: "¿Lo quieres para uso diario o para evento?",
    },
  ];

  const concern = concernProfiles.find((c) => c.match.test(m));
  const source = concern
    ? withStock.filter((a) => {
        const searchable = normalize([a.nombre, a.categoria, a.marca, a.descripcion].filter(Boolean).join(" "));
        return concern.includes.some((k) => searchable.includes(normalize(k)));
      })
    : withStock;

  const ranked = rankArticles(source.length > 0 ? source : withStock, getSearchTokens(message), "general")
    .filter((a) => Number(a.stock || 0) > 0)
    .slice(0, 3);

  if (ranked.length === 0) return null;

  const greeting = buildHumanGreeting(detectGreetingStyle(message), customerName);
  const lines = ranked.map((p) => {
    const precio = formatCOP(Number(p.precio_venta || 0));
    const stock = Number(p.stock || 0);
    const promo = Number(p.descuento_porcentaje || 0) > 0 ? ` • ${p.descuento_porcentaje}% OFF` : "";
    return `• *${p.nombre || "Producto"}*: ${precio} (stock: ${stock})${promo}`;
  });

  return `${greeting} Te recomiendo estas opciones reales de inventario${concern ? ` para ${concern.label}` : ""}:\n${lines.join("\n")}\n${concern?.question || "¿Quieres que te ordene estas opciones por presupuesto (económica/media/premium)?"}`;
}

function isGenericOffTopicAnswer(text: string): boolean {
  const t = normalize(text);
  return /aqui estoy para ayudarte con belleza|te asesoro en belleza|cuentame tu necesidad puntual/.test(t);
}

function hasPriceSignal(text: string): boolean {
  const t = String(text || "");
  return /\$|cop|\d{2,3}(?:[\.,]\d{3})+|\d+\s*off|%\s*off/i.test(t);
}

async function getCustomerBusinessContext(
  supabase: any,
  perfilIdRaw: string,
  telefonoRaw: string,
): Promise<CustomerBusinessContext | null> {
  try {
    const perfilId = String(perfilIdRaw || "").trim();
    const telefono = normalizePhone(telefonoRaw || "");

    type ProfileCRM = {
      id?: string;
      nombre_completo?: string | null;
      puntos_fidelidad?: number | null;
      total_compras?: number | null;
      telefono?: string | null;
    };

    let profile: ProfileCRM | null = null;

    if (perfilId) {
      const { data } = await supabase
        .from("perfiles")
        .select("id,nombre_completo,puntos_fidelidad,total_compras,telefono")
        .eq("id", perfilId)
        .maybeSingle();
      if (data) profile = data as ProfileCRM;
    }

    if (!profile && telefono) {
      const last10 = telefono.slice(-10);
      const { data } = await supabase
        .from("perfiles")
        .select("id,nombre_completo,puntos_fidelidad,total_compras,telefono")
        .or(`telefono.eq.${telefono},telefono.ilike.%${last10}%`)
        .limit(1)
        .maybeSingle();
      if (data) profile = data as ProfileCRM;
    }

    if (!profile?.id) return null;

    const { data: ventas } = await supabase
      .from("ventas")
      .select("fecha,total")
      .eq("cliente_id", profile.id)
      .order("fecha", { ascending: false })
      .limit(3);

    const ventasRows = (ventas || []) as Array<{ fecha?: string | null; total?: number | null }>;

    return {
      perfilId: profile.id,
      nombre: profile.nombre_completo || "",
      puntos: Number(profile.puntos_fidelidad || 0),
      totalCompras: Number(profile.total_compras || 0),
      ultimasCompras: ventasRows.map((v) => ({
        fecha: String(v.fecha || ""),
        total: Number(v.total || 0),
      })),
    };
  } catch {
    return null;
  }
}

async function fetchCatalogArticles(supabase: any): Promise<CatalogArticle[]> {
  const pageSize = 1000;
  const rows: CatalogArticle[] = [];

  for (let page = 0; page < 6; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("articulos")
      .select("id,nombre,categoria,marca,referencia,codigo_barras,descripcion,precio_venta,stock,descuento_porcentaje,promocion_texto,activo,created_at")
      .or("activo.is.null,activo.eq.true")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error || !data || data.length === 0) break;
    rows.push(...(data as CatalogArticle[]));
    if (data.length < pageSize) break;
  }

  return rows;
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
      return getArticleSortDate(b.article) - getArticleSortDate(a.article);
    })
    .map((item) => item.article);

  if (matched.length >= 20) return matched.slice(0, 40);

  const offers = articles
    .filter((a) => Number(a.descuento_porcentaje || 0) > 0)
    .sort((a, b) => Number(b.descuento_porcentaje || 0) - Number(a.descuento_porcentaje || 0));

  const recent = [...articles].sort((a, b) => getArticleSortDate(b) - getArticleSortDate(a));

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
  businessContext?: CustomerBusinessContext | null;
  conversationHistory?: Array<{ rol: string; mensaje: string }>;
}): string {
  const { customerName, message, intent, articles } = params;
  const greetingStyle = detectGreetingStyle(message);
  const greeting = buildHumanGreeting(greetingStyle, customerName);
  const recentClientContext = (params.conversationHistory || [])
    .filter((m) => m.rol === "cliente")
    .slice(-4)
    .map((m) => String(m.mensaje || "").trim())
    .filter(Boolean)
    .join(" ");

  const directTokens = getSearchTokens(message);
  const effectiveTokens =
    directTokens.length > 0
      ? directTokens
      : getSearchTokens(`${recentClientContext} ${message}`);

  const top = rankArticles(articles, effectiveTokens, intent).slice(0, 3);
  const normalizedMessage = normalize(message);
  const normalizedContext = normalize(`${recentClientContext} ${message}`);

  const hasSkinConcern = /acne|grano|espinilla|mancha|melasma|arruga|poro|piel grasa|piel seca|piel mixta|brillo/.test(normalizedContext);
  const hasHairConcern = /caida|quiebre|frizz|caspa|reseco|ondulado|rizado|alisado|tinte|decoloracion/.test(normalizedContext);
  const hasMakeupConcern = /maquillaje|base|corrector|labial|pestanas|cejas/.test(normalizedContext);
  const hasColorConcern = /tinte|coloracion|decoloracion|mechas|balayage|matiz|tonalizar|rubio|castano|negro|rojizo/.test(normalizedContext);
  const hasStraighteningConcern = /alisado|keratina|botox capilar|planchado|repolarizacion/.test(normalizedContext);
  const hasAfroConcern = /afro|rizo tipo 3|rizo tipo 4|coily|crespo/.test(normalizedContext);
  const hasNailTechConcern = /acrilicas|acrilico|uñas en gel|unas en gel|semipermanente|polygel|gel x/.test(normalizedContext);
  const asksPoints = /puntos|club|fidelizacion|canje|beneficio/.test(normalizedMessage);
  const asksName = /sabes\s+mi\s+nombre|cual\s+es\s+mi\s+nombre|mi\s+nombre\??/.test(normalizedMessage);
  const asksNails = /uñas|unas|nail|semipermanente|acrilicas/.test(normalizedMessage);
  const asksSupport = /no puedo|no me deja|no funciona|iniciar sesion|inicio de sesion|contrasena|contraseña|acceso|ingresar|no entra|no abre|usuario|clave|registrar|registro|inscripcion|inscripcion|pague|pago|cobro|valor|costo\s+del\s+curso|precio\s+del\s+curso/.test(normalizedMessage);
  const isGreeting = /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hello|hey)\b/.test(normalizedMessage);
  const isSimpleGreetingOnly = /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hello|hey|que mas|q mas|todo bien)\s*[!.]*$/.test(normalizedMessage);
  const isCustomerComplaint = /por que me dices|por que dices|eso no|no me estas|no es una asesoria|no es asesoria|no me ayudas|me respondes lo mismo|repite|no entiendes|solo te estoy saludando|solo saludaba|te estoy saludando|te saludo/.test(normalizedMessage);
  const isShortQuestion = normalizedMessage.split(/\s+/).filter(Boolean).length <= 2;
  const asksRecommendation = /cual\s+me\s+recomiendas|que\s+me\s+recomiendas|producto\s+me\s+recomiendas|de\s+los\s+productos|cual\s+producto/.test(normalizedMessage);
  const asksAvailability = /tienes|hay|disponible|stock|manejas|vendes/.test(normalizedMessage);
  const asksPriceDirect = /precio|cuanto|cuánto|valor|costo|vale|cuesta/.test(normalizedMessage);

  // --- Detección de continuidad conversacional ---
  const lastBot = normalize(params.lastBotMessage || "");
  const isFollowUpHair = /cabello|pelo|shampoo|mascarilla|frizz|caida|rizado|ondulado|tinte|decoloracion|alisado|keratina|afro/.test(lastBot);
  const isFollowUpSkin = /piel|acne|manchas|serum|hidratante|poro|grasa|seca|mixta/.test(lastBot);
  const isFollowUpNails = /unas|esmalte|semipermanente|gel|acrilica|acrilicas|polygel|gel x|nail/.test(lastBot);
  const isFollowUpMakeup = /maquillaje|base|corrector|evento|diario/.test(lastBot);
  const lastBotWasGeneric = /aqui estoy para ayudarte con belleza|te asesoro en belleza/.test(lastBot);
  const msgWords = normalizedMessage.split(/\s+/).filter(Boolean).length;
  const isShortFollowUp = msgWords <= 6 && lastBot.length > 10;

  if (isCustomerComplaint) {
    return `🙏 Tienes toda la razón, y gracias por decírmelo. Me equivoqué interpretando tu mensaje anterior.
Arranquemos bien: te respondo directo y con lógica, sin rodeos.
Cuéntame en una frase qué necesitas hoy (precio, producto, rutina o puntos del club) y te doy una respuesta puntual.`;
  }

  if (isSimpleGreetingOnly) {
    return `${greeting} 👋 Qué bueno leerte.
Estoy aquí para ayudarte en serio, paso a paso.
¿Qué necesitas hoy exactamente: *precio de un producto*, *recomendación para cabello/piel/uñas* o *consulta del club*?`;
  }

  // --- Respuesta de seguimiento: solo si el mensaje es MUY corto Y no tiene pregunta propia ---
  // Condición estricta: máximo 4 palabras, sin signos de pregunta, sin precios/cantidades
  const isRealShortFollowUp =
    isShortFollowUp &&
    msgWords <= 4 &&
    !normalizedMessage.includes("?") &&
    !/cuanto|precio|vale|cuesta|hay|tienen|tienes|cuantos|como|cuando|donde/.test(normalizedMessage);

  // Detectores de tipos reales (para no insertar texto arbitrario del usuario)
  const isKnownHairType = /\b(liso|ondulado|rizado|afro|coily|crespo|fino|grueso|seco|seca|graso|grasa|danado|danada|largo|corto|teñido|teñida|normal|mixto)\b/.test(normalizedMessage);
  const isKnownSkinType = /\b(grasa|seca|mixta|normal|sensible|acneica|madura|combinada)\b/.test(normalizedMessage);

  if (isRealShortFollowUp && isFollowUpHair) {
    if (isKnownHairType) {
      const hairType = message.trim();
      return `💇 ¡Perfecto! Para cabello *${hairType}* te recomiendo:\n1) *Shampoo sin sulfatos* suave\n2) *Mascarilla hidratante* 2 veces por semana 💧\n3) *Sérum o aceite vegetal* en puntas\n¿Tu mayor preocupación es frizz, caída o resequedad?`;
    }
    // Respuesta corta que NO es un tipo de cabello reconocido — seguir conversación naturalmente
    return `💇 ¡Cuéntame un poco más sobre tu cabello! ¿Es liso, ondulado, rizado o afro? Con eso te armo la rutina exacta 🙌`;
  }

  if (isRealShortFollowUp && isFollowUpNails) {
    return `💅 Sobre lo que veníamos de *uñas*, dime si prefieres:\n1) *Acrílicas* (más estructura)\n2) *Gel/semipermanente* (acabado flexible)\n3) *Natural fortalecida*\nY te recomiendo el protocolo ideal.`;
  }

  if (isRealShortFollowUp && isFollowUpSkin) {
    if (isKnownSkinType) {
      const skinType = message.trim();
      return `✨ ¡Entendido! Para piel *${skinType}* la rutina ideal:\n1) *Limpieza suave* mañana y noche\n2) *Hidratante ligera* no comedogénica\n3) *Protector solar* diario ☀️\n¿Te preocupa más acné, manchas o resequedad?`;
    }
    return `✨ ¡Cuéntame! ¿Tu piel es grasa, seca, mixta o sensible? Así te doy la rutina perfecta 🌿`;
  }

  if (isRealShortFollowUp && isFollowUpMakeup) {
    return `💄 ¡Listo! Cuéntame si lo necesitas para:\n1) *Uso diario*\n2) *Evento especial*\nY te recomiendo base, corrector y sellado ideales.`;
  }

  if ((asksRecommendation || asksAvailability || asksPriceDirect) && top.length > 0) {
    const lines = top.slice(0, 3).map((p) => {
      const price = formatCOP(Number(p.precio_venta || 0));
      const stock = Number(p.stock || 0);
      const stockText = stock > 0 ? ` (stock: ${stock})` : " (agotado)";
      const discount = Number(p.descuento_porcentaje || 0) > 0 ? ` • ${p.descuento_porcentaje}% OFF` : "";
      return `• *${p.nombre || "Producto"}*: ${price}${stockText}${discount}`;
    });

    return `${greeting}. Para lo que vienes preguntando, estas son opciones reales de tienda:\n${lines.join("\n")}\n¿Quieres que te recomiende la mejor para *frizz* según presupuesto (económica / media / premium)?`;
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

  if (asksSupport) {
    return `🔧 Para temas de *acceso, contraseñas o pagos* no tengo forma de gestionar eso desde aquí, ya que soy el asistente de belleza 😊\nPor favor contacta directamente a la tienda:\n📞 Escríbenos al número principal o visítanos para que un asesor te ayude.\nEn lo que puedo ayudarte hoy: ¿tienes alguna consulta sobre productos, cuidado de piel o cabello?`;
  }

  if (asksPoints) {
    if (params.businessContext?.perfilId) {
      const puntos = Number(params.businessContext.puntos || 0);
      const totalCompras = Number(params.businessContext.totalCompras || 0);
      const ultima = params.businessContext.ultimasCompras?.[0];
      const ultimaTxt =
        ultima && ultima.fecha
          ? `\nÚltima compra registrada: *${new Date(ultima.fecha).toLocaleDateString("es-CO")}* por *${formatCOP(Number(ultima.total || 0))}*.`
          : "";

      return `🎁 Te confirmo tus datos del Club:\n• *Puntos actuales*: ${puntos}\n• *Total acumulado en compras*: ${formatCOP(totalCompras)}${ultimaTxt}\n¿Quieres que te diga opciones de canje según tus puntos?`;
    }
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
  if ((hasSkinConcern || hasHairConcern || hasMakeupConcern || hasNailTechConcern) && top.length === 0) {
    const inventoryAdvice = buildDeterministicInventoryAdvisory(customerName, message, articles);
    if (inventoryAdvice) return inventoryAdvice;
  }

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

    if (lastBotWasGeneric && isShortQuestion) {
     return `${greeting}. Vamos a hacerlo concreto ✅
  Dime una de estas opciones y te respondo exacto:
  1) *Producto + precio*
  2) *Rutina personalizada*
  3) *Puntos del club*`;
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

    const perfil_id = body?.perfil_id || body?.customer_id || "";
    const nameFromPayload = toDisplayName(
      String(body?.nombre || body?.contact_name || body?.profile_name || "").trim()
    );
    const rawTelefono = String(
      body?.telefono || body?.phone || body?.numero_whatsapp ||
      body?.telefono_whatsapp || body?.wa_id || ""
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

    const intent = detectIntent(message);
    const greetingStyle = detectGreetingStyle(message);

    // ── 1. Cargar datos en paralelo ───────────────────────────────
    const [articulos, customerBusinessContext, historyRes, perfilRes] = await Promise.all([
      fetchCatalogArticles(supabase),
      getCustomerBusinessContext(supabase, String(perfil_id || ""), telefono),
      // Historial real de conversación (últimos 20 mensajes, desc)
      telefono
        ? supabase
            .from("whatsapp_conversation_history")
            .select("rol, mensaje, created_at")
            .eq("telefono", telefono)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      // Nombre del cliente desde perfiles
      perfil_id
        ? supabase
            .from("perfiles")
            .select("nombre_completo, nombre")
            .eq("id", perfil_id)
            .maybeSingle()
        : telefono
        ? supabase
            .from("perfiles")
            .select("nombre_completo, nombre")
          .or(`telefono.eq.${telefono}`)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // ── 2. Resolver nombre del cliente ────────────────────────────
    const extractedName = extractCustomerName(message);
    const perfilNombre = (
      ((perfilRes.data as any)?.nombre_completo || (perfilRes.data as any)?.nombre) ?? ""
    ).trim();
    const customerName = extractedName || nameFromPayload || perfilNombre || "";

    // ── 3. Historial ordenado cronológicamente ────────────────────
    type HistoryRow = { rol: string; mensaje: string; created_at: string };
    const historyRows = ((historyRes.data || []) as HistoryRow[])
      .reverse()
      .slice(-18);

    const conversationHistory = historyRows.map((r) => ({ rol: r.rol, mensaje: r.mensaje }));
    const rejectedDomains = collectRejectedDomains(message, conversationHistory);

    // ── 4. Construir catálogo relevante ───────────────────────────
    const tokens = getSearchTokens(message);
    const relevantArticles = rankArticles(articulos, tokens, intent).slice(0, 25);

    const catalogoTexto =
      relevantArticles.length > 0
        ? relevantArticles
            .map((p) => {
              const precio = formatCOP(Number(p.precio_venta || 0));
              const stock = Number(p.stock || 0);
              const stockTxt = stock > 0 ? `stock:${stock}` : "agotado";
              const dto =
                Number(p.descuento_porcentaje || 0) > 0
                  ? ` dto:${p.descuento_porcentaje}%`
                  : "";
              const desc = p.descripcion
                ? ` | "${String(p.descripcion).slice(0, 80)}"`
                : "";
              return `• ${p.nombre} | ${p.marca || "N/A"} | ${p.categoria || "general"} | ${precio} | ${stockTxt}${dto}${desc}`;
            })
            .join("\n")
        : articulos
            .slice(0, 20)
            .map((p) => {
              const precio = formatCOP(Number(p.precio_venta || 0));
              return `• ${p.nombre} | ${p.marca || "N/A"} | ${p.categoria || "general"} | ${precio}`;
            })
            .join("\n");

    // ── 5. Datos del cliente ──────────────────────────────────────
    const ultimaCompra = customerBusinessContext?.ultimasCompras?.[0];

    const clienteTexto = customerBusinessContext?.perfilId
      ? [
          customerName ? `Nombre: ${customerName}` : "",
          `Puntos club: ${Number(customerBusinessContext.puntos || 0)}`,
          `Total compras: ${formatCOP(Number(customerBusinessContext.totalCompras || 0))}`,
          ultimaCompra
            ? `Última compra: ${new Date(
                ultimaCompra.fecha
              ).toLocaleDateString("es-CO")} — ${formatCOP(
                Number(ultimaCompra.total || 0)
              )}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ")
      : customerName
      ? `Nombre: ${customerName} | sin perfil CRM completo`
      : "Cliente sin perfil identificado";

    // ── 6. System prompt enfocado ─────────────────────────────────
    const systemPrompt = `Eres *Dany*, asesora virtual experta en belleza de *La Cosmetikera* (WhatsApp).

## MISIÓN PRINCIPAL
Responder EXACTAMENTE lo que el cliente preguntó, usando el catálogo real de la tienda cuando aplique.

## REGLAS ESTRICTAS
1. LEE la pregunta completa. Identifica si pide: precio, producto, rutina, puntos, soporte o información.
2. Responde SOLO lo que preguntaron. Nunca cambies el tema.
3. Si preguntan precio: busca en el CATÁLOGO y da el precio EXACTO. Si no está, dilo honestamente.
4. Si solo saludan: saluda según el estilo del saludo del cliente (hola/holi/buenos días/buenas tardes/buenas noches/qué más), luego pregunta qué necesitan. NO diagnostiques ni recomiendes sin que pidan.
5. Si preguntan por puntos del club: confirma con los datos CRM si están disponibles; si no, pide cédula.
6. Si hay contexto previo (historial), ÚSALO para dar continuidad. No repitas preguntas ya respondidas.
7. Respuestas máximo 5 líneas. Usa *negritas* para productos/precios. 1-2 emojis máximo.
8. Para rutinas: usa pasos numerados cortos.
9. Si el cliente se queja de que no lo entiendes: discúlpate en 1 frase y responde directo.
10. NUNCA inventes precios ni productos que no estén en el catálogo.
11. Si recomiendas productos, prioriza inventario con stock > 0.
12. RESPUESTA DIRECTA PRIMERO: si preguntan fecha/hora, responde la fecha/hora en la primera línea.
13. Si el cliente dijo que NO quiere una categoría, NO la menciones de nuevo salvo que el cliente la pida explícitamente.

## ESPECIALIDADES
Cabello (tintes, decoloración, alisados, afro/rizado), piel (acné, manchas, hidratación), uñas (acrílicas, gel, semipermanente), maquillaje, barba.

## CONOCIMIENTO TÉCNICO
${buildBeautyKnowledgeContext()}

## CLIENTE
${clienteTexto}

## CATEGORÍAS RECHAZADAS POR CLIENTE
${rejectedDomains.size > 0 ? Array.from(rejectedDomains).map(domainLabel).join(", ") : "ninguna"}

## CATÁLOGO LA COSMETIKERA (${articulos.length} productos cargados — usa estos precios reales)
${catalogoTexto}`;

    let responseText = "";

    const directDateTimeReply = buildDateTimeDirectReply(customerName, message);
    if (directDateTimeReply) {
      responseText = directDateTimeReply;
    }

    // ── 7. Llamar a Gemini con historial real (multi-turn) ────────
    if (!responseText && geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelCandidates = [
        process.env.GEMINI_MODEL_CHAT,
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-flash-002",
      ].filter(Boolean) as string[];

      for (const modelName of modelCandidates) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
          });

          type GeminiTurn = { role: "user" | "model"; parts: Array<{ text: string }> };
          const chatHistory: GeminiTurn[] = [];

          for (const row of historyRows) {
            const role: "user" | "model" = row.rol === "cliente" ? "user" : "model";
            const texto = String(row.mensaje || "").trim();
            if (!texto) continue;
            const lastTurn = chatHistory.at(-1);
            if (lastTurn && lastTurn.role === role) {
              const firstPart = lastTurn.parts[0];
              if (firstPart) {
                firstPart.text += "\n" + texto;
              } else {
                lastTurn.parts.push({ text: texto });
              }
            } else {
              chatHistory.push({ role, parts: [{ text: texto }] });
            }
          }

          while (chatHistory.at(-1)?.role === "model") {
            chatHistory.pop();
          }

          const chat = model.startChat({ history: chatHistory });
          const result = await Promise.race([
            chat.sendMessage(message),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`timeout-${modelName}`)), 9000)
            ),
          ]);

          const text = result.response.text().trim();
          if (text) {
            responseText = text;
            break;
          }
        } catch (err) {
          const msg = String((err as Error)?.message || "").toLowerCase();
          if (
            msg.includes("404") ||
            msg.includes("not found") ||
            msg.includes("429") ||
            msg.includes("quota") ||
            msg.includes("rate limit") ||
            msg.includes("resource exhausted") ||
            msg.includes("timeout-") ||
            msg.includes("unsupported")
          ) {
            continue;
          }
          console.warn(`[ai/chat] Error modelo ${modelName}:`, err);
          break;
        }
      }
    }

    // ── 8. Fallback si Gemini no respondió ────────────────────────
    const lastAgentMsg =
      historyRows.filter((r) => r.rol === "agente").slice(-1)[0]?.mensaje ?? "";

    if (!responseText) {
      responseText = buildHeuristicFallbackResponse({
        customerName,
        message,
        intent,
        articles: articulos,
        lastBotMessage: lastAgentMsg,
        businessContext: customerBusinessContext,
        conversationHistory,
      });
    }

    if (lastAgentMsg && looksRepeatedAnswer(responseText, lastAgentMsg)) {
      const altAdvice = buildDeterministicInventoryAdvisory(customerName, message, articulos);
      responseText =
        altAdvice ||
        `${buildHumanGreeting(greetingStyle, customerName)} Tomo otro enfoque para ayudarte mejor:\n` +
          buildHeuristicFallbackResponse({
            customerName,
            message,
            intent,
            articles: articulos,
            lastBotMessage: "",
            businessContext: customerBusinessContext,
            conversationHistory,
          });
    }

    // ── 9. Asegurar precio real si Gemini fue genérico ────────────
    if (intent === "precio") {
      const deterministicPriceReply = buildDeterministicPriceReply(
        customerName,
        message,
        articulos
      );
      if (
        deterministicPriceReply &&
        (!responseText ||
          isGenericOffTopicAnswer(responseText) ||
          !hasPriceSignal(responseText))
      ) {
        responseText = deterministicPriceReply;
      }
    }

    if (intent !== "precio") {
      const deterministicAdvisory = buildDeterministicInventoryAdvisory(customerName, message, articulos);
      if (deterministicAdvisory && (isGenericOffTopicAnswer(responseText) || looksRepeatedAnswer(responseText, lastAgentMsg))) {
        responseText = deterministicAdvisory;
      }
    }

    responseText = enforceFinalResponseQuality({
      responseText,
      customerName,
      message,
      articles: articulos,
      historyRows: conversationHistory,
      rejectedDomains,
    });

    // ── 10. Registrar en historial y memoria ──────────────────────
    if (telefono) {
      try {
        const detectedTheme = extractThemeFromMessage(message);
        await Promise.all([
          logConversationMessage(supabase, telefono, perfil_id || undefined, "cliente", message),
          logConversationMessage(supabase, telefono, perfil_id || undefined, "agente", responseText),
          updateCustomerMemory(
            supabase,
            telefono,
            perfil_id || undefined,
            customerName || undefined,
            detectedTheme || undefined
          ),
        ]);
        await supabase
          .from("agent_conversations")
          .insert({
            phone_number: telefono,
            user_message: message,
            agent_response: responseText,
            created_at: new Date().toISOString(),
          })
          .then(({ error }: { error: any }) => {
            if (error) console.warn("[ai/chat] Legacy insert:", error.message);
          });
      } catch (logError) {
        console.warn("[ai/chat] Error registrando mensajes:", logError);
      }
    }

    // ── 11. Sugerencia de imagen ──────────────────────────────────
    const mediaSuggestion = await getAgentImageSuggestion(supabase, { message, intent });
    const payload = withMediaSuggestion({ response: responseText, intent }, mediaSuggestion);

    return NextResponse.json(payload);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 },
    );
  }
}
