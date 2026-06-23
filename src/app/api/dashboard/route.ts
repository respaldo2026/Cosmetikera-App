import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "../_utils/tenant-resolver";
import dayjs from "dayjs";

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

    const hoy = dayjs();
    const inicioHoy = hoy.startOf("day").toISOString();
    const inicioMes = hoy.startOf("month").toISOString();

    const [
      { data: ventasHoyData },
      { data: ventasMesData },
      { data: clientesData },
      { data: articulosData },
      { data: comprasData },
      { data: ventasRecData },
    ] = await Promise.all([
      supabase.from("ventas").select("total").eq("tenant_id", tenantId).gte("fecha", inicioHoy),
      supabase.from("ventas").select("total").eq("tenant_id", tenantId).gte("fecha", inicioMes),
      supabase.from("perfiles").select("id,nombre_completo,puntos_fidelidad,nivel_fidelidad,fecha_nacimiento,created_at").eq("tenant_id", tenantId),
      supabase.from("articulos").select("id,nombre,stock,stock_minimo,precio_venta").eq("tenant_id", tenantId),
      supabase.from("compras").select("id,estado,total,proveedor_nombre").eq("tenant_id", tenantId).eq("estado", "pendiente"),
      supabase.from("ventas").select("id,total,fecha,items,cliente:perfiles(nombre_completo)").eq("tenant_id", tenantId).order("fecha", { ascending: false }).limit(5),
    ]);

    return NextResponse.json({
      ventasHoy: ventasHoyData || [],
      ventasMes: ventasMesData || [],
      clientes: clientesData || [],
      articulos: articulosData || [],
      compras: comprasData || [],
      ventasRec: ventasRecData || [],
    });
  } catch (err) {
    console.error("[GET /api/dashboard]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
