"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App,
  Alert,
  Card,
  Row,
  Col,
  Button,
  Checkbox,
  List,
  Spin,
  Space,
  Tag,
  Typography,
  Empty,
  Tooltip,
  Divider,
  Statistic,
  Tabs,
  Timeline,
  Badge,
  Drawer,
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  theme,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  WhatsAppOutlined,
  CalendarOutlined,
  TeamOutlined,
  CreditCardOutlined,
  InfoCircleOutlined,
  ShoppingCartOutlined,
  BookOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/es";
import localizedFormat from "dayjs/plugin/localizedFormat";
import { useRouter } from "next/navigation";
import { construirNombreGrupo } from "@utils/grupos";
import { enviarWhatsapp } from "@utils/whatsapp";
import { procesarPlantilla, construirRedesSociales } from "@utils/plantillas-whatsapp";
import {
  getProgramasResumen,
  getCursosSecretaria,
  getPagosPendientes,
  getLeadsPendientes,
  getEstudiantesActivos,
} from "../secretaria.api";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { abrirTicketPagoDesdeBlob, generarTicketPagoBlob } from "@utils/pago-ticket";
import { subirTicketPago } from "@utils/ticket-storage";
import { registrarIngresoDesdePago } from "@modules/finanzas/movimientos.service";

dayjs.locale("es");
dayjs.extend(localizedFormat);

const { Title, Text } = Typography;

const estadoLeadColor: Record<string, string> = {
  nuevo: "blue",
  contactado: "gold",
  en_seguimiento: "cyan",
};

const canalColor: Record<string, string> = {
  Instagram: "magenta",
  WhatsApp: "green",
  Facebook: "blue",
  Referencia: "purple",
  Evento: "volcano",
  Web: "geekblue",
  Otro: "default",
};

const formatFecha = (value?: string | null) => {
  if (!value) return "Sin fecha";
  return dayjs(value).format("DD MMM YYYY");
};

const formatHorario = (inicio?: string | null, fin?: string | null) => {
  if (!inicio && !fin) return "Horario por definir";
  const inicioFmt = inicio ? dayjs(inicio, "HH:mm:ss").format("hh:mm A") : "";
  const finFmt = fin ? dayjs(fin, "HH:mm:ss").format("hh:mm A") : "";
  if (inicioFmt && finFmt) return `${inicioFmt} - ${finFmt}`;
  return inicioFmt || finFmt || "Horario por definir";
};

const formatDias = (value?: string | null) => {
  if (!value) return "Días por definir";
  return value
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((dia) => dia.charAt(0).toUpperCase() + dia.slice(1))
    .join(" · ");
};

const formatCurrency = (value?: number | null) => {
  if (!value) return "$0";
  return `$${Number(value).toLocaleString("es-CO")}`;
};

type ConfiguracionAcademia = {
  nombre_academia?: string | null;
  ruc?: string | null;
  logo_url?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  ticket_titulo?: string | null;
  ticket_nota?: string | null;
  ticket_pie?: string | null;
  ticket_campos?: {
    logo?: boolean;
    nombreAcademia?: boolean;
    ruc?: boolean;
    direccion?: boolean;
    telefono?: boolean;
    email?: boolean;
    fecha?: boolean;
    concepto?: boolean;
    monto?: boolean;
    nota?: boolean;
    pie?: boolean;
    titulo?: boolean;
  } | null;
  instagram?: string | null;
  facebook?: string | null;
  youtube?: string | null;
};

export default function SecretariaDashboard() {
  const { message: messageApi } = App.useApp();
  const router = useRouter();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(true);
  const [programas, setProgramas] = useState<any[]>([]);
  const [cursosActivos, setCursosActivos] = useState<any[]>([]);
  const [cursosProximos, setCursosProximos] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [pagosPendientes, setPagosPendientes] = useState<any[]>([]);
  const [pagoDrawerOpen, setPagoDrawerOpen] = useState(false);
  const [estudiantesOptions, setEstudiantesOptions] = useState<{ label: string; value: string }[]>([]);
  const [estudiantesCargados, setEstudiantesCargados] = useState(false);
  const [cargandoEstudiantes, setCargandoEstudiantes] = useState(false);
  const [matriculasEstudiante, setMatriculasEstudiante] = useState<any[]>([]);
  const [cargandoMatriculas, setCargandoMatriculas] = useState(false);
  const [cuotasDisponibles, setCuotasDisponibles] = useState<any[]>([]);
  const [cargandoCuotas, setCargandoCuotas] = useState(false);
  const [registrandoPagos, setRegistrandoPagos] = useState(false);
  const [configuracion, setConfiguracion] = useState<ConfiguracionAcademia | null>(null);
  const [pagoForm] = Form.useForm();
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [programaWhatsapp, setProgramaWhatsapp] = useState<any | null>(null);
  const [whatsappForm] = Form.useForm();
  const programasRef = useRef<HTMLDivElement | null>(null);
  const cuotasSeleccionadas = Form.useWatch("cuotas", pagoForm) as string[] | undefined;
  const cuotasSeleccionadasIds = useMemo(
    () => cuotasSeleccionadas ?? [],
    [cuotasSeleccionadas]
  );
  const totalSeleccionado = useMemo(
    () =>
      cuotasDisponibles
        .filter((cuota) => cuotasSeleccionadasIds.includes(cuota.id))
        .reduce((acc, cuota) => acc + Number(cuota.monto || 0), 0),
    [cuotasDisponibles, cuotasSeleccionadasIds]
  );
  const matriculasOptions = useMemo(
    () =>
      matriculasEstudiante.map((matricula) => ({
        label: matricula.cursos?.nombre || "Curso sin nombre",
        value: matricula.id,
      })),
    [matriculasEstudiante]
  );

  const resumenFinanciero = useMemo(() => {
    const totalPendiente = pagosPendientes.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
    const vencidos = pagosPendientes.filter((pago) => {
      if (!pago.fecha_vencimiento) return false;
      return dayjs(pago.fecha_vencimiento).isBefore(dayjs(), "day");
    }).length;
    const proximosVencimientos = pagosPendientes.filter((pago) => {
      if (!pago.fecha_vencimiento) return false;
      const diff = dayjs(pago.fecha_vencimiento).diff(dayjs(), "day");
      return diff >= 0 && diff <= 7;
    }).length;
    return { totalPendiente, vencidos, proximosVencimientos };
  }, [pagosPendientes]);

  const leadsPrioritarios = useMemo(() => {
    const sinContacto = leads.filter((lead) => (lead.estado || "").toLowerCase() === "nuevo");
    const seguimiento = leads.filter((lead) => (lead.estado || "").toLowerCase() === "en_seguimiento");
    return { sinContacto, seguimiento };
  }, [leads]);

  const proximosDestacados = useMemo(() => cursosProximos.slice(0, 4), [cursosProximos]);

  const drawerStyles = useMemo(
    () => ({
      header: {
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorder}`,
      },
      body: {
        background: token.colorBgElevated ?? token.colorBgContainer,
      },
      content: {
        background: token.colorBgElevated ?? token.colorBgContainer,
        boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
      },
      mask: {
        backgroundColor: "rgba(15, 23, 42, 0.55)",
      },
    }),
    [token.colorBgContainer, token.colorBgElevated, token.colorBorder],
  );

  const cargarPanel = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar también la configuración
      await cargarConfiguracion();
      
      const [programasRes, cursosRes, leadsRes, pagosRes] = await Promise.all([
        getProgramasResumen(),
        getCursosSecretaria(),
        getLeadsPendientes(),
        getPagosPendientes(),
      ]);

      if (programasRes.error) messageApi.error("No se pudieron cargar los programas");
      if (cursosRes.error) messageApi.error("No se pudieron cargar los cursos");
      if (leadsRes.error) messageApi.error("No se pudieron cargar los leads");
      if (pagosRes.error) messageApi.error("No se pudieron cargar los pagos pendientes");

      setProgramas(programasRes.data || []);
      const cursosData = (cursosRes.data || []) as any[];
      setCursosActivos(cursosData.filter((curso) => (curso.estado || "").toLowerCase() === "activo"));
      setCursosProximos(cursosData.filter((curso) => (curso.estado || "").toLowerCase() === "proximo"));
      setLeads(leadsRes.data || []);
      setPagosPendientes(pagosRes.data || []);
    } catch (error) {
      console.error("Error cargando panel secretaría", error);
      messageApi.error("Ocurrió un error cargando la información");
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    cargarPanel();
  }, [cargarPanel]);

  const resumenCards = useMemo(
    () => [
      { key: "programas", label: "Programas activos", value: programas.length },
      { key: "activos", label: "Grupos activos", value: cursosActivos.length },
      { key: "proximos", label: "Próximos inicios", value: cursosProximos.length },
      { key: "leads", label: "Leads en seguimiento", value: leads.length },
      { key: "pagos", label: "Pagos pendientes", value: pagosPendientes.length },
    ],
    [programas.length, cursosActivos.length, cursosProximos.length, leads.length, pagosPendientes.length]
  );
  const buildProgramaResumen = (programa: any) => {
    let mensaje = "";

    // Bloque 1: Nombre del programa
    mensaje += `✨ ${programa.nombre}\n`;
    mensaje += `${"─".repeat(40)}\n\n`;

    // Bloque 2: Resumen del programa (descripción)
    if (programa.descripcion) {
      mensaje += `📝 RESUMEN\n`;
      mensaje += `${programa.descripcion}\n\n`;
    }

    // Bloque 3: Duración y estructura
    if (programa.duracion || programa.total_clases) {
      mensaje += `📅 ESTRUCTURA DEL PROGRAMA\n`;
      if (programa.duracion) {
        mensaje += `• Duración: ${programa.duracion}\n`;
      }
      if (programa.total_clases) {
        mensaje += `• Total de clases: ${programa.total_clases}\n`;
      }
      mensaje += `\n`;
    }

    // Bloque 4: Kit de productos
    mensaje += `📦 QUÉ INCLUYE\n`;
    mensaje += `• Kit completo de productos cada mes\n`;
    mensaje += `• Todos los materiales necesarios\n`;
    mensaje += `• Certificación al finalizar\n\n`;

    // Bloque 5: Precios
    if (
      programa.precio_inscripcion !== null &&
      programa.precio_inscripcion !== undefined &&
      programa.precio_inscripcion > 0
    ) {
      mensaje += `💰 INVERSIÓN\n`;
      if (programa.precio_inscripcion > 0) {
        mensaje += `• Inscripción: ${formatCurrency(programa.precio_inscripcion)}\n`;
      }
      if (
        programa.precio_mensualidad !== null &&
        programa.precio_mensualidad !== undefined &&
        programa.precio_mensualidad > 0
      ) {
        mensaje += `• Mensualidad: ${formatCurrency(programa.precio_mensualidad)}\n`;
      }
      mensaje += `\n`;
    } else if (
      programa.precio_mensualidad !== null &&
      programa.precio_mensualidad !== undefined &&
      programa.precio_mensualidad > 0
    ) {
      mensaje += `💰 INVERSIÓN\n`;
      mensaje += `• Mensualidad: ${formatCurrency(programa.precio_mensualidad)}\n\n`;
    }

    return mensaje.trim();
  };

  const buildMensajeWhatsappCompleto = async (programa: any, nombreCliente: string, configActual?: ConfiguracionAcademia) => {
    // Usar la configuración pasada o la del estado
    const config = configActual || configuracion;
    
    // Intentar cargar la plantilla desde la base de datos
    const { data: plantillaData } = await supabaseBrowserClient
      .from("plantillas_whatsapp")
      .select("plantilla")
      .eq("tipo", "programa")
      .eq("activa", true)
      .limit(1)
      .maybeSingle();
    
    // Construir redes sociales
    const redesSociales = construirRedesSociales(config?.instagram, config?.facebook, config?.youtube);
    
    // Variables para reemplazar en la plantilla
    const variables = {
      nombre: nombreCliente,
      nombre_academia: config?.nombre_academia || "CRYSTAL DIAMANTE",
      redes_sociales: redesSociales,
      telefono: config?.telefono || "",
      email: config?.email || "",
      programa_nombre: programa.nombre || "",
      programa_descripcion: programa.descripcion || "",
      programa_duracion: programa.duracion || "",
      programa_clases: programa.total_clases || "",
      programa_inscripcion: formatCurrency(programa.precio_inscripcion) || "Consultar",
      programa_mensualidad: formatCurrency(programa.precio_mensualidad) || "Consultar",
    };

    // Plantilla por defecto si no se carga desde BD
    const plantillaDefecto = `👋 ¡Hola {nombre}!

📱 SÍGUENOS EN REDES
{redes_sociales}

✨ ACADEMIA {nombre_academia}
Formamos profesionales en belleza y estética.

📝 {programa_nombre}
{programa_descripcion}

📅 ESTRUCTURA DEL PROGRAMA
• Duración: {programa_duracion}
• Total de clases: {programa_clases}

📦 QUÉ INCLUYE
• Kit completo de productos cada mes
• Todos los materiales necesarios
• Certificación al finalizar

💰 INVERSIÓN
• Inscripción: {programa_inscripcion}
• Mensualidad: {programa_mensualidad}

¿Deseas más información? 💬

📱 {telefono}
📧 {email}

¡Te esperamos! 🎉
💾 Agréganos a contactos para ver nuestros estados`;

    // Usar la plantilla de BD o la por defecto
    const plantillaAUsar = plantillaData?.plantilla || plantillaDefecto;

    // Procesar plantilla con las variables
    const mensaje = procesarPlantilla(plantillaAUsar, variables);
    
    console.log("[WhatsApp] Mensaje procesado desde plantilla:", plantillaData ? "BD" : "Por defecto");
    return mensaje;
  };

  const normalizePhone = (value?: string | null) => (value || "").replace(/\D+/g, "");

  const abrirWhatsappPrograma = async (programa: any) => {
    setProgramaWhatsapp(programa);
    whatsappForm.resetFields();
    // Recargar configuración para asegurar que tenemos los datos más recientes
    await cargarConfiguracion();
    setWhatsappOpen(true);
  };

  const enviarWhatsAppPrograma = async () => {
    if (!programaWhatsapp) return;
    try {
      // Obtener configuración fresca directamente de la base de datos
      const { data: configFresca, error: configError } = await supabaseBrowserClient
        .from("configuracion")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (configError) {
        console.error("[WhatsApp] Error cargando configuración:", configError);
      }

      const configParaUsar = configFresca || configuracion;
      
      console.log("[WhatsApp] ===== CONFIG FRESCA PARA MENSAJE =====");
      console.log("[WhatsApp] TODOS los campos:", configFresca);
      console.log("[WhatsApp] Instagram:", configParaUsar?.instagram);
      console.log("[WhatsApp] Facebook:", configParaUsar?.facebook);
      console.log("[WhatsApp] Teléfono:", configParaUsar?.telefono);
      console.log("[WhatsApp] WhatsApp:", configParaUsar?.whatsapp);
      console.log("[WhatsApp] Nombre academia:", configParaUsar?.nombre_academia);
      console.log("[WhatsApp] ==========================================");

      const values = await whatsappForm.validateFields();
      const telefono = normalizePhone(values.telefono);
      if (!telefono) {
        messageApi.error("Ingresa un teléfono válido");
        return;
      }

      const payload = {
        nombre: values.nombre,
        telefono,
        email: values.email || null,
        interes: programaWhatsapp.nombre || null,
        canal: "WhatsApp",
        notas: values.notas || `Interesado en ${programaWhatsapp.nombre} (secretaría)`,
        estado: "nuevo",
        created_at: new Date().toISOString(),
      };

      const { data: existing } = await supabaseBrowserClient
        .from("leads")
        .select("id")
        .eq("telefono", telefono)
        .maybeSingle();

      if (!existing) {
        console.log("[WHATSAPP] Creando lead con datos:", {
          p_nombre: payload.nombre,
          p_telefono: payload.telefono,
          p_email: payload.email,
          p_interes: payload.interes,
          p_canal: payload.canal,
          p_notas: payload.notas,
          p_estado: payload.estado,
        });

        const { data, error } = await supabaseBrowserClient
          .rpc("crear_lead_seguro", {
            p_nombre: payload.nombre,
            p_telefono: payload.telefono,
            p_email: payload.email,
            p_interes: payload.interes,
            p_canal: payload.canal,
            p_notas: payload.notas,
            p_estado: payload.estado,
          })
          .maybeSingle();

        console.log("[WHATSAPP] Respuesta RPC:", { data, error });

        if (error) {
          console.error("[WHATSAPP] Error detallado:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          throw error;
        }
        if (data) setLeads((prev) => [data, ...prev]);
      } else {
        console.log("[WHATSAPP] Lead ya existe, no se crea duplicado");
      }

      // Construir mensaje con la configuración fresca (ahora es async)
      const resumen = await buildMensajeWhatsappCompleto(programaWhatsapp, values.nombre, configParaUsar as ConfiguracionAcademia);
      console.log("[WhatsApp] Mensaje construido:", resumen.substring(0, 200) + "...");
      
      enviarWhatsapp(telefono, resumen);
      setWhatsappOpen(false);
    } catch (error: any) {
      console.error("[WHATSAPP] Error enviando WhatsApp:", error);
      messageApi.error(error?.message || "No se pudo enviar el mensaje");
    }
  };

  const handleCopyPrograma = async (programa: any) => {
    const resumen = buildProgramaResumen(programa);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(resumen);
        messageApi.success("Resumen copiado al portapapeles");
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = resumen;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        messageApi.success("Resumen copiado al portapapeles");
      }
    } catch (error) {
      console.error("Error copiando resumen", error);
      messageApi.error("No se pudo copiar el resumen");
    }
  };

  const abrirMatricula = useCallback(
    (cursoId?: string) => {
      const search = cursoId ? `?cursoId=${encodeURIComponent(cursoId)}` : "";
      router.push(`/matriculas/create${search}`);
    },
    [router]
  );

  const cargarEstudiantes = useCallback(async () => {
    if (estudiantesCargados || cargandoEstudiantes) return;
    setCargandoEstudiantes(true);
    try {
      const { data, error } = await getEstudiantesActivos();
      if (error) {
        messageApi.error("No se pudieron cargar los estudiantes");
        return;
      }
      const opciones = (data || []).map((estudiante: any) => ({
        label: estudiante.nombre_completo,
        value: estudiante.id,
      }));
      setEstudiantesOptions(opciones);
      setEstudiantesCargados(true);
    } catch (error) {
      console.error("Error cargando estudiantes activos", error);
      messageApi.error("No se pudieron cargar los estudiantes");
    } finally {
      setCargandoEstudiantes(false);
    }
  }, [cargandoEstudiantes, estudiantesCargados, messageApi]);

  const prepararDrawer = useCallback(() => {
    pagoForm.resetFields();
    pagoForm.setFieldsValue({
      estudiante_id: undefined,
      matricula_id: undefined,
      cuotas: [],
      metodo_pago: "efectivo",
      fecha_pago: dayjs(),
      referencia: undefined,
      observaciones: undefined,
    });
    setMatriculasEstudiante([]);
    setCuotasDisponibles([]);
  }, [pagoForm]);

  const cargarConfiguracion = useCallback(async () => {
    try {
      const { data, error } = await supabaseBrowserClient
        .from("configuracion")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        console.log("[Secretaria] ===== CONFIGURACIÓN COMPLETA DESDE BD =====");
        console.log("[Secretaria] TODOS LOS CAMPOS:", data);
        console.log("[Secretaria] Instagram específico:", data.instagram);
        console.log("[Secretaria] Facebook específico:", data.facebook);
        console.log("[Secretaria] Teléfono específico:", data.telefono);
        console.log("[Secretaria] WhatsApp específico:", data.whatsapp);
        console.log("[Secretaria] Email específico:", data.email);
        console.log("[Secretaria] ============================================");
        setConfiguracion(data as ConfiguracionAcademia);
      } else if (error) {
        console.error("[Secretaria] Error cargando configuración:", error);
      }
    } catch (error) {
      console.error("Error cargando la configuración de la academia", error);
    }
  }, []);

  const cargarCuotasPendientes = useCallback(
    async (matriculaId: string, options?: { preselectCuotaId?: string }) => {
      if (!matriculaId) return;
      setCargandoCuotas(true);
      try {
        const { data, error } = await supabaseBrowserClient
          .from("pagos")
          .select("id, monto, numero_cuota, fecha_vencimiento, periodo_pagado, estado")
          .eq("matricula_id", matriculaId)
          .in("estado", ["pendiente", "vencido"])
          .order("numero_cuota", { ascending: true, nullsFirst: true });

        if (error) {
          messageApi.error("No se pudieron cargar las cuotas");
          setCuotasDisponibles([]);
          return;
        }

        const cuotas = data || [];
        setCuotasDisponibles(cuotas);

        if (options?.preselectCuotaId && cuotas.some((cuota) => cuota.id === options.preselectCuotaId)) {
          pagoForm.setFieldsValue({ cuotas: [options.preselectCuotaId] });
        }
      } catch (error) {
        console.error("Error cargando cuotas pendientes", error);
        messageApi.error("No se pudieron cargar las cuotas");
        setCuotasDisponibles([]);
      } finally {
        setCargandoCuotas(false);
      }
    },
    [messageApi, pagoForm]
  );

  const handleMatriculaChange = useCallback(
    async (matriculaId?: string) => {
      pagoForm.setFieldsValue({ cuotas: [] });
      setCuotasDisponibles([]);
      if (!matriculaId) return;
      await cargarCuotasPendientes(matriculaId);
    },
    [cargarCuotasPendientes, pagoForm]
  );

  const handleEstudianteChange = useCallback(
    async (
      estudianteId?: string,
      options?: { preselectMatriculaId?: string; preselectCuotaId?: string }
    ) => {
      pagoForm.setFieldsValue({ matricula_id: undefined, cuotas: [] });
      setMatriculasEstudiante([]);
      setCuotasDisponibles([]);

      if (!estudianteId) return;

      setCargandoMatriculas(true);
      try {
        const { data, error } = await supabaseBrowserClient
          .from("matriculas")
          .select("id, estado, cursos ( nombre )")
          .eq("estudiante_id", estudianteId);

        if (error) {
          messageApi.error("No se pudieron cargar las matrículas del estudiante");
          return;
        }

        const matriculas = data || [];
        setMatriculasEstudiante(matriculas);

        let matriculaIdSeleccionada = options?.preselectMatriculaId;
        if (!matriculaIdSeleccionada && matriculas.length === 1) {
          matriculaIdSeleccionada = matriculas[0]?.id;
        }

        if (matriculaIdSeleccionada) {
          pagoForm.setFieldsValue({ matricula_id: matriculaIdSeleccionada });
          await cargarCuotasPendientes(matriculaIdSeleccionada, {
            preselectCuotaId: options?.preselectCuotaId,
          });
        }
      } catch (error) {
        console.error("Error cargando matrículas del estudiante", error);
        messageApi.error("No se pudieron cargar las matrículas del estudiante");
      } finally {
        setCargandoMatriculas(false);
      }
    },
    [cargarCuotasPendientes, messageApi, pagoForm]
  );

  const abrirRegistroPago = useCallback(
    async (pago?: any) => {
      prepararDrawer();
      setPagoDrawerOpen(true);
      await cargarEstudiantes();

      if (pago?.estudiante_id) {
        setEstudiantesOptions((prev) => {
          if (prev.some((opt) => opt.value === pago.estudiante_id)) {
            return prev;
          }
          return [
            ...prev,
            {
              value: pago.estudiante_id,
              label: pago.perfiles?.nombre_completo || "Estudiante",
            },
          ];
        });
        pagoForm.setFieldsValue({ estudiante_id: pago.estudiante_id });
        await handleEstudianteChange(pago.estudiante_id, {
          preselectMatriculaId: pago.matricula_id,
          preselectCuotaId: pago.id,
        });
      }
    },
    [cargarEstudiantes, handleEstudianteChange, pagoForm, prepararDrawer]
  );

  const cerrarRegistroPago = useCallback(() => {
    if (registrandoPagos) return;
    setPagoDrawerOpen(false);
    prepararDrawer();
  }, [prepararDrawer, registrandoPagos]);

  const handleSubmitPago = useCallback(
    async (values: any) => {
      const cuotaIds: string[] = values.cuotas ?? [];
      if (!values.estudiante_id) {
        messageApi.error("Selecciona un estudiante antes de registrar el pago");
        return;
      }

      if (cuotaIds.length === 0) {
        messageApi.error("Selecciona al menos una cuota a pagar");
        return;
      }

      setRegistrandoPagos(true);
      try {
        const fechaPagoISO = values.fecha_pago
          ? dayjs(values.fecha_pago).format("YYYY-MM-DD")
          : dayjs().format("YYYY-MM-DD");
        const observacionTexto = values.observaciones?.trim();

        const { error } = await supabaseBrowserClient
          .from("pagos")
          .update({
            estado: "pagado",
            metodo_pago: values.metodo_pago,
            referencia: values.referencia?.trim() || null,
            fecha_pago: fechaPagoISO,
            observaciones: observacionTexto
              ? `${observacionTexto} · Secretaría`
              : `Pago registrado desde secretaría el ${dayjs().format("DD/MM/YYYY HH:mm")}`,
          })
          .in("id", cuotaIds);

        if (error) {
          throw error;
        }

        const { data: estudiantePerfil, error: estudianteError } = await supabaseBrowserClient
          .from("perfiles")
          .select("id, nombre_completo, identificacion, telefono")
          .eq("id", values.estudiante_id)
          .maybeSingle();

        if (estudianteError || !estudiantePerfil) {
          throw estudianteError ?? new Error("No se pudo obtener la información del estudiante");
        }

        const configAcademia = configuracion ?? {};

        for (const cuotaId of cuotaIds) {
          const placeholder = window.open("", "_blank");
          try {
            const { data: pagoActualizado, error: detalleError } = await supabaseBrowserClient
              .from("pagos")
              .select(
                `
                  id,
                  monto,
                  fecha_pago,
                  periodo_pagado,
                  numero_cuota,
                  metodo_pago,
                  referencia,
                  estudiante_id,
                  matricula_id,
                  matricula:matriculas!pagos_matricula_id_fkey (
                    cursos ( nombre )
                  )
                `
              )
              .eq("id", cuotaId)
              .maybeSingle();

            if (detalleError || !pagoActualizado) {
              throw detalleError ?? new Error("No se encontró la información del pago actualizado");
            }

            const fechaTicketISO = pagoActualizado.fecha_pago ?? fechaPagoISO;
            const ticketData = {
              academia: {
                nombre: configAcademia.nombre_academia ?? "Academia Crystal",
                ruc: configAcademia.ruc ?? undefined,
                logoUrl: configAcademia.logo_url ?? undefined,
                telefono: configAcademia.telefono ?? configAcademia.whatsapp ?? undefined,
                direccion: configAcademia.direccion ?? undefined,
                email: configAcademia.email ?? undefined,
                ticketTitulo: configAcademia.ticket_titulo ?? undefined,
                ticketNota: configAcademia.ticket_nota ?? undefined,
                ticketPie: configAcademia.ticket_pie ?? undefined,
                ticketCampos: configAcademia.ticket_campos ?? undefined,
              },
              estudiante: {
                nombre: estudiantePerfil.nombre_completo ?? "Estudiante",
                identificacion: estudiantePerfil.identificacion ?? undefined,
                telefono: estudiantePerfil.telefono ?? undefined,
              },
              pago: {
                referencia: pagoActualizado.referencia || cuotaId,
                metodo: pagoActualizado.metodo_pago ?? values.metodo_pago,
                monto: Number(pagoActualizado.monto ?? 0),
                fecha: dayjs(fechaTicketISO).format("DD/MM/YYYY"),
                concepto: `${
                  pagoActualizado.periodo_pagado ||
                  `Cuota ${pagoActualizado.numero_cuota ?? ""}`.trim()
                } - ${(pagoActualizado as any)?.matricula?.cursos?.nombre ?? "Curso"}`,
                periodo:
                  pagoActualizado.periodo_pagado ||
                  `Cuota ${pagoActualizado.numero_cuota ?? ""}`.trim(),
                numeroCuota: pagoActualizado.numero_cuota ?? undefined,
              },
              curso: {
                nombre: (pagoActualizado as any)?.matricula?.cursos?.nombre ?? undefined,
              },
            } as const;

            const blob = await generarTicketPagoBlob(ticketData);

            if (placeholder) {
              abrirTicketPagoDesdeBlob(blob, placeholder);
            } else {
              abrirTicketPagoDesdeBlob(blob);
            }

            const { publicUrl } = await subirTicketPago({
              blob,
              pagoId: cuotaId,
              estudianteId: pagoActualizado.estudiante_id ?? estudiantePerfil.id,
            });

            await supabaseBrowserClient
              .from("pagos")
              .update({ ticket_url: publicUrl } as any)
              .eq("id", cuotaId);

            const conceptoMovimiento = `${ticketData.pago.periodo ?? "Pago"} - ${ticketData.curso?.nombre ?? "Curso"}`;

            await registrarIngresoDesdePago({
              fecha: fechaPagoISO,
              monto: Number(pagoActualizado.monto ?? 0),
              concepto: conceptoMovimiento,
              categoria: "matriculas",
              metodo_pago: ticketData.pago.metodo,
              referencia: ticketData.pago.referencia ?? undefined,
              descripcion: observacionTexto || undefined,
              estudiante_id: pagoActualizado.estudiante_id ?? estudiantePerfil.id,
              ticket_url: publicUrl,
              pago_id: cuotaId,
            });
          } catch (ticketError) {
            if (placeholder) {
              placeholder.close();
            }
            throw ticketError;
          }
        }

        messageApi.success(
          cuotaIds.length > 1
            ? "Pagos registrados y tickets generados correctamente"
            : "Pago registrado y ticket generado correctamente"
        );

        setPagoDrawerOpen(false);
        prepararDrawer();
        await cargarPanel();
      } catch (error) {
        console.error("Error registrando pagos desde secretaría", error);
        messageApi.error("No se pudo registrar el pago ni generar el ticket");
      } finally {
        setRegistrandoPagos(false);
      }
    },
    [cargarPanel, configuracion, messageApi, prepararDrawer]
  );

  useEffect(() => {
    void cargarEstudiantes();
  }, [cargarEstudiantes]);

  useEffect(() => {
    void cargarConfiguracion();
  }, [cargarConfiguracion]);

  const renderCurso = (curso: any) => {
    const inscritos = Number(curso.matriculas?.[0]?.count || 0);
    const cupos = Number(curso.cupos || 0);
    const libres = Math.max(cupos - inscritos, 0);

    return (
      <List.Item
        actions={[
          <Button key="matricular" type="link" onClick={() => abrirMatricula(curso.id)}>
            Matricular
          </Button>,
        ]}
      >
        <List.Item.Meta
          title={
            <Space direction="vertical" size={0}>
              <Text strong>{construirNombreGrupo(curso)}</Text>
              <Text type="secondary">{curso.programas?.nombre || "Programa por definir"}</Text>
            </Space>
          }
          description={
            <Space direction="vertical" size={4}>
              <Space>
                <CalendarOutlined />
                <Text>{formatFecha(curso.fecha_inicio)}</Text>
              </Space>
              <Space>
                <TeamOutlined />
                <Text>{`${inscritos}/${cupos || 0} inscritos`}</Text>
                <Tag color={libres > 0 ? "green" : "red"}>{libres} cupos libres</Tag>
              </Space>
              <Text type="secondary">{formatDias(curso.dias_semana)} · {formatHorario(curso.hora_inicio, curso.hora_fin)}</Text>
            </Space>
          }
        />
      </List.Item>
    );
  };

  return (
    <div style={{
      padding: window.innerWidth < 768 ? "16px 12px" : "24px",
      backgroundColor: window.innerWidth < 768 ? "#fafafa" : "transparent"
    }}>
      <Space direction="vertical" size={window.innerWidth < 768 ? 16 : 24} style={{ width: "100%" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #5B21B6, #7C3AED)",
            borderRadius: window.innerWidth < 768 ? 12 : 18,
            padding: window.innerWidth < 768 ? "16px" : "24px",
            color: "#fff",
            boxShadow: "0 18px 40px -24px rgba(91,33,182,0.55)",
          }}
        >
          <Row gutter={[window.innerWidth < 768 ? 12 : 24, window.innerWidth < 768 ? 12 : 24]} align="middle">
            <Col xs={24} md={14}>
              <Space direction="vertical" size={window.innerWidth < 768 ? 8 : 12} style={{ width: "100%" }}>
                <Space size={window.innerWidth < 768 ? 8 : 12} wrap>
                  <Badge color="#F5F5F5" text={<span style={{ color: "#F5F5F5", fontSize: window.innerWidth < 768 ? "12px" : "14px" }}>Centro de atención</span>} />
                  <Badge color="#C4B5FD" text={<span style={{ color: "#F5F5F5", fontSize: window.innerWidth < 768 ? "12px" : "14px" }}>Secretaría</span>} />
                </Space>
                <Title level={window.innerWidth < 768 ? 3 : 2} style={{ color: "#FFFFFF", marginBottom: 0, fontSize: window.innerWidth < 768 ? "18px" : "28px" }}>
                  Bienvenida, gestiona el flujo académico
                </Title>
                <Text style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: window.innerWidth < 768 ? "12px" : "14px"
                }}>
                  Matrículas, pagos y cursos en un solo lugar.
                </Text>
                <Space size={window.innerWidth < 768 ? [8, 8] : [12, 12]} wrap>
                  <Button
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    onClick={() => router.push("/caja")}
                    size={window.innerWidth < 768 ? "small" : "middle"}
                    style={{
                      fontSize: window.innerWidth < 768 ? "12px" : "14px",
                    }}
                  >
                    {window.innerWidth < 768 ? "Cobrar" : "Cobrar en caja"}
                  </Button>
                  <Button
                    icon={<WhatsAppOutlined />}
                    onClick={() => programasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    size={window.innerWidth < 768 ? "small" : "middle"}
                    style={{
                      fontSize: window.innerWidth < 768 ? "12px" : "14px",
                    }}
                  >
                    {window.innerWidth < 768 ? "Info cursos" : "Enviar info de cursos"}
                  </Button>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => abrirMatricula()}
                    size={window.innerWidth < 768 ? "small" : "middle"}
                    style={{
                      fontSize: window.innerWidth < 768 ? "12px" : "14px",
                    }}
                  >
                    {window.innerWidth < 768 ? "Matrícula" : "Registrar matrícula"}
                  </Button>
                  {!loading && (
                    <Button
                      icon={<ReloadOutlined />}
                      ghost
                      onClick={cargarPanel}
                      disabled={loading}
                      size={window.innerWidth < 768 ? "small" : "middle"}
                      style={{
                        fontSize: window.innerWidth < 768 ? "12px" : "14px",
                      }}
                    >
                      {window.innerWidth < 768 ? "Actualizar" : "Actualizar datos"}
                    </Button>
                  )}
                </Space>
              </Space>
            </Col>
            <Col xs={24} md={10}>
              <Row gutter={[window.innerWidth < 768 ? 8 : 16, window.innerWidth < 768 ? 8 : 16]}>
                {resumenCards.map((card) => (
                  <Col xs={12} sm={8} md={12} key={card.key}>
                    <div
                      style={{
                        backgroundColor: "rgba(17,24,39,0.28)",
                        borderRadius: window.innerWidth < 768 ? 8 : 16,
                        padding: window.innerWidth < 768 ? "12px" : "16px",
                        backdropFilter: "blur(2px)",
                      }}
                    >
                      <Text style={{
                        color: "rgba(255,255,255,0.7)",
                        fontSize: window.innerWidth < 768 ? "11px" : "13px",
                        display: "block",
                        marginBottom: "4px",
                        wordWrap: "break-word"
                      }}>{card.label}</Text>
                      <Statistic
                        value={card.value}
                        valueStyle={{
                          color: "#FFFFFF",
                          fontWeight: 700,
                          fontSize: window.innerWidth < 768 ? "20px" : "28px"
                        }}
                      />
                    </div>
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>
        </div>

        {loading ? (
          <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Spin size="large" />
          </div>
        ) : (
          <Row gutter={[window.innerWidth < 768 ? 12 : 24, window.innerWidth < 768 ? 12 : 24]}>
            <Col xs={24} md={window.innerWidth < 768 ? 24 : 16}>
              <div ref={programasRef} />
              <Card
                title={<span style={{ fontSize: window.innerWidth < 768 ? "14px" : "16px" }}>Vista general académica</span>}
                extra={window.innerWidth >= 768 && <Button type="link" onClick={() => window.open("/programas", "_blank")} size="small">Gestionar programas</Button>}
                variant="outlined"
                style={{
                  marginBottom: window.innerWidth < 768 ? "12px" : "0px",
                }}
              >
                <Tabs
                  defaultActiveKey="programas"
                  items={[
                    {
                      key: "programas",
                      label: "Programas activos",
                      children: (
                        <List
                          grid={{ gutter: 16, xs: 1, md: 2 }}
                          dataSource={programas}
                          rowKey={(programa) => programa.id}
                          locale={{ emptyText: <Empty description="Sin programas registrados" /> }}
                          renderItem={(programa) => (
                            <List.Item>
                              <Card
                                hoverable
                                style={{
                                  borderRadius: "12px",
                                  overflow: "hidden",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                                  transition: "all 0.3s ease",
                                  border: "1px solid rgba(0,0,0,0.06)",
                                }}
                                styles={{ body: { padding: "0" } }}
                              >
                                {/* Header con gradiente */}
                                <div style={{
                                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                  padding: "20px",
                                  position: "relative",
                                  overflow: "hidden",
                                }}>
                                  {/* Patrón de fondo */}
                                  <div style={{
                                    position: "absolute",
                                    top: 0,
                                    right: 0,
                                    opacity: 0.1,
                                    fontSize: "80px",
                                    color: "white",
                                  }}>
                                    <BookOutlined />
                                  </div>
                                  
                                  <Space direction="vertical" size={4} style={{ width: "100%", position: "relative", zIndex: 1 }}>
                                    <Text strong style={{ 
                                      color: "white", 
                                      fontSize: "18px",
                                      display: "block",
                                      marginBottom: "4px"
                                    }}>
                                      {programa.nombre}
                                    </Text>
                                    {programa.duracion && (
                                      <Space size={4}>
                                        <ClockCircleOutlined style={{ color: "rgba(255,255,255,0.9)", fontSize: "14px" }} />
                                        <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: "14px" }}>
                                          {programa.duracion}
                                        </Text>
                                      </Space>
                                    )}
                                  </Space>
                                </div>

                                {/* Contenido */}
                                <div style={{ padding: "20px" }}>
                                  {/* Descripción */}
                                  {programa.descripcion && (
                                    <div style={{ marginBottom: "16px" }}>
                                      <Text type="secondary" style={{ 
                                        display: "block",
                                        lineHeight: "1.6",
                                        fontSize: "14px"
                                      }}>
                                        {programa.descripcion.length > 120 
                                          ? programa.descripcion.substring(0, 120) + "..." 
                                          : programa.descripcion}
                                      </Text>
                                    </div>
                                  )}

                                  {/* Información de precios y clases */}
                                  <Space direction="vertical" size={12} style={{ width: "100%", marginBottom: "16px" }}>
                                    {(programa.precio_inscripcion !== null && programa.precio_inscripcion !== undefined) && (
                                      <div style={{
                                        background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                                        padding: "12px 16px",
                                        borderRadius: "8px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                      }}>
                                        <Text strong style={{ color: "white", fontSize: "13px" }}>Inscripción</Text>
                                        <Text strong style={{ color: "white", fontSize: "16px" }}>
                                          {formatCurrency(programa.precio_inscripcion)}
                                        </Text>
                                      </div>
                                    )}
                                    
                                    {(programa.precio_mensualidad !== null && programa.precio_mensualidad !== undefined) && (
                                      <div style={{
                                        background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                                        padding: "12px 16px",
                                        borderRadius: "8px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                      }}>
                                        <Text strong style={{ color: "white", fontSize: "13px" }}>Mensualidad</Text>
                                        <Text strong style={{ color: "white", fontSize: "16px" }}>
                                          {formatCurrency(programa.precio_mensualidad)}
                                        </Text>
                                      </div>
                                    )}

                                    {programa.total_clases && (
                                      <div style={{
                                        background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
                                        padding: "10px 16px",
                                        borderRadius: "8px",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        gap: "8px"
                                      }}>
                                        <TeamOutlined style={{ color: "#764ba2", fontSize: "16px" }} />
                                        <Text strong style={{ color: "#764ba2", fontSize: "14px" }}>
                                          {programa.total_clases} clases en total
                                        </Text>
                                      </div>
                                    )}
                                  </Space>

                                  {/* Botones de acción */}
                                  <Space size={8} style={{ width: "100%" }}>
                                    <Button 
                                      type="default"
                                      size="middle"
                                      onClick={() => handleCopyPrograma(programa)}
                                      style={{
                                        flex: 1,
                                        borderRadius: "8px",
                                        height: "40px",
                                        fontWeight: 500
                                      }}
                                    >
                                      Copiar info
                                    </Button>
                                    <Button
                                      type="primary"
                                      size="middle"
                                      icon={<WhatsAppOutlined />}
                                      onClick={() => abrirWhatsappPrograma(programa)}
                                      style={{
                                        flex: 1,
                                        background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                                        border: "none",
                                        borderRadius: "8px",
                                        height: "40px",
                                        fontWeight: 500,
                                        boxShadow: "0 2px 8px rgba(37, 211, 102, 0.3)"
                                      }}
                                    >
                                      
                                    </Button>
                                  </Space>
                                </div>
                              </Card>
                            </List.Item>
                          )}
                        />
                      ),
                    },
                    {
                      key: "grupos",
                      label: "Grupos activos",
                      children: (
                        <List
                          dataSource={cursosActivos}
                          rowKey={(curso) => curso.id}
                          locale={{ emptyText: <Empty description="No hay grupos activos" /> }}
                          renderItem={renderCurso}
                        />
                      ),
                    },
                    {
                      key: "proximos",
                      label: "Inicios próximos",
                      children: (
                        proximosDestacados.length > 0 ? (
                          <Timeline
                            items={proximosDestacados.map((curso) => ({
                              color: "#7C3AED",
                              children: (
                                <div>
                                  <Space direction="vertical" size={4}>
                                    <Space align="center">
                                      <Text strong>{construirNombreGrupo(curso)}</Text>
                                      <Tag color="geekblue">{curso.programas?.nombre || "Programa"}</Tag>
                                    </Space>
                                    <Text type="secondary">Inicio: {formatFecha(curso.fecha_inicio)}</Text>
                                    <Text type="secondary">{formatDias(curso.dias_semana)} · {formatHorario(curso.hora_inicio, curso.hora_fin)}</Text>
                                    <Button size="small" type="link" onClick={() => abrirMatricula(curso.id)}>
                                      Reservar cupo
                                    </Button>
                                  </Space>
                                </div>
                              ),
                            }))}
                          />
                        ) : (
                          <Empty description="No hay inicios programados" />
                        )
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} md={window.innerWidth < 768 ? 24 : 8}>
              <Space direction="vertical" size={window.innerWidth < 768 ? 16 : 24} style={{ width: "100%" }}>
                <Card title={<span style={{ fontSize: window.innerWidth < 768 ? "14px" : "16px" }}>Estado de pagos</span>} variant="outlined">
                  <Row gutter={[window.innerWidth < 768 ? 12 : 16, window.innerWidth < 768 ? 12 : 16]}>
                    <Col xs={12} md={12}>
                      <Statistic
                        title={<span style={{ fontSize: window.innerWidth < 768 ? "11px" : "12px" }}>Pendiente</span>}
                        value={resumenFinanciero.totalPendiente}
                        precision={0}
                        prefix="$"
                        valueStyle={{ color: "#B91C1C", fontWeight: 700, fontSize: window.innerWidth < 768 ? "16px" : "24px" }}
                      />
                    </Col>
                    <Col xs={12} md={12}>
                      <Statistic
                        title={<span style={{ fontSize: window.innerWidth < 768 ? "11px" : "12px" }}>Vencidos</span>}
                        value={resumenFinanciero.vencidos}
                        valueStyle={{ color: "#DC2626", fontWeight: 700, fontSize: window.innerWidth < 768 ? "16px" : "24px" }}
                      />
                    </Col>
                    <Col span={24}>
                      <Statistic
                        title={<span style={{ fontSize: window.innerWidth < 768 ? "11px" : "12px" }}>Vencen en 7d</span>}
                        value={resumenFinanciero.proximosVencimientos}
                        valueStyle={{ color: "#F59E0B", fontWeight: 600, fontSize: window.innerWidth < 768 ? "16px" : "24px" }}
                      />
                    </Col>
                  </Row>
                  <Divider style={{ margin: window.innerWidth < 768 ? "12px 0" : "16px 0" }} />
                  <List
                    dataSource={pagosPendientes.slice(0, 4)}
                    rowKey={(pago) => pago.id}
                    locale={{ emptyText: <Empty description="Sin pagos pendientes" /> }}
                    renderItem={(pago) => (
                      <List.Item
                        style={{
                          paddingBottom: window.innerWidth < 768 ? "8px" : "12px",
                        }}
                        actions={[
                          <Button
                            key="registrar"
                            type="link"
                            size={window.innerWidth < 768 ? "small" : "middle"}
                            onClick={() => {
                              void abrirRegistroPago(pago);
                            }}
                          >
                            {window.innerWidth < 768 ? "+" : "Registrar"}
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={pago.perfiles?.nombre_completo || "Estudiante"}
                          description={
                            <Space direction="vertical" size={0}>
                              <Space size={8} wrap>
                                <Text strong>{formatCurrency(pago.monto)}</Text>
                                {pago.periodo_pagado && <Tag color="purple">{pago.periodo_pagado}</Tag>}
                                {pago.estado === "vencido" && <Tag color="red">Vencido</Tag>}
                              </Space>
                              <Text type="secondary">
                                {pago.matriculas?.cursos?.nombre || "Curso sin asignar"}
                              </Text>
                              <Text type="secondary">Vence: {formatFecha(pago.fecha_vencimiento)}</Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                  {pagosPendientes.length > 4 && (
                    <Button type="link" size={window.innerWidth < 768 ? "small" : "middle"} onClick={() => window.open("/tesoreria", "_blank")}>
                      {window.innerWidth < 768 ? "Ver más" : "Ver todos los pagos"}
                    </Button>
                  )}
                </Card>

                <Card
                  title={<span style={{ fontSize: window.innerWidth < 768 ? "14px" : "16px" }}>Leads en seguimiento</span>}
                  extra={window.innerWidth >= 768 && <Button type="link" size="small" onClick={() => window.open("/leads", "_blank")}>
                    Módulo
                  </Button>}
                  variant="outlined"
                >
                  <Space direction="vertical" size={window.innerWidth < 768 ? 8 : 12} style={{ width: "100%" }}>
                    <Statistic
                      title={<span style={{ fontSize: window.innerWidth < 768 ? "11px" : "12px" }}>Sin contacto</span>}
                      value={leadsPrioritarios.sinContacto.length}
                      valueStyle={{ color: "#2563EB", fontWeight: 600, fontSize: window.innerWidth < 768 ? "16px" : "20px" }}
                    />
                    <Statistic
                      title={<span style={{ fontSize: window.innerWidth < 768 ? "11px" : "12px" }}>En seguimiento</span>}
                      value={leadsPrioritarios.seguimiento.length}
                      valueStyle={{ color: "#0EA5E9", fontWeight: 600, fontSize: window.innerWidth < 768 ? "16px" : "20px" }}
                    />
                    <Divider style={{ margin: window.innerWidth < 768 ? "8px 0" : "12px 0" }} />
                    <List
                      dataSource={leads.slice(0, 4)}
                      style={{
                        maxHeight: window.innerWidth < 768 ? "300px" : "400px",
                        overflowY: "auto"
                      }}
                      rowKey={(lead) => lead.id}
                      locale={{ emptyText: <Empty description="Sin leads pendientes" /> }}
                      renderItem={(lead) => (
                        <List.Item
                          style={{
                            paddingBottom: window.innerWidth < 768 ? "8px" : "12px",
                          }}
                          actions={[
                            lead.telefono ? (
                              <Tooltip key="whatsapp" title="WhatsApp">
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<WhatsAppOutlined />}
                                  href={`https://wa.me/${lead.telefono.replace(/\D+/g, "")}`}
                                  target="_blank"
                                />
                              </Tooltip>
                            ) : null,
                          ].filter(Boolean) as React.ReactNode[]}
                        >
                          <List.Item.Meta
                            title={
                              <Space size={window.innerWidth < 768 ? 4 : 8}>
                                <Text strong style={{ fontSize: window.innerWidth < 768 ? "12px" : "14px" }}>{lead.nombre}</Text>
                                {lead.estado && (
                                  <Tag color={estadoLeadColor[lead.estado] || "default"} style={{ fontSize: window.innerWidth < 768 ? "10px" : "12px" }}>{lead.estado.replace(/_/g, " ")}</Tag>
                                )}
                              </Space>
                            }
                            description={
                              <Text type="secondary" style={{ fontSize: window.innerWidth < 768 ? "11px" : "12px" }}>
                                {(lead.interes || "Sin obs").substring(0, window.innerWidth < 768 ? 30 : 60)}
                              </Text>
                            }
                          />
                        </List.Item>
                      )}
                    />
                    {leads.length > 4 && (
                      <Button type="link" size={window.innerWidth < 768 ? "small" : "middle"} block onClick={() => window.open("/leads", "_blank")}>
                        Ver todos ({leads.length})
                      </Button>
                    )}
                  </Space>
                </Card>
              </Space>
            </Col>
          </Row>
        )}
      </Space>

      <Drawer
        title="Registrar pagos"
        placement="right"
        width={520}
        onClose={cerrarRegistroPago}
        open={pagoDrawerOpen}
        destroyOnHidden
        maskClosable={!registrandoPagos}
        closable={!registrandoPagos}
        styles={drawerStyles}
      >
        <Form form={pagoForm} layout="vertical" onFinish={handleSubmitPago}>
          <Form.Item
            label="Estudiante"
            name="estudiante_id"
            rules={[{ required: true, message: "Selecciona un estudiante" }]}
          >
            <Select
              options={estudiantesOptions}
              showSearch
              placeholder="Buscar estudiante..."
              optionFilterProp="label"
              loading={cargandoEstudiantes}
              onChange={(value) => {
                void handleEstudianteChange(value);
              }}
              allowClear
            />
          </Form.Item>

          <Form.Item
            label="Curso"
            name="matricula_id"
            rules={[{ required: true, message: "Selecciona un curso" }]}
          >
            <Select
              options={matriculasOptions}
              placeholder="Elige el curso a cobrar"
              loading={cargandoMatriculas}
              onChange={(value) => {
                void handleMatriculaChange(value);
              }}
              allowClear
            />
          </Form.Item>

          <Form.Item
            label="Cuotas a pagar"
            name="cuotas"
            rules={[{ required: true, type: "array", message: "Selecciona al menos una cuota" }]}
          >
            {cargandoCuotas ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Spin />
              </div>
            ) : cuotasDisponibles.length === 0 ? (
              <Alert
                type="info"
                showIcon
                message="Selecciona un curso para ver las cuotas disponibles"
              />
            ) : (
              <Checkbox.Group style={{ width: "100%" }}>
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  {cuotasDisponibles.map((cuota) => (
                    <Checkbox key={cuota.id} value={cuota.id}>
                      <Space direction="vertical" size={0} style={{ width: "100%" }}>
                        <Space size={8} wrap align="center">
                          <Text strong>
                            {cuota.periodo_pagado || `Cuota #${cuota.numero_cuota ?? "-"}`}
                          </Text>
                          {cuota.estado === "vencido" && <Tag color="red">Vencida</Tag>}
                        </Space>
                        <Space size={8} wrap>
                          <Text>{formatCurrency(cuota.monto)}</Text>
                          <Text type="secondary">
                            {cuota.fecha_vencimiento
                              ? `Vence: ${formatFecha(cuota.fecha_vencimiento)}`
                              : "Sin fecha de vencimiento"}
                          </Text>
                        </Space>
                      </Space>
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            )}
          </Form.Item>

          {cuotasDisponibles.length > 0 && cuotasSeleccionadasIds.length === 0 && (
            <Alert
              type="warning"
              showIcon
              message="Selecciona una o varias cuotas que el estudiante desea pagar"
              style={{ marginBottom: 16 }}
            />
          )}

          {cuotasSeleccionadasIds.length > 0 && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Text strong>{`${cuotasSeleccionadasIds.length} cuota(s) seleccionadas`}</Text>
                <Statistic
                  title="Total a cobrar"
                  value={totalSeleccionado}
                  prefix="$"
                  valueStyle={{ fontWeight: 700 }}
                  precision={0}
                />
              </Space>
            </Card>
          )}

          <Form.Item
            label="Método de pago"
            name="metodo_pago"
            rules={[{ required: true, message: "Selecciona el método de pago" }]}
          >
            <Select
              options={[
                { label: "Efectivo", value: "efectivo" },
                { label: "Transferencia", value: "transferencia" },
                { label: "Tarjeta", value: "tarjeta" },
                { label: "Otro", value: "otro" },
              ]}
              placeholder="Selecciona el método de pago"
            />
          </Form.Item>

          <Form.Item
            label="Fecha de pago"
            name="fecha_pago"
            rules={[{ required: true, message: "Selecciona la fecha de pago" }]}
          >
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item label="Referencia" name="referencia">
            <Input placeholder="Número de comprobante o referencia" />
          </Form.Item>

          <Form.Item label="Observaciones" name="observaciones">
            <Input.TextArea rows={3} placeholder="Notas internas u observaciones" />
          </Form.Item>

          <Space style={{ width: "100%", justifyContent: "flex-end" }} size={12}>
            <Button onClick={cerrarRegistroPago} disabled={registrandoPagos}>
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={registrandoPagos}
              disabled={
                registrandoPagos || cuotasDisponibles.length === 0 || cuotasSeleccionadasIds.length === 0
              }
            >
              Confirmar pago
            </Button>
          </Space>
        </Form>
      </Drawer>

      <Modal
        title="Enviar información por WhatsApp"
        open={whatsappOpen}
        onCancel={() => setWhatsappOpen(false)}
        onOk={enviarWhatsAppPrograma}
        okText="Enviar"
        cancelText="Cancelar"
        destroyOnHidden
      >
        <Form form={whatsappForm} layout="vertical">
          <Form.Item
            label="Nombre"
            name="nombre"
            rules={[{ required: true, message: "Ingresa el nombre" }]}
          >
            <Input placeholder="Nombre del interesado" />
          </Form.Item>
          <Form.Item
            label="Teléfono"
            name="telefono"
            rules={[{ required: true, message: "Ingresa el teléfono" }]}
          >
            <Input placeholder="WhatsApp" />
          </Form.Item>
          <Form.Item label="Email" name="email">
            <Input placeholder="Opcional" />
          </Form.Item>
          <Form.Item label="Notas" name="notas">
            <Input.TextArea rows={3} placeholder="Opcional" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}


