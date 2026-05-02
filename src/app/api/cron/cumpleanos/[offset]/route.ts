import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type BirthdayOffset = -2 | -1 | 0;

const OFFSET_MAP: Record<string, BirthdayOffset> = {
  "2d": -2,
  "1d": -1,
  hoy: 0,
};

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // Fallback para pruebas manuales si no existe CRON_SECRET.
  const apiKey = request.headers.get("x-api-key");
  return Boolean(apiKey && apiKey === process.env.WHATSAPP_API_KEY);
}

async function triggerBirthdayReminder(
  request: NextRequest,
  diasOffset: BirthdayOffset
) {
  const internalApiKey = process.env.WHATSAPP_API_KEY;
  if (!internalApiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "WHATSAPP_API_KEY no esta configurada",
      },
      { status: 500 }
    );
  }

  const endpoint = new URL("/api/whatsapp/send-birthday-reminder", request.url);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": internalApiKey,
    },
    body: JSON.stringify({ dias_offset: diasOffset, dry_run: false }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json(
      {
        success: false,
        error: "Error ejecutando recordatorio de cumpleanos",
        details: data,
      },
      { status: response.status }
    );
  }

  return NextResponse.json({
    success: true,
    offset: diasOffset,
    source: "vercel-cron",
    result: data,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ offset: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { offset } = await context.params;
  const diasOffset = OFFSET_MAP[offset];

  if (diasOffset === undefined) {
    return NextResponse.json(
      {
        success: false,
        error: "Offset invalido. Usa: 2d, 1d o hoy",
      },
      { status: 400 }
    );
  }

  return triggerBirthdayReminder(request, diasOffset);
}
