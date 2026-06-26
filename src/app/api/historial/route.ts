import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireOperationPermission } from "../_utils/admin-guard";
import { resolveTenantContext } from "../_utils/tenant-resolver";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
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

    const [ventasRes, comprasRes, movimientosRes, puntosRes, canjesRes] = await Promise.all([
      supabase
        .from("ventas")
        .select("id,numero_ticket,fecha,total,subtotal,descuento,metodo_pago,cliente_id,items,cliente:perfiles(nombre_completo,cedula)")
        .eq("tenant_id", tenantId)
        .order("fecha", { ascending: false })
        .range(from, to),
      supabase
        .from("compras")
        .select("id,proveedor_id,proveedor_nombre,fecha,total,estado,notas,items")
        .eq("tenant_id", tenantId)
        .order("fecha", { ascending: false })
        .range(from, to),
      supabase
        .from("movimientos_financieros")
        .select("id,fecha,tipo,monto,concepto,categoria,metodo_pago,referencia,descripcion,estudiante_id,proveedor_id,conciliado,created_at, perfiles:perfiles!movimientos_financieros_estudiante_id_fkey(nombre_completo, telefono), proveedores:perfiles!movimientos_financieros_proveedor_id_fkey(nombre_completo)")
        .eq("tenant_id", tenantId)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase
        .from("puntos_historial")
        .select("id,perfil_id,tipo,puntos,concepto,referencia,created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase
        .from("canjes")
        .select("id,perfil_id,puntos,valor_cop,descripcion,estado,created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(from, to),
    ]);

    const errors = [ventasRes.error, comprasRes.error, movimientosRes.error, puntosRes.error, canjesRes.error].filter(Boolean);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.map((error: any) => error.message).join(" | ") },
        { status: 500 }
      );
    }

    const perfilIds = new Set<string>();
    const articuloIds = new Set<string>();

    for (const venta of ventasRes.data ?? []) {
      if (typeof venta?.cliente_id === "string" && venta.cliente_id) {
        perfilIds.add(venta.cliente_id);
      }

      const items = Array.isArray(venta?.items) ? venta.items : [];
      for (const item of items as Array<{ id?: string }>) {
        if (typeof item?.id === "string" && item.id) {
          articuloIds.add(item.id);
        }
      }
    }

    for (const movimiento of movimientosRes.data ?? []) {
      if (typeof movimiento?.estudiante_id === "string" && movimiento.estudiante_id) {
        perfilIds.add(movimiento.estudiante_id);
      }
      if (typeof movimiento?.proveedor_id === "string" && movimiento.proveedor_id) {
        perfilIds.add(movimiento.proveedor_id);
      }
    }

    for (const punto of puntosRes.data ?? []) {
      if (typeof punto?.perfil_id === "string" && punto.perfil_id) {
        perfilIds.add(punto.perfil_id);
      }
    }

    for (const canje of canjesRes.data ?? []) {
      if (typeof canje?.perfil_id === "string" && canje.perfil_id) {
        perfilIds.add(canje.perfil_id);
      }
    }

    const perfilIdList = Array.from(perfilIds);
    const articuloIdList = Array.from(articuloIds);

    const perfilesRes = perfilIdList.length
      ? await supabase
          .from("perfiles")
          .select("id,nombre_completo,cedula")
          .eq("tenant_id", tenantId)
          .in("id", perfilIdList)
      : { data: [], error: null };

    const articulosRes = articuloIdList.length
      ? await supabase
          .from("articulos")
          .select("id,nombre,categoria,marca,precio_costo,precio_venta")
          .eq("tenant_id", tenantId)
          .in("id", articuloIdList)
      : { data: [], error: null };

    const relatedErrors = [perfilesRes.error, articulosRes.error].filter(Boolean);
    if (relatedErrors.length > 0) {
      return NextResponse.json(
        { error: relatedErrors.map((error: any) => error.message).join(" | ") },
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

type DeleteHistorialBody = {
  id?: string;
  tipo?: "venta" | "compra" | "movimiento" | "puntos" | "voucher";
};

function extractPosNumber(text: string): number | null {
  const match = String(text || "").match(/(?:venta|compra)?\s*pos\s*#?\s*(\d{3,})/i);
  if (!match?.[1]) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export async function DELETE(request: NextRequest) {
  try {
    const adminCheck = await requireOperationPermission(request, "historial_eliminar");
    if (!adminCheck.ok) return adminCheck.response;
    const { tenantId } = await resolveTenantContext(request);

    const body = (await request.json()) as DeleteHistorialBody;
    const id = String(body.id || "").trim();
    const tipo = body.tipo;

    if (!id || !tipo) {
      return NextResponse.json({ error: "id y tipo son obligatorios" }, { status: 400 });
    }

    const supabase = getAdminClient();

    if (tipo === "venta") {
      const { data: ventaActual, error: ventaError } = await supabase
        .from("ventas")
        .select("id,numero_ticket")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (ventaError) {
        return NextResponse.json({ error: ventaError.message }, { status: 400 });
      }

      if (!ventaActual?.id) {
        return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
      }

      const ticket = Number(ventaActual.numero_ticket || 0);

      const { error: deleteVentaError } = await supabase
        .from("ventas")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (deleteVentaError) {
        return NextResponse.json({ error: deleteVentaError.message }, { status: 400 });
      }

      if (Number.isFinite(ticket) && ticket > 0) {
        const tag = `POS #${ticket}`;

        await supabase
          .from("movimientos_financieros")
          .delete()
          .eq("tenant_id", tenantId)
          .or(`concepto.ilike.%${tag}%,descripcion.ilike.%${tag}%,referencia.ilike.%${ticket}%`);

        await supabase
          .from("puntos_historial")
          .delete()
          .eq("tenant_id", tenantId)
          .or(`concepto.ilike.%${tag}%,referencia.ilike.%${ticket}%`);
      }

      return NextResponse.json({ ok: true });
    }

    const tableByTipo: Record<Exclude<DeleteHistorialBody["tipo"], "venta" | undefined>, string> = {
      compra: "compras",
      movimiento: "movimientos_financieros",
      puntos: "puntos_historial",
      voucher: "canjes",
    };

    const table = tableByTipo[tipo as Exclude<DeleteHistorialBody["tipo"], "venta" | undefined>];
    if (!table) {
      return NextResponse.json({ error: "Tipo de transacción inválido" }, { status: 400 });
    }

    const { error } = await supabase.from(table).delete().eq("id", id).eq("tenant_id", tenantId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}