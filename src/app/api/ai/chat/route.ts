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

function detectIntent(message: string): AgentIntent {
  const m = normalize(message);
  if (/precio|cuanto|valor|costo|vale|promocion|oferta/.test(m)) return "precio";
  if (/hora|horario|cuando|dia|fecha|agenda/.test(m)) return "horario";
  if (/temario|contenido|modulo|modulos|incluye/.test(m)) return "temario";
  if (/material|kit|insumo|herramienta/.test(m)) return "materiales";
  if (/inscripcion|matricula|registr|cupo|reserv/.test(m)) return "inscripcion";
  if (/requisito|necesito|debo llevar|condicion/.test(m)) return "requisitos";
  return "general";
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
      const result = await model.generateContent(prompt);
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
        message.includes("resource exhausted")
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

    // ===== INTEGRACIÓN DE MEMORIA =====
    let customerContext = null;
    let customerName = "";
    let trustLevel = "nuevo";
    let previousTheme = "";

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

      // Construir historial de conversación previo en formato legible
      const historialPrevio = customerContext?.historialReciente ?? [];
      // Los mensajes vienen ordenados DESC desde la BD → invertir para orden cronológico
      const historialOrdenado = [...historialPrevio].reverse().slice(-8);
      const customerMemoryContext = historialOrdenado.length > 0
          ? `--- Historial REAL de esta conversación con ${customerName || "el cliente"} ---\n${historialOrdenado
              .map((m: { rol: string; mensaje: string }) =>
                `${m.rol === "cliente" ? "👤 Cliente" : "🤖 Asesor"}: ${m.mensaje}`
              )
              .join("\n")}\n--- Fin historial ---\nÚltimo tema tratado: ${previousTheme || "ninguno"}\nNivel de relación: ${trustLevel}`
          : `(primera vez que escribe este número)\nNivel: ${trustLevel}`;

      const prompt = [
        "Eres Dany, asesora virtual experta en cosméticos de La Cosmetikera (WhatsApp).",
        toneInstruction,
        "Reglas OBLIGATORIAS:",
        "- Responde en español colombiano natural, máximo 4-5 líneas.",
        "- USA el historial de conversación para dar continuidad REAL (no repitas saludos si ya conversaron).",
        "- Si el cliente ya preguntó algo antes, recuérdalo y conecta la respuesta.",
        "- No inventes precios ni stock; usa SOLO el contexto de productos dado.",
        "- Si hay precio disponible, SIEMPRE dilo en formato $X.XXX COP.",
        "- Si hay descuento, menciónalo siempre (genera urgencia).",
        "- Al dar precio: agrega 1 beneficio clave del producto + una recomendación de uso breve.",
        "- Cierra siempre con una pregunta para concretar: '¿Te lo reservo?', '¿Cuántos necesitas?', '¿Lo recogería en tienda o envío?'.",
        "- Si no tienes el producto, di exactamente qué tienes similar y ofrece alternativas.",
        "- Nunca hagas afirmaciones médicas absolutas.",
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

    if (!responseText) {
      const greeting = customerName ? `¡Hola ${customerName}!` : "¡Hola!";
      responseText = `${greeting} Gracias por escribir a La Cosmetikera. Te ayudo con precios, productos y promociones activas. ¿Qué producto buscas hoy?`;
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
