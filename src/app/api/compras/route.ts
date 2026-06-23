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

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const supabase = getAdminClient();

    const [
      { data: comprasData },
      { data: proveedoresData },
      { data: articulosData },
      { data: configData },
    ] = await Promise.all([
      supabase.from("compras").select("*").eq("tenant_id", tenantId).order("fecha", { ascending: false }),
      supabase.from("proveedores").select("id,nombre").eq("tenant_id", tenantId).order("nombre"),
      supabase.from("articulos").select("id,nombre,referencia,codigo_secundario,codigo_barras,precio_costo,precio_venta,stock,categoria,marca").eq("tenant_id", tenantId).order("nombre"),
      supabase.from("configuracion").select("nombre_academia").eq("tenant_id", tenantId).limit(1).maybeSingle(),
    ]);

    return NextResponse.json({
      compras: comprasData || [],
      proveedores: proveedoresData || [],
      articulos: articulosData || [],
      config: configData,
    });
  } catch (err) {
    console.error("[GET /api/compras]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
