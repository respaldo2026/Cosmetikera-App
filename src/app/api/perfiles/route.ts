import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      nombre_completo,
      telefono,
      email,
      cedula,
      fecha_nacimiento,
      rol = "cliente",
      puntos_fidelidad = 50,
      nivel_fidelidad = "bronce",
      puntos_ganados = 50,
      activo = true,
    } = body;

    if (!nombre_completo?.trim()) {
      return NextResponse.json(
        { error: "nombre_completo es obligatorio" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("perfiles")
      .insert({
        nombre_completo: nombre_completo.trim(),
        telefono: telefono || null,
        email: email || null,
        cedula: cedula || null,
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
