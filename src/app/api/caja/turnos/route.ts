import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTenantContext } from "../../_utils/tenant-resolver";
import { requireOperationPermission } from "../../_utils/admin-guard";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type TurnoCaja = {
  id: string;
  tenant_id: string;
  opened_by?: string | null;
  closed_by?: string | null;
  opened_at: string;
  closed_at?: string | null;
  estado: string;
  base_apertura: number;
  producido_efectivo: number;
  efectivo_esperado: number;
  efectivo_contado: number;
  descuadre: number;
  billetes: Record<string, number>;
  monedas: Record<string, number>;
  notas_apertura?: string | null;
  notas_cierre?: string | null;
  resumen?: Record<string, unknown>;
};

const BILLETES = [100000, 50000, 20000, 10000, 5000, 2000];
const MONEDAS = [1000, 500, 200, 100, 50];

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildCountMap = (payload: unknown, denominas: number[]) => {
  const source = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const result: Record<string, number> = {};

  for (const denominacion of denominas) {
    const raw = source[String(denominacion)];
    const count = Math.max(0, Math.floor(toNumber(raw)));
    result[String(denominacion)] = count;
  }

  return result;
};

const sumCountMap = (counts: Record<string, number>) =>
  Object.entries(counts).reduce((acc, [denominacion, cantidad]) => {
    const value = Number(denominacion);
    return acc + (Number.isFinite(value) ? value * toNumber(cantidad) : 0);
  }, 0);

async function getCurrentTurno(supabase: ReturnType<typeof getAdminClient>, tenantId: string) {
  const { data, error } = await supabase
    .from("caja_turnos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("estado", "abierto")
    .maybeSingle();

  if (error) throw error;
  return data as TurnoCaja | null;
}

async function resumirMovimientoEfectivo(
  supabase: ReturnType<typeof getAdminClient>,
  tenantId: string,
  openedAt: string,
  closedAt: string,
) {
  const { data, error } = await supabase
    .from("movimientos_financieros")
    .select("tipo,monto,metodo_pago")
    .eq("tenant_id", tenantId)
    .gte("created_at", openedAt)
    .lte("created_at", closedAt)
    .eq("metodo_pago", "efectivo");

  if (error) throw error;

  const filas = data ?? [];
  const ingresos = filas
    .filter((row) => String(row?.tipo || "").toLowerCase() === "ingreso")
    .reduce((acc, row) => acc + toNumber(row?.monto), 0);
  const egresos = filas
    .filter((row) => String(row?.tipo || "").toLowerCase() === "egreso")
    .reduce((acc, row) => acc + toNumber(row?.monto), 0);

  return {
    ingresos,
    egresos,
    producido: ingresos - egresos,
  };
}

export async function GET(request: NextRequest) {
  try {
    const permissionCheck = await requireOperationPermission(request, "caja_abrir");
    if (!permissionCheck.ok) return permissionCheck.response;

    const { tenantId } = await resolveTenantContext(request);
    const supabase = getAdminClient();
    const turnoAbierto = await getCurrentTurno(supabase, tenantId);

    if (!turnoAbierto) {
      return NextResponse.json({ currentTurno: null });
    }

    const resumen = await resumirMovimientoEfectivo(
      supabase,
      tenantId,
      turnoAbierto.opened_at,
      new Date().toISOString(),
    );

    return NextResponse.json({
      currentTurno: turnoAbierto,
      resumen: {
        base_apertura: Number(turnoAbierto.base_apertura || 0),
        produccion_efectivo: resumen.producido,
        efectivo_esperado: Number(turnoAbierto.base_apertura || 0) + resumen.producido,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo consultar la caja" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || "").toLowerCase();
    const supabase = getAdminClient();
    const { tenantId } = await resolveTenantContext(request);

    if (action === "open") {
      const permissionCheck = await requireOperationPermission(request, "caja_abrir");
      if (!permissionCheck.ok) return permissionCheck.response;

      const baseApertura = Math.max(0, toNumber(body?.base_apertura));
      const notasApertura = String(body?.notas_apertura || "").trim();
      const requestedOpenedBy = String(body?.opened_by || permissionCheck.userId || "").trim();

      const { data: responsable, error: responsableError } = await supabase
        .from("perfiles")
        .select("id")
        .eq("id", requestedOpenedBy)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (responsableError) {
        throw responsableError;
      }

      if (!responsable?.id) {
        return NextResponse.json({ error: "El responsable seleccionado no pertenece al tenant" }, { status: 400 });
      }

      const { data: existingOpen } = await supabase
        .from("caja_turnos")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("estado", "abierto")
        .maybeSingle();

      if (existingOpen?.id) {
        return NextResponse.json({ error: "Ya existe una caja abierta" }, { status: 409 });
      }

      const { data, error } = await supabase
        .from("caja_turnos")
        .insert({
          tenant_id: tenantId,
          opened_by: responsable.id,
          opened_at: new Date().toISOString(),
          estado: "abierto",
          base_apertura: baseApertura,
          notas_apertura: notasApertura || null,
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;

      return NextResponse.json({ success: true, currentTurno: data });
    }

    if (action === "close") {
      const permissionCheck = await requireOperationPermission(request, "caja_cerrar");
      if (!permissionCheck.ok) return permissionCheck.response;

      const turnoActual = await getCurrentTurno(supabase, tenantId);
      if (!turnoActual) {
        return NextResponse.json({ error: "No hay una caja abierta" }, { status: 400 });
      }

      const billetes = buildCountMap(body?.billetes, BILLETES);
      const monedas = buildCountMap(body?.monedas, MONEDAS);
      const notasCierre = String(body?.notas_cierre || "").trim();
      const contado = sumCountMap(billetes) + sumCountMap(monedas);
      const resumen = await resumirMovimientoEfectivo(
        supabase,
        tenantId,
        turnoActual.opened_at,
        new Date().toISOString(),
      );
      const efectivoEsperado = Number(turnoActual.base_apertura || 0) + resumen.producido;
      const descuadre = contado - efectivoEsperado;

      const { data, error } = await supabase
        .from("caja_turnos")
        .update({
          estado: "cerrado",
          closed_at: new Date().toISOString(),
          closed_by: permissionCheck.userId,
          billetes,
          monedas,
          efectivo_contado: contado,
          producido_efectivo: resumen.producido,
          efectivo_esperado: efectivoEsperado,
          descuadre,
          notas_cierre: notasCierre || null,
          resumen: {
            ingresos_efectivo: resumen.ingresos,
            egresos_efectivo: resumen.egresos,
            producido_efectivo: resumen.producido,
          },
        })
        .eq("id", turnoActual.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        turnoCerrado: data,
        resumen: {
          base_apertura: Number(turnoActual.base_apertura || 0),
          produccion_efectivo: resumen.producido,
          efectivo_esperado: efectivoEsperado,
          efectivo_contado: contado,
          descuadre,
          billetes,
          monedas,
        },
      });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo procesar la caja" }, { status: 500 });
  }
}
