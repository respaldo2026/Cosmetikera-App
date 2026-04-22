import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

type PushKeys = {
  p256dh?: string;
  auth?: string;
};

type PushSubscriptionPayload = {
  endpoint?: string;
  keys?: PushKeys;
  expirationTime?: number | null;
};

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Falta configurar Supabase en el servidor" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const perfilId = typeof body?.perfilId === "string" ? body.perfilId : null;
    const subscription = (body?.subscription || {}) as PushSubscriptionPayload;

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Suscripción push inválida" }, { status: 400 });
    }

    const userAgent = request.headers.get("user-agent");

    const { error } = await supabaseAdmin
      .from("web_push_subscriptions")
      .upsert(
        {
          endpoint,
          p256dh,
          auth,
          expiration_time: subscription.expirationTime ?? null,
          perfil_id: perfilId,
          user_agent: userAgent,
          active: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar la suscripción push" }, { status: 500 });
  }
}
