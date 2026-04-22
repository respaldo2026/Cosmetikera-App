import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendClubPointsWhatsApp } from "@/utils/club-whatsapp";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const TIPOS_VALIDOS = ["ganados", "canjeados", "bonificacion", "ajuste", "bienvenida", "cumpleanos", "racha", "referido"] as const;
type TipoPunto = (typeof TIPOS_VALIDOS)[number];

/**
 * POST /api/club/puntos
 * Registra una entrada en puntos_historial (service role, bypasa RLS).
 * Body: { perfil_id, tipo, puntos, concepto, referencia? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { perfil_id, tipo, puntos, concepto, referencia } = body;

    if (!perfil_id || !tipo || puntos === undefined || !concepto) {
      return NextResponse.json(
        { error: "perfil_id, tipo, puntos y concepto son requeridos" },
        { status: 400 }
      );
    }

    if (!TIPOS_VALIDOS.includes(tipo as TipoPunto)) {
      return NextResponse.json(
        { error: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(", ")}` },
        { status: 400 }
      );
    }

    if (typeof puntos !== "number" || !Number.isInteger(puntos)) {
      return NextResponse.json({ error: "puntos debe ser un entero" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { error } = await supabase.from("puntos_historial").insert({
      perfil_id,
      tipo,
      puntos,
      concepto,
      referencia: referencia || null,
    });

    if (error) {
      console.error("[POST /api/club/puntos]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("nombre_completo,telefono,puntos_fidelidad")
        .eq("id", perfil_id)
        .maybeSingle();

      if (perfil?.telefono) {
        const puntosMovimiento = tipo === "canjeados" ? -Math.abs(puntos) : puntos;
        await sendClubPointsWhatsApp({
          nombre: perfil.nombre_completo || "Cliente",
          telefono: perfil.telefono,
          tipo,
          puntosMovimiento,
          puntosActuales: Number(perfil.puntos_fidelidad || 0),
          concepto: typeof concepto === "string" ? concepto : null,
        });
      }
    } catch (whatsappError) {
      console.warn("[POST /api/club/puntos] No se pudo enviar WhatsApp de puntos", whatsappError);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/club/puntos] unexpected", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
