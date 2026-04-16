import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const fetchPdfText = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el PDF (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const parsed = await pdfParse(buffer);
  return parsed.text || "";
};

const fetchDocxText = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el DOCX (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
};

const summarize = async (apiKey: string, text: string) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `Resume en 3 viñetas breves y devuelve keywords (máx 10, minúsculas). Devuelve solo JSON: {"summary": string, "keywords": string[]}
Texto:
${text.slice(0, 12000)}`;

  // Lista de modelos válidos en orden de preferencia
  const modelCandidates = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-002",
    "gemini-1.5-pro",
    "gemini-1.5-pro-002",
    process.env.GEMINI_MODEL_SUMMARY,
  ].filter(Boolean) as string[];

  let lastError: any = null;

  for (const candidate of modelCandidates) {
    try {
      console.log(`[summarize] Intentando modelo: ${candidate}`);
      const model = genAI.getGenerativeModel({ model: candidate });
      const result = await model.generateContent(prompt);
      const raw = result.response.text();
      try {
        const json = JSON.parse(raw.replace(/```json|```/g, ""));
        return { summary: json.summary || raw, keywords: Array.isArray(json.keywords) ? json.keywords.slice(0, 12) : [] };
      } catch (_e) {
        return { summary: raw, keywords: [] };
      }
    } catch (err: any) {
      lastError = err;
      const errorMsg = String(err?.message || "").toLowerCase();
      console.warn(`[summarize] Error con ${candidate}:`, errorMsg);
      
      if (errorMsg.includes("404") || errorMsg.includes("not found")) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("No available Gemini model for summarize");
};

const chunkText = (text: string, size = 1200, overlap = 100) => {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + size);
    chunks.push(chunk);
    i += size - overlap;
  }
  return chunks;
};

const embedTexts = async (apiKey: string, texts: string[]) => {
  if (!texts.length) return [] as number[][];
  const genAI = new GoogleGenerativeAI(apiKey);
  const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const vectors: number[][] = [];
  for (const t of texts) {
    const res = await embedModel.embedContent(t.slice(0, 2000));
    vectors.push(res.embedding.values);
  }
  return vectors;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, url, raw_text, mime_type } = body || {};
    if (!title) return NextResponse.json({ error: "Falta título" }, { status: 400 });
    if (!url && !raw_text) return NextResponse.json({ error: "Proporciona un PDF o texto" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Faltan credenciales de Supabase en el servidor" }, { status: 500 });
    }
    if (!geminiKey) {
      return NextResponse.json({ error: "Falta GEMINI_API_KEY" }, { status: 500 });
    }

    let content = raw_text as string | undefined;
    if (!content && url) {
      if (mime_type?.includes("word") || url.toLowerCase().endsWith(".docx")) {
        content = await fetchDocxText(url);
      } else {
        content = await fetchPdfText(url);
      }
    }
    if (!content) return NextResponse.json({ error: "No se pudo obtener texto" }, { status: 400 });

    const { summary, keywords } = await summarize(geminiKey, content);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: docInsert, error: docErr } = await supabase
      .from("agent_documents")
      .insert({
        title,
        source_url: url,
        content_text: content.slice(0, 50000),
        summary,
        keywords,
      })
      .select("id")
      .single();
    if (docErr) throw docErr;

    // Chunks + embeddings
    const chunks = chunkText(content.slice(0, 50000));
    const embeddings = await embedTexts(geminiKey, chunks);
    const rows = chunks.map((c, idx) => ({ doc_id: docInsert.id, chunk_index: idx, content: c, embedding: embeddings[idx] }));
    const { error: chunkErr } = await supabase.from("agent_chunks").insert(rows);
    if (chunkErr) throw chunkErr;

    return NextResponse.json({ ok: true, summary, keywords, chunks: rows.length });
  } catch (error: any) {
    console.error("ingest error", error);
    return NextResponse.json({ error: error?.message || "Error procesando documento" }, { status: 500 });
  }
}
