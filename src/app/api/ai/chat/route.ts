import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import {
  getAgentImageSuggestion,
  withMediaSuggestion,
  type AgentIntent,
} from "@/utils/agent-media-suggestions";

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
        .select("nombre,categoria,marca,precio_venta,stock,descuento_porcentaje,promocion_texto")
        .gt("stock", 0)
        .order("updated_at", { ascending: false })
        .limit(80),
    ]);

    const intent = detectIntent(message);

    const assets = Array.isArray(assetsRes.data) ? assetsRes.data : [];
    const articulos = Array.isArray(articulosRes.data) ? articulosRes.data : [];

    const contextoAssets = assets
      .slice(0, 20)
      .map((a) => {
        const kws = Array.isArray(a.keywords) ? a.keywords.join(", ") : String(a.keywords || "");
        return `- ${a.titulo || "Material"} | categoria: ${a.categoria || "general"} | desc: ${a.descripcion_ia || a.descripcion || ""} | keywords: ${kws}`;
      })
      .join("\n");

    const contextoArticulos = articulos
      .slice(0, 25)
      .map((p) => {
        const promo = Number(p.descuento_porcentaje || 0) > 0 ? ` | descuento: ${p.descuento_porcentaje}%` : "";
        return `- ${p.nombre} | categoria: ${p.categoria || "general"} | marca: ${p.marca || "N/A"} | precio: ${p.precio_venta || 0}${promo}`;
      })
      .join("\n");

    let responseText = "";

    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);

      const prompt = [
        "Eres una asesora comercial de La Cosmetikera por WhatsApp.",
        "Responde en español colombiano, máximo 4 líneas, tono cálido y directo.",
        "No inventes precios ni stock; usa solo el contexto.",
        "Si falta data, dilo claramente y ofrece que un asesor confirme.",
        "Si el cliente pregunta por precio, sugiere 1-2 opciones concretas del catálogo.",
        "",
        `Intención detectada: ${intent}`,
        `Mensaje cliente: ${message}`,
        "",
        "Contexto de productos:",
        contextoArticulos || "(sin productos)",
        "",
        "Contexto de materiales de marketing:",
        contextoAssets || "(sin materiales)",
      ].join("\n");

      try {
        responseText = await generateWithModelFallback(genAI, prompt);
      } catch (modelError) {
        console.warn("[ai/chat] Error no recuperable de Gemini", modelError);
        responseText = "";
      }
    }

    if (!responseText) {
      responseText = "¡Hola! Gracias por escribir a La Cosmetikera. Te ayudo con precios, productos y promociones activas. ¿Qué producto buscas hoy?";
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
