"use client";

import React from "react";
import { Bar, Column, Line, Pie } from "@ant-design/plots";
import { Card, Col, Empty, Row, Space, Typography } from "antd";
import type { HistorialStatsReport } from "./stats";

const { Title, Text } = Typography;

type Props = {
  stats: HistorialStatsReport;
};

export default function HistorialCharts({ stats }: Props) {
  return (
    <Card style={{ marginTop: 16, borderRadius: 12 }} styles={{ body: { padding: "16px" } }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <Title level={5} style={{ marginBottom: 4 }}>Graficas estadisticas</Title>
          <Text type="secondary">
            Estas graficas se recalculan con los datos filtrados arriba para facilitar la lectura comercial del historial.
          </Text>
        </div>

        {stats.totalVentas === 0 ? (
          <Empty description="No hay ventas en el filtro actual para generar graficas" style={{ padding: 32 }} />
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card size="small" title="Productos mas vendidos" style={{ borderRadius: 10 }}>
                <Bar
                  data={stats.topProductos.slice(0, 8).map((item) => ({ label: item.label, value: item.count }))}
                  xField="value"
                  yField="label"
                  height={280}
                  color="#d81b87"
                  axis={{ x: { title: false }, y: { title: false } }}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Categorias mas vendidas" style={{ borderRadius: 10 }}>
                <Bar
                  data={stats.topCategorias.slice(0, 8).map((item) => ({ label: item.label, value: item.count }))}
                  xField="value"
                  yField="label"
                  height={280}
                  color="#722ed1"
                  axis={{ x: { title: false }, y: { title: false } }}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Cliente que mas compra" style={{ borderRadius: 10 }}>
                <Bar
                  data={stats.topClientes.slice(0, 8).map((item) => ({ label: item.label, value: item.value }))}
                  xField="value"
                  yField="label"
                  height={280}
                  color="#1677ff"
                  axis={{ x: { title: false }, y: { title: false } }}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Ventas por forma de pago" style={{ borderRadius: 10 }}>
                <Pie
                  data={stats.ventasPorFormaPago}
                  angleField="value"
                  colorField="label"
                  height={280}
                  label={{ text: "label", position: "outside" }}
                  legend={{ color: { position: "bottom" } }}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Ventas por dia de la semana" style={{ borderRadius: 10 }}>
                <Column
                  data={stats.ventasPorDiaSemana}
                  xField="label"
                  yField="value"
                  height={280}
                  color="#13c2c2"
                  axis={{ x: { labelAutoRotate: false }, y: { title: false } }}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Ventas por mes" style={{ borderRadius: 10 }}>
                <Line
                  data={stats.ventasPorMes}
                  xField="label"
                  yField="value"
                  height={280}
                  color="#fa8c16"
                  point={{ size: 4, shape: "circle" }}
                  axis={{ x: { labelAutoRotate: false }, y: { title: false } }}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Beneficio por categoria" style={{ borderRadius: 10 }}>
                <Column
                  data={stats.beneficioPorCategoria.slice(0, 8)}
                  xField="label"
                  yField="value"
                  height={280}
                  color="#52c41a"
                  axis={{ x: { labelAutoRotate: true }, y: { title: false } }}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Ventas por cliente" style={{ borderRadius: 10 }}>
                <Bar
                  data={stats.ventasPorCliente.slice(0, 8)}
                  xField="value"
                  yField="label"
                  height={280}
                  color="#eb2f96"
                  axis={{ x: { title: false }, y: { title: false } }}
                />
              </Card>
            </Col>
          </Row>
        )}
      </Space>
    </Card>
  );
}