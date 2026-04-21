import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function limpiarNumero(valor: unknown) {
  if (typeof valor !== "string") return null;
  const digits = valor.replace(/\D/g, "").trim();
  return digits || null;
}

function normalizarPayload(body: Record<string, unknown>) {
  const payload = { ...body };

  if ("nombre_completo" in payload && typeof payload.nombre_completo === "string") {
    payload.nombre_completo = payload.nombre_completo.trim();
  }

  if ("cedula" in payload) payload.cedula = limpiarNumero(payload.cedula);
  if ("telefono" in payload) payload.telefono = limpiarNumero(payload.telefono);
  if ("telefono_2" in payload) payload.telefono_2 = limpiarNumero(payload.telefono_2);

  if (payload.telefono && payload.telefono === payload.telefono_2) {
    payload.telefono_2 = null;
  }

  return payload;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rol = searchParams.get("rol") || "cliente";

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("perfiles")
      .select("id,nombre_completo,telefono,telefono_2,email,cedula,puntos_fidelidad,nivel_fidelidad,fecha_nacimiento,total_compras,activo,created_at")
      .eq("rol", rol)
      .order("nombre_completo");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/perfiles]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const body = normalizarPayload(await request.json());
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("perfiles")
      .update(body)
      .eq("id", id)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[PATCH /api/perfiles]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      nombre_completo,
      telefono,
      telefono_2,
      email,
      cedula,
      fecha_nacimiento,
      rol = "cliente",
      puntos_fidelidad = 50,
      nivel_fidelidad = "bronce",
      puntos_ganados = 50,
      activo = true,
    } = body;

    const cedulaNormalizada = limpiarNumero(cedula);
    const telefonoNormalizado = limpiarNumero(telefono);
    const telefonoAlternoNormalizado = limpiarNumero(telefono_2);

    if (!nombre_completo?.trim()) {
      return NextResponse.json(
        { error: "nombre_completo es obligatorio" },
        { status: 400 }
      );
    }

    if (!cedulaNormalizada) {
      return NextResponse.json(
        { error: "La cédula es obligatoria — es uno de los accesos al portal Club" },
        { status: 400 }
      );
    }

    if (!/^\d{4,15}$/.test(cedulaNormalizada)) {
      return NextResponse.json(
        { error: "La cédula debe contener solo dígitos (4-15 caracteres)" },
        { status: 400 }
      );
    }

    if (telefonoNormalizado && !/^\d{7,15}$/.test(telefonoNormalizado)) {
      return NextResponse.json(
        { error: "El teléfono principal debe contener solo dígitos (7-15 caracteres)" },
        { status: 400 }
      );
    }

    if (telefonoAlternoNormalizado && !/^\d{7,15}$/.test(telefonoAlternoNormalizado)) {
      return NextResponse.json(
        { error: "El teléfono alterno debe contener solo dígitos (7-15 caracteres)" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("perfiles")
      .insert({
        nombre_completo: nombre_completo.trim(),
        telefono: telefonoNormalizado,
        telefono_2: telefonoAlternoNormalizado && telefonoAlternoNormalizado !== telefonoNormalizado
          ? telefonoAlternoNormalizado
          : null,
        email: email || null,
        cedula: cedulaNormalizada,
        fecha_nacimiento: fecha_nacimiento || null,
        rol,
        puntos_fidelidad,
        nivel_fidelidad,
        puntos_ganados,
        activo,
      })
      .select("id,nombre_completo,rol")
      .single();

    if (error) {
      console.error("[POST /api/perfiles]", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/perfiles] unexpected", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
