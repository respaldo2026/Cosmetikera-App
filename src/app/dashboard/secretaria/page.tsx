"use client";

import Link from "next/link";
import { Button, Card, Col, Row, Space, Typography } from "antd";
import {
  DollarCircleOutlined,
  TeamOutlined,
  InboxOutlined,
  NotificationOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

const accesos = [
  {
    title: "Clientes",
    description: "Consultar clientes frecuentes y su actividad de fidelización.",
    href: "/fidelizacion",
    icon: <TeamOutlined style={{ fontSize: 24, color: "#1677ff" }} />,
  },
  {
    title: "Caja",
    description: "Registrar ventas y revisar el flujo operativo del punto de venta.",
    href: "/caja",
    icon: <DollarCircleOutlined style={{ fontSize: 24, color: "#52c41a" }} />,
  },
  {
    title: "Compras",
    description: "Revisar reposición, proveedores y órdenes pendientes.",
    href: "/compras",
    icon: <InboxOutlined style={{ fontSize: 24, color: "#fa8c16" }} />,
  },
  {
    title: "Marketing",
    description: "Administrar campañas, mensajes y activaciones de clientes.",
    href: "/marketing-center",
    icon: <NotificationOutlined style={{ fontSize: 24, color: "#722ed1" }} />,
  },
];

export default function SecretariaDashboardPage() {
  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={8} style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          Panel de secretaria
        </Title>
        <Text type="secondary">
          Accesos rapidos para las tareas operativas mas frecuentes.
        </Text>
      </Space>

      <Row gutter={[16, 16]}>
        {accesos.map((acceso) => (
          <Col xs={24} sm={12} key={acceso.href}>
            <Card>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {acceso.icon}
                <Title level={5} style={{ margin: 0 }}>
                  {acceso.title}
                </Title>
                <Text type="secondary">{acceso.description}</Text>
                <Link href={acceso.href}>
                  <Button type="primary">Abrir modulo</Button>
                </Link>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
