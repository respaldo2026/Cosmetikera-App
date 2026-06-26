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

type ResumenCaja = {
  base_apertura: number;
  produccion_efectivo: number;
  efectivo_esperado: number;
  efectivo_contado?: number;
  descuadre?: number;
  ventas_total: number;
  ventas_cantidad: number;
  ventas_efectivo: number;
  ventas_tarjeta: number;
  ventas_transferencia: number;
  ingresos_manuales_efectivo: number;
  egresos_manuales_efectivo: number;
};

const BILLETES = [100000, 50000, 20000, 10000, 5000, 2000];
const MONEDAS = [1000, 500, 200, 100, 50];

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const isVentasMovimiento = (row: { categoria?: unknown; concepto?: unknown }) => {
  const categoria = String(row?.categoria || "").trim().toLowerCase();
  const concepto = String(row?.concepto || "").trim().toLowerCase();
  return categoria === "ventas" || concepto.startsWith("venta pos #");
};

const parseMetodoPago = (rawValue: unknown) => {
  const raw = String(rawValue || "").trim().toLowerCase();
  const resumen = {
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
  };

  if (!raw) return resumen;
  if (raw === "efectivo") {
    resumen.efectivo = 1;
    return resumen;
  }
  if (raw === "tarjeta") {
    resumen.tarjeta = 1;
    return resumen;
  }
  if (raw === "transferencia") {
    resumen.transferencia = 1;
    return resumen;
  }
  if (!raw.startsWith("mixto|")) return resumen;

  for (const fragmento of raw.split("|").slice(1)) {
    const [metodo, monto] = fragmento.split(":");
    const metodoKey = String(metodo || "").trim().toLowerCase();
    const amount = toNumber(monto);
    if (metodoKey === "efectivo") resumen.efectivo += amount;
    if (metodoKey === "tarjeta") resumen.tarjeta += amount;
    if (metodoKey === "transferencia") resumen.transferencia += amount;
  }

  return resumen;
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

async function getLastClosedTurno(supabase: ReturnType<typeof getAdminClient>, tenantId: string) {
  const { data, error } = await supabase
    .from("caja_turnos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("estado", "cerrado")
    .order("closed_at", { ascending: false })
    .limit(1)
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
    .select("tipo,monto,metodo_pago,categoria,concepto")
    .eq("tenant_id", tenantId)
    .gte("created_at", openedAt)
    .lte("created_at", closedAt);

  if (error) throw error;

  const filas = (data ?? []).filter((row) => {
    const metodoPago = String(row?.metodo_pago || "").trim().toLowerCase();
    return metodoPago === "efectivo" && !isVentasMovimiento(row);
  });
  const ingresos = filas
    .filter((row) => String(row?.tipo || "").toLowerCase() === "ingreso")
    .reduce((acc, row) => acc + toNumber(row?.monto), 0);
  const egresos = filas
    .filter((row) => String(row?.tipo || "").toLowerCase() === "egreso")
    .reduce((acc, row) => acc + toNumber(row?.monto), 0);

  return {
    ingresos: roundMoney(ingresos),
    egresos: roundMoney(egresos),
  };
}

async function resumirVentasTurno(
  supabase: ReturnType<typeof getAdminClient>,
  tenantId: string,
  openedAt: string,
  closedAt: string,
) {
  const { data, error } = await supabase
    .from("ventas")
    .select("id,total,metodo_pago,fecha")
    .eq("tenant_id", tenantId)
    .gte("fecha", openedAt)
    .lte("fecha", closedAt);

  if (error) throw error;

  const resumen = {
    cantidad: 0,
    total: 0,
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
  };

  for (const venta of data ?? []) {
    const total = toNumber(venta?.total);
    const metodoPago = String(venta?.metodo_pago || "").trim().toLowerCase();
    const detalle = parseMetodoPago(metodoPago);

    resumen.cantidad += 1;
    resumen.total += total;

    if (metodoPago === "efectivo") {
      resumen.efectivo += total;
      continue;
    }

    if (metodoPago === "tarjeta") {
      resumen.tarjeta += total;
      continue;
    }

    if (metodoPago === "transferencia") {
      resumen.transferencia += total;
      continue;
    }

    if (metodoPago.startsWith("mixto|")) {
      resumen.efectivo += detalle.efectivo;
      resumen.tarjeta += detalle.tarjeta;
      resumen.transferencia += detalle.transferencia;
    }
  }

  return {
    cantidad: resumen.cantidad,
    total: roundMoney(resumen.total),
    efectivo: roundMoney(resumen.efectivo),
    tarjeta: roundMoney(resumen.tarjeta),
    transferencia: roundMoney(resumen.transferencia),
  };
}

function buildResumenCaja(
  turno: Pick<TurnoCaja, "base_apertura">,
  ventas: Awaited<ReturnType<typeof resumirVentasTurno>>,
  movimientos: Awaited<ReturnType<typeof resumirMovimientoEfectivo>>,
  contado?: number,
): ResumenCaja {
  const baseApertura = roundMoney(Number(turno.base_apertura || 0));
  const produccionEfectivo = roundMoney(ventas.efectivo + movimientos.ingresos - movimientos.egresos);
  const efectivoEsperado = roundMoney(baseApertura + produccionEfectivo);
  const efectivoContado = contado == null ? undefined : roundMoney(contado);
  const descuadre = efectivoContado == null ? undefined : roundMoney(efectivoContado - efectivoEsperado);

  return {
    base_apertura: baseApertura,
    produccion_efectivo: produccionEfectivo,
    efectivo_esperado: efectivoEsperado,
    efectivo_contado: efectivoContado,
    descuadre,
    ventas_total: ventas.total,
    ventas_cantidad: ventas.cantidad,
    ventas_efectivo: ventas.efectivo,
    ventas_tarjeta: ventas.tarjeta,
    ventas_transferencia: ventas.transferencia,
    ingresos_manuales_efectivo: movimientos.ingresos,
    egresos_manuales_efectivo: movimientos.egresos,
  };
}

export async function GET(request: NextRequest) {
  try {
    const permissionCheck = await requireOperationPermission(request, "caja_abrir");
    if (!permissionCheck.ok) return permissionCheck.response;

    const { tenantId } = await resolveTenantContext(request);
    const supabase = getAdminClient();
    const turnoAbierto = await getCurrentTurno(supabase, tenantId);
    const ultimoCierre = await getLastClosedTurno(supabase, tenantId);

    if (!turnoAbierto) {
      return NextResponse.json({
        currentTurno: null,
        lastClosedTurno: ultimoCierre,
        suggestedOpeningBase: Number(ultimoCierre?.efectivo_contado || 0),
      });
    }

    const closedAt = new Date().toISOString();
    const [ventas, movimientos] = await Promise.all([
      resumirVentasTurno(
        supabase,
        tenantId,
        turnoAbierto.opened_at,
        closedAt,
      ),
      resumirMovimientoEfectivo(
        supabase,
        tenantId,
        turnoAbierto.opened_at,
        closedAt,
      ),
    ]);
    const resumen = buildResumenCaja(turnoAbierto, ventas, movimientos);

    return NextResponse.json({
      currentTurno: turnoAbierto,
      lastClosedTurno: ultimoCierre,
      suggestedOpeningBase: Number(ultimoCierre?.efectivo_contado || 0),
      resumen,
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
      const closedAt = new Date().toISOString();
      const [ventas, movimientos] = await Promise.all([
        resumirVentasTurno(
          supabase,
          tenantId,
          turnoActual.opened_at,
          closedAt,
        ),
        resumirMovimientoEfectivo(
          supabase,
          tenantId,
          turnoActual.opened_at,
          closedAt,
        ),
      ]);
      const resumen = buildResumenCaja(turnoActual, ventas, movimientos, contado);
      const efectivoEsperado = Number(resumen.efectivo_esperado || 0);
      const descuadre = Number(resumen.descuadre || 0);

      const { data, error } = await supabase
        .from("caja_turnos")
        .update({
          estado: "cerrado",
          closed_at: closedAt,
          closed_by: permissionCheck.userId,
          billetes,
          monedas,
          efectivo_contado: contado,
          producido_efectivo: resumen.produccion_efectivo,
          efectivo_esperado: efectivoEsperado,
          descuadre,
          notas_cierre: notasCierre || null,
          resumen,
        })
        .eq("id", turnoActual.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        turnoCerrado: data,
        resumen: {
          ...resumen,
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
