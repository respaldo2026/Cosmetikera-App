import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTenantContext } from "../../_utils/tenant-resolver";

type VentaItem = {
  id?: string;
  nombre?: string;
  cantidad?: number;
  precio?: number;
  precio_venta?: number;
};

type Articulo = {
  id: string;
  nombre: string | null;
  categoria: string | null;
  marca: string | null;
  stock: number | null;
  stock_minimo: number | null;
  precio_venta: number | null;
  descuento_porcentaje?: number | null;
  promocion_texto?: string | null;
  imagen_url?: string | null;
};

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function toArrayItems(value: unknown): VentaItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as VentaItem[];
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function safeNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function promoBoost(articulo: Articulo) {
  if (safeNumber(articulo.descuento_porcentaje) > 0) return 18;
  if (normalizeText(articulo.promocion_texto).length > 0) return 12;
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const perfilId = request.nextUrl.searchParams.get("perfil_id")?.trim();
    if (!perfilId) {
      return NextResponse.json({ error: "perfil_id requerido" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const [ventasRes, articulosRes] = await Promise.all([
      supabase
        .from("ventas")
        .select("id,fecha,items")
        .eq("tenant_id", tenantId)
        .eq("cliente_id", perfilId)
        .order("fecha", { ascending: false })
        .limit(120),
      supabase
        .from("articulos")
        .select("*")
        .eq("tenant_id", tenantId)
        .gt("stock", 0)
        .order("nombre", { ascending: true })
        .limit(500),
    ]);

    if (ventasRes.error) {
      return NextResponse.json({ error: ventasRes.error.message }, { status: 500 });
    }
    if (articulosRes.error) {
      return NextResponse.json({ error: articulosRes.error.message }, { status: 500 });
    }

    const ventas = ventasRes.data ?? [];
    const articulos = (articulosRes.data ?? []) as Articulo[];

    const categoryAffinity = new Map<string, number>();
    const brandAffinity = new Map<string, number>();
    const purchasedIds = new Set<string>();

    const articuloMap = new Map(articulos.map((articulo) => [articulo.id, articulo]));

    ventas.forEach((venta, index) => {
      const recencyWeight = Math.max(1, 6 - Math.floor(index / 20));
      const items = toArrayItems(venta.items);

      items.forEach((item) => {
        const cantidad = Math.max(1, safeNumber(item.cantidad, 1));
        const itemWeight = cantidad * recencyWeight;

        const itemId = typeof item.id === "string" ? item.id : "";
        if (itemId) purchasedIds.add(itemId);

        const articulo = itemId ? articuloMap.get(itemId) : undefined;
        const categoria = normalizeText(articulo?.categoria);
        const marca = normalizeText(articulo?.marca);

        if (categoria) {
          categoryAffinity.set(categoria, (categoryAffinity.get(categoria) || 0) + itemWeight);
        }
        if (marca) {
          brandAffinity.set(marca, (brandAffinity.get(marca) || 0) + itemWeight);
        }
      });
    });

    const scored = articulos
      .filter((articulo) => !purchasedIds.has(articulo.id))
      .map((articulo) => {
        const categoria = normalizeText(articulo.categoria);
        const marca = normalizeText(articulo.marca);
        const categoryScore = (categoryAffinity.get(categoria) || 0) * 3;
        const brandScore = (brandAffinity.get(marca) || 0) * 2;
        const lowStockPenalty = safeNumber(articulo.stock) <= Math.max(1, safeNumber(articulo.stock_minimo, 3)) ? -4 : 0;
        const score = categoryScore + brandScore + promoBoost(articulo) + lowStockPenalty;

        const razones: string[] = [];
        if (categoryScore > 0 && articulo.categoria) razones.push(`Compras frecuente en ${articulo.categoria}`);
        if (brandScore > 0 && articulo.marca) razones.push(`Sueles elegir ${articulo.marca}`);
        if (safeNumber(articulo.descuento_porcentaje) > 0) razones.push(`${safeNumber(articulo.descuento_porcentaje)}% de descuento activo`);
        if (!razones.length) razones.push("Producto destacado del catálogo actual");

        return {
          id: articulo.id,
          nombre: articulo.nombre,
          categoria: articulo.categoria,
          marca: articulo.marca,
          precio_venta: articulo.precio_venta,
          descuento_porcentaje: articulo.descuento_porcentaje,
          promocion_texto: articulo.promocion_texto,
          imagen_url: articulo.imagen_url,
          stock: articulo.stock,
          score,
          razon: razones.join(" · "),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return NextResponse.json({
      data: scored,
      meta: {
        ventasAnalizadas: ventas.length,
        personalizada: ventas.length > 0,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
