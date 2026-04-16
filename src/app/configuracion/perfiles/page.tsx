"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Table,
  Space,
  Popconfirm,
  message,
  Modal,
  Tag,
  Row,
  Col,
  Divider,
  Typography,
  Spin,
  Drawer,
  Descriptions,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  TeamOutlined,
  UserAddOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { useRouter } from "next/navigation";

const { Title, Text, Paragraph } = Typography;

interface Perfil {
  id: string;
  nombre_completo: string;
  email: string;
  rol: string;
  nivel_jerarquico: string;
  telefono?: string;
  identificacion?: string;
  permisos?: any;
  created_at?: string;
}

interface Academia {
  id: string;
  nombre: string;
  nit?: string;
  director_id: string;
  email?: string;
  telefono?: string;
  ciudad?: string;
}

export default function GestionarPerfilesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [academia, setAcademia] = useState<Academia | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedPerfil, setSelectedPerfil] = useState<Perfil | null>(null);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);

      // Obtener usuario actual
      const { data: { user } } = await supabaseBrowserClient.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Obtener perfil del usuario actual
      const { data: perfilActual } = await supabaseBrowserClient
        .from("perfiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!perfilActual) {
        message.error("No se encontró tu perfil");
        return;
      }

      // Verificar permisos
      if (perfilActual.nivel_jerarquico !== "director" && perfilActual.nivel_jerarquico !== "administrador") {
        message.error("No tienes permisos para acceder a esta sección");
        router.push("/");
        return;
      }

      setCurrentUser(perfilActual);

      // Obtener academia
      if (perfilActual.academia_id) {
        const { data: academiaData } = await supabaseBrowserClient
          .from("academias")
          .select("*")
          .eq("id", perfilActual.academia_id)
          .maybeSingle();

        setAcademia(academiaData);

        // Obtener perfiles de la academia
        const { data: perfilesData } = await supabaseBrowserClient
          .from("perfiles")
          .select("*")
          .eq("academia_id", perfilActual.academia_id)
          .order("nivel_jerarquico", { ascending: false })
          .order("created_at", { ascending: false });

        setPerfiles(perfilesData || []);
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
      message.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleCrearPerfil = async (values: any) => {
    try {
      if (!currentUser?.academia_id) {
        message.error("No se encontró la academia");
        return;
      }

      const { email, nombre_completo, telefono, identificacion, nivel_jerarquico } = values;

      // Crear usuario en auth.users
      const { data: authData, error: authError } = await supabaseBrowserClient.auth.signUp({
        email,
        password: identificacion || Math.random().toString(36).slice(2, 11),
        options: {
          data: {
            nombre_completo,
            identificacion,
            rol: nivel_jerarquico === 'administrador' ? 'administrativo' : nivel_jerarquico,
            // academy_id se asigna automáticamente por el trigger a Crystal Diamante
          },
        },
      });

      if (authError) {
        message.error(`Error: ${authError.message}`);
        return;
      }

      message.success(`Perfil creado. Confirmación enviada a ${email}`);
      form.resetFields();
      setModalVisible(false);
      await cargarDatos();
    } catch (error) {
      console.error("Error:", error);
      message.error("Error creando perfil");
    }
  };

  const handleActualizarPerfil = async (values: any) => {
    try {
      if (!editingId) return;

      const { nombre_completo, telefono, nivel_jerarquico } = values;

      const { error } = await supabaseBrowserClient
        .from("perfiles")
        .update({
          nombre_completo,
          telefono,
          nivel_jerarquico,
        })
        .eq("id", editingId);

      if (error) throw error;

      message.success("Perfil actualizado");
      form.resetFields();
      setModalVisible(false);
      setIsEditing(false);
      await cargarDatos();
    } catch (error) {
      console.error("Error:", error);
      message.error("Error actualizando perfil");
    }
  };

  const handleEliminar = async (id: string) => {
    try {
      const { error } = await supabaseBrowserClient
        .from("perfiles")
        .delete()
        .eq("id", id);

      if (error) throw error;

      message.success("Perfil eliminado");
      await cargarDatos();
    } catch (error) {
      console.error("Error:", error);
      message.error("Error eliminando perfil");
    }
  };

  const handleEditar = (perfil: Perfil) => {
    setIsEditing(true);
    setEditingId(perfil.id);
    form.setFieldsValue({
      nombre_completo: perfil.nombre_completo,
      email: perfil.email,
      telefono: perfil.telefono,
      nivel_jerarquico: perfil.nivel_jerarquico,
    });
    setModalVisible(true);
  };

  const handleAbrirModal = () => {
    setIsEditing(false);
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const getNivelColor = (nivel: string) => {
    const colors: Record<string, string> = {
      director: "gold",
      administrador: "blue",
      asesor: "cyan",
      profesor: "green",
      estudiante: "default",
    };
    return colors[nivel] || "default";
  };

  const getNivelLabel = (nivel: string) => {
    const labels: Record<string, string> = {
      director: "🏆 Director",
      administrador: "👔 Administrador",
      asesor: "📞 Asesor",
      profesor: "🎓 Profesor",
      estudiante: "👨‍🎓 Estudiante",
    };
    return labels[nivel] || nivel;
  };

  const getPermisosPorNivel = (nivel: string) => {
    const permisosPorNivel: Record<string, string[]> = {
      director: [
        "Ver Dashboard",
        "Configurar Academia",
        "Crear Perfiles",
        "Gestionar Cursos",
        "Registrar Pagos",
        "Ver Reportes",
        "Crear Matrículas",
        "Gestionar Leads",
        "Ver Nómina",
        "Eliminar Usuarios",
      ],
      administrador: [
        "Ver Dashboard",
        "Gestionar Cursos",
        "Registrar Pagos",
        "Ver Reportes",
        "Crear Matrículas",
        "Gestionar Leads",
        "Ver Nómina",
      ],
      asesor: [
        "Gestionar Leads",
        "Ver Información General",
      ],
      profesor: [
        "Ver Mis Cursos",
        "Cargar Asistencias",
        "Ver Mi Nómina",
      ],
      estudiante: [
        "Ver Mis Cursos",
        "Ver Mis Pagos",
        "Descargar Certificados",
      ],
    };
    return permisosPorNivel[nivel] || [];
  };

  const columns = [
    {
      title: "Nombre",
      dataIndex: "nombre_completo",
      key: "nombre_completo",
      render: (text: string, record: Perfil) => (
        <Button
          type="link"
          onClick={() => {
            setSelectedPerfil(record);
            setDrawerVisible(true);
          }}
        >
          {text}
        </Button>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Rol",
      dataIndex: "nivel_jerarquico",
      key: "nivel_jerarquico",
      render: (nivel: string) => (
        <Tag color={getNivelColor(nivel)}>{getNivelLabel(nivel)}</Tag>
      ),
    },
    {
      title: "Teléfono",
      dataIndex: "telefono",
      key: "telefono",
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 120,
      render: (_: any, record: Perfil) => (
        <Space>
          {record.nivel_jerarquico !== "director" && currentUser?.nivel_jerarquico === "director" && (
            <>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                title="Editar"
                onClick={() => handleEditar(record)}
              />
              <Popconfirm
                title="¿Eliminar?"
                description={`¿Seguro que deseas eliminar a ${record.nombre_completo}?`}
                onConfirm={() => handleEliminar(record.id)}
                okText="Sí"
                cancelText="No"
              >
                <Button type="text" danger size="small" icon={<DeleteOutlined />} title="Eliminar" />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", background: "#f0f2f5", minHeight: "100vh" }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <div>
            <Title level={2} style={{ margin: 0, color: "#262626" }}>
              <TeamOutlined /> Gestión de Perfiles
            </Title>
            <Text type="secondary">
              Crea y administra los perfiles de tu equipo de trabajo
            </Text>
          </div>
        </Col>
      </Row>

      {/* Jerarquía Visual */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <Card title="📊 Jerarquía de Roles" variant="outlined">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: 16 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🏆</div>
                <Tag color="gold">Director</Tag>
                <Paragraph style={{ fontSize: 12, marginTop: 8 }}>Propietario</Paragraph>
              </div>
              <ArrowRightOutlined style={{ fontSize: 20 }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>👔</div>
                <Tag color="blue">Administrador</Tag>
                <Paragraph style={{ fontSize: 12, marginTop: 8 }}>Apoyo Operativo</Paragraph>
              </div>
              <ArrowRightOutlined style={{ fontSize: 20 }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📞</div>
                <Tag color="cyan">Asesor</Tag>
                <Paragraph style={{ fontSize: 12, marginTop: 8 }}>Solo Leads</Paragraph>
              </div>
              <ArrowRightOutlined style={{ fontSize: 20 }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🎓</div>
                <Tag color="green">Profesor</Tag>
                <Paragraph style={{ fontSize: 12, marginTop: 8 }}>Docente</Paragraph>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Tabla de Perfiles */}
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card
            title="👥 Equipo de la Academia"
            extra={
              currentUser?.nivel_jerarquico === "director" && (
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={handleAbrirModal}
                >
                  Agregar Perfil
                </Button>
              )
            }
          >
            <Table
              columns={columns}
              dataSource={perfiles}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 800 }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* Modal para crear/editar */}
      <Modal
        title={isEditing ? "Editar Perfil" : "Crear Nuevo Perfil"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={isEditing ? handleActualizarPerfil : handleCrearPerfil}
        >
          <Form.Item
            label="Nombre Completo"
            name="nombre_completo"
            rules={[{ required: true, message: "Requerido" }]}
          >
            <Input placeholder="Ej: Juan Pérez" />
          </Form.Item>

          {!isEditing && (
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: "Requerido" },
                { type: "email", message: "Email inválido" },
              ]}
            >
              <Input placeholder="correo@ejemplo.com" />
            </Form.Item>
          )}

          <Form.Item
            label="Identificación (Cédula)"
            name="identificacion"
            rules={[{ required: true, message: "Requerido" }]}
          >
            <Input placeholder="1234567890" />
          </Form.Item>

          <Form.Item
            label="Teléfono"
            name="telefono"
            rules={[{ required: true, message: "Requerido" }]}
          >
            <Input placeholder="3001234567" />
          </Form.Item>

          <Form.Item
            label="Rol / Nivel"
            name="nivel_jerarquico"
            rules={[{ required: true, message: "Requerido" }]}
          >
            <Select
              placeholder="Selecciona un rol"
              options={[
                { label: "👔 Administrador", value: "administrador" },
                { label: "📞 Asesor", value: "asesor" },
                { label: "🎓 Profesor", value: "profesor" },
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {isEditing ? "Guardar" : "Crear"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer con detalles del perfil */}
      <Drawer
        title="Detalles del Perfil"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
        {selectedPerfil && (
          <>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Nombre">
                {selectedPerfil.nombre_completo}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {selectedPerfil.email}
              </Descriptions.Item>
              <Descriptions.Item label="Rol">
                <Tag color={getNivelColor(selectedPerfil.nivel_jerarquico)}>
                  {getNivelLabel(selectedPerfil.nivel_jerarquico)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Teléfono">
                {selectedPerfil.telefono || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Identificación">
                {selectedPerfil.identificacion || "-"}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Title level={5}>Permisos Disponibles</Title>
            {getPermisosPorNivel(selectedPerfil.nivel_jerarquico).map((permiso) => (
              <div key={permiso} style={{ marginBottom: 8 }}>
                <Tag color="success">{permiso}</Tag>
              </div>
            ))}
          </>
        )}
      </Drawer>
    </div>
  );
}
