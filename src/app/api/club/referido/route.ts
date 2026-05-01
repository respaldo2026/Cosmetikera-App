import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_REGLAS, GAIN_TIPOS, getMonthRangeUtc, getNivelDinamico, mergeClubRules } from "@/utils/club-rules";

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

    const [reglasRes, perfilesRes] = await Promise.all([
      supabase.from("club_reglas_config").select("clave,valor"),
      supabase
      .from("perfiles")
      .select("id, nombre_completo, puntos_fidelidad, nivel_fidelidad")
      .eq("activo", true)
      .eq("rol", "cliente")
      .ilike("id", `${prefix}%`),
    ]);

    const reglasRaw = Object.fromEntries((reglasRes.data || []).map((row: any) => [row.clave, Number(row.valor)]));
    const reglas = mergeClubRules({ ...DEFAULT_REGLAS, ...reglasRaw });

    // 1. Buscar al referidor cuyo UUID empieza por el prefijo
    const perfiles = perfilesRes.data;
    const searchError = perfilesRes.error;

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

    // 4. Acreditar puntos de referido con topes dinámicos
    const puntosReferido = Math.max(0, Math.floor(reglas.puntos_referido || 0));
    const puntosActuales = Number(referidor.puntos_fidelidad || 0);

    const { startIso, endIso } = getMonthRangeUtc(new Date());
    const { data: ganadosMesData } = await supabase
      .from("puntos_historial")
      .select("puntos,tipo")
      .eq("perfil_id", referidor.id)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .in("tipo", [...GAIN_TIPOS])
      .limit(2000);

    const ganadosMes = (ganadosMesData || []).reduce((acc: number, row: any) => {
      const puntos = Number(row?.puntos || 0);
      return puntos > 0 ? acc + puntos : acc;
    }, 0);

    const maxMes = Math.max(0, Math.floor(reglas.puntos_max_ganados_mes || 0));
    const cupoMes = maxMes > 0 ? Math.max(0, maxMes - ganadosMes) : puntosReferido;

    const maxSaldo = Math.max(0, Math.floor(reglas.puntos_max_saldo || 0));
    const cupoSaldo = maxSaldo > 0 ? Math.max(0, maxSaldo - puntosActuales) : puntosReferido;

    const puntosAcreditar = Math.max(0, Math.min(puntosReferido, cupoMes, cupoSaldo));
    if (puntosAcreditar <= 0) {
      return NextResponse.json(
        { error: "No se acreditaron puntos de referido porque el cliente alcanzó el límite mensual o el tope de saldo." },
        { status: 409 }
      );
    }

    const nuevosPuntos = puntosActuales + puntosAcreditar;

    const { error: updateReferidorError } = await supabase
      .from("perfiles")
      .update({
        puntos_fidelidad: nuevosPuntos,
        nivel_fidelidad: getNivelDinamico(nuevosPuntos, reglas),
      })
      .eq("id", referidor.id);

    if (updateReferidorError) {
      return NextResponse.json({ error: updateReferidorError.message }, { status: 500 });
    }

    // 5. Registrar en historial de puntos del referidor
    await supabase.from("puntos_historial").insert({
      perfil_id: referidor.id,
      tipo: "referido",
      puntos: puntosAcreditar,
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
        puntosAcreditados: puntosAcreditar,
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
