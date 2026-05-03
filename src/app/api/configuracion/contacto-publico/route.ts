import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function normalizeWhatsAppTarget(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const waMeMatch = raw.match(/wa\.me\/([0-9]{7,20})/i);
  if (waMeMatch?.[1]) return waMeMatch[1];

  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 7) return digits;

  return "";
}

/**
 * GET /api/configuracion/contacto-publico
 * Devuelve el número de WhatsApp de atención para enlazar el portal Club con el bot.
 */
export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("configuracion")
      .select("whatsapp,telefono")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const whatsappRaw = String((data as any)?.whatsapp || "").trim();
    const telefonoRaw = String((data as any)?.telefono || "").trim();

    const whatsappNumber =
      normalizeWhatsAppTarget(whatsappRaw) ||
      normalizeWhatsAppTarget(telefonoRaw) ||
      normalizeWhatsAppTarget(process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER || "");

    return NextResponse.json({
      data: {
        whatsapp_number: whatsappNumber || null,
        whatsapp: whatsappRaw || null,
        telefono: telefonoRaw || null,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/configuracion/contacto-publico]", err);
    return NextResponse.json(
      { error: err?.message || "Error interno", data: { whatsapp_number: null } },
      { status: 500 }
    );
  }
}
