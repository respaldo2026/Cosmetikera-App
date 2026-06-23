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

export async function DELETE(request: NextRequest) {
  try {
    let tenantContext;
    try {
      tenantContext = await resolveTenantContext(request);
    } catch (tenantErr) {
      console.warn("[DELETE /api/admin] Fallo resolución de tenant:", tenantErr);
      return NextResponse.json({ error: "No se pudo determinar el tenant" }, { status: 400 });
    }

    if (!tenantContext?.tenantId) {
      return NextResponse.json({ error: "Tenant ID vacío" }, { status: 400 });
    }

    const { tenantId } = tenantContext;
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("id");

    if (!adminId) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Verificar que el admin pertenece a este tenant
    const { data: admin, error: checkError } = await supabase
      .from("perfiles")
      .select("id,tenant_id")
      .eq("tenant_id", tenantId)
      .eq("id", adminId)
      .single();

    if (checkError || !admin) {
      console.warn("[DELETE /api/admin] Admin no encontrado en tenant:", checkError);
      return NextResponse.json({ error: "Admin no encontrado" }, { status: 404 });
    }

    // Eliminar
    const { error: deleteError } = await supabase
      .from("perfiles")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", adminId);

    if (deleteError) {
      console.error("[DELETE /api/admin] Delete error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
