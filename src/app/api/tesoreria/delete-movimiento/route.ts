import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { movimientoId } = await request.json();

    if (!movimientoId) {
      return NextResponse.json({ success: false, error: "movimientoId es requerido" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ success: false, error: "Faltan llaves de Supabase" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error, count } = await supabaseAdmin
      .from("movimientos_financieros")
      .delete({ count: "exact" })
      .eq("id", movimientoId);

    if (error) throw error;

    if ((count || 0) === 0) {
      return NextResponse.json({ success: false, error: "No se encontro el movimiento" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("🔴 Error borrando movimiento:", error);
    return NextResponse.json({ success: false, error: error?.message || "Error desconocido" }, { status: 500 });
  }
}
