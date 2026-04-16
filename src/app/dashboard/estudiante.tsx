import React from "react";
import { Card, Statistic, Row, Col } from "antd";

export default function EstudianteDashboard() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Mi Portal Estudiantil</h2>
      <Row gutter={16}>
        <Col span={8}><Card><Statistic title="Progreso" value={72} suffix="%" /></Card></Col>
        <Col span={8}><Card><Statistic title="Pagos Pendientes" value={2} /></Card></Col>
        <Col span={8}><Card><Statistic title="Tareas Entregadas" value={14} /></Card></Col>
      </Row>
      {/* Agrega más widgets relevantes para el estudiante aquí */}
    </div>
  );
}
