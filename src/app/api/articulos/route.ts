import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "../_utils/tenant-resolver";

type ArticuloIdentityRow = {
  id: string;
  nombre?: string | null;
  referencia?: string | null;
  codigo_secundario?: string | null;
};

type ArticuloInputRow = Record<string, unknown>;

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const fieldLabels: Record<keyof Pick<ArticuloIdentityRow, "referencia">, string> = {
  referencia: "código principal",
};

async function getArticuloIdentityRows(supabase: ReturnType<typeof getAdminClient>, tenantId: string) {
  return supabase
    .from("articulos")
    .select("id,nombre,referencia,codigo_secundario")
    .eq("tenant_id", tenantId);
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
    referencia: new Set<string>(),
  };

  for (const row of rows) {
    const referencia = normalizeText(row.referencia);
    if (referencia) {
      if (seen.referencia.has(referencia)) {
        return { field: "referencia" as const, value: String(row.referencia).trim() };
      }
      seen.referencia.add(referencia);
    }
  }

  return null;
}

function findDatabaseDuplicate(
  rows: ArticuloInputRow[],
  existingRows: ArticuloIdentityRow[],
  changedFields?: Array<keyof Pick<ArticuloIdentityRow, "referencia">>
) {
  const fieldsToCheck = changedFields ?? ["referencia"];

  const indexes = {
    referencia: new Map<string, ArticuloIdentityRow>(),
  };

  for (const row of existingRows) {
    const referencia = normalizeText(row.referencia);

    if (referencia) indexes.referencia.set(referencia, row);
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
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("articulos")
      .select("*")
      .eq("tenant_id", tenantId)
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
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
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

    const { data: existingRows, error: existingError } = await getArticuloIdentityRows(supabase, tenantId);
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

    const rowsWithTenant = rows.map((row) => ({ ...row, tenant_id: tenantId }));

    const { data, error } = await supabase.from("articulos").insert(rowsWithTenant).select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/articulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/articulos?id=xxx  — editar un artículo
// PATCH /api/articulos          — actualización masiva de precios { updates: [...] }
export async function PATCH(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
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
        .eq("tenant_id", tenantId)
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

      const fieldsToCheck = (["referencia"] as const).filter(
        (field) =>
          Object.prototype.hasOwnProperty.call(body, field) &&
          normalizeText(mergedRow[field]) !== normalizeText(currentRow[field])
      );

      if (fieldsToCheck.length > 0) {
        const { data: existingRows, error: existingError } = await getArticuloIdentityRows(supabase, tenantId);
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
        .eq("tenant_id", tenantId)
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
        .eq("id", item.id)
        .eq("tenant_id", tenantId);

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
export async function DELETE(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("articulos")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/articulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
