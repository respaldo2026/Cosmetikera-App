import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, resolveTenantContext } from "../../../_utils/tenant-resolver";

/**
 * POST /api/configuracion/club/recompensas
 * Crea una nueva recompensa en el catálogo.
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const body = await request.json();
    const { key, icon, title, description, category, points_cost, value_cop, level_min, birthday_only, featured, badge, activa, orden } = body;

    if (!key || !title || !category || !points_cost) {
      return NextResponse.json({ error: "key, title, category y points_cost son requeridos" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("club_recompensas_config")
      .insert({ tenant_id: tenantId, key, icon: icon || "🎁", title, description: description || "", category, points_cost, value_cop: value_cop || 0, level_min: level_min || null, birthday_only: birthday_only || false, featured: featured || false, badge: badge || null, activa: activa !== false, orden: orden || 0 })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
