"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { Show } from "@refinedev/antd";
import {
  Typography,
  Row,
  Col,
  Card,
  Button,
  Statistic,
  Table,
  Tag,
  Spin,
  Avatar,
  Alert,
  Tabs,
  Divider,
  Descriptions,
  Result,
  Space,
  Tooltip,
  Modal,
  Popconfirm,
} from "antd";
import {
  UserOutlined,
  DollarCircleOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PhoneOutlined,
  MailOutlined,
  IdcardOutlined,
  HomeOutlined,
  TeamOutlined,
  WhatsAppOutlined,
  PrinterOutlined,
  CameraOutlined,
  UploadOutlined,
  ReloadOutlined,
  DeleteOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import { message, Upload } from "antd";
import type { UploadFile } from "antd";
import dayjs from "dayjs";
import { formatDate } from "@utils/date";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { construirNombreGrupo } from "@utils/grupos";
import { enviarWhatsapp } from "@utils/whatsapp";
import { HistorialEntregas } from "@components/EntregaMaterialModal";
import { abrirTicketPagoDesdeBlob, generarTicketPagoBlob } from "@utils/pago-ticket";
import { subirTicketPago } from "@utils/ticket-storage";

type Matricula = {
  id: number;
  fecha_inicio: string | null;
  estado: string | null;
  monto_pagado: number | null;
  deuda_pendiente: number | null;
  nota_final: number | null;
  cursos: {
    id: string;
    nombre: string | null;
    descripcion: string | null;
    precio: number | null;
    precio_mensualidad: number | null;
    perfiles?: {
      nombre_completo: string | null;
    } | null;
  } | null;
};

type Pago = {
  id: string;
  fecha_pago: string | null;
  fecha_vencimiento?: string | null;
  numero_cuota?: number | null;
  matricula_id: number | null;
  matriculas: {
    cursos: {
      nombre: string | null;
    } | null;
  } | null;
  monto: number | null;
  metodo_pago: string | null;
  referencia: string | null;
  observaciones: string | null;
  periodo_pagado: string | null;
  estado?: string | null;
  ticket_url?: string | null;
};

type Estadisticas = {
  totalCursos: number;
  cursosActivos: number;
  cursosFinalizados: number;
  totalPagado: number;
  deudaTotal: number;
};

type AsistenciaEstudiante = {
  id: string;
  fecha: string | null;
  estado: string | null;
  observaciones?: string | null;
  matricula_id: number | null;
  clase_numero?: number | null;
  tema_visto?: string | null;
};

const { Title, Text } = Typography;

export default function StudentDetailView() {
  const params = useParams();
  const router = useRouter();
  const idEstudiante = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [pagosHistorial, setPagosHistorial] = useState<Pago[]>([]);
  const [asistenciasHistorial, setAsistenciasHistorial] = useState<AsistenciaEstudiante[]>([]);
  const [deletingAsistenciaId, setDeletingAsistenciaId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [estadisticasGlobales, setEstadisticasGlobales] = useState<Estadisticas>({
    totalCursos: 0,
    cursosActivos: 0,
    cursosFinalizados: 0,
    totalPagado: 0,
    deudaTotal: 0,
  });
  const [ciclosPorMatricula, setCiclosPorMatricula] = useState<Record<number, { total: number; pagados: number; faltantes: number; periodos: string[]; inscripcionPagada: boolean }>>({});

  const parseDuracionMeses = (valor?: string | number | null) => {
    if (typeof valor === "number" && Number.isFinite(valor)) return Math.max(valor, 0);
    const texto = String(valor ?? "");
    const match = texto.match(/\d+/);
    return match ? Number(match[0]) : 0;
  };

  const parseNumeroCuota = (pago: any): number | null => {
    const numero = Number(pago?.numero_cuota);
    if (Number.isFinite(numero) && numero > 0) return numero;
    const raw = String(pago?.periodo_pagado || pago?.observaciones || "");
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : null;
  };

  const extractClassNumber = (value?: string | null): number | null => {
    const text = String(value || "");
    const match = text.match(/clase\s*#?\s*(\d{1,3})/i);
    if (!match?.[1]) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const esInscripcion = (pago: any) => {
    const texto = String(pago?.periodo_pagado || pago?.observaciones || "").toLowerCase();
    return texto.includes("matric") || Number(pago?.numero_cuota) === 0;
  };

  const obtenerDuracionMeses = (matricula: any) =>
    parseDuracionMeses(
      matricula?.cursos?.programas?.duracion ??
      matricula?.cursos?.duracion ??
      matricula?.cursos?.numero_cuotas ??
      matricula?.numero_cuotas
    );

  const obtenerMensualidad = (matricula: any) =>
    Number(
      matricula?.cursos?.precio_mensualidad ??
      matricula?.cursos?.programas?.precio_mensualidad ??
      0
    );

  const calcularFechaVencimientoCuota = (matricula: any, numeroCuota: number) => {
    if (!numeroCuota || numeroCuota < 1) return null;
    const fechaBase = matricula?.fecha_inicio
      ? dayjs(matricula.fecha_inicio)
      : null;
    if (!fechaBase || !fechaBase.isValid()) return null;
    return fechaBase.add(numeroCuota, "month").format("YYYY-MM-DD");
  };

  const cargarDatosCompletos = useCallback(async () => {
    if (!idEstudiante) return;

    try {
      setLoading(true);
      setLoadError(null);

      const { data: dataPerfil, error: errPerfil } = await supabaseBrowserClient
        .from("perfiles")
        .select("*")
        .eq("id", idEstudiante)
        .maybeSingle();
      if (errPerfil) {
        setLoadError("Error cargando información del estudiante.");
        throw errPerfil;
      }
      if (!dataPerfil) {
        setLoadError("No encontramos información para este estudiante.");
        return;
      }
      setPerfil(dataPerfil);

      const { data: dataMatriculas, error: errMat } = await supabaseBrowserClient
        .from("matriculas")
        .select(
          `
            id, fecha_inicio, estado, monto_pagado, deuda_pendiente, nota_final, estado_academico,
            cursos ( id, nombre, descripcion, precio, precio_mensualidad, duracion, dias_semana, hora_inicio, hora_fin, programas(nombre, duracion, precio_mensualidad), perfiles(nombre_completo) )
          `
        )
        .eq("estudiante_id", idEstudiante)
        .order("fecha_inicio", { ascending: false });
      if (errMat) {
        setLoadError("No pudimos cargar las matrículas del estudiante.");
        throw errMat;
      }
      const listaMats = (dataMatriculas as any[] | null) ?? [];
      setMatriculas(listaMats);

      const matriculaIds = listaMats.map((m: any) => m.id).filter(Boolean);
      const cursoIds = listaMats.map((m: any) => m?.cursos?.id).filter(Boolean);

      if (matriculaIds.length > 0) {
        const { data: dataAsistencias, error: errAsistencias } = await supabaseBrowserClient
          .from("asistencias")
          .select("id, fecha, estado, observaciones, matricula_id")
          .in("matricula_id", matriculaIds)
          .order("fecha", { ascending: false });

        if (errAsistencias) {
          console.error("Error cargando asistencias del estudiante", errAsistencias);
          setAsistenciasHistorial([]);
        } else {
          const asistenciasBase = dataAsistencias || [];
          const fechas = asistenciasBase
            .map((a: any) => a?.fecha)
            .filter(Boolean)
            .sort();

          const fechaMin = fechas[0];
          const fechaMax = fechas[fechas.length - 1];

          const sesionesQuery = supabaseBrowserClient
            .from("sesiones_clase")
            .select("curso_id, fecha, tema_visto, observaciones")
            .in("curso_id", cursoIds);

          const { data: sesionesData } = await (fechaMin && fechaMax
            ? sesionesQuery.filter("fecha", "cs", `[${fechaMin},${fechaMax}]`)
            : sesionesQuery);

          const temaPorCursoFecha = new Map<string, string>();
          const claseNumeroPorCursoFecha = new Map<string, number | null>();
          (sesionesData || []).forEach((sesion: any) => {
            const key = `${sesion?.curso_id || ""}-${sesion?.fecha || ""}`;
            if (!temaPorCursoFecha.has(key)) {
              temaPorCursoFecha.set(key, sesion?.tema_visto || "");
              claseNumeroPorCursoFecha.set(
                key,
                extractClassNumber(sesion?.observaciones || sesion?.tema_visto || "")
              );
            }
          });

          const cursoPorMatricula = new Map<number, any>();
          listaMats.forEach((mat: any) => {
            cursoPorMatricula.set(Number(mat.id), mat.cursos || null);
          });

          const asistenciasFormateadas: AsistenciaEstudiante[] = asistenciasBase.map((asistencia: any) => {
            const cursoData = cursoPorMatricula.get(Number(asistencia.matricula_id));
            const cursoId = cursoData?.id;
            const key = `${cursoId || ""}-${asistencia?.fecha || ""}`;

            return {
              id: String(asistencia.id),
              fecha: asistencia.fecha || null,
              estado: asistencia.estado || null,
              observaciones: asistencia.observaciones || null,
              matricula_id: asistencia.matricula_id || null,
              clase_numero:
                extractClassNumber(asistencia?.observaciones || "") ??
                claseNumeroPorCursoFecha.get(key) ??
                extractClassNumber(temaPorCursoFecha.get(key) || "") ??
                null,
              tema_visto: temaPorCursoFecha.get(key) || null,
            };
          });

          setAsistenciasHistorial(asistenciasFormateadas);
        }
      } else {
        setAsistenciasHistorial([]);
      }

      const activas = listaMats.filter((m) => m.estado === "activo").length;
      const finalizadas = listaMats.filter((m) => m.estado === "finalizado").length;
      const totalPagado = listaMats.reduce((sum, m) => sum + (m.monto_pagado || 0), 0);
      const deudaTotal = listaMats.reduce((sum, m) => sum + (m.deuda_pendiente || 0), 0);

      setEstadisticasGlobales({
        totalCursos: listaMats.length,
        cursosActivos: activas,
        cursosFinalizados: finalizadas,
        totalPagado,
        deudaTotal,
      });

      const { data: dataPagos, error: errPagos } = await supabaseBrowserClient
        .from("pagos")
        .select(
          "id, created_at, estudiante_id, fecha_pago, fecha_vencimiento, matricula_id, periodo_pagado, numero_cuota, monto, metodo_pago, referencia, observaciones, estado, ticket_url, matriculas!pagos_matricula_id_fkey(cursos(nombre, dias_semana, hora_inicio, hora_fin, programas(nombre, duracion, precio_mensualidad)))"
        )
        .eq("estudiante_id", idEstudiante)
        .order("matricula_id", { ascending: true })
        .order("numero_cuota", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (errPagos) {
        setLoadError("No pudimos cargar el historial de pagos.");
        throw errPagos;
      }

      let pagosList = (dataPagos as unknown as Pago[] | null) ?? [];

      if (matriculaIds.length > 0) {
        const { data: dataPagosPorMatricula, error: errPagosPorMatricula } = await supabaseBrowserClient
          .from("pagos")
          .select(
            "id, created_at, estudiante_id, fecha_pago, fecha_vencimiento, matricula_id, periodo_pagado, numero_cuota, monto, metodo_pago, referencia, observaciones, estado, ticket_url, matriculas!pagos_matricula_id_fkey(cursos(nombre, dias_semana, hora_inicio, hora_fin, programas(nombre, duracion, precio_mensualidad)))"
          )
          .in("matricula_id", matriculaIds)
          .order("matricula_id", { ascending: true })
          .order("numero_cuota", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true });

        if (!errPagosPorMatricula) {
          const pagosPorMatricula = (dataPagosPorMatricula as unknown as Pago[] | null) ?? [];
          if (pagosPorMatricula.length > 0) {
            const pagosMap = new Map<string, Pago>();
            [...pagosList, ...pagosPorMatricula].forEach((p) => {
              pagosMap.set(String(p.id), p);
            });
            pagosList = Array.from(pagosMap.values());
          }
        }
      }

      console.log("🔍 Pagos estudiante:", pagosList.length, pagosList);
      setPagosHistorial(pagosList);

      const totalPagadoReal = pagosList
        .filter((p) => (p.estado || "").toLowerCase() === "pagado")
        .reduce((sum, p) => sum + Number(p.monto || 0), 0);
      console.log("💰 Total Pagado Real calculado:", totalPagadoReal);
      
      const totalMensualidadEsperada = listaMats.reduce((sum, m: any) => {
        const meses = obtenerDuracionMeses(m);
        const mensualidad = obtenerMensualidad(m);
        return sum + (meses * mensualidad);
      }, 0);

      const totalMensualidadPagada = pagosList
        .filter((p) => (p.estado || "").toLowerCase() === "pagado" && !esInscripcion(p))
        .reduce((sum, p) => sum + Number(p.monto || 0), 0);

      const deudaPendienteReal = Math.max(totalMensualidadEsperada - totalMensualidadPagada, 0);
      console.log("📊 Deuda Pendiente Real calculada:", deudaPendienteReal);

      setEstadisticasGlobales((prev) => ({
        ...prev,
        totalPagado: totalPagadoReal,
        deudaTotal: deudaPendienteReal,
      }));
      console.log("✅ Actualizando estadisticasGlobales con:", {
        totalPagado: totalPagadoReal,
        deudaTotal: deudaPendienteReal
      });

      // Ciclos/meses: duración + 1 inscripción. Ej: 5 ciclos = 6 pagos (1 inscripción + 5 cuotas)
      const ciclosMap: Record<number, { total: number; pagados: number; faltantes: number; periodos: string[]; inscripcionPagada: boolean }> = {};
      listaMats.forEach((m: any) => {
        const duracionMeses = obtenerDuracionMeses(m);
        const totalPagosEsperados = duracionMeses + 1; // inscripción + cuotas mensuales
        const pagosMat = pagosList.filter((p) => p.matricula_id === m.id);
        const pagados = pagosMat.filter((p) => (p.estado || "").toLowerCase() === "pagado").length;
        const faltantes = totalPagosEsperados > 0 ? Math.max(totalPagosEsperados - pagados, 0) : 0;
        const periodos = pagosMat.map((p) => p.periodo_pagado).filter(Boolean) as string[];
        const inscripcionPagada = pagosMat.some((p) => (p.periodo_pagado || "").toLowerCase().includes("matric") || (p.numero_cuota === 0 && (p.estado || "").toLowerCase() === "pagado"));
        ciclosMap[m.id] = { total: totalPagosEsperados, pagados, faltantes, periodos, inscripcionPagada };
      });
      setCiclosPorMatricula(ciclosMap);
    } catch (error) {
      console.error(error);
      setLoadError((prev) => prev ?? "Ocurrió un error cargando el expediente del estudiante.");
      message.error("Error cargando datos del estudiante");
    } finally {
      setLoading(false);
    }
  }, [idEstudiante]);

  const eliminarAsistencia = async (asistenciaId: string) => {
    try {
      setDeletingAsistenciaId(asistenciaId);

      const { error } = await supabaseBrowserClient
        .from("asistencias")
        .delete()
        .eq("id", asistenciaId);

      if (error) throw error;

      setAsistenciasHistorial((prev) => prev.filter((item) => String(item.id) !== String(asistenciaId)));
      message.success("Asistencia eliminada correctamente");
    } catch (error) {
      console.error("Error eliminando asistencia", error);
      message.error("No se pudo eliminar la asistencia");
    } finally {
      setDeletingAsistenciaId(null);
    }
  };

  useEffect(() => {
    cargarDatosCompletos();
  }, [cargarDatosCompletos]);

  const handleUploadPhoto = async (file: File) => {
    try {
      setUploadingPhoto(true);
      
      // Crear nombre único para el archivo
      const fileExt = file.name.split(".").pop();
      const fileName = `${idEstudiante}_${Date.now()}.${fileExt}`;
      const filePath = `perfiles/${fileName}`;

      // Subir a Supabase Storage
      const { error: uploadError } = await supabaseBrowserClient.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: urlData } = supabaseBrowserClient.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Actualizar perfil con la nueva URL
      const { error: updateError } = await supabaseBrowserClient
        .from("perfiles")
        .update({ foto_url: urlData.publicUrl })
        .eq("id", idEstudiante);

      if (updateError) throw updateError;

      message.success("Foto actualizada correctamente");
      
      // Recargar datos
      await cargarDatosCompletos();
    } catch (error: any) {
      console.error("Error subiendo foto:", error);
      message.error("Error al subir la foto");
    } finally {
      setUploadingPhoto(false);
    }
    return false; // Prevenir upload automático de antd
  };

  const handleWhatsAppClick = () => {
    if (!perfil?.telefono) {
      message.warning("El estudiante no tiene teléfono registrado");
      return;
    }
    const mensaje = `Hola ${perfil.nombre_completo}, te contacto desde Academia Crystal.`;
    enviarWhatsapp(perfil.telefono, mensaje);
  };

  const handleReimprimirTicket = (ticketUrl: string) => {
    const printWindow = window.open(ticketUrl, "_blank");

    if (!printWindow) {
      message.warning("No se pudo abrir el ticket para imprimir");
      return;
    }

    const fallbackTimeout = window.setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
      }
    }, 2500);

    printWindow.addEventListener(
      "load",
      () => {
        window.clearTimeout(fallbackTimeout);
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
        }
      },
      { once: true }
    );
  };

  const handleRegenerarTicket = useCallback(async (record: Pago) => {
    try {
      const { data: configAcademia } = await supabaseBrowserClient
        .from("configuracion")
        .select("*")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      const cursoNombre = construirNombreGrupo(record?.matriculas?.cursos) || "Curso";
      const periodoLegible = record?.periodo_pagado || (record?.numero_cuota === 0 ? "Inscripción" : `Cuota ${record?.numero_cuota ?? ""}`.trim());
      const fechaPagoLegible = record?.fecha_pago ? dayjs(record.fecha_pago).format("DD/MM/YYYY") : dayjs().format("DD/MM/YYYY");

      const ticketData = {
        academia: {
          nombre: configAcademia?.nombre_academia || "Academia Crystal Diamante",
          ruc: configAcademia?.ruc || undefined,
          logoUrl: configAcademia?.logo_url || undefined,
          telefono: configAcademia?.telefono || configAcademia?.whatsapp || undefined,
          direccion: configAcademia?.direccion || undefined,
          email: configAcademia?.email || undefined,
          ticketTitulo: configAcademia?.ticket_titulo || undefined,
          ticketNota: configAcademia?.ticket_nota || undefined,
          ticketPie: configAcademia?.ticket_pie || undefined,
          ticketCampos: configAcademia?.ticket_campos || undefined,
        },
        estudiante: {
          nombre: perfil?.nombre_completo || "Estudiante",
          identificacion: perfil?.identificacion || undefined,
          telefono: perfil?.telefono || undefined,
        },
        pago: {
          referencia: record?.referencia || record?.id,
          metodo: record?.metodo_pago || "efectivo",
          monto: Number(record?.monto || 0),
          fecha: fechaPagoLegible,
          concepto: `${periodoLegible} - ${cursoNombre}`,
          periodo: periodoLegible,
          numeroCuota: typeof record?.numero_cuota === "number" ? record.numero_cuota : undefined,
        },
        curso: {
          nombre: cursoNombre,
        },
      } as const;

      const blob = await generarTicketPagoBlob(ticketData);
      const placeholder = window.open("", "_blank");
      if (placeholder) {
        abrirTicketPagoDesdeBlob(blob, placeholder);
      } else {
        abrirTicketPagoDesdeBlob(blob);
      }

      const { publicUrl } = await subirTicketPago({
        blob,
        pagoId: String(record.id),
        estudianteId: String(idEstudiante),
      });

      await supabaseBrowserClient
        .from("pagos")
        .update({ ticket_url: publicUrl } as any)
        .eq("id", record.id);

      await supabaseBrowserClient
        .from("movimientos_financieros")
        .update({ ticket_url: publicUrl })
        .eq("pago_id", record.id);

      setPagosHistorial((prev) => prev.map((p) => (
        String(p.id) === String(record.id)
          ? { ...p, ticket_url: publicUrl }
          : p
      )));

      message.success("Ticket regenerado correctamente");
    } catch (error) {
      console.error("Error regenerando ticket del pago:", error);
      message.error("No se pudo regenerar el ticket");
    }
  }, [idEstudiante, perfil]);

  const columnasCursos = useMemo(
    () => [
      {
        title: "Curso",
        dataIndex: ["cursos", "nombre"],
        key: "curso",
        render: (_: string, record: any) => <Text strong>{construirNombreGrupo(record.cursos)}</Text>,
      },
      {
        title: "Fecha Inicio",
        dataIndex: "fecha_inicio",
        key: "inicio",
        render: (val: string) => (val ? formatDate(val) : "Sin fecha"),
      },
      {
        title: "Estado",
        dataIndex: "estado",
        key: "estado",
        render: (estado: string) => {
          const map: Record<string, { color: string; icon: React.ReactNode | null }> = {
            activo: { color: "blue", icon: <CheckCircleOutlined /> },
            finalizado: { color: "green", icon: <CheckCircleOutlined /> },
            cancelado: { color: "red", icon: <CloseCircleOutlined /> },
          };
          const visual = map[estado] ?? { color: "default", icon: null };
          return (
            <Tag color={visual.color} icon={visual.icon}>
              {estado || "Sin estado"}
            </Tag>
          );
        },
      },
      {
        title: "Nota Final",
        dataIndex: "nota_final",
        key: "nota",
        render: (nota: number | null) =>
          typeof nota === "number" ? (
            <Tag color="purple">{nota}</Tag>
          ) : (
            <Text type="secondary">Pendiente</Text>
          ),
      },
      {
        title: "Profesor",
        dataIndex: ["cursos", "perfiles", "nombre_completo"],
        key: "profesor",
        render: (text: string) => text || "No asignado",
      },
    ],
    []
  );

  const columnasFinanciero = useMemo(
    () => [
      {
        title: "Curso",
        dataIndex: ["cursos", "nombre"],
        key: "curso",
        render: (_: string, record: any) => construirNombreGrupo(record.cursos),
      },
      {
        title: "Precio Total",
        dataIndex: ["cursos", "precio"],
        key: "precio",
        render: (val: number | null) => `$${(val || 0).toLocaleString()}`,
      },
      {
        title: "Pagado",
        dataIndex: "monto_pagado",
        key: "pagado",
        render: (val: number | null) => (
          <Text style={{ color: "#52c41a" }}>${(val || 0).toLocaleString()}</Text>
        ),
      },
      {
        title: "Deuda",
        dataIndex: "deuda_pendiente",
        key: "deuda",
        render: (val: number | null) => (
          <Text
            style={{
              color: val && val > 0 ? "#ff4d4f" : "#52c41a",
              fontWeight: "bold",
            }}
          >
            ${(val || 0).toLocaleString()}
          </Text>
        ),
      },
    ],
    []
  );

  const contactoPerfil = useMemo(
    () => ({
      nombre: perfil?.nombre_completo ?? "",
      telefono: perfil?.telefono ?? "",
      whatsapp: perfil?.whatsapp ?? "",
    }),
    [perfil]
  );

  const pagosHistorialCompleto = useMemo(() => {
    const base = Array.isArray(pagosHistorial) ? pagosHistorial : [];
    if (!matriculas.length) return base;

    const extras: Pago[] = [];

    matriculas.forEach((matricula: any) => {
      const totalCiclos = Math.max(obtenerDuracionMeses(matricula), 0);
      if (!totalCiclos) return;

      const pagosMatricula = base.filter((p) => p.matricula_id === matricula.id);
      const cuotasExistentes = new Set<number>();

      pagosMatricula.forEach((p) => {
        if (esInscripcion(p)) return;
        const cuota = parseNumeroCuota(p);
        if (cuota && cuota >= 1 && cuota <= totalCiclos) {
          cuotasExistentes.add(cuota);
        }
      });

      for (let i = 1; i <= totalCiclos; i += 1) {
        if (cuotasExistentes.has(i)) continue;
        extras.push({
          id: `pendiente-${matricula.id}-${i}`,
          fecha_pago: null,
          numero_cuota: i,
          matricula_id: matricula.id,
          matriculas: { cursos: matricula.cursos },
          monto: obtenerMensualidad(matricula),
          metodo_pago: null,
          referencia: null,
          observaciones: `Ciclo mensual ${i} de ${totalCiclos}`,
          periodo_pagado: `Ciclo mensual ${i} de ${totalCiclos}`,
          fecha_vencimiento: calcularFechaVencimientoCuota(matricula, i),
          estado: "pendiente",
          ticket_url: null,
        });
      }
    });

    const combinado = [...base, ...extras];

    const obtenerOrdenCuota = (pago: any): number => {
      if (esInscripcion(pago)) return 0;
      const cuota = parseNumeroCuota(pago);
      if (cuota && cuota > 0) return cuota;
      return Number.MAX_SAFE_INTEGER;
    };

    return combinado.sort((a: any, b: any) => {
      const matriculaA = Number(a?.matricula_id || 0);
      const matriculaB = Number(b?.matricula_id || 0);
      if (matriculaA !== matriculaB) return matriculaA - matriculaB;

      const ordenCuotaA = obtenerOrdenCuota(a);
      const ordenCuotaB = obtenerOrdenCuota(b);
      if (ordenCuotaA !== ordenCuotaB) return ordenCuotaA - ordenCuotaB;

      const fechaVencA = a?.fecha_vencimiento ? dayjs(a.fecha_vencimiento) : null;
      const fechaVencB = b?.fecha_vencimiento ? dayjs(b.fecha_vencimiento) : null;
      if (fechaVencA && fechaVencB && !fechaVencA.isSame(fechaVencB, "day")) {
        return fechaVencA.valueOf() - fechaVencB.valueOf();
      }
      if (fechaVencA && !fechaVencB) return -1;
      if (!fechaVencA && fechaVencB) return 1;

      const createdA = a?.created_at ? dayjs(a.created_at) : null;
      const createdB = b?.created_at ? dayjs(b.created_at) : null;
      if (createdA && createdB && !createdA.isSame(createdB)) {
        return createdA.valueOf() - createdB.valueOf();
      }

      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  }, [pagosHistorial, matriculas]);

  const columnasPagos = useMemo(
    () => [
      {
        title: "Fecha",
        dataIndex: "fecha_pago",
        key: "fecha",
        render: (val: string | null) => (val ? `${formatDate(val)} ${dayjs(val).format("h:mm A")}` : "-"),
      },
      {
        title: "Estado",
        dataIndex: "estado",
        key: "estado",
        render: (val: string | null, record: Pago) => {
          let estado = (val || "pendiente").toLowerCase();
          const isPagado = estado === "pagado";
          const isVencido = record.fecha_vencimiento && dayjs(record.fecha_vencimiento).isBefore(dayjs(), 'day') && !isPagado;

          if (isVencido) {
            estado = "vencido";
          }

          let color: string = "default";
          if (estado === "pagado") color = "success";
          else if (estado === "pendiente") color = "warning";
          else if (estado === "en_revision") color = "processing";
          else if (estado === "vencido") color = "error";
          return <Tag color={color}>{estado.replace("_", " ")}</Tag>;
        },
      },
      {
        title: "Curso",
        dataIndex: ["matriculas", "cursos", "nombre"],
        key: "curso",
        render: (_: string, record: any) => construirNombreGrupo(record.matriculas?.cursos) || "Curso no asociado",
      },
      {
        title: "Monto",
        dataIndex: "monto",
        key: "monto",
        render: (val: number | null) => (
          <Text strong style={{ color: "#52c41a" }}>
            ${(val || 0).toLocaleString()}
          </Text>
        ),
      },
      {
        title: "Método",
        dataIndex: "metodo_pago",
        key: "metodo",
        render: (val: string | null) => <Tag>{val || "No especificado"}</Tag>,
      },
      {
        title: "Referencia",
        dataIndex: "referencia",
        key: "ref",
        render: (text: string | null) => text || "-",
      },
      {
        title: "Observaciones",
        dataIndex: "observaciones",
        key: "obs",
        render: (_: string | null, record: any) => {
          if (esInscripcion(record)) return "Inscripción";
          const totalCiclos = Math.max(obtenerDuracionMeses(record?.matriculas), 0);
          const numero = parseNumeroCuota(record);
          if (numero && totalCiclos) {
            return `Ciclo mensual ${numero} de ${totalCiclos}`;
          }
          return record?.observaciones || record?.periodo_pagado || "-";
        },
      },
      {
        title: "Ticket",
        dataIndex: "ticket_url",
        key: "ticket",
        render: (url: string | null, record: Pago) =>
          url ? (
            <Space size={6} wrap>
              <Tooltip title="Ver PDF">
                <Button size="small" icon={<FilePdfOutlined />} onClick={() => window.open(url, "_blank")} />
              </Tooltip>
              <Tooltip title="Reimprimir">
                <Button size="small" icon={<PrinterOutlined />} onClick={() => handleReimprimirTicket(url)} />
              </Tooltip>
              <Tooltip title="Regenerar ticket">
                <Button size="small" icon={<ReloadOutlined />} onClick={() => void handleRegenerarTicket(record)} />
              </Tooltip>
              <Tooltip title="Enviar por WhatsApp">
                <Button
                  size="small"
                  icon={<WhatsAppOutlined />}
                  onClick={() => {
                    const telefono = contactoPerfil.telefono || contactoPerfil.whatsapp;
                    if (!telefono) {
                      message.warning("El estudiante no tiene teléfono registrado");
                      return;
                    }

                    const curso = construirNombreGrupo(record.matriculas?.cursos) || "tu curso";
                    const monto = record.monto ? `$${record.monto.toLocaleString("es-CO")}` : "(monto no indicado)";
                    const msg = `Hola ${contactoPerfil.nombre}, te compartimos tu ticket de pago (${monto}) del curso ${curso}: ${url}`;
                    enviarWhatsapp(telefono, msg);
                  }}
                />
              </Tooltip>
            </Space>
          ) : (
            <Space size={6} wrap>
              <Text type="secondary">No disponible</Text>
              <Tooltip title="Regenerar ticket">
                <Button size="small" icon={<ReloadOutlined />} onClick={() => void handleRegenerarTicket(record)} />
              </Tooltip>
            </Space>
          ),
      },
      {
        title: "Recordatorio",
        key: "acciones",
        render: (_: any, record: Pago) => (
          <Button
            icon={<WhatsAppOutlined />}
            size="small"
            type="default"
            onClick={() => {
              const telefono = contactoPerfil.telefono || contactoPerfil.whatsapp;
              if (!telefono) {
                message.warning("El estudiante no tiene teléfono registrado");
                return;
              }
              const curso = construirNombreGrupo(record.matriculas?.cursos) || "tu curso";
              const estado = record.estado || "pendiente";
              const monto = record.monto ? `$${record.monto.toLocaleString('es-CO')}` : "(monto no indicado)";
              const msg = `Hola ${contactoPerfil.nombre}, te recuerdo el pago de ${monto} para ${curso}. Estado: ${estado.replace('_',' ')}. Por favor confirma el pago o envía el soporte. Gracias!`;
              enviarWhatsapp(telefono, msg);
            }}
          />
        ),
      },
    ],
    [contactoPerfil, handleRegenerarTicket]
  );

  const renderCuotasPorMatricula = (record: any) => {
    // Obtener todas las cuotas de esta matrícula
    const cuotasMatricula = pagosHistorial
      .filter(p => p.matricula_id === record.id)
      .sort((a, b) => {
        const ordenA = esInscripcion(a) ? 0 : (parseNumeroCuota(a) || Number.MAX_SAFE_INTEGER);
        const ordenB = esInscripcion(b) ? 0 : (parseNumeroCuota(b) || Number.MAX_SAFE_INTEGER);
        if (ordenA !== ordenB) return ordenA - ordenB;

        const fechaA = a?.fecha_vencimiento ? dayjs(a.fecha_vencimiento) : null;
        const fechaB = b?.fecha_vencimiento ? dayjs(b.fecha_vencimiento) : null;
        if (fechaA && fechaB && !fechaA.isSame(fechaB, "day")) return fechaA.valueOf() - fechaB.valueOf();
        if (fechaA && !fechaB) return -1;
        if (!fechaA && fechaB) return 1;

        return String(a?.id || "").localeCompare(String(b?.id || ""));
      });

    const totalCiclos = Math.max(obtenerDuracionMeses(record), 0);
    const pagosMap = new Map<number, Pago>();
    cuotasMatricula.forEach((p) => {
      if (typeof p.numero_cuota === "number") {
        pagosMap.set(p.numero_cuota, p);
      }
    });

    const inscripcionPago = cuotasMatricula.find((p) =>
      (p.periodo_pagado || "").toLowerCase().includes("matric") || p.numero_cuota === 0,
    );
    if (inscripcionPago) {
      pagosMap.set(0, inscripcionPago);
    }

    const pagosEsperados: Pago[] = [];
    for (let ciclo = 0; ciclo <= totalCiclos; ciclo += 1) {
      const pago = pagosMap.get(ciclo);
      if (pago) {
        pagosEsperados.push(pago);
        continue;
      }

      pagosEsperados.push({
        id: `pendiente-${record.id}-${ciclo}`,
        fecha_pago: null,
        fecha_vencimiento: ciclo === 0 ? null : calcularFechaVencimientoCuota(record, ciclo),
        numero_cuota: ciclo,
        matricula_id: record.id,
        matriculas: record.matriculas ?? null,
        monto: ciclo === 0 ? record?.cursos?.precio || null : obtenerMensualidad(record),
        metodo_pago: null,
        referencia: null,
        observaciones: null,
        periodo_pagado: ciclo === 0
          ? "Inscripción"
          : `Ciclo mensual ${ciclo} de ${totalCiclos}`,
        estado: "pendiente",
        ticket_url: null,
      });
    }

    if (pagosEsperados.length === 0) {
      return <Text type="secondary">No hay ciclos generados</Text>;
    }

    return (
      <Space wrap size="small">
        {pagosEsperados.map((cuota) => {
          const estado = (cuota.estado || 'pendiente').toLowerCase();
          const isPagado = estado === 'pagado';
          const isVencido = estado === 'vencido' || (cuota.fecha_vencimiento && dayjs(cuota.fecha_vencimiento).isBefore(dayjs(), 'day') && !isPagado);
          const isPorVencer = cuota.fecha_vencimiento && dayjs(cuota.fecha_vencimiento).diff(dayjs(), 'day') <= 7 && !isPagado && !isVencido;
          
          let buttonType: "primary" | "default" | "dashed" = "default";
          let buttonColor = "";
          let statusText = "";
          let statusColor = "";

          if (isPagado) {
            buttonType = "primary";
            statusText = "Pagado";
            statusColor = "#52c41a";
          } else if (isVencido) {
            buttonColor = "#ff4d4f";
            statusText = "Vencido";
            statusColor = "#ff4d4f";
          } else if (isPorVencer) {
            buttonColor = "#faad14";
            statusText = "Por vencer";
            statusColor = "#faad14";
          } else {
            statusText = "Pendiente";
            statusColor = "#1890ff";
          }

          const etiqueta = cuota.numero_cuota === 0
            ? "Inscripción"
            : `Ciclo mensual ${cuota.numero_cuota} de ${totalCiclos}`;

          return (
            <Tooltip
              key={cuota.id}
              title={
                <div>
                  <div><strong>{etiqueta}</strong></div>
                  <div>Monto: ${(cuota.monto || 0).toLocaleString()}</div>
                  {cuota.fecha_vencimiento && (
                    <div>Vence: {formatDate(cuota.fecha_vencimiento)}</div>
                  )}
                  {cuota.fecha_pago && (
                    <div>Pagado: {formatDate(cuota.fecha_pago)}</div>
                  )}
                  <div>Estado: {statusText}</div>
                </div>
              }
            >
              <Button
                size="small"
                type={buttonType}
                style={{
                  minWidth: 100,
                  borderColor: buttonColor || undefined,
                  color: isPagado ? '#fff' : buttonColor || undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  height: 'auto',
                  padding: '4px 8px',
                  alignItems: 'flex-start'
                }}
                onClick={() => {
                  if (!isPagado) {
                    Modal.confirm({
                      title: `Registrar pago de ${etiqueta}`,
                      content: (
                        <div>
                          <p>Monto: <strong>${(cuota.monto || 0).toLocaleString()}</strong></p>
                          {cuota.fecha_vencimiento && (
                            <p>Vencimiento: {formatDate(cuota.fecha_vencimiento)}</p>
                          )}
                          <p>¿Deseas redirigir a tesorería para registrar este pago?</p>
                        </div>
                      ),
                      onOk: () => {
                        window.location.href = `/tesoreria/create?estudiante_id=${idEstudiante}&matricula_id=${record.id}&monto=${cuota.monto || 0}&periodo=${cuota.periodo_pagado || ''}`;
                      },
                    });
                  }
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 500 }}>
                  {etiqueta}
                </span>
                <span style={{ fontSize: 10, color: statusColor, marginTop: 2 }}>
                  {statusText}
                </span>
                {cuota.fecha_vencimiento && !isPagado && (
                  <span style={{ fontSize: 9, color: '#8c8c8c', marginTop: 1 }}>
                    {dayjs(cuota.fecha_vencimiento).format("DD-MMM")} 
                  </span>
                )}
              </Button>
            </Tooltip>
          );
        })}
      </Space>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 50, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Show
        title="Expediente no disponible"
        headerButtons={() => (
          <Button onClick={() => router.push("/estudiantes")}>← Volver a Lista</Button>
        )}
      >
        <Result
          status="404"
          title="No se encontró información"
          subTitle={loadError}
          extra={
            <Button type="primary" onClick={() => router.push("/estudiantes")}>
              Ir al listado de estudiantes
            </Button>
          }
        />
      </Show>
    );
  }

  return (
    <Show
      title={`Expediente Completo: ${perfil?.nombre_completo ?? "Estudiante"}`}
      headerButtons={() => (
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={cargarDatosCompletos}
            title="Refrescar datos"
          >
            Actualizar
          </Button>
          <Button onClick={() => router.push("/estudiantes")}>← Volver a Lista</Button>
        </Space>
      )}
    >
      <Card
        style={{
          marginBottom: 24,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          border: 0,
        }}
      >
        <Row align="middle" gutter={24}>
          <Col>
            <div style={{ position: "relative", display: "inline-block" }}>
              <Avatar
                size={100}
                style={{ backgroundColor: "#fff", color: "#667eea", fontSize: 40, cursor: perfil?.foto_url ? "pointer" : "default" }}
                icon={<UserOutlined />}
                src={perfil?.foto_url}
                onClick={() => {
                  if (perfil?.foto_url) {
                    setPreviewImage(perfil.foto_url);
                    setPreviewVisible(true);
                  }
                }}
              />
              <Upload
                showUploadList={false}
                beforeUpload={(file) => {
                  handleUploadPhoto(file);
                  return false;
                }}
                accept="image/*"
              >
                <Button
                  icon={<CameraOutlined />}
                  shape="circle"
                  size="small"
                  loading={uploadingPhoto}
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    backgroundColor: "#fff",
                    border: "2px solid #667eea",
                  }}
                />
              </Upload>
            </div>
          </Col>
          <Col flex={1}>
            <Title level={2} style={{ color: "#fff", margin: 0 }}>
              {perfil?.nombre_completo || "Sin nombre"}
            </Title>
            <div style={{ marginTop: 8 }}>
              <Tag icon={<IdcardOutlined />} color="purple" style={{ marginRight: 8 }}>
                {perfil?.identificacion || "Sin ID"}
              </Tag>
              <Tag icon={<MailOutlined />} color="purple">
                {perfil?.email || "Sin email"}
              </Tag>
              {perfil?.telefono && (
                <Tag icon={<PhoneOutlined />} color="purple" style={{ marginLeft: 8 }}>
                  {perfil.telefono}
                </Tag>
              )}
              {perfil?.telefono && (
                <Button
                  type="primary"
                  icon={<WhatsAppOutlined />}
                  onClick={handleWhatsAppClick}
                  style={{
                    backgroundColor: "#25D366",
                    borderColor: "#25D366",
                    marginLeft: 8,
                  }}
                  size="small"
                >
                  WhatsApp
                </Button>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* Alerta de matrículas pendientes de pago */}
      {matriculas.some(m => m.estado === "pendiente") && (
        <Alert
          message="⚠️ Inscripciones Pendientes de Pago"
          description={
            <div>
              <p>Este estudiante tiene inscripciones académicas registradas pero pendientes de pago:</p>
              <ul>
                {matriculas
                  .filter(m => m.estado === "pendiente")
                  .map(m => (
                    <li key={m.id}>
                      <strong>{construirNombreGrupo(m.cursos)}</strong>
                      {" - "}
                      <Button 
                        type="link" 
                        size="small"
                        onClick={() => router.push(`/matriculas/pago-inscripcion/${m.id}`)}
                      >
                        Ir a completar pago
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          }
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Cursos Inscritos"
              value={estadisticasGlobales.totalCursos}
              prefix={<BookOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
            <Text type="secondary">{estadisticasGlobales.cursosActivos} activos</Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Pagado"
              value={estadisticasGlobales.totalPagado}
              prefix="$"
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Deuda Pendiente"
              value={estadisticasGlobales.deudaTotal}
              prefix="$"
              valueStyle={{ color: estadisticasGlobales.deudaTotal > 0 ? "#ff4d4f" : "#52c41a" }}
            />
            {estadisticasGlobales.deudaTotal > 0 && (
              <Tag color="red" style={{ marginTop: 8 }}>
                Requiere pago
              </Tag>
            )}
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: "1",
              label: (
                <span>
                  <UserOutlined /> Información Personal
                </span>
              ),
              children: (
                <Descriptions bordered column={{ xs: 1, sm: 2 }}>
                  <Descriptions.Item label="Nombre Completo">
                    {perfil?.nombre_completo || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Identificación">
                    {perfil?.identificacion || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Fecha de Nacimiento">
                    {perfil?.fecha_nacimiento
                      ? formatDate(perfil.fecha_nacimiento)
                      : "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Género">
                    {perfil?.genero || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Talla camiseta">
                    {perfil?.talla_camiseta || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {perfil?.email || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Teléfono">
                    {perfil?.telefono || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label={
                    <>
                      <HomeOutlined /> Dirección
                    </>
                  } span={2}>
                    {perfil?.direccion || "No registrada"}
                  </Descriptions.Item>
                  <Descriptions.Item label={
                    <>
                      <TeamOutlined /> Acudiente
                    </>
                  }>
                    {perfil?.acudiente_nombre || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Teléfono Acudiente">
                    {perfil?.acudiente_telefono || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Observaciones" span={2}>
                    {perfil?.observaciones || "Ninguna"}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: "2",
              label: (
                <span>
                  <BookOutlined /> Cursos e Inscripciones
                </span>
              ),
              children: (
                <Table
                  dataSource={matriculas}
                  rowKey="id"
                  pagination={false}
                  columns={columnasCursos}
                />
              ),
            },
            {
              key: "3",
              label: (
                <span>
                  <DollarCircleOutlined /> Información Financiera
                </span>
              ),
              children: (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} sm={8}>
                      <Card>
                        <Statistic
                          title="Total Pagado"
                          value={estadisticasGlobales.totalPagado}
                          prefix="$"
                          valueStyle={{ color: "#52c41a" }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card>
                        <Statistic
                          title="Deuda Pendiente"
                          value={estadisticasGlobales.deudaTotal}
                          prefix="$"
                          valueStyle={{ color: estadisticasGlobales.deudaTotal > 0 ? "#ff4d4f" : "#52c41a" }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card>
                        <Statistic
                          title="Total a Pagar"
                          value={estadisticasGlobales.totalPagado + estadisticasGlobales.deudaTotal}
                          prefix="$"
                          valueStyle={{ color: "#1890ff" }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Title level={5}>Estado de Pagos por Curso</Title>
                  <Table
                    dataSource={matriculas}
                    rowKey="id"
                    pagination={false}
                    style={{ marginBottom: 24 }}
                    columns={[
                      {
                        title: "Curso",
                        dataIndex: ["cursos", "nombre"],
                        render: (_: string, record: any) => <Text strong>{construirNombreGrupo(record.cursos) || "Curso no asociado"}</Text>,
                      },
                      {
                        title: "Ciclos de Pago",
                        render: (_: any, record: any) => renderCuotasPorMatricula(record),
                        width: 600,
                      },
                    ]}
                  />

                  <Divider orientation="left">Historial Completo de Transacciones</Divider>
                  {pagosHistorialCompleto.length === 0 ? (
                    <Alert message="No hay pagos registrados para este estudiante" type="info" showIcon />
                  ) : (
                    <Table
                      dataSource={pagosHistorialCompleto}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                      columns={columnasPagos}
                    />
                  )}
                </>
              ),
            },
            {
              key: "4",
              label: (
                <span>
                  <CheckCircleOutlined /> Asistencia y Temas
                </span>
              ),
              children: (
                <Table
                  dataSource={asistenciasHistorial}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: "No hay asistencias registradas" }}
                  columns={[
                    {
                      title: "Fecha",
                      dataIndex: "fecha",
                      width: 130,
                      render: (val: string | null) => (val ? formatDate(val) : "-")
                    },
                    {
                      title: "N° Clase",
                      dataIndex: "clase_numero",
                      width: 110,
                      render: (val: number | null) => (val ? <Text strong>{val}</Text> : <Text type="secondary">-</Text>),
                    },
                    {
                      title: "Tema visto",
                      dataIndex: "tema_visto",
                      render: (val: string | null) => val || <Text type="secondary">-</Text>,
                    },
                    {
                      title: "Estado",
                      dataIndex: "estado",
                      width: 130,
                      render: (estado: string | null) => (
                        <Tag color={estado === "presente" ? "green" : "red"}>
                          {String(estado || "-").toUpperCase()}
                        </Tag>
                      ),
                    },
                    {
                      title: "Acciones",
                      key: "acciones",
                      width: 110,
                      render: (_: any, record: AsistenciaEstudiante) => (
                        <Popconfirm
                          title="¿Eliminar asistencia?"
                          description="Este cambio impacta panel profesor, panel estudiante y este perfil."
                          okText="Eliminar"
                          cancelText="Cancelar"
                          okButtonProps={{ danger: true, loading: deletingAsistenciaId === String(record.id) }}
                          onConfirm={() => eliminarAsistencia(String(record.id))}
                        >
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            loading={deletingAsistenciaId === String(record.id)}
                          >
                            Borrar
                          </Button>
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: "5",
              label: (
                <span>
                  <BookOutlined /> Materiales Entregados
                </span>
              ),
              children: (
                <HistorialEntregas estudianteId={idEstudiante} />
              ),
            },
          ]}
        />
      </Card>
      <Modal
        open={previewVisible}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
      >
        <Image
          alt="Foto de perfil"
          src={previewImage}
          width={600}
          height={600}
          style={{ width: "100%", height: "auto" }}
        />
      </Modal>
    </Show>
  );
}



