import { NextRequest, NextResponse } from "next/server";
import { insertWithAdmin, updateWithAdmin } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log("[API pagos/create] Datos recibidos:", body);

    // Validación básica
    if (!body.estudiante_id || !body.monto) {
      return NextResponse.json(
        { error: "estudiante_id y monto son requeridos" },
        { status: 400 }
      );
    }

    // Insertar usando service role (bypasea RLS)
    const { data, error } = await insertWithAdmin("pagos", body);

    if (error) {
      console.error("[API pagos/create] Error Supabase:", error);
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }

    console.log("[API pagos/create] ✅ Pago creado:", data.id);
    return NextResponse.json({ data });

  } catch (err: any) {
    console.error("[API pagos/create] Error general:", err);
    return NextResponse.json(
      { error: err.message || "Error al crear el pago" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    
    console.log("[API pagos/update] Actualizando pago:", id);

    if (!id) {
      return NextResponse.json(
        { error: "id es requerido para actualizar" },
        { status: 400 }
      );
    }

    // Actualizar usando service role (bypasea RLS)
    const { data, error } = await updateWithAdmin("pagos", updateData, { id });

    if (error) {
      console.error("[API pagos/update] Error Supabase:", error);
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }

    console.log("[API pagos/update] ✅ Pago actualizado:", id);
    return NextResponse.json({ data: data?.[0] });

  } catch (err: any) {
    console.error("[API pagos/update] Error general:", err);
    return NextResponse.json(
      { error: err.message || "Error al actualizar el pago" },
      { status: 500 }
    );
  }
}
