import { NextRequest, NextResponse } from "next/server";
import { insertWithAdmin } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log("[API matriculas/create] Datos recibidos:", body);

    // Validación básica
    if (!body.curso_id || !body.estudiante_id) {
      return NextResponse.json(
        { error: "curso_id y estudiante_id son requeridos" },
        { status: 400 }
      );
    }

    // Insertar usando service role (bypasea RLS)
    const { data, error } = await insertWithAdmin("matriculas", body);

    if (error) {
      console.error("[API matriculas/create] Error Supabase:", error);
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }

    console.log("[API matriculas/create] ✅ Matrícula creada:", data.id);
    return NextResponse.json({ data });

  } catch (err: any) {
    console.error("[API matriculas/create] Error general:", err);
    return NextResponse.json(
      { error: err.message || "Error al crear la matrícula" },
      { status: 500 }
    );
  }
}
