import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@lacosmetikera.local";

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Falta configurar Supabase en el servidor" }, { status: 500 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "Faltan claves VAPID en variables de entorno" }, { status: 500 });
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "Promoción La Cosmetikera";
    const message = typeof body?.message === "string" ? body.message.trim() : "Tenemos novedades para ti.";
    const url = typeof body?.url === "string" ? body.url : "/club";

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from("web_push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("active", true);

    if (subscriptionsError) {
      return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });
    }

    const rows = (subscriptions || []) as SubscriptionRow[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0, inactive: 0 });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: `promo-${Date.now()}`,
      data: { url },
    });

    let sent = 0;
    let failed = 0;
    const toDeactivate: string[] = [];

    await Promise.all(rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh,
              auth: row.auth,
            },
          },
          payload,
        );
        sent += 1;
      } catch (error: any) {
        failed += 1;
        const statusCode = Number(error?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          toDeactivate.push(row.endpoint);
        }
      }
    }));

    if (toDeactivate.length > 0) {
      const { error } = await supabaseAdmin
        .from("web_push_subscriptions")
        .update({ active: false, updated_at: new Date().toISOString() })
        .in("endpoint", toDeactivate);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      inactive: toDeactivate.length,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo ejecutar el envío push" }, { status: 500 });
  }
}
