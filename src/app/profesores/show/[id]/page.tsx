"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { obtenerDashboardProfesor } from "@modules/academico/profesores.service";
import { ProfessorDashboardUI } from "../../../../components/profesor/ProfessorDashboardUI";
import {
  ArrowLeftOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined,
  DashboardOutlined,
  BookOutlined,
  CalendarOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  List,
  Row,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
  Spin,
  Empty,
  Dropdown,
  Modal,
  message,
} from "antd";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export default function ShowProfesorDashboard() {
  const params = useParams();
  const router = useRouter();
  const idProfesor = params?.id as string;
  const [activeKey, setActiveKey] = React.useState("perfil");
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  React.useEffect(() => {
    if (!idProfesor) return;
    setLoading(true);
    obtenerDashboardProfesor(idProfesor)
      .then((response) => setData(response))
      .catch((error) => {
        console.error("Error cargando dashboard del profesor", error);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [idProfesor]);

  const allowedCourseIds = React.useMemo(() => {
    const set = new Set<string>();
    (data?.cursos || []).forEach((c: any) => {
      if (c?.id) set.add(String(c.id));
    });
    return set;
  }, [data?.cursos]);

  const handleOpenCourse = (cursoId: string, action?: "attendance" | "grades" | "materials" | "default") => {
    if (!cursoId) return;
    const id = String(cursoId);
    if (!allowedCourseIds.has(id)) {
      return; // evita navegar a cursos no asignados
    }
    const section = action && action !== "default" ? `?section=${encodeURIComponent(action)}` : "";
    router.push(`/cursos/show/${id}${section}`);
  };

  const handleEditProfesor = () => {
    if (idProfesor) {
      router.push(`/profesores/edit/${idProfesor}`);
    }
  };

  const handleDeleteProfesor = () => {
    Modal.confirm({
      title: "Eliminar profesor",
      content: `¿Estás seguro de que deseas eliminar a ${perfil?.nombre_completo}? Esta acción no se puede deshacer.`,
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      async onOk() {
        setDeleteLoading(true);
        try {
          const response = await fetch("/api/auth/delete-profesor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: idProfesor }),
          });

          const result = await response.json();

          if (!response.ok || !result?.success) {
            throw new Error(result?.error || "No se pudo eliminar el profesor");
          }

          if (result?.softDeleted) {
            message.success("Profesor desactivado exitosamente");
          } else {
            message.success("Profesor eliminado exitosamente");
          }
          router.push("/profesores");
        } catch (error: any) {
          message.error(error?.message || "Error al eliminar el profesor");
        } finally {
          setDeleteLoading(false);
        }
      },
    });
  };

  const menuItems = [
    {
      key: "edit",
      icon: <EditOutlined />,
      label: "Editar",
      onClick: handleEditProfesor,
    },
    {
      key: "delete",
      icon: <DeleteOutlined />,
      label: "Eliminar",
      danger: true,
      onClick: handleDeleteProfesor,
    },
  ];

  const dashboard = data
    ? {
        loading: Boolean(data.loading),
        profesorNombre: data.profesorNombre,
        stats: data.stats,
        cursos: data.cursos,
        proximasSesiones: data.proximasSesiones,
        pendientes: data.pendientes,
        pagos: data.pagos,
      }
    : null;

  const perfil = data?.perfil;
  const stats = dashboard?.stats;

  const nextSessionByCourse = React.useMemo(() => {
    const map: Record<string, { fecha: string; isSoon: boolean }> = {};

    (dashboard?.proximasSesiones || []).forEach((sesion: any) => {
      if (!sesion?.cursoId || !sesion?.fecha) return;
      const key = String(sesion.cursoId);
      const existing = map[key];
      const fecha = dayjs(sesion.fecha);
      if (!existing || fecha.isBefore(dayjs(existing.fecha))) {
        const isSoon = fecha.isBefore(dayjs().add(24, "hour"));
        map[key] = { fecha: fecha.toISOString(), isSoon };
      }
    });

    return map;
  }, [dashboard?.proximasSesiones]);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24 }}>
        <Space direction="vertical" size="large">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/profesores")}>Volver a profesores</Button>
          <Card>
            <Title level={4}>No se pudo cargar la información del profesor</Title>
            <Text type="secondary">Intenta nuevamente o verifica que el profesor exista.</Text>
          </Card>
        </Space>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Space size="large" style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/profesores")}>Regresar</Button>
        <Title level={3} style={{ margin: 0 }}>Ficha del profesor</Title>
        <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
          <Button 
            icon={<MoreOutlined />} 
            loading={deleteLoading}
            style={{ marginLeft: "auto" }}
          >
            Acciones
          </Button>
        </Dropdown>
      </Space>

      <Tabs activeKey={activeKey} onChange={setActiveKey} items={[
        {
          key: "perfil",
          label: "Resumen",
          children: (
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <Card variant="borderless" style={{ borderRadius: 20, boxShadow: "0 16px 35px -24px rgba(15,23,42,0.4)" }}>
                <Row gutter={[24, 24]} align="middle">
                  <Col xs={24} md={6}>
                    <Avatar size={96} style={{ backgroundColor: "#1e3a8a", fontSize: 36 }}>
                      {(perfil?.nombre_completo || "P").charAt(0).toUpperCase()}
                    </Avatar>
                  </Col>
                  <Col xs={24} md={18}>
                    <Space direction="vertical" size={8} style={{ width: "100%" }}>
                      <Title level={3} style={{ margin: 0 }}>
                        {perfil?.nombre_completo || "Profesor"}
                      </Title>
                      <Space split={<Divider type="vertical" />} wrap>
                        <Tag color={perfil?.activo === false ? "volcano" : "green"}>
                          {perfil?.activo === false ? "Inactivo" : "Activo"}
                        </Tag>
                        {perfil?.created_at ? (
                          <span><CalendarOutlined /> Ingreso {dayjs(perfil.created_at).format("DD MMM YYYY")}</span>
                        ) : null}
                      </Space>
                      <Space direction="vertical" size={4}>
                        {perfil?.email ? <Text><MailOutlined /> {perfil.email}</Text> : null}
                        {perfil?.telefono ? <Text><PhoneOutlined /> {perfil.telefono}</Text> : null}
                        {perfil?.identificacion ? <Text><IdcardOutlined /> {perfil.identificacion}</Text> : null}
                      </Space>
                    </Space>
                  </Col>
                </Row>
                <Divider style={{ margin: "24px 0" }} />
                <Space size="middle" wrap>
                  <Button type="primary" icon={<DashboardOutlined />} onClick={() => setActiveKey("panel")}>
                    Abrir panel del profesor
                  </Button>
                </Space>
              </Card>

              <Row gutter={[24, 24]}>
                <Col xs={24} md={8}>
                  <Card variant="borderless" style={{ borderRadius: 16, height: "100%" }}>
                    <Statistic title="Cursos activos" value={stats?.cursosActivos ?? 0} suffix="cursos" />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card variant="borderless" style={{ borderRadius: 16, height: "100%" }}>
                    <Statistic title="Estudiantes en seguimiento" value={stats?.totalEstudiantes ?? 0} suffix="est." />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card variant="borderless" style={{ borderRadius: 16, height: "100%" }}>
                    <Statistic title="Horas dictadas este mes" value={stats?.horasMes ?? 0} suffix="hrs" />
                  </Card>
                </Col>
              </Row>

              <Card
                variant="borderless"
                title={<Space><BookOutlined /> Cursos asignados</Space>}
                style={{ borderRadius: 20, boxShadow: "0 16px 35px -24px rgba(15,23,42,0.4)" }}
              >
                <Row gutter={[16, 16]}>
                  {(dashboard?.cursos || []).map((curso: any) => {
                    const next = nextSessionByCourse[String(curso.id)];
                    const isSoon = next?.isSoon;
                    const fechaTexto = next?.fecha
                      ? dayjs(next.fecha).format("ddd D MMM, HH:mm")
                      : "Sin próxima sesión";

                    return (
                      <Col key={curso.id} xs={24} sm={12} lg={8}>
                        <Card
                          hoverable
                          onClick={() => handleOpenCourse(curso.id)}
                          style={{
                            borderRadius: 16,
                            border: isSoon ? "1px solid #A855F7" : undefined,
                            boxShadow: isSoon
                              ? "0 14px 36px -18px rgba(168,85,247,0.45)"
                              : "0 12px 30px -18px rgba(15,23,42,0.35)",
                            cursor: "pointer",
                            background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(14,165,233,0.05))",
                          }}
                          bodyStyle={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 150 }}
                        >
                          <Space align="center" split={<Divider type="vertical" />} wrap>
                            <Title level={4} style={{ margin: 0 }}>
                              {curso.nombre}
                            </Title>
                            <Tag color={curso.estado === "activo" ? "green" : curso.estado === "pausado" ? "gold" : "blue"}>
                              {curso.estado}
                            </Tag>
                          </Space>

                          <Text type="secondary">{curso.estudiantesActivos || 0} estudiantes activos</Text>

                          <Space size={8} align="center">
                            <CalendarOutlined style={{ color: isSoon ? "#A855F7" : "#94A3B8" }} />
                            <Text strong style={{ color: isSoon ? "#E0CCFF" : undefined }}>
                              {fechaTexto}
                            </Text>
                          </Space>

                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Toca la tarjeta para abrir el curso y ver opciones.
                          </Text>
                        </Card>
                      </Col>
                    );
                  })}
                  {(dashboard?.cursos || []).length === 0 && (
                    <Col span={24}>
                      <Card variant="borderless">
                        <Empty description="No hay cursos asignados" />
                      </Card>
                    </Col>
                  )}
                </Row>
              </Card>

              <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                  <Card
                    variant="borderless"
                    title={<Space><CalendarOutlined /> Próximas sesiones</Space>}
                    style={{ borderRadius: 16, height: "100%" }}
                  >
                    <List
                      dataSource={dashboard?.proximasSesiones?.slice(0, 4) || []}
                      locale={{ emptyText: "Sin sesiones programadas" }}
                      renderItem={(sesion: any) => (
                        <List.Item
                          style={{ cursor: "pointer" }}
                          onClick={() => handleOpenCourse(sesion.cursoId)}
                        >
                          <List.Item.Meta
                            title={sesion.curso}
                            description={dayjs(sesion.fecha).format("dddd D MMMM, HH:mm")}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card
                    variant="borderless"
                    title={<Space><DashboardOutlined /> Pendientes por calificar</Space>}
                    style={{ borderRadius: 16, height: "100%" }}
                  >
                    <List
                      dataSource={dashboard?.pendientes?.slice(0, 4) || []}
                      locale={{ emptyText: "Sin pendientes" }}
                      renderItem={(pendiente: any) => (
                        <List.Item
                          style={{ cursor: pendiente.cursoId ? "pointer" : "default", opacity: pendiente.cursoId ? 1 : 0.6 }}
                          onClick={() => pendiente.cursoId && handleOpenCourse(pendiente.cursoId)}
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
                </Col>
              </Row>
            </Space>
          ),
        },
        {
          key: "panel",
          label: "Panel del profesor",
          children: (
            <ProfessorDashboardUI dashboard={dashboard} onOpenCourse={handleOpenCourse} />
          ),
        },
      ]} />
    </div>
  );
}