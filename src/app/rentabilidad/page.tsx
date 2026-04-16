"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Row,
  Col,
  Statistic,
  Alert,
  Divider,
  Space,
  Typography,
  Grid,
  Button,
  Table,
  Modal,
  message,
  Tag,
  Tooltip,
  Popconfirm,
  Dropdown,
} from "antd";
import {
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  TeamOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
  EllipsisOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import type { DatosCurso, EscenarioRentabilidad, ResultadosRentabilidad } from "@utils/rentabilidad-calculator";
import {
  calcularRentabilidad,
  formatearMoneda,
  formatearPorcentaje,
  determinarNivelRentabilidad,
  obtenerColorRentabilidad,
  obtenerEtiquetaRentabilidad,
} from "@utils/rentabilidad-calculator";
import { supabaseBrowserClient } from "@utils/supabase/client";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const TABLE_NAME = "escenarios_rentabilidad";

type EscenarioDbRow = {
  id: string;
  nombre: string;
  datos: DatosCurso;
  resultados: ResultadosRentabilidad;
  created_at: string;
};

export default function RentabilidadPage() {
  const [form] = Form.useForm<DatosCurso>();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Estado de escenarios guardados
  const [escenarios, setEscenarios] = useState<EscenarioRentabilidad[]>([]);
  const [modalGuardarVisible, setModalGuardarVisible] = useState(false);
  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);
  const [escenarioSeleccionado, setEscenarioSeleccionado] = useState<EscenarioRentabilidad | null>(null);
  const [nombreEscenario, setNombreEscenario] = useState("");
  const [escenarioEditandoId, setEscenarioEditandoId] = useState<string | null>(null);
  const [loadingEscenarios, setLoadingEscenarios] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroRentabilidad, setFiltroRentabilidad] = useState<string | null>(null);

  const escenariosFiltrados = useMemo(() => {
    return escenarios.filter((escenario) => {
      const coincideNombre = escenario.nombre.toLowerCase().includes(busqueda.toLowerCase());
      const nivel = determinarNivelRentabilidad(
        escenario.resultados.margenGanancia,
        escenario.resultados.esRentable
      );
      const coincideRentabilidad = !filtroRentabilidad || nivel === filtroRentabilidad;
      return coincideNombre && coincideRentabilidad;
    });
  }, [escenarios, busqueda, filtroRentabilidad]);

  // Valores del formulario
  const [datos, setDatos] = useState<DatosCurso>({
    nombreCurso: "",
    duracionMeses: 3,
    totalClasesCurso: 12,
    horasPorClase: 2,
    pagoPorHoraProfesor: 25000,
    precioMensualEstudiante: 200000,
    costoMaterialesPorEstudiante: 30000,
    numeroEstudiantes: 10,
  });

  const cargarEscenarios = async () => {
    setLoadingEscenarios(true);
    const { data, error } = await supabaseBrowserClient
      .from(TABLE_NAME)
      .select("id, nombre, datos, resultados, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      message.error("No se pudieron cargar los escenarios");
      setLoadingEscenarios(false);
      return;
    }

    const escenariosMapeados: EscenarioRentabilidad[] = (data as EscenarioDbRow[] | null)?.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      fechaCreacion: row.created_at,
      datos: row.datos,
      resultados: row.resultados,
    })) || [];

    setEscenarios(escenariosMapeados);
    setLoadingEscenarios(false);
  };

  useEffect(() => {
    cargarEscenarios();
  }, []);

  // Calcular resultados en tiempo real
  const resultados = useMemo(() => {
    return calcularRentabilidad(datos);
  }, [datos]);

  // Nivel de rentabilidad actual
  const nivelRentabilidad = useMemo(() => {
    return determinarNivelRentabilidad(resultados.margenGanancia, resultados.esRentable);
  }, [resultados]);

  // Manejar cambios en el formulario
  const handleValuesChange = (_: any, allValues: DatosCurso) => {
    setDatos(allValues);
  };

  // Guardar escenario
  const guardarEscenario = async () => {
    if (!nombreEscenario.trim()) {
      message.error("Ingresa un nombre para el escenario");
      return;
    }

    const payload = {
      nombre: nombreEscenario.trim(),
      datos: { ...datos },
      resultados: { ...resultados },
      updated_at: new Date().toISOString(),
    };

    if (escenarioEditandoId) {
      const { error } = await supabaseBrowserClient
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", escenarioEditandoId);

      if (error) {
        message.error("No se pudo actualizar el escenario");
        return;
      }

      message.success(`Escenario "${nombreEscenario}" actualizado`);
    } else {
      const { error } = await supabaseBrowserClient
        .from(TABLE_NAME)
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        });

      if (error) {
        message.error("No se pudo guardar el escenario");
        return;
      }

      message.success(`Escenario "${nombreEscenario}" guardado exitosamente`);
    }

    setModalGuardarVisible(false);
    setNombreEscenario("");
    setEscenarioEditandoId(null);
    await cargarEscenarios();
  };

  // Eliminar escenario
  const eliminarEscenario = async (id: string) => {
    const { error } = await supabaseBrowserClient
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      message.error("No se pudo eliminar el escenario");
      return;
    }

    setEscenarios(escenarios.filter((e) => e.id !== id));
    message.success("Escenario eliminado");
  };

  const limpiarEscenarios = async () => {
    const { error } = await supabaseBrowserClient
      .from(TABLE_NAME)
      .delete()
      .neq("id", "");

    if (error) {
      message.error("No se pudieron eliminar los escenarios");
      return;
    }

    setEscenarios([]);
    message.success("Todos los escenarios eliminados");
  };

  // Cargar escenario en el formulario
  const cargarEscenario = (escenario: EscenarioRentabilidad) => {
    setDatos(escenario.datos);
    form.setFieldsValue(escenario.datos);
    message.success(`Escenario "${escenario.nombre}" cargado`);
  };

  // Ver detalle de escenario
  const verDetalle = (escenario: EscenarioRentabilidad) => {
    setEscenarioSeleccionado(escenario);
    setModalDetalleVisible(true);
  };

  const editarEscenario = (escenario: EscenarioRentabilidad) => {
    setEscenarioEditandoId(escenario.id);
    setNombreEscenario(escenario.nombre);
    setDatos(escenario.datos);
    form.setFieldsValue(escenario.datos);
    setModalGuardarVisible(true);
  };

  // Columnas de la tabla
  const columns: ColumnsType<EscenarioRentabilidad> = [
    {
      title: "Escenario",
      dataIndex: "nombre",
      key: "nombre",
      width: 200,
      ellipsis: true,
      render: (nombre: string, record: EscenarioRentabilidad) => {
        const nivel = determinarNivelRentabilidad(
          record.resultados.margenGanancia,
          record.resultados.esRentable
        );
        const color = obtenerColorRentabilidad(nivel);
        return (
          <Space direction="vertical" size={0}>
            <Text strong style={{ color }}>
              {nombre}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(record.fechaCreacion).format("DD/MM/YYYY HH:mm")}
            </Text>
          </Space>
        );
      },
    },
    {
      title: "Estudiantes",
      dataIndex: ["datos", "numeroEstudiantes"],
      key: "estudiantes",
      width: 100,
      align: "center",
      render: (num: number) => (
        <Tag icon={<TeamOutlined />} color="blue">
          {num}
        </Tag>
      ),
    },
    {
      title: "Ingreso Mensual",
      dataIndex: ["resultados", "ingresoMensualTotal"],
      key: "ingreso",
      width: 130,
      align: "right",
      render: (valor: number) => (
        <Text style={{ color: "#52c41a", fontWeight: 500 }}>
          {formatearMoneda(valor)}
        </Text>
      ),
    },
    {
      title: "Costo Mensual",
      dataIndex: ["resultados", "costoTotalMensual"],
      key: "costo",
      width: 130,
      align: "right",
      render: (valor: number) => (
        <Text style={{ color: "#ff4d4f" }}>{formatearMoneda(valor)}</Text>
      ),
    },
    {
      title: "Utilidad Mensual",
      dataIndex: ["resultados", "gananciaPerdidaMensual"],
      key: "utilidad",
      width: 150,
      align: "right",
      render: (valor: number, record: EscenarioRentabilidad) => {
        const nivel = determinarNivelRentabilidad(
          record.resultados.margenGanancia,
          record.resultados.esRentable
        );
        const color = obtenerColorRentabilidad(nivel);
        const icon = valor >= 0 ? <RiseOutlined /> : <FallOutlined />;

        return (
          <Space direction="vertical" size={0} style={{ width: "100%" }}>
            <Text strong style={{ color, fontSize: 14 }}>
              {icon} {formatearMoneda(Math.abs(valor))}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Margen: {formatearPorcentaje(record.resultados.margenGanancia)}
            </Text>
          </Space>
        );
      },
    },
    {
      title: "Indicador",
      key: "indicador",
      width: 140,
      align: "center",
      render: (_: any, record: EscenarioRentabilidad) => {
        const nivel = determinarNivelRentabilidad(
          record.resultados.margenGanancia,
          record.resultados.esRentable
        );
        const etiqueta = obtenerEtiquetaRentabilidad(nivel);
        const color = obtenerColorRentabilidad(nivel);

        let icon = null;
        if (nivel === "alta") icon = <ThunderboltOutlined />;
        else if (nivel === "media") icon = <CheckCircleOutlined />;
        else if (nivel === "baja") icon = <WarningOutlined />;
        else icon = <FallOutlined />;

        return (
          <Tag color={color} icon={icon} style={{ margin: 0 }}>
            {etiqueta}
          </Tag>
        );
      },
    },
    {
      title: "",
      key: "menu",
      width: 48,
      align: "center",
      fixed: isMobile ? undefined : "right",
      render: (_: any, record: EscenarioRentabilidad) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "ver",
                label: "Ver detalle",
                icon: <EyeOutlined />,
                onClick: () => verDetalle(record),
              },
              {
                key: "cargar",
                label: "Cargar en formulario",
                icon: <ReloadOutlined />,
                onClick: () => cargarEscenario(record),
              },
              {
                key: "editar",
                label: "Editar escenario",
                icon: <EditOutlined />,
                onClick: () => editarEscenario(record),
              },
              {
                type: "divider",
              },
              {
                key: "eliminar",
                label: (
                  <Popconfirm
                    title="¿Eliminar escenario?"
                    description={`Se eliminará "${record.nombre}"`}
                    onConfirm={() => eliminarEscenario(record.id)}
                    okText="Sí"
                    cancelText="No"
                  >
                    <span>Eliminar</span>
                  </Popconfirm>
                ),
                icon: <DeleteOutlined />,
                danger: true,
              },
            ],
          }}
        >
          <Tooltip title="Acciones">
            <Button type="text" size="small" icon={<EllipsisOutlined />} />
          </Tooltip>
        </Dropdown>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <Space direction="vertical" size={8} style={{ width: "100%", marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          💰 Análisis de Rentabilidad
        </Title>
        <Text type="secondary">
          Calcula la viabilidad financiera de tus cursos en tiempo real y guarda diferentes escenarios
        </Text>
      </Space>

      <Divider />

      <Row gutter={[24, 24]}>
        {/* Formulario de entrada */}
        <Col xs={24} lg={10}>
          <Card title="📋 Datos del Curso" bordered={false}>
            <Form
              form={form}
              layout="vertical"
              initialValues={datos}
              onValuesChange={handleValuesChange}
            >
              <Form.Item
                label="Nombre del curso"
                name="nombreCurso"
                rules={[{ required: true, message: "Ingresa el nombre del curso" }]}
              >
                <Input placeholder="Ej: Micropigmentación Básica" />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Duración (meses)"
                    name="duracionMeses"
                    rules={[{ required: true, message: "Requerido" }]}
                  >
                    <InputNumber
                      min={1}
                      max={24}
                      style={{ width: "100%" }}
                      placeholder="3"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Total clases del curso"
                    name="totalClasesCurso"
                    rules={[{ required: true, message: "Requerido" }]}
                  >
                    <InputNumber
                      min={1}
                      max={200}
                      style={{ width: "100%" }}
                      placeholder="12"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Horas por clase"
                    name="horasPorClase"
                    rules={[{ required: true, message: "Requerido" }]}
                  >
                    <InputNumber
                      min={0.5}
                      max={8}
                      step={0.5}
                      style={{ width: "100%" }}
                      placeholder="2"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Estudiantes"
                    name="numeroEstudiantes"
                    rules={[{ required: true, message: "Requerido" }]}
                  >
                    <InputNumber
                      min={1}
                      max={100}
                      style={{ width: "100%" }}
                      placeholder="10"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" plain>
                Costos e Ingresos
              </Divider>

              <Form.Item
                label="Pago por hora profesor(a)"
                name="pagoPorHoraProfesor"
                rules={[{ required: true, message: "Requerido" }]}
              >
                <InputNumber<number>
                  min={0}
                  style={{ width: "100%" }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, "")) || 0}
                  placeholder="25000"
                />
              </Form.Item>

              <Form.Item
                label="Precio mensual por estudiante"
                name="precioMensualEstudiante"
                rules={[{ required: true, message: "Requerido" }]}
              >
                <InputNumber<number>
                  min={0}
                  style={{ width: "100%" }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, "")) || 0}
                  placeholder="200000"
                />
              </Form.Item>

              <Form.Item
                label="Costo materiales por estudiante (mensual)"
                name="costoMaterialesPorEstudiante"
                rules={[{ required: true, message: "Requerido" }]}
              >
                <InputNumber<number>
                  min={0}
                  style={{ width: "100%" }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, "")) || 0}
                  placeholder="30000"
                />
              </Form.Item>

              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                block
                onClick={() => setModalGuardarVisible(true)}
                style={{ marginTop: 16 }}
              >
                Guardar Escenario
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Resultados */}
        <Col xs={24} lg={14}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {/* Alerta de rentabilidad con indicador visual */}
            {resultados.esRentable ? (
              <Alert
                message={obtenerEtiquetaRentabilidad(nivelRentabilidad)}
                description={`Este curso genera una ganancia mensual de ${formatearMoneda(
                  resultados.gananciaPerdidaMensual
                )} con un margen del ${formatearPorcentaje(resultados.margenGanancia)}`}
                type={nivelRentabilidad === "alta" ? "success" : "warning"}
                icon={
                  nivelRentabilidad === "alta" ? (
                    <ThunderboltOutlined />
                  ) : (
                    <CheckCircleOutlined />
                  )
                }
                showIcon
              />
            ) : (
              <Alert
                message={obtenerEtiquetaRentabilidad(nivelRentabilidad)}
                description={`Este curso genera una pérdida mensual de ${formatearMoneda(
                  Math.abs(resultados.gananciaPerdidaMensual)
                )}. Necesitas al menos ${resultados.puntoEquilibrio} estudiantes para cubrir costos.`}
                type="error"
                icon={<WarningOutlined />}
                showIcon
              />
            )}

            {/* Resumen financiero mensual */}
            <Card title="📊 Resumen Mensual" bordered={false}>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Statistic
                    title="Costo Profesor(a)"
                    value={resultados.costoMensualProfesor}
                    prefix="$"
                    formatter={(value) => formatearMoneda(Number(value)).replace("$", "")}
                    valueStyle={{ color: "#ff4d4f" }}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <Statistic
                    title="Costo Materiales"
                    value={resultados.costoTotalMensualMateriales}
                    prefix="$"
                    formatter={(value) => formatearMoneda(Number(value)).replace("$", "")}
                    valueStyle={{ color: "#ff4d4f" }}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <Statistic
                    title="Costo Total Mensual"
                    value={resultados.costoTotalMensual}
                    prefix="$"
                    formatter={(value) => formatearMoneda(Number(value)).replace("$", "")}
                    valueStyle={{ color: "#ff4d4f", fontWeight: "bold" }}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <Statistic
                    title="Ingreso Mensual"
                    value={resultados.ingresoMensualTotal}
                    prefix="$"
                    formatter={(value) => formatearMoneda(Number(value)).replace("$", "")}
                    valueStyle={{ color: "#52c41a", fontWeight: "bold" }}
                  />
                </Col>
              </Row>
            </Card>

            {/* Resultados clave */}
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card
                  bordered={false}
                  style={{
                    backgroundColor: resultados.esRentable ? "#f6ffed" : "#fff2e8",
                    borderLeft: `4px solid ${obtenerColorRentabilidad(nivelRentabilidad)}`,
                  }}
                >
                  <Statistic
                    title="Utilidad Mensual"
                    value={Math.abs(resultados.gananciaPerdidaMensual)}
                    prefix={resultados.esRentable ? <RiseOutlined /> : <FallOutlined />}
                    suffix="COP"
                    formatter={(value) =>
                      formatearMoneda(Number(value)).replace("$", "").replace("COP", "")
                    }
                    valueStyle={{
                      color: obtenerColorRentabilidad(nivelRentabilidad),
                      fontSize: isMobile ? 20 : 24,
                      fontWeight: "bold",
                    }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {resultados.esRentable ? "Ganancia" : "Pérdida"}
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card bordered={false} style={{ backgroundColor: "#e6f7ff" }}>
                  <Statistic
                    title="Punto de Equilibrio"
                    value={
                      resultados.puntoEquilibrio === Infinity
                        ? "N/A"
                        : resultados.puntoEquilibrio
                    }
                    prefix={<TeamOutlined />}
                    suffix={resultados.puntoEquilibrio === Infinity ? "" : "estudiantes"}
                    valueStyle={{
                      color: "#1890ff",
                      fontSize: isMobile ? 20 : 24,
                      fontWeight: "bold",
                    }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Estudiantes mínimos
                  </Text>
                </Card>
              </Col>
            </Row>

            {/* Proyección total */}
            <Card
              title={`💎 Proyección Total (${datos.duracionMeses} meses)`}
              bordered={false}
              style={{
                backgroundColor: resultados.esRentable ? "#f6ffed" : "#fff1f0",
                borderLeft: `4px solid ${obtenerColorRentabilidad(nivelRentabilidad)}`,
              }}
            >
              <Statistic
                value={Math.abs(resultados.gananciaTotalCurso)}
                prefix={<DollarOutlined />}
                suffix="COP"
                formatter={(value) =>
                  formatearMoneda(Number(value)).replace("$", "").replace("COP", "")
                }
                valueStyle={{
                  color: obtenerColorRentabilidad(nivelRentabilidad),
                  fontSize: isMobile ? 24 : 32,
                  fontWeight: "bold",
                }}
              />
              <Text style={{ fontSize: 14, marginTop: 8, display: "block" }}>
                {resultados.esRentable
                  ? `🎉 Ganancia total estimada al finalizar el curso`
                  : `⚠️ Pérdida total estimada al finalizar el curso`}
              </Text>
            </Card>
          </Space>
        </Col>
      </Row>

      {/* Sección de escenarios guardados */}
      <Divider orientation="left">
        <Space>
          <TrophyOutlined />
          Escenarios Guardados
        </Space>
      </Divider>

      <Card
        title={`📂 Historial de Escenarios (${escenarios.length})`}
        bordered={false}
        extra={
          <Space size="small">
            <Input
              placeholder="Buscar..."
              prefix={<SearchOutlined />}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: isMobile ? 130 : 180 }}
            />
            <Dropdown
              menu={{
                items: [
                  {
                    key: "todos",
                    label: "Todos",
                    onClick: () => setFiltroRentabilidad(null),
                  },
                  {
                    key: "alta",
                    label: "Alta",
                    onClick: () => setFiltroRentabilidad("alta"),
                  },
                  {
                    key: "media",
                    label: "Media",
                    onClick: () => setFiltroRentabilidad("media"),
                  },
                  {
                    key: "baja",
                    label: "Baja",
                    onClick: () => setFiltroRentabilidad("baja"),
                  },
                  {
                    key: "perdida",
                    label: "Pérdida",
                    onClick: () => setFiltroRentabilidad("perdida"),
                  },
                ],
              }}
            >
              <Button
                size="small"
                icon={<FilterOutlined />}
                type={filtroRentabilidad ? "primary" : "default"}
              >
                {filtroRentabilidad ? "Filtrado" : "Filtro"}
              </Button>
            </Dropdown>
            {escenarios.length > 0 && (
              <Popconfirm
                title="¿Eliminar todos?"
                onConfirm={limpiarEscenarios}
                okText="Sí"
                cancelText="No"
              >
                <Button danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        }
      >
        {escenarios.length === 0 ? (
          <Alert
            message="No hay escenarios guardados"
            description="Realiza una simulación y haz clic en 'Guardar Escenario' para registrarla"
            type="info"
            showIcon
          />
        ) : isMobile ? (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {escenariosFiltrados.map((escenario) => {
              const nivel = determinarNivelRentabilidad(
                escenario.resultados.margenGanancia,
                escenario.resultados.esRentable
              );
              const color = obtenerColorRentabilidad(nivel);
              return (
                <Card
                  key={escenario.id}
                  size="small"
                  style={{ borderLeft: `4px solid ${color}`, cursor: "pointer" }}
                  onClick={() => verDetalle(escenario)}
                  extra={
                    <Dropdown
                      trigger={["click"]}
                      menu={{
                        items: [
                          {
                            key: "cargar",
                            label: "Cargar",
                            icon: <ReloadOutlined />,
                            onClick: () => cargarEscenario(escenario),
                          },
                          {
                            key: "editar",
                            label: "Editar",
                            icon: <EditOutlined />,
                            onClick: () => editarEscenario(escenario),
                          },
                          { type: "divider" },
                          {
                            key: "eliminar",
                            label: (
                              <Popconfirm
                                title="¿Eliminar?"
                                onConfirm={() => eliminarEscenario(escenario.id)}
                                okText="Sí"
                                cancelText="No"
                              >
                                <span>Eliminar</span>
                              </Popconfirm>
                            ),
                            icon: <DeleteOutlined />,
                            danger: true,
                          },
                        ],
                      }}
                    >
                      <Button type="text" size="small" icon={<EllipsisOutlined />} />
                    </Dropdown>
                  }
                >
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Text strong style={{ color, fontSize: 14 }}>
                      {escenario.nombre}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(escenario.fechaCreacion).format("DD/MM/YYYY HH:mm")}
                    </Text>
                    <Row gutter={[8, 8]}>
                      <Col span={12}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Est: {escenario.datos.numeroEstudiantes}
                        </Text>
                      </Col>
                      <Col span={12} style={{ textAlign: "right" }}>
                        <Text strong style={{ color, fontSize: 12 }}>
                          {formatearMoneda(escenario.resultados.gananciaPerdidaMensual)}
                        </Text>
                      </Col>
                    </Row>
                  </Space>
                </Card>
              );
            })}
            {escenariosFiltrados.length === 0 && (
              <Alert
                message="Sin resultados"
                description="No hay escenarios que coincidan con tu búsqueda"
                type="warning"
                showIcon
              />
            )}
          </Space>
        ) : (
          <Table
            columns={columns}
            dataSource={escenariosFiltrados}
            rowKey="id"
            loading={loadingEscenarios}
            pagination={{
              pageSize: 10,
              showTotal: (total) => `${total} de ${escenarios.length} escenarios`,
            }}
            scroll={{ x: 900 }}
            size="middle"
          />
        )}
      </Card>

      {/* Modal para guardar escenario */}
      <Modal
        title={escenarioEditandoId ? "✏️ Editar Escenario" : "💾 Guardar Escenario"}
        open={modalGuardarVisible}
        onOk={guardarEscenario}
        onCancel={() => {
          setModalGuardarVisible(false);
          setNombreEscenario("");
          setEscenarioEditandoId(null);
        }}
        okText={escenarioEditandoId ? "Actualizar" : "Guardar"}
        cancelText="Cancelar"
        width={isMobile ? "100%" : 520}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Text>Asigna un nombre identificable a este escenario:</Text>
          <Input
            placeholder="Ej: Curso básico - 15 estudiantes"
            value={nombreEscenario}
            onChange={(e) => setNombreEscenario(e.target.value)}
            onPressEnter={() => void guardarEscenario()}
            maxLength={100}
            showCount
          />
          <Alert
            message="Vista previa"
            description={
              <Space direction="vertical" size="small" style={{ width: "100%" }}>
                <Text>
                  <strong>Curso:</strong> {datos.nombreCurso || "Sin nombre"}
                </Text>
                <Text>
                  <strong>Estudiantes:</strong> {datos.numeroEstudiantes}
                </Text>
                <Text>
                  <strong>Utilidad mensual:</strong>{" "}
                  <span
                    style={{
                      color: obtenerColorRentabilidad(nivelRentabilidad),
                      fontWeight: "bold",
                    }}
                  >
                    {formatearMoneda(resultados.gananciaPerdidaMensual)}
                  </span>
                </Text>
              </Space>
            }
            type="info"
            showIcon
          />
        </Space>
      </Modal>

      {/* Modal de detalle de escenario */}
      <Modal
        title={`📊 Detalle: ${escenarioSeleccionado?.nombre}`}
        open={modalDetalleVisible}
        onCancel={() => {
          setModalDetalleVisible(false);
          setEscenarioSeleccionado(null);
        }}
        footer={[
          <Button
            key="cargar"
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => {
              if (escenarioSeleccionado) {
                cargarEscenario(escenarioSeleccionado);
                setModalDetalleVisible(false);
              }
            }}
          >
            Cargar en formulario
          </Button>,
          <Button
            key="cerrar"
            onClick={() => {
              setModalDetalleVisible(false);
              setEscenarioSeleccionado(null);
            }}
          >
            Cerrar
          </Button>,
        ]}
        width={isMobile ? "100%" : 700}
      >
        {escenarioSeleccionado && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {/* Indicador de rentabilidad */}
            <Alert
              message={obtenerEtiquetaRentabilidad(
                determinarNivelRentabilidad(
                  escenarioSeleccionado.resultados.margenGanancia,
                  escenarioSeleccionado.resultados.esRentable
                )
              )}
              description={`Margen de ganancia: ${formatearPorcentaje(
                escenarioSeleccionado.resultados.margenGanancia
              )}`}
              type={
                escenarioSeleccionado.resultados.esRentable
                  ? "success"
                  : "error"
              }
              showIcon
            />

            {/* Datos del curso */}
            <Card title="📝 Datos del Curso" size="small">
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Text type="secondary">Nombre:</Text>
                  <br />
                  <Text strong>{escenarioSeleccionado.datos.nombreCurso}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Duración:</Text>
                  <br />
                  <Text strong>{escenarioSeleccionado.datos.duracionMeses} meses</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Clases totales:</Text>
                  <br />
                  <Text strong>{escenarioSeleccionado.datos.totalClasesCurso}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Horas por clase:</Text>
                  <br />
                  <Text strong>{escenarioSeleccionado.datos.horasPorClase} h</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Estudiantes:</Text>
                  <br />
                  <Text strong>{escenarioSeleccionado.datos.numeroEstudiantes}</Text>
                </Col>
              </Row>
            </Card>

            {/* Resultados financieros */}
            <Card title="💰 Resultados Financieros" size="small">
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Ingreso Mensual"
                    value={escenarioSeleccionado.resultados.ingresoMensualTotal}
                    prefix="$"
                    formatter={(value) =>
                      formatearMoneda(Number(value)).replace("$", "")
                    }
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Costo Mensual"
                    value={escenarioSeleccionado.resultados.costoTotalMensual}
                    prefix="$"
                    formatter={(value) =>
                      formatearMoneda(Number(value)).replace("$", "")
                    }
                    valueStyle={{ color: "#ff4d4f" }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Utilidad Mensual"
                    value={Math.abs(
                      escenarioSeleccionado.resultados.gananciaPerdidaMensual
                    )}
                    prefix={
                      escenarioSeleccionado.resultados.esRentable ? (
                        <RiseOutlined />
                      ) : (
                        <FallOutlined />
                      )
                    }
                    suffix="COP"
                    formatter={(value) =>
                      formatearMoneda(Number(value)).replace("$", "").replace("COP", "")
                    }
                    valueStyle={{
                      color: obtenerColorRentabilidad(
                        determinarNivelRentabilidad(
                          escenarioSeleccionado.resultados.margenGanancia,
                          escenarioSeleccionado.resultados.esRentable
                        )
                      ),
                      fontWeight: "bold",
                    }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Punto de Equilibrio"
                    value={
                      escenarioSeleccionado.resultados.puntoEquilibrio === Infinity
                        ? "N/A"
                        : escenarioSeleccionado.resultados.puntoEquilibrio
                    }
                    suffix={
                      escenarioSeleccionado.resultados.puntoEquilibrio === Infinity
                        ? ""
                        : "estudiantes"
                    }
                    valueStyle={{ color: "#1890ff" }}
                  />
                </Col>
              </Row>
            </Card>

            {/* Proyección total */}
            <Card
              title={`💎 Proyección Total (${escenarioSeleccionado.datos.duracionMeses} meses)`}
              size="small"
              style={{
                backgroundColor: escenarioSeleccionado.resultados.esRentable
                  ? "#f6ffed"
                  : "#fff1f0",
              }}
            >
              <Statistic
                value={Math.abs(escenarioSeleccionado.resultados.gananciaTotalCurso)}
                prefix={<DollarOutlined />}
                suffix="COP"
                formatter={(value) =>
                  formatearMoneda(Number(value)).replace("$", "").replace("COP", "")
                }
                valueStyle={{
                  color: obtenerColorRentabilidad(
                    determinarNivelRentabilidad(
                      escenarioSeleccionado.resultados.margenGanancia,
                      escenarioSeleccionado.resultados.esRentable
                    )
                  ),
                  fontSize: 28,
                  fontWeight: "bold",
                }}
              />
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  );
}
