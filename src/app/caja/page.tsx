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
} from "antd";
import {
  DollarOutlined,
  PrinterOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  CreditCardOutlined,
  BankOutlined,
  WalletOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { abrirCajon, imprimirTicketTermico } from "@utils/pos-hardware";

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
  const [form] = Form.useForm();

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
      const { data, error } = await supabaseBrowserClient
        .from("perfiles")
        .select("id, nombre_completo, telefono, email, notif_whatsapp")
        .eq("rol", "cliente")
        .eq("activo", true)
        .order("nombre_completo");

      if (error) throw error;
      setClientes(data || []);
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

  useEffect(() => {
    cargarClientes();
    cargarConfiguracion();
    cargarMediosPago();
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
    </div>
  );
}
