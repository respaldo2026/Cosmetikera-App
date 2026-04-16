"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, Button, Typography, Space, Modal, Form, Input, InputNumber, Table, Tag, App, Spin, Checkbox, Tooltip, Dropdown, Grid, Row, Col, Statistic, Divider, Badge } from "antd";
import { PlusOutlined, EditOutlined, BookOutlined, MoreOutlined, DeleteOutlined, FolderOutlined, ClockCircleOutlined, DollarOutlined, FireOutlined, TrophyOutlined, EyeOutlined, ThunderboltOutlined, AppstoreOutlined, UnorderedListOutlined, FileTextOutlined } from "@ant-design/icons";
import type { CheckboxChangeEvent } from "antd/es/checkbox";
import { supabaseBrowserClient } from "@utils/supabase/client";
import GestorPensum from "@components/GestorPensum";
import "./programas.module.css";
import "../globals-programas.css";

const { useBreakpoint } = Grid;

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function ProgramasPage() {

  // Declaración de estado y hooks (única sección)
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const formValues = Form.useWatch([], form);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState<any>(null);
  const [programas, setProgramas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [gestorPensumVisible, setGestorPensumVisible] = useState(false);
  const [programaSeleccionado, setProgramaSeleccionado] = useState<any>(null);
  const [vistaCards, setVistaCards] = useState(true);





    // Cargar programas desde Supabase (única versión)
    const cargarProgramas = useCallback(async () => {
      setLoading(true);
      try {
        let query = supabaseBrowserClient
          .from("programas")
          .select("*")
          .order("nombre", { ascending: true });
        if (!mostrarInactivos) {
          query = query.eq("activo", true);
        }
        const { data, error } = await query;
        if (!error && data) {
          setProgramas(data);
        }
      } catch (error) {
        message.error("Error al cargar programas");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }, [mostrarInactivos, message]);

    useEffect(() => {
      cargarProgramas();
    }, [cargarProgramas]);

    // Guardar o editar programa (única versión)
    const handleSubmit = async () => {
      try {
        const values = await form.validateFields();
        let payload = { ...values };
        if (editingPrograma) {
          // Editar
          const { error } = await supabaseBrowserClient
            .from("programas")
            .update(payload)
            .eq("id", editingPrograma.id);
          if (error) throw error;
          message.success("Programa actualizado correctamente");
        } else {
          // Crear
          const { error } = await supabaseBrowserClient
            .from("programas")
            .insert([payload]);
          if (error) throw error;
          message.success("Programa creado correctamente");
        }
        await handleCloseModal({ refresh: true });
      } catch (error: any) {
        if (error?.code === "23505" || error?.message?.includes("duplicate key")) {
          message.error("Ya existe un programa con ese nombre. Activa 'Inactivos' y reactívalo, o elimínalo si no lo usarás.");
        } else {
          message.error("Error al guardar: " + (error?.message || "Desconocido"));
        }
        console.error(error);
      }
    };

  const handleOpenModal = (programa?: any) => {
    if (programa) {
      setEditingPrograma(programa);
      form.setFieldsValue(programa);
    } else {
      setEditingPrograma(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleCloseModal = async (options?: { refresh?: boolean }) => {
    setModalVisible(false);
    setEditingPrograma(null);
    form.resetFields();
    if (options?.refresh) {
      await cargarProgramas();
    }
  };

  const handleToggleActivo = async (programa: any) => {
    const nuevoEstado = !programa.activo;
    const accion = nuevoEstado ? "activar" : "desactivar";
    
    try {
      // Si está desactivando, verificar grupos activos
      if (!nuevoEstado) {
        const { data: gruposActivos, error: gruposError } = await supabaseBrowserClient
          .from("cursos")
          .select("id, nombre, estado")
          .eq("programa_id", programa.id)
          .eq("estado", "activo");

        if (gruposError) throw gruposError;

        if (gruposActivos && gruposActivos.length > 0) {
          modal.warning({
            title: "No se puede desactivar el programa",
            content: (
              <div>
                <p>Este programa tiene <strong>{gruposActivos.length} grupo(s) activo(s)</strong>:</p>
                <ul style={{ maxHeight: 200, overflow: 'auto', marginTop: 10 }}>
                  {gruposActivos.map((g: any) => (
                    <li key={g.id}>{g.nombre}</li>
                  ))}
                </ul>
                <p style={{ marginTop: 10 }}>
                  <strong>Proceso recomendado:</strong>
                </p>
                <ol style={{ marginTop: 5 }}>
                  <li>Finaliza los grupos activos cambiando su estado a Finalizado</li>
                  <li>Luego podrás desactivar el programa</li>
                </ol>
                <p style={{ marginTop: 10, color: '#666', fontSize: 12 }}>
                  💡 <em>Desactivar un programa lo oculta de la lista pero mantiene todo el historial.</em>
                </p>
              </div>
            ),
            okText: "Entendido",
          });
          return;
        }
      }

      // Confirmación antes de cambiar estado
      modal.confirm({
        title: nuevoEstado ? "Activar programa" : "Desactivar programa",
        content: nuevoEstado ? (
          <p>¿Deseas activar el programa <strong>{programa.nombre}</strong>?</p>
        ) : (
          <div>
            <p>¿Deseas desactivar el programa <strong>{programa.nombre}</strong>?</p>
            <p style={{ marginTop: 10 }}>Al desactivar:</p>
            <ul style={{ marginTop: 5 }}>
              <li>El programa desaparecerá de la lista principal</li>
              <li>No podrás crear nuevos grupos de este programa</li>
              <li>Los grupos existentes seguirán funcionando</li>
              <li>Todo el historial se mantiene intacto</li>
              <li>Podrás reactivarlo cuando quieras</li>
            </ul>
          </div>
        ),
        okText: nuevoEstado ? "Sí, activar" : "Sí, desactivar",
        okType: nuevoEstado ? "primary" : "default",
        cancelText: "Cancelar",
        onOk: async () => {
          const { error } = await supabaseBrowserClient
            .from("programas")
            .update({ activo: nuevoEstado })
            .eq("id", programa.id);
          
          if (error) throw error;
          message.success(`Programa ${nuevoEstado ? "activado" : "desactivado"} correctamente`);
          cargarProgramas();
        },
      });
    } catch (error: any) {
      message.error(`Error al ${accion}: ` + (error?.message || "Desconocido"));
      console.error(error);
    }
  };

  const handleDeletePrograma = async (programa: any) => {
    if (programa.activo) {
      message.warning("Solo se pueden eliminar programas inactivos.");
      return;
    }

    modal.confirm({
      title: "Eliminar programa permanentemente",
      content: (
        <div>
          <p>
            Esta acción eliminará el programa <strong>{programa.nombre}</strong> de forma permanente.
          </p>
          <p style={{ marginTop: 10, color: "#ff4d4f" }}>
            Esta acción no se puede deshacer.
          </p>
        </div>
      ),
      okText: "Sí, eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        const { data: grupos, error: gruposError } = await supabaseBrowserClient
          .from("cursos")
          .select("id")
          .eq("programa_id", programa.id)
          .limit(1);

        if (gruposError) throw gruposError;

        if (grupos && grupos.length > 0) {
          message.error("No se puede eliminar: este programa tiene grupos asociados.");
          return;
        }

        const { error } = await supabaseBrowserClient
          .from("programas")
          .delete()
          .eq("id", programa.id);

        if (error) throw error;
        message.success("Programa eliminado correctamente");
        await cargarProgramas();
      },
    });
  };

  // Función para calcular el precio total: (mensualidad * meses) + inscripción
  const calcularPrecioTotal = (programa: any): number => {
    const precio_mensualidad = Number(programa.precio_mensualidad || 0);
    const precio_inscripcion = Number(programa.precio_inscripcion || 0);
    
    // Extraer número de meses de la cadena "duracion" (ej: "4 meses" -> 4)
    const duracionStr = String(programa.duracion || "0 meses");
    const meses = parseInt(duracionStr.match(/\d+/)?.[0] || "0", 10);
    
    return (precio_mensualidad * meses) + precio_inscripcion;
  };

  // Función para calcular el valor por clase: (meses * mensualidad) / total_clases
  const calcularValorPorClase = (programa: any): number | null => {
    const mensualidad = Number(programa.precio_mensualidad || 0);
    const totalClases = Number(programa.total_clases || 0);
    
    // Extraer número de meses de la duración (ej: "5 meses" -> 5)
    const duracionStr = String(programa.duracion || "0 meses");
    const meses = parseInt(duracionStr.match(/\d+/)?.[0] || "0", 10);
    
    if (mensualidad > 0 && totalClases > 0 && meses > 0) {
      const totalAPagar = mensualidad * meses;
      return Math.round(totalAPagar / totalClases);
    }
    return null;
  };

  const calcularTotalHoras = (programa: any): number => {
    const horasPorClase = Number(programa.horas_por_clase || 0);
    const totalClases = Number(programa.total_clases || 0);
    return horasPorClase * totalClases;
  };

  const handleAction = (key: string, programa: any) => {
    if (key === "edit") {
      handleOpenModal(programa);
      return;
    }
    if (key === "toggle") {
      handleToggleActivo(programa);
      return;
    }
    if (key === "gestor") {
      setProgramaSeleccionado(programa);
      setGestorPensumVisible(true);
      return;
    }
    if (key === "delete") {
      handleDeletePrograma(programa);
      return;
    }
  };

  const getGradientColor = (nombre: string) => {
    const lower = nombre.toLowerCase();
    if (lower.includes("uña")) return "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)";
    if (lower.includes("maquill")) return "linear-gradient(135deg, #d946ef 0%, #e879f9 100%)";
    if (lower.includes("ceja") || lower.includes("micro")) return "linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)";
    if (lower.includes("pesta") || lower.includes("mirada")) return "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)";
    if (lower.includes("barber")) return "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)";
    return "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)";
  };

  const renderProgramaCard = (programa: any) => {
    const nombre = programa.nombre || "Programa";
    const icono = programa.emoji || (() => {
      const lower = nombre.toLowerCase();
      if (lower.includes("uña")) return "💅";
      if (lower.includes("maquill")) return "💄";
      if (lower.includes("ceja") || lower.includes("micro")) return "👁️";
      if (lower.includes("pesta") || lower.includes("mirada")) return "👀";
      if (lower.includes("barber")) return "✂️";
      return "📘";
    })();

    const totalHoras = calcularTotalHoras(programa);
    const valorTotal = calcularPrecioTotal(programa);
    const valorClase = calcularValorPorClase(programa);

    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={programa.id}>
        <Card
          hoverable
          style={{
            borderRadius: 16,
            overflow: "hidden",
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            transition: "all 0.3s ease",
            height: "100%",
          }}
          bodyStyle={{ padding: 0 }}
          className="programa-card"
        >
          {/* Header con gradiente */}
          <div
            style={{
              background: getGradientColor(nombre),
              padding: "24px 20px",
              position: "relative",
              minHeight: 120,
            }}
          >
            <div style={{ position: "absolute", top: 12, right: 12 }}>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "gestor",
                      label: "Gestionar Pensum",
                      icon: <BookOutlined />,
                      onClick: () => handleAction("gestor", programa),
                    },
                    {
                      key: "edit",
                      label: "Editar",
                      icon: <EditOutlined />,
                      onClick: () => handleAction("edit", programa),
                    },
                    {
                      type: "divider",
                    },
                    {
                      key: "toggle",
                      label: programa.activo ? "Desactivar" : "Activar",
                      danger: programa.activo,
                      onClick: () => handleAction("toggle", programa),
                    },
                    ...(!programa.activo
                      ? [
                          {
                            key: "delete",
                            label: "Eliminar",
                            icon: <DeleteOutlined />,
                            danger: true,
                            onClick: () => handleAction("delete", programa),
                          },
                        ]
                      : []),
                  ],
                }}
                trigger={["click"]}
              >
                <Button
                  type="text"
                  icon={<MoreOutlined />}
                  style={{ color: "white", background: "rgba(255,255,255,0.2)" }}
                  size="small"
                />
              </Dropdown>
            </div>

            <div style={{ fontSize: 48, marginBottom: 8 }}>{icono}</div>
            <Title level={isMobile ? 5 : 4} style={{ margin: 0, color: "white", fontWeight: 700 }}>
              {nombre}
            </Title>
            {!programa.activo && (
              <Tag color="red" style={{ marginTop: 8 }}>Inactivo</Tag>
            )}
          </div>

          {/* Body con información */}
          <div style={{ padding: "20px" }}>
            {programa.descripcion && (
              <Paragraph
                type="secondary"
                style={{
                  marginBottom: 16,
                  fontSize: 13,
                  lineHeight: 1.5,
                  minHeight: 40,
                }}
                ellipsis={{ rows: 2, tooltip: programa.descripcion }}
              >
                {programa.descripcion}
              </Paragraph>
            )}

            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {/* Duración y clases */}
              <Row gutter={8}>
                <Col span={12}>
                  <div style={{ textAlign: "center", padding: "8px", background: "#f0f5ff", borderRadius: 8 }}>
                    <ClockCircleOutlined style={{ color: "#1890ff", fontSize: 16 }} />
                    <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                      {programa.duracion || "N/A"}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>Duración</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: "center", padding: "8px", background: "#f6ffed", borderRadius: 8 }}>
                    <FireOutlined style={{ color: "#52c41a", fontSize: 16 }} />
                    <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                      {programa.total_clases || 0}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>Clases</Text>
                  </div>
                </Col>
              </Row>

              {/* Total horas y valor */}
              <Row gutter={8}>
                <Col span={12}>
                  <div style={{ textAlign: "center", padding: "8px", background: "#fff7e6", borderRadius: 8 }}>
                    <ThunderboltOutlined style={{ color: "#fa8c16", fontSize: 16 }} />
                    <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                      {totalHoras}h
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>Total horas</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: "center", padding: "8px", background: "#f0f5ff", borderRadius: 8 }}>
                    <TrophyOutlined style={{ color: "#722ed1", fontSize: 16 }} />
                    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                      {valorClase ? `$${valorClase.toLocaleString()}` : "N/A"}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>Por clase</Text>
                  </div>
                </Col>
              </Row>

              <Divider style={{ margin: "8px 0" }} />

              {/* Precio total destacado */}
              <div
                style={{
                  textAlign: "center",
                  padding: "12px",
                  background: "linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)",
                  borderRadius: 8,
                  border: "2px solid #91d5ff",
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>Inversión total</Text>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#0050b3", marginTop: 4 }}>
                  ${Number(valorTotal).toLocaleString()}
                </div>
              </div>

              {/* Botones de acción */}
              <Space style={{ width: "100%", marginTop: 8 }} size={8}>
                <Button
                  icon={<BookOutlined />}
                  onClick={() => handleAction("gestor", programa)}
                  block
                  type="primary"
                  ghost
                >
                  Pensum
                </Button>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => handleAction("edit", programa)}
                  block
                >
                  Editar
                </Button>
              </Space>
            </Space>
          </div>
        </Card>
      </Col>
    );
  };

  const columns = [
    {
      title: "Programa Académico",
      dataIndex: "nombre",
      key: "nombre",
      render: (text: string, record: any) => {
        const nombre = text || "Programa";
        const inicial = nombre.trim().charAt(0).toUpperCase() || "?";
        const customEmoji = (record?.emoji || "").trim();

        const icono = customEmoji || (() => {
          const lower = nombre.toLowerCase();
          if (lower.includes("uña")) return "💅"; // cursos de uñas
          if (lower.includes("maquill")) return "💄"; // maquillaje
          if (lower.includes("ceja") || lower.includes("micro") || lower.includes("cejas")) return "👁️"; // cejas/microblading
          if (lower.includes("pesta") || lower.includes("miradas perfectas") || lower.includes("mirada")) return "👀"; // pestañas / miradas perfectas
          return "📘"; // genérico
        })();

        return (
          <Tooltip title={nombre}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#fff7e6',
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid #ffd591',
                  fontSize: 18,
                }}
              >
                {icono}
              </div>
              <Tag color="blue" style={{ margin: 0 }}>{inicial}</Tag>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "Duración",
      dataIndex: "duracion",
      key: "duracion",
      width: 120,
    },
    {
      title: "N° Clases",
      dataIndex: "total_clases",
      key: "total_clases",
      width: 100,
      render: (clases: number) => clases || "-",
    },
    {
      title: "Total Horas",
      key: "total_horas",
      width: 110,
      render: (_: any, record: any) => {
        const totalHoras = calcularTotalHoras(record);
        return totalHoras > 0 ? <Text style={{ color: '#722ed1' }}>{totalHoras} hrs</Text> : "-";
      },
    },
    {
      title: "Valor/Clase",
      key: "valor_clase",
      width: 120,
      render: (_: any, record: any) => {
        const valorClase = calcularValorPorClase(record);
        return valorClase ? <Text style={{ color: '#1890ff' }}>$ {valorClase.toLocaleString()}</Text> : "-";
      },
    },
    {
      title: "Valor Total",
      key: "precio_total",
      width: 130,
      render: (_: any, record: any) => {
        const total = calcularPrecioTotal(record);
        return total ? <Text strong style={{ color: '#3f8600' }}>$ {Number(total).toLocaleString()}</Text> : "-";
      },
    },
    {
      title: "Inscripción",
      dataIndex: "precio_inscripcion",
      key: "precio_inscripcion",
      width: 120,
      render: (precio: number) => precio ? `$${Number(precio).toLocaleString()}` : "-",
    },
    {
      title: "Mensualidad",
      dataIndex: "precio_mensualidad",
      key: "precio_mensualidad",
      width: 120,
      render: (precio: number) => precio ? `$${Number(precio).toLocaleString()}` : "-",
    },
    {
      title: "Estado",
      dataIndex: "activo",
      key: "activo",
      width: 100,
      render: (activo: boolean) => (
        <Tag color={activo ? "green" : "red"}>
          {activo ? "Activo" : "Inactivo"}
        </Tag>
      ),
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 80,
      render: (_: any, record: any) => {
        const menuItems = [
          {
            key: "gestor",
            label: "Gestionar Pensum/Material",
            icon: <BookOutlined />,
            onClick: () => handleAction("gestor", record),
          },
          {
            key: "edit",
            label: "Editar",
            icon: <EditOutlined />,
            onClick: () => handleAction("edit", record),
          },
          {
            key: "toggle",
            label: record.activo ? "Desactivar" : "Activar",
            danger: record.activo,
            onClick: () => handleAction("toggle", record),
          },
          ...(!record.activo
            ? [
                {
                  key: "delete",
                  label: "Eliminar",
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => handleAction("delete", record),
                },
              ]
            : []),
        ];

        return (
          <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
            <Button icon={<MoreOutlined />} size="small" />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <App>
      <div style={{ padding: isMobile ? 12 : isTablet ? 16 : 24, background: "#f5f5f5", minHeight: "100vh" }}>
        {/* Header moderno */}
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 16,
            border: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={12}>
              <Space direction="vertical" size={4}>
                <Space align="center">
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                    }}
                  >
                    📚
                  </div>
                  <div>
                    <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Programas Académicos</Title>
                    {!isMobile && (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Gestiona tu catálogo de cursos y programas educativos
                      </Text>
                    )}
                  </div>
                </Space>
              </Space>
            </Col>
            <Col xs={24} md={12} style={{ textAlign: isMobile ? "left" : "right" }}>
              <Space wrap size={8}>
                {!isMobile && (
                  <Button.Group>
                    <Button
                      type={vistaCards ? "primary" : "default"}
                      icon={<AppstoreOutlined />}
                      onClick={() => setVistaCards(true)}
                    >
                      Cards
                    </Button>
                    <Button
                      type={!vistaCards ? "primary" : "default"}
                      icon={<UnorderedListOutlined />}
                      onClick={() => setVistaCards(false)}
                    >
                      Tabla
                    </Button>
                  </Button.Group>
                )}
                <Checkbox
                  checked={mostrarInactivos}
                  onChange={(e: CheckboxChangeEvent) => setMostrarInactivos(e.target.checked)}
                >
                  Inactivos
                  {programas.filter(p => !p.activo).length > 0 && (
                    <Badge
                      count={programas.filter(p => !p.activo).length}
                      style={{ marginLeft: 8, background: "#ff4d4f" }}
                    />
                  )}
                </Checkbox>
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenModal()}
                  style={{
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(24, 144, 255, 0.3)",
                  }}
                >
                  {isMobile ? "Nuevo" : "Nuevo Programa"}
                </Button>
              </Space>
            </Col>
          </Row>

          {/* Estadísticas rápidas */}
          {!isMobile && (
            <>
              <Divider style={{ margin: "16px 0" }} />
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="Programas Activos"
                    value={programas.filter(p => p.activo).length}
                    prefix={<FireOutlined style={{ color: "#52c41a" }} />}
                    valueStyle={{ color: "#52c41a", fontSize: 24 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Total Programas"
                    value={programas.length}
                    prefix={<BookOutlined style={{ color: "#1890ff" }} />}
                    valueStyle={{ fontSize: 24 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Horas Totales"
                    value={programas.reduce((acc, p) => acc + calcularTotalHoras(p), 0)}
                    suffix="h"
                    prefix={<ClockCircleOutlined style={{ color: "#fa8c16" }} />}
                    valueStyle={{ fontSize: 24 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Clases Totales"
                    value={programas.reduce((acc, p) => acc + (Number(p.total_clases) || 0), 0)}
                    prefix={<ThunderboltOutlined style={{ color: "#722ed1" }} />}
                    valueStyle={{ fontSize: 24 }}
                  />
                </Col>
              </Row>
            </>
          )}
        </Card>

      {/* Vista de cards moderna */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: "#999" }}>Cargando programas...</div>
        </div>
      ) : vistaCards ? (
        <Row gutter={[16, 16]}>
          {programas.map(programa => renderProgramaCard(programa))}
          {programas.length === 0 && (
            <Col span={24}>
              <Card style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📚</div>
                <Title level={4}>No hay programas registrados</Title>
                <Text type="secondary">Comienza creando tu primer programa académico</Text>
                <br />
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenModal()}
                  style={{ marginTop: 16 }}
                >
                  Crear Primer Programa
                </Button>
              </Card>
            </Col>
          )}
        </Row>
      ) : (
        <Card
          style={{
            borderRadius: 16,
            border: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <Table
            dataSource={programas}
            columns={isMobile ? columns.filter(col => 
              ['nombre', 'duracion', 'precio_total', 'activo', 'acciones'].includes(String(col.key))
            ) : columns}
            rowKey="id"
            loading={loading}
            scroll={isMobile ? { x: 800 } : undefined}
            pagination={{ 
              pageSize: 10,
              simple: isMobile,
              showSizeChanger: !isMobile 
            }}
            size={isMobile ? "small" : "middle"}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: 16, background: "#fafafa", borderRadius: 8 }}>
                <Text strong>Descripción:</Text>
                <p>{record.descripcion || "Sin descripción"}</p>
                {record.contenido && (
                  <>
                    <Text strong>Contenido:</Text>
                    <p style={{ whiteSpace: "pre-line" }}>{record.contenido}</p>
                  </>
                )}
                {record.requisitos && (
                  <>
                    <Text strong>Requisitos:</Text>
                    <p style={{ whiteSpace: "pre-line" }}>{record.requisitos}</p>
                  </>
                )}
                {record.certificacion && (
                  <>
                    <Text strong>Certificación:</Text>
                    <p>{record.certificacion}</p>
                  </>
                )}
              </div>
            ),
          }}
          />
        </Card>
      )}

      <Modal
        title={
          <Space>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              {editingPrograma ? "✏️" : "➕"}
            </div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {editingPrograma ? "Editar Programa" : "Nuevo Programa"}
            </span>
          </Space>
        }
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => handleCloseModal({ refresh: true })}
        width={isMobile ? "100%" : isTablet ? 600 : 750}
        style={isMobile ? { top: 0, paddingBottom: 0, maxHeight: "100vh" } : undefined}
        bodyStyle={isMobile ? { maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : { padding: 24 }}
        okText={editingPrograma ? "💾 Guardar Cambios" : "✨ Crear Programa"}
        cancelText="Cancelar"
        okButtonProps={{
          size: "large",
          style: {
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(24, 144, 255, 0.3)",
          }
        }}
        cancelButtonProps={{ size: "large" }}
      >
        <Form form={form} layout="vertical">
          {/* Sección: Información Básica */}
          <Card
            size="small"
            title={<Space><BookOutlined /> Información Básica</Space>}
            style={{ marginBottom: 16, background: "#fafafa" }}
          >
            <Form.Item
              name="nombre"
              label="Nombre del Programa"
              rules={[{ required: true, message: "Ingresa el nombre del programa" }]}
            >
              <Input 
                placeholder="Ej: Micropigmentación Profesional" 
                size="large"
                prefix="📚"
              />
            </Form.Item>

            <Form.Item
              name="emoji"
              label="Emoji representativo (opcional)"
              tooltip="Se mostrará en la lista de programas"
            >
              <Input placeholder="Ej: 💅" maxLength={4} size="large" />
            </Form.Item>

            <Form.Item
              name="descripcion"
              label="Descripción"
            >
              <TextArea rows={3} placeholder="Descripción breve del programa" />
            </Form.Item>
          </Card>

          {/* Sección: Duración y Clases */}
          <Card
            size="small"
            title={<Space><ClockCircleOutlined /> Duración y Clases</Space>}
            style={{ marginBottom: 16, background: "#fafafa" }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="duracion"
                  label="Duración"
                >
                  <Input placeholder="Ej: 3 meses" size="large" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="total_clases"
                  label="Total de Clases"
                  rules={[{ required: true, message: "Requerido" }]}
                >
                  <InputNumber 
                    style={{ width: "100%" }} 
                    min={1} 
                    placeholder="Ej: 24"
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="horas_por_clase"
              label="Horas por Clase/Sesión"
              rules={[{ required: true, message: "Ingresa las horas por clase" }]}
            >
              <InputNumber 
                style={{ width: "100%" }} 
                min={0.5} 
                step={0.5}
                placeholder="Ej: 2 o 2.5"
                size="large"
                prefix="⏱️"
              />
            </Form.Item>

            {/* Resumen calculado */}
            <div
              style={{
                padding: 16,
                background: "linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)",
                borderRadius: 8,
                border: "2px solid #91d5ff",
              }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "#666" }}>Total Horas</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#722ed1" }}>
                      {calcularTotalHoras(formValues || {})}h
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "#666" }}>Valor/Clase</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#1890ff" }}>
                      ${(calcularValorPorClase(formValues || {}) || 0).toLocaleString()}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </Card>

          {/* Sección: Precios */}
          <Card
            size="small"
            title={<Space><DollarOutlined /> Precios e Inversión</Space>}
            style={{ marginBottom: 16, background: "#fafafa" }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="precio_inscripcion"
                  label="Valor Inscripción"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    size="large"
                    min={0}
                    placeholder="0"
                    formatter={(value: any) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    parser={(value: any) => parseInt(value!.replace(/\$\s?|(,*)/g, "")) || 0}
                    onChange={() => form.validateFields()}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="precio_mensualidad"
                  label="Valor Mensualidad"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    size="large"
                    min={0}
                    placeholder="0"
                    formatter={(value: any) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    parser={(value: any) => parseInt(value!.replace(/\$\s?|(,*)/g, "")) || 0}
                    onChange={() => form.validateFields()}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Total destacado */}
            <div
              style={{
                padding: 20,
                background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                borderRadius: 12,
                textAlign: "center",
                color: "white",
              }}
            >
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>
                💎 Inversión Total del Programa
              </div>
              <div style={{ fontSize: 36, fontWeight: 700 }}>
                ${Number(calcularPrecioTotal(formValues || {})).toLocaleString()}
              </div>
            </div>
          </Card>

          {/* Sección: Información Adicional */}
          <Card
            size="small"
            title={<Space><FileTextOutlined /> Información Adicional</Space>}
            style={{ marginBottom: 0, background: "#fafafa" }}
          >
            <Form.Item
              name="contenido"
              label="Contenido del Programa"
            >
              <TextArea rows={4} placeholder="Describe los temas y módulos del programa" />
            </Form.Item>

            <Form.Item
              name="requisitos"
              label="Requisitos"
            >
              <TextArea rows={2} placeholder="Requisitos previos para inscribirse" />
            </Form.Item>

            <Form.Item
              name="certificacion"
              label="Certificación"
              style={{ marginBottom: 0 }}
            >
              <Input placeholder="Tipo de certificación que se otorga" size="large" />
            </Form.Item>
          </Card>
        </Form>
      </Modal>

      {/* GESTOR DE PENSUM Y MATERIAL */}
      {gestorPensumVisible && programaSeleccionado && (
        <GestorPensum
          programaId={programaSeleccionado.id}
          programaNombre={programaSeleccionado.nombre}
          onClose={() => {
            setGestorPensumVisible(false);
            setProgramaSeleccionado(null);
          }}
        />
      )}

      </div>
    </App>
  );
}
