import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const parseJsonFromText = (text?: string) => {
  const base = (text ?? "").toString();
  const fenced = base.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? base;
  const trimmed = candidate.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const jsonSlice = start !== -1 && end !== -1 ? trimmed.slice(start, end + 1) : trimmed;

  try {
    return JSON.parse(jsonSlice);
  } catch (_e) {
    return null;
  }
};

const cleanKeywords = (value: any) => {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((k) => String(k).trim())
    .filter(Boolean)
    .slice(0, 12);
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: "Falta GEMINI_API_KEY en el servidor. Define GEMINI_API_KEY en las variables de entorno de Vercel/Next y reinicia el deploy.",
      }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const {
      titulo,
      tipo,
      fecha_inicio,
      beneficios,
      publico,
      tono = "Cercano, claro y vendedor sin exagerar",
      oferta,
    } = body || {};

    const prompt = `Eres copywriter de una academia de belleza. Devuelve SOLO un JSON sin texto adicional.
    Estructura: {"promo_text": string, "keywords": string[]}
    - Idioma: español de Colombia.
    - Estilo: ${tono}.
    - Usa 1 o 2 frases cortas que incluyan beneficio, fecha si existe, y un CTA breve.
    - Keywords: max 10, en minúsculas, sin símbolos.
    Datos:
    titulo: ${titulo || "(sin titulo)"}
    tipo: ${tipo || ""}
    fecha_inicio: ${fecha_inicio || ""}
    beneficios: ${beneficios || ""}
    publico: ${publico || ""}
    oferta: ${oferta || ""}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonFromText(text);
    const promoText = (parsed?.promo_text || parsed?.texto || text || "").toString().trim();
    const keywords = cleanKeywords(parsed?.keywords);

    return NextResponse.json({ promo_text: promoText, keywords, raw: text });
  } catch (error: any) {
    console.error("AI generate error", error);
    const msg = error?.message || "Error generando contenido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
