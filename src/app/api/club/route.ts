import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function maskPhone(value: unknown) {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "").trim();
  if (digits.length < 4) return "";
  const visibleStart = digits.slice(0, Math.min(3, digits.length - 2));
  const visibleEnd = digits.slice(-2);
  const hidden = "•".repeat(Math.max(0, digits.length - visibleStart.length - visibleEnd.length));
  return `${visibleStart}${hidden}${visibleEnd}`;
}

/**
 * GET /api/club?acceso=1234567890
 * Busca el perfil de un cliente por cédula.
 * Usa service role para evitar problemas de RLS.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const acceso = (searchParams.get("acceso") || searchParams.get("cedula") || "")
      .replace(/\D/g, "")
      .trim();

    if (!acceso) {
      return NextResponse.json({ error: "dato de acceso requerido" }, { status: 400 });
    }

    // Validar que sea solo dígitos (evitar inyecciones)
    if (!/^\d{4,15}$/.test(acceso)) {
      return NextResponse.json({ error: "Dato de acceso inválido" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("perfiles")
      .select(
        "id,nombre_completo,telefono,cedula,puntos_fidelidad,puntos_canjeados,nivel_fidelidad,fecha_nacimiento"
      )
      .eq("cedula", acceso)
      .eq("rol", "cliente")
      .or("activo.is.null,activo.eq.true")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/club]", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...data,
        telefono: maskPhone(data.telefono),
      },
    });
  } catch (err) {
    console.error("[GET /api/club] unexpected", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * GET /api/club/historial?perfil_id=UUID
 * Devuelve el historial de puntos del cliente.
 */
export async function POST(request: Request) {
  try {
    const { perfil_id } = await request.json();
    if (!perfil_id) return NextResponse.json({ error: "perfil_id requerido" }, { status: 400 });

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("puntos_historial")
      .select("id,tipo,puntos,concepto,created_at")
      .eq("perfil_id", perfil_id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error("[POST /api/club]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
