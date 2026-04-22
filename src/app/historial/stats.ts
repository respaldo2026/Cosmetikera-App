import dayjs from "dayjs";

export type VentaItemStats = {
  id?: string;
  nombre: string;
  cantidad: number;
  precio?: number;
  precio_unitario?: number;
  subtotal?: number;
};

export type HistorialVentaEntry = {
  key: string;
  fecha: string;
  tercero: string;
  terceroId?: string | null;
  monto?: number | null;
  metodoPago?: string | null;
  items?: VentaItemStats[] | null;
};

export type ArticuloStats = {
  id: string;
  nombre: string;
  categoria?: string | null;
  marca?: string | null;
  precio_costo?: number | null;
  precio_venta?: number | null;
};

export type SerieDato = {
  label: string;
  value: number;
};

export type SerieDobleDato = {
  label: string;
  value: number;
  count: number;
};

export type HistorialStatsReport = {
  totalVentas: number;
  totalFacturado: number;
  beneficioTotal: number;
  ticketPromedio: number;
  unidadesVendidas: number;
  topProductos: SerieDobleDato[];
  topCategorias: SerieDobleDato[];
  topClientes: SerieDobleDato[];
  ventasPorCliente: SerieDato[];
  ventasPorDiaSemana: SerieDato[];
  ventasPorMes: SerieDato[];
  beneficioPorCategoria: SerieDato[];
  ventasPorFormaPago: SerieDato[];
};

export type RangeBounds = {
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
  label: string;
};

export type ComparisonMetric = {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
};

const DIAS_SEMANA = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

function normalizeMetodoPago(value?: string | null) {
  const raw = String(value || "");
  if (!raw) return "Sin definir";
  if (raw.startsWith("mixto|")) return "Mixto";
  if (raw === "efectivo") return "Efectivo";
  if (raw === "tarjeta") return "Tarjeta";
  if (raw === "transferencia") return "Transferencia";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildEmptyHistorialStats(): HistorialStatsReport {
  return {
    totalVentas: 0,
    totalFacturado: 0,
    beneficioTotal: 0,
    ticketPromedio: 0,
    unidadesVendidas: 0,
    topProductos: [],
    topCategorias: [],
    topClientes: [],
    ventasPorCliente: [],
    ventasPorDiaSemana: [],
    ventasPorMes: [],
    beneficioPorCategoria: [],
    ventasPorFormaPago: [],
  };
}

export function buildComparisonMetric(current: number, previous: number): ComparisonMetric {
  const safeCurrent = round2(current);
  const safePrevious = round2(previous);
  const delta = round2(safeCurrent - safePrevious);
  const deltaPercent = safePrevious === 0 ? (safeCurrent === 0 ? 0 : null) : round2((delta / safePrevious) * 100);

  return {
    current: safeCurrent,
    previous: safePrevious,
    delta,
    deltaPercent,
  };
}

export function getCurrentAndPreviousRanges(
  periodo: "hoy" | "semana" | "mes" | "anio" | "personalizado" | "todo",
  rango: [dayjs.Dayjs, dayjs.Dayjs] | null,
  now = dayjs()
): { current: RangeBounds | null; previous: RangeBounds | null } {
  if (periodo === "todo") {
    return { current: null, previous: null };
  }

  if (periodo === "hoy") {
    const start = now.startOf("day");
    const end = now.endOf("day");
    return {
      current: { start, end, label: "Hoy" },
      previous: {
        start: start.subtract(1, "day"),
        end: end.subtract(1, "day"),
        label: "Ayer",
      },
    };
  }

  if (periodo === "semana") {
    const start = now.startOf("week");
    const end = now.endOf("week");
    return {
      current: { start, end, label: "Esta semana" },
      previous: {
        start: start.subtract(1, "week"),
        end: end.subtract(1, "week"),
        label: "Semana anterior",
      },
    };
  }

  if (periodo === "mes") {
    const start = now.startOf("month");
    const end = now.endOf("month");
    return {
      current: { start, end, label: "Este mes" },
      previous: {
        start: start.subtract(1, "month"),
        end: end.subtract(1, "month"),
        label: "Mes anterior",
      },
    };
  }

  if (periodo === "anio") {
    const start = now.startOf("year");
    const end = now.endOf("year");
    return {
      current: { start, end, label: "Este año" },
      previous: {
        start: start.subtract(1, "year"),
        end: end.subtract(1, "year"),
        label: "Año anterior",
      },
    };
  }

  if (!rango) {
    return { current: null, previous: null };
  }

  const start = rango[0].startOf("day");
  const end = rango[1].endOf("day");
  const durationDays = Math.max(1, end.diff(start, "day") + 1);

  return {
    current: { start, end, label: "Periodo actual" },
    previous: {
      start: start.subtract(durationDays, "day"),
      end: start.subtract(1, "millisecond"),
      label: "Periodo anterior equivalente",
    },
  };
}

function toTopSeries(map: Map<string, { value: number; count: number }>, limit = 10): SerieDobleDato[] {
  return Array.from(map.entries())
    .map(([label, data]) => ({ label, value: round2(data.value), count: data.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function toSingleSeries(map: Map<string, number>, preferredOrder?: string[], limit = 12): SerieDato[] {
  const data = Array.from(map.entries()).map(([label, value]) => ({ label, value: round2(value) }));
  if (preferredOrder) {
    const orderMap = new Map(preferredOrder.map((label, index) => [label, index]));
    return data.sort((a, b) => (orderMap.get(a.label) ?? 999) - (orderMap.get(b.label) ?? 999));
  }
  return data.sort((a, b) => b.value - a.value).slice(0, limit);
}

export function buildHistorialStats(ventas: HistorialVentaEntry[], articulos: ArticuloStats[]): HistorialStatsReport {
  const articulosById = new Map(articulos.map((articulo) => [articulo.id, articulo]));
  const articulosByName = new Map(articulos.map((articulo) => [articulo.nombre.trim().toLowerCase(), articulo]));

  let totalFacturado = 0;
  let beneficioTotal = 0;
  let unidadesVendidas = 0;

  const productos = new Map<string, { value: number; count: number }>();
  const categorias = new Map<string, { value: number; count: number }>();
  const clientes = new Map<string, { value: number; count: number }>();
  const ventasPorDia = new Map(DIAS_SEMANA.map((dia) => [dia, 0]));
  const ventasPorMes = new Map<string, number>();
  const beneficioCategorias = new Map<string, number>();
  const metodosPago = new Map<string, number>();

  for (const venta of ventas) {
    const montoVenta = Number(venta.monto || 0);
    totalFacturado += montoVenta;

    const cliente = venta.tercero || "Venta sin cliente";
    const clienteActual = clientes.get(cliente) || { value: 0, count: 0 };
    clienteActual.value += montoVenta;
    clienteActual.count += 1;
    clientes.set(cliente, clienteActual);

    const metodo = normalizeMetodoPago(venta.metodoPago);
    metodosPago.set(metodo, Number(metodosPago.get(metodo) || 0) + montoVenta);

    const fecha = dayjs(venta.fecha);
    const dia = DIAS_SEMANA[(fecha.day() + 6) % 7] || "Sin fecha";
    ventasPorDia.set(dia, Number(ventasPorDia.get(dia) || 0) + montoVenta);

    const mes = fecha.isValid() ? fecha.format("MMM YYYY") : "Sin fecha";
    ventasPorMes.set(mes, Number(ventasPorMes.get(mes) || 0) + montoVenta);

    for (const item of venta.items || []) {
      const cantidad = Number(item.cantidad || 0);
      if (cantidad <= 0) continue;

      unidadesVendidas += cantidad;
      const precioUnitario = Number(item.precio_unitario ?? item.precio ?? 0);
      const subtotal = Number(item.subtotal ?? precioUnitario * cantidad);
      const articulo = (item.id ? articulosById.get(item.id) : undefined) || articulosByName.get(item.nombre.trim().toLowerCase());
      const categoria = articulo?.categoria || "Sin categoria";
      const costoUnitario = Number(articulo?.precio_costo || 0);
      const beneficioItem = subtotal - costoUnitario * cantidad;

      beneficioTotal += beneficioItem;

      const productoActual = productos.get(item.nombre) || { value: 0, count: 0 };
      productoActual.value += subtotal;
      productoActual.count += cantidad;
      productos.set(item.nombre, productoActual);

      const categoriaActual = categorias.get(categoria) || { value: 0, count: 0 };
      categoriaActual.value += subtotal;
      categoriaActual.count += cantidad;
      categorias.set(categoria, categoriaActual);

      beneficioCategorias.set(categoria, Number(beneficioCategorias.get(categoria) || 0) + beneficioItem);
    }
  }

  const mesesOrdenados = Array.from(ventasPorMes.entries())
    .map(([label, value]) => ({ label, value, timestamp: dayjs(label, "MMM YYYY").valueOf() }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ label, value }) => ({ label, value: round2(value) }));

  return {
    totalVentas: ventas.length,
    totalFacturado: round2(totalFacturado),
    beneficioTotal: round2(beneficioTotal),
    ticketPromedio: ventas.length > 0 ? round2(totalFacturado / ventas.length) : 0,
    unidadesVendidas,
    topProductos: toTopSeries(productos),
    topCategorias: toTopSeries(categorias),
    topClientes: toTopSeries(clientes),
    ventasPorCliente: toTopSeries(clientes).map(({ label, value }) => ({ label, value })),
    ventasPorDiaSemana: toSingleSeries(ventasPorDia, DIAS_SEMANA, 7),
    ventasPorMes: mesesOrdenados,
    beneficioPorCategoria: toSingleSeries(beneficioCategorias),
    ventasPorFormaPago: toSingleSeries(metodosPago),
  };
}