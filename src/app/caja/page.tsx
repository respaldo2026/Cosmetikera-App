"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Card,
  Row,
  Col,
  Button,
  Form,
  Select,
  Input,
  Table,
  Space,
  Tag,
  Typography,
  Divider,
  Statistic,
  Radio,
  InputNumber,
  Spin,
  Alert,
  Switch,
  List,
  Popconfirm,
  Modal,
} from "antd";
import {
  DollarOutlined,
  PrinterOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  CalculatorOutlined,
  CreditCardOutlined,
  BankOutlined,
  WalletOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { abrirCajon, imprimirTicketTermico } from "@utils/pos-hardware";
import { useCurrentUser } from "@hooks/useCurrentUser";
import { useRolePermissions } from "@hooks/useRolePermissions";

let ticketUtilsPromise: Promise<typeof import("@utils/pago-ticket")> | null = null;
let ticketStoragePromise: Promise<typeof import("@utils/ticket-storage")> | null = null;
let movimientosServicePromise: Promise<typeof import("@modules/finanzas/movimientos.service")> | null = null;
const VENTAS_APARCADAS_STORAGE_KEY = "pos_ventas_aparcadas_v1";
const MAX_VENTAS_APARCADAS = 20;

const loadTicketUtils = () => {
  if (!ticketUtilsPromise) {
    ticketUtilsPromise = import("@utils/pago-ticket");
  }
  return ticketUtilsPromise;
};

const loadTicketStorage = () => {
  if (!ticketStoragePromise) {
    ticketStoragePromise = import("@utils/ticket-storage");
  }
  return ticketStoragePromise;
};

const loadMovimientosService = () => {
  if (!movimientosServicePromise) {
    movimientosServicePromise = import("@modules/finanzas/movimientos.service");
  }
  return movimientosServicePromise;
};

const { Title, Text } = Typography;

const BILLETES_CAJA = [100000, 50000, 20000, 10000, 5000, 2000] as const;
const MONEDAS_CAJA = [1000, 500, 200, 100, 50] as const;

type Denominacion = (typeof BILLETES_CAJA)[number] | (typeof MONEDAS_CAJA)[number];

interface TurnoCaja {
  id: string;
  estado: "abierto" | "cerrado";
  opened_at: string;
  closed_at?: string | null;
  base_apertura: number;
  producido_efectivo: number;
  efectivo_esperado: number;
  efectivo_contado: number;
  descuadre: number;
  billetes?: Record<string, number>;
  monedas?: Record<string, number>;
  notas_apertura?: string | null;
  notas_cierre?: string | null;
}

interface ResumenCaja {
  base_apertura: number;
  produccion_efectivo: number;
  efectivo_esperado: number;
  efectivo_contado?: number;
  descuadre?: number;
}

interface EstadoCajaResponse {
  currentTurno: TurnoCaja | null;
  lastClosedTurno?: TurnoCaja | null;
  suggestedOpeningBase?: number;
  resumen?: ResumenCaja | null;
  error?: string;
}

interface ResponsableCaja {
  id: string;
  nombre_completo: string;
  rol?: string | null;
  email?: string | null;
}

const crearMapaDenominaciones = (denominaciones: readonly Denominacion[]) =>
  denominaciones.reduce<Record<string, number>>((acc, denominacion) => {
    acc[String(denominacion)] = 0;
    return acc;
  }, {});

const sumarMapaDenominaciones = (counts: Record<string, number>) =>
  Object.entries(counts).reduce((acc, [denominacion, cantidad]) => {
    const value = Number(denominacion);
    return acc + (Number.isFinite(value) ? value * Number(cantidad || 0) : 0);
  }, 0);

type MetodoPago = "efectivo" | "transferencia" | "tarjeta" | "nequi" | "sistecredito" | "qr";

interface ClientePerfil {
  id: string;
  nombre_completo: string;
  telefono?: string;
  email?: string;
  notif_whatsapp?: boolean | null;
}

interface Matricula {
  id: string;
  curso_nombre: string;
  fecha_inicio?: string | null;
  numero_cuotas?: number | null;
  curso_numero_cuotas?: number | null;
  duracion?: string | number | null;
  programa_duracion?: string | number | null;
  precio_mensualidad?: number | null;
  programa_precio_mensualidad?: number | null;
}

interface Cuota {
  id: string;
  monto: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  periodo_pagado: string;
  estado: string;
  matricula_id?: string;
  es_virtual?: boolean;
}

interface VentaAparcada {
  id: string;
  creadoEn: string;
  clienteId: string | null;
  clienteNombre: string;
  totalAproximado: number;
  cuotas: Array<{
    id: string;
    matricula_id?: string;
    numero_cuota?: number;
  }>;
  formValues: {
    metodo_pago?: MetodoPago;
    observaciones?: string;
    referencia?: string;
    imprimir_ticket: boolean;
  };
  valorEntregado: number | null;
}

const formatCurrency = (value?: number | null) => {
  if (!value) return "$0";
  return `$${Number(value).toLocaleString("es-CO")}`;
};

const parseDuracionMeses = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  const text = String(value ?? "").trim();
  if (!text) return 0;

  const match = text.match(/\d+/);
  return match ? Math.max(0, Number(match[0])) : 0;
};

const calcularFechaVencimientoCuota = (fechaInicio: string | null | undefined, numeroCuota: number) => {
  if (!fechaInicio || !numeroCuota || numeroCuota < 1) return "";
  const base = dayjs(fechaInicio);
  if (!base.isValid()) return "";
  return base.add(numeroCuota, "month").format("YYYY-MM-DD");
};

// Función para generar número de factura secuencial (1000-9999)
const generarNumeroFactura = (): string => {
  const min = 1000;
  const max = 9999;
  const numero = Math.floor(Math.random() * (max - min + 1)) + min;
  return numero.toString();
};

const metodoPagoIcons: Record<MetodoPago, React.ReactNode> = {
  efectivo: <DollarOutlined />,
  transferencia: <BankOutlined />,
  tarjeta: <CreditCardOutlined />,
  nequi: <QrcodeOutlined />,
  sistecredito: <QrcodeOutlined />,
  qr: <QrcodeOutlined />,
};

const metodoPagoLabels: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  nequi: "Nequi",
  sistecredito: "Sistecredito",
  qr: "Código QR",
};

export default function CajaPage() {
  const posPrintMode = (process.env.NEXT_PUBLIC_POS_PRINT_MODE ?? "auto").toLowerCase();
  const usaAgenteLocal = posPrintMode === "agent" || posPrintMode === "auto";
  const permiteCajon = usaAgenteLocal;
  const permiteImpresionSilenciosa = usaAgenteLocal;
  const { message: messageApi } = App.useApp();
  const { user } = useCurrentUser();
  const { tienePermiso } = useRolePermissions();
  const [form] = Form.useForm();
  const [formApertura] = Form.useForm();
  const [formCierre] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<ClientePerfil[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClientePerfil | null>(null);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [cuotasSeleccionadas, setCuotasSeleccionadas] = useState<string[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [configuracion, setConfiguracion] = useState<any>(null);
  const [valorEntregado, setValorEntregado] = useState<number | null>(null);
  const [mediosPago, setMediosPago] = useState<any[]>([]);
  const [ventasAparcadas, setVentasAparcadas] = useState<VentaAparcada[]>([]);
  const [restaurandoVentaId, setRestaurandoVentaId] = useState<string | null>(null);
  const [filtroVentasAparcadas, setFiltroVentasAparcadas] = useState("");
  const [turnoCaja, setTurnoCaja] = useState<TurnoCaja | null>(null);
  const [resumenCaja, setResumenCaja] = useState<ResumenCaja | null>(null);
  const [ultimoCierreCaja, setUltimoCierreCaja] = useState<TurnoCaja | null>(null);
  const [baseSugeridaApertura, setBaseSugeridaApertura] = useState(0);
  const [cargandoCaja, setCargandoCaja] = useState(false);
  const [guardandoCaja, setGuardandoCaja] = useState(false);
  const [aperturaVisible, setAperturaVisible] = useState(false);
  const [contadorAperturaVisible, setContadorAperturaVisible] = useState(false);
  const [cierreVisible, setCierreVisible] = useState(false);
  const [conteoCierreFinalizado, setConteoCierreFinalizado] = useState(false);
  const [billetesContados, setBilletesContados] = useState<Record<string, number>>(crearMapaDenominaciones(BILLETES_CAJA));
  const [monedasContadas, setMonedasContadas] = useState<Record<string, number>>(crearMapaDenominaciones(MONEDAS_CAJA));
  const [billetesApertura, setBilletesApertura] = useState<Record<string, number>>(crearMapaDenominaciones(BILLETES_CAJA));
  const [monedasApertura, setMonedasApertura] = useState<Record<string, number>>(crearMapaDenominaciones(MONEDAS_CAJA));
  const [responsablesCaja, setResponsablesCaja] = useState<ResponsableCaja[]>([]);

  const puedeAbrirCaja = user?.rol === "administrador" || tienePermiso(user?.rol, "caja_abrir");
  const puedeCerrarCaja = user?.rol === "administrador" || tienePermiso(user?.rol, "caja_cerrar");

  const totalAPagar = useMemo(
    () =>
      cuotas
        .filter((c) => cuotasSeleccionadas.includes(c.id))
        .reduce((acc, c) => acc + Number(c.monto), 0),
    [cuotas, cuotasSeleccionadas]
  );

  const cambio = useMemo(() => {
    if (!valorEntregado || valorEntregado < totalAPagar) return 0;
    return valorEntregado - totalAPagar;
  }, [valorEntregado, totalAPagar]);

  const ventasAparcadasFiltradas = useMemo(() => {
    const filtro = filtroVentasAparcadas.trim().toLowerCase();
    if (!filtro) return ventasAparcadas;
    return ventasAparcadas.filter((venta) => venta.clienteNombre.toLowerCase().includes(filtro));
  }, [ventasAparcadas, filtroVentasAparcadas]);

  const persistirVentasAparcadas = useCallback((ventas: VentaAparcada[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VENTAS_APARCADAS_STORAGE_KEY, JSON.stringify(ventas));
  }, []);

  const cargarClientes = useCallback(async () => {
    try {
      const response = await fetch("/api/perfiles?rol=cliente");
      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status} cargando clientes`);
      }
      const json = await response.json();
      setClientes(json.data || []);
    } catch (error) {
      console.error("Error cargando clientes:", error);
      messageApi.error("No se pudieron cargar los clientes");
    }
  }, [messageApi]);

  const cargarConfiguracion = useCallback(async () => {
    try {
      const { data, error } = await supabaseBrowserClient
        .from("configuracion")
        .select("*")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setConfiguracion(data);
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    }
  }, []);

  const cargarMediosPago = useCallback(async () => {
    try {
      const { data, error } = await supabaseBrowserClient
        .from("medios_pago")
        .select("*")
        .eq("activo", true)
        .order("orden", { ascending: true });

      if (!error && data) {
        const lista = Array.isArray(data) ? [...data] : [];
        const existeSistecredito = lista.some(
          (medio) => String(medio?.codigo || "").trim().toLowerCase() === "sistecredito"
        );

        if (!existeSistecredito) {
          lista.push({
            id: "fallback-sistecredito",
            nombre: "SisteCredito",
            codigo: "sistecredito",
            activo: true,
            orden: 999,
          });
        }

        lista.sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0));
        setMediosPago(lista);
      }
    } catch (error) {
      console.error("Error cargando métodos de pago:", error);
    }
  }, []);

  const cargarResponsablesCaja = useCallback(async () => {
    try {
      const { data, error } = await supabaseBrowserClient
        .from("perfiles")
        .select("id,nombre_completo,rol,email")
        .eq("activo", true)
        .in("rol", ["administrador", "admin", "director", "administrativo", "vendedor", "marketing"])
        .order("nombre_completo");

      if (error) throw error;
      setResponsablesCaja((data || []) as ResponsableCaja[]);
    } catch (error) {
      console.error("Error cargando responsables de caja:", error);
      setResponsablesCaja([]);
    }
  }, []);

  useEffect(() => {
    cargarClientes();
    cargarConfiguracion();
    cargarMediosPago();
    cargarResponsablesCaja();
  }, [cargarClientes, cargarConfiguracion, cargarMediosPago]);

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
      console.error("Error leyendo ventas aparcadas:", error);
    }
  }, []);

  const cargarTurnoCaja = useCallback(async () => {
    try {
      setCargandoCaja(true);
      const response = await fetch("/api/caja/turnos");
      const payload = await response.json() as EstadoCajaResponse;
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo cargar la caja");
      }

      setTurnoCaja(payload.currentTurno || null);
      setResumenCaja(payload.resumen || null);
      setUltimoCierreCaja(payload.lastClosedTurno || null);
      setBaseSugeridaApertura(Number(payload.suggestedOpeningBase || 0));
    } catch (error: any) {
      console.error("Error cargando turno de caja:", error);
      setTurnoCaja(null);
      setResumenCaja(null);
      setUltimoCierreCaja(null);
      setBaseSugeridaApertura(0);
    } finally {
      setCargandoCaja(false);
    }
  }, []);

  useEffect(() => {
    void cargarTurnoCaja();
  }, [cargarTurnoCaja, user?.id]);

  const totalBilletesContados = useMemo(() => sumarMapaDenominaciones(billetesContados), [billetesContados]);
  const totalMonedasContadas = useMemo(() => sumarMapaDenominaciones(monedasContadas), [monedasContadas]);
  const totalAperturaContado = useMemo(
    () => sumarMapaDenominaciones(billetesApertura) + sumarMapaDenominaciones(monedasApertura),
    [billetesApertura, monedasApertura],
  );
  const totalContadoCaja = totalBilletesContados + totalMonedasContadas;
  const efectivoEsperadoCaja = Number(resumenCaja?.efectivo_esperado ?? turnoCaja?.efectivo_esperado ?? 0);
  const produccionCaja = Number(resumenCaja?.produccion_efectivo ?? turnoCaja?.producido_efectivo ?? 0);
  const baseCaja = Number(resumenCaja?.base_apertura ?? turnoCaja?.base_apertura ?? 0);
  const descuadreCaja = totalContadoCaja - efectivoEsperadoCaja;

  const abrirModalApertura = () => {
    setBilletesApertura(crearMapaDenominaciones(BILLETES_CAJA));
    setMonedasApertura(crearMapaDenominaciones(MONEDAS_CAJA));
    formApertura.setFieldsValue({
      base_apertura: baseSugeridaApertura,
      notas_apertura: ultimoCierreCaja?.closed_at
        ? `Base sugerida tomada del cierre anterior (${dayjs(ultimoCierreCaja.closed_at).format("DD/MM/YYYY HH:mm")})`
        : "",
      opened_by: user?.id || undefined,
    });
    setAperturaVisible(true);
  };

  const aplicarContadorApertura = useCallback(() => {
    formApertura.setFieldValue("base_apertura", totalAperturaContado);
    setContadorAperturaVisible(false);
  }, [formApertura, totalAperturaContado]);

  const abrirModalCierre = async () => {
    if (permiteCajon) {
      await abrirCajon().catch((error) => console.warn("[Caja] No se pudo abrir cajón antes del cierre:", error));
    }

    await cargarTurnoCaja();
    setConteoCierreFinalizado(false);
    setBilletesContados(crearMapaDenominaciones(BILLETES_CAJA));
    setMonedasContadas(crearMapaDenominaciones(MONEDAS_CAJA));
    formCierre.setFieldsValue({ notas_cierre: "" });
    setCierreVisible(true);
  };

  const confirmarAperturaCaja = async () => {
    try {
      setGuardandoCaja(true);
      const values = await formApertura.validateFields();
      const response = await fetch("/api/caja/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          base_apertura: values.base_apertura,
          notas_apertura: values.notas_apertura,
          opened_by: values.opened_by,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo abrir la caja");
      }

      setTurnoCaja(payload.currentTurno || null);
      setResumenCaja(payload.resumen || null);
      setAperturaVisible(false);
      messageApi.success("Caja abierta correctamente");

      if (permiteCajon) {
        await abrirCajon();
      }
    } catch (error: any) {
      messageApi.error(error?.message || "No se pudo abrir la caja");
    } finally {
      setGuardandoCaja(false);
    }
  };

  const confirmarCierreCaja = async () => {
    try {
      setGuardandoCaja(true);
      const values = await formCierre.validateFields();
      const response = await fetch("/api/caja/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          billetes: billetesContados,
          monedas: monedasContadas,
          notas_cierre: values.notas_cierre,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo cerrar la caja");
      }

      const turnoCerrado = payload.turnoCerrado || null;
      const baseSugerida = Number(payload?.resumen?.efectivo_contado ?? turnoCerrado?.efectivo_contado ?? 0);

      setTurnoCaja(null);
      setResumenCaja(null);
      setUltimoCierreCaja(turnoCerrado);
      setBaseSugeridaApertura(baseSugerida);
      setCierreVisible(false);
      setConteoCierreFinalizado(false);
      setBilletesApertura(crearMapaDenominaciones(BILLETES_CAJA));
      setMonedasApertura(crearMapaDenominaciones(MONEDAS_CAJA));
      formApertura.setFieldsValue({
        base_apertura: baseSugerida,
        notas_apertura: turnoCerrado?.closed_at
          ? `Base sugerida tomada del cierre anterior (${dayjs(turnoCerrado.closed_at).format("DD/MM/YYYY HH:mm")})`
          : "",
        opened_by: undefined,
      });
      setAperturaVisible(true);
      messageApi.success(
        `Cierre realizado. Cuadre: ${formatCurrency(payload?.resumen?.descuadre || 0)}`
      );
    } catch (error: any) {
      messageApi.error(error?.message || "No se pudo cerrar la caja");
    } finally {
      setGuardandoCaja(false);
    }
  };

  // Generar número de factura cuando se selecciona una cuota
  useEffect(() => {
    if (cuotasSeleccionadas.length > 0) {
      const numeroFactura = generarNumeroFactura();
      form.setFieldsValue({ referencia: `FAC-${numeroFactura}` });
    }
  }, [cuotasSeleccionadas, form]);

  const handleClienteChange = useCallback(
    async (clienteId: string | null) => {
      let cuotasCargadas: Cuota[] = [];
      setLoading(true);
      try {
        const cliente = clienteId ? clientes.find((e) => e.id === clienteId) : undefined;
        setClienteSeleccionado(cliente || null);

        if (!clienteId) {
          setMatriculas([]);
          setCuotas([]);
          setCuotasSeleccionadas([]);
          return [];
        }

        // Cargar matrículas del cliente
        const { data: matriculasData, error: matriculasError } = await supabaseBrowserClient
          .from("matriculas")
          .select("id, fecha_inicio, cursos ( nombre, numero_cuotas, duracion, precio_mensualidad, programas ( duracion, precio_mensualidad ) )")
          .eq("estudiante_id", clienteId)
          .eq("estado", "activo");

        if (matriculasError) throw matriculasError;

        const matriculasFormat = (matriculasData || []).map((m: any) => ({
          id: m.id,
          curso_nombre: m.cursos?.nombre || "Sin nombre",
          fecha_inicio: m.fecha_inicio || null,
          curso_numero_cuotas: m.cursos?.numero_cuotas ?? null,
          duracion: m.cursos?.duracion ?? null,
          programa_duracion: m.cursos?.programas?.duracion ?? null,
          precio_mensualidad: m.cursos?.precio_mensualidad ?? null,
          programa_precio_mensualidad: m.cursos?.programas?.precio_mensualidad ?? null,
        }));

        setMatriculas(matriculasFormat);

        // Cargar cuotas pendientes
        const matriculaIds = matriculasFormat.map((m) => m.id);
        if (matriculaIds.length > 0) {
          const { data: planCuotasData, error: planCuotasError } = await supabaseBrowserClient
            .from("pagos")
            .select("matricula_id, numero_cuota")
            .in("matricula_id", matriculaIds);

          if (planCuotasError) throw planCuotasError;

          const resumenPlanPorMatricula = new Map<string, { maxNumero: number; tieneInscripcion: boolean }>();
          const cuotasRegistradasPorMatricula = new Map<string, Set<number>>();
          (planCuotasData || []).forEach((row: any) => {
            const matriculaId = String(row?.matricula_id || "");
            if (!matriculaId) return;

            const numero = Number(row?.numero_cuota);
            if (!Number.isFinite(numero)) return;

            const actual = resumenPlanPorMatricula.get(matriculaId) || { maxNumero: 0, tieneInscripcion: false };
            actual.maxNumero = Math.max(actual.maxNumero, numero);
            if (numero === 0) actual.tieneInscripcion = true;
            resumenPlanPorMatricula.set(matriculaId, actual);

            if (numero > 0) {
              const existentes = cuotasRegistradasPorMatricula.get(matriculaId) || new Set<number>();
              existentes.add(numero);
              cuotasRegistradasPorMatricula.set(matriculaId, existentes);
            }
          });

          const totalCuotasEsperadasPorMatricula = new Map<string, number>();
          matriculasFormat.forEach((m) => {
            const totalEsperado =
              parseDuracionMeses(m.programa_duracion) ||
              parseDuracionMeses(m.duracion) ||
              parseDuracionMeses(m.curso_numero_cuotas);

            if (totalEsperado > 0) {
              totalCuotasEsperadasPorMatricula.set(m.id, totalEsperado);
            }
          });

          const { data: cuotasData, error: cuotasError } = await supabaseBrowserClient
            .from("pagos")
            .select("id, monto, numero_cuota, fecha_vencimiento, periodo_pagado, estado, matricula_id")
            .in("matricula_id", matriculaIds)
            .order("fecha_vencimiento");

          if (cuotasError) throw cuotasError;

          const cuotasPagadasPorMatricula = new Map<string, Set<number>>();
          (cuotasData || []).forEach((cuota: any) => {
            const matriculaId = String(cuota?.matricula_id || "");
            const numero = Number(cuota?.numero_cuota);
            if (!matriculaId || !Number.isFinite(numero) || numero <= 0) return;

            const existentes = cuotasRegistradasPorMatricula.get(matriculaId) || new Set<number>();
            existentes.add(numero);
            cuotasRegistradasPorMatricula.set(matriculaId, existentes);

            const estadoNormalizado = String(cuota?.estado || "").trim().toLowerCase();
            if (estadoNormalizado === "pagado") {
              const actuales = cuotasPagadasPorMatricula.get(matriculaId) || new Set<number>();
              actuales.add(numero);
              cuotasPagadasPorMatricula.set(matriculaId, actuales);
            }
          });

          const cuotasFiltradas = (cuotasData || []).filter((cuota: any) => {
            const estadoNormalizado = String(cuota?.estado || "").trim().toLowerCase();
            return estadoNormalizado !== "cancelado";
          });

          const cuotasNormalizadas = cuotasFiltradas.map((cuota: any) => {
            const matriculaId = String(cuota?.matricula_id || "");
            const resumen = resumenPlanPorMatricula.get(matriculaId);
            const numero = Number(cuota?.numero_cuota);

            if (!resumen || !Number.isFinite(numero) || numero <= 0) {
              return cuota;
            }

            const totalCalculado = resumen.tieneInscripcion
              ? Math.max(1, resumen.maxNumero + 1)
              : Math.max(1, resumen.maxNumero);

            const totalEsperado = totalCuotasEsperadasPorMatricula.get(matriculaId) || 0;
            const total = Math.max(totalCalculado, totalEsperado, numero);

            const periodoActual = String(cuota?.periodo_pagado || "");
            const pareceEtiquetaCuota = /cuota/i.test(periodoActual) || !periodoActual;

            if (!pareceEtiquetaCuota) {
              return cuota;
            }

            return {
              ...cuota,
              periodo_pagado: `Cuota ${numero} de ${total}`,
            };
          });

          const cuotasNormalizadasDedupe = new Map<string, Cuota>();
          cuotasNormalizadas.forEach((cuota) => {
            const matriculaId = String(cuota?.matricula_id || "");
            const numero = Number(cuota?.numero_cuota || 0);
            const key = `${matriculaId}:${numero}`;
            const actual = cuotasNormalizadasDedupe.get(key);
            if (!actual) {
              cuotasNormalizadasDedupe.set(key, cuota);
              return;
            }

            const estadoActual = String(actual?.estado || "").trim().toLowerCase();
            const estadoNuevo = String(cuota?.estado || "").trim().toLowerCase();
            if (estadoActual === "pagado") {
              return;
            }

            if (estadoNuevo === "pagado") {
              cuotasNormalizadasDedupe.set(key, cuota);
              return;
            }

            if (estadoActual !== "vencido" && estadoNuevo === "vencido") {
              cuotasNormalizadasDedupe.set(key, cuota);
            }
          });

          const cuotasNormalizadasFinal = Array.from(cuotasNormalizadasDedupe.values());

          const cuotasPendientesRegistradas = new Map<string, Set<number>>();
          cuotasNormalizadasFinal.forEach((cuota) => {
            const matriculaId = String(cuota?.matricula_id || "");
            const numero = Number(cuota?.numero_cuota);
            if (!matriculaId || !Number.isFinite(numero) || numero <= 0) return;
            const existentes = cuotasPendientesRegistradas.get(matriculaId) || new Set<number>();
            existentes.add(numero);
            cuotasPendientesRegistradas.set(matriculaId, existentes);
          });

          const cuotasVirtuales: Cuota[] = [];
          matriculasFormat.forEach((matricula) => {
            const totalEsperado = totalCuotasEsperadasPorMatricula.get(matricula.id) || 0;
            if (totalEsperado <= 0) return;

            const cuotasRegistradas = cuotasRegistradasPorMatricula.get(matricula.id) || new Set<number>();
            const cuotasPendientesSet = cuotasPendientesRegistradas.get(matricula.id) || new Set<number>();
            const montoBase =
              Number(matricula.precio_mensualidad || 0) ||
              Number(matricula.programa_precio_mensualidad || 0) ||
              Number(
                cuotasNormalizadasFinal.find((q) => q.matricula_id === matricula.id && Number(q.numero_cuota) > 0)?.monto || 0
              );

            for (let i = 1; i <= totalEsperado; i += 1) {
              if (cuotasRegistradas.has(i) || cuotasPendientesSet.has(i)) continue;

              cuotasVirtuales.push({
                id: `virtual-${matricula.id}-${i}`,
                monto: montoBase,
                numero_cuota: i,
                fecha_vencimiento: calcularFechaVencimientoCuota(matricula.fecha_inicio, i),
                periodo_pagado: `Cuota ${i} de ${totalEsperado}`,
                estado: "pendiente",
                matricula_id: matricula.id,
                es_virtual: true,
              });
            }
          });

          const cuotasConVirtuales = [...cuotasNormalizadasFinal, ...cuotasVirtuales].sort((a, b) => {
            const fechaA = a.fecha_vencimiento ? dayjs(a.fecha_vencimiento) : null;
            const fechaB = b.fecha_vencimiento ? dayjs(b.fecha_vencimiento) : null;

            if (fechaA && fechaB && !fechaA.isSame(fechaB, "day")) {
              return fechaA.valueOf() - fechaB.valueOf();
            }
            if (fechaA && !fechaB) return -1;
            if (!fechaA && fechaB) return 1;

            return Number(a.numero_cuota || 0) - Number(b.numero_cuota || 0);
          });

          const cuotasDedupe = new Map<string, Cuota>();
          cuotasConVirtuales.forEach((cuota) => {
            const matriculaId = String(cuota?.matricula_id || "");
            const numero = Number(cuota?.numero_cuota || 0);
            const key = `${matriculaId}:${numero}`;
            const actual = cuotasDedupe.get(key);

            if (!actual) {
              cuotasDedupe.set(key, cuota);
              return;
            }

            const estadoActual = String(actual?.estado || "").trim().toLowerCase();
            const estadoNuevo = String(cuota?.estado || "").trim().toLowerCase();

            if (estadoActual === "pagado") {
              return;
            }

            if (estadoNuevo === "pagado") {
              cuotasDedupe.set(key, cuota);
              return;
            }

            if (actual.es_virtual && !cuota.es_virtual) {
              cuotasDedupe.set(key, cuota);
            }
          });

          cuotasCargadas = Array.from(cuotasDedupe.values());
          setCuotas(cuotasCargadas);
        } else {
          cuotasCargadas = [];
          setCuotas([]);
        }

        setCuotasSeleccionadas([]);
        form.setFieldsValue({ matricula_id: undefined });
      } catch (error) {
        console.error("Error cargando datos del cliente:", error);
        messageApi.error("Error al cargar datos del cliente");
        return [];
      } finally {
        setLoading(false);
      }

      return cuotasCargadas;
    },
    [clientes, form, messageApi]
  );

  const limpiarVentaActual = useCallback(() => {
    form.resetFields();
    form.setFieldValue("imprimir_ticket", true);
    setCuotasSeleccionadas([]);
    setClienteSeleccionado(null);
    setMatriculas([]);
    setCuotas([]);
    setValorEntregado(null);
  }, [form]);

  const aparcarVentaActual = useCallback(() => {
    if (cuotasSeleccionadas.length === 0) {
      messageApi.warning("Seleccione al menos una cuota para aparcar la venta");
      return;
    }

    const values = form.getFieldsValue();
    const cuotasAPagar = cuotas.filter((c) => cuotasSeleccionadas.includes(c.id));
    const ventaAparcada: VentaAparcada = {
      id: `venta-${Date.now()}`,
      creadoEn: dayjs().toISOString(),
      clienteId: clienteSeleccionado?.id || null,
      clienteNombre: clienteSeleccionado?.nombre_completo || "Cliente sin asignar",
      totalAproximado: cuotasAPagar.reduce((acc, cuota) => acc + Number(cuota.monto || 0), 0),
      cuotas: cuotasAPagar.map((cuota) => ({
        id: cuota.id,
        matricula_id: cuota.matricula_id,
        numero_cuota: cuota.numero_cuota,
      })),
      formValues: {
        metodo_pago: values.metodo_pago as MetodoPago | undefined,
        observaciones: values.observaciones || "",
        referencia: values.referencia || "",
        imprimir_ticket: values.imprimir_ticket !== false,
      },
      valorEntregado,
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
      messageApi.warning(`Solo se permiten ${MAX_VENTAS_APARCADAS} ventas aparcadas. Reanude o elimine una para continuar.`);
      return;
    }

    limpiarVentaActual();
    messageApi.success("Venta aparcada. Puede atender otra operación.");
  }, [clienteSeleccionado, cuotasSeleccionadas, form, cuotas, valorEntregado, persistirVentasAparcadas, limpiarVentaActual, messageApi]);

  const eliminarVentaAparcada = useCallback(
    (ventaId: string) => {
      setVentasAparcadas((prev) => {
        const next = prev.filter((venta) => venta.id !== ventaId);
        persistirVentasAparcadas(next);
        return next;
      });
      messageApi.success("Venta aparcada eliminada");
    },
    [messageApi, persistirVentasAparcadas]
  );

  const restaurarVentaAparcada = useCallback(
    async (venta: VentaAparcada) => {
      setRestaurandoVentaId(venta.id);
      try {
        form.setFieldValue("estudiante_id", venta.clienteId);
        const cuotasDisponibles = await handleClienteChange(venta.clienteId);

        const cuotasSeleccionables = new Set(cuotasDisponibles.map((cuota) => cuota.id));
        let idsSeleccionados = venta.cuotas
          .map((item) => item.id)
          .filter((id) => cuotasSeleccionables.has(id));

        if (idsSeleccionados.length === 0) {
          idsSeleccionados = cuotasDisponibles
            .filter((cuota) =>
              venta.cuotas.some(
                (item) =>
                  String(item.matricula_id || "") === String(cuota.matricula_id || "") &&
                  Number(item.numero_cuota || 0) === Number(cuota.numero_cuota || 0)
              )
            )
            .map((cuota) => cuota.id);
        }

        setCuotasSeleccionadas(idsSeleccionados);
        form.setFieldsValue({
          metodo_pago: venta.formValues.metodo_pago,
          observaciones: venta.formValues.observaciones,
          referencia: venta.formValues.referencia,
          imprimir_ticket: venta.formValues.imprimir_ticket,
        });
        setValorEntregado(venta.valorEntregado);

        setVentasAparcadas((prev) => {
          const next = prev.filter((item) => item.id !== venta.id);
          persistirVentasAparcadas(next);
          return next;
        });

        messageApi.success("Venta restaurada al carrito");
      } catch (error) {
        console.error("Error restaurando venta aparcada:", error);
        messageApi.error("No se pudo restaurar la venta aparcada");
      } finally {
        setRestaurandoVentaId(null);
      }
    },
    [form, handleClienteChange, messageApi, persistirVentasAparcadas]
  );

  const handleRegistrarPago = useCallback(async () => {
    if (cuotasSeleccionadas.length === 0) {
      messageApi.warning("Debe seleccionar al menos una cuota");
      return;
    }

    try {
      await form.validateFields();
    } catch {
      messageApi.warning("Complete todos los campos requeridos");
      return;
    }

    const values = form.getFieldsValue();
    
    // Validar que metodo_pago esté definido
    if (!values.metodo_pago) {
      messageApi.warning("Seleccione un método de pago");
      return;
    }

    setProcesando(true);

    try {
      const cuotasAPagar = cuotas.filter((c) => cuotasSeleccionadas.includes(c.id));
      const pagosActualizados = [];
      const metodoPago = values.metodo_pago as MetodoPago;
      const referenciaPago = values.referencia || `FAC-${generarNumeroFactura()}`;
      const imprimirTicket = values.imprimir_ticket !== false;
      const ticketPlaceholder = imprimirTicket && !permiteImpresionSilenciosa ? window.open("", "_blank") : null;
      const { registrarIngresoDesdePago } = await loadMovimientosService();

      // Actualizar cada cuota seleccionada
      for (const cuota of cuotasAPagar) {
        const payloadPago = {
          estado: "pagado",
          metodo_pago: (values.metodo_pago as string).toLowerCase(),
          fecha_pago: dayjs().toISOString(),
          referencia: referenciaPago,
          estudiante_id: clienteSeleccionado?.id || null,
          observaciones: values.observaciones || null,
        };

        const { data: pagoActualizado, error: updateError } = cuota.es_virtual
          ? await supabaseBrowserClient
              .from("pagos")
              .insert({
                ...payloadPago,
                matricula_id: cuota.matricula_id || null,
                monto: Number(cuota.monto || 0),
                numero_cuota: Number(cuota.numero_cuota || 0),
                fecha_vencimiento: cuota.fecha_vencimiento || null,
                periodo_pagado: cuota.periodo_pagado || `Cuota ${cuota.numero_cuota ?? ""}`.trim(),
              })
              .select()
              .single()
          : await supabaseBrowserClient
              .from("pagos")
              .update(payloadPago)
              .eq("id", cuota.id)
              .select()
              .single();

        if (updateError) throw updateError;
        pagosActualizados.push(pagoActualizado);

        // Registrar movimiento financiero
        try {
          await registrarIngresoDesdePago({
            fecha: dayjs().format("YYYY-MM-DD"),
            monto: pagoActualizado.monto,
            concepto: `Pago de ${cuota.periodo_pagado || `cuota ${cuota.numero_cuota}`}`,
            categoria: "inscripciones",
            metodo_pago: pagoActualizado.metodo_pago,
            referencia: pagoActualizado.referencia,
            descripcion: pagoActualizado.observaciones,
            estudiante_id: pagoActualizado.estudiante_id,
            ticket_url: null,
            pago_id: pagoActualizado.id,
            created_by: null,
          });
        } catch (movError) {
          console.error("Error registrando movimiento financiero:", movError);
        }
      }

      if (imprimirTicket) {
        try {
          // Generar ticket
          const { data: configActual } = await supabaseBrowserClient
            .from("configuracion")
            .select("*")
            .order("updated_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

          const configTicket = configActual || configuracion;

          const ticketData = {
            academia: {
              nombre: configTicket?.nombre_academia || "La Cosmetikera",
              ruc: configTicket?.ruc || undefined,
              logoUrl: configTicket?.logo_url || undefined,
              telefono: configTicket?.telefono || "",
              direccion: configTicket?.direccion || "",
              email: configTicket?.email || "",
              ticketTitulo: configTicket?.ticket_titulo || "RECIBO DE PAGO",
              ticketNota: configTicket?.ticket_nota || "",
              ticketPie: configTicket?.ticket_pie || "Gracias por su pago",
              ticketCampos: configTicket?.ticket_campos || undefined,
            },
            estudiante: {
              nombre: clienteSeleccionado?.nombre_completo || "",
              telefono: clienteSeleccionado?.telefono || "",
            },
            pago: {
              monto: totalAPagar,
              metodo: metodoPagoLabels[metodoPago],
              fecha: dayjs().format("DD/MM/YYYY HH:mm"),
              referencia: referenciaPago,
              concepto: cuotasAPagar.map((c) => c.periodo_pagado || `Cuota ${c.numero_cuota ?? ""}`.trim()).join(", "),
              numeroCuota: cuotasAPagar.length === 1 ? cuotasAPagar[0]?.numero_cuota : undefined,
              periodo: cuotasAPagar.map((c) => c.periodo_pagado).join(", "),
              valorEntregado: valorEntregado || undefined,
              cambio: cambio || undefined,
            },
          };

          // Generar y abrir ticket sin bloquear el registro del pago si falla la impresión
          const { generarTicketPagoBlob, abrirTicketPagoDesdeBlob, imprimirTicketPagoDesdeBlob } = await loadTicketUtils();
          const blob = await generarTicketPagoBlob(ticketData);

          let impresoPorPOS = false;
          if (permiteImpresionSilenciosa) {
            const ticketTermico = {
              nombreTienda: configTicket?.nombre_academia || "La Cosmetikera",
              nit: configTicket?.ruc || undefined,
              direccion: configTicket?.direccion || undefined,
              telefono: configTicket?.telefono || undefined,
              numeroVenta: referenciaPago,
              fecha: dayjs().format("DD/MM/YYYY HH:mm"),
              cliente: clienteSeleccionado?.nombre_completo || undefined,
              metodoPago: metodoPagoLabels[metodoPago],
              cambio: values.metodo_pago === "efectivo" ? (cambio || undefined) : undefined,
              nota: values.observaciones || undefined,
              pie: configTicket?.ticket_pie || "Gracias por su pago",
              lineas: [
                { tipo: "titulo" as const, texto: configTicket?.ticket_titulo || "RECIBO DE PAGO" },
                { tipo: "linea" as const },
                ...cuotasAPagar.map((c) => ({
                  tipo: "item" as const,
                  descripcion: c.periodo_pagado || `Cuota ${c.numero_cuota ?? ""}`.trim(),
                  cantidad: 1,
                  precio: Number(c.monto || 0),
                })),
                { tipo: "linea" as const },
                { tipo: "total" as const, etiqueta: "TOTAL", valor: totalAPagar },
              ],
            };

            const resultPOS = await imprimirTicketTermico(ticketTermico, undefined, undefined, { allowBrowserFallback: false });
            impresoPorPOS = resultPOS.ok;
            if (!resultPOS.ok) {
              console.warn("[Caja] Impresión POS no disponible, usando respaldo PDF:", resultPOS.error ?? "sin detalle");
            }
          }

          if (!impresoPorPOS) {
            const fallbackWindow = ticketPlaceholder ?? window.open("", "_blank");
            if (fallbackWindow) {
              await imprimirTicketPagoDesdeBlob(blob, fallbackWindow);
            } else {
              try {
                abrirTicketPagoDesdeBlob(blob);
              } catch {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `Recibo_${referenciaPago}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
                messageApi.warning("No fue posible abrir impresión directa. Se descargó el PDF del ticket.");
              }
            }
          }

          // Subir ticket a storage y asociarlo a todos los pagos del lote
          if (pagosActualizados.length > 0) {
            try {
              const { subirTicketPago } = await loadTicketStorage();
              const { publicUrl } = await subirTicketPago({
                blob,
                pagoId: pagosActualizados[0].id,
                estudianteId: clienteSeleccionado?.id,
              });

              const pagoIds = pagosActualizados.map((p) => p.id);

              // Actualizar URL del ticket en todos los pagos del lote
              await supabaseBrowserClient
                .from("pagos")
                .update({ ticket_url: publicUrl })
                .in("id", pagoIds);

              // Actualizar URL del ticket en movimientos financieros asociados
              await supabaseBrowserClient
                .from("movimientos_financieros")
                .update({ ticket_url: publicUrl })
                .in("pago_id", pagoIds);
            } catch (storageError) {
              console.error("Error guardando ticket:", storageError);
            }
          }
        } catch (printError) {
          console.error("Error generando/imprimiendo ticket:", printError);
          if (ticketPlaceholder && !ticketPlaceholder.closed) {
            ticketPlaceholder.close();
          }
          messageApi.warning("El pago quedó registrado, pero no se pudo imprimir el ticket. Intenta imprimirlo desde historial.");
        }
      }

      // Abrir cajón registrador si es efectivo
      if (values.metodo_pago === "efectivo") {
        abrirCajonRegistrador();
      }

      if (clienteSeleccionado?.telefono && (clienteSeleccionado?.notif_whatsapp ?? true)) {
        try {
          const { enviarConfirmacionPago } = await import("@/services/whatsapp-messages-module");

          const cursosPago = cuotasAPagar
            .map((cuota) => matriculas.find((m) => String(m.id) === String((cuota as any).matricula_id))?.curso_nombre)
            .filter(Boolean) as string[];
          const cursosUnicos = Array.from(new Set(cursosPago));

          const nombreCursoWhatsapp =
            cursosUnicos.length === 0
              ? "Servicio"
              : cursosUnicos.length === 1
              ? (cursosUnicos[0] ?? "Servicio")
              : "Varios servicios";

          const conceptoPago = cuotasAPagar
            .map((cuota) => cuota.periodo_pagado || `Cuota ${cuota.numero_cuota ?? ""}`.trim())
            .filter(Boolean)
            .join(", ");

          await enviarConfirmacionPago(clienteSeleccionado.id, {
            nombre: clienteSeleccionado.nombre_completo,
            telefono: clienteSeleccionado.telefono,
            referenciaPago,
            monto: totalAPagar,
            fechaPago: dayjs().format("DD/MM/YYYY"),
            concepto: conceptoPago,
            nombreCurso: nombreCursoWhatsapp,
            fechaVigencia: dayjs().add(1, "month").format("DD/MM/YYYY"),
            fechaProximaClase: "Por confirmar",
          });
        } catch (whatsappError) {
          console.error("Error enviando confirmación de pago por WhatsApp desde Caja:", whatsappError);
        }
      }

      messageApi.success(
        `Pago registrado exitosamente. Total: ${formatCurrency(totalAPagar)}${imprimirTicket ? "" : " (sin impresión)"}`
      );

      void cargarTurnoCaja();
      
      // Limpiar formulario y recargar datos
      limpiarVentaActual();
      
    } catch (error) {
      console.error("Error registrando pago:", error);
      messageApi.error("Error al registrar el pago");
    } finally {
      setProcesando(false);
    }
  }, [
    cuotasSeleccionadas,
    cuotas,
    form,
    messageApi,
    clienteSeleccionado,
    totalAPagar,
    configuracion,
    valorEntregado,
    cambio,
    limpiarVentaActual,
    permiteImpresionSilenciosa,
    cargarTurnoCaja,
  ]);

  const abrirCajonRegistrador = () => {
    if (!permiteCajon) return;
    abrirCajon().then((result) => {
      if (!result.ok) {
        console.warn("[Caja] No se pudo abrir cajón:", result.error);
      }
    });
  };

  const cuotasColumns = [
    {
      title: "Cuota",
      dataIndex: "numero_cuota",
      key: "numero_cuota",
      render: (val: number) => `#${val}`,
    },
    {
      title: "Período",
      dataIndex: "periodo_pagado",
      key: "periodo_pagado",
    },
    {
      title: "Monto",
      dataIndex: "monto",
      key: "monto",
      render: (val: number) => formatCurrency(val),
    },
    {
      title: "Vencimiento",
      dataIndex: "fecha_vencimiento",
      key: "fecha_vencimiento",
      render: (val: string) => dayjs(val).format("DD/MM/YYYY"),
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (estado: string) => {
        const estadoNormalizado = String(estado || "").trim().toLowerCase();
        const esVencido = estadoNormalizado === "vencido";
        const esPagado = estadoNormalizado === "pagado";

        return (
          <Tag color={esPagado ? "green" : esVencido ? "red" : "orange"}>
            {esPagado ? "Pagado" : esVencido ? "Vencido" : "Pendiente"}
          </Tag>
        );
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys: cuotasSeleccionadas,
    onChange: (selectedKeys: React.Key[]) => {
      setCuotasSeleccionadas(selectedKeys as string[]);
    },
    getCheckboxProps: (record: Cuota) => {
      const estadoNormalizado = String(record?.estado || "").trim().toLowerCase();
      return {
        disabled: estadoNormalizado === "pagado" || estadoNormalizado === "cancelado",
      };
    },
  };

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      <Card
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          marginBottom: 24,
          border: "none",
        }}
      >
        <Space align="center" size="large">
          <ShoppingCartOutlined style={{ fontSize: 48, color: "#fff" }} />
          <div>
            <Title level={2} style={{ color: "#fff", margin: 0 }}>
              Caja - Punto de Venta
            </Title>
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 16 }}>
              Registro de cobros y pagos de clientes
            </Text>
          </div>
        </Space>
      </Card>

      <Alert
        style={{ marginBottom: 24 }}
        type={turnoCaja ? "success" : "warning"}
        showIcon
        message={turnoCaja ? "Caja abierta" : "Caja cerrada"}
        description={
          turnoCaja
            ? `Base ${formatCurrency(baseCaja)} · Esperado ${formatCurrency(efectivoEsperadoCaja)} · Cierra con el botón de cierre de caja.`
            : "Antes de vender debes abrir la caja. Usa el botón Abrir caja para registrar base y responsable."
        }
        action={
          <Space>
            {turnoCaja ? (
              <Button danger type="primary" onClick={abrirModalCierre} disabled={!puedeCerrarCaja}>
                Cerrar caja
              </Button>
            ) : (
              <Button type="primary" onClick={abrirModalApertura} disabled={!puedeAbrirCaja}>
                Abrir caja
              </Button>
            )}
          </Space>
        }
      />

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} lg={16}>
            <Space direction="vertical" size={4} style={{ width: "100%" }}>
              <Title level={4} style={{ margin: 0 }}>
                Apertura y cierre de caja
              </Title>
              <Text type="secondary">
                Controla la base, el efectivo producido y el cuadre final antes de cerrar la jornada.
              </Text>

              {turnoCaja ? (
                <Space wrap>
                  <Tag color="green">Caja abierta</Tag>
                  <Tag>Base: {formatCurrency(baseCaja)}</Tag>
                  <Tag>Producido: {formatCurrency(produccionCaja)}</Tag>
                  <Tag>Esperado: {formatCurrency(efectivoEsperadoCaja)}</Tag>
                </Space>
              ) : (
                <Tag color="red">Caja cerrada</Tag>
              )}

              {!puedeAbrirCaja && !puedeCerrarCaja && (
                <Alert
                  type="warning"
                  showIcon
                  message="No tienes permisos para abrir o cerrar caja"
                  description="Pide a un administrador que active caja_abrir y caja_cerrar en Permisos por Rol."
                />
              )}
            </Space>
          </Col>

          <Col xs={24} lg={8}>
            {turnoCaja ? (
              <Button
                type="primary"
                danger
                size="large"
                block
                icon={<CheckCircleOutlined />}
                onClick={abrirModalCierre}
                disabled={!puedeCerrarCaja}
              >
                Realizar cierre de caja
              </Button>
            ) : (
              <Button
                type="primary"
                size="large"
                block
                icon={<DollarOutlined />}
                onClick={abrirModalApertura}
                disabled={!puedeAbrirCaja}
              >
                Abrir caja
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      <Row gutter={24}>
        <Col xs={24} lg={14}>
          <Card title="Información del cliente" style={{ marginBottom: 24 }}>
            <Form form={form} layout="vertical">
              <Form.Item
                name="estudiante_id"
                label="Cliente"
                rules={[{ required: true, message: "Seleccione un cliente" }]}
              >
                <Select
                  showSearch
                  placeholder="Buscar cliente..."
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  options={clientes.map((e) => ({ label: e.nombre_completo, value: e.id }))}
                  onChange={handleClienteChange}
                  size="large"
                />
              </Form.Item>

              {clienteSeleccionado && (
                <Alert
                  message={`Cliente: ${clienteSeleccionado.nombre_completo}`}
                  description={
                    <div>
                      {clienteSeleccionado.telefono && <div>Teléfono: {clienteSeleccionado.telefono}</div>}
                      {clienteSeleccionado.email && <div>Email: {clienteSeleccionado.email}</div>}
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}
            </Form>
          </Card>

          {loading ? (
            <Card>
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin size="large" />
              </div>
            </Card>
          ) : (
            cuotas.length > 0 && (
              <Card title="Cobros pendientes" style={{ marginBottom: 24 }}>
                <Table
                  rowSelection={rowSelection}
                  columns={cuotasColumns}
                  dataSource={cuotas}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </Card>
            )
          )}
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title="Resumen de cobro"
            style={{
              marginBottom: 24,
              position: "sticky",
              top: 24,
            }}
          >
            <Statistic
              title="Total a cobrar"
              value={totalAPagar}
              precision={0}
              prefix="$"
              valueStyle={{ color: "#3f8600", fontSize: 36, fontWeight: "bold" }}
              suffix="COP"
            />

            <Divider style={{ margin: "12px 0" }} />

            <Form form={form} layout="vertical">
              {/* Valor entregado y cambio - Al inicio para fácil acceso */}
              <Form.Item label="Valor entregado por el cliente">
                <InputNumber
                  placeholder="$0"
                  formatter={(value) => `$${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(value) => Number(value?.replace(/\$/g, "").replace(/,/g, ""))}
                  value={valorEntregado}
                  onChange={(value) => setValorEntregado(value)}
                  size="large"
                  style={{ width: "100%" }}
                  min={0}
                />
              </Form.Item>

              {valorEntregado && valorEntregado >= totalAPagar && (
                <div style={{ 
                  padding: "12px", 
                  backgroundColor: "#f0f5ff", 
                  borderRadius: "4px", 
                  marginBottom: "16px",
                  border: "1px solid #b3d9ff"
                }}>
                  <div style={{ marginBottom: "8px" }}>
                    <Text>Valor entregado: <strong>{formatCurrency(valorEntregado)}</strong></Text>
                  </div>
                  <div>
                    <Text style={{ color: "#3f8600", fontSize: "16px", fontWeight: "bold" }}>
                      Cambio: {formatCurrency(cambio)}
                    </Text>
                  </div>
                </div>
              )}

              <Divider style={{ margin: "12px 0" }} />

              <Form.Item
                name="metodo_pago"
                label="Método de Pago"
                rules={[{ required: true, message: "Seleccione método de pago" }]}
                initialValue={mediosPago[0]?.codigo || "efectivo"}
              >
                <Radio.Group buttonStyle="solid" style={{ width: "100%" }}>
                  <Row gutter={[6, 6]}>
                    {mediosPago.map((medio) => {
                      const codigoKey = medio.codigo as MetodoPago;
                      const icono = metodoPagoIcons[codigoKey] || <WalletOutlined />;
                      
                      return (
                        <Col key={medio.codigo} xs={12} sm={8} md={12}>
                          <Radio.Button
                            value={medio.codigo}
                            style={{ width: "100%", height: "auto", padding: "6px 8px", textAlign: "center" }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <span style={{ fontSize: 14 }}>{icono}</span>
                              <span style={{ fontSize: 11 }}>{medio.nombre}</span>
                            </div>
                          </Radio.Button>
                        </Col>
                      );
                    })}
                  </Row>
                </Radio.Group>
              </Form.Item>

              <Form.Item 
                name="referencia" 
                label="Comprobante / Factura"
                rules={[{ required: true, message: "Campo requerido" }]}
              >
                <Input 
                  placeholder="Generado automáticamente" 
                  size="large"
                  disabled
                />
              </Form.Item>

              <Form.Item name="observaciones" label="Observaciones">
                <Input.TextArea rows={2} placeholder="Notas adicionales..." />
              </Form.Item>

              <Form.Item
                name="imprimir_ticket"
                label="Imprimir ticket"
                valuePropName="checked"
                initialValue={true}
                tooltip="Active si desea generar e imprimir ticket al registrar el cobro"
              >
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>

              <Divider />

              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<CheckCircleOutlined />}
                  onClick={handleRegistrarPago}
                  loading={procesando}
                  disabled={cuotasSeleccionadas.length === 0}
                  style={{
                    height: 56,
                    fontSize: 18,
                    fontWeight: "bold",
                  }}
                >
                  Registrar cobro
                </Button>

                <Button
                  size="large"
                  block
                  disabled={cuotasSeleccionadas.length === 0}
                  onClick={aparcarVentaActual}
                  style={{
                    height: 48,
                    fontWeight: 600,
                  }}
                >
                  Aparcar venta
                </Button>

                <Button
                  size="large"
                  block
                  icon={<PrinterOutlined />}
                  disabled={cuotasSeleccionadas.length === 0}
                  onClick={async () => {
                    const values = form.getFieldsValue();
                    if (!clienteSeleccionado || !values.metodo_pago) {
                      messageApi.warning("Complete la información para imprimir");
                      return;
                    }

                    const cuotasAPagar = cuotas.filter((c) => cuotasSeleccionadas.includes(c.id));
                    const metodoPago = values.metodo_pago as MetodoPago;

                    const { data: configActual } = await supabaseBrowserClient
                      .from("configuracion")
                      .select("*")
                      .order("updated_at", { ascending: false, nullsFirst: false })
                      .order("created_at", { ascending: false, nullsFirst: false })
                      .limit(1)
                      .maybeSingle();

                    const configTicket = configActual || configuracion;
                    
                    const ticketData = {
                      academia: {
                        nombre: configTicket?.nombre_academia || "La Cosmetikera",
                        ruc: configTicket?.ruc || undefined,
                        logoUrl: configTicket?.logo_url || undefined,
                        telefono: configTicket?.telefono || "",
                        direccion: configTicket?.direccion || "",
                        email: configTicket?.email || "",
                        ticketTitulo: "PRE-RECIBO (NO VÁLIDO COMO COMPROBANTE)",
                        ticketNota: configTicket?.ticket_nota || "",
                        ticketPie: configTicket?.ticket_pie || "Gracias",
                        ticketCampos: configTicket?.ticket_campos || undefined,
                      },
                      estudiante: {
                        nombre: clienteSeleccionado.nombre_completo,
                        telefono: clienteSeleccionado.telefono || "",
                      },
                      pago: {
                        monto: totalAPagar,
                        metodo: metodoPagoLabels[metodoPago],
                        fecha: dayjs().format("DD/MM/YYYY HH:mm"),
                        referencia: values.referencia || `FAC-${generarNumeroFactura()}`,
                        concepto: cuotasAPagar.map((c) => c.periodo_pagado || `Cuota ${c.numero_cuota ?? ""}`.trim()).join(", "),
                        numeroCuota: cuotasAPagar.length === 1 ? cuotasAPagar[0]?.numero_cuota : undefined,
                        periodo: cuotasAPagar.map((c) => c.periodo_pagado).join(", "),
                        valorEntregado: valorEntregado || undefined,
                        cambio: cambio || undefined,
                      },
                    };

                    const { generarTicketPagoBlob, abrirTicketPagoDesdeBlob } = await loadTicketUtils();
                    const blob = await generarTicketPagoBlob(ticketData);
                    const placeholder = window.open("", "_blank");
                    if (placeholder) {
                      abrirTicketPagoDesdeBlob(blob, placeholder);
                    } else {
                      abrirTicketPagoDesdeBlob(blob);
                    }
                  }}
                >
                  Vista Previa
                </Button>

                {ventasAparcadas.length > 0 && (
                  <Card
                    size="small"
                    title={`Ventas aparcadas (${ventasAparcadas.length})`}
                    styles={{ body: { padding: 8 } }}
                  >
                    <Input.Search
                      allowClear
                      value={filtroVentasAparcadas}
                      onChange={(e) => setFiltroVentasAparcadas(e.target.value)}
                      placeholder="Buscar por cliente"
                      style={{ marginBottom: 8 }}
                    />
                    <List
                      size="small"
                      dataSource={ventasAparcadasFiltradas}
                      locale={{ emptyText: "No hay ventas que coincidan con la búsqueda" }}
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
                            title={venta.clienteNombre}
                            description={`${formatCurrency(venta.totalAproximado)} • ${dayjs(venta.creadoEn).format("DD/MM HH:mm")}`}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                )}
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Apertura de caja"
        open={aperturaVisible}
        onCancel={() => setAperturaVisible(false)}
        onOk={confirmarAperturaCaja}
        confirmLoading={guardandoCaja}
        okText="Abrir caja"
        cancelText="Cancelar"
        width={640}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Selecciona el responsable y verifica el valor a dejar en caja"
          description={`Al confirmar se registrará el turno y se abrirá el cajón si el dispositivo lo permite. Base sugerida del último cierre: ${formatCurrency(baseSugeridaApertura)}.`}
        />

        {ultimoCierreCaja?.closed_at ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Último cierre: ${dayjs(ultimoCierreCaja.closed_at).format("DD/MM/YYYY HH:mm")}`}
            description={`Valor contado en el cierre anterior: ${formatCurrency(ultimoCierreCaja.efectivo_contado)}. Usa el contador para verificar el dinero que dejas en caja.`}
          />
        ) : null}

        <Form form={formApertura} layout="vertical">
          <Form.Item
            label="Responsable de apertura"
            name="opened_by"
            rules={[{ required: true, message: "Selecciona quién abre la caja" }]}
          >
            <Select
              showSearch
              placeholder="Selecciona responsable"
              optionFilterProp="children"
              filterOption={(input, option) => String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
              options={responsablesCaja.map((resp) => ({
                value: resp.id,
                label: `${resp.nombre_completo}${resp.rol ? ` · ${resp.rol}` : ""}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Base inicial"
          >
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item name="base_apertura" noStyle rules={[{ required: true, message: "Ingresa la base inicial" }]}>
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  formatter={(value) => `$${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={((value: string | undefined) => Number(String(value ?? "").replace(/\$/g, "").replace(/,/g, ""))) as any}
                  placeholder="$0"
                />
              </Form.Item>
              <Button icon={<CalculatorOutlined />} onClick={() => setContadorAperturaVisible(true)}>
                Contador
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item label="Observaciones" name="notas_apertura">
            <Input.TextArea rows={3} placeholder="Ej: cambio inicial, observaciones del turno" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Contador de billetes y monedas"
        open={contadorAperturaVisible}
        onCancel={() => setContadorAperturaVisible(false)}
        onOk={aplicarContadorApertura}
        okText="Usar este total"
        cancelText="Cancelar"
        width={760}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Verifica el dinero a dejar en caja"
          description={`Referencia del cierre anterior: ${formatCurrency(baseSugeridaApertura)}.`}
        />

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card size="small" title="Billetes" styles={{ body: { padding: 12 } }}>
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                {BILLETES_CAJA.map((denominacion) => (
                  <Row key={`open-b-${denominacion}`} gutter={8} align="middle">
                    <Col flex="120px">
                      <Text>${denominacion.toLocaleString("es-CO")}</Text>
                    </Col>
                    <Col flex="auto">
                      <InputNumber
                        min={0}
                        value={billetesApertura[String(denominacion)]}
                        onChange={(value) =>
                          setBilletesApertura((prev) => ({ ...prev, [String(denominacion)]: Number(value || 0) }))
                        }
                        style={{ width: "100%" }}
                      />
                    </Col>
                  </Row>
                ))}
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title="Monedas" styles={{ body: { padding: 12 } }}>
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                {MONEDAS_CAJA.map((denominacion) => (
                  <Row key={`open-m-${denominacion}`} gutter={8} align="middle">
                    <Col flex="120px">
                      <Text>${denominacion.toLocaleString("es-CO")}</Text>
                    </Col>
                    <Col flex="auto">
                      <InputNumber
                        min={0}
                        value={monedasApertura[String(denominacion)]}
                        onChange={(value) =>
                          setMonedasApertura((prev) => ({ ...prev, [String(denominacion)]: Number(value || 0) }))
                        }
                        style={{ width: "100%" }}
                      />
                    </Col>
                  </Row>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>

        <Card size="small" style={{ marginTop: 12 }} styles={{ body: { padding: 12 } }}>
          <Row justify="space-between">
            <Text type="secondary">Total verificado</Text>
            <Text strong>{formatCurrency(totalAperturaContado)}</Text>
          </Row>
          <Row justify="space-between">
            <Text type="secondary">Referencia del último cierre</Text>
            <Text strong>{formatCurrency(baseSugeridaApertura)}</Text>
          </Row>
        </Card>
      </Modal>

      <Modal
        title="Cierre de caja"
        open={cierreVisible}
        onCancel={() => {
          setCierreVisible(false);
          setConteoCierreFinalizado(false);
        }}
        onOk={confirmarCierreCaja}
        footer={[
          <Button key="review" onClick={() => setConteoCierreFinalizado(true)} disabled={conteoCierreFinalizado}>
            {conteoCierreFinalizado ? "Conteo finalizado" : "Finalizar conteo"}
          </Button>,
          <Button key="cancel" onClick={() => {
            setCierreVisible(false);
            setConteoCierreFinalizado(false);
          }}>
            Cancelar
          </Button>,
          <Button key="ok" type="primary" danger onClick={confirmarCierreCaja} loading={guardandoCaja} disabled={!conteoCierreFinalizado}>
            Cerrar caja
          </Button>,
        ]}
        width={980}
      >
        <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 12 } }}>
          <Row justify="space-between">
            <Text type="secondary">Responsable del turno</Text>
            <Text strong>{responsablesCaja.find((resp) => resp.id === (turnoCaja as any)?.opened_by)?.nombre_completo || user?.email || "No asignado"}</Text>
          </Row>
          <Row justify="space-between">
            <Text type="secondary">Hora de apertura</Text>
            <Text strong>{turnoCaja?.opened_at ? dayjs(turnoCaja.opened_at).format("DD/MM/YYYY HH:mm") : "-"}</Text>
          </Row>
          <Row justify="space-between">
            <Text type="secondary">Hora estimada de cierre</Text>
            <Text strong>{dayjs().format("DD/MM/YYYY HH:mm")}</Text>
          </Row>
        </Card>

        {conteoCierreFinalizado ? (
          <>
            <Alert
              type={descuadreCaja === 0 ? "success" : "warning"}
              showIcon
              style={{ marginBottom: 16 }}
              message={
                descuadreCaja === 0
                  ? "Cuadre exacto"
                  : `${descuadreCaja > 0 ? "Sobra" : "Falta"} ${formatCurrency(Math.abs(descuadreCaja))}`
              }
              description={
                <span>
                  Base: {formatCurrency(baseCaja)} · Producido: {formatCurrency(produccionCaja)} · Esperado: {formatCurrency(efectivoEsperadoCaja)}
                </span>
              }
            />

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col xs={12} md={6}>
                <Statistic title="Base" value={baseCaja} precision={0} prefix="$" />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Producido" value={produccionCaja} precision={0} prefix="$" />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Esperado" value={efectivoEsperadoCaja} precision={0} prefix="$" />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Contado" value={totalContadoCaja} precision={0} prefix="$" />
              </Col>
            </Row>
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Paso 1: cuenta el dinero físico"
            description="Primero cuenta billetes y monedas. Luego pulsa 'Finalizar conteo' para que el sistema revele el esperado y puedas confirmar el cierre."
          />
        )}

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card size="small" title="Billetes" bordered={false} style={{ background: "#fafafa" }}>
              <Space direction="vertical" style={{ width: "100%" }} size={10}>
                {BILLETES_CAJA.map((denominacion) => {
                  const valor = billetesContados[String(denominacion)] || 0;
                  const subtotal = valor * denominacion;
                  return (
                    <Row key={denominacion} align="middle" gutter={8}>
                      <Col flex="auto">
                        <Text strong>${denominacion.toLocaleString("es-CO")}</Text>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          {valor} x {formatCurrency(denominacion)} = {formatCurrency(subtotal)}
                        </div>
                      </Col>
                      <Col>
                        <InputNumber
                          min={0}
                          value={valor}
                          onChange={(nextValue) => {
                            setConteoCierreFinalizado(false);
                            setBilletesContados((prev) => ({
                              ...prev,
                              [String(denominacion)]: Number(nextValue || 0),
                            }));
                          }}
                          style={{ width: 120 }}
                        />
                      </Col>
                    </Row>
                  );
                })}
              </Space>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card size="small" title="Monedas" bordered={false} style={{ background: "#fafafa" }}>
              <Space direction="vertical" style={{ width: "100%" }} size={10}>
                {MONEDAS_CAJA.map((denominacion) => {
                  const valor = monedasContadas[String(denominacion)] || 0;
                  const subtotal = valor * denominacion;
                  return (
                    <Row key={denominacion} align="middle" gutter={8}>
                      <Col flex="auto">
                        <Text strong>${denominacion.toLocaleString("es-CO")}</Text>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          {valor} x {formatCurrency(denominacion)} = {formatCurrency(subtotal)}
                        </div>
                      </Col>
                      <Col>
                        <InputNumber
                          min={0}
                          value={valor}
                          onChange={(nextValue) => {
                            setConteoCierreFinalizado(false);
                            setMonedasContadas((prev) => ({
                              ...prev,
                              [String(denominacion)]: Number(nextValue || 0),
                            }));
                          }}
                          style={{ width: 120 }}
                        />
                      </Col>
                    </Row>
                  );
                })}
              </Space>
            </Card>
          </Col>
        </Row>

        <Divider />

        <Form form={formCierre} layout="vertical">
          <Form.Item label="Observaciones del cierre" name="notas_cierre">
            <Input.TextArea rows={3} placeholder="Ej: sobrante, faltante, incidencias del turno" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
