import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTenantContext } from "../../_utils/tenant-resolver";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { perfilId, telefono } = await request.json();

    if (!perfilId || !telefono) {
      return NextResponse.json({ error: "perfilId y teléfono son requeridos" }, { status: 400 });
    }

    const telefonoNormalizado = normalizePhone(telefono);
    if (!/^\d{7,15}$/.test(telefonoNormalizado)) {
      return NextResponse.json({ error: "Ingresa un número de teléfono válido" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data: perfil, error } = await supabase
      .from("perfiles")
      .select("id,telefono")
      .eq("id", perfilId)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !perfil) {
      return NextResponse.json({ error: error?.message || "Cliente no encontrado" }, { status: 404 });
    }

    const tel1 = normalizePhone(perfil.telefono);
    if (!tel1) {
      return NextResponse.json({ error: "Este cliente no tiene teléfono registrado. Actualízalo antes de usar puntos." }, { status: 409 });
    }

    if (telefonoNormalizado !== tel1) {
      return NextResponse.json({ error: "El teléfono no coincide con el registrado para este cliente" }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/club/verificar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}