import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Endpoint para registrar una acción crítica en audit_logs
export async function POST(request: NextRequest) {
  try {
    const { user_id, action, entity, entity_id, details } = await request.json();
    if (!user_id || !action || !entity) {
      return NextResponse.json({ success: false, error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { error } = await supabase.from("audit_logs").insert([
      {
        user_id,
        action,
        entity,
        entity_id,
        details,
      },
    ]);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Error inesperado" }, { status: 500 });
  }
}
