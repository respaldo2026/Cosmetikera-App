import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "../_utils/tenant-resolver";

type CompraEstado = "pendiente" | "recibida" | "parcial" | "cancelada";

type CompraItem = {
  articulo_id?: string | null;
  nombre?: string | null;
  cantidad?: number;
  precio_unitario?: number;
};

type CompraPayload = {
  proveedor_id?: string | null;
  proveedor_nombre?: string | null;
  fecha?: string | null;
  total?: number;
  estado?: CompraEstado;
  notas?: string | null;
  items?: CompraItem[];
};

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function normalizeItems(rawItems: unknown): CompraItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const cantidad = Math.max(0, toNumber(row.cantidad));
      const precio = Math.max(0, toNumber(row.precio_unitario));
      const nombre = String(row.nombre || "").trim();
      const articuloId = String(row.articulo_id || "").trim();
      if (!nombre || cantidad <= 0) return null;
      return {
        articulo_id: articuloId || null,
        nombre,
        cantidad,
        precio_unitario: precio,
      };
    })
    .filter(Boolean) as CompraItem[];
}

function normalizeCompraPayload(body: Record<string, unknown>): CompraPayload {
  const items = normalizeItems(body.items);
  const estadoRaw = String(body.estado || "recibida").toLowerCase();
  const estado = (["pendiente", "recibida", "parcial", "cancelada"].includes(estadoRaw)
    ? estadoRaw
    : "recibida") as CompraEstado;
  const totalCalculado = items.reduce((acc, item) => acc + toNumber(item.cantidad) * toNumber(item.precio_unitario), 0);

  return {
    proveedor_id: String(body.proveedor_id || "").trim() || null,
    proveedor_nombre: String(body.proveedor_nombre || "").trim() || null,
    fecha: String(body.fecha || "").trim() || null,
    total: totalCalculado,
    estado,
    notas: String(body.notas || "").trim() || null,
    items,
  };
}

async function adjustStock(
  supabase: ReturnType<typeof getAdminClient>,
  tenantId: string,
  items: CompraItem[],
  multiplier: 1 | -1,
) {
  for (const item of items) {
    const articuloId = String(item.articulo_id || "").trim();
    if (!articuloId) continue;

    const { data: articulo, error: articuloError } = await supabase
      .from("articulos")
      .select("id,stock")
      .eq("id", articuloId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (articuloError) throw articuloError;
    if (!articulo?.id) continue;

    const nuevoStock = Math.max(0, toNumber(articulo.stock) + (toNumber(item.cantidad) * multiplier));
    const { error: updateError } = await supabase
      .from("articulos")
      .update({ stock: nuevoStock })
      .eq("id", articuloId)
      .eq("tenant_id", tenantId);

    if (updateError) throw updateError;
  }
}

async function getCompraById(supabase: ReturnType<typeof getAdminClient>, tenantId: string, id: string) {
  const { data, error } = await supabase
    .from("compras")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data as (CompraPayload & { id: string; tenant_id: string }) | null;
}

export async function GET(request: NextRequest) {
  try {
    let tenantContext;
    try {
      tenantContext = await resolveTenantContext(request);
    } catch (tenantErr) {
      console.warn("[GET /api/compras] Fallo resolución de tenant:", tenantErr);
      return NextResponse.json({ error: "No se pudo determinar el tenant" }, { status: 400 });
    }

    if (!tenantContext?.tenantId) {
      return NextResponse.json({ error: "Tenant ID vacío" }, { status: 400 });
    }

    const { tenantId } = tenantContext;
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
    console.error("[GET /api/compras] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const body = await request.json();
    const payload = normalizeCompraPayload(body && typeof body === "object" ? body as Record<string, unknown> : {});

    if (!payload.items?.length) {
      return NextResponse.json({ error: "Debes agregar al menos un item a la compra" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const insertPayload = {
      ...payload,
      tenant_id: tenantId,
      fecha: payload.fecha || new Date().toISOString().slice(0, 10),
    };

    const { data, error } = await supabase
      .from("compras")
      .insert([insertPayload])
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (payload.estado === "recibida") {
      await adjustStock(supabase, tenantId, payload.items, 1);
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/compras] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ error: "ID de compra requerido" }, { status: 400 });
    }

    const body = await request.json();
    const payload = normalizeCompraPayload(body && typeof body === "object" ? body as Record<string, unknown> : {});
    if (!payload.items?.length) {
      return NextResponse.json({ error: "La compra debe conservar al menos un item" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const actual = await getCompraById(supabase, tenantId, id);
    if (!actual?.id) {
      return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
    }

    if (actual.estado === "recibida") {
      await adjustStock(supabase, tenantId, normalizeItems(actual.items), -1);
    }

    const { data, error } = await supabase
      .from("compras")
      .update({
        ...payload,
        fecha: payload.fecha || actual.fecha || new Date().toISOString().slice(0, 10),
      })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("*")
      .maybeSingle();

    if (error) {
      if (actual.estado === "recibida") {
        await adjustStock(supabase, tenantId, normalizeItems(actual.items), 1);
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (payload.estado === "recibida") {
      await adjustStock(supabase, tenantId, payload.items, 1);
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("[PATCH /api/compras] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ error: "ID de compra requerido" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const actual = await getCompraById(supabase, tenantId, id);
    if (!actual?.id) {
      return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
    }

    if (actual.estado === "recibida") {
      await adjustStock(supabase, tenantId, normalizeItems(actual.items), -1);
    }

    const { error } = await supabase
      .from("compras")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) {
      if (actual.estado === "recibida") {
        await adjustStock(supabase, tenantId, normalizeItems(actual.items), 1);
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DELETE /api/compras] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
