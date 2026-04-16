"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, Tabs, Table, Tag, Row, Col, Statistic, Button, Space, Typography, Spin, Alert, Modal, Form, Input, InputNumber, DatePicker, Upload, List, Empty, App, Select, Collapse, Grid } from "antd";
import type { Breakpoint } from "antd/es/_util/responsiveObserver";
import {
  UserOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  CalendarOutlined,
  ArrowLeftOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  BookOutlined,
  FileOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileWordOutlined,
  LinkOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  YoutubeOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  FormOutlined,
} from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";
import { construirNombreGrupo } from "@utils/grupos";
import { obtenerPensumPorProgramas, obtenerMaterialesPorProgramas, obtenerMaterialesClasePorProgramas } from "@modules/academico/pensum.service";

const { Title, Text } = Typography;

interface Student {
  id: number;
  nombre_completo: string;
  email: string;
  identificacion: string;
  estado: string;
  nota_final: number | null;
  asistencia_porcentaje: number;
  totalClases: number;
  presentes: number;
}

interface Tema {
  id: string;
  titulo: string;
  descripcion?: string;
  orden?: number;
  numero_ciclo?: number;
  nombre_ciclo?: string;
  created_at?: string;
}

interface Sesion {
  id: string;
  fecha: string;
  horas_dictadas: number;
  tema_visto?: string;
  asistencia?: number;
  observaciones?: string;
}

const dedupeByKey = <T,>(items: T[] = [], keySelector: (item: T) => string): T[] => {
  const map = new Map<string, T>();
  items.forEach((item) => {
    const key = keySelector(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
};

type ParamsLike = Promise<{ id: string }>;

export default function CursoShowPage({ params }: { params: ParamsLike }) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;
  const { message, modal } = App.useApp();
  const [cursoId, setCursoId] = useState<string>("");
  const [curso, setCurso] = useState<any>(null);
  const [estudiantes, setEstudiantes] = useState<Student[]>([]);
  const [notaEdicion, setNotaEdicion] = useState<Record<string, number | null>>({});
  const [estadoEdicion, setEstadoEdicion] = useState<Record<string, string>>({});
  const [savingNotaId, setSavingNotaId] = useState<string | null>(null);
  const [calificacionesTema, setCalificacionesTema] = useState<Record<string, Record<string, number | null>>>({});
  const [savingCalificacionId, setSavingCalificacionId] = useState<string | null>(null);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [materiales, setMateriales] = useState<any[]>([]);
  const [materialesClase, setMaterialesClase] = useState<any[]>([]);
  const [quizzesClase, setQuizzesClase] = useState<any[]>([]);
  const [resultadosQuiz, setResultadosQuiz] = useState<any[]>([]);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalSesionVisible, setModalSesionVisible] = useState(false);
  const [formSesion] = Form.useForm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminView = searchParams?.get("admin") === "1";
  const returnTo = isAdminView ? "/cursos" : "/mi-oficina";

  const materialesUnicos = useMemo(
    () =>
      dedupeByKey(materiales, (mat: any) =>
        String(
          `${mat.pensum_id ?? ""}-${mat.titulo ?? mat.nombre_archivo ?? ""}-${mat.url_archivo ?? ""}-${
            mat.descripcion ?? ""
          }-${mat.tipo_material ?? ""}-${mat.orden ?? ""}`,
        ).toLowerCase(),
      ),
    [materiales],
  );

  const materialesClaseUnicos = useMemo(
    () =>
      dedupeByKey(materialesClase, (mat: any) =>
        String(
          `${mat.pensum_curso_id ?? ""}-${mat.nombre_material ?? ""}-${mat.cantidad ?? ""}-${
            mat.unidad ?? ""
          }-${mat.obligatorio ?? ""}-${mat.observaciones ?? ""}`,
        ).toLowerCase(),
      ),
    [materialesClase],
  );

  const parseTemaFromTitulo = (titulo: string) => {
    const match = titulo.match(/^\s*(?:\[?tema[:\-]\s*)(.+?)(?:\]|—|–|-|:)\s*(.+)?$/i);
    if (!match) return { tema: undefined, tituloLimpio: titulo };
    const tema = match[1]?.trim();
    const tituloLimpio = (match[2] || titulo).trim();
    return { tema, tituloLimpio };
  };

  const normalizarTema = (valor?: string) =>
    String(valor || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/^\d+\s*[\.)\-:]\s*/, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const ciclosOrdenados = useMemo(() => {
    const list = Array.isArray(temas) ? temas.slice() : [];
    return list.sort((a: any, b: any) => {
      const ordenA = Number(a?.orden ?? a?.numero_ciclo ?? 0);
      const ordenB = Number(b?.orden ?? b?.numero_ciclo ?? 0);
      if (ordenA !== ordenB) return ordenA - ordenB;
      return Number(a?.id ?? 0) - Number(b?.id ?? 0);
    });
  }, [temas]);

  const temasPorCiclo = useMemo(() => {
    const map = new Map<string, any[]>();
    ciclosOrdenados.forEach((ciclo: any) => {
      const cicloId = String(ciclo?.id ?? "sin-ciclo");
      const temasCiclo = Array.isArray(ciclo?.pensum_cursos) ? ciclo.pensum_cursos.slice() : [];
      temasCiclo.sort((a: any, b: any) => {
        const ordenA = Number(a?.orden ?? 0);
        const ordenB = Number(b?.orden ?? 0);
        if (ordenA !== ordenB) return ordenA - ordenB;
        return Number(a?.id ?? 0) - Number(b?.id ?? 0);
      });
      if (temasCiclo.length) {
        map.set(cicloId, temasCiclo);
      }
    });

    materialesClaseUnicos.forEach((item: any) => {
      const tema = item?.pensum_cursos;
      if (!tema?.id) return;
      const cicloId = String(item?.pensum_id ?? tema?.pensum_id ?? "sin-ciclo");
      const current = map.get(cicloId) ?? [];
      if (!current.find((t: any) => String(t.id) === String(tema.id))) {
        current.push(tema);
        current.sort((a: any, b: any) => {
          const ordenA = Number(a?.orden ?? 0);
          const ordenB = Number(b?.orden ?? 0);
          if (ordenA !== ordenB) return ordenA - ordenB;
          return Number(a?.id ?? 0) - Number(b?.id ?? 0);
        });
        map.set(cicloId, current);
      }
    });

    return map;
  }, [ciclosOrdenados, materialesClaseUnicos]);

  const temasPorNombre = useMemo(() => {
    const map = new Map<string, string>();
    ciclosOrdenados.forEach((ciclo: any) => {
      const temasCiclo = Array.isArray(ciclo?.pensum_cursos) ? ciclo.pensum_cursos : [];
      temasCiclo.forEach((tema: any) => {
        const nombre = tema?.nombre_curso || tema?.titulo || "";
        const key = normalizarTema(nombre);
        if (key) map.set(key, String(tema.id));
      });
    });
    return map;
  }, [ciclosOrdenados]);

  const nombreTemaPorId = useMemo(() => {
    const map = new Map<string, string>();
    ciclosOrdenados.forEach((ciclo: any) => {
      const temasCiclo = Array.isArray(ciclo?.pensum_cursos) ? ciclo.pensum_cursos : [];
      temasCiclo.forEach((tema: any) => {
        const key = String(tema?.id || "");
        if (!key) return;
        map.set(key, String(tema?.nombre_curso || tema?.titulo || "Tema"));
      });
    });
    return map;
  }, [ciclosOrdenados]);

  const materialesNecesariosPorTema = useMemo(() => {
    const map = new Map<string, any[]>();
    materialesClaseUnicos.forEach((item: any) => {
      const temaId = String(item?.pensum_curso_id ?? "sin-tema");
      const current = map.get(temaId) ?? [];
      current.push(item);
      map.set(temaId, current);
    });
    return map;
  }, [materialesClaseUnicos]);

  const materialesDidacticosPorTema = useMemo(() => {
    const map = new Map<string, any[]>();
    materialesUnicos.forEach((item: any) => {
      const temaIdDirecto = item?.pensum_curso_id ?? item?.pensum_cursos?.id;
      let temaId = temaIdDirecto ? String(temaIdDirecto) : "";
      if (!temaId) {
        const tituloMaterial = String(item?.titulo || item?.nombre_archivo || "");
        const { tema } = parseTemaFromTitulo(tituloMaterial);
        const temaKey = normalizarTema(tema);
        if (temaKey && temasPorNombre.has(temaKey)) {
          temaId = String(temasPorNombre.get(temaKey));
        }
      }
      const finalTemaId = temaId || "sin-tema";
      const current = map.get(finalTemaId) ?? [];
      current.push(item);
      map.set(finalTemaId, current);
    });
    return map;
  }, [materialesUnicos, temasPorNombre]);

  const materialesDidacticosPorCiclo = useMemo(() => {
    const map = new Map<string, any[]>();
    materialesUnicos.forEach((item: any) => {
      const cicloId = String(item?.pensum_id ?? "sin-ciclo");
      const current = map.get(cicloId) ?? [];
      current.push(item);
      map.set(cicloId, current);
    });
    return map;
  }, [materialesUnicos]);

  const getMaterialIcon = (material: any) => {
    const tipo = String(material?.tipo_material || "").toLowerCase();
    const url = String(material?.url_archivo || "").toLowerCase();
    const titulo = String(material?.titulo || material?.nombre_archivo || "").toLowerCase();
    const texto = `${tipo} ${url} ${titulo}`;

    if (texto.includes("canva.com")) return <LinkOutlined />;
    if (texto.includes("youtube.com") || texto.includes("youtu.be")) return <YoutubeOutlined />;
    if (texto.match(/\.(mp4|mov|avi|mkv|webm)$/) || texto.includes("video")) return <PlayCircleOutlined />;
    if (texto.match(/\.(png|jpg|jpeg|gif|webp|svg)$/) || texto.includes("imagen")) return <PictureOutlined />;
    if (texto.match(/\.(xlsx|xls|csv)$/) || texto.includes("excel") || texto.includes("sheet")) return <FileExcelOutlined />;
    if (texto.match(/\.(ppt|pptx)$/) || texto.includes("powerpoint") || texto.includes("diapositiva")) return <FilePptOutlined />;
    if (texto.match(/\.(doc|docx)$/) || texto.includes("word")) return <FileWordOutlined />;
    if (texto.match(/\.pdf$/) || texto.includes("pdf")) return <FileTextOutlined />;
    if (url.startsWith("http")) return <LinkOutlined />;
    return <FileOutlined />;
  };

  const abrirMaterial = (material: any) => {
    const url = material?.url_archivo;
    if (!url) {
      message.warning("Este material no tiene enlace disponible");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const guardarNota = useCallback(
    async (matriculaId: string | number, nota: number | null, estado: string) => {
      if (nota == null || Number.isNaN(nota)) {
        message.warning("Ingresa una nota válida (0 a 5)");
        return;
      }
      setSavingNotaId(String(matriculaId));
      try {
        const { error } = await supabaseBrowserClient
          .from("matriculas")
          .update({ nota_final: nota, estado })
          .eq("id", matriculaId);

        if (error) {
          message.error("Error guardando nota: " + error.message);
        } else {
          message.success("Nota actualizada");
          setEstudiantes((prev) =>
            prev.map((est) =>
              est.id === matriculaId ? { ...est, nota_final: nota, estado } : est
            )
          );
        }
      } catch (err) {
        console.error(err);
        message.error("Error inesperado guardando nota");
      } finally {
        setSavingNotaId(null);
      }
    },
    [message]
  );

  const guardarNotaTema = useCallback(
    async (temaId: string | number, matriculaId: string | number, nota: number | null) => {
      if (nota == null || Number.isNaN(nota)) {
        message.warning("Ingresa una nota válida (0 a 5)");
        return;
      }

      const matriculaIdNumerico = Number(matriculaId);
      if (!Number.isFinite(matriculaIdNumerico)) {
        message.error("No se pudo guardar la nota: matrícula inválida.");
        return;
      }

      const temaActual = temas.find((t) => String(t.id) === String(temaId));
      const conceptoTema = `Tema: ${temaActual?.nombre_ciclo || temaActual?.titulo || String(temaId)}`;
      const temaIdTexto = String(temaId || "").trim();
      const temaIdEsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(temaIdTexto);
      const key = `${temaId}-${matriculaId}`;
      setSavingCalificacionId(key);
      try {
        const payload: any = {
          matricula_id: matriculaIdNumerico,
          concepto: conceptoTema,
          nota,
          calificacion: nota,
          tipo_evaluacion: "tema",
          fecha_evaluacion: dayjs().format("YYYY-MM-DD"),
        };
        if (temaIdEsUuid) {
          payload.tema_id = temaIdTexto;
        }

        let queryExistente = supabaseBrowserClient
          .from("calificaciones")
          .select("id")
          .eq("matricula_id", matriculaIdNumerico);

        if (temaIdEsUuid) {
          queryExistente = queryExistente.eq("tema_id", temaIdTexto);
        } else {
          queryExistente = queryExistente
            .eq("tipo_evaluacion", "tema")
            .eq("concepto", conceptoTema);
        }

        const { data: existente, error: errExistente } = await queryExistente.maybeSingle();

        if (errExistente) {
          message.error("Error validando nota de tema: " + errExistente.message);
          return;
        }

        if (existente?.id) {
          const { error: errUpdate } = await supabaseBrowserClient
            .from("calificaciones")
            .update({
              concepto: conceptoTema,
              nota,
              calificacion: nota,
              tipo_evaluacion: "tema",
              fecha_evaluacion: dayjs().format("YYYY-MM-DD"),
            })
            .eq("id", existente.id);

          if (errUpdate) {
            message.error("Error actualizando nota de tema: " + errUpdate.message);
            return;
          }
        } else {
          const { error: errInsert } = await supabaseBrowserClient
            .from("calificaciones")
            .insert(payload);

          if (errInsert) {
            const detalle = [errInsert.message, errInsert.details, errInsert.hint]
              .filter(Boolean)
              .join(" | ");
            message.error("Error guardando nota de tema: " + detalle);
            return;
          }
        }

        setCalificacionesTema((prev) => ({
          ...prev,
          [String(temaId)]: {
            ...(prev[String(temaId)] || {}),
            [String(matriculaId)]: nota,
          },
        }));
        message.success("Nota guardada");
      } catch (err) {
        console.error(err);
        message.error("Error inesperado guardando nota de tema");
      } finally {
        setSavingCalificacionId(null);
      }
    },
    [message, temas]
  );

  // Resolver params si es una Promise
  useEffect(() => {
    (async () => {
      if (params instanceof Promise) {
        const resolvedParams = await params;
        setCursoId(resolvedParams.id);
      } else {
        setCursoId((params as any).id);
      }
    })();
  }, [params]);
  const [activeTab, setActiveTab] = useState("1");

  // Memoized columns to avoid re-creation on every render
  const columnasSesiones = useMemo(
    () => [
      {
        title: "Fecha",
        dataIndex: "fecha",
        width: 120,
        render: (fecha: string) => dayjs(fecha).format("DD MMM YYYY"),
        sorter: (a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
      },
      {
        title: "Tema",
        dataIndex: "tema_visto",
        ellipsis: true,
        width: isMobile ? 200 : undefined,
        render: (tema: string) => (tema ? <Tag>{tema}</Tag> : <Text type="secondary">-</Text>),
      },
      {
        title: "Horas Dictadas",
        dataIndex: "horas_dictadas",
        width: 140,
        align: "center" as const,
        render: (horas: number) => <Tag color="blue">{horas}h</Tag>,
      },
      {
        title: "Observaciones",
        dataIndex: "observaciones",
        responsive: ["md"] as Breakpoint[],
        ellipsis: true,
        render: (obs: string) => (obs ? <Text type="secondary">{obs}</Text> : <Text type="secondary">-</Text>),
      },
    ],
    [isMobile]
  );

  const estadoOptions = useMemo(
    () => [
      "aprobado",
      "certificado",
      "en curso",
      "activo",
      "reprobado",
      "pendiente_pago",
    ],
    []
  );

  const columnasCalificaciones = useMemo(
    () => [
      {
        title: "Nombre",
        dataIndex: "nombre_completo",
        render: (text: string, record: any) => (
          <Space direction="vertical" size={0}>
            <Text strong>{text}</Text>
            {record.estado === "pendiente_pago" ? (
              <Tag color="default">PENDIENTE PAGO</Tag>
            ) : null}
          </Space>
        ),
      },
      {
        title: "Nota Final",
        dataIndex: "nota_final",
        render: (nota: number, record: any) => {
          if (!nota) return <Text type="secondary">Pendiente</Text>;
          let color = "success";
          if (nota < 3) color = "error";
          if (nota < 4) color = "warning";
          return <Tag color={record.estado === "pendiente_pago" ? "default" : color}>{nota.toFixed(1)}/5.0</Tag>;
        },
        width: 120,
      },
      {
        title: "Estado",
        dataIndex: "estado",
        render: (estado: string) => {
          let color = "default";
          if (estado === "aprobado" || estado === "certificado") color = "success";
          if (estado === "activo") color = "processing";
          return <Tag color={color}>{estado?.toUpperCase()}</Tag>;
        },
        width: 140,
      },
      {
        title: "Calificar",
        render: (_: any, record: any) => {
          const currentNota = notaEdicion[String(record.id)] ?? record.nota_final ?? null;
          const currentEstado = estadoEdicion[String(record.id)] ?? record.estado ?? "en curso";
          const habilitado = currentEstado !== "pendiente_pago";
          const disabled = currentNota == null || Number.isNaN(currentNota) || !habilitado;
          return (
            <Space direction="vertical" size={8}>
              <InputNumber
                min={0}
                max={5}
                step={0.1}
                value={currentNota}
                disabled={!habilitado}
                onChange={(value) => setNotaEdicion((prev) => ({ ...prev, [record.id]: value === null ? null : Number(value) }))}
                style={{ width: 120 }}
              />
              <Select
                size="small"
                value={currentEstado}
                onChange={(value) => setEstadoEdicion((prev) => ({ ...prev, [record.id]: value }))}
                style={{ width: 140 }}
                options={estadoOptions.map((opt) => ({ label: opt.toUpperCase(), value: opt }))}
              />
              <Button
                type="primary"
                size="small"
                loading={savingNotaId === String(record.id)}
                disabled={disabled}
                onClick={() => guardarNota(record.id, currentNota, currentEstado)}
              >
                Guardar
              </Button>
            </Space>
          );
        },
        width: 200,
      },
    ],
    [estadoEdicion, estadoOptions, notaEdicion, savingNotaId, guardarNota]
  );

  const cargarDatos = useCallback(async (id: string) => {
    setLoading(true);
    try {
      let matriculaIdsCurso: number[] = [];

      // Curso
      const { data: cursoData, error: errorCurso } = await supabaseBrowserClient
        .from("cursos")
        .select("*")
        .eq("id", parseInt(id))
        .maybeSingle();
      
      if (errorCurso || !cursoData) {
        console.error("Error cargando curso:", errorCurso || { message: "Curso no encontrado" });
        setLoading(false);
        return;
      }

      // Profesor
      let cursoConProfesor = cursoData;
      if (cursoData?.profesor_id) {
        const { data: profesorData } = await supabaseBrowserClient
          .from("perfiles")
          .select("nombre_completo")
          .eq("id", cursoData.profesor_id)
          .single();
        cursoConProfesor = { ...cursoData, perfiles: profesorData };
      }
      
      setCurso(cursoConProfesor);

      // Estudiantes
      const { data: matriculasData } = await supabaseBrowserClient
        .from("matriculas")
        .select("id, estudiante_id, estado, nota_final")
        .eq("curso_id", parseInt(id));

      if (matriculasData) {
        const estudiantesConAsistencia = await Promise.all(
          matriculasData.map(async (matricula: any) => {
            // Obtener datos del estudiante
            const { data: estudiante } = await supabaseBrowserClient
              .from("perfiles")
              .select("nombre_completo, email, identificacion")
              .eq("id", matricula.estudiante_id)
              .single();

            // Obtener asistencia
            const { data: asistencias } = await supabaseBrowserClient
              .from("asistencias")
              .select("estado")
              .eq("matricula_id", matricula.id);

            const totalClases = asistencias?.length || 0;
            const presentes = asistencias?.filter(a => a.estado === "presente").length || 0;
            const porcentaje = totalClases > 0 ? (presentes / totalClases) * 100 : 0;

            return {
              id: matricula.id,
              nombre_completo: estudiante?.nombre_completo || "Sin nombre",
              email: estudiante?.email || "-",
              identificacion: estudiante?.identificacion || "-",
              estado: matricula.estado,
              nota_final: matricula.nota_final,
              asistencia_porcentaje: Math.round(porcentaje),
              totalClases,
              presentes
            };
          })
        );
        setEstudiantes(estudiantesConAsistencia);
        const notasIniciales: Record<string, number | null> = {};
        const estadosIniciales: Record<string, string> = {};
        estudiantesConAsistencia.forEach((est) => {
          notasIniciales[String(est.id)] = est.nota_final ?? null;
          estadosIniciales[String(est.id)] = est.estado;
        });
        setNotaEdicion(notasIniciales);
        setEstadoEdicion(estadosIniciales);

        const matriculaIds = estudiantesConAsistencia.map((e) => e.id);
        matriculaIdsCurso = matriculaIds;
        if (matriculaIds.length > 0) {
          const { data: califData } = await supabaseBrowserClient
            .from("calificaciones")
            .select("matricula_id, tema_id, nota, calificacion")
            .in("matricula_id", matriculaIds);

          const mapa: Record<string, Record<string, number | null>> = {};
          (califData || []).forEach((c: any) => {
            const temaKey = String(c.tema_id);
            const matKey = String(c.matricula_id);
            const valor = c.calificacion ?? c.nota ?? null;
            if (!mapa[temaKey]) mapa[temaKey] = {};
            mapa[temaKey][matKey] = valor;
          });
          setCalificacionesTema(mapa);
        }
      }

      // Temario desde programa académico
      if (cursoConProfesor?.programa_id) {
        const programaIds = [String(cursoConProfesor.programa_id)];

        const [temasData, materialesData, materialesClaseData] = await Promise.all([
          obtenerPensumPorProgramas(programaIds),
          obtenerMaterialesPorProgramas(programaIds),
          obtenerMaterialesClasePorProgramas(programaIds),
        ]);

        setTemas(temasData || []);
        setMateriales(materialesData || []);
        setMaterialesClase(materialesClaseData || []);

        const { data: quizzesData } = await supabaseBrowserClient
          .from("quizzes_clase")
          .select("id, programa_id, pensum_curso_id, titulo, total_preguntas, activo, publicado")
          .eq("programa_id", Number(cursoConProfesor.programa_id))
          .eq("activo", true)
          .order("created_at", { ascending: false });

        setQuizzesClase(quizzesData || []);

        if (matriculaIdsCurso.length > 0 && (quizzesData || []).length > 0) {
          const quizIds = (quizzesData || []).map((quiz: any) => quiz.id);
          const { data: intentosData } = await supabaseBrowserClient
            .from("quiz_intentos_clase")
            .select("id, quiz_id, matricula_id, respuestas_correctas, total_preguntas, calificacion, enviado_at")
            .in("quiz_id", quizIds)
            .in("matricula_id", matriculaIdsCurso)
            .order("enviado_at", { ascending: false });

          setResultadosQuiz(intentosData || []);
        } else {
          setResultadosQuiz([]);
        }
      } else {
        setTemas([]);
        setMateriales([]);
        setMaterialesClase([]);
        setQuizzesClase([]);
        setResultadosQuiz([]);
      }

      // Sesiones de clase
      const { data: sesionesData } = await supabaseBrowserClient
        .from("sesiones_clase")
        .select("*")
        .eq("curso_id", parseInt(id))
        .order("fecha", { ascending: false });
      setSesiones(sesionesData || []);
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      if (resolved?.id) {
        setCursoId(resolved.id);
        cargarDatos(resolved.id);
      }
    };
    resolveParams();
  }, [params, cargarDatos]);

  const columnasEstudiantes = useMemo(
    () => [
      {
        title: "Nombre",
        dataIndex: "nombre_completo",
        ellipsis: true,
        width: isMobile ? 160 : 220,
        render: (text: string) => <Text strong>{text}</Text>,
      },
      { title: "Identificación", dataIndex: "identificacion", width: 150, responsive: ["md"] as Breakpoint[] },
      { title: "Email", dataIndex: "email", ellipsis: true, responsive: ["lg"] as Breakpoint[] },
      {
        title: "Estado",
        dataIndex: "estado",
        responsive: ["sm"] as Breakpoint[],
        render: (estado: string) => {
          let color = "default";
          if (estado === "activo") color = "success";
          if (estado === "aprobado" || estado === "certificado") color = "blue";
          if (estado === "cancelado") color = "error";
          return <Tag color={color}>{estado?.toUpperCase()}</Tag>;
        },
        width: 120,
      },
      {
        title: "Asistencia",
        dataIndex: "asistencia_porcentaje",
        render: (porcentaje: number) => {
          let color = "success";
          if (porcentaje < 80) color = "warning";
          if (porcentaje < 70) color = "error";
          return <Tag color={color}>{porcentaje}%</Tag>;
        },
        width: 100,
        sorter: (a: any, b: any) => a.asistencia_porcentaje - b.asistencia_porcentaje,
      },
    ],
    [isMobile]
  );

  const handleDeleteCurso = async () => {
    modal.confirm({
      title: "¿Ocultar este grupo?",
      content: (
        <div>
          <p>Se quitará el grupo de las vistas, pero se conservará todo el historial:</p>
          <ul>
            <li>Pagos y matrículas</li>
            <li>Horas dictadas</li>
            <li>Asistencias y notas</li>
          </ul>
          <p>Recomendado cuando no quieres que aparezca en listados pero necesitas mantener los datos.</p>
        </div>
      ),
      okText: "Ocultar grupo",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const { error } = await supabaseBrowserClient
            .from("cursos")
            .update({ estado: "eliminado" })
            .eq("id", parseInt(cursoId));
          if (error) throw error;
          message.success("Grupo ocultado. El historial se mantiene.");
          router.push("/cursos");
        } catch (error: any) {
          message.error("No se pudo ocultar el grupo");
          console.error(error);
        }
      },
    });
  };

  const handleToggleEstadoGrupo = async () => {
    const esActivo = curso.estado === "activo";
    const nuevoEstado = esActivo ? "finalizado" : "activo";
    const accion = esActivo ? "finalizar" : "reactivar";

    try {
      if (esActivo) {
        const activos = estudiantes.filter(e => e.estado === "activo");
        if (activos.length > 0) {
          modal.warning({
            title: "No se puede finalizar el grupo",
            content: (
              <div>
                <p>Este grupo tiene <strong>{activos.length} estudiantes activos</strong>. Antes de finalizarlo debes:</p>
                <ol>
                  <li>En esta misma vista, usar los botones en la lista de estudiantes</li>
                  <li>Marcar las matrículas como completada, cancelada o retirada según corresponda</li>
                  <li>Una vez que todas las matrículas estén cerradas, podrás finalizar el grupo</li>
                </ol>
                <p><strong>Estudiantes activos:</strong></p>
              </div>
            ),
            okText: "Entendido",
          });
          return;
        }
      }

      modal.confirm({
        title: esActivo ? "¿Finalizar este grupo?" : "¿Reactivar este grupo?",
        content: esActivo ? (
          <div>
            <p>Estás a punto de <strong>finalizar</strong> el grupo:</p>
            <p><strong>{curso.nombre}</strong></p>
            <p>¿Qué sucede al finalizar?</p>
            <ul>
              <li>El grupo desaparecerá de la lista principal</li>
              <li>No aparecerá al crear nuevas matrículas</li>
              <li>Todo el historial se mantiene intacto</li>
              <li>Las matrículas existentes se conservan</li>
              <li>Podrás reactivarlo si es necesario</li>
            </ul>
          </div>
        ) : (
          <div>
            <p>Estás a punto de <strong>reactivar</strong> el grupo:</p>
            <p><strong>{curso.nombre}</strong></p>
            <p>El grupo volverá a estar disponible para nuevas inscripciones.</p>
          </div>
        ),
        okText: esActivo ? "Sí, finalizar" : "Sí, reactivar",
        okType: esActivo ? "default" : "primary",
        cancelText: "Cancelar",
        onOk: async () => {
          const { error } = await supabaseBrowserClient
            .from("cursos")
            .update({ estado: nuevoEstado })
            .eq("id", parseInt(cursoId));
          if (error) throw error;
          message.success(`Grupo ${nuevoEstado === 'activo' ? 'reactivado' : 'finalizado'} correctamente`);
          await cargarDatos(cursoId);
        },
      });
    } catch (error: any) {
      message.error(`Error al ${accion} el grupo`);
      console.error(error);
    }
  };

  const onAddSesion = async (values: any) => {
    try {
      const { error } = await supabaseBrowserClient
        .from("sesiones_clase")
        .insert({
          curso_id: parseInt(cursoId),
          profesor_id: curso.profesor_id,
          fecha: values.fecha.format("YYYY-MM-DD"),
          horas_dictadas: values.horas_dictadas,
          tema_visto: values.tema_visto,
          observaciones: values.observaciones
        });

      if (error) throw error;
      formSesion.resetFields();
      setModalSesionVisible(false);
      await cargarDatos(cursoId);
    } catch (error) {
      console.error("Error agregando sesión:", error);
    }
  };

  if (loading) {
    return <div style={{ padding: 50, textAlign: "center" }}><Spin size="large" /></div>;
  }

  if (!curso) {
    return (
      <Card style={{ padding: 50 }}>
        <Alert message="Curso no encontrado" type="error" />
      </Card>
    );
  }

  const totalEstudiantes = estudiantes.length;
  const estudiantesActivos = estudiantes.filter(e => e.estado === "activo").length;
  const promedioAsistencia = estudiantes.length > 0
    ? Math.round(estudiantes.reduce((sum, e) => sum + e.asistencia_porcentaje, 0) / estudiantes.length)
    : 0;
  const estudiantesEnRiesgo = estudiantes.filter(e => e.asistencia_porcentaje < (curso.porcentaje_minimo || 80)).length;
  const notas = estudiantes.filter((e) => e.nota_final !== null && e.nota_final !== undefined);
  const promedioNota = notas.length > 0
    ? (notas.reduce((sum, e) => sum + (e.nota_final || 0), 0) / notas.length)
    : 0;
  const cuposTotales = curso.cupos || 0;
  const cuposOcupados = totalEstudiantes;

  return (
    <div style={{ padding: 24 }}>
      {/* ENCABEZADO - OFICINA DEL PROFESOR */}
      <div
        style={{
          marginBottom: 28,
          background: "linear-gradient(135deg, #4057d6 0%, #6d3fb0 100%)",
          color: "white",
          padding: 28,
          borderRadius: 14,
          boxShadow: "0 14px 30px -18px rgba(44, 52, 124, 0.7)",
        }}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={20}>
          <Space wrap size={20} style={{ alignItems: "center" }}>
            <Button
              type="primary"
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push(returnTo)}
              style={{
                background: "rgba(15, 23, 42, 0.28)",
                borderColor: "rgba(255,255,255,0.35)",
                color: "#fff",
                fontWeight: 600,
              }}
            >
              Volver
            </Button>
            <Title level={2} style={{ margin: 0, color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
              {construirNombreGrupo(curso)}
            </Title>
            <Space wrap size={20} style={{ marginTop: 4 }}>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => router.push(`/asistencias/create?curso_id=${cursoId}&curso_nombre=${encodeURIComponent(construirNombreGrupo(curso))}`)}
                style={{ fontWeight: 600 }}
              >
                Llamar Lista
              </Button>
              <Button icon={<FormOutlined />} onClick={() => setActiveTab("5")} style={{ fontWeight: 600 }}>
                Calificar Tareas
              </Button>
              {isAdminView && (
                <>
                  <Button icon={<EditOutlined />} onClick={() => router.push(`/cursos/edit/${cursoId}`)}>
                    Editar curso
                  </Button>
                  <Button danger icon={<DeleteOutlined />} onClick={handleDeleteCurso}>
                    Eliminar curso
                  </Button>
                  {curso.estado === 'activo' && (
                    <Tag color="blue" style={{ marginLeft: 8 }}>{estudiantesActivos} activos</Tag>
                  )}
                  <Button 
                    type={curso.estado === 'activo' ? 'default' : 'primary'}
                    danger={curso.estado === 'activo'}
                    onClick={handleToggleEstadoGrupo}
                  >
                    {curso.estado === 'activo' ? 'Finalizar Grupo' : 'Reactivar Grupo'}
                  </Button>
                </>
              )}
            </Space>
          </Space>
          <div>
          {/* RESUMEN RÁPIDO DEL CURSO */}
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={12} md={6}>
              <Card
                size="small"
                style={{ background: "rgba(15, 23, 42, 0.22)", borderColor: "rgba(255,255,255,0.22)" }}
                styles={{ body: { padding: 14 } }}
              >
                <Statistic
                  title={<span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>Estudiantes</span>}
                  value={`${estudiantesActivos}/${totalEstudiantes}`}
                  suffix="activos"
                  valueStyle={{ color: "#fff", fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card
                size="small"
                style={{ background: "rgba(15, 23, 42, 0.22)", borderColor: "rgba(255,255,255,0.22)" }}
                styles={{ body: { padding: 14 } }}
              >
                <Statistic
                  title={<span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>Promedio asistencia</span>}
                  value={promedioAsistencia}
                  suffix="%"
                  valueStyle={{ color: "#fff", fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card
                size="small"
                style={{ background: "rgba(15, 23, 42, 0.22)", borderColor: "rgba(255,255,255,0.22)" }}
                styles={{ body: { padding: 14 } }}
              >
                <Statistic
                  title={<span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>Promedio nota</span>}
                  value={promedioNota}
                  precision={1}
                  suffix="/5"
                  valueStyle={{ color: "#fff", fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card
                size="small"
                style={{ background: "rgba(15, 23, 42, 0.22)", borderColor: "rgba(255,255,255,0.22)" }}
                styles={{ body: { padding: 14 } }}
              >
                <Statistic
                  title={<span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>Cupos</span>}
                  value={cuposOcupados}
                  suffix={cuposTotales ? `/ ${cuposTotales}` : ""}
                  valueStyle={{ color: "#fff", fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>

          <Card
            size="small"
            style={{ marginBottom: 16, background: "rgba(15, 23, 42, 0.2)", borderColor: "rgba(255,255,255,0.22)" }}
          >
            <Space direction="vertical">
              <Text style={{ color: "#ffffff" }}><strong>Horario:</strong> {curso.dias_semana || "-"} {curso.hora_inicio && `• ${dayjs(curso.hora_inicio, 'HH:mm:ss').format('h:mm A')}`} {curso.hora_fin && ` - ${dayjs(curso.hora_fin, 'HH:mm:ss').format('h:mm A')}`}</Text>
              <Text style={{ color: "#f8fafc" }}><strong>Fecha de inicio:</strong> {curso.fecha_inicio ? dayjs(curso.fecha_inicio).format('DD MMM YYYY') : "-"}</Text>
              <Text style={{ color: "#f8fafc" }}><strong>Fecha de fin:</strong> {curso.fecha_fin ? dayjs(curso.fecha_fin).format('DD MMM YYYY') : "No definida"}</Text>
            </Space>
          </Card>
          <Text style={{ color: "rgba(255,255,255,0.94)", fontSize: 15 }}>
              👨‍🏫 Profesor: <strong>{curso.perfiles?.nombre_completo || "Sin asignar"}</strong> • 📅 Inicio: {dayjs(curso.fecha_inicio).format("DD MMM YYYY")} • ⏱️ Duración: {curso.duracion}
          </Text>
          </div>
        </Space>
      </div>

      {/* ESTADÍSTICAS RÁPIDAS */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="Estudiantes" value={totalEstudiantes} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="Activos" value={estudiantesActivos} valueStyle={{ color: "#52c41a" }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="Asistencia" value={promedioAsistencia} suffix="%" valueStyle={{ color: promedioAsistencia >= 80 ? "#52c41a" : "#ff4d4f" }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="En Riesgo" value={estudiantesEnRiesgo} valueStyle={{ color: estudiantesEnRiesgo > 0 ? "#ff4d4f" : "#52c41a" }} />
          </Card>
        </Col>
      </Row>

      {/* TABS - OFICINA COMPLETA DEL PROFESOR */}
      <Tabs
        type="card"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "1",
            label: <span><BookOutlined /> Pensum ({temas.length})</span>,
            children: (
              <Card
                title="Contenido del Curso - Pensum"
                extra={isAdminView ? (
                  <Button type="primary" icon={<BookOutlined />} onClick={() => router.push("/programas")}>
                    Gestionar en Programas
                  </Button>
                ) : null}
              >
                {ciclosOrdenados.length > 0 ? (
                  <Collapse
                    accordion
                    expandIconPosition="end"
                    items={ciclosOrdenados.map((ciclo: any, index: number) => {
                      const cicloId = String(ciclo?.id ?? "sin-ciclo");
                      const cicloNumero = ciclo?.numero_ciclo ?? ciclo?.orden ?? index + 1;
                      const cicloNombre = ciclo?.nombre_ciclo || ciclo?.titulo || `Ciclo ${cicloNumero}`;
                      const temasCiclo = temasPorCiclo.get(cicloId) ?? [];

                      return {
                        key: cicloId,
                        label: (
                          <Space size={16} align="center">
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 16,
                                background: "#2563eb",
                                color: "#f8fafc",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 22,
                                fontWeight: 700,
                              }}
                            >
                              {cicloNumero}
                            </div>
                            <div>
                              <Text strong style={{ fontSize: 16 }}>{cicloNombre}</Text>
                              {ciclo?.descripcion ? (
                                <div>
                                  <Text type="secondary">{ciclo.descripcion}</Text>
                                </div>
                              ) : null}
                            </div>
                          </Space>
                        ),
                        children: temasCiclo.length ? (
                          <List
                            dataSource={temasCiclo}
                            renderItem={(tema: any, temaIndex: number) => {
                              const temaId = String(tema?.id ?? `tema-${temaIndex}`);
                              const materialesTema = materialesDidacticosPorTema.get(temaId) ?? [];
                              return (
                                <List.Item
                                  key={temaId}
                                  actions={[]}
                                >
                                  <List.Item.Meta
                                    avatar={<span style={{ fontSize: 20, fontWeight: 700, color: "#2563eb" }}>{tema.orden || temaIndex + 1}</span>}
                                    title={<Text strong>{tema.nombre_curso || tema.titulo || `Tema ${temaIndex + 1}`}</Text>}
                                    description={
                                      <Space direction="vertical" size={4}>
                                        {tema.descripcion ? <Text type="secondary">{tema.descripcion}</Text> : null}
                                        {materialesTema.length ? (
                                          <Space wrap size={isMobile ? 6 : 10} direction={isMobile ? "vertical" : "horizontal"}>
                                            {materialesTema.map((item: any, itemIndex: number) => (
                                              <Tag
                                                key={`${temaId}-mat-${itemIndex}`}
                                                icon={getMaterialIcon(item)}
                                                onClick={() => abrirMaterial(item)}
                                                onKeyDown={(event) => {
                                                  if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    abrirMaterial(item);
                                                  }
                                                }}
                                                tabIndex={item?.url_archivo ? 0 : -1}
                                                title={item.titulo || item.nombre_archivo || "Recurso"}
                                                style={{
                                                  cursor: item?.url_archivo ? "pointer" : "default",
                                                  maxWidth: "100%",
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                }}
                                              >
                                                {item.titulo || item.nombre_archivo || "Recurso"}
                                              </Tag>
                                            ))}
                                          </Space>
                                        ) : (
                                          <Text type="secondary" style={{ fontSize: 12 }}>Sin material didactico</Text>
                                        )}
                                      </Space>
                                    }
                                  />
                                </List.Item>
                              );
                            }}
                          />
                        ) : (
                          <Empty description="No hay temas registrados en este ciclo." />
                        ),
                      };
                    })}
                  />
                ) : (
                  <Empty description="No hay temas registrados en el programa." />
                )}
              </Card>
            )
          },
          {
            key: "2",
            label: <span><FileOutlined /> Lista de materiales</span>,
            children: (
              <Card
                title="Materiales necesarios por clase"
                extra={isAdminView ? (
                  <Upload maxCount={5} multiple>
                    <Button type="primary" icon={<PlusOutlined />}>
                      Subir Material
                    </Button>
                  </Upload>
                ) : null}
              >
                {materialesClaseUnicos.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <Collapse
                      accordion
                      expandIconPosition="end"
                      items={ciclosOrdenados.map((ciclo: any, index: number) => {
                        const cicloId = String(ciclo?.id ?? "sin-ciclo");
                        const cicloNumero = ciclo?.numero_ciclo ?? ciclo?.orden ?? index + 1;
                        const cicloNombre = ciclo?.nombre_ciclo || ciclo?.titulo || `Ciclo ${cicloNumero}`;
                        const temasCiclo = temasPorCiclo.get(cicloId) ?? [];

                        return {
                          key: `mat-${cicloId}`,
                          label: (
                            <Space size={16} align="center">
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 16,
                                  background: "#16a34a",
                                  color: "#f8fafc",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 22,
                                  fontWeight: 700,
                                }}
                              >
                                {cicloNumero}
                              </div>
                              <div>
                                <Text strong style={{ fontSize: 16 }}>{cicloNombre}</Text>
                                <br />
                                <Text type="secondary">Materiales por tema</Text>
                              </div>
                            </Space>
                          ),
                          children: temasCiclo.length ? (
                            <List
                              dataSource={temasCiclo}
                              renderItem={(tema: any, temaIndex: number) => {
                                const temaId = String(tema?.id ?? `tema-${temaIndex}`);
                                const materialesTema = materialesNecesariosPorTema.get(temaId) ?? [];
                                return (
                                  <List.Item key={`mat-${temaId}`}>
                                    <List.Item.Meta
                                      avatar={<span style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>{tema.orden || temaIndex + 1}</span>}
                                      title={<Text strong>{tema.nombre_curso || tema.titulo || `Tema ${temaIndex + 1}`}</Text>}
                                      description={
                                        materialesTema.length ? (
                                          <Space wrap size={10}>
                                            {materialesTema.map((item: any, itemIndex: number) => (
                                              <Space key={`${temaId}-req-${itemIndex}`} size={6}>
                                                {item.obligatorio ? (
                                                  <CheckCircleOutlined style={{ color: "#16a34a" }} />
                                                ) : (
                                                  <ClockCircleOutlined style={{ color: "#f59e0b" }} />
                                                )}
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                  {item.nombre_material}
                                                  {item.cantidad ? ` (${item.cantidad}${item.unidad ? ` ${item.unidad}` : ""})` : ""}
                                                </Text>
                                              </Space>
                                            ))}
                                          </Space>
                                        ) : (
                                          <Text type="secondary" style={{ fontSize: 12 }}>Sin materiales registrados</Text>
                                        )
                                      }
                                    />
                                  </List.Item>
                                );
                              }}
                            />
                          ) : (
                            <Empty description="No hay temas registrados en este ciclo." />
                          ),
                        };
                      })}
                    />
                  </div>
                ) : (
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary">No hay materiales registrados para este programa.</Text>
                  </div>
                )}
              </Card>
            )
          },
          {
            key: "3",
            label: <span><ClockCircleOutlined /> Sesiones de Clase ({sesiones.length})</span>,
            children: (
              <Card
                title="Registro de Sesiones y Clases Dictadas"
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalSesionVisible(true)}>
                    Registrar Sesión
                  </Button>
                }
              >
                <Table
                  dataSource={sesiones}
                  rowKey="id"
                  pagination={{ pageSize: 15 }}
                  columns={columnasSesiones}
                  size={isMobile ? "small" : "middle"}
                  tableLayout="fixed"
                  scroll={{ x: "max-content" }}
                />
              </Card>
            )
          },
          {
            key: "4",
            label: <span><UserOutlined /> Estudiantes ({totalEstudiantes})</span>,
            children: (
              <Card title="Lista de Estudiantes Matriculados">
                <Table
                  dataSource={estudiantes}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  columns={columnasEstudiantes}
                  size={isMobile ? "small" : "middle"}
                  tableLayout="fixed"
                  scroll={{ x: "max-content" }}
                />
              </Card>
            )
          },
          {
            key: "5",
            label: <span><FileTextOutlined /> Calificaciones</span>,
            children: (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Alert
                  message="Calificaciones por tema"
                  description="Cada tema del temario debe tener su nota. Los estudiantes pendientes de pago no pueden ser calificados."
                  type="info"
                  showIcon
                  style={{ padding: "8px 10px" }}
                />

                <Card
                  title={<Text strong style={{ fontSize: 14 }}>Resultados de Quiz por Clase</Text>}
                  bodyStyle={{ padding: 10 }}
                  headStyle={{ padding: "8px 12px", background: "#0f172a0f" }}
                >
                  <Table
                    size="small"
                    dataSource={resultadosQuiz}
                    rowKey="id"
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: "max-content" }}
                    locale={{ emptyText: "No hay intentos de quiz registrados" }}
                    columns={[
                      {
                        title: "Estudiante",
                        render: (_: any, record: any) => {
                          const estudiante = estudiantes.find((item) => String(item.id) === String(record?.matricula_id));
                          return estudiante?.nombre_completo || "-";
                        },
                      },
                      {
                        title: "Clase",
                        render: (_: any, record: any) => {
                          const quiz = quizzesClase.find((item: any) => String(item?.id) === String(record?.quiz_id));
                          const temaId = String(quiz?.pensum_curso_id || "");
                          return nombreTemaPorId.get(temaId) || quiz?.titulo || "Quiz";
                        },
                      },
                      {
                        title: "Aciertos",
                        render: (_: any, record: any) => `${Number(record?.respuestas_correctas || 0)}/${Number(record?.total_preguntas || 0)}`,
                      },
                      {
                        title: "Calificación",
                        dataIndex: "calificacion",
                        render: (valor: number) => {
                          const nota = Number(valor || 0);
                          const aprobado = nota >= 3.75;
                          return <Tag color={aprobado ? "green" : "red"}>{`${nota}/5`}</Tag>;
                        },
                      },
                      {
                        title: "Fecha",
                        dataIndex: "enviado_at",
                        render: (fecha: string) => (fecha ? dayjs(fecha).format("DD/MM/YYYY HH:mm") : "-"),
                      },
                    ]}
                  />
                </Card>

                {temas.length === 0 ? (
                  <Card><Empty description="No hay temario cargado" /></Card>
                ) : (
                  temas.map((tema) => (
                    <Card
                      key={tema.id}
                      title={<Text strong style={{ fontSize: 14 }}>{`Tema: ${tema.nombre_ciclo || tema.titulo || "Tema"}`}</Text>}
                      style={{ marginBottom: 8 }}
                      bodyStyle={{ padding: 10 }}
                      headStyle={{ padding: "8px 12px", background: "#0f172a0f" }}
                    >
                      <Table
                        size="small"
                        dataSource={estudiantes}
                        rowKey="id"
                        pagination={false}
                        style={{ marginTop: 4 }}
                        tableLayout="fixed"
                        scroll={{ x: "max-content" }}
                        columns={[
                          {
                            title: "Nombre",
                            dataIndex: "nombre_completo",
                            render: (text: string, record: any) => (
                              <Space direction="vertical" size={0}>
                                <Text strong>{text}</Text>
                                {record.estado === "pendiente_pago" ? (
                                  <Tag color="default">PENDIENTE PAGO</Tag>
                                ) : null}
                              </Space>
                            ),
                          },
                          {
                            title: "Nota (0-5)",
                            width: 140,
                            render: (_: any, record: any) => {
                              const current = calificacionesTema[String(tema.id)]?.[String(record.id)] ?? null;
                              const habilitado = record.estado !== "pendiente_pago";
                              return (
                                <InputNumber
                                  min={0}
                                  max={5}
                                  step={0.1}
                                  value={current}
                                  disabled={!habilitado}
                                  onChange={(val) =>
                                    setCalificacionesTema((prev) => ({
                                      ...prev,
                                      [String(tema.id)]: {
                                        ...(prev[String(tema.id)] || {}),
                                        [String(record.id)]: val === null ? null : Number(val),
                                      },
                                    }))
                                  }
                                  style={{ width: 110 }}
                                />
                              );
                            },
                          },
                          {
                            title: "Guardar",
                            width: 120,
                            render: (_: any, record: any) => {
                              const current = calificacionesTema[String(tema.id)]?.[String(record.id)] ?? null;
                              const habilitado = record.estado !== "pendiente_pago";
                              const saving = savingCalificacionId === `${tema.id}-${record.id}`;
                              return (
                                <Button
                                  type="primary"
                                  size="small"
                                  disabled={!habilitado || current == null || Number.isNaN(current)}
                                  loading={saving}
                                  onClick={() => guardarNotaTema(tema.id, record.id, current)}
                                >
                                  Guardar
                                </Button>
                              );
                            },
                          },
                        ]}
                      />
                    </Card>
                  ))
                )}
              </Space>
            )
          }
        ]}
      />

      {/* MODAL REGISTRAR SESIÓN */}
      <Modal
        title="Registrar Sesión de Clase"
        open={modalSesionVisible}
        onOk={() => formSesion.submit()}
        onCancel={() => setModalSesionVisible(false)}
      >
        <Form form={formSesion} layout="vertical" onFinish={onAddSesion}>
          <Form.Item label="Fecha" name="fecha" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Horas Dictadas" name="horas_dictadas" rules={[{ required: true }]}>
            <InputNumber min={0.5} step={0.5} placeholder="Ej: 2" />
          </Form.Item>
          <Form.Item label="Tema Visto" name="tema_visto">
            <Input placeholder="Ej: Introducción a React" />
          </Form.Item>
          <Form.Item label="Observaciones" name="observaciones">
            <Input.TextArea rows={3} placeholder="Notas sobre la clase..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
