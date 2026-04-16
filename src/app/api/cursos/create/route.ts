import { NextRequest, NextResponse } from "next/server";
import { insertWithAdmin } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log("[API cursos/create] Datos recibidos:", body);

    // Insertar usando service role (bypasea RLS)
    const { data, error } = await insertWithAdmin("cursos", body);

    if (error) {
      console.error("[API cursos/create] Error Supabase:", error);
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }

    console.log("[API cursos/create] ✅ Grupo creado:", data.id);
    return NextResponse.json({ data });

  } catch (err: any) {
    console.error("[API cursos/create] Error general:", err);
    return NextResponse.json(
      { error: err.message || "Error al crear el grupo" },
      { status: 500 }
    );
  }
}
