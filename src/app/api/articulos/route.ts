import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/articulos — lista todos los artículos
export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("articulos")
      .select("*")
      .order("nombre");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/articulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/articulos — crear uno o varios artículos
// body: { articulo: {...} }  o  { articulos: [{...}, ...] }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getAdminClient();

    const rows: Record<string, unknown>[] = body.articulos
      ? body.articulos
      : [body.articulo];

    if (!rows || rows.length === 0)
      return NextResponse.json({ error: "Sin datos" }, { status: 400 });

    // Validar campo mínimo
    for (const row of rows) {
      if (!row.nombre || typeof row.nombre !== "string" || !row.nombre.trim())
        return NextResponse.json({ error: "Cada artículo debe tener nombre" }, { status: 400 });
    }

    const { data, error } = await supabase.from("articulos").insert(rows).select("id,nombre");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/articulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/articulos — actualización masiva de precios
// body: { updates: [{ id, precio_venta?, precio_costo? }, ...] }
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const supabase = getAdminClient();

    if (!Array.isArray(body.updates) || body.updates.length === 0)
      return NextResponse.json({ error: "updates requerido (array)" }, { status: 400 });

    let errores = 0;
    for (const item of body.updates) {
      if (!item.id) { errores++; continue; }
      const update: Record<string, number> = {};
      if (typeof item.precio_venta === "number") update.precio_venta = item.precio_venta;
      if (typeof item.precio_costo === "number") update.precio_costo = item.precio_costo;
      if (Object.keys(update).length === 0) continue;

      const { error } = await supabase
        .from("articulos")
        .update(update)
        .eq("id", item.id);

      if (error) errores++;
    }

    if (errores > 0)
      return NextResponse.json({ ok: false, errores }, { status: 207 });

    return NextResponse.json({ ok: true, actualizados: body.updates.length });
  } catch (err) {
    console.error("[PATCH /api/articulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
