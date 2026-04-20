import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * GET /api/configuracion/club
 * Devuelve el catálogo de recompensas y las reglas del club.
 * Si las tablas están vacías, responde con arreglo vacío / objeto vacío.
 */
export async function GET() {
  try {
    const supabase = getAdminClient();

    const [recompensasRes, reglasRes] = await Promise.all([
      supabase
        .from("club_recompensas_config")
        .select("*")
        .order("orden", { ascending: true }),
      supabase
        .from("club_reglas_config")
        .select("clave,valor,descripcion,updated_at"),
    ]);

    if (recompensasRes.error) throw recompensasRes.error;
    if (reglasRes.error) throw reglasRes.error;

    // Normalizar reglas a un objeto clave → valor numérico
    const reglas: Record<string, number> = {};
    for (const row of reglasRes.data ?? []) {
      const num = Number(row.valor);
      reglas[row.clave] = Number.isFinite(num) ? num : row.valor;
    }

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
    const { reglas } = await request.json();
    if (!reglas || typeof reglas !== "object") {
      return NextResponse.json({ error: "Body debe tener { reglas: { clave: valor } }" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const updates = Object.entries(reglas).map(([clave, valor]) =>
      supabase
        .from("club_reglas_config")
        .upsert({ clave, valor: String(valor) }, { onConflict: "clave" })
    );

    await Promise.all(updates);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[PATCH /api/configuracion/club]", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
