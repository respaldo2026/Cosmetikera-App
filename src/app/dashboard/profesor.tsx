import React from "react";
import { Card, Statistic, Row, Col } from "antd";

export default function ProfesorDashboard() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Panel Docente</h2>
      <Row gutter={16}>
        <Col span={8}><Card><Statistic title="Clases Hoy" value={4} /></Card></Col>
        <Col span={8}><Card><Statistic title="Estudiantes Asistentes" value={32} /></Card></Col>
        <Col span={8}><Card><Statistic title="Pendientes por Calificar" value={7} /></Card></Col>
      </Row>
      {/* Agrega más widgets relevantes para el docente aquí */}
    </div>
  );
}
