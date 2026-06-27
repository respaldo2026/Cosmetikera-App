import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "../_utils/tenant-resolver";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("proveedores")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("nombre");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error("[GET /api/proveedores] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const body = await request.json();
    const payload = {
      tenant_id: tenantId,
      nombre: normalizeText(body?.nombre),
      contacto: normalizeText(body?.contacto) || null,
      telefono: normalizeText(body?.telefono) || null,
      email: normalizeText(body?.email) || null,
      ciudad: normalizeText(body?.ciudad) || null,
      productos: normalizeText(body?.productos) || null,
      notas: normalizeText(body?.notas) || null,
      activo: body?.activo === false ? false : true,
    };

    if (!payload.nombre) {
      return NextResponse.json({ error: "El nombre del proveedor es obligatorio" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("proveedores")
      .insert([payload])
      .select("id,nombre,contacto,telefono,email,ciudad,productos,notas,activo")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/proveedores] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
