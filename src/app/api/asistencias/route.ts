import { NextRequest, NextResponse } from "next/server";
import { insertWithAdmin, updateWithAdmin } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log("[API asistencias/create] Datos recibidos:", body);

    // Validación básica
    if (!body.matricula_id || !body.fecha) {
      return NextResponse.json(
        { error: "matricula_id y fecha son requeridos" },
        { status: 400 }
      );
    }

    // Insertar usando service role (bypasea RLS)
    const { data, error } = await insertWithAdmin("asistencias", body);

    if (error) {
      console.error("[API asistencias/create] Error Supabase:", error);
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }

    console.log("[API asistencias/create] ✅ Asistencia creada:", data.id);
    return NextResponse.json({ data });

  } catch (err: any) {
    console.error("[API asistencias/create] Error general:", err);
    return NextResponse.json(
      { error: err.message || "Error al crear la asistencia" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    
    console.log("[API asistencias/update] Actualizando asistencia:", id);

    if (!id) {
      return NextResponse.json(
        { error: "id es requerido para actualizar" },
        { status: 400 }
      );
    }

    // Actualizar usando service role (bypasea RLS)
    const { data, error } = await updateWithAdmin("asistencias", updateData, { id });

    if (error) {
      console.error("[API asistencias/update] Error Supabase:", error);
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }

    console.log("[API asistencias/update] ✅ Asistencia actualizada:", id);
    return NextResponse.json({ data: data?.[0] });

  } catch (err: any) {
    console.error("[API asistencias/update] Error general:", err);
    return NextResponse.json(
      { error: err.message || "Error al actualizar la asistencia" },
      { status: 500 }
    );
  }
}
