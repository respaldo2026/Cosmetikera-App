"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  List,
  message,
  Spin,
  Progress,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography
} from "antd";
import type { SegmentedValue } from "antd/es/segmented";
import {
  ArrowRightOutlined,
  BankOutlined,
  BarChartOutlined,
  CalendarOutlined,
  DollarCircleOutlined,
  RiseOutlined,
  SyncOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  WarningOutlined
} from "@ant-design/icons";
import { Line, Pie } from "@ant-design/plots";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/es";
import { supabaseBrowserClient as supabase } from "@utils/supabase/client";
import { construirNombreGrupo } from "@utils/grupos";

dayjs.extend(localizedFormat);
dayjs.locale("es");

const { Title, Text } = Typography;

type TimeRange = "30d" | "90d" | "year";

interface PagoPendiente {
  id: string;
  monto: number;
  fecha_vencimiento: string | null;
  periodo_pagado?: string | null;
  estudiante?: {
    nombre_completo?: string | null;
  } | null;
}

interface CursoOcupacion {
  id: string;
  nombre: string;
  cupos: number | null;
  ocupacion: number;
  inscritos: number;
}

interface DashboardMetrics {
  ingresosPeriodo: number;
  variacionIngresos: number | null;
  carteraVencida: number;
  pagosPendientes: number;
  estudiantesActivos: number;
  nuevosEstudiantes: number;
  leadsNuevos: number;
  ocupacionPromedio: number;
  tasaMora: number;
}

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return "$0";
  return `$${Math.round(value).toLocaleString("es-CO")}`;
};

export default function AdminDashboard() {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    ingresosPeriodo: 0,
    variacionIngresos: null,
    carteraVencida: 0,
    pagosPendientes: 0,
    estudiantesActivos: 0,
    nuevosEstudiantes: 0,
    leadsNuevos: 0,
    ocupacionPromedio: 0,
    tasaMora: 0
  });
  const [ingresosSeries, setIngresosSeries] = useState<Array<{ fecha: string; monto: number }>>([]);
  const [metodosSeries, setMetodosSeries] = useState<Array<{ type: string; value: number }>>([]);
  const [pendientes, setPendientes] = useState<PagoPendiente[]>([]);
  const [cursosCriticos, setCursosCriticos] = useState<CursoOcupacion[]>([]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return;
    setErrorMessage(null);
    if (initialLoading) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const totalDias = timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
      const hoy = dayjs();
      const inicio = hoy.subtract(totalDias - 1, "day").startOf("day");
      const fin = hoy.endOf("day");
      const inicioAnterior = inicio.subtract(totalDias, "day");
      const finAnterior = inicio.subtract(1, "day");

      const inicioActualStr = inicio.format("YYYY-MM-DD");
      const finActualStr = fin.format("YYYY-MM-DD");
      const inicioAnteriorStr = inicioAnterior.format("YYYY-MM-DD");
      const finAnteriorStr = finAnterior.format("YYYY-MM-DD");

      const [
        pagosPeriodoResp,
        pagosAnteriorResp,
        pagosPendientesResp,
        matriculasActivasResp,
        matriculasPeriodoResp,
        leadsPeriodoResp,
        cursosResp
      ] = await Promise.all([
        supabase
          .from("pagos")
          .select("monto, fecha_pago, metodo_pago")
          .eq("estado", "pagado")
          .gte("fecha_pago", inicioActualStr)
          .lte("fecha_pago", finActualStr),
        supabase
          .from("pagos")
          .select("monto")
          .eq("estado", "pagado")
          .gte("fecha_pago", inicioAnteriorStr)
          .lte("fecha_pago", finAnteriorStr),
        supabase
          .from("pagos")
          .select("id, monto, fecha_vencimiento, periodo_pagado, estudiante:perfiles!pagos_estudiante_id_fkey(nombre_completo)")
          .eq("estado", "pendiente")
          .order("fecha_vencimiento", { ascending: true })
          .limit(8),
        supabase
          .from("matriculas")
          .select("estudiante_id")
          .eq("estado", "activo"),
        supabase
          .from("matriculas")
          .select("estudiante_id")
          .gte("created_at", inicioActualStr)
          .lte("created_at", finActualStr),
        supabase
          .from("leads")
          .select("id")
          .gte("created_at", inicioActualStr)
          .lte("created_at", finActualStr),
        supabase
          .from("cursos")
          .select("id, nombre, cupos, estado, dias_semana, hora_inicio, hora_fin, programas(nombre), matriculas:matriculas(count)")
          .eq("estado", "activo")
          .order("cupos", { ascending: false })
          .limit(8)
      ]);

      if (!isMountedRef.current) return;

      const errors: string[] = [];

      const pagosPeriodo = pagosPeriodoResp.error ? [] : pagosPeriodoResp.data || [];
      if (pagosPeriodoResp.error) errors.push(`Pagos pagados: ${pagosPeriodoResp.error.message}`);

      const pagosAnterior = pagosAnteriorResp.error ? [] : pagosAnteriorResp.data || [];
      if (pagosAnteriorResp.error) errors.push(`Comparativo ingresos: ${pagosAnteriorResp.error.message}`);

      const pendientesData = pagosPendientesResp.error ? [] : (pagosPendientesResp.data as PagoPendiente[]) || [];
      if (pagosPendientesResp.error) errors.push(`Pagos pendientes: ${pagosPendientesResp.error.message}`);

      const matriculasActivas = matriculasActivasResp.error ? [] : matriculasActivasResp.data || [];
      if (matriculasActivasResp.error) errors.push(`Matrículas activas: ${matriculasActivasResp.error.message}`);

      const matriculasPeriodo = matriculasPeriodoResp.error ? [] : matriculasPeriodoResp.data || [];
      if (matriculasPeriodoResp.error) errors.push(`Nuevas matrículas: ${matriculasPeriodoResp.error.message}`);

      const leadsPeriodo = leadsPeriodoResp.error ? [] : leadsPeriodoResp.data || [];
      if (leadsPeriodoResp.error) errors.push(`Leads: ${leadsPeriodoResp.error.message}`);

      const cursosData = cursosResp.error ? [] : cursosResp.data || [];
      if (cursosResp.error) errors.push(`Cursos activos: ${cursosResp.error.message}`);

      setErrorMessage(errors.length > 0 ? errors.join(" • ") : null);

      const totalIngresosActual = pagosPeriodo.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
      const totalIngresosAnterior = pagosAnterior.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
      const variacionIngresos = totalIngresosAnterior > 0
        ? ((totalIngresosActual - totalIngresosAnterior) / totalIngresosAnterior) * 100
        : null;

      const totalPendiente = pendientesData.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
      const carteraTotal = totalPendiente + totalIngresosActual;
      const tasaMora = carteraTotal > 0 ? (totalPendiente / carteraTotal) * 100 : 0;

      const estudiantesActivos = new Set(
        matriculasActivas
          .map((matricula: any) => matricula.estudiante_id)
          .filter(Boolean)
      ).size;

      const nuevosEstudiantes = new Set(
        matriculasPeriodo
          .map((matricula: any) => matricula.estudiante_id)
          .filter(Boolean)
      ).size;

      const ocupaciones = cursosData.map((curso: any) => {
        const cupos = Number(curso.cupos || 0);
        const inscritos = Number(curso.matriculas?.[0]?.count || 0);
        const ocupacion = cupos > 0 ? (inscritos / cupos) * 100 : 0;
        return {
          id: curso.id,
          nombre: construirNombreGrupo(curso),
          cupos,
          inscritos,
          ocupacion
        } as CursoOcupacion;
      });

      const ocupacionPromedio = ocupaciones.length > 0
        ? ocupaciones.reduce((acc, curso) => acc + curso.ocupacion, 0) / ocupaciones.length
        : 0;

      const ingresosBuckets: Array<{ key: string; label: string; total: number }> = [];
      if (timeRange === "year") {
        for (let i = 11; i >= 0; i -= 1) {
          const fecha = fin.subtract(i, "month");
          ingresosBuckets.push({
            key: fecha.format("YYYY-MM"),
            label: fecha.format("MMM YY"),
            total: 0
          });
        }
        pagosPeriodo.forEach((pago: any) => {
          if (!pago.fecha_pago) return;
          const key = dayjs(pago.fecha_pago).format("YYYY-MM");
          const bucket = ingresosBuckets.find(b => b.key === key);
          if (bucket) bucket.total += Number(pago.monto || 0);
        });
      } else {
        for (let i = 0; i < totalDias; i += 1) {
          const fecha = inicio.add(i, "day");
          ingresosBuckets.push({
            key: fecha.format("YYYY-MM-DD"),
            label: fecha.format("DD MMM"),
            total: 0
          });
        }
        pagosPeriodo.forEach((pago: any) => {
          if (!pago.fecha_pago) return;
          const key = dayjs(pago.fecha_pago).format("YYYY-MM-DD");
          const bucket = ingresosBuckets.find(b => b.key === key);
          if (bucket) bucket.total += Number(pago.monto || 0);
        });
      }

      const ingresosData = ingresosBuckets.map(bucket => ({
        fecha: bucket.label,
        monto: Math.round(bucket.total * 100) / 100
      }));

      const metodos = new Map<string, number>();
      pagosPeriodo.forEach((pago: any) => {
        const metodo = pago.metodo_pago || "Sin método";
        const valorActual = metodos.get(metodo) || 0;
        metodos.set(metodo, valorActual + Number(pago.monto || 0));
      });

      const metodosData = Array.from(metodos.entries()).map(([type, value]) => ({
        type,
        value: Math.round(value * 100) / 100
      }));

      const cursosOrdenados = ocupaciones.sort((a, b) => b.ocupacion - a.ocupacion).slice(0, 4);

      if (!isMountedRef.current) return;

      setMetrics({
        ingresosPeriodo: totalIngresosActual,
        variacionIngresos,
        carteraVencida: totalPendiente,
        pagosPendientes: pendientesData.length,
        estudiantesActivos,
        nuevosEstudiantes,
        leadsNuevos: leadsPeriodo.length,
        ocupacionPromedio,
        tasaMora
      });
      setIngresosSeries(ingresosData);
      setMetodosSeries(metodosData);
      setPendientes(pendientesData);
      setCursosCriticos(cursosOrdenados);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      const description = error?.message || "Error desconocido.";
      setErrorMessage(description);
      message.error("No fue posible actualizar el tablero administrativo");
    } finally {
      if (isMountedRef.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [timeRange, initialLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const lineConfig = useMemo(() => ({
    data: ingresosSeries,
    xField: "fecha",
    yField: "monto",
    smooth: true,
    height: 280,
    color: "#1677ff",
    point: { size: 4 },
    tooltip: {
      formatter: (datum: { monto: number }) => ({
        name: "Ingresos",
        value: formatCurrency(datum.monto || 0)
      })
    },
    xAxis: {
      label: {
        formatter: (text: string) => text
      }
    }
  }), [ingresosSeries]);

  const pieConfig = useMemo(() => ({
    data: metodosSeries,
    angleField: "value",
    colorField: "type",
    innerRadius: 0.6,
    legend: { position: "bottom" as const },
    height: 300,
    tooltip: {
      formatter: (datum: { value: number }) => ({
        name: "Total",
        value: formatCurrency(datum.value || 0)
      })
    }
  }), [metodosSeries]);

  const metricCards = [
    {
      key: "ingresos",
      title: "Ingresos del período",
      value: metrics.ingresosPeriodo,
      prefix: "$",
      precision: 0,
      icon: <DollarCircleOutlined style={{ color: "#1677ff" }} />,
      extra: metrics.variacionIngresos !== null ? (
        <Tag color={metrics.variacionIngresos >= 0 ? "green" : "red"}>
          {metrics.variacionIngresos >= 0 ? "+" : ""}
          {metrics.variacionIngresos.toFixed(1)}%
        </Tag>
      ) : null,
      valueStyle: { fontWeight: 600 }
    },
    {
      key: "cartera",
      title: "Cartera vencida",
      value: metrics.carteraVencida,
      prefix: "$",
      icon: <WarningOutlined style={{ color: "#fa8c16" }} />,
      extra: <Tag color="default">{metrics.pagosPendientes} pendientes</Tag>,
      valueStyle: { color: "#fa541c", fontWeight: 600 }
    },
    {
      key: "activos",
      title: "Estudiantes activos",
      value: metrics.estudiantesActivos,
      prefix: "",
      icon: <TeamOutlined style={{ color: "#52c41a" }} />,
      extra: metrics.nuevosEstudiantes > 0 ? (
        <Tag color="green">+{metrics.nuevosEstudiantes} nuevas matrículas</Tag>
      ) : null,
      valueStyle: { fontWeight: 600 }
    },
    {
      key: "leads",
      title: "Leads captados",
      value: metrics.leadsNuevos,
      icon: <ThunderboltOutlined style={{ color: "#722ed1" }} />,
      valueStyle: { fontWeight: 600 }
    },
    {
      key: "ocupacion",
      title: "Ocupación promedio",
      value: Number(metrics.ocupacionPromedio.toFixed(1)),
      suffix: "%",
      icon: <BarChartOutlined style={{ color: "#13c2c2" }} />,
      valueStyle: { fontWeight: 600 }
    },
    {
      key: "mora",
      title: "Tasa de mora",
      value: Number(metrics.tasaMora.toFixed(1)),
      suffix: "%",
      icon: <BankOutlined style={{ color: "#d32f2f" }} />,
      valueStyle: { fontWeight: 600 }
    }
  ];

  const quickActions = [
    {
      title: "Registrar pago",
      description: "Captura un ingreso o registra un abono inmediato.",
      href: "/tesoreria/create",
      icon: <DollarCircleOutlined style={{ color: "#1677ff" }} />
    },
    {
      title: "Crear matrícula",
      description: "Inscribe a un estudiante en un curso activo.",
      href: "/matriculas/create",
      icon: <UserAddOutlined style={{ color: "#52c41a" }} />
    },
    {
      title: "Gestionar leads",
      description: "Convierte prospectos calientes en matrículas.",
      href: "/leads",
      icon: <ThunderboltOutlined style={{ color: "#722ed1" }} />
    },
    {
      title: "Planificar cursos",
      description: "Ajusta horarios y abre nuevos grupos.",
      href: "/planificador",
      icon: <CalendarOutlined style={{ color: "#13c2c2" }} />
    }
  ];

  const handleRangeChange = (value: SegmentedValue) => {
    setTimeRange(value as TimeRange);
  };

  return (
    <div style={{
      padding: window.innerWidth < 768 ? "16px 8px" : "24px 12px",
    }}>
      <div style={{
        display: "flex",
        flexDirection: window.innerWidth < 768 ? "column" : "row",
        justifyContent: "space-between",
        alignItems: window.innerWidth < 768 ? "flex-start" : "center",
        marginBottom: 24,
        gap: 16,
      }}>
        <div>
          <Title level={window.innerWidth < 768 ? 4 : 3} style={{ marginBottom: 4 }}>Panel administrativo</Title>
          <Text type="secondary" style={{
            fontSize: window.innerWidth < 768 ? "12px" : "14px",
          }}>Visualiza indicadores clave y toma decisiones con datos confiables.</Text>
        </div>
        <Space size={8} align="center" wrap style={{
          width: window.innerWidth < 768 ? "100%" : "auto",
        }}>
          <Segmented
            options={[
              { label: "30d", value: "30d" },
              { label: "90d", value: "90d" },
              { label: "12m", value: "year" }
            ]}
            value={timeRange}
            onChange={handleRangeChange}
            size={window.innerWidth < 768 ? "small" : "middle"}
            style={{
              fontSize: window.innerWidth < 768 ? "12px" : "14px",
            }}
          />
          <Button
            icon={<SyncOutlined />}
            onClick={fetchData}
            loading={refreshing && !initialLoading}
            size={window.innerWidth < 768 ? "small" : "middle"}
          />
        </Space>
      </div>

      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message="No pudimos actualizar los datos"
          description={errorMessage}
          style={{ marginBottom: 24 }}
        />
      )}

      <Spin spinning={initialLoading} tip="Consultando métricas...">
        <Row gutter={[12, 12]} style={{
          marginBottom: 24,
        }}>
          {metricCards.map(card => (
            <Col key={card.key} xs={12} sm={12} md={8} lg={6}>
              <Card style={{
                padding: window.innerWidth < 768 ? "12px" : "16px",
              }}>
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Space align="center" size={window.innerWidth < 768 ? 6 : 12} style={{
                    flexWrap: "wrap",
                  }}>
                    <span style={{
                      fontSize: window.innerWidth < 768 ? "16px" : "20px",
                    }}>
                      {card.icon}
                    </span>
                    <Text type="secondary" style={{
                      fontSize: window.innerWidth < 768 ? "11px" : "13px",
                      flex: 1,
                    }}>{card.title}</Text>
                    {card.extra && (
                      <div style={{
                        fontSize: window.innerWidth < 768 ? "10px" : "12px",
                      }}>
                        {card.extra}
                      </div>
                    )}
                  </Space>
                  <Statistic
                    value={card.value}
                    prefix={card.prefix}
                    suffix={card.suffix}
                    precision={card.precision}
                    valueStyle={{
                      ...card.valueStyle,
                      fontSize: window.innerWidth < 768 ? "16px" : "24px",
                    }}
                  />
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      <Row gutter={[12, 12]} style={{ marginTop: 24 }}>
        <Col xs={24} md={16}>
          <Spin spinning={initialLoading || (refreshing && !initialLoading)} tip="Actualizando ingresos...">
            <Card title={
              <Space size={8}>
                <RiseOutlined style={{ color: "#1677ff", fontSize: window.innerWidth < 768 ? "16px" : "20px" }} />
                <span style={{
                  fontSize: window.innerWidth < 768 ? "14px" : "16px",
                }}>Evolución de ingresos</span>
              </Space>
            } style={{
              marginBottom: window.innerWidth < 768 ? "12px" : "0px",
            }}>
              {ingresosSeries.length === 0 ? (
                <Empty description="Sin información para el rango seleccionado" />
              ) : (
                <Line {...{
                  ...lineConfig,
                  height: window.innerWidth < 768 ? 200 : 280,
                }} />
              )}
            </Card>
          </Spin>
        </Col>
        <Col xs={24} md={8}>
          <Spin spinning={initialLoading || (refreshing && !initialLoading)} tip="Cargando distribución...">
            <Card title={<span style={{
              fontSize: window.innerWidth < 768 ? "14px" : "16px",
            }}>Distribución por método de pago</span>}>
              {metodosSeries.length === 0 ? (
                <Empty description="Registra pagos para ver la distribución" />
              ) : (
                <Pie {...{
                  ...pieConfig,
                  height: window.innerWidth < 768 ? 200 : 300,
                }} />
              )}
            </Card>
          </Spin>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={16}>
          <Card
            title="Pagos más urgentes"
            extra={<Tag color="red">Atención prioritaria</Tag>}
          >
            <Spin spinning={initialLoading || (refreshing && !initialLoading)}>
              {pendientes.length === 0 ? (
              <Empty description="No hay pagos pendientes" />
            ) : (
              <List
                dataSource={pendientes}
                renderItem={(pago) => {
                  const vencimiento = pago.fecha_vencimiento ? dayjs(pago.fecha_vencimiento) : null;
                  const vencido = vencimiento ? vencimiento.isBefore(dayjs(), "day") : false;
                  return (
                    <List.Item key={pago.id}>
                      <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
                        <Space direction="vertical" size={0}>
                          <Text strong>{pago.estudiante?.nombre_completo || "Estudiante"}</Text>
                          <Text type="secondary">{pago.periodo_pagado || "Periodo sin especificar"}</Text>
                          {vencimiento && (
                            <Tag color={vencido ? "red" : "orange"}>
                              {vencido ? "Vencido" : "Próximo vencimiento"} • {vencimiento.format("DD MMM")}
                            </Tag>
                          )}
                        </Space>
                        <Text strong style={{ color: vencido ? "#d4380d" : "#fa8c16" }}>
                          {formatCurrency(Number(pago.monto || 0))}
                        </Text>
                      </Space>
                    </List.Item>
                  );
                }}
              />
              )}
            </Spin>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Accesos rápidos">
            {quickActions.map(action => (
              <div key={action.href} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                <Space align="start">
                  {action.icon}
                  <div>
                    <Text strong>{action.title}</Text>
                    <Text type="secondary" style={{ display: "block" }}>{action.description}</Text>
                  </div>
                </Space>
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={() => router.push(action.href)}
                />
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }} title="Cursos con mayor ocupación">
        <Spin spinning={initialLoading || (refreshing && !initialLoading)}>
          {cursosCriticos.length === 0 ? (
          <Empty description="No hay cursos con matrículas registradas" />
        ) : (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {cursosCriticos.map((curso, index) => (
              <div key={curso.id}>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Space direction="vertical" size={0}>
                    <Text strong>{construirNombreGrupo(curso)}</Text>
                    <Text type="secondary">{curso.inscritos}/{curso.cupos || 0} estudiantes</Text>
                  </Space>
                  <Tag color={curso.ocupacion >= 85 ? "red" : curso.ocupacion >= 70 ? "orange" : "blue"}>
                    {curso.ocupacion.toFixed(1)}%
                  </Tag>
                </Space>
                <Progress
                  percent={Number(curso.ocupacion.toFixed(1))}
                  strokeColor={curso.ocupacion >= 85 ? "#f5222d" : curso.ocupacion >= 70 ? "#fa8c16" : "#1890ff"}
                  style={{ marginTop: 8 }}
                />
                {index < cursosCriticos.length - 1 && <Divider style={{ margin: "16px 0" }} />}
              </div>
            ))}
          </Space>
          )}
        </Spin>
      </Card>
    </div>
  );
}
