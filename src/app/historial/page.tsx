"use client";

import React, { useCallback, useEffect, useMemo, useState, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Grid,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  FilePdfOutlined,
  ArrowDownOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  CreditCardOutlined,
  DollarOutlined,
  EyeOutlined,
  GiftOutlined,
  HistoryOutlined,
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { parseRewardCanjeDescription } from "@/constants/clubRewards";
import { buildComparisonMetric, buildHistorialStats, getCurrentAndPreviousRanges } from "./stats";
import { descargarInformeHistorialPDF } from "@/utils/historial-report";

const HistorialCharts = dynamic(() => import("./HistorialCharts"), {
  ssr: false,
  loading: () => (
    <Card style={{ marginTop: 16, borderRadius: 12 }}>
      <div style={{ textAlign: "center", padding: 32 }}>
        <Spin size="large" />
      </div>
    </Card>
  ),
});

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

type VentaItem = {
  id?: string;
  nombre: string;
  cantidad: number;
  precio?: number;
  precio_unitario?: number;
  subtotal?: number;
};

type Venta = {
  id: string;
  numero_ticket?: number | null;
  fecha: string;
  total: number;
  subtotal?: number;
  descuento?: number;
  metodo_pago?: string | null;
  cliente_id?: string | null;
  cliente?: { nombre_completo?: string | null; cedula?: string | null } | null;
  items?: VentaItem[] | null;
};

type Compra = {
  id: string;
  proveedor_id?: string | null;
  proveedor_nombre?: string | null;
  fecha: string;
  total: number;
  estado: "pendiente" | "recibida" | "parcial" | "cancelada";
  notas?: string | null;
  items?: Array<{ nombre: string; cantidad: number; precio_unitario: number }> | null;
};

type Movimiento = {
  id: string;
  fecha: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  concepto: string;
  categoria?: string | null;
  metodo_pago?: string | null;
  referencia?: string | null;
  descripcion?: string | null;
  estudiante_id?: string | null;
  proveedor_id?: string | null;
  conciliado?: boolean;
  created_at?: string | null;
  perfiles?: { nombre_completo?: string | null; telefono?: string | null } | null;
  proveedores?: { nombre_completo?: string | null } | null;
};

type Punto = {
  id: string;
  perfil_id?: string | null;
  tipo: string;
  puntos: number;
  concepto: string;
  referencia?: string | null;
  created_at: string;
};

type Canje = {
  id: string;
  perfil_id?: string | null;
  puntos: number;
  valor_cop?: number | null;
  descripcion?: string | null;
  estado?: string | null;
  created_at: string;
};

type Perfil = {
  id: string;
  nombre_completo?: string | null;
  cedula?: string | null;
};

type ArticuloCatalogo = {
  id: string;
  nombre: string;
  categoria?: string | null;
  marca?: string | null;
  precio_costo?: number | null;
  precio_venta?: number | null;
};

type HistorialPayload = {
  ventas: Venta[];
  compras: Compra[];
  movimientos: Movimiento[];
  puntos: Punto[];
  canjes: Canje[];
  perfiles: Perfil[];
  articulos: ArticuloCatalogo[];
};

type HistorialApiResponse = HistorialPayload & {
  meta?: {
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
  };
};

type TipoOperacion = "venta" | "compra" | "movimiento" | "puntos" | "voucher";
type DireccionOperacion = "entrada" | "salida" | "neutral";
type PeriodoRapido = "hoy" | "semana" | "mes" | "anio" | "personalizado" | "todo";

type HistorialEntry = {
  id: string;
  key: string;
  tipo: TipoOperacion;
  fecha: string;
  titulo: string;
  detalle: string;
  tercero: string;
  terceroId?: string | null;
  monto?: number | null;
  puntos?: number | null;
  direccion: DireccionOperacion;
  metodoPago?: string | null;
  estado?: string | null;
  referencia?: string | null;
  items?: VentaItem[] | Array<{ nombre: string; cantidad: number; precio_unitario: number }> | null;
  raw: Venta | Compra | Movimiento | Punto | Canje;
};

function getVentaTicketLabel(venta: Venta): string {
  const numero = Number(venta.numero_ticket ?? 0);
  if (Number.isFinite(numero) && numero >= 1000) {
    return String(Math.trunc(numero));
  }

  return venta.id.slice(-6).toUpperCase();
}

const TIPO_META: Record<TipoOperacion, { label: string; color: string; icon: React.ReactNode }> = {
  venta: { label: "Venta", color: "magenta", icon: <ShoppingCartOutlined /> },
  compra: { label: "Compra", color: "blue", icon: <InboxOutlined /> },
  movimiento: { label: "Caja", color: "geekblue", icon: <SwapOutlined /> },
  puntos: { label: "Puntos", color: "gold", icon: <GiftOutlined /> },
  voucher: { label: "Voucher", color: "purple", icon: <GiftOutlined /> },
};

const ESTADO_COMPRA_COLOR: Record<string, string> = {
  pendiente: "gold",
  recibida: "green",
  parcial: "orange",
  cancelada: "red",
};

const ESTADO_VOUCHER_COLOR: Record<string, string> = {
  emitido: "blue",
  aplicado: "green",
  redimido: "green",
  vencido: "red",
};

const METODO_TAG: Record<string, string> = {
  efectivo: "green",
  tarjeta: "blue",
  transferencia: "purple",
  mixto: "orange",
};

const PUNTO_LABELS: Record<string, string> = {
  ganados: "Puntos ganados",
  canjeados: "Puntos canjeados",
  bonificacion: "Bonificacion",
  ajuste: "Ajuste",
  bienvenida: "Bienvenida",
  cumpleanos: "Cumpleanos",
  racha: "Racha",
  referido: "Referido",
};

function formatMoney(value?: number | null) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return dayjs(value).format("DD/MM/YYYY HH:mm");
}

function parseMetodoPago(value?: string | null) {
  const raw = String(value || "");
  if (raw.startsWith("mixto|")) {
    const detail = raw
      .split("|")
      .slice(1)
      .map((parte) => {
        const [clave, monto] = parte.split(":");
        const label = clave === "efectivo"
          ? "Efectivo"
          : clave === "tarjeta"
            ? "Tarjeta"
            : clave === "transferencia"
              ? "Transferencia"
              : clave;
        return `${label} ${formatMoney(Number(monto || 0))}`;
      })
      .join(" · ");

    return { base: "mixto", label: "Mixto", detail: detail || null };
  }

  if (raw === "efectivo" || raw === "tarjeta" || raw === "transferencia" || raw === "mixto") {
    return {
      base: raw,
      label: raw.charAt(0).toUpperCase() + raw.slice(1),
      detail: null,
    };
  }

  return { base: raw, label: raw || "-", detail: null };
}

function buildItemSummary(items?: Array<{ nombre: string; cantidad: number }> | null) {
  if (!items || items.length === 0) return "Sin detalle de items";
  const preview = items.slice(0, 3).map((item) => `${item.nombre} x${item.cantidad}`).join(", ");
  const extra = items.length > 3 ? ` +${items.length - 3} mas` : "";
  return `${preview}${extra}`;
}

function matchesPeriodo(fecha: string, periodo: PeriodoRapido, rango: [Dayjs, Dayjs] | null) {
  const current = dayjs(fecha);
  if (!current.isValid()) return false;

  if (periodo === "todo") return true;
  if (periodo === "hoy") return current.isSame(dayjs(), "day");
  if (periodo === "semana") {
    return current.isAfter(dayjs().startOf("week").subtract(1, "millisecond")) && current.isBefore(dayjs().endOf("week").add(1, "millisecond"));
  }
  if (periodo === "mes") {
    return current.isAfter(dayjs().startOf("month").subtract(1, "millisecond")) && current.isBefore(dayjs().endOf("month").add(1, "millisecond"));
  }
  if (periodo === "anio") {
    return current.isAfter(dayjs().startOf("year").subtract(1, "millisecond")) && current.isBefore(dayjs().endOf("year").add(1, "millisecond"));
  }
  if (!rango) return true;

  return current.isAfter(rango[0].startOf("day").subtract(1, "millisecond")) && current.isBefore(rango[1].endOf("day").add(1, "millisecond"));
}

function matchesExplicitRange(fecha: string, range: { start: Dayjs; end: Dayjs } | null) {
  if (!range) return true;
  const current = dayjs(fecha);
  if (!current.isValid()) return false;
  return current.isAfter(range.start.subtract(1, "millisecond")) && current.isBefore(range.end.add(1, "millisecond"));
}

function formatDelta(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString()}`;
}

function formatPercent(value: number | null) {
  if (value === null) return "Nuevo";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString()}%`;
}

function buildExactRange(
  diaFiltro: Dayjs | null,
  mesFiltro: Dayjs | null,
  anioFiltro: number | null,
) {
  if (diaFiltro) {
    return {
      start: diaFiltro.startOf("day"),
      end: diaFiltro.endOf("day"),
      label: `Dia ${diaFiltro.format("DD/MM/YYYY")}`,
      mode: "dia" as const,
    };
  }

  if (mesFiltro) {
    return {
      start: mesFiltro.startOf("month"),
      end: mesFiltro.endOf("month"),
      label: `Mes ${mesFiltro.format("MMMM YYYY")}`,
      mode: "mes" as const,
    };
  }

  if (anioFiltro) {
    const base = dayjs(`${anioFiltro}-01-01`);
    return {
      start: base.startOf("year"),
      end: base.endOf("year"),
      label: `Año ${anioFiltro}`,
      mode: "anio" as const,
    };
  }

  return null;
}

function buildPreviousFromExactRange(exactRange: ReturnType<typeof buildExactRange>) {
  if (!exactRange) return null;

  if (exactRange.mode === "dia") {
    const prevStart = exactRange.start.subtract(1, "day").startOf("day");
    return {
      start: prevStart,
      end: prevStart.endOf("day"),
      label: `Dia anterior (${prevStart.format("DD/MM/YYYY")})`,
    };
  }

  if (exactRange.mode === "mes") {
    const prevStart = exactRange.start.subtract(1, "month").startOf("month");
    return {
      start: prevStart,
      end: prevStart.endOf("month"),
      label: `Mes anterior (${prevStart.format("MMMM YYYY")})`,
    };
  }

  const prevStart = exactRange.start.subtract(1, "year").startOf("year");
  return {
    start: prevStart,
    end: prevStart.endOf("year"),
    label: `Año anterior (${prevStart.format("YYYY")})`,
  };
}

export default function HistorialPage() {
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [data, setData] = useState<HistorialPayload>({
    ventas: [],
    compras: [],
    movimientos: [],
    puntos: [],
    canjes: [],
    perfiles: [],
    articulos: [],
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [tipoFiltro, setTipoFiltro] = useState<TipoOperacion | undefined>(undefined);
  const [direccionFiltro, setDireccionFiltro] = useState<DireccionOperacion | undefined>(undefined);
  const [periodo, setPeriodo] = useState<PeriodoRapido>("mes");
  const [rango, setRango] = useState<[Dayjs, Dayjs] | null>(null);
  const [diaFiltro, setDiaFiltro] = useState<Dayjs | null>(null);
  const [mesFiltro, setMesFiltro] = useState<Dayjs | null>(null);
  const [anioFiltro, setAnioFiltro] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<HistorialEntry | null>(null);
  const [mostrarGraficas, setMostrarGraficas] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE_SIZE = 300;

  const mergeUniqueById = useCallback(<T extends { id: string }>(base: T[], extra: T[]) => {
    if (!extra.length) return base;
    const ids = new Set(base.map((item) => item.id));
    const appended = extra.filter((item) => !ids.has(item.id));
    return appended.length ? [...base, ...appended] : base;
  }, []);

  const loadPage = useCallback(async (targetPage: number, append: boolean) => {
    const response = await fetch(`/api/historial?page=${targetPage}&pageSize=${PAGE_SIZE}`, { cache: "no-store" });
    const json = await response.json() as HistorialApiResponse;
    if (!response.ok) {
      throw new Error((json as any)?.error || "No se pudo cargar el historial");
    }

    setPage(targetPage);
    setHasMore(Boolean(json.meta?.hasMore));

    if (!append) {
      setData({
        ventas: json.ventas || [],
        compras: json.compras || [],
        movimientos: json.movimientos || [],
        puntos: json.puntos || [],
        canjes: json.canjes || [],
        perfiles: json.perfiles || [],
        articulos: json.articulos || [],
      });
      return;
    }

    setData((prev) => ({
      ventas: mergeUniqueById(prev.ventas, json.ventas || []),
      compras: mergeUniqueById(prev.compras, json.compras || []),
      movimientos: mergeUniqueById(prev.movimientos, json.movimientos || []),
      puntos: mergeUniqueById(prev.puntos, json.puntos || []),
      canjes: mergeUniqueById(prev.canjes, json.canjes || []),
      perfiles: mergeUniqueById(prev.perfiles, json.perfiles || []),
      articulos: mergeUniqueById(prev.articulos, json.articulos || []),
    }));
  }, [mergeUniqueById]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      await loadPage(1, false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }, [loadPage, message]);

  const cargarMas = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadPage(page + 1, true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "No se pudo cargar más historial");
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadPage, loadingMore, message, page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const operaciones = useMemo(() => {
    const perfilesMap = new Map(data.perfiles.map((perfil) => [perfil.id, perfil]));

    const ventas = data.ventas.map<HistorialEntry>((venta) => ({
      id: venta.id,
      key: `venta-${venta.id}`,
      tipo: "venta",
      fecha: venta.fecha,
      titulo: `Venta POS #${getVentaTicketLabel(venta)}`,
      detalle: buildItemSummary(venta.items || []),
      tercero: venta.cliente?.nombre_completo || "Venta sin cliente",
      terceroId: venta.cliente_id || null,
      monto: Number(venta.total || 0),
      puntos: null,
      direccion: "entrada",
      metodoPago: venta.metodo_pago || null,
      estado: null,
      referencia: venta.id,
      items: venta.items || [],
      raw: venta,
    }));

    const compras = data.compras.map<HistorialEntry>((compra) => ({
      id: compra.id,
      key: `compra-${compra.id}`,
      tipo: "compra",
      fecha: compra.fecha,
      titulo: `Compra #${compra.id.slice(-6).toUpperCase()}`,
      detalle: compra.notas || buildItemSummary(compra.items || []),
      tercero: compra.proveedor_nombre || "Proveedor no especificado",
      terceroId: compra.proveedor_id || null,
      monto: Number(compra.total || 0),
      puntos: null,
      direccion: compra.estado === "cancelada" ? "neutral" : "salida",
      metodoPago: null,
      estado: compra.estado,
      referencia: compra.id,
      items: compra.items || [],
      raw: compra,
    }));

    const movimientos = data.movimientos.map<HistorialEntry>((movimiento) => ({
      id: movimiento.id,
      key: `movimiento-${movimiento.id}`,
      tipo: "movimiento",
      fecha: movimiento.created_at || movimiento.fecha,
      titulo: movimiento.concepto || `Movimiento ${movimiento.tipo}`,
      detalle: [movimiento.categoria, movimiento.descripcion].filter(Boolean).join(" · ") || "Movimiento de caja",
      tercero: movimiento.perfiles?.nombre_completo || movimiento.proveedores?.nombre_completo || "Caja general",
      terceroId: movimiento.estudiante_id || movimiento.proveedor_id || null,
      monto: Number(movimiento.monto || 0),
      puntos: null,
      direccion: movimiento.tipo === "ingreso" ? "entrada" : "salida",
      metodoPago: movimiento.metodo_pago || null,
      estado: movimiento.conciliado ? "conciliado" : "pendiente",
      referencia: movimiento.referencia || movimiento.id,
      items: null,
      raw: movimiento,
    }));

    const puntos = data.puntos.map<HistorialEntry>((registro) => {
      const perfil = registro.perfil_id ? perfilesMap.get(registro.perfil_id) : null;
      return {
        id: registro.id,
        key: `puntos-${registro.id}`,
        tipo: "puntos",
        fecha: registro.created_at,
        titulo: PUNTO_LABELS[registro.tipo] || `Movimiento de puntos: ${registro.tipo}`,
        detalle: registro.concepto || "Sin concepto",
        tercero: perfil?.nombre_completo || "Cliente no identificado",
        terceroId: registro.perfil_id || null,
        monto: null,
        puntos: Number(registro.puntos || 0),
        direccion: Number(registro.puntos || 0) > 0 ? "entrada" : Number(registro.puntos || 0) < 0 ? "salida" : "neutral",
        metodoPago: null,
        estado: registro.tipo,
        referencia: registro.referencia || registro.id,
        items: null,
        raw: registro,
      };
    });

    const canjes = data.canjes.map<HistorialEntry>((canje) => {
      const perfil = canje.perfil_id ? perfilesMap.get(canje.perfil_id) : null;
      const parsed = parseRewardCanjeDescription(canje.descripcion);
      return {
        id: canje.id,
        key: `voucher-${canje.id}`,
        tipo: "voucher",
        fecha: canje.created_at,
        titulo: parsed?.cleanDescription || "Voucher del club",
        detalle: parsed?.code ? `Codigo ${parsed.code}` : canje.descripcion || "Voucher emitido",
        tercero: perfil?.nombre_completo || "Cliente no identificado",
        terceroId: canje.perfil_id || null,
        monto: Number(canje.valor_cop || 0),
        puntos: -Math.abs(Number(canje.puntos || 0)),
        direccion: "salida",
        metodoPago: null,
        estado: canje.estado || "emitido",
        referencia: parsed?.code || canje.id,
        items: null,
        raw: canje,
      };
    });

    return [...ventas, ...compras, ...movimientos, ...puntos, ...canjes].sort(
      (a, b) => dayjs(b.fecha).valueOf() - dayjs(a.fecha).valueOf()
    );
  }, [data]);

  const operacionesBaseFiltradas = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return operaciones.filter((operacion) => {
      const matchTipo = !tipoFiltro || operacion.tipo === tipoFiltro;
      const matchDireccion = !direccionFiltro || operacion.direccion === direccionFiltro;
      const metodo = parseMetodoPago(operacion.metodoPago).label.toLowerCase();
      const target = [
        operacion.titulo,
        operacion.detalle,
        operacion.tercero,
        operacion.referencia,
        operacion.estado,
        metodo,
      ].join(" ").toLowerCase();
      const matchSearch = !query || target.includes(query);

      return matchTipo && matchDireccion && matchSearch;
    });
  }, [deferredSearch, direccionFiltro, operaciones, tipoFiltro]);

  const periodRanges = useMemo(
    () => getCurrentAndPreviousRanges(periodo, rango),
    [periodo, rango]
  );

  const exactRange = useMemo(
    () => buildExactRange(diaFiltro, mesFiltro, anioFiltro),
    [anioFiltro, diaFiltro, mesFiltro]
  );

  const previousExactRange = useMemo(
    () => buildPreviousFromExactRange(exactRange),
    [exactRange]
  );

  const operacionesFiltradas = useMemo(
    () => operacionesBaseFiltradas.filter((operacion) => {
      if (exactRange) return matchesExplicitRange(operacion.fecha, { start: exactRange.start, end: exactRange.end });
      return matchesPeriodo(operacion.fecha, periodo, rango);
    }),
    [exactRange, operacionesBaseFiltradas, periodo, rango]
  );

  const ventasBaseFiltradas = useMemo(
    () => operacionesBaseFiltradas.filter((item) => item.tipo === "venta"),
    [operacionesBaseFiltradas]
  );

  const ventasFiltradas = useMemo(
    () => ventasBaseFiltradas.filter((item) => {
      if (exactRange) return matchesExplicitRange(item.fecha, { start: exactRange.start, end: exactRange.end });
      return matchesPeriodo(item.fecha, periodo, rango);
    }),
    [exactRange, periodo, rango, ventasBaseFiltradas]
  );

  const ventasPeriodoAnterior = useMemo(
    () => {
      if (previousExactRange) {
        return ventasBaseFiltradas.filter((item) => matchesExplicitRange(item.fecha, previousExactRange));
      }

      return periodRanges.previous
        ? ventasBaseFiltradas.filter((item) => matchesExplicitRange(item.fecha, periodRanges.previous))
        : [];
    },
    [periodRanges.previous, previousExactRange, ventasBaseFiltradas]
  );

  const periodComparison = useMemo(() => {
    if (exactRange && previousExactRange) {
      return {
        currentLabel: exactRange.label,
        previousLabel: previousExactRange.label,
      };
    }

    if (periodRanges.previous) {
      return {
        currentLabel: periodRanges.current?.label || "Periodo actual",
        previousLabel: periodRanges.previous.label,
      };
    }

    return null;
  }, [exactRange, periodRanges.current, periodRanges.previous, previousExactRange]);

  const stats = useMemo(() => {
    const entradas = operacionesFiltradas
      .filter((item) => item.direccion === "entrada" && typeof item.monto === "number")
      .reduce((acc, item) => acc + Number(item.monto || 0), 0);
    const salidas = operacionesFiltradas
      .filter((item) => item.direccion === "salida" && typeof item.monto === "number")
      .reduce((acc, item) => acc + Number(item.monto || 0), 0);
    const puntosNetos = operacionesFiltradas.reduce((acc, item) => acc + Number(item.puntos || 0), 0);
    const clientesConCompra = new Set(
      operacionesFiltradas
        .filter((item) => item.tipo === "venta" && item.terceroId)
        .map((item) => item.terceroId)
    ).size;

    return {
      total: operacionesFiltradas.length,
      entradas,
      salidas,
      balance: entradas - salidas,
      puntosNetos,
      clientesConCompra,
      resumen: {
        ventas: operacionesFiltradas.filter((item) => item.tipo === "venta").length,
        compras: operacionesFiltradas.filter((item) => item.tipo === "compra").length,
        movimientos: operacionesFiltradas.filter((item) => item.tipo === "movimiento").length,
        puntos: operacionesFiltradas.filter((item) => item.tipo === "puntos").length,
        vouchers: operacionesFiltradas.filter((item) => item.tipo === "voucher").length,
      },
    };
  }, [operacionesFiltradas]);

  const salesStats = useMemo(
    () => buildHistorialStats(ventasFiltradas, data.articulos),
    [data.articulos, ventasFiltradas]
  );

  const previousSalesStats = useMemo(
    () => buildHistorialStats(ventasPeriodoAnterior, data.articulos),
    [data.articulos, ventasPeriodoAnterior]
  );

  const comparison = useMemo(() => ({
    totalVentas: buildComparisonMetric(salesStats.totalVentas, previousSalesStats.totalVentas),
    totalFacturado: buildComparisonMetric(salesStats.totalFacturado, previousSalesStats.totalFacturado),
    beneficioTotal: buildComparisonMetric(salesStats.beneficioTotal, previousSalesStats.beneficioTotal),
    ticketPromedio: buildComparisonMetric(salesStats.ticketPromedio, previousSalesStats.ticketPromedio),
  }), [previousSalesStats, salesStats]);

  const filtrosResumen = useMemo(() => {
    const partes = [
      `Periodo: ${periodo}`,
      tipoFiltro ? `Tipo: ${TIPO_META[tipoFiltro].label}` : null,
      direccionFiltro ? `Direccion: ${direccionFiltro}` : null,
      search ? `Busqueda: ${search}` : null,
      diaFiltro ? `Dia: ${diaFiltro.format("DD/MM/YYYY")}` : null,
      mesFiltro ? `Mes: ${mesFiltro.format("MM/YYYY")}` : null,
      anioFiltro ? `Año: ${anioFiltro}` : null,
      periodo === "personalizado" && rango
        ? `Rango: ${rango[0].format("DD/MM/YYYY")} - ${rango[1].format("DD/MM/YYYY")}`
        : null,
    ].filter(Boolean);

    return partes.join(" | ") || "Sin filtros";
  }, [anioFiltro, diaFiltro, direccionFiltro, mesFiltro, periodo, rango, search, tipoFiltro]);

  const hayFiltrosActivos = useMemo(
    () => Boolean(search.trim())
      || Boolean(tipoFiltro)
      || Boolean(direccionFiltro)
      || periodo !== "mes"
      || Boolean(rango)
      || Boolean(diaFiltro)
      || Boolean(mesFiltro)
      || Boolean(anioFiltro),
    [anioFiltro, diaFiltro, direccionFiltro, mesFiltro, periodo, rango, search, tipoFiltro]
  );

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    operaciones.forEach((operacion) => {
      const d = dayjs(operacion.fecha);
      if (d.isValid()) years.add(d.year());
    });

    return Array.from(years)
      .sort((a, b) => b - a)
      .map((year) => ({ value: year, label: String(year) }));
  }, [operaciones]);

  const mostrarSeccionGraficas = mostrarGraficas || hayFiltrosActivos;

  const exportarPDF = useCallback(async () => {
    if (salesStats.totalVentas === 0) {
      message.warning("No hay ventas en el filtro actual para generar el informe.");
      return;
    }

    try {
      await descargarInformeHistorialPDF(
        salesStats,
        dayjs().format("DD/MM/YYYY HH:mm"),
        filtrosResumen
      );
      message.success("Informe estadistico generado en PDF");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "No se pudo generar el PDF");
    }
  }, [filtrosResumen, message, salesStats]);

  const columns = [
    {
      title: "Fecha",
      dataIndex: "fecha",
      key: "fecha",
      width: 150,
      render: (value: string) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{dayjs(value).format("DD/MM/YYYY")}</Text>
          <div><Text type="secondary" style={{ fontSize: 11 }}>{dayjs(value).format("HH:mm")}</Text></div>
        </div>
      ),
    },
    {
      title: "Operacion",
      dataIndex: "tipo",
      key: "tipo",
      width: 120,
      render: (value: TipoOperacion) => {
        const meta = TIPO_META[value];
        return <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>;
      },
    },
    {
      title: "Detalle",
      key: "detalle",
      render: (_: unknown, record: HistorialEntry) => (
        <div>
          <Text strong>{record.titulo}</Text>
          <div><Text type="secondary" style={{ fontSize: 12 }}>{record.detalle}</Text></div>
        </div>
      ),
    },
    {
      title: "Cliente / tercero",
      key: "tercero",
      width: 220,
      render: (_: unknown, record: HistorialEntry) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} style={{ background: record.tipo === "compra" ? "#1677ff" : "#d81b87" }} />
          <Text>{record.tercero}</Text>
        </Space>
      ),
    },
    {
      title: "Estado",
      key: "estado",
      width: 130,
      render: (_: unknown, record: HistorialEntry) => {
        if (record.tipo === "compra" && record.estado) {
          return <Tag color={ESTADO_COMPRA_COLOR[record.estado] || "default"}>{record.estado}</Tag>;
        }
        if (record.tipo === "voucher" && record.estado) {
          return <Tag color={ESTADO_VOUCHER_COLOR[record.estado] || "default"}>{record.estado}</Tag>;
        }
        if (record.tipo === "movimiento" && record.estado) {
          return <Tag color={record.estado === "conciliado" ? "green" : "gold"}>{record.estado}</Tag>;
        }
        if (record.metodoPago) {
          const metodo = parseMetodoPago(record.metodoPago);
          return (
            <Tooltip title={metodo.detail || undefined}>
              <Tag color={METODO_TAG[metodo.base] || "default"} icon={<CreditCardOutlined />}>
                {metodo.label}
              </Tag>
            </Tooltip>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: "Impacto",
      key: "impacto",
      width: 150,
      render: (_: unknown, record: HistorialEntry) => {
        if (typeof record.monto === "number") {
          const positive = record.direccion === "entrada";
          return (
            <Text strong style={{ color: positive ? "#389e0d" : record.direccion === "salida" ? "#cf1322" : "#595959" }}>
              {positive ? "+" : record.direccion === "salida" ? "-" : ""}{formatMoney(record.monto)}
            </Text>
          );
        }
        if (typeof record.puntos === "number") {
          const positive = record.puntos > 0;
          return (
            <Text strong style={{ color: positive ? "#d48806" : record.puntos < 0 ? "#cf1322" : "#595959" }}>
              {positive ? "+" : ""}{record.puntos} pts
            </Text>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: "",
      key: "acciones",
      width: 70,
      render: (_: unknown, record: HistorialEntry) => (
        <Tooltip title="Ver detalle">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetalle(record)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: 16, borderRadius: 12 }} styles={{ body: { padding: "12px 16px" } }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Space>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "linear-gradient(135deg,#13c2c2,#096dd9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <HistoryOutlined style={{ color: "#fff", fontSize: 22 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>Historial operativo</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Ventas, compras, caja, puntos y vouchers en un solo log para auditar operaciones.
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<FilePdfOutlined />} onClick={exportarPDF} disabled={salesStats.totalVentas === 0}>
                PDF estadistico
              </Button>
              <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading}>
                Actualizar
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Operaciones" value={stats.total} prefix={<HistoryOutlined />} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Entradas" value={stats.entradas} prefix={<ArrowUpOutlined />} formatter={(value) => formatMoney(Number(value || 0))} valueStyle={{ color: "#389e0d" }} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Salidas" value={stats.salidas} prefix={<ArrowDownOutlined />} formatter={(value) => formatMoney(Number(value || 0))} valueStyle={{ color: "#cf1322" }} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Balance" value={stats.balance} prefix={<DollarOutlined />} formatter={(value) => formatMoney(Number(value || 0))} valueStyle={{ color: stats.balance >= 0 ? "#1677ff" : "#cf1322" }} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Puntos netos" value={stats.puntosNetos} suffix="pts" valueStyle={{ color: stats.puntosNetos >= 0 ? "#d48806" : "#cf1322" }} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Clientes que compraron" value={stats.clientesConCompra} prefix={<UserOutlined />} />
          </Card>
        </Col>
      </Row>

      {periodComparison ? (
        <Card style={{ marginBottom: 16, borderRadius: 12 }} styles={{ body: { padding: "14px 16px" } }}>
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <div>
              <Title level={5} style={{ marginBottom: 4 }}>Comparacion de periodos</Title>
              <Text type="secondary">
                {periodComparison.currentLabel} frente a {periodComparison.previousLabel} con los mismos filtros activos.
              </Text>
            </div>

            <Row gutter={[12, 12]}>
              <Col xs={24} md={12} xl={6}>
                <Card size="small" style={{ borderRadius: 10 }}>
                  <Statistic title="Ventas" value={comparison.totalVentas.current} suffix={<Text type="secondary">vs {comparison.totalVentas.previous}</Text>} />
                  <div style={{ marginTop: 8 }}>
                    <Text style={{ color: comparison.totalVentas.delta >= 0 ? "#389e0d" : "#cf1322" }}>
                      {comparison.totalVentas.delta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {formatDelta(comparison.totalVentas.delta)}
                    </Text>
                    <Text type="secondary"> <ArrowRightOutlined /> {formatPercent(comparison.totalVentas.deltaPercent)}</Text>
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Card size="small" style={{ borderRadius: 10 }}>
                  <Statistic title="Facturacion" value={comparison.totalFacturado.current} formatter={(value) => formatMoney(Number(value || 0))} />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">Anterior: {formatMoney(comparison.totalFacturado.previous)}</Text>
                  </div>
                  <div>
                    <Text style={{ color: comparison.totalFacturado.delta >= 0 ? "#389e0d" : "#cf1322" }}>
                      {comparison.totalFacturado.delta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {formatMoney(comparison.totalFacturado.delta)}
                    </Text>
                    <Text type="secondary"> <ArrowRightOutlined /> {formatPercent(comparison.totalFacturado.deltaPercent)}</Text>
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Card size="small" style={{ borderRadius: 10 }}>
                  <Statistic title="Beneficio" value={comparison.beneficioTotal.current} formatter={(value) => formatMoney(Number(value || 0))} />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">Anterior: {formatMoney(comparison.beneficioTotal.previous)}</Text>
                  </div>
                  <div>
                    <Text style={{ color: comparison.beneficioTotal.delta >= 0 ? "#389e0d" : "#cf1322" }}>
                      {comparison.beneficioTotal.delta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {formatMoney(comparison.beneficioTotal.delta)}
                    </Text>
                    <Text type="secondary"> <ArrowRightOutlined /> {formatPercent(comparison.beneficioTotal.deltaPercent)}</Text>
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Card size="small" style={{ borderRadius: 10 }}>
                  <Statistic title="Ticket promedio" value={comparison.ticketPromedio.current} formatter={(value) => formatMoney(Number(value || 0))} />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">Anterior: {formatMoney(comparison.ticketPromedio.previous)}</Text>
                  </div>
                  <div>
                    <Text style={{ color: comparison.ticketPromedio.delta >= 0 ? "#389e0d" : "#cf1322" }}>
                      {comparison.ticketPromedio.delta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {formatMoney(comparison.ticketPromedio.delta)}
                    </Text>
                    <Text type="secondary"> <ArrowRightOutlined /> {formatPercent(comparison.ticketPromedio.deltaPercent)}</Text>
                  </div>
                </Card>
              </Col>
            </Row>
          </Space>
        </Card>
      ) : null}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Numero de ventas" value={salesStats.totalVentas} prefix={<ShoppingCartOutlined />} />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Facturacion" value={salesStats.totalFacturado} formatter={(value) => formatMoney(Number(value || 0))} valueStyle={{ color: "#d81b87" }} />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Beneficio" value={salesStats.beneficioTotal} formatter={(value) => formatMoney(Number(value || 0))} valueStyle={{ color: salesStats.beneficioTotal >= 0 ? "#389e0d" : "#cf1322" }} />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Ticket promedio" value={salesStats.ticketPromedio} formatter={(value) => formatMoney(Number(value || 0))} />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Unidades vendidas" value={salesStats.unidadesVendidas} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 12, borderRadius: 10 }} styles={{ body: { padding: "12px 14px" } }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={10}>
            <Input
              placeholder="Buscar por cliente, proveedor, concepto, codigo o referencia"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8} xl={4}>
            <Select
              placeholder="Tipo de operacion"
              allowClear
              style={{ width: "100%" }}
              value={tipoFiltro}
              onChange={(value) => setTipoFiltro(value)}
              options={Object.entries(TIPO_META).map(([value, meta]) => ({ value, label: meta.label }))}
            />
          </Col>
          <Col xs={24} sm={8} xl={4}>
            <Select
              placeholder="Direccion"
              allowClear
              style={{ width: "100%" }}
              value={direccionFiltro}
              onChange={(value) => setDireccionFiltro(value)}
              options={[
                { value: "entrada", label: "Entrada" },
                { value: "salida", label: "Salida" },
                { value: "neutral", label: "Neutral" },
              ]}
            />
          </Col>
          <Col xs={24} sm={8} xl={6}>
            <Segmented
              block
              value={periodo}
              onChange={(value) => setPeriodo(value as PeriodoRapido)}
              options={[
                { label: "Hoy", value: "hoy" },
                { label: "Semana", value: "semana" },
                { label: "Mes", value: "mes" },
                { label: "Año", value: "anio" },
                { label: "Periodo", value: "personalizado" },
                { label: "Todo", value: "todo" },
              ]}
            />
          </Col>
          <Col xs={24} sm={8} xl={4}>
            <DatePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              placeholder="Dia exacto"
              value={diaFiltro}
              onChange={(value) => setDiaFiltro(value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8} xl={4}>
            <DatePicker
              style={{ width: "100%" }}
              picker="month"
              format="MM/YYYY"
              placeholder="Mes exacto"
              value={mesFiltro}
              onChange={(value) => setMesFiltro(value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8} xl={3}>
            <Select
              placeholder="Año"
              allowClear
              style={{ width: "100%" }}
              value={anioFiltro}
              onChange={(value) => setAnioFiltro(value)}
              options={yearOptions}
            />
          </Col>
          {periodo === "personalizado" ? (
            <Col xs={24} xl={10}>
              <RangePicker
                style={{ width: "100%" }}
                format="DD/MM/YYYY"
                placeholder={["Desde", "Hasta"]}
                value={rango as [Dayjs, Dayjs] | null}
                onChange={(dates) => setRango(dates as [Dayjs, Dayjs] | null)}
              />
            </Col>
          ) : null}
        </Row>
        <Space size={[8, 8]} wrap style={{ marginTop: 12 }}>
          <Button onClick={() => setMostrarGraficas((current) => !current)}>
            {mostrarSeccionGraficas ? "Ocultar gráficas" : "Mostrar gráficas"}
          </Button>
          <Button
            onClick={() => {
              setPeriodo("mes");
              setRango(null);
              setDiaFiltro(null);
              setMesFiltro(null);
              setAnioFiltro(null);
              setTipoFiltro(undefined);
              setDireccionFiltro(undefined);
              setSearch("");
            }}
          >
            Limpiar filtros
          </Button>
          {!hayFiltrosActivos ? (
            <Text type="secondary">Las gráficas se muestran cuando las abres manualmente o cuando aplicas filtros.</Text>
          ) : null}
        </Space>
        <Space size={[8, 8]} wrap style={{ marginTop: 12 }}>
          <Tag color="magenta">Ventas: {stats.resumen.ventas}</Tag>
          <Tag color="blue">Compras: {stats.resumen.compras}</Tag>
          <Tag color="geekblue">Caja: {stats.resumen.movimientos}</Tag>
          <Tag color="gold">Puntos: {stats.resumen.puntos}</Tag>
          <Tag color="purple">Vouchers: {stats.resumen.vouchers}</Tag>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 64 }}>
            <Spin size="large" />
          </div>
        ) : operacionesFiltradas.length === 0 ? (
          <Empty description="No hay operaciones para los filtros seleccionados" style={{ padding: 64 }} />
        ) : (
          <Table
            dataSource={operacionesFiltradas}
            columns={columns}
            rowKey="key"
            size={isMobile ? "small" : "middle"}
            virtual
            pagination={{ pageSize: 30, showSizeChanger: true, pageSizeOptions: [20, 30, 50, 100] }}
            scroll={{ x: 980, y: isMobile ? 420 : 620 }}
          />
        )}
      </Card>

      {!loading && hasMore ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Button onClick={cargarMas} loading={loadingMore} icon={<ReloadOutlined />}>
            Cargar mas historial
          </Button>
        </div>
      ) : null}

      {mostrarSeccionGraficas ? <HistorialCharts stats={salesStats} /> : null}

      <Modal
        open={!!detalle}
        title={detalle ? detalle.titulo : "Detalle"}
        onCancel={() => setDetalle(null)}
        footer={null}
        width={isMobile ? "94%" : 760}
      >
        {detalle ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Fecha">{formatDateTime(detalle.fecha)}</Descriptions.Item>
              <Descriptions.Item label="Operacion">
                <Tag color={TIPO_META[detalle.tipo].color} icon={TIPO_META[detalle.tipo].icon}>{TIPO_META[detalle.tipo].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Cliente / tercero">{detalle.tercero}</Descriptions.Item>
              <Descriptions.Item label="Detalle">{detalle.detalle}</Descriptions.Item>
              <Descriptions.Item label="Referencia">{detalle.referencia || "-"}</Descriptions.Item>
              <Descriptions.Item label="Estado">{detalle.estado || "-"}</Descriptions.Item>
              <Descriptions.Item label="Metodo de pago">
                {detalle.metodoPago ? parseMetodoPago(detalle.metodoPago).label : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Monto">
                {typeof detalle.monto === "number" ? formatMoney(detalle.monto) : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Puntos">
                {typeof detalle.puntos === "number" ? `${detalle.puntos} pts` : "-"}
              </Descriptions.Item>
            </Descriptions>

            {detalle.items && detalle.items.length > 0 ? (
              <Card size="small" title="Items relacionados">
                <Space direction="vertical" style={{ width: "100%" }} size={10}>
                  {detalle.items.map((item, index) => {
                    const precioUnitario = "precio_unitario" in item ? Number(item.precio_unitario || 0) : Number(item.precio || 0);
                    const subtotal = "subtotal" in item && typeof item.subtotal === "number"
                      ? Number(item.subtotal || 0)
                      : Number(item.cantidad || 0) * precioUnitario;

                    return (
                      <div key={`${detalle.key}-item-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <Text strong>{item.nombre}</Text>
                          <div><Text type="secondary">Cantidad: {item.cantidad}</Text></div>
                        </div>
                        <Text strong>{formatMoney(subtotal)}</Text>
                      </div>
                    );
                  })}
                </Space>
              </Card>
            ) : null}

            {detalle.tipo === "movimiento" ? (
              <Card size="small" title="Movimiento de caja">
                <Space direction="vertical" size={8}>
                  <Text>Direccion: {detalle.direccion === "entrada" ? "Entrada" : detalle.direccion === "salida" ? "Salida" : "Neutral"}</Text>
                  {detalle.metodoPago ? <Text>Metodo: {parseMetodoPago(detalle.metodoPago).label}</Text> : null}
                  {typeof detalle.monto === "number" ? <Text>Monto: {formatMoney(detalle.monto)}</Text> : null}
                </Space>
              </Card>
            ) : null}
          </Space>
        ) : null}
      </Modal>
    </>
  );
}
