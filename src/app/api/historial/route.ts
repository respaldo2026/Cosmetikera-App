import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function GET() {
  try {
    const supabase = getAdminClient();

    const [ventasRes, comprasRes, movimientosRes, puntosRes, canjesRes, perfilesRes] = await Promise.all([
      supabase
        .from("ventas")
        .select("id,fecha,total,subtotal,descuento,metodo_pago,cliente_id,items,cliente:perfiles(nombre_completo,cedula)")
        .order("fecha", { ascending: false })
        .limit(500),
      supabase
        .from("compras")
        .select("id,proveedor_id,proveedor_nombre,fecha,total,estado,notas,items")
        .order("fecha", { ascending: false })
        .limit(300),
      supabase
        .from("movimientos_financieros")
        .select("id,fecha,tipo,monto,concepto,categoria,metodo_pago,referencia,descripcion,estudiante_id,proveedor_id,conciliado,created_at, perfiles:perfiles!movimientos_financieros_estudiante_id_fkey(nombre_completo, telefono), proveedores:perfiles!movimientos_financieros_proveedor_id_fkey(nombre_completo)")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("puntos_historial")
        .select("id,perfil_id,tipo,puntos,concepto,referencia,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("canjes")
        .select("id,perfil_id,puntos,valor_cop,descripcion,estado,created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("perfiles")
        .select("id,nombre_completo,cedula")
        .order("nombre_completo")
        .limit(2000),
    ]);

    const errors = [ventasRes.error, comprasRes.error, movimientosRes.error, puntosRes.error, canjesRes.error, perfilesRes.error].filter(Boolean);
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
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}