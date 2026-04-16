"use client";

import React, { useState, useMemo } from "react";
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
} from "antd";
import {
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  TeamOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import type { DatosCurso } from "@utils/rentabilidad-calculator";
import {
  calcularRentabilidad,
  formatearMoneda,
  formatearPorcentaje,
} from "@utils/rentabilidad-calculator";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function RentabilidadPage() {
  const [form] = Form.useForm<DatosCurso>();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

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

  // Calcular resultados en tiempo real
  const resultados = useMemo(() => {
    return calcularRentabilidad(datos);
  }, [datos]);

  // Manejar cambios en el formulario
  const handleValuesChange = (_: any, allValues: DatosCurso) => {
    setDatos(allValues);
  };

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <Title level={2}>💰 Análisis de Rentabilidad</Title>
      <Text type="secondary">
        Calcula la viabilidad financiera de tus cursos en tiempo real
      </Text>

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
            </Form>
          </Card>
        </Col>

        {/* Resultados */}
        <Col xs={24} lg={14}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {/* Alerta de rentabilidad */}
            {resultados.esRentable ? (
              <Alert
                message="✅ Curso Rentable"
                description={`Este curso genera una ganancia mensual de ${formatearMoneda(
                  resultados.gananciaPerdidaMensual
                )} con un margen del ${formatearPorcentaje(resultados.margenGanancia)}`}
                type="success"
                icon={<CheckCircleOutlined />}
                showIcon
              />
            ) : (
              <Alert
                message="⚠️ Curso No Rentable"
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
                <Card bordered={false} style={{ backgroundColor: resultados.esRentable ? "#f6ffed" : "#fff2e8" }}>
                  <Statistic
                    title="Utilidad Mensual"
                    value={Math.abs(resultados.gananciaPerdidaMensual)}
                    prefix={resultados.esRentable ? <RiseOutlined /> : <FallOutlined />}
                    suffix="COP"
                    formatter={(value) => formatearMoneda(Number(value)).replace("$", "").replace("COP", "")}
                    valueStyle={{
                      color: resultados.esRentable ? "#3f8600" : "#cf1322",
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
                    value={resultados.puntoEquilibrio === Infinity ? "N/A" : resultados.puntoEquilibrio}
                    prefix={<TeamOutlined />}
                    suffix={resultados.puntoEquilibrio === Infinity ? "" : "estudiantes"}
                    valueStyle={{ color: "#1890ff", fontSize: isMobile ? 20 : 24, fontWeight: "bold" }}
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
              style={{ backgroundColor: resultados.esRentable ? "#f6ffed" : "#fff1f0" }}
            >
              <Statistic
                value={Math.abs(resultados.gananciaTotalCurso)}
                prefix={<DollarOutlined />}
                suffix="COP"
                formatter={(value) => formatearMoneda(Number(value)).replace("$", "").replace("COP", "")}
                valueStyle={{
                  color: resultados.esRentable ? "#3f8600" : "#cf1322",
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
    </div>
  );
}
