import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, resolveTenantContext } from "../../_utils/tenant-resolver";
import { mergeClubRules } from "@/utils/club-rules";

/**
 * GET /api/configuracion/club
 * Devuelve el catálogo de recompensas y las reglas del club.
 * Si las tablas están vacías, responde con arreglo vacío / objeto vacío.
 */
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const supabase = getAdminClient();

    const [recompensasRes, reglasRes] = await Promise.all([
      supabase
        .from("club_recompensas_config")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("orden", { ascending: true }),
      supabase
        .from("club_reglas_config")
        .select("clave,valor,descripcion,updated_at")
        .eq("tenant_id", tenantId),
    ]);

    if (recompensasRes.error) throw recompensasRes.error;
    if (reglasRes.error) throw reglasRes.error;

    // Normalizar reglas a un objeto clave → valor numérico
    const reglasRaw: Record<string, number | string> = {};
    for (const row of reglasRes.data ?? []) {
      const num = Number(row.valor);
      reglasRaw[row.clave] = Number.isFinite(num) ? num : row.valor;
    }

    const reglas = mergeClubRules(reglasRaw);

    return NextResponse.json({
      recompensas: recompensasRes.data ?? [],
      reglas,
      reglas_raw: reglasRes.data ?? [],
    });
  } catch (err: any) {
    console.error("[GET /api/configuracion/club]", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/configuracion/club
 * Actualiza múltiples reglas a la vez.
 * Body: { reglas: { clave: valor, ... } }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { reglas } = await request.json();
    if (!reglas || typeof reglas !== "object") {
      return NextResponse.json({ error: "Body debe tener { reglas: { clave: valor } }" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const updates = Object.entries(reglas).map(([clave, valor]) =>
      supabase
        .from("club_reglas_config")
        .upsert({ tenant_id: tenantId, clave, valor: String(valor) }, { onConflict: "tenant_id,clave" })
    );

    await Promise.all(updates);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[PATCH /api/configuracion/club]", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
