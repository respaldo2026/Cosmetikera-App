import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type ArticuloIdentityRow = {
  id: string;
  nombre?: string | null;
  referencia?: string | null;
  codigo_secundario?: string | null;
};

type ArticuloInputRow = Record<string, unknown>;

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const fieldLabels: Record<keyof Pick<ArticuloIdentityRow, "nombre" | "referencia" | "codigo_secundario">, string> = {
  nombre: "nombre",
  referencia: "código principal",
  codigo_secundario: "código secundario",
};

async function getArticuloIdentityRows(supabase: ReturnType<typeof getAdminClient>) {
  return supabase.from("articulos").select("id,nombre,referencia,codigo_secundario");
}

function buildDuplicateError(field: keyof typeof fieldLabels, value: string, scope: "db" | "payload") {
  const label = fieldLabels[field];
  if (scope === "payload") {
    return `Hay artículos repetidos en la misma carga por ${label}: "${value}"`;
  }
  return `Ya existe un artículo con ${label} "${value}"`;
}

function findPayloadDuplicate(rows: ArticuloInputRow[]) {
  const seen = {
    nombre: new Set<string>(),
    referencia: new Set<string>(),
    codigo_secundario: new Set<string>(),
  };

  for (const row of rows) {
    const nombre = normalizeText(row.nombre);
    if (nombre) {
      if (seen.nombre.has(nombre)) {
        return { field: "nombre" as const, value: String(row.nombre).trim() };
      }
      seen.nombre.add(nombre);
    }

    const referencia = normalizeText(row.referencia);
    if (referencia) {
      if (seen.referencia.has(referencia)) {
        return { field: "referencia" as const, value: String(row.referencia).trim() };
      }
      seen.referencia.add(referencia);
    }

    const codigoSecundario = normalizeText(row.codigo_secundario);
    if (codigoSecundario) {
      if (seen.codigo_secundario.has(codigoSecundario)) {
        return { field: "codigo_secundario" as const, value: String(row.codigo_secundario).trim() };
      }
      seen.codigo_secundario.add(codigoSecundario);
    }
  }

  return null;
}

function findDatabaseDuplicate(
  rows: ArticuloInputRow[],
  existingRows: ArticuloIdentityRow[],
  changedFields?: Array<keyof Pick<ArticuloIdentityRow, "nombre" | "referencia" | "codigo_secundario">>
) {
  const fieldsToCheck = changedFields ?? ["nombre", "referencia", "codigo_secundario"];

  const indexes = {
    nombre: new Map<string, ArticuloIdentityRow>(),
    referencia: new Map<string, ArticuloIdentityRow>(),
    codigo_secundario: new Map<string, ArticuloIdentityRow>(),
  };

  for (const row of existingRows) {
    const nombre = normalizeText(row.nombre);
    const referencia = normalizeText(row.referencia);
    const codigoSecundario = normalizeText(row.codigo_secundario);

    if (nombre) indexes.nombre.set(nombre, row);
    if (referencia) indexes.referencia.set(referencia, row);
    if (codigoSecundario) indexes.codigo_secundario.set(codigoSecundario, row);
  }

  for (const row of rows) {
    for (const field of fieldsToCheck) {
      const normalized = normalizeText(row[field]);
      if (!normalized) continue;

      const match = indexes[field].get(normalized);
      if (match) {
        return {
          field,
          value: String(row[field]).trim(),
          id: match.id,
        };
      }
    }
  }

  return null;
}

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

    const duplicateInPayload = findPayloadDuplicate(rows);
    if (duplicateInPayload) {
      return NextResponse.json(
        { error: buildDuplicateError(duplicateInPayload.field, duplicateInPayload.value, "payload") },
        { status: 409 }
      );
    }

    const { data: existingRows, error: existingError } = await getArticuloIdentityRows(supabase);
    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    const duplicateInDb = findDatabaseDuplicate(rows, (existingRows as ArticuloIdentityRow[]) || []);
    if (duplicateInDb) {
      return NextResponse.json(
        { error: buildDuplicateError(duplicateInDb.field, duplicateInDb.value, "db") },
        { status: 409 }
      );
    }

    const { data, error } = await supabase.from("articulos").insert(rows).select("id,nombre");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/articulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/articulos?id=xxx  — editar un artículo
// PATCH /api/articulos          — actualización masiva de precios { updates: [...] }
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();
    const supabase = getAdminClient();

    // Edición individual
    if (id) {
      const { data: currentRow, error: currentError } = await supabase
        .from("articulos")
        .select("id,nombre,referencia,codigo_secundario")
        .eq("id", id)
        .single();

      if (currentError || !currentRow) {
        return NextResponse.json({ error: currentError?.message || "Artículo no encontrado" }, { status: 404 });
      }

      if (Object.prototype.hasOwnProperty.call(body, "nombre")) {
        if (typeof body.nombre !== "string" || !body.nombre.trim()) {
          return NextResponse.json({ error: "El nombre del artículo es obligatorio" }, { status: 400 });
        }
      }

      const mergedRow: ArticuloInputRow = {
        ...currentRow,
        ...body,
      };

      const fieldsToCheck = (["nombre", "referencia", "codigo_secundario"] as const).filter(
        (field) =>
          Object.prototype.hasOwnProperty.call(body, field) &&
          normalizeText(mergedRow[field]) !== normalizeText(currentRow[field])
      );

      if (fieldsToCheck.length > 0) {
        const { data: existingRows, error: existingError } = await getArticuloIdentityRows(supabase);
        if (existingError) {
          return NextResponse.json({ error: existingError.message }, { status: 400 });
        }

        const duplicateInDb = findDatabaseDuplicate(
          [mergedRow],
          ((existingRows as ArticuloIdentityRow[]) || []).filter((row) => row.id !== id),
          [...fieldsToCheck]
        );

        if (duplicateInDb) {
          return NextResponse.json(
            { error: buildDuplicateError(duplicateInDb.field, duplicateInDb.value, "db") },
            { status: 409 }
          );
        }
      }

      const { data, error } = await supabase
        .from("articulos")
        .update(body)
        .eq("id", id)
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ data });
    }

    // Actualización masiva de precios
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

// DELETE /api/articulos?id=xxx
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const supabase = getAdminClient();
    const { error } = await supabase.from("articulos").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/articulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
