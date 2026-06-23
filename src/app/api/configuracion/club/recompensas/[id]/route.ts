import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, resolveTenantContext } from "../../../../_utils/tenant-resolver";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/configuracion/club/recompensas/[id]
 * Actualiza una recompensa existente.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { id } = await params;
    const body = await request.json();
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("club_recompensas_config")
      .update(body)
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/configuracion/club/recompensas/[id]
 * Elimina una recompensa del catálogo.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { tenantId } = await resolveTenantContext(_request);
    const { id } = await params;
    const supabase = getAdminClient();

    const { error } = await supabase
      .from("club_recompensas_config")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
