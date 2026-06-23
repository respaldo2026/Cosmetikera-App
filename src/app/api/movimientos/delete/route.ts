import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, resolveTenantContext } from "../../_utils/tenant-resolver";

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { movimientoId } = await request.json();

    if (!movimientoId) {
      return NextResponse.json({ success: false, error: "movimientoId es requerido" }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    const { error, count } = await supabaseAdmin
      .from("movimientos_financieros")
      .delete({ count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("id", movimientoId);

    if (error) throw error;

    if ((count || 0) === 0) {
      return NextResponse.json({ success: false, error: "No se encontro el movimiento" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error borrando movimiento:", error);
    return NextResponse.json({ success: false, error: error?.message || "Error desconocido" }, { status: 500 });
  }
}
