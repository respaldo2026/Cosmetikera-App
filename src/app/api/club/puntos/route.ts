import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendClubPointsWhatsApp } from "@/utils/club-whatsapp";
import { resolveTenantContext } from "../../_utils/tenant-resolver";
import {
  DEFAULT_REGLAS,
  GAIN_TIPOS,
  getMonthRangeUtc,
  getNivelDinamico,
  mergeClubRules,
  type ClubReglas,
} from "@/utils/club-rules";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const TIPOS_VALIDOS = ["ganados", "canjeados", "bonificacion", "ajuste", "bienvenida", "cumpleanos", "racha", "referido", "expiracion"] as const;
type TipoPunto = (typeof TIPOS_VALIDOS)[number];

const TIPOS_POSITIVOS_CON_REGLA = new Set<string>([...GAIN_TIPOS]);

async function loadClubRules(supabase: ReturnType<typeof getAdminClient>, tenantId: string): Promise<ClubReglas> {
  const { data } = await supabase
    .from("club_reglas_config")
    .select("clave,valor")
    .eq("tenant_id", tenantId);
  const raw = Object.fromEntries((data || []).map((row: any) => [row.clave, Number(row.valor)]));
  return mergeClubRules({ ...DEFAULT_REGLAS, ...raw });
}

async function applyExpiryIfNeeded(
  supabase: ReturnType<typeof getAdminClient>,
  tenantId: string,
  perfilId: string,
  reglas: ClubReglas,
  currentPoints: number,
) {
  const vigenciaDias = Math.max(0, Math.floor(reglas.puntos_vigencia_dias || 0));
  if (vigenciaDias <= 0) {
    return { pointsAfterExpiry: currentPoints, expiredNow: 0 };
  }

  const cutoffDate = new Date(Date.now() - vigenciaDias * 24 * 60 * 60 * 1000).toISOString();

  const [oldGainsRes, consumptionsRes, expiredRes] = await Promise.all([
    supabase
      .from("puntos_historial")
      .select("puntos,tipo")
      .eq("tenant_id", tenantId)
      .eq("perfil_id", perfilId)
      .lt("created_at", cutoffDate)
      .in("tipo", [...GAIN_TIPOS])
      .limit(5000),
    supabase
      .from("puntos_historial")
      .select("puntos,tipo")
      .eq("tenant_id", tenantId)
      .eq("perfil_id", perfilId)
      .lt("created_at", cutoffDate)
      .not("tipo", "eq", "expiracion")
      .limit(5000),
    supabase
      .from("puntos_historial")
      .select("puntos")
      .eq("tenant_id", tenantId)
      .eq("perfil_id", perfilId)
      .eq("tipo", "expiracion")
      .limit(5000),
  ]);

  const oldGains = (oldGainsRes.data || []).reduce((acc: number, row: any) => {
    const value = Number(row?.puntos || 0);
    return value > 0 ? acc + value : acc;
  }, 0);

  const consumptionsOldWindow = (consumptionsRes.data || []).reduce((acc: number, row: any) => {
    const value = Number(row?.puntos || 0);
    return value < 0 ? acc + Math.abs(value) : acc;
  }, 0);

  const alreadyExpired = (expiredRes.data || []).reduce((acc: number, row: any) => {
    const value = Number(row?.puntos || 0);
    return value < 0 ? acc + Math.abs(value) : acc;
  }, 0);

  const pendingExpiry = Math.max(0, oldGains - consumptionsOldWindow - alreadyExpired);
  const expiredNow = Math.min(currentPoints, pendingExpiry);

  if (expiredNow <= 0) {
    return { pointsAfterExpiry: currentPoints, expiredNow: 0 };
  }

  await supabase.from("puntos_historial").insert({
    tenant_id: tenantId,
    perfil_id: perfilId,
    tipo: "expiracion",
    puntos: -expiredNow,
    concepto: `Vencimiento automático de puntos (${vigenciaDias} días de vigencia)` ,
  });

  const pointsAfterExpiry = Math.max(0, currentPoints - expiredNow);
  await supabase
    .from("perfiles")
    .update({
      puntos_fidelidad: pointsAfterExpiry,
      nivel_fidelidad: getNivelDinamico(pointsAfterExpiry, reglas),
    })
    .eq("id", perfilId)
    .eq("tenant_id", tenantId);

  return { pointsAfterExpiry, expiredNow };
}

/**
 * POST /api/club/puntos
 * Registra una entrada en puntos_historial (service role, bypasa RLS).
 * Body: { perfil_id, tipo, puntos, concepto, referencia? }
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const body = await request.json();
    const { perfil_id, tipo, puntos, concepto, referencia, actualizar_perfil } = body;

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
    const reglas = await loadClubRules(supabase, tenantId);

    let puntosAplicados = Number(puntos);

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("id,nombre_completo,telefono,puntos_fidelidad,puntos_ganados")
      .eq("id", perfil_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (perfil && actualizar_perfil) {
      const currentPoints = Number(perfil.puntos_fidelidad || 0);
      const { pointsAfterExpiry } = await applyExpiryIfNeeded(supabase, tenantId, perfil_id, reglas, currentPoints);

      if (puntosAplicados > 0 && TIPOS_POSITIVOS_CON_REGLA.has(String(tipo))) {
        const { startIso, endIso } = getMonthRangeUtc(new Date());
        const { data: monthRows } = await supabase
          .from("puntos_historial")
          .select("puntos,tipo")
          .eq("tenant_id", tenantId)
          .eq("perfil_id", perfil_id)
          .gte("created_at", startIso)
          .lte("created_at", endIso)
          .in("tipo", [...GAIN_TIPOS])
          .limit(5000);

        const gainedThisMonth = (monthRows || []).reduce((acc: number, row: any) => {
          const value = Number(row?.puntos || 0);
          return value > 0 ? acc + value : acc;
        }, 0);

        const maxMes = Math.max(0, Math.floor(reglas.puntos_max_ganados_mes || 0));
        const cupoMes = maxMes > 0 ? Math.max(0, maxMes - gainedThisMonth) : puntosAplicados;

        const maxSaldo = Math.max(0, Math.floor(reglas.puntos_max_saldo || 0));
        const cupoSaldo = maxSaldo > 0 ? Math.max(0, maxSaldo - pointsAfterExpiry) : puntosAplicados;

        puntosAplicados = Math.max(0, Math.min(puntosAplicados, cupoMes, cupoSaldo));
      }

      const nextPoints = Math.max(0, pointsAfterExpiry + puntosAplicados);
      const payloadPerfil: Record<string, unknown> = {
        puntos_fidelidad: nextPoints,
        nivel_fidelidad: getNivelDinamico(nextPoints, reglas),
      };

      if (puntosAplicados > 0) {
        payloadPerfil.puntos_ganados = Number(perfil.puntos_ganados || 0) + puntosAplicados;
      }

      await supabase
        .from("perfiles")
        .update(payloadPerfil)
        .eq("id", perfil_id)
        .eq("tenant_id", tenantId);
    }

    if (puntosAplicados === 0) {
      return NextResponse.json({ ok: true, applied: 0, skipped: true });
    }

    const { error } = await supabase.from("puntos_historial").insert({
      tenant_id: tenantId,
      perfil_id,
      tipo,
      puntos: puntosAplicados,
      concepto,
      referencia: referencia || null,
    });

    if (error) {
      console.error("[POST /api/club/puntos]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      if (perfil?.telefono) {
        const puntosMovimiento = tipo === "canjeados" ? -Math.abs(puntosAplicados) : puntosAplicados;
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
