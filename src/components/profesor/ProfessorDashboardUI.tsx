import React, { useEffect, useMemo, useRef, useState } from "react";
import { Column, Line } from "@ant-design/plots";
import {
  BookOutlined,
  CalendarOutlined,
  DollarCircleOutlined,
  FormOutlined,
  ReadOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  StarOutlined,
  UserAddOutlined,
  GiftOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Empty,
  List,
  Modal,
  Progress,
  Row,
  Table,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { ProfessorDashboardData } from "@hooks/useProfessorDashboard";
import { construirNombreGrupo } from "@utils/grupos";
import { obtenerMaterialesCicloPorProgramas, obtenerMaterialesClasePorProgramas, obtenerMaterialesPorProgramas, obtenerPensumPorProgramas } from "@modules/academico/pensum.service";
import { supabaseBrowserClient } from "@utils/supabase/client";

type CourseActionContext = "attendance" | "grades" | "materials" | "default";

type ProfessorDashboardUIProps = {
  dashboard: ProfessorDashboardData | null | undefined;
  onOpenCourse?: (cursoId: string, action?: CourseActionContext) => void;
};

const fallbackStats: ProfessorDashboardData["stats"] = {
  cursosActivos: 0,
  totalEstudiantes: 0,
  horasMes: 0,
  porcentajeAsistencia: 0,
  promedioCalificaciones: 0,
  pendientesPorCalificar: 0,
  asistenciaChart: [],
  calificacionesChart: [],
  topCursos: [],
  horasQuincena: 0,
  proyeccionQuincena: 0,
  tarifaHora: null,
  totalPagadoMes: 0,
};

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

const parseTemaTituloMaterial = (titulo?: string | null) => {
  const raw = String(titulo || "").trim();
  const match = raw.match(/^\s*(?:\[?tema[:\-]\s*)(.+?)(?:\]|—|–|-|:)\s*(.+)?$/i);
  if (!match) {
    return {
      tema: "",
      tituloLimpio: raw,
    };
  }

  return {
    tema: String(match[1] || "").trim(),
    tituloLimpio: String(match[2] || raw).trim(),
  };
};

const normalizeText = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeTheme = (value?: string | null) => normalizeText(value).replace(/^\d+\s*/, "").trim();

const normalizeHttpUrl = (value?: string | null) => {
  const raw = String(value || "").trim().replace(/&amp;/gi, "&");
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
};

const hasMalformedEmbedTokens = (value?: string | null) => {
  const raw = String(value || "");
  return /%_ENCODED_%|\{\"|\{"/i.test(raw);
};

const isAllowedEmbedHost = (value?: string | null) => {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) return false;
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    return host === "gamma.app" || host.endsWith(".gamma.app");
  } catch {
    return false;
  }
};

const extractIframeSrc = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
  return normalizeHttpUrl(String(match?.[1] || raw).trim());
};

const toGammaEmbedUrl = (value?: string | null) => {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    if (!(host === "gamma.app" || host.endsWith(".gamma.app"))) {
      return normalized;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments[0] === "embed") {
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    }

    const documentId = segments[segments.length - 1];
    if (!documentId) return normalized;

    parsed.pathname = `/embed/${documentId}`;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return normalized;
  }
};

const isIframeMaterial = (material: any) => {
  const mime = String(material?.mime_type || "").toLowerCase();
  const tipo = String(material?.tipo_material || "").toLowerCase();
  const url = String(material?.url_archivo || "").toLowerCase();
  return mime === "iframe" || tipo === "iframe" || url.includes("<iframe") || url.includes("gamma.app");
};

export const ProfessorDashboardUI: React.FC<ProfessorDashboardUIProps> = ({ dashboard, onOpenCourse }) => {
  const resolvedDashboard: ProfessorDashboardData = dashboard ?? {
    loading: true,
    profesorNombre: undefined,
    stats: fallbackStats,
    cursos: [],
    proximasSesiones: [],
    pendientes: [],
    pagos: [],
  };

  const { loading, stats, cursos, proximasSesiones, pendientes, pagos, profesorNombre } = resolvedDashboard;
  const statsData = stats ?? fallbackStats;
  const proximasSesionesData = dedupeByKey(proximasSesiones || [], (sesion: any) => `${sesion.cursoId ?? ""}-${sesion.fecha ?? ""}-${sesion.tema ?? ""}-${sesion.claseNumero ?? ""}`);
  const pendientesData = dedupeByKey(pendientes || [], (pendiente: any) => `${pendiente.cursoId ?? ""}-${pendiente.concepto ?? ""}-${pendiente.fecha ?? ""}`);
  const pagosData = dedupeByKey(pagos || [], (pago: any) => `${pago.id ?? ""}-${pago.fecha ?? ""}-${pago.monto ?? ""}-${pago.tipo ?? ""}`);
  const [financialOpen, setFinancialOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialesPensum, setMaterialesPensum] = useState<any[]>([]);
  const [materialesCiclo, setMaterialesCiclo] = useState<any[]>([]);
  const [materialesClase, setMaterialesClase] = useState<any[]>([]);
  const [materialesDidacticos, setMaterialesDidacticos] = useState<any[]>([]);
  const [cursoMaterialSeleccionado, setCursoMaterialSeleccionado] = useState<any | null>(null);
  const [cicloSeleccionadoId, setCicloSeleccionadoId] = useState<string | null>(null);
  const [temaSeleccionadoId, setTemaSeleccionadoId] = useState<string | null>(null);
  const [iframePreview, setIframePreview] = useState<{ open: boolean; title: string; src: string }>({
    open: false,
    title: "",
    src: "",
  });
  const [logoAcademia, setLogoAcademia] = useState<string | null>(null);
  const cursosSectionRef = useRef<HTMLDivElement | null>(null);
  const sesionesSectionRef = useRef<HTMLDivElement | null>(null);
  const pendientesSectionRef = useRef<HTMLDivElement | null>(null);
  const analiticaSectionRef = useRef<HTMLDivElement | null>(null);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }),
    [],
  );
  const proyeccionLabel = currencyFormatter.format(statsData.proyeccionQuincena || 0);
  const pagadoMesLabel = currencyFormatter.format(statsData.totalPagadoMes || 0);
  const tarifaHoraLabel =
    typeof statsData.tarifaHora === "number" && Number.isFinite(statsData.tarifaHora)
      ? currencyFormatter.format(statsData.tarifaHora)
      : "Sin definir";

  const asistenciaConfig = {
    data: statsData.asistenciaChart || [],
    xField: "fecha",
    yField: "porcentaje",
    smooth: true,
    color: "#22c55e",
    height: 240,
    area: {
      style: {
        fill: "l(90) 0:#bbf7d0 1:#22c55e",
        fillOpacity: 0.25,
      },
    },
    tooltip: {
      formatter: (datum: any) => ({
        name: datum?.clases ? `Asistencia (${datum.clases})` : "Asistencia",
        value: `${datum.porcentaje}%`,
      }),
    },
    yAxis: {
      max: 100,
      min: 0,
      label: {
        formatter: (val: number) => `${val}%`,
      },
    },
  };

  const calificacionesConfig = {
    data: statsData.calificacionesChart || [],
    xField: "fecha",
    yField: "promedio",
    color: "#6366f1",
    height: 240,
    columnWidthRatio: 0.6,
    tooltip: {
      formatter: (datum: any) => ({
        name: "Promedio",
        value: datum.promedio,
      }),
    },
    yAxis: {
      min: 0,
      max: 100,
    },
  };

  const topCursos = useMemo(
    () => dedupeByKey(statsData.topCursos || [], (curso: any) => `${curso.id ?? curso.nombre ?? ""}`),
    [statsData.topCursos],
  );
  const cursosOrdenados = useMemo(
    () => dedupeByKey(cursos || [], (curso: any) => `${curso.id ?? curso.nombre ?? ""}`)
      .sort((a, b) => (b.estudiantesActivos || 0) - (a.estudiantesActivos || 0)),
    [cursos],
  );

  const courseCards = useMemo(() => {
    return cursosOrdenados.map((curso) => {
      const proxFecha = curso.proximaSesion?.fecha ? dayjs(curso.proximaSesion.fecha) : null;
      const proxLabel = proxFecha ? proxFecha.format("ddd D MMM, HH:mm") : "Sin próxima sesión";
      const isSoon = proxFecha ? proxFecha.isBefore(dayjs().add(24, "hour")) : false;
      const asistenciaColor = typeof curso.asistenciaPromedio === "number"
        ? curso.asistenciaPromedio >= 85
          ? "#22c55e"
          : curso.asistenciaPromedio >= 70
            ? "#facc15"
            : "#f97316"
        : undefined;

      return {
        ...curso,
        proxFecha,
        proxLabel,
        isSoon,
        asistenciaColor,
        temaActual: curso.temaActual,
        siguienteTema: curso.siguienteTema,
      };
    });
  }, [cursosOrdenados]);

  const hasAsistenciaData = (statsData.asistenciaChart || []).length > 0;
  const hasCalificacionesData = (statsData.calificacionesChart || []).length > 0;
  const hasTopCursos = (topCursos || []).length > 0;

  const menuProfesor = [
    { key: "cursos", label: "Cursos", icon: <BookOutlined /> },
    { key: "sesiones", label: "Sesiones", icon: <CalendarOutlined /> },
    { key: "pendientes", label: "Pendientes", icon: <FormOutlined /> },
    { key: "analitica", label: "Analítica", icon: <ReadOutlined /> },
    { key: "financiero", label: "Finanzas", icon: <DollarCircleOutlined /> },
  ];

  const handleMenuProfesor = (key: string) => {
    if (key === "financiero") {
      setFinancialOpen(true);
      return;
    }

    const mapaSecciones: Record<string, React.RefObject<HTMLDivElement | null>> = {
      cursos: cursosSectionRef,
      sesiones: sesionesSectionRef,
      pendientes: pendientesSectionRef,
      analitica: analiticaSectionRef,
    };

    const targetRef = mapaSecciones[key];
    targetRef?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const ciclosMateriales = useMemo(() => {
    const programaId = cursoMaterialSeleccionado?.programaId;
    if (!programaId) return [];
    return (materialesPensum || [])
      .filter((ciclo: any) => Number(ciclo.programa_id) === Number(programaId))
      .sort((a: any, b: any) => {
        const ordenA = Number(a?.orden ?? a?.numero_ciclo ?? 0);
        const ordenB = Number(b?.orden ?? b?.numero_ciclo ?? 0);
        if (ordenA !== ordenB) return ordenA - ordenB;
        return Number(a?.numero_ciclo ?? 0) - Number(b?.numero_ciclo ?? 0);
      });
  }, [materialesPensum, cursoMaterialSeleccionado?.programaId]);

  const cicloMaterialSeleccionado = useMemo(() => {
    return ciclosMateriales.find((ciclo: any) => String(ciclo.id) === String(cicloSeleccionadoId));
  }, [ciclosMateriales, cicloSeleccionadoId]);

  const temasMateriales = useMemo(() => {
    const temas = cicloMaterialSeleccionado?.pensum_cursos || [];
    return temas.slice().sort((a: any, b: any) => {
      const ordenA = Number(a?.orden ?? 0);
      const ordenB = Number(b?.orden ?? 0);
      if (ordenA !== ordenB) return ordenA - ordenB;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
  }, [cicloMaterialSeleccionado]);

  const materialesCicloSeleccionado = useMemo(() => {
    if (!cicloMaterialSeleccionado?.id) return [];
    return (materialesCiclo || [])
      .filter((item: any) => String(item.pensum_id) === String(cicloMaterialSeleccionado.id))
      .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
  }, [materialesCiclo, cicloMaterialSeleccionado?.id]);

  const materialesClaseSeleccionados = useMemo(() => {
    if (!cicloMaterialSeleccionado?.id || !temaSeleccionadoId) return [];
    return (materialesClase || [])
      .filter((item: any) => String(item.pensum_id) === String(cicloMaterialSeleccionado.id))
      .filter((item: any) => String(item.pensum_curso_id) === String(temaSeleccionadoId))
      .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
  }, [materialesClase, cicloMaterialSeleccionado?.id, temaSeleccionadoId]);

  const materialesDidacticosTema = useMemo(() => {
    if (!cursoMaterialSeleccionado?.programaId || !temaSeleccionadoId) return [];

    const temaActual = temasMateriales.find((tema: any) => String(tema.id) === String(temaSeleccionadoId));
    const temaObjetivo = normalizeTheme(temaActual?.nombre_curso);

    return (materialesDidacticos || [])
      .filter((item: any) => String(item?.programa_id) === String(cursoMaterialSeleccionado.programaId))
      .filter((item: any) => {
        if (cicloMaterialSeleccionado?.id && String(item?.pensum_id || "") !== String(cicloMaterialSeleccionado.id)) {
          return false;
        }

        const parsed = parseTemaTituloMaterial(item?.titulo);
        const temaMaterial = normalizeTheme(parsed.tema);
        const tituloLimpio = normalizeText(parsed.tituloLimpio);
        const descripcion = normalizeText(item?.descripcion || "");

        if (!temaObjetivo) return true;
        if (temaMaterial) return temaMaterial === temaObjetivo;
        return tituloLimpio.includes(temaObjetivo) || descripcion.includes(temaObjetivo);
      })
      .sort((a: any, b: any) => {
        const fechaA = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const fechaB = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return fechaB - fechaA;
      });
  }, [materialesDidacticos, cursoMaterialSeleccionado?.programaId, temaSeleccionadoId, temasMateriales, cicloMaterialSeleccionado?.id]);

  const abrirMaterialDidactico = (material: any, title: string) => {
    const src = extractIframeSrc(material?.url_archivo);
    if (!src) return;

    if (isIframeMaterial(material)) {
      if (hasMalformedEmbedTokens(src)) {
        return;
      }

      if (!isAllowedEmbedHost(src)) {
        window.open(src, "_blank", "noopener,noreferrer");
        return;
      }

      setIframePreview({
        open: true,
        title: title || "Presentación",
        src: toGammaEmbedUrl(src),
      });
      return;
    }

    window.open(src, "_blank", "noopener,noreferrer");
  };

  const handleOpenMaterials = (curso: any) => {
    setCursoMaterialSeleccionado(curso);
    setCicloSeleccionadoId(null);
    setTemaSeleccionadoId(null);
    setMaterialsOpen(true);
  };

  useEffect(() => {
    const cargarMateriales = async () => {
      if (!materialsOpen || !cursoMaterialSeleccionado?.programaId) return;
      setMaterialsLoading(true);
      try {
        const programaId = String(cursoMaterialSeleccionado.programaId);
        const [pensumData, materialesCicloData, materialesClaseData, materialesDidacticosData] = await Promise.all([
          obtenerPensumPorProgramas([programaId]),
          obtenerMaterialesCicloPorProgramas([programaId]),
          obtenerMaterialesClasePorProgramas([programaId]),
          obtenerMaterialesPorProgramas([programaId]),
        ]);
        setMaterialesPensum(pensumData || []);
        setMaterialesCiclo(materialesCicloData || []);
        setMaterialesClase(materialesClaseData || []);
        setMaterialesDidacticos(materialesDidacticosData || []);

        const primerCiclo = (pensumData || [])[0];
        setCicloSeleccionadoId(primerCiclo?.id || null);
        const primerTema = (primerCiclo?.pensum_cursos || [])[0];
        setTemaSeleccionadoId(primerTema?.id || null);
      } catch (error) {
        console.error("Error cargando materiales del curso", error);
        setMaterialesPensum([]);
        setMaterialesCiclo([]);
        setMaterialesClase([]);
        setMaterialesDidacticos([]);
      } finally {
        setMaterialsLoading(false);
      }
    };

    cargarMateriales();
  }, [materialsOpen, cursoMaterialSeleccionado?.programaId]);

  useEffect(() => {
    const cargarLogo = async () => {
      try {
        const { data } = await supabaseBrowserClient
          .from("configuracion")
          .select("logo_url")
          .order("updated_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        setLogoAcademia(data?.logo_url || null);
      } catch (error) {
        console.error("Error cargando logo de la academia", error);
      }
    };

    cargarLogo();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div
      className="profesor-dashboard"
      style={{
        minHeight: "100vh",
        padding: "16px 10px 32px",
        background: "linear-gradient(135deg, #f4f7ff 0%, #ffffff 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <Card
          variant="borderless"
          style={{
            borderRadius: 24,
            background: "linear-gradient(135deg, #1e3a8a 0%, #111827 100%)",
            marginBottom: 12,
            color: "#fff",
            boxShadow: "0 16px 36px -26px rgba(30,64,175,0.6)",
          }}
          styles={{ body: { padding: "18px 20px" } }}
        >
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} md={14}>
              <Typography.Text style={{ color: "rgba(255,255,255,0.65)" }}>
                {dayjs().format("dddd, D MMMM")}
              </Typography.Text>
              <Typography.Title level={2} style={{ color: "#fff", marginTop: 4 }}>
                {profesorNombre ? `Hola, ${profesorNombre}` : "Mi Oficina"}
              </Typography.Title>
              <Typography.Paragraph style={{ color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>
                Visualiza el pulso de tus cursos, haz seguimiento a tus estudiantes y mantén tus clases listas.
              </Typography.Paragraph>
              <Card
                className="professor-menu-card"
                variant="borderless"
                style={{
                  borderRadius: 14,
                  background: "rgba(17, 24, 39, 0.45)",
                  border: "1px solid rgba(148,163,184,0.2)",
                  maxWidth: 520,
                }}
                styles={{ body: { padding: 10 } }}
              >
                <Row gutter={[8, 8]}>
                  {menuProfesor.map((item) => (
                    <Col xs={8} sm={8} md={8} key={item.key}>
                      <Button
                        block
                        size="small"
                        className="professor-menu-btn"
                        onClick={() => handleMenuProfesor(item.key)}
                      >
                        <span className="professor-menu-inner">
                          <span className="professor-menu-icon">{item.icon}</span>
                          <span className="professor-menu-label">{item.label}</span>
                        </span>
                      </Button>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>
            <Col xs={24} md={10}>
              <Card
                variant="borderless"
                style={{ borderRadius: 20, background: "rgba(17, 24, 39, 0.55)", color: "#fff" }}
                styles={{ body: { padding: 14 } }}
              >
                <Row gutter={[10, 10]}>
                  <Col span={12}>
                    <Statistic
                      prefix={<BookOutlined style={{ color: "#60a5fa" }} />}
                      title={<span style={{ color: "rgba(255,255,255,0.65)" }}>Cursos activos</span>}
                      value={statsData.cursosActivos}
                      valueStyle={{ color: "#fff", fontWeight: 600 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      prefix={<TeamOutlined style={{ color: "#34d399" }} />}
                      title={<span style={{ color: "rgba(255,255,255,0.65)" }}>Estudiantes</span>}
                      value={statsData.totalEstudiantes}
                      valueStyle={{ color: "#fff", fontWeight: 600 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      prefix={<ClockCircleOutlined style={{ color: "#fbbf24" }} />}
                      title={<span style={{ color: "rgba(255,255,255,0.65)" }}>Horas del mes</span>}
                      value={statsData.horasMes}
                      suffix="hrs"
                      valueStyle={{ color: "#fff", fontWeight: 600 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      prefix={<CalendarOutlined style={{ color: "#38bdf8" }} />}
                      title={<span style={{ color: "rgba(255,255,255,0.65)" }}>Horas quincena</span>}
                      value={statsData.horasQuincena}
                      suffix="hrs"
                      valueStyle={{ color: "#fff", fontWeight: 600 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      prefix={<StarOutlined style={{ color: "#a78bfa" }} />}
                      title={<span style={{ color: "rgba(255,255,255,0.65)" }}>Promedio</span>}
                      value={statsData.promedioCalificaciones}
                      suffix="/100"
                      precision={1}
                      valueStyle={{ color: "#fff", fontWeight: 600 }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </Card>

        <Row gutter={[12, 12]} style={{ marginBottom: 4 }}>
          {[{
            key: "asistencia",
            title: "Asistencia promedio",
            value: statsData.porcentajeAsistencia,
            suffix: "%",
            icon: <CalendarOutlined style={{ color: "#16a34a" }} />,
            description: "Últimos 30 días",
          }, {
            key: "horas",
            title: "Horas registradas",
            value: statsData.horasMes,
            suffix: "hrs",
            icon: <ClockCircleOutlined style={{ color: "#2563eb" }} />,
            description: "Mes en curso",
          }].map((item, index, arr) => (
            <Col
              key={item.key}
              xs={24}
              sm={12}
              lg={arr.length === 2 ? 12 : 8}
              xl={arr.length === 2 ? 12 : 8}
            >
              <Card
                variant="borderless"
                style={{ borderRadius: 16, height: "100%", boxShadow: "0 12px 24px -22px rgba(15,23,42,0.26)" }}
                styles={{ body: { padding: 12 } }}
              >
                <Space size="small" align="start">
                  {item.icon}
                  <div>
                    <Typography.Text type="secondary">{item.title}</Typography.Text>
                    <Typography.Title level={4} style={{ margin: "6px 0" }}>
                      {item.value}
                      {item.suffix && typeof item.value === "number" ? (
                        <Typography.Text style={{ fontSize: 16, marginLeft: 4 }}>{item.suffix}</Typography.Text>
                      ) : null}
                    </Typography.Title>
                    <Typography.Text style={{ color: "#667085" }}>{item.description}</Typography.Text>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[12, 12]} style={{ marginTop: 4 }}>
          <Col xs={24} lg={16}>
            <div ref={cursosSectionRef}>
              <Card
                variant="borderless"
                title={<Space><BookOutlined />Mis cursos</Space>}
                style={{ borderRadius: 18, boxShadow: "0 12px 28px -22px rgba(15,23,42,0.3)" }}
              >
                <Row gutter={[10, 10]}>
                  {courseCards.map((curso) => {
                    const colSpan = courseCards.length === 1 ? 24 : courseCards.length === 2 ? 12 : 12;
                    return (
                      <Col key={curso.id} xs={24} sm={12} lg={colSpan}>
                        <Card
                          hoverable
                          onClick={() => onOpenCourse && onOpenCourse(curso.id, "default")}
                          style={{
                            borderRadius: 14,
                            height: "100%",
                            border: curso.isSoon ? "1px solid #A855F7" : "1px solid rgba(148,163,184,0.18)",
                            boxShadow: curso.isSoon
                              ? "0 14px 38px -26px rgba(168,85,247,0.5)"
                              : "0 10px 26px -22px rgba(15,23,42,0.22)",
                            background: "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.94))",
                          }}
                          styles={{
                            body: {
                              color: "#E5E7EB",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              minHeight: 150,
                              padding: 10,
                            },
                          }}
                        >
                          <Space align="center" split={<Divider type="vertical" style={{ borderColor: "rgba(255,255,255,0.12)" }} />} wrap>
                            <Typography.Title level={4} style={{ margin: 0, color: "#F8FAFC", fontSize: 18 }}>
                              {construirNombreGrupo(curso)}
                            </Typography.Title>
                            <Tag color={curso.estado === "activo" ? "green" : curso.estado === "pausado" ? "gold" : "blue"}>
                              {curso.estado}
                            </Tag>
                          </Space>

                          <Typography.Text style={{ color: "#CBD5E1" }}>
                            {curso.estudiantesActivos || 0} estudiantes activos
                          </Typography.Text>

                          {typeof curso.asistenciaPromedio === "number" ? (
                            <div>
                              <Typography.Text type="secondary" style={{ color: "#94A3B8", fontSize: 12 }}>Asistencia</Typography.Text>
                              <Progress
                                percent={curso.asistenciaPromedio}
                                size="small"
                                strokeColor={curso.asistenciaColor}
                                showInfo={false}
                                trailColor="rgba(148,163,184,0.25)"
                              />
                            </div>
                          ) : null}

                          <Space size={8} align="center">
                            <Badge color={curso.isSoon ? "#A855F7" : "#38bdf8"} text={curso.proxLabel} />
                          </Space>

                          {curso.temaActual ? (
                            <Typography.Text type="secondary" style={{ color: "#cbd5e1", fontSize: 12 }}>
                              Tema actual: {curso.temaActual}
                            </Typography.Text>
                          ) : null}

                          <Typography.Text style={{ color: "#e2e8f0", fontSize: 12 }}>
                            Próxima clase: {curso.proxLabel}
                            {curso.siguienteTema ? ` • Tema: ${curso.siguienteTema}` : ""}
                          </Typography.Text>

                          <Button
                            type="primary"
                            block
                            size="middle"
                            style={{ marginTop: 4 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCourse && onOpenCourse(curso.id, "default");
                            }}
                          >
                            Entrar al curso
                          </Button>
                          <Button
                            block
                            size="middle"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenMaterials(curso);
                            }}
                          >
                            Ver materiales
                          </Button>
                        </Card>
                      </Col>
                    );
                  })}

                  {courseCards.length === 0 && (
                    <Col span={24}>
                      <Card variant="borderless" style={{ textAlign: "center" }}>
                        <Typography.Text type="secondary">No tienes cursos asignados</Typography.Text>
                      </Card>
                    </Col>
                  )}
                </Row>
              </Card>
            </div>
          </Col>

          <Col xs={24} lg={8}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div ref={sesionesSectionRef}>
                <Card
                  variant="borderless"
                  title={<Space><CalendarOutlined />Próximas sesiones</Space>}
                  style={{ borderRadius: 18, boxShadow: "0 12px 28px -22px rgba(15,23,42,0.3)" }}
                  bodyStyle={{ paddingTop: 10, paddingBottom: 10 }}
                >
                  <List
                    dataSource={proximasSesionesData}
                    locale={{ emptyText: "No hay sesiones programadas" }}
                    renderItem={(sesion) => (
                      <List.Item
                        style={{ cursor: "pointer" }}
                        onClick={() => onOpenCourse && onOpenCourse(sesion.cursoId, "attendance")}
                      >
                        <List.Item.Meta
                          title={sesion.curso}
                          description={
                            <Space split={<Divider type="vertical" />}> 
                              <span>{dayjs(sesion.fecha).format("ddd D MMM, HH:mm")}</span>
                              {sesion.claseNumero ? <span>Clase #{sesion.claseNumero}</span> : null}
                              {sesion.tema ? <span>{sesion.tema}</span> : null}
                              {sesion.horas ? <span>{sesion.horas} hrs</span> : null}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </div>

              <div ref={pendientesSectionRef}>
                <Card
                  variant="borderless"
                  title={<Space><FormOutlined />Pendientes por calificar</Space>}
                  style={{ borderRadius: 18, boxShadow: "0 12px 28px -22px rgba(15,23,42,0.3)" }}
                  bodyStyle={{ paddingTop: 10, paddingBottom: 10 }}
                >
                  <List
                    dataSource={pendientesData.slice(0, 5)}
                    locale={{ emptyText: "No tienes pendientes" }}
                    renderItem={(pendiente) => (
                      <List.Item
                        style={{ cursor: pendiente.cursoId ? "pointer" : "default", opacity: pendiente.cursoId ? 1 : 0.6 }}
                        onClick={() => pendiente.cursoId && onOpenCourse && onOpenCourse(pendiente.cursoId as string, "grades")}
                      >
                        <List.Item.Meta
                          title={pendiente.concepto}
                          description={
                            <Space split={<Divider type="vertical" />}> 
                              <span>{pendiente.curso}</span>
                              {pendiente.fecha ? <span>{dayjs(pendiente.fecha).format("DD MMM")}</span> : null}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </div>
            </Space>
          </Col>
        </Row>

        {(hasAsistenciaData || hasCalificacionesData || hasTopCursos) && (
          <Row ref={analiticaSectionRef} gutter={[12, 12]} style={{ marginTop: 10 }}>
            {hasAsistenciaData && (
              <Col xs={24} lg={hasCalificacionesData ? 12 : 24}>
                <Card
                  variant="borderless"
                  title={<span style={{ fontWeight: 600 }}>Tendencia de asistencia</span>}
                  extra={<Tag color="green">Últimas 8 sesiones</Tag>}
                  style={{ borderRadius: 18, boxShadow: "0 12px 28px -22px rgba(15,23,42,0.3)" }}
                >
                  <Line {...asistenciaConfig} />
                </Card>
              </Col>
            )}

            {hasCalificacionesData && (
              <Col xs={24} lg={hasAsistenciaData ? 12 : 24}>
                <Card
                  variant="borderless"
                  title={<span style={{ fontWeight: 600 }}>Desempeño académico</span>}
                  extra={<Tag color="blue">Evaluaciones</Tag>}
                  style={{ borderRadius: 18, boxShadow: "0 12px 28px -22px rgba(15,23,42,0.3)" }}
                >
                  <Column {...calificacionesConfig} />
                </Card>
              </Col>
            )}

            {hasTopCursos && (
              <Col xs={24} lg={8}>
                <Card
                  variant="borderless"
                  title={<Space><ReadOutlined />Top cursos</Space>}
                  style={{ borderRadius: 18, boxShadow: "0 12px 28px -22px rgba(15,23,42,0.3)" }}
                >
                  <List
                    dataSource={topCursos}
                    locale={{ emptyText: "Sin cursos destacados aún" }}
                    renderItem={(curso) => (
                      <List.Item>
                        <List.Item.Meta
                          title={construirNombreGrupo(curso)}
                          description={`${curso.estudiantes} estudiantes`}
                        />
                        {typeof curso.asistencia === "number" ? (
                          <Tag color={curso.asistencia >= 85 ? "green" : curso.asistencia >= 70 ? "gold" : "volcano"}>
                            {curso.asistencia}%
                          </Tag>
                        ) : null}
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
            )}
          </Row>
        )}

        <Drawer
          title={`Materiales del curso: ${cursoMaterialSeleccionado ? construirNombreGrupo(cursoMaterialSeleccionado) : "Curso"}`}
          placement="right"
          width={460}
          onClose={() => setMaterialsOpen(false)}
          open={materialsOpen}
        >
          {materialsLoading ? (
            <div style={{ minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Spin />
            </div>
          ) : (
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Select
                placeholder="Selecciona un ciclo"
                value={cicloSeleccionadoId || undefined}
                onChange={(value) => {
                  const ciclo = ciclosMateriales.find((item: any) => String(item.id) === String(value));
                  setCicloSeleccionadoId(value || null);
                  const primerTema = ciclo?.pensum_cursos?.[0];
                  setTemaSeleccionadoId(primerTema?.id || null);
                }}
                options={ciclosMateriales.map((ciclo: any) => ({
                  value: ciclo.id,
                  label: ciclo.nombre_ciclo || `Ciclo ${ciclo.numero_ciclo}`,
                }))}
              />

              <Select
                placeholder="Selecciona un tema"
                value={temaSeleccionadoId || undefined}
                onChange={(value) => setTemaSeleccionadoId(value || null)}
                options={temasMateriales.map((tema: any) => ({
                  value: tema.id,
                  label: tema.nombre_curso,
                }))}
              />

              <Card size="small" title="Materiales generales del ciclo">
                {materialesCicloSeleccionado.length === 0 ? (
                  <Empty description="Sin materiales generales" />
                ) : (
                  <Table
                    size="small"
                    pagination={false}
                    rowKey={(record) => String(record?.id || record?.nombre)}
                    dataSource={materialesCicloSeleccionado}
                    columns={[
                      {
                        title: "Producto",
                        dataIndex: "nombre",
                        render: (value) => <Typography.Text strong>{value}</Typography.Text>,
                      },
                      {
                        title: "Cantidad",
                        dataIndex: "cantidad",
                        render: (value) => value || "Cantidad por definir",
                      },
                      {
                        title: "Kit",
                        dataIndex: "incluido_kit",
                        align: "center",
                        render: (value) => (value ? <GiftOutlined style={{ color: "#d81b87" }} /> : null),
                      },
                    ]}
                  />
                )}
              </Card>

              <Card size="small" title="Materiales por clase">
                {materialesClaseSeleccionados.length === 0 ? (
                  <Empty description="Sin materiales asignados" />
                ) : (
                  <Table
                    size="small"
                    pagination={false}
                    rowKey={(record) => String(record?.id || record?.nombre_material)}
                    dataSource={materialesClaseSeleccionados}
                    columns={[
                      {
                        title: "Producto",
                        dataIndex: "nombre_material",
                        render: (_value, record) => (
                          <Space size={6} wrap>
                            <Typography.Text strong>{record.materiales_ciclo?.nombre || record.nombre_material}</Typography.Text>
                          </Space>
                        ),
                      },
                      {
                        title: "Cantidad",
                        dataIndex: "cantidad",
                        render: (_value, record) => {
                          const cantidad = record.materiales_ciclo?.cantidad || record.cantidad;
                          return [cantidad, record.unidad].filter(Boolean).join(" ") || "Cantidad por definir";
                        },
                      },
                      {
                        title: "Kit",
                        dataIndex: "materiales_ciclo",
                        align: "center",
                        render: (value) => (value?.incluido_kit ? <GiftOutlined style={{ color: "#d81b87" }} /> : null),
                      },
                    ]}
                  />
                )}
              </Card>

              <Card size="small" title="Material didáctico del tema">
                {materialesDidacticosTema.length === 0 ? (
                  <Empty description="Sin material didáctico" />
                ) : (
                  <List
                    dataSource={materialesDidacticosTema}
                    renderItem={(item: any) => {
                      const parsed = parseTemaTituloMaterial(item?.titulo);
                      const titulo = parsed.tituloLimpio || item?.titulo || "Material";
                      return (
                        <List.Item
                          actions={[
                            <Button
                              key={`ver-material-${item.id}`}
                              type="link"
                              onClick={() => abrirMaterialDidactico(item, titulo)}
                            >
                              Ver
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            title={<Typography.Text strong>{titulo}</Typography.Text>}
                            description={item?.descripcion || null}
                          />
                        </List.Item>
                      );
                    }}
                  />
                )}
              </Card>
            </Space>
          )}
        </Drawer>

        <Modal
          title={iframePreview.title || "Presentación"}
          open={iframePreview.open}
          onCancel={() => setIframePreview({ open: false, title: "", src: "" })}
          footer={null}
          width="100%"
          centered
          style={{ top: 0, padding: 0 }}
          styles={{ 
            body: { padding: 0, height: "100vh", overflow: "hidden" },
            content: { padding: 0, borderRadius: 0, height: "100vh", overflow: "hidden" }
          }}
          destroyOnClose
          className="gamma-fullscreen-modal"
        >
          <iframe
            src={iframePreview.src}
            title={iframePreview.title || "Presentación"}
            style={{ width: "100%", height: "100%", border: 0 }}
            allow="fullscreen; clipboard-read; clipboard-write"
            allowFullScreen
            loading="lazy"
          />
        </Modal>

        <Drawer
          title="Resumen financiero"
          placement="right"
          width={420}
          onClose={() => setFinancialOpen(false)}
          open={financialOpen}
        >
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Row gutter={[12, 12]}>
              {[{
                key: "tarifa",
                title: "Tarifa por hora",
                value: tarifaHoraLabel,
              }, {
                key: "horasMes",
                title: "Horas del mes",
                value: `${statsData.horasMes} hrs`,
              }, {
                key: "horasQuincena",
                title: "Horas quincena",
                value: `${statsData.horasQuincena} hrs`,
              }, {
                key: "proyeccion",
                title: "Proyección quincena",
                value: proyeccionLabel,
              }, {
                key: "pagadoMes",
                title: "Pagado este mes",
                value: pagadoMesLabel,
              }].map((item, index) => (
                <Col key={item.key} span={index === 4 ? 24 : 12}>
                  <Card variant="borderless" style={{ borderRadius: 16, background: "#f8fafc" }}>
                    <Typography.Text type="secondary">{item.title}</Typography.Text>
                    <Typography.Title level={4} style={{ marginTop: 8 }}>
                      {item.value}
                    </Typography.Title>
                  </Card>
                </Col>
              ))}
            </Row>

            <div>
              <Typography.Title level={5} style={{ marginBottom: 16 }}>Pagos recientes</Typography.Title>
              <List
                dataSource={pagosData.slice(0, 6)}
                locale={{ emptyText: "Sin pagos registrados" }}
                renderItem={(pago) => {
                  const fechaLabel = pago.fecha ? dayjs(pago.fecha).format("DD MMM YYYY") : "Sin fecha";
                  const periodoLabel =
                    pago.origen === "nomina" && pago.periodo?.inicio && pago.periodo?.fin
                      ? `${dayjs(pago.periodo.inicio).format("DD MMM")} - ${dayjs(pago.periodo.fin).format("DD MMM")}`
                      : null;
                  return (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space split={<Divider type="vertical" />}>
                            <span>{currencyFormatter.format(pago.monto || 0)}</span>
                            <span>{pago.tipo}</span>
                            <Tag color={pago.origen === "nomina" ? "blue" : "gold"}>
                              {pago.origen === "nomina" ? "Nómina" : "Extra"}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div>
                            <Space split={<Divider type="vertical" />} style={{ color: "#475467" }}>
                              <span>{fechaLabel}</span>
                              <span>{pago.concepto}</span>
                            </Space>
                            {periodoLabel ? (
                              <Typography.Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                                Periodo: {periodoLabel}
                              </Typography.Text>
                            ) : null}
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </div>
          </Space>
        </Drawer>
        <style jsx global>{`
          .profesor-dashboard .professor-menu-card {
            margin-top: 10px;
          }
          .profesor-dashboard .professor-menu-btn {
            border-radius: 12px;
            min-height: 58px;
            padding: 6px;
            border-color: rgba(148, 163, 184, 0.35);
            background: rgba(255, 255, 255, 0.92);
            color: #0f172a;
          }
          .profesor-dashboard .professor-menu-inner {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            width: 100%;
          }
          .profesor-dashboard .professor-menu-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            line-height: 1;
          }
          .profesor-dashboard .professor-menu-label {
            font-size: 11px;
            line-height: 1.15;
            text-align: center;
            white-space: normal;
          }
          @media (max-width: 576px) {
            .profesor-dashboard {
              padding: 12px !important;
            }
            .profesor-dashboard .ant-card-head-title {
              white-space: normal;
            }
            .profesor-dashboard .ant-typography {
              word-break: break-word;
            }
            .profesor-dashboard .ant-btn {
              width: 100%;
            }
            .profesor-dashboard .ant-space {
              width: 100%;
            }
            .profesor-dashboard .ant-list-item-meta-title,
            .profesor-dashboard .ant-list-item-meta-description {
              white-space: normal;
            }
            .profesor-dashboard .ant-card-body {
              padding: 12px !important;
            }
            .profesor-dashboard .ant-drawer-content-wrapper {
              width: 100% !important;
            }
            .profesor-dashboard .professor-menu-btn {
              min-height: 54px;
              padding: 6px 4px;
            }
            .profesor-dashboard .professor-menu-label {
              font-size: 10px;
            }
          }
        `}</style>
      </div>
    </div>
  );
};
