"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Typography,
  Button,
  Spin,
  Row,
  Col,
  Tag,
  Space,
  Divider,
  Progress,
  Empty,
  Tooltip,
  App,
  Grid,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  ReloadOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import updateLocale from "dayjs/plugin/updateLocale";
import "dayjs/locale/es";
import { useNavigation } from "@refinedev/core";
import { obtenerCursos, type GrupoAcademico } from "../../modules/academico/cursos.service";
import { construirNombreGrupo } from "@utils/grupos";

dayjs.extend(updateLocale);
dayjs.updateLocale("es", { weekStart: 1 });
dayjs.locale("es");

const { useBreakpoint } = Grid;

const { Title, Text } = Typography;

const ESTADO_META: Record<string, { label: string; color: string }> = {
  activo: { label: "Activo", color: "green" },
  proximo: { label: "Próximo", color: "blue" },
  cerrado: { label: "Cerrado", color: "orange" },
  finalizado: { label: "Finalizado", color: "default" },
};

function formatearDias(dias?: string | null) {
  if (!dias) return "Sin días definidos";
  return dias
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((dia) => dia.charAt(0).toUpperCase() + dia.slice(1))
    .join(" · ");
}

function formatearHorario(inicio?: string | null, fin?: string | null) {
  if (!inicio && !fin) return "Horario no asignado";
  const formato = (valor: string | null | undefined) =>
    valor ? dayjs(valor, "HH:mm:ss").format("hh:mm A") : "";
  const inicioFmt = formato(inicio);
  const finFmt = formato(fin);
  if (inicioFmt && finFmt) {
    return `${inicioFmt} - ${finFmt}`;
  }
  return inicioFmt || finFmt || "Horario no asignado";
}

function construirMensajeInicio(fecha?: string | null) {
  if (!fecha) return null;
  const hoy = dayjs();
  const inicio = dayjs(fecha);
  const diff = inicio.startOf("day").diff(hoy.startOf("day"), "day");
  if (diff === 0) return "Inicia hoy";
  if (diff === 1) return "Inicia mañana";
  if (diff > 1) return `Inicia en ${diff} días`;
  if (diff === -1) return "Inició ayer";
  return `Inició hace ${Math.abs(diff)} días`;
}

function obtenerInscritos(grupo: GrupoAcademico) {
  return Number(grupo.matriculas?.[0]?.count || 0);
}

function obtenerEstado(grupo: GrupoAcademico) {
  const estado = (grupo.estado || "").toLowerCase();
  return ESTADO_META[estado] ?? { label: estado || "Sin estado", color: "default" };
}

export default function CursosList() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;
  const { edit, create, show } = useNavigation();
  const { message } = App.useApp();
  const [grupos, setGrupos] = useState<GrupoAcademico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargarGrupos = useCallback(async () => {
    try {
      const data = await obtenerCursos();
      setGrupos(data);
    } catch (error) {
      message.error("No se pudieron cargar los grupos");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    cargarGrupos();
  }, [cargarGrupos]);

  const refrescar = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await obtenerCursos();
      setGrupos(data);
    } catch (error) {
      message.error("No se pudieron actualizar los grupos");
    } finally {
      setRefreshing(false);
    }
  }, [message]);

  const gruposActivos = useMemo(() => {
    const hoy = dayjs();
    return grupos.filter((grupo) => {
      if ((grupo.estado || "").toLowerCase() === "activo") {
        return true;
      }
      const fechaInicio = grupo.fecha_inicio ? dayjs(grupo.fecha_inicio) : null;
      return (
        (grupo.estado || "").toLowerCase() === "proximo" &&
        fechaInicio &&
        !fechaInicio.isAfter(hoy.add(1, "day"))
      );
    });
  }, [grupos]);

  const gruposProximos = useMemo(() => {
    const hoy = dayjs();
    return grupos
      .filter((grupo) => {
        const estado = (grupo.estado || "").toLowerCase();
        const fechaInicio = grupo.fecha_inicio ? dayjs(grupo.fecha_inicio) : null;
        if (!fechaInicio) return estado === "proximo";
        return estado === "proximo" && fechaInicio.isAfter(hoy.add(1, "day"));
      })
      .sort((a, b) => {
        const fechaA = a.fecha_inicio ? dayjs(a.fecha_inicio).valueOf() : Number.POSITIVE_INFINITY;
        const fechaB = b.fecha_inicio ? dayjs(b.fecha_inicio).valueOf() : Number.POSITIVE_INFINITY;
        return fechaA - fechaB;
      });
  }, [grupos]);

  const gruposArchivados = useMemo(() => {
    return grupos.filter((grupo) => {
      const estado = (grupo.estado || "").toLowerCase();
      return !["activo", "proximo"].includes(estado);
    });
  }, [grupos]);

  const totalInscritosActivos = useMemo(
    () => gruposActivos.reduce((acc, grupo) => acc + obtenerInscritos(grupo), 0),
    [gruposActivos]
  );
  const totalCuposActivos = useMemo(
    () => gruposActivos.reduce((acc, grupo) => acc + Number(grupo.cupos || 0), 0),
    [gruposActivos]
  );
  const cuposDisponibles = Math.max(totalCuposActivos - totalInscritosActivos, 0);

  const renderGrupo = (grupo: GrupoAcademico) => {
    const estado = obtenerEstado(grupo);
    const inscritos = obtenerInscritos(grupo);
    const capacidad = Number(grupo.cupos || 0);
    const ocupacion = capacidad > 0 ? Math.round((inscritos / capacidad) * 100) : 0;
    const mensajeInicio = construirMensajeInicio(grupo.fecha_inicio);

    return (
      <Card
        key={grupo.id}
        hoverable
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: isMobile ? 12 : 20 }}
      >
        <Space direction="vertical" size={isMobile ? 12 : 16} style={{ width: "100%" }}>
          <Space 
            style={{ width: "100%", justifyContent: "space-between", alignItems: "flex-start" }}
            direction={isMobile ? "vertical" : "horizontal"}
          >
            <div style={{ width: isMobile ? "100%" : "auto" }}>
              <Title level={isMobile ? 5 : 4} style={{ marginBottom: 4 }}>
                {construirNombreGrupo(grupo)}
              </Title>
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
                {grupo.programas?.nombre || "Programa sin asignar"}
              </Text>
            </div>
            <Space wrap size={isMobile ? 4 : 8}>
              <Tag color={estado.color}>{estado.label}</Tag>
              <Button 
                size={isMobile ? "small" : "middle"}
                icon={<EditOutlined />} 
                onClick={() => edit("cursos", grupo.id)}
              >
                {isMobile ? "Editar" : "Editar"}
              </Button>
              <Button 
                type="link" 
                size={isMobile ? "small" : "middle"}
                onClick={() => show("cursos", grupo.id)}
              >
                {isMobile ? "Ver" : "Ver detalle"}
              </Button>
            </Space>
          </Space>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Space align="start">
                <CalendarOutlined style={{ fontSize: 20, color: "#722ed1" }} />
                <div>
                  <Text strong>Inicio</Text>
                  <div>{grupo.fecha_inicio ? dayjs(grupo.fecha_inicio).format("DD MMM YYYY") : "Sin fecha"}</div>
                  {mensajeInicio && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {mensajeInicio}
                    </Text>
                  )}
                </div>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space align="start">
                <ClockCircleOutlined style={{ fontSize: 20, color: "#237804" }} />
                <div>
                  <Text strong>Horario</Text>
                  <div>{formatearHorario(grupo.hora_inicio, grupo.hora_fin)}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatearDias(grupo.dias_semana)}
                  </Text>
                </div>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space align="start">
                <TeamOutlined style={{ fontSize: 20, color: "#1890ff" }} />
                <div style={{ width: "100%" }}>
                  <Text strong>Capacidad</Text>
                  <div>{`${inscritos}/${capacidad || 0} estudiantes`}</div>
                  <Tooltip title={`Cupos libres: ${Math.max((capacidad || 0) - inscritos, 0)}`}>
                    <Progress
                      percent={ocupacion}
                      size="small"
                      status={ocupacion >= 100 ? "exception" : "active"}
                      showInfo={false}
                      style={{ marginTop: 4 }}
                    />
                  </Tooltip>
                </div>
              </Space>
            </Col>
          </Row>

          <Divider style={{ margin: "12px 0" }} />

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Text type="secondary">Profesor asignado</Text>
              <div>{grupo.profesor?.nombre_completo || "Por definir"}</div>
            </Col>
            <Col xs={24} md={12}>
              <Text type="secondary">Notas</Text>
              <div>{grupo.descripcion || "Sin notas adicionales"}</div>
            </Col>
          </Row>
        </Space>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card style={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </Card>
    );
  }

  return (
    <Card variant="borderless" style={{ background: "transparent" }}>
      <Space direction="vertical" size={isMobile ? 16 : 24} style={{ width: "100%" }}>
        <Space 
          style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}
          direction={isMobile ? "vertical" : "horizontal"}
        >
          <div>
            <Title level={isMobile ? 3 : 2} style={{ marginBottom: 0 }}>
              Grupos académicos
            </Title>
            {!isMobile && <Text type="secondary">Revisa los grupos activos y los próximos lanzamientos en un solo lugar.</Text>}
          </div>
          <Space size={isMobile ? 8 : 12}>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={refrescar} 
              loading={refreshing}
              size={isMobile ? "middle" : "large"}
            >
              {isMobile ? "" : "Actualizar"}
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => create("cursos")}
              size={isMobile ? "middle" : "large"}
            >
              {isMobile ? "Nuevo" : "Nuevo grupo"}
            </Button>
          </Space>
        </Space>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card variant="outlined" size="small">
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Grupos activos</Text>
              <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>{gruposActivos.length}</Title>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card variant="outlined" size="small">
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Próximos grupos</Text>
              <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>{gruposProximos.length}</Title>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card variant="outlined" size="small">
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Cupos disponibles (activos)</Text>
              <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>{cuposDisponibles}</Title>
            </Card>
          </Col>
        </Row>

        <section>
          <Divider orientation="left">Grupos activos</Divider>
          {gruposActivos.length === 0 ? (
            <Empty description="No hay grupos activos en este momento" />
          ) : (
            gruposActivos.map(renderGrupo)
          )}
        </section>

        <section>
          <Divider orientation="left">Próximos grupos</Divider>
          {gruposProximos.length === 0 ? (
            <Empty description="No hay lanzamientos programados" />
          ) : (
            gruposProximos.map(renderGrupo)
          )}
        </section>

        {gruposArchivados.length > 0 && (
          <section>
            <Divider orientation="left">Archivados</Divider>
            {gruposArchivados.map(renderGrupo)}
          </section>
        )}
      </Space>
    </Card>
  );
}
