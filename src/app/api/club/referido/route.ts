import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PUNTOS_REFERIDO = 300;

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * Dado un código de referido COSM-XXXXXXXX, resuelve el UUID del referidor.
 * El código es: COSM- + primeros 8 chars del UUID sin guiones en mayúsculas.
 */
function resolveReferrerFromCode(code: string): string | null {
  const match = code.trim().toUpperCase().match(/^COSM-([A-Z0-9]{8})$/);
  if (!match) return null;
  const prefix = match[1];
  if (!prefix) return null;
  return prefix.toLowerCase(); // prefijo del UUID
}

/**
 * POST /api/club/referido
 * Body: { codigo: string, nuevoClienteId: string }
 *
 * Valida el código de referido, encuentra al referidor,
 * acredita 300 puntos al referidor y vincula el nuevo cliente.
 */
export async function POST(request: NextRequest) {
  try {
    const { codigo, nuevoClienteId } = await request.json();

    if (!codigo || !nuevoClienteId) {
      return NextResponse.json(
        { error: "codigo y nuevoClienteId son requeridos" },
        { status: 400 }
      );
    }

    const prefix = resolveReferrerFromCode(codigo);
    if (!prefix) {
      return NextResponse.json(
        { error: "Código de referido inválido. Debe tener el formato COSM-XXXXXXXX" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // 1. Buscar al referidor cuyo UUID empieza por el prefijo
    const { data: perfiles, error: searchError } = await supabase
      .from("perfiles")
      .select("id, nombre_completo, puntos_fidelidad, nivel_fidelidad")
      .eq("activo", true)
      .eq("rol", "cliente")
      .ilike("id", `${prefix}%`);

    if (searchError) {
      return NextResponse.json({ error: searchError.message }, { status: 500 });
    }

    if (!perfiles || perfiles.length === 0) {
      return NextResponse.json(
        { error: "No se encontró ningún cliente con ese código de referido" },
        { status: 404 }
      );
    }

    const referidor = perfiles[0];
    if (!referidor) {
      return NextResponse.json(
        { error: "No se encontró ningún cliente con ese código de referido" },
        { status: 404 }
      );
    }

    // 2. Verificar que el nuevo cliente no sea el mismo que el referidor
    if (referidor.id === nuevoClienteId) {
      return NextResponse.json(
        { error: "No puedes usar tu propio código de referido" },
        { status: 400 }
      );
    }

    // 3. Verificar que el nuevo cliente no haya sido ya acreditado por referido
    const { data: nuevoCliente, error: clienteError } = await supabase
      .from("perfiles")
      .select("id, referido_acreditado, referido_por")
      .eq("id", nuevoClienteId)
      .single();

    if (clienteError || !nuevoCliente) {
      return NextResponse.json({ error: "Nuevo cliente no encontrado" }, { status: 404 });
    }

    if (nuevoCliente.referido_acreditado) {
      return NextResponse.json(
        { error: "Este cliente ya tiene un referido acreditado" },
        { status: 409 }
      );
    }

    // 4. Acreditar 300 puntos al referidor
    const nuevosPuntos = (referidor.puntos_fidelidad || 0) + PUNTOS_REFERIDO;

    const { error: updateReferidorError } = await supabase
      .from("perfiles")
      .update({ puntos_fidelidad: nuevosPuntos })
      .eq("id", referidor.id);

    if (updateReferidorError) {
      return NextResponse.json({ error: updateReferidorError.message }, { status: 500 });
    }

    // 5. Registrar en historial de puntos del referidor
    await supabase.from("puntos_historial").insert({
      perfil_id: referidor.id,
      tipo: "referido",
      puntos: PUNTOS_REFERIDO,
      concepto: `Referido exitoso · nuevo cliente registrado con tu código ${codigo.toUpperCase()}`,
    });

    // 6. Vincular el nuevo cliente con el referidor y marcarlo como acreditado
    await supabase
      .from("perfiles")
      .update({
        referido_por: referidor.id,
        referido_acreditado: true,
      })
      .eq("id", nuevoClienteId);

    return NextResponse.json({
      ok: true,
      referidor: {
        id: referidor.id,
        nombre: referidor.nombre_completo,
        puntosAcreditados: PUNTOS_REFERIDO,
        nuevosPuntos,
      },
    });
  } catch (err) {
    console.error("[POST /api/club/referido]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * GET /api/club/referido?codigo=COSM-XXXXXXXX
 * Valida un código y devuelve el nombre del referidor (para mostrar en UI).
 */
export async function GET(request: NextRequest) {
  try {
    const codigo = request.nextUrl.searchParams.get("codigo");
    if (!codigo) {
      return NextResponse.json({ error: "codigo requerido" }, { status: 400 });
    }

    const prefix = resolveReferrerFromCode(codigo);
    if (!prefix) {
      return NextResponse.json({ valid: false, error: "Formato inválido" });
    }

    const supabase = getAdminClient();

    const { data: perfiles } = await supabase
      .from("perfiles")
      .select("id, nombre_completo")
      .eq("activo", true)
      .eq("rol", "cliente")
      .ilike("id", `${prefix}%`)
      .limit(1);

    if (!perfiles || perfiles.length === 0) {
      return NextResponse.json({ valid: false, error: "Código no encontrado" });
    }

    const referidor = perfiles[0];
    if (!referidor) {
      return NextResponse.json({ valid: false, error: "Código no encontrado" });
    }

    return NextResponse.json({
      valid: true,
      referidor: referidor.nombre_completo,
    });
  } catch (err) {
    console.error("[GET /api/club/referido]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
