import React from "react";
import { Card, Statistic, Row, Col, Space, Typography, Button } from "antd";
import { BarChartOutlined, TeamOutlined, AlertOutlined, CalendarOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function DirectorDashboard() {
  const [windowWidth, setWindowWidth] = React.useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  const metrics = [
    {
      key: "academico",
      title: "Progreso Académico",
      value: 85,
      suffix: "%",
      icon: <BarChartOutlined style={{ color: "#1677ff", fontSize: isMobile ? "20px" : "24px" }} />,
      color: "#1677ff"
    },
    {
      key: "egresos",
      title: "Egresos",
      value: 12000000,
      prefix: "$",
      icon: <TeamOutlined style={{ color: "#52c41a", fontSize: isMobile ? "20px" : "24px" }} />,
      color: "#52c41a"
    },
    {
      key: "alertas",
      title: "Alertas",
      value: 3,
      icon: <AlertOutlined style={{ color: "#fa541c", fontSize: isMobile ? "20px" : "24px" }} />,
      color: "#fa541c"
    },
    {
      key: "cursos",
      title: "Cursos Activos",
      value: 12,
      icon: <CalendarOutlined style={{ color: "#722ed1", fontSize: isMobile ? "20px" : "24px" }} />,
      color: "#722ed1"
    }
  ];

  return (
    <div style={{
      padding: isMobile ? "16px 12px" : "24px",
      backgroundColor: "#f5f5f5",
      minHeight: "100vh"
    }}>
      {/* Header */}
      <div style={{
        marginBottom: 24,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between",
        alignItems: isMobile ? "flex-start" : "center",
        gap: 12
      }}>
        <div>
          <Title level={isMobile ? 3 : 2} style={{ marginBottom: 4 }}>Panel del Director</Title>
          <Text type="secondary" style={{
            fontSize: isMobile ? "12px" : "14px"
          }}>Supervisa indicadores académicos y financieros de la academia</Text>
        </div>
        <Button type="primary" size={isMobile ? "small" : "middle"}>
          Generar Reporte
        </Button>
      </div>

      {/* Metric Cards */}
      <Row gutter={[isMobile ? 12 : 16, isMobile ? 12 : 16]} style={{ marginBottom: 24 }}>
        {metrics.map((metric) => (
          <Col key={metric.key} xs={12} sm={12} md={6} lg={6}>
            <Card style={{
              height: "100%",
              padding: isMobile ? "12px" : "16px",
              borderLeft: `4px solid ${metric.color}`
            }}>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Space size={8} align="center">
                  {metric.icon}
                  <Text type="secondary" style={{
                    fontSize: isMobile ? "11px" : "12px",
                    flex: 1
                  }}>
                    {metric.title}
                  </Text>
                </Space>
                <Statistic
                  value={metric.value}
                  prefix={metric.prefix}
                  suffix={metric.suffix}
                  valueStyle={{
                    color: metric.color,
                    fontSize: isMobile ? "18px" : "24px",
                    fontWeight: 700
                  }}
                />
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Content Grid */}
      <Row gutter={[isMobile ? 12 : 16, isMobile ? 12 : 16]}>
        <Col xs={24} md={12} lg={16}>
          <Card title={<span style={{ fontSize: isMobile ? "14px" : "16px" }}>Resumen Académico</span>} style={{
            marginBottom: isMobile ? "12px" : "0px"
          }}>
            <Space direction="vertical" style={{ width: "100%", gap: "12px" }}>
              <Row gutter={[isMobile ? 8 : 12, isMobile ? 8 : 12]}>
                <Col xs={24} sm={12}>
                  <Card variant="borderless" style={{ backgroundColor: "#f0f5ff", padding: "12px" }}>
                    <Text strong style={{ fontSize: isMobile ? "12px" : "14px" }}>Estudiantes Matriculados</Text>
                    <Statistic value={245} style={{ marginTop: "8px" }} valueStyle={{ fontSize: isMobile ? "20px" : "24px" }} />
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card variant="borderless" style={{ backgroundColor: "#f6ffed", padding: "12px" }}>
                    <Text strong style={{ fontSize: isMobile ? "12px" : "14px" }}>Tasa de Retención</Text>
                    <Statistic value={92} suffix="%" style={{ marginTop: "8px" }} valueStyle={{ fontSize: isMobile ? "20px" : "24px" }} />
                  </Card>
                </Col>
              </Row>
              <Row gutter={[isMobile ? 8 : 12, isMobile ? 8 : 12]}>
                <Col xs={24} sm={12}>
                  <Card variant="borderless" style={{ backgroundColor: "#fff7e6", padding: "12px" }}>
                    <Text strong style={{ fontSize: isMobile ? "12px" : "14px" }}>Cartera Vencida</Text>
                    <Statistic value={8500000} prefix="$" style={{ marginTop: "8px" }} valueStyle={{ fontSize: isMobile ? "16px" : "20px", color: "#fa541c" }} />
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card variant="borderless" style={{ backgroundColor: "#f5f5f5", padding: "12px" }}>
                    <Text strong style={{ fontSize: isMobile ? "12px" : "14px" }}>Ingresos Mensuales</Text>
                    <Statistic value={28500000} prefix="$" style={{ marginTop: "8px" }} valueStyle={{ fontSize: isMobile ? "16px" : "20px" }} />
                  </Card>
                </Col>
              </Row>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} lg={8}>
          <Card title={<span style={{ fontSize: isMobile ? "14px" : "16px" }}>Acciones Rápidas</span>}>
            <Space direction="vertical" style={{ width: "100%" }} size={isMobile ? 8 : 12}>
              <Button block type="primary" size={isMobile ? "small" : "middle"}>
                Ver Reportes Completos
              </Button>
              <Button block size={isMobile ? "small" : "middle"}>
                Gestionar Cursos
              </Button>
              <Button block size={isMobile ? "small" : "middle"}>
                Revisar Pagos
              </Button>
              <Button block size={isMobile ? "small" : "middle"}>
                Configuración
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
