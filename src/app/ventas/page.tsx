"use client";

import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import {
  Card, Button, Typography, Space, Input, Select, Tag, App, Spin,
  Row, Col, Statistic, Divider, Grid, Tooltip, Avatar, Badge,
  InputNumber, Modal, Form, Radio, Table, Empty, DatePicker, List, Popconfirm, Switch, message as antdMessage,
} from "antd";
import {
  ShoppingCartOutlined, UserOutlined, PlusOutlined,
  MinusOutlined, DeleteOutlined, CheckOutlined, DollarOutlined,
  CreditCardOutlined, MobileOutlined, BarChartOutlined, TagsOutlined,
  GiftOutlined, CrownOutlined, ReloadOutlined, ExclamationCircleOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { normalizarDatosFormulario } from "@utils/form-normalizer";
import dayjs from "dayjs";
import EscanerCodigo from "@/components/EscanerCodigo";
import { imprimirTicketTermico, abrirCajon, cargarConfigPOS, DatosTicket } from "@utils/pos-hardware";
import { aplicarPlantillaTicketPOS, cargarConfigTicketPOS } from "@utils/pos-ticket-template";
import { BarcodeOutlined } from "@ant-design/icons";
import { crearMovimiento } from "@/modules/finanzas/movimientos.service";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isBirthdayMonth } from "@/constants/clubRewards";
import { useClubConfig, getNivelDinamico, getMultiplicadorCumple, calcularPuntosVenta } from "@/hooks/useClubConfig";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type Articulo = {
  id: string; nombre: string; precio_venta: number;
  stock: number; categoria?: string; marca?: string; imagen_url?: string;
  referencia?: string; codigo_barras?: string; codigo_secundario?: string;
};
type CarritoItem = Articulo & { cantidad: number; subtotal: number };
type Cliente = { id: string; nombre_completo: string; cedula?: string; telefono?: string; puntos_fidelidad?: number; nivel_fidelidad?: string; fecha_nacimiento?: string; total_compras?: number; rol?: string; activo?: boolean };
type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "mixto";
type PagoMixto = { efectivo: number; tarjeta: number; transferencia: number };
type ClubVoucher = {
  id: string;
  perfilId: string;
  code: string;
  puntos: number;
  valueCop: number;
  status: string;
  rewardKey?: string | null;
  rewardTitle: string;
  rewardIcon: string;
  description: string;
};

type VentaAparcada = {
  id: string;
  creadoEn: string;
  carrito: CarritoItem[];
  clienteId: string | null;
  descuento: number;
  metodoPago: MetodoPago;
  efectivoRecibido: number;
  pagoMixto: PagoMixto;
  voucherClub: ClubVoucher | null;
  codigoVoucherClub: string;
  imprimirTicket: boolean;
};

const VENTAS_APARCADAS_STORAGE_KEY = "pos_ventas_aparcadas_ventas_v1";
const MAX_VENTAS_APARCADAS = 20;

const NIVEL_COLORS: Record<string, string> = {
  bronce: "#cd7f32", plata: "#aaa", oro: "#faad14", diamante: "#13c2c2",
};

const METODO_PAGO_LABELS: Record<Exclude<MetodoPago, "mixto">, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const getNivelFidelidad = (puntos: number) => {
  if (puntos >= 15000) return "diamante";
  if (puntos >= 5000) return "oro";
  if (puntos >= 1000) return "plata";
  return "bronce";
};

const getMetodoPagoPersistido = (metodo: MetodoPago, pagoMixto: PagoMixto) => {
  if (metodo !== "mixto") return metodo;

  const partes = Object.entries(pagoMixto)
    .filter(([, monto]) => Number(monto) > 0)
    .map(([clave, monto]) => `${clave}:${Number(monto)}`);

  return partes.length > 0 ? `mixto|${partes.join("|")}` : "mixto";
};

const getDetallePagoMixto = (pagoMixto: PagoMixto) =>
  Object.entries(pagoMixto)
    .filter(([, monto]) => Number(monto) > 0)
    .map(([clave, monto]) => `${METODO_PAGO_LABELS[clave as keyof typeof METODO_PAGO_LABELS]} $${Number(monto).toLocaleString()}`)
    .join(" · ");

function getVentaNumero(venta?: { numero_ticket?: number | null; id?: string | null } | null): string {
  const numero = Number(venta?.numero_ticket ?? 0);
  if (Number.isFinite(numero) && numero >= 1000) {
    return String(Math.trunc(numero));
  }

  const id = String(venta?.id || "");
  return id ? id.slice(-6).toUpperCase() : "------";
}

const toCents = (valor: number) => Math.round(Number(valor || 0) * 100);
const moneyEquals = (a: number, b: number) => toCents(a) === toCents(b);

const MONTH_OPTIONS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

function getDaysInMonth(month?: number): number {
  if (!month || month < 1 || month > 12) return 31;
  return dayjs(`2000-${String(month).padStart(2, "0")}-01`, "YYYY-MM-DD", true).daysInMonth();
}

function buildDiaMes(day?: number, month?: number): string {
  if (!day || !month) return "";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function parseDiaMesToIso(diaMes: string): string | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(String(diaMes || "").trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const base = dayjs(`2000-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, "YYYY-MM-DD", true);
  if (!base.isValid() || base.date() !== day || base.month() + 1 !== month) return null;

  return base.format("YYYY-MM-DD");
}

export default function VentasPage() {
  const router = useRouter();
  const posPrintMode = (process.env.NEXT_PUBLIC_POS_PRINT_MODE ?? "auto").toLowerCase();
  const permiteCajon = posPrintMode === "qz" || posPrintMode === "agent" || posPrintMode === "auto";
  const permiteImpresionSilenciosa = posPrintMode === "qz" || posPrintMode === "agent" || posPrintMode === "auto";
  const usaUIRapidaPOS = permiteImpresionSilenciosa;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { message, modal } = App.useApp();
  const { user } = useCurrentUser();

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [descuento, setDescuento] = useState(0);
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState(0);
  const [codigoVoucherClub, setCodigoVoucherClub] = useState("");
  const [voucherClub, setVoucherClub] = useState<ClubVoucher | null>(null);
  const [validandoVoucher, setValidandoVoucher] = useState(false);
  const [pagoMixto, setPagoMixto] = useState<PagoMixto>({ efectivo: 0, tarjeta: 0, transferencia: 0 });
  const [imprimirTicket, setImprimirTicket] = useState(true);
  const [ventasAparcadas, setVentasAparcadas] = useState<VentaAparcada[]>([]);
  const [restaurandoVentaId, setRestaurandoVentaId] = useState<string | null>(null);

  const [nuevoClienteOpen, setNuevoClienteOpen] = useState(false);
  const [nuevoClienteForm] = Form.useForm();
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [cumpleDiaPickerOpen, setCumpleDiaPickerOpen] = useState(false);
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const { reglas: reglasClub } = useClubConfig();

  const subtotalCarrito = carrito.reduce((s, i) => s + i.subtotal, 0);
  const descuentoVal = Math.round(subtotalCarrito * (descuento / 100));
  const descuentoVoucherClub = Math.min(voucherClub?.valueCop || 0, Math.max(0, subtotalCarrito - descuentoVal));
  const totalFinal = Math.max(0, subtotalCarrito - descuentoVal - descuentoVoucherClub);

  const lanzarProcesosPOS = useCallback((ticket: DatosTicket, debeAbrirCajon: boolean, debeImprimir: boolean) => {
    const tareas: Promise<unknown>[] = [];

    if (debeAbrirCajon && permiteCajon) {
      tareas.push(
        abrirCajon().then((result) => {
          if (!result.ok) {
            console.warn("[POS] Venta registrada, pero el cajón no respondió:", result.error ?? "sin detalle");
          }
        }).catch(() => {})
      );
    }

    if (debeImprimir && permiteImpresionSilenciosa) {
      tareas.push(
        imprimirTicketTermico(ticket, undefined, undefined, { allowBrowserFallback: false })
          .then((result) => {
            if (!result.ok) {
              console.warn("[POS] Venta registrada, pero el ticket no se imprimió:", result.error ?? "sin detalle");
            }
          })
          .catch((error: any) => {
            console.warn("[POS] Venta registrada, pero el ticket no se imprimió:", error?.message ?? "sin detalle");
          })
      );
    }

    void Promise.allSettled(tareas);
  }, [permiteCajon, permiteImpresionSilenciosa]);
  const vuelta = efectivoRecibido - totalFinal;
  const totalPagoMixto = useMemo(
    () => Object.values(pagoMixto).reduce((acc, monto) => acc + Number(monto || 0), 0),
    [pagoMixto]
  );
  const pagoMixtoCuadra = useMemo(() => moneyEquals(totalPagoMixto, totalFinal), [totalPagoMixto, totalFinal]);
  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);
  const showFidelizacionPreview = carrito.length > 0 && (isMobile ? carrito.length <= 4 : carrito.length <= 8);

  const abrirModalCobroRapido = useCallback(() => {
    if (metodoPago === "efectivo") {
      setEfectivoRecibido(totalFinal);
    }

    if (metodoPago === "mixto") {
      setPagoMixto((prev) => {
        const totalActual = Number(prev.efectivo || 0) + Number(prev.tarjeta || 0) + Number(prev.transferencia || 0);
        if (totalActual > 0) return prev;
        return { efectivo: totalFinal, tarjeta: 0, transferencia: 0 };
      });
    }

    setModalPagoOpen(true);
  }, [metodoPago, totalFinal]);

  useEffect(() => {
    // Precarga para evitar latencia en la primera impresión/cajón.
    void cargarConfigPOS().catch(() => {});
    void cargarConfigTicketPOS().catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalPagoOpen) return;

    if (metodoPago === "efectivo" && efectivoRecibido <= 0) {
      setEfectivoRecibido(totalFinal);
    }

    if (metodoPago === "mixto") {
      const totalActual = Number(pagoMixto.efectivo || 0) + Number(pagoMixto.tarjeta || 0) + Number(pagoMixto.transferencia || 0);
      if (totalActual <= 0) {
        setPagoMixto({ efectivo: totalFinal, tarjeta: 0, transferencia: 0 });
      }
    }
  }, [modalPagoOpen, metodoPago, totalFinal, efectivoRecibido, pagoMixto]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(VENTAS_APARCADAS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as VentaAparcada[];
      if (Array.isArray(parsed)) {
        setVentasAparcadas(parsed);
      }
    } catch (error) {
      console.error("Error leyendo ventas aparcadas de ventas:", error);
    }
  }, []);

  const deferredSearch = useDeferredValue(search);

  const clientesBusqueda = useMemo(
    () => clientes.map((c) => ({
      ...c,
      searchText: `${c.nombre_completo || ""} ${c.cedula || ""} ${c.telefono || ""}`.toLowerCase(),
      telefonoDigits: (c.telefono || "").replace(/\D/g, ""),
    })),
    [clientes]
  );

  const opcionesClientesRapidos = useMemo(
    () => clientesFiltrados.map((c) => ({
      value: c.id,
      label: c.nombre_completo,
    })),
    [clientesFiltrados]
  );

  const opcionesClientesCobro = useMemo(
    () => clientes.map((c) => ({
      value: c.id,
      label: c.nombre_completo,
      searchText: `${c.nombre_completo || ""} ${c.cedula || ""} ${c.telefono || ""}`.toLowerCase(),
    })),
    [clientes]
  );

  useEffect(() => {
    if (!voucherClub) return;
    if (!clienteId || voucherClub.perfilId !== clienteId) {
      setVoucherClub(null);
      setCodigoVoucherClub("");
    }
  }, [clienteId, voucherClub]);

  const crearClienteRapido = async (submittedValues?: any) => {
    const values = submittedValues ?? await nuevoClienteForm.validateFields();
    setCreandoCliente(true);
    try {
      const { codigo_referido, cumple_dia, cumple_mes, ...clienteData } = values;
      const fecha_nacimiento = parseDiaMesToIso(buildDiaMes(cumple_dia, cumple_mes));
      if (!fecha_nacimiento) {
        throw new Error("Selecciona un cumpleaños válido (día y mes)");
      }

      const datosNormalizados = normalizarDatosFormulario({
        ...clienteData,
        fecha_nacimiento,
      });
      const res = await fetch("/api/perfiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datosNormalizados, rol: "cliente", activo: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al crear cliente");

      // Aplicar código de referido si se ingresó
      const nuevoId = json.data?.id;
      if (nuevoId && codigo_referido?.trim()) {
        try {
          const refRes = await fetch("/api/club/referido", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: codigo_referido.trim().toUpperCase(), nuevoClienteId: nuevoId }),
          });
          const refJson = await refRes.json();
          if (refRes.ok) {
            message.success(`✅ Cliente creado · +300 pts acreditados a ${refJson.referidor?.nombre}`);
          } else {
            message.warning(`Cliente creado, pero el código de referido no pudo aplicarse: ${refJson.error}`);
          }
        } catch {
          message.warning("Cliente creado, pero no se pudo aplicar el código de referido.");
        }
      } else {
        message.success(`✅ Cliente ${values.nombre_completo} creado`);
      }

      setNuevoClienteOpen(false);
      setCumpleDiaPickerOpen(false);
      nuevoClienteForm.resetFields();
      const r = await fetch("/api/perfiles?rol=cliente");
      const rj = await r.json();
      setClientes(rj.data || []);
      if (nuevoId) setClienteId(nuevoId);
    } catch (e: unknown) {
      message.error((e as Error)?.message || "Error al crear cliente");
    } finally {
      setCreandoCliente(false);
    }
  };

  const validarVoucherClub = async () => {
    const code = codigoVoucherClub.trim().toUpperCase();
    if (!code) {
      message.warning("Ingresa un código del club");
      return;
    }
    if (!clienteId) {
      message.warning("Selecciona el cliente antes de aplicar un voucher del club");
      return;
    }

    setValidandoVoucher(true);
    try {
      const response = await fetch("/api/club/voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", code, clienteId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo validar el voucher");
      setVoucherClub(json.data);
      setCodigoVoucherClub(json.data.code);
      message.success(`Voucher ${json.data.code} aplicado`);
    } catch (error: any) {
      setVoucherClub(null);
      message.error(error?.message || "No se pudo validar el voucher");
    } finally {
      setValidandoVoucher(false);
    }
  };

  const removerVoucherClub = () => {
    setVoucherClub(null);
    setCodigoVoucherClub("");
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const clientesPromise = fetch("/api/perfiles?rol=cliente").then(async (r) => {
          if (!r.ok) {
            const body = await r.text();
            throw new Error(body || `Error HTTP ${r.status} cargando clientes`);
          }
          return r.json();
        });

      const pageSize = 1000;
      let from = 0;
      let allArts: Articulo[] = [];
      let keepFetching = true;

      while (keepFetching) {
        const { data: arts, error: artsError } = await supabaseBrowserClient
          .from("articulos")
          .select("id,nombre,precio_venta,stock,categoria,marca,imagen_url,referencia,codigo_barras,codigo_secundario,activo")
          .eq("activo", true)
          .order("nombre")
          .range(from, from + pageSize - 1);

        if (artsError) {
          throw artsError;
        }

        const batch = (arts as Articulo[]) || [];
        allArts = allArts.concat(batch);
        keepFetching = batch.length === pageSize;
        from += pageSize;
      }

      const clientesRes = await clientesPromise;

      setArticulos(allArts);
      setClientes(((clientesRes.data as Cliente[]) || []).filter((c: Cliente) => c.activo !== false));
    } catch (error) {
      console.error("[Ventas] Error cargando datos iniciales:", error);
      setArticulos([]);
      setClientes([]);
      message.error("No se pudieron cargar productos o clientes. Recarga la página.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { cargar(); }, [cargar]);

  const articulosFiltrados = useMemo(() =>
    articulos.filter((a) => {
      const query = deferredSearch.toLowerCase();
      const matchSearch = !query ||
        a.nombre.toLowerCase().includes(query) ||
        (a.marca || "").toLowerCase().includes(query) ||
        (a.referencia || "").toLowerCase().includes(query) ||
        (a.codigo_barras || "").toLowerCase().includes(query);
      const matchCat = !filtroCategoria || a.categoria === filtroCategoria;
      return matchSearch && matchCat;
    }),
    [articulos, deferredSearch, filtroCategoria]
  );

  const codigoArticuloIndex = useMemo(() => {
    const index = new Map<string, Articulo>();
    const normalize = (value?: string | null) => String(value || "").trim().toLowerCase();

    for (const art of articulos) {
      const keys = [art.id, art.referencia, art.codigo_barras, art.codigo_secundario]
        .map((value) => normalize(value))
        .filter(Boolean);

      for (const key of keys) {
        if (!index.has(key)) {
          index.set(key, art);
        }
      }
    }

    return index;
  }, [articulos]);

  const categorias = [...new Set(articulos.map((a) => a.categoria).filter(Boolean))];

  const agregarAlCarrito = (art: Articulo) => {
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === art.id);
      if (existe) {
        return prev.map((i) =>
          i.id === art.id
            ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_venta }
            : i
        );
      }
      return [...prev, { ...art, cantidad: 1, subtotal: art.precio_venta }];
    });
  };

  const cambiarCantidad = (id: string, delta: number) => {
    setCarrito((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const nuevaCant = Math.max(1, i.cantidad + delta);
        return { ...i, cantidad: nuevaCant, subtotal: nuevaCant * i.precio_venta };
      })
    );
  };

  const quitarItem = (id: string) => setCarrito((prev) => prev.filter((i) => i.id !== id));

  const limpiarVenta = () => {
    setCarrito([]);
    setClienteId(null);
    setDescuento(0);
    setMetodoPago("efectivo");
    setEfectivoRecibido(0);
    setPagoMixto({ efectivo: 0, tarjeta: 0, transferencia: 0 });
    setCodigoVoucherClub("");
    setVoucherClub(null);
    setClientesFiltrados([]);
     setImprimirTicket(true);
  };

  const persistirVentasAparcadas = useCallback((ventas: VentaAparcada[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VENTAS_APARCADAS_STORAGE_KEY, JSON.stringify(ventas));
  }, []);

  const aparcarVentaActual = useCallback(() => {
    if (carrito.length === 0) {
      message.warning("No hay productos en el carrito para aparcar");
      return;
    }

    const ventaAparcada: VentaAparcada = {
      id: `venta-${Date.now()}`,
      creadoEn: dayjs().toISOString(),
      carrito,
      clienteId,
      descuento,
      metodoPago,
      efectivoRecibido,
      pagoMixto,
      voucherClub,
      codigoVoucherClub,
      imprimirTicket,
    };

    let aparcada = false;
    setVentasAparcadas((prev) => {
      if (prev.length >= MAX_VENTAS_APARCADAS) {
        return prev;
      }
      const next = [ventaAparcada, ...prev];
      persistirVentasAparcadas(next);
      aparcada = true;
      return next;
    });

    if (!aparcada) {
      message.warning(`Solo se permiten ${MAX_VENTAS_APARCADAS} ventas aparcadas. Reanuda o elimina una para continuar.`);
      return;
    }

    limpiarVenta();
    message.success("Venta aparcada. Puedes atender al siguiente cliente.");
  }, [carrito, clienteId, descuento, metodoPago, efectivoRecibido, pagoMixto, voucherClub, codigoVoucherClub, imprimirTicket, persistirVentasAparcadas, message]);

  const eliminarVentaAparcada = useCallback((ventaId: string) => {
    setVentasAparcadas((prev) => {
      const next = prev.filter((venta) => venta.id !== ventaId);
      persistirVentasAparcadas(next);
      return next;
    });
    message.success("Venta aparcada eliminada");
  }, [persistirVentasAparcadas, message]);

  const restaurarVentaAparcada = useCallback((venta: VentaAparcada) => {
    setRestaurandoVentaId(venta.id);
    try {
      setCarrito(venta.carrito || []);
      setClienteId(venta.clienteId || null);
      setDescuento(Number(venta.descuento || 0));
      setMetodoPago(venta.metodoPago || "efectivo");
      setEfectivoRecibido(Number(venta.efectivoRecibido || 0));
      setPagoMixto(venta.pagoMixto || { efectivo: 0, tarjeta: 0, transferencia: 0 });
      setVoucherClub(venta.voucherClub || null);
      setCodigoVoucherClub(venta.codigoVoucherClub || "");
      setImprimirTicket(venta.imprimirTicket !== false);

      setVentasAparcadas((prev) => {
        const next = prev.filter((item) => item.id !== venta.id);
        persistirVentasAparcadas(next);
        return next;
      });

      message.success("Venta restaurada");
    } finally {
      setRestaurandoVentaId(null);
    }
  }, [persistirVentasAparcadas, message]);

  const procesarVenta = async () => {
    if (carrito.length === 0) { message.warning("El carrito está vacío"); return; }
    if (metodoPago === "efectivo" && efectivoRecibido < totalFinal) {
      message.warning("El efectivo recibido debe cubrir el total de la venta");
      return;
    }
    if (metodoPago === "mixto" && !pagoMixtoCuadra) {
      message.warning("El desglose del pago mixto debe sumar exactamente el total de la venta");
      return;
    }

    setProcesando(true);
    try {
      const metodoPagoPersistido = getMetodoPagoPersistido(metodoPago, pagoMixto);

      // Multiplicador de cumpleaños según nivel (desde reglas dinámicas)
      const esCumpleCliente = clienteSeleccionado?.fecha_nacimiento
        ? isBirthdayMonth(clienteSeleccionado.fecha_nacimiento)
        : false;
      const nivelCliente = (clienteSeleccionado?.nivel_fidelidad ?? getNivelDinamico(Number(clienteSeleccionado?.puntos_fidelidad ?? 0), reglasClub)) as import("@/constants/clubRewards").ClubLevelKey;
      const multiplicadorCumple = esCumpleCliente
        ? getMultiplicadorCumple(nivelCliente, reglasClub)
        : 1;

      const puntosBase = clienteId ? calcularPuntosVenta(totalFinal, reglasClub) : 0;
      const puntosGanados = puntosBase * multiplicadorCumple;

      // Registrar venta en Supabase
      const { data: venta, error: ventaErr } = await supabaseBrowserClient
        .from("ventas")
        .insert([{
          cliente_id: clienteId,
          fecha: dayjs().toISOString(),
          subtotal: subtotalCarrito,
          descuento: descuentoVal + descuentoVoucherClub,
          total: totalFinal,
          metodo_pago: metodoPagoPersistido,
          items: carrito.map((i) => ({ id: i.id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio_venta, subtotal: i.subtotal })),
        }])
        .select()
        .single();

      if (ventaErr) throw ventaErr;
      const numeroVenta = getVentaNumero(venta as any);

      // Actualizar stock
      await Promise.all(carrito.map((i) =>
        supabaseBrowserClient
          .from("articulos")
          .update({ stock: i.stock - i.cantidad })
          .eq("id", i.id)
      ));

      // Puntos de fidelidad (1 punto por cada $1000, con multiplicador de cumpleaños)
      if (clienteId && clienteSeleccionado && puntosGanados > 0) {
        await fetch(`/api/perfiles?id=${encodeURIComponent(clienteId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            total_compras: Number(clienteSeleccionado.total_compras || 0) + totalFinal,
          }),
        });

        // Registrar en historial (service role)
        const tipo = esCumpleCliente ? "cumpleanos" : "ganados";
        const conceptoHistorial = esCumpleCliente
          ? `Compra POS #${numeroVenta} · ${multiplicadorCumple}x cumpleaños 🎂 (${puntosBase} base × ${multiplicadorCumple})`
          : `Compra POS #${numeroVenta} · $${totalFinal.toLocaleString()}`;

        fetch("/api/club/puntos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perfil_id: clienteId,
            tipo,
            puntos: puntosGanados,
            concepto: conceptoHistorial,
            referencia: venta?.id || null,
            actualizar_perfil: true,
          }),
        }).catch(() => { /* no bloquea la venta */ });

        // Recibo WhatsApp (fire-and-forget, solo si tiene teléfono)
        if (clienteSeleccionado.telefono) {
          fetch("/api/whatsapp/send-puntos-compra", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              perfil_id: clienteId,
              telefono: String(clienteSeleccionado.telefono).replace(/\D/g, ""),
              total_compra: totalFinal,
              numero_venta: `#${numeroVenta}`,
            }),
          }).catch(() => { /* no bloquea la venta */ });
        }
      } else if (clienteId && clienteSeleccionado) {
        // Solo actualizar total_compras aunque no se acumulen puntos
        await fetch(`/api/perfiles?id=${encodeURIComponent(clienteId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            total_compras: Number(clienteSeleccionado.total_compras || 0) + totalFinal,
          }),
        });
      }

      try {
        const detallePagoMixto = metodoPago === "mixto" ? getDetallePagoMixto(pagoMixto) : null;
        await crearMovimiento({
          fecha: dayjs().format("YYYY-MM-DD"),
          tipo: "ingreso",
          monto: totalFinal,
          concepto: `Venta POS #${numeroVenta}`,
          categoria: "ventas",
          metodo_pago: metodoPagoPersistido,
          referencia: venta?.id || null,
          descripcion: [
            `Items: ${carrito.map((item) => `${item.nombre} x${item.cantidad}`).join(", ")}`,
            detallePagoMixto ? `Pago: ${detallePagoMixto}` : null,
            voucherClub ? `Voucher club: ${voucherClub.code} (${voucherClub.rewardTitle})` : null,
          ].filter(Boolean).join(" | "),
          estudiante_id: clienteId,
          created_by: user?.id || null,
        });
      } catch {
        // El asiento financiero no debe bloquear la venta.
      }

      if (voucherClub && clienteId && venta?.id) {
        try {
          const voucherResponse = await fetch("/api/club/voucher", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "consume",
              code: voucherClub.code,
              clienteId,
              ventaId: venta.id,
            }),
          });
          const voucherJson = await voucherResponse.json();
          if (!voucherResponse.ok) {
            throw new Error(voucherJson.error || "No se pudo consumir el voucher");
          }
        } catch (voucherError) {
          console.error("No se pudo cerrar el voucher del club", voucherError);
          message.warning("La venta quedó registrada, pero el voucher requiere revisión manual.");
        }
      }

      const ticketBase: DatosTicket = {
        nombreTienda: "La Cosmetikera",
        numeroVenta,
        fecha: dayjs().format("DD/MM/YYYY HH:mm"),
        cliente: clienteSeleccionado?.nombre_completo,
        metodoPago: metodoPago === "mixto" ? `Mixto (${getDetallePagoMixto(pagoMixto)})` : metodoPago,
        cambio: metodoPago === "efectivo" ? Math.max(0, vuelta) : undefined,
        puntosFidelidad: clienteSeleccionado ? puntosGanados : undefined,
        puntosAcumulados: clienteSeleccionado
          ? Number(clienteSeleccionado.puntos_fidelidad || 0) + puntosGanados
          : undefined,
        nivelFidelidad: clienteSeleccionado
          ? getNivelFidelidad(Number(clienteSeleccionado.puntos_fidelidad || 0) + puntosGanados)
          : undefined,
        mensaje: voucherClub ? `Voucher aplicado: ${voucherClub.code}. Gracias por tu compra en La Cosmetikera.` : "¡Gracias por tu compra en La Cosmetikera!",
        lineas: [
          { tipo: "titulo", texto: "DETALLE DE VENTA" },
          { tipo: "linea" },
          ...carrito.map((i) => ({ tipo: "item" as const, descripcion: i.nombre, cantidad: i.cantidad, precio: i.precio_venta })),
          { tipo: "linea" },
          ...(descuento > 0
            ? [
                { tipo: "total" as const, etiqueta: "Subtotal", valor: subtotalCarrito },
                { tipo: "total" as const, etiqueta: `Descuento (${descuento}%)`, valor: -descuentoVal },
              ]
            : []),
          ...(voucherClub
            ? [{ tipo: "total" as const, etiqueta: `Voucher club ${voucherClub.code}`, valor: -descuentoVoucherClub }]
            : []),
          ...(metodoPago === "mixto"
            ? Object.entries(pagoMixto)
                .filter(([, monto]) => Number(monto) > 0)
                .map(([clave, monto]) => ({
                  tipo: "total" as const,
                  etiqueta: METODO_PAGO_LABELS[clave as keyof typeof METODO_PAGO_LABELS],
                  valor: Number(monto),
                }))
            : []),
          { tipo: "total", etiqueta: "TOTAL", valor: totalFinal },
        ],
      };
      const ticketTemplate = await cargarConfigTicketPOS();
      const ticketDatos = aplicarPlantillaTicketPOS(ticketBase, ticketTemplate);

      lanzarProcesosPOS(ticketDatos, metodoPago === "efectivo", imprimirTicket);
      setModalPagoOpen(false);
      limpiarVenta();
      cargar();
      if (!usaUIRapidaPOS) {
        message.success(`¡Venta registrada exitosamente! ${imprimirTicket ? "🎉" : "(sin impresión)"}`);
      }
    } catch (e: any) {
      message.error("Error al procesar: " + (e?.message || "desconocido"));
    } finally {
      setProcesando(false);
    }
  };

  // Buscar artículo por código al escanear
  const buscarPorCodigo = useCallback((codigo: string) => {
    const normalizar = (value?: string | null) => String(value || "").trim().toLowerCase();
    const cleanedCodigo = codigo.trim();
    const normalizedCodigo = normalizar(cleanedCodigo);
    const art = codigoArticuloIndex.get(normalizedCodigo);
    if (art) {
      agregarAlCarrito(art);
       setSearch("");
       message.success(`${art.nombre} agregado al carrito`);
    } else {
      // Si no hay match exacto, priorizar búsqueda parcial por nombre/marca/códigos
      // para no interrumpir la operación con modal cuando el usuario aún está escribiendo.
      const query = cleanedCodigo.toLowerCase();
      const coincidenciasParciales = articulos.some((item) =>
        item.nombre.toLowerCase().includes(query) ||
        String(item.marca || "").toLowerCase().includes(query) ||
        String(item.referencia || "").toLowerCase().includes(query) ||
        String(item.codigo_barras || "").toLowerCase().includes(query) ||
        String(item.codigo_secundario || "").toLowerCase().includes(query)
      );

      setSearch(cleanedCodigo);

      // Solo mostrar modal si parece un código final (no búsqueda parcial)
      // y no existe ninguna coincidencia parcial.
      const pareceCodigoFinal = /^\d{6,}$/.test(cleanedCodigo);
      if (!coincidenciasParciales && pareceCodigoFinal) {
        modal.confirm({
          title: "Producto no encontrado",
          icon: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
          content: `No existe un artículo con código ${cleanedCodigo}.`,
          okText: "Crear artículo rápido",
          cancelText: "Cancelar",
          onOk: () => {
            router.push(`/articulos?quickCode=${encodeURIComponent(cleanedCodigo)}`);
          },
        });
      }
    }
  }, [codigoArticuloIndex, articulos, message, modal, router]);

  const handleCobrar = () => {
    if (!clienteId && carrito.length > 0) {
      modal.confirm({
        title: "¿Vender sin cliente?",
        icon: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
        content: (
          <div>
            <p>Los <strong>{Math.floor(totalFinal / 1000)} puntos</strong> de esta compra no se acumularán.</p>
            <p style={{ color: "#888", fontSize: 12 }}>Puedes asignar o crear un cliente en el panel del carrito antes de cobrar.</p>
          </div>
        ),
        okText: "Continuar sin cliente",
        cancelText: "← Asignar cliente",
        okButtonProps: { danger: true },
        onOk: abrirModalCobroRapido,
      });
    } else {
      abrirModalCobroRapido();
    }
  };

  const panelProductos = (
    <div>
      {/* Barra única: escáner + búsqueda manual - GRANDE Y VISIBLE */}
      <div style={{ marginBottom: 20, padding: 12, background: "#fff9fe", borderRadius: 10, border: "2px solid #f0d6ff" }}>
        <EscanerCodigo
          onCodigo={buscarPorCodigo}
          value={search}
          onChange={setSearch}
          placeholder="🔍 Escanear o buscar por nombre, marca, referencia o código..."
          conCamara
          size="large"
        />
      </div>

      {/* Resultados solo cuando hay 3+ caracteres */}
      {search.trim().length >= 3 && (
        loading ? (
          <div style={{ textAlign: "center", padding: 24 }}><Spin /></div>
        ) : articulosFiltrados.length === 0 ? (
          <Empty description="Sin resultados" style={{ padding: 24 }} />
        ) : (
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #f0d6ff" }}>
            {articulosFiltrados.slice(0, 8).map((art, idx) => {
              const enCarrito = carrito.find((i) => i.id === art.id);
              return (
                <div
                  key={art.id}
                  onClick={() => {
                    agregarAlCarrito(art);
                    setSearch("");
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px",
                    background: enCarrito ? "#fce4f8" : idx % 2 === 0 ? "#fff" : "#fdf5ff",
                    borderBottom: idx < Math.min(articulosFiltrados.length, 8) - 1 ? "1px solid #f0d6ff" : "none",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    borderLeft: enCarrito ? "4px solid #d81b87" : "4px solid transparent",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: 600, fontSize: 13, display: "block" }} ellipsis>
                      {art.nombre}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#aaa" }}>
                      {[art.marca, art.referencia, art.codigo_secundario, art.codigo_barras]
                        .filter(Boolean)
                        .join(" · ") || "Sin código visible"}
                    </Text>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <Text style={{ color: "#d81b87", fontWeight: 700, fontSize: 14, display: "block" }}>
                      ${Number(art.precio_venta).toLocaleString()}
                    </Text>
                    <Text style={{ fontSize: 11, color: Number(art.stock || 0) > 0 ? "#aaa" : "#ff4d4f" }}>
                      Stock: {Number(art.stock || 0)}
                    </Text>
                  </div>
                  {enCarrito ? (
                    <Badge count={enCarrito.cantidad} style={{ background: "#d81b87" }} />
                  ) : (
                    <PlusOutlined style={{ color: "#d81b87", fontSize: 16 }} />
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Instrucción cuando no hay búsqueda */}
      {search.trim().length === 0 && (
        <div style={{
          marginTop: 40, textAlign: "center",
          padding: "32px 24px",
          background: "linear-gradient(135deg,#fce4f8,#f0d6ff)",
          borderRadius: 16,
        }}>
          <BarcodeOutlined style={{ fontSize: 56, color: "#d81b87", opacity: 0.4, display: "block", marginBottom: 12 }} />
          <Text style={{ fontSize: 15, color: "#9c27b0", fontWeight: 600, display: "block" }}>
            Escanea el código de barras
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            o escribe el nombre del producto para buscarlo
          </Text>
        </div>
      )}

      {search.trim().length > 0 && search.trim().length < 3 && (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Escribe al menos 3 caracteres para buscar...</Text>
        </div>
      )}
    </div>
  );

  const panelCarrito = (
    <Card
      style={{ borderRadius: 12, height: "100%", display: "flex", flexDirection: "column" }}
      styles={{ body: { padding: 10, display: "flex", flexDirection: "column", height: "100%" } }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text strong style={{ fontSize: 14, color: "#7a1b6f" }}>📦 Carrito</Text>
        <Tag color="magenta" style={{ fontSize: 11, marginRight: 0 }}>
          {carrito.length} item{carrito.length === 1 ? "" : "s"}
        </Tag>
      </div>

      {!clienteId && carrito.length > 0 && (
        <Tag color="warning" style={{ fontSize: 10, marginBottom: 8, width: "fit-content" }}>
          ⚠️ Asigna un cliente
        </Tag>
      )}

      {/* Resumen cliente/voucher compacto */}
      {clienteSeleccionado && clienteId && (
        <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: "#f9f0ff", border: "1px solid #f0d6ff", fontSize: 11 }}>
          <Text strong style={{ fontSize: 11, display: "block" }}>{clienteSeleccionado.nombre_completo}</Text>
          {clienteSeleccionado.nivel_fidelidad && (
            <Tag color={NIVEL_COLORS[clienteSeleccionado.nivel_fidelidad] || "purple"} style={{ fontSize: 9, marginTop: 2 }}>
              {clienteSeleccionado.nivel_fidelidad}
            </Tag>
          )}
        </div>
      )}
      {clienteId && voucherClub && (
        <div style={{ marginBottom: 6, padding: "4px 6px", borderRadius: 6, background: "#f6ffed", border: "1px solid #b7eb8f", fontSize: 10 }}>
          <Text style={{ fontSize: 10 }}>✅ {voucherClub.rewardTitle} -${descuentoVoucherClub.toLocaleString()}</Text>
        </div>
      )}
      {clienteId && !voucherClub && (
        <Space.Compact style={{ width: "100%", marginBottom: 6 }} size="small">
          <Input
            value={codigoVoucherClub}
            onChange={(event) => setCodigoVoucherClub(event.target.value.toUpperCase())}
            placeholder="Voucher..."
            size="small"
            style={{ fontSize: 11 }}
          />
          <Button
            size="small"
            onClick={validarVoucherClub}
            loading={validandoVoucher}
            style={{ borderColor: "#d81b87", color: "#d81b87", fontSize: 11 }}
          >
            Validar
          </Button>
        </Space.Compact>
      )}

      {/* Items en formato tipo tabla/TPV */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        marginBottom: 6,
        border: "1px solid #f3e1ee",
        borderRadius: 6,
        padding: "4px 6px",
        background: "#fff",
        minHeight: isMobile ? 220 : 0,
        fontSize: 12,
      }}>
        {carrito.length === 0 ? (
          <Empty
            image={<ShoppingCartOutlined style={{ fontSize: 40, color: "#ccc" }} />}
            description="Escanea productos"
            styles={{ image: { height: 40 } }}
          />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #d81b87" }}>
                <th style={{ textAlign: "left", paddingBottom: 4, color: "#d81b87", fontWeight: 700 }}>Producto</th>
                <th style={{ textAlign: "center", paddingBottom: 4, color: "#d81b87", fontWeight: 700, width: 40 }}>P.</th>
                <th style={{ textAlign: "center", paddingBottom: 4, color: "#d81b87", fontWeight: 700, width: 50 }}>Cant</th>
                <th style={{ textAlign: "right", paddingBottom: 4, color: "#d81b87", fontWeight: 700, width: 50 }}>Total</th>
                <th style={{ width: 20 }}></th>
              </tr>
            </thead>
            <tbody>
              {carrito.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0", height: 32 }}>
                  <td style={{ padding: "2px 4px" }}>
                    <Text style={{ fontSize: 11, fontWeight: 600 }} ellipsis>
                      {item.nombre.length > 18 ? item.nombre.substring(0, 15) + "..." : item.nombre}
                    </Text>
                  </td>
                  <td style={{ textAlign: "center", padding: "2px 0", color: "#d81b87", fontSize: 10 }}>
                    ${Number(item.precio_venta).toLocaleString()}
                  </td>
                  <td style={{ textAlign: "center", padding: "2px 0" }}>
                    <Space size={2}>
                      <Button
                        size="small"
                        type="text"
                        icon={<MinusOutlined />}
                        onClick={() => cambiarCantidad(item.id, -1)}
                        style={{ padding: "0 4px", height: 24 }}
                      />
                      <Text strong style={{ minWidth: 20, textAlign: "center", fontSize: 11 }}>{item.cantidad}</Text>
                      <Button
                        size="small"
                        type="text"
                        icon={<PlusOutlined />}
                        onClick={() => cambiarCantidad(item.id, 1)}
                        style={{ padding: "0 4px", height: 24 }}
                      />
                    </Space>
                  </td>
                  <td style={{ textAlign: "right", padding: "2px 4px", fontSize: 11, fontWeight: 700, color: "#7a1b6f" }}>
                    ${Number(item.subtotal).toLocaleString()}
                  </td>
                  <td style={{ textAlign: "center", padding: "2px 0" }}>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => quitarItem(item.id)}
                      style={{ padding: "0 2px", height: 24 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Descuento */}
      <div style={{ marginBottom: 6 }}>
        <Row align="middle" gutter={8}>
          <Col>
            <Text style={{ fontSize: 12, color: "#888" }}>Descuento:</Text>
          </Col>
          <Col>
            <InputNumber
              min={0} max={100}
              value={descuento}
              onChange={(v) => setDescuento(v || 0)}
              formatter={(v) => `${v}%`}
              parser={(v) => Number((v || "").replace("%", ""))}
              size="small"
              style={{ width: 80 }}
            />
          </Col>
          {descuento > 0 && (
            <Col>
              <Tag color="green">-${descuentoVal.toLocaleString()}</Tag>
            </Col>
          )}
        </Row>
      </div>

      <Divider style={{ margin: "6px 0" }} />

      {/* Totales */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Text type="secondary">Subtotal</Text>
          <Text>${subtotalCarrito.toLocaleString()}</Text>
        </div>
        {descuento > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Text type="secondary">Descuento ({descuento}%)</Text>
            <Text style={{ color: "#52c41a" }}>-${descuentoVal.toLocaleString()}</Text>
          </div>
        )}
        {voucherClub && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Text type="secondary">Voucher Club {voucherClub.code}</Text>
            <Text style={{ color: "#389e0d" }}>-${descuentoVoucherClub.toLocaleString()}</Text>
          </div>
        )}
        <div style={{
          display: "flex", justifyContent: "space-between",
          padding: "8px 0", borderTop: "2px solid #f0f0f0", marginTop: 4,
        }}>
          <Text strong style={{ fontSize: 17 }}>TOTAL</Text>
          <Text strong style={{ fontSize: 24, color: "#d81b87" }}>${totalFinal.toLocaleString()}</Text>
        </div>
      </div>

      {/* Preview fidelización */}
      {showFidelizacionPreview && (
        clienteId && clienteSeleccionado ? (
          <div style={{
            marginBottom: 8, padding: "7px 10px",
            background: clienteSeleccionado?.fecha_nacimiento && isBirthdayMonth(clienteSeleccionado.fecha_nacimiento)
              ? "linear-gradient(90deg,#fff1f0,#fff0f6)"
              : "linear-gradient(90deg,#f9f0ff,#fff0f6)",
            borderRadius: 8,
            border: clienteSeleccionado?.fecha_nacimiento && isBirthdayMonth(clienteSeleccionado.fecha_nacimiento)
              ? "1px solid #ffadd2"
              : "1px solid #d3adf7",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <GiftOutlined style={{ color: "#722ed1", fontSize: 16, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              {(() => {
                const esCumple = clienteSeleccionado?.fecha_nacimiento && isBirthdayMonth(clienteSeleccionado.fecha_nacimiento);
                const niv = (clienteSeleccionado?.nivel_fidelidad ?? getNivelDinamico(Number(clienteSeleccionado?.puntos_fidelidad ?? 0), reglasClub)) as import("@/constants/clubRewards").ClubLevelKey;
                const mult = esCumple ? getMultiplicadorCumple(niv, reglasClub) : 1;
                const base = calcularPuntosVenta(totalFinal, reglasClub);
                const total = base * mult;
                return (
                  <>
                    <Text style={{ fontSize: 12, color: esCumple ? "#c41d7f" : "#722ed1", fontWeight: 600, display: "block" }}>
                      +{total} puntos en esta compra
                      {esCumple && <Tag color="magenta" style={{ marginLeft: 6, fontSize: 10, padding: "0 4px" }}>🎂 x{mult} cumpleaños</Tag>}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#888" }}>
                      Total acumulado: {Number(clienteSeleccionado.puntos_fidelidad || 0) + total} pts · {getNivelFidelidad(Number(clienteSeleccionado.puntos_fidelidad || 0) + total)}
                    </Text>
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <div style={{
            marginBottom: 8, padding: "7px 10px",
            background: "#fffbe6", borderRadius: 8, border: "1px solid #ffe58f",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <ExclamationCircleOutlined style={{ color: "#faad14", fontSize: 14, flexShrink: 0 }} />
            <Text style={{ fontSize: 11, color: "#ad6800" }}>
              Asigna un cliente para acumular <strong>{Math.floor(totalFinal / 1000)} puntos</strong>
            </Text>
          </div>
        )
      )}

      {/* Botones */}
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        {carrito.length > 0 && (
          <Row gutter={8}>
            <Col span={12}>
              <Button
                block
                onClick={aparcarVentaActual}
                style={{ borderColor: "#d81b87", color: "#d81b87" }}
              >
                Aparcar venta
              </Button>
            </Col>
            <Col span={12}>
              <Button block onClick={limpiarVenta}>Limpiar carrito</Button>
            </Col>
          </Row>
        )}

        <Button
          type="primary"
          size="large"
          block
          icon={<CheckOutlined />}
          disabled={carrito.length === 0}
          onClick={handleCobrar}
          style={{ background: "linear-gradient(90deg,#d81b87,#9c27b0)", border: "none", height: 44 }}
        >
          Cobrar ${totalFinal.toLocaleString()}
        </Button>

        {ventasAparcadas.length > 0 && carrito.length === 0 && (
          <Card
            size="small"
            title={`Ventas aparcadas (${ventasAparcadas.length})`}
            styles={{ body: { padding: 8, maxHeight: 150, overflowY: "auto" } }}
          >
            <List
              size="small"
              dataSource={ventasAparcadas}
              renderItem={(venta) => (
                <List.Item
                  actions={[
                    <Button
                      key="restaurar"
                      type="link"
                      loading={restaurandoVentaId === venta.id}
                      onClick={() => restaurarVentaAparcada(venta)}
                    >
                      Reanudar
                    </Button>,
                    <Popconfirm
                      key="eliminar"
                      title="¿Eliminar venta aparcada?"
                      okText="Sí"
                      cancelText="No"
                      onConfirm={() => eliminarVentaAparcada(venta.id)}
                    >
                      <Button type="link" danger>
                        Eliminar
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={venta.clienteId ? (clientes.find((c) => c.id === venta.clienteId)?.nombre_completo || "Cliente") : "Cliente sin asignar"}
                    description={`$${Number(venta.carrito?.reduce((acc, item) => acc + Number(item.subtotal || 0), 0) || 0).toLocaleString()} · ${dayjs(venta.creadoEn).format("DD/MM HH:mm")}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        )}
      </Space>
    </Card>
  );

  return (
    <div
      style={{
        height: isMobile ? "auto" : "calc(100dvh - 112px)",
        overflow: isMobile ? "visible" : "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER MEJORADO CON CLIENTE Y BÚSQUEDA */}
      <Card style={{ marginBottom: 8, borderRadius: 10 }} styles={{ body: { padding: "8px 12px" } }}>
        <Row align="middle" gutter={12} justify="space-between">
          <Col flex="200px">
            <Space size={8}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "linear-gradient(135deg,#d81b87,#9c27b0)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ShoppingCartOutlined style={{ color: "#fff", fontSize: 16 }} />
              </div>
              <div>
                <Title level={5} style={{ margin: 0, lineHeight: 1.1 }}>Punto de Venta</Title>
                <Text type="secondary" style={{ fontSize: 10, lineHeight: 1.1 }}>{dayjs().format("dddd D [de] MMMM, YYYY")}</Text>
              </div>
            </Space>
          </Col>
          <Col flex="auto" style={{ minWidth: 0 }}>
            <Row gutter={8} align="middle">
              <Col flex="auto" style={{ minWidth: 0 }}>
                <Select
                  showSearch
                  allowClear
                  placeholder="👤 Buscar cliente por nombre, cédula..."
                  size="large"
                  style={{ width: "100%", fontSize: 12 }}
                  value={clienteId}
                  onChange={setClienteId}
                  filterOption={false}
                  notFoundContent={null}
                  onSearch={(input) => {
                    const q = input.trim();
                    if (q.length < 3) {
                      setClientesFiltrados([]);
                      return;
                    }
                    const ql = q.toLowerCase();
                    const qd = q.replace(/\D/g, "");
                    const matches = clientesBusqueda
                      .filter((c) =>
                        c.searchText.includes(ql) ||
                        (qd && c.telefonoDigits.includes(qd))
                      )
                      .map(({ searchText, telefonoDigits, ...cliente }) => cliente)
                      .slice(0, 5);
                    setClientesFiltrados(matches);
                  }}
                  options={opcionesClientesRapidos}
                />
              </Col>
              <Col flex="100px">
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={() => setNuevoClienteOpen(true)}
                  style={{ background: "linear-gradient(90deg,#d81b87,#9c27b0)", border: "none" }}
                >
                  Nuevo
                </Button>
              </Col>
            </Row>
          </Col>
          <Col flex="100px">
            {clienteSeleccionado && (
              <div style={{ textAlign: "right" }}>
                <Text strong style={{ fontSize: 11, display: "block", color: "#7a1b6f" }}>{clienteSeleccionado.nombre_completo.split(" ")[0]}</Text>
                {clienteSeleccionado.puntos_fidelidad !== undefined && (
                  <Text type="secondary" style={{ fontSize: 10 }}>🎁 {clienteSeleccionado.puntos_fidelidad} pts</Text>
                )}
              </div>
            )}
          </Col>
          <Col>
            <Button size="small" icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
          </Col>
        </Row>
      </Card>

      {/* LAYOUT POS: Balance 50/50 para mejor lectura */}
      <Row gutter={[12, 12]} style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Col xs={24} lg={12} style={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
          {panelCarrito}
        </Col>
        <Col xs={24} lg={12} style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
          {panelProductos}
        </Col>
      </Row>

      {/* MODAL PAGO */}
      <Modal
        title="Cobro de venta"
        open={modalPagoOpen}
        onCancel={() => setModalPagoOpen(false)}
        footer={null}
        width={420}
      >
        <div style={{ padding: "12px 0" }}>
          <div style={{
            background: "linear-gradient(135deg,#fce4f8,#f0d6ff)",
            borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 16,
          }}>
            <Text type="secondary">Total a cobrar</Text>
            <div>
              <Text style={{ fontSize: 32, fontWeight: 800, color: "#d81b87" }}>
                ${totalFinal.toLocaleString()}
              </Text>
            </div>
            {clienteSeleccionado ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ background: "#d81b87", flexShrink: 0 }} />
                <Text type="secondary" style={{ fontSize: 12, flex: 1 }}>
                  {clienteSeleccionado.nombre_completo}
                  {clienteSeleccionado.nivel_fidelidad && (
                    <Tag
                      color={NIVEL_COLORS[clienteSeleccionado.nivel_fidelidad] || "purple"}
                      style={{ marginLeft: 4, fontSize: 10 }}
                    >
                      {clienteSeleccionado.nivel_fidelidad}
                    </Tag>
                  )}
                </Text>
                <Button
                  size="small"
                  type="link"
                  style={{ padding: 0, fontSize: 11, color: "#d81b87" }}
                  onClick={() => setClienteId(null)}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>Sin cliente asignado</Text>
            )}
          </div>

          {/* Selector de cliente en el modal de cobro */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>
              <UserOutlined /> Cliente (fidelización)
            </Text>
            <Row gutter={6}>
              <Col flex="auto">
                <Select
                  showSearch
                  allowClear
                  placeholder="Buscar por nombre, cédula o teléfono..."
                  style={{ width: "100%" }}
                  value={clienteId}
                  onChange={setClienteId}
                  optionLabelProp="label"
                  filterOption={(input, opt) => {
                    const q = input.toLowerCase().trim();
                    if (!q) return true;
                    return String((opt as any)?.searchText || "").includes(q);
                  }}
                  options={opcionesClientesCobro}
                />
              </Col>
              <Col>
                <Tooltip title="Crear nuevo cliente">
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setNuevoClienteOpen(true)}
                    style={{ borderColor: "#d81b87", color: "#d81b87" }}
                  />
                </Tooltip>
              </Col>
            </Row>
          </div>

          <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>Método de pago</Text>
          <Radio.Group
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            style={{ width: "100%", marginBottom: 16 }}
          >
            <Row gutter={[8, 8]}>
              {[
                { value: "efectivo", label: "Efectivo", icon: <DollarOutlined /> },
                { value: "tarjeta", label: "Tarjeta", icon: <CreditCardOutlined /> },
                { value: "transferencia", label: "Transferencia", icon: <MobileOutlined /> },
                { value: "mixto", label: "Mixto", icon: <BarChartOutlined /> },
              ].map((m) => (
                <Col span={12} key={m.value}>
                  <Radio.Button
                    value={m.value}
                    style={{
                      width: "100%", textAlign: "center", padding: "8px 0",
                      background: metodoPago === m.value ? "#fce4f8" : undefined,
                    }}
                  >
                    {m.icon} {m.label}
                  </Radio.Button>
                </Col>
              ))}
            </Row>
          </Radio.Group>

          {metodoPago === "efectivo" && (
            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13 }}>Efectivo recibido:</Text>
              <InputNumber
                size="large"
                style={{ width: "100%", marginTop: 4, fontSize: 14 }}
                min={0}
                value={efectivoRecibido}
                onChange={(v) => setEfectivoRecibido(v || 0)}
                onFocus={() => setEfectivoRecibido(0)}
                formatter={(v) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                placeholder="$ 0"
              />
              {efectivoRecibido >= totalFinal && (
                <div style={{
                  marginTop: 8, padding: "8px 12px",
                  background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 8,
                }}>
                  <Text style={{ color: "#389e0d" }}>
                    Cambio: <strong>${Math.max(0, vuelta).toLocaleString()}</strong>
                  </Text>
                </div>
              )}
            </div>
          )}

          {metodoPago === "mixto" && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>Desglose pago mixto</Text>
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                {(["efectivo", "tarjeta", "transferencia"] as const).map((clave) => (
                  <div key={clave}>
                    <Text style={{ fontSize: 12 }}>{METODO_PAGO_LABELS[clave]}</Text>
                    <InputNumber
                      size="large"
                      style={{ width: "100%", marginTop: 4 }}
                      min={0}
                      value={pagoMixto[clave]}
                      onChange={(valor) => setPagoMixto((prev) => ({ ...prev, [clave]: Number(valor || 0) }))}
                      formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                      placeholder="$ 0"
                    />
                  </div>
                ))}
              </Space>
              <div style={{
                marginTop: 10,
                padding: "8px 12px",
                background: pagoMixtoCuadra ? "#f6ffed" : "#fff7e6",
                border: `1px solid ${pagoMixtoCuadra ? "#b7eb8f" : "#ffd591"}`,
                borderRadius: 8,
              }}>
                <Text style={{ color: pagoMixtoCuadra ? "#389e0d" : "#d46b08" }}>
                  Total ingresado: <strong>${totalPagoMixto.toLocaleString()}</strong>
                  {!pagoMixtoCuadra ? ` · faltan/exceden ${Math.abs(totalFinal - totalPagoMixto).toLocaleString()}` : ""}
                </Text>
              </div>
            </div>
          )}

          {clienteSeleccionado && (
            <div style={{
              padding: "8px 12px", background: "#f9f0ff",
              borderRadius: 8, marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, color: "#722ed1" }}>
                <GiftOutlined /> El cliente ganará <strong>{Math.floor(totalFinal / 1000)} puntos</strong> por esta compra
              </Text>
            </div>
          )}

          <div
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #f0d6ff",
              background: "#fff9fe",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 12, color: "#595959" }}>Imprimir ticket al confirmar</Text>
            <Switch checked={imprimirTicket} onChange={setImprimirTicket} checkedChildren="Sí" unCheckedChildren="No" />
          </div>

          <Button
            type="primary"
            size="large"
            block
            loading={procesando}
            onClick={procesarVenta}
            icon={<CheckOutlined />}
            style={{ background: "linear-gradient(90deg,#d81b87,#9c27b0)", border: "none", height: 44 }}
          >
            Confirmar venta
          </Button>
        </div>
      </Modal>

      {/* MODAL NUEVO CLIENTE RÁPIDO */}
      <Modal
        title={<Space><UserOutlined style={{ color: "#d81b87" }} />Nuevo cliente</Space>}
        open={nuevoClienteOpen}
        onCancel={() => {
          setNuevoClienteOpen(false);
          setCumpleDiaPickerOpen(false);
          nuevoClienteForm.resetFields();
        }}
        onOk={() => nuevoClienteForm.submit()}
        confirmLoading={creandoCliente}
        okText="Crear cliente"
        cancelText="Cancelar"
        width={420}
        destroyOnHidden
      >
        <Form form={nuevoClienteForm} layout="vertical" style={{ marginTop: 12 }} onFinish={crearClienteRapido}>
          <Form.Item
            name="nombre_completo"
            label="Nombre completo"
            rules={[{ required: true, message: "El nombre es requerido" }]}
          >
            <Input placeholder="Ej: María García" prefix={<UserOutlined />} autoFocus />
          </Form.Item>
          <Form.Item
            name="cedula"
            label="Cédula"
            rules={[{ required: true, message: "La cédula es requerida" }]}
          >
            <Input placeholder="Ej: 1234567890" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="telefono"
                label="Teléfono"
                rules={[
                  { required: true, message: "El teléfono es obligatorio" },
                  { pattern: /^\d{7,15}$/, message: "Solo dígitos, entre 7 y 15 caracteres" },
                ]}
              >
                <Input placeholder="300 000 0000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="correo@ejemplo.com" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Cumpleaños (día/mes)" required>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="cumple_mes"
                  noStyle={false}
                  rules={[{ required: true, message: "Selecciona el mes" }]}
                >
                  <Select
                    placeholder="Mes"
                    options={MONTH_OPTIONS}
                    showSearch
                    optionFilterProp="label"
                    onChange={(monthValue) => {
                      const selectedDay = Number(nuevoClienteForm.getFieldValue("cumple_dia") || 0);
                      const maxDays = getDaysInMonth(monthValue);
                      if (selectedDay > maxDays) {
                        nuevoClienteForm.setFieldValue("cumple_dia", undefined);
                      }
                      if (monthValue) {
                        setTimeout(() => setCumpleDiaPickerOpen(true), 0);
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item shouldUpdate noStyle>
                  {() => {
                    const selectedMonth = Number(nuevoClienteForm.getFieldValue("cumple_mes") || 0);
                    const maxDays = getDaysInMonth(selectedMonth);

                    return (
                      <Form.Item
                        name="cumple_dia"
                        noStyle={false}
                        rules={[{ required: true, message: "Selecciona el día" }]}
                        getValueProps={(value) => ({
                          value: (selectedMonth && value)
                            ? dayjs(`2000-${String(selectedMonth).padStart(2, "0")}-${String(value).padStart(2, "0")}`, "YYYY-MM-DD", true)
                            : null,
                        })}
                        getValueFromEvent={(date: dayjs.Dayjs | null) => (date ? date.date() : undefined)}
                      >
                        <DatePicker
                          placeholder="Día"
                          picker="date"
                          format="DD"
                          inputReadOnly
                          allowClear
                          style={{ width: "100%" }}
                          open={cumpleDiaPickerOpen && !!selectedMonth}
                          onOpenChange={setCumpleDiaPickerOpen}
                          onChange={() => setCumpleDiaPickerOpen(false)}
                          defaultPickerValue={selectedMonth ? dayjs(`2000-${String(selectedMonth).padStart(2, "0")}-01`, "YYYY-MM-DD", true) : undefined}
                          disabledDate={(current) => {
                            if (!selectedMonth || !current) return true;
                            return current.month() + 1 !== selectedMonth;
                          }}
                          disabled={!selectedMonth}
                        />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>
            </Row>
          </Form.Item>
          <Form.Item
            name="codigo_referido"
            label={<Space size={4}><span>¿La refirió alguien?</span><span style={{ color: "#888", fontWeight: 400, fontSize: 12 }}>(opcional)</span></Space>}
          >
            <Input
              placeholder="COSM-XXXXXXXX"
              style={{ textTransform: "uppercase", letterSpacing: 1 }}
              onChange={e => {
                const v = e.target.value.toUpperCase();
                nuevoClienteForm.setFieldValue("codigo_referido", v);
              }}
              suffix={<span style={{ color: "#aaa", fontSize: 11 }}>+300 pts a quien refirió</span>}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
