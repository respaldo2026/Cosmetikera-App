import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

type AudioExtraction = {
  audioId?: string;
  from?: string;
  messageId?: string;
};

function isAuthorized(req: NextRequest): boolean {
  const received = req.headers.get("x-api-key") || "";
  const expected = process.env.WHATSAPP_API_KEY || process.env.AGENT_API_KEY || "";

  if (!expected) return true;
  return received === expected;
}

function getString(value: unknown): string {
  return String(value || "").trim();
}

function extractAudioInfo(body: any): AudioExtraction {
  const directAudioId =
    getString(body?.audio_id) ||
    getString(body?.media_id) ||
    getString(body?.whatsapp_media_id) ||
    getString(body?.audio?.id);

  if (directAudioId) {
    return {
      audioId: directAudioId,
      from: getString(body?.telefono_whatsapp || body?.from),
      messageId: getString(body?.session_id || body?.message_id),
    };
  }

  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  return {
    audioId: getString(message?.audio?.id),
    from: getString(message?.from),
    messageId: getString(message?.id),
  };
}

async function fetchWhatsAppAudio(audioId: string): Promise<{ base64: string; mimeType: string } | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken || !audioId) return null;

  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${audioId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!metaRes.ok) return null;
  const meta = await metaRes.json();
  const mediaUrl = getString(meta?.url);
  const mimeType = getString(meta?.mime_type) || "audio/ogg";
  if (!mediaUrl) return null;

  const mediaRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!mediaRes.ok) return null;
  const audioBuffer = Buffer.from(await mediaRes.arrayBuffer());

  return {
    base64: audioBuffer.toString("base64"),
    mimeType,
  };
}

async function transcribeWithGemini(base64Audio: string, mimeType: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return "";

  const genAI = new GoogleGenerativeAI(geminiKey);
  const models = [
    process.env.GEMINI_MODEL_AUDIO,
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
  ].filter(Boolean) as string[];

  const prompt =
    "Transcribe este audio de WhatsApp en español. Devuelve solo la transcripción limpia, sin comillas y sin explicaciones.";

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            data: base64Audio,
            mimeType,
          },
        },
      ]);

      const text = result.response.text().trim();
      if (text) return text;
    } catch (err) {
      const msg = String((err as Error)?.message || "").toLowerCase();
      if (
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("unsupported") ||
        msg.includes("429") ||
        msg.includes("quota") ||
        msg.includes("rate limit") ||
        msg.includes("resource exhausted")
      ) {
        continue;
      }
      throw err;
    }
  }

  return "";
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const audioInfo = extractAudioInfo(body);
    const rawPhone =
      getString(body?.telefono_whatsapp) ||
      getString(body?.telefono) ||
      getString(body?.phone) ||
      getString(body?.wa_id) ||
      getString(body?.from) ||
      getString(audioInfo.from);
    const rawProfileId =
      getString(body?.perfil_id) ||
      getString(body?.customer_id) ||
      getString(body?.profile_id);
    const rawContactName =
      getString(body?.nombre) ||
      getString(body?.contact_name) ||
      getString(body?.profile_name);
    const messageText =
      getString(body?.mensaje_whatsapp) ||
      getString(body?.message_body) ||
      getString(body?.message) ||
      getString(body?.texto);

    let transcript = messageText;

    if (!transcript) {
      const { audioId } = audioInfo;
      if (audioId) {
        const audio = await fetchWhatsAppAudio(audioId);
        if (audio) {
          transcript = await transcribeWithGemini(audio.base64, audio.mimeType);
        }
      }
    }

    if (!transcript) {
      return NextResponse.json({
        response:
          "Te escucho. En este momento no pude transcribir tu audio. ¿Me lo envías por texto o un audio más corto?",
        intent: "general",
        audio_transcript: "",
      });
    }

    const apiKey = request.headers.get("x-api-key") || "";
    const chatUrl = new URL("/api/ai/chat", request.url);

    const chatRes = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({
        mensaje_whatsapp: transcript,
        telefono_whatsapp: rawPhone,
        telefono: rawPhone,
        phone: rawPhone,
        wa_id: rawPhone,
        perfil_id: rawProfileId || undefined,
        customer_id: rawProfileId || undefined,
        nombre: rawContactName || undefined,
        contact_name: rawContactName || undefined,
        message_id: getString(body?.message_id) || audioInfo.messageId,
        session_id: getString(body?.session_id) || audioInfo.messageId,
        source_channel: "audio",
      }),
      cache: "no-store",
    });

    if (!chatRes.ok) {
      return NextResponse.json({
        response:
          "Gracias por tu audio. Ya lo recibí, pero tuve un problema procesando la respuesta. ¿Me confirmas qué producto buscas para ayudarte enseguida?",
        intent: "general",
        audio_transcript: transcript,
      });
    }

    const chatPayload = await chatRes.json();

    return NextResponse.json({
      ...chatPayload,
      audio_transcript: transcript,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error interno",
        response:
          "Recibí tu audio, pero ocurrió un error técnico temporal. Inténtalo de nuevo en unos segundos o envíame tu mensaje en texto.",
      },
      { status: 500 },
    );
  }
}
