import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function GET(request: Request) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);

    const pageRaw = Number(searchParams.get("page") || 1);
    const pageSizeRaw = Number(searchParams.get("pageSize") || 300);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(1000, Math.max(50, Math.floor(pageSizeRaw)))
      : 300;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const [ventasRes, comprasRes, movimientosRes, puntosRes, canjesRes, perfilesRes, articulosRes] = await Promise.all([
      supabase
        .from("ventas")
        .select("id,numero_ticket,fecha,total,subtotal,descuento,metodo_pago,cliente_id,items,cliente:perfiles(nombre_completo,cedula)")
        .order("fecha", { ascending: false })
        .range(from, to),
      supabase
        .from("compras")
        .select("id,proveedor_id,proveedor_nombre,fecha,total,estado,notas,items")
        .order("fecha", { ascending: false })
        .range(from, to),
      supabase
        .from("movimientos_financieros")
        .select("id,fecha,tipo,monto,concepto,categoria,metodo_pago,referencia,descripcion,estudiante_id,proveedor_id,conciliado,created_at, perfiles:perfiles!movimientos_financieros_estudiante_id_fkey(nombre_completo, telefono), proveedores:perfiles!movimientos_financieros_proveedor_id_fkey(nombre_completo)")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase
        .from("puntos_historial")
        .select("id,perfil_id,tipo,puntos,concepto,referencia,created_at")
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase
        .from("canjes")
        .select("id,perfil_id,puntos,valor_cop,descripcion,estado,created_at")
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase
        .from("perfiles")
        .select("id,nombre_completo,cedula")
        .order("nombre_completo")
        .limit(2000),
      supabase
        .from("articulos")
        .select("id,nombre,categoria,marca,precio_costo,precio_venta")
        .order("nombre")
        .limit(3000),
    ]);

    const errors = [ventasRes.error, comprasRes.error, movimientosRes.error, puntosRes.error, canjesRes.error, perfilesRes.error, articulosRes.error].filter(Boolean);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.map((error: any) => error.message).join(" | ") },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ventas: ventasRes.data ?? [],
      compras: comprasRes.data ?? [],
      movimientos: movimientosRes.data ?? [],
      puntos: puntosRes.data ?? [],
      canjes: canjesRes.data ?? [],
      perfiles: perfilesRes.data ?? [],
      articulos: articulosRes.data ?? [],
      meta: {
        page,
        pageSize,
        hasMore: [ventasRes.data, comprasRes.data, movimientosRes.data, puntosRes.data, canjesRes.data]
          .some((rows) => (rows ?? []).length >= pageSize),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}