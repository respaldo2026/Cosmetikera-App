"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Typography, Space, Input, Select, Tag, Spin,
  Row, Col, Statistic, Table, Empty, Grid, Button, DatePicker,
  Avatar, Tooltip, Divider,
} from "antd";
import {
  HistoryOutlined, SearchOutlined, ReloadOutlined, ShoppingCartOutlined,
  UserOutlined, CreditCardOutlined, DollarOutlined, FilterOutlined,
  EyeOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;
const { RangePicker } = DatePicker;

type Venta = {
  id: string;
  fecha: string;
  total: number;
  subtotal?: number;
  descuento?: number;
  metodo_pago?: string;
  cliente_id?: string;
  cliente?: { nombre_completo: string };
  items?: Array<{ nombre: string; cantidad: number; precio: number }>;
};

const METODO_TAG: Record<string, string> = {
  efectivo: "green", tarjeta: "blue", transferencia: "purple", mixto: "orange",
};

export default function HistorialPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState<string | null>(null);
  const [rango, setRango] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [detalle, setDetalle] = useState<Venta | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabaseBrowserClient
      .from("ventas")
      .select("*, cliente:perfiles(nombre_completo)")
      .order("fecha", { ascending: false })
      .limit(500);
    setVentas(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const ventasFiltradas = ventas.filter((v) => {
    const nombreCliente = (v.cliente as any)?.nombre_completo || "";
    const matchSearch = !search ||
      nombreCliente.toLowerCase().includes(search.toLowerCase()) ||
      v.id.toLowerCase().includes(search.toLowerCase());
    const matchMetodo = !filtroMetodo || v.metodo_pago === filtroMetodo;
    const matchRango = !rango ||
      (dayjs(v.fecha).isAfter(rango[0].startOf("day")) &&
        dayjs(v.fecha).isBefore(rango[1].endOf("day")));
    return matchSearch && matchMetodo && matchRango;
  });

  const totalVentasVal = ventasFiltradas.reduce((s, v) => s + Number(v.total || 0), 0);
  const ventasHoy = ventas.filter((v) => dayjs(v.fecha).isSame(dayjs(), "day")).length;
  const ingresoHoy = ventas
    .filter((v) => dayjs(v.fecha).isSame(dayjs(), "day"))
    .reduce((s, v) => s + Number(v.total || 0), 0);

  const columns = [
    {
      title: "Fecha",
      dataIndex: "fecha",
      key: "fecha",
      width: 140,
      render: (v: string) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{dayjs(v).format("DD/MM/YYYY")}</Text>
          <div><Text type="secondary" style={{ fontSize: 11 }}>{dayjs(v).format("HH:mm")}</Text></div>
        </div>
      ),
    },
    {
      title: "Cliente",
      key: "cliente",
      render: (_: any, rec: Venta) => {
        const nombre = (rec.cliente as any)?.nombre_completo;
        return nombre ? (
          <Space>
            <Avatar size="small" icon={<UserOutlined />} style={{ background: "#d81b87" }} />
            <Text>{nombre}</Text>
          </Space>
        ) : (
          <Text type="secondary">Venta sin cliente</Text>
        );
      },
    },
    {
      title: "Método",
      dataIndex: "metodo_pago",
      key: "metodo",
      width: 120,
      render: (v: string) => (
        <Tag color={METODO_TAG[v] || "default"} icon={<CreditCardOutlined />}>
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : "—"}
        </Tag>
      ),
    },
    {
      title: "Ítems",
      dataIndex: "items",
      key: "items",
      width: 80,
      render: (v: any[]) => <Tag>{(v || []).length}</Tag>,
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 120,
      render: (v: number) => (
        <Text strong style={{ color: "#d81b87", fontSize: 15 }}>
          ${Number(v).toLocaleString()}
        </Text>
      ),
    },
    {
      title: "",
      key: "acciones",
      width: 60,
      render: (_: any, rec: Venta) => (
        <Tooltip title="Ver detalle">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetalle(rec)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      {/* HEADER */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }} bodyStyle={{ padding: "12px 16px" }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Space>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "linear-gradient(135deg,#13c2c2,#096dd9)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <HistoryOutlined style={{ color: "#fff", fontSize: 22 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>Historial de ventas</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Registro completo de transacciones</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
          </Col>
        </Row>
      </Card>

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Ventas hoy" value={ventasHoy} prefix={<ShoppingCartOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Ingreso hoy"
              value={ingresoHoy}
              prefix="$"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Total filtrado" value={ventasFiltradas.length} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Suma filtrada"
              value={totalVentasVal}
              prefix="$"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: "#d81b87" }}
            />
          </Card>
        </Col>
      </Row>

      {/* FILTROS */}
      <Card style={{ marginBottom: 12, borderRadius: 10 }} bodyStyle={{ padding: "10px 14px" }}>
        <Row gutter={[12, 8]}>
          <Col xs={24} sm={8}>
            <Input
              placeholder="Buscar por cliente o ID..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Método de pago"
              allowClear
              style={{ width: "100%" }}
              value={filtroMetodo}
              onChange={setFiltroMetodo}
              options={[
                { value: "efectivo", label: "Efectivo" },
                { value: "tarjeta", label: "Tarjeta" },
                { value: "transferencia", label: "Transferencia" },
                { value: "mixto", label: "Mixto" },
              ]}
            />
          </Col>
          <Col xs={24} sm={10}>
            <RangePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              placeholder={["Desde", "Hasta"]}
              onChange={(dates) => setRango(dates as any)}
            />
          </Col>
        </Row>
      </Card>

      {/* TABLA */}
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
        ) : ventasFiltradas.length === 0 ? (
          <Empty description="Sin ventas en el período seleccionado" style={{ padding: 60 }} />
        ) : (
          <Table
            dataSource={ventasFiltradas}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 600 }}
          />
        )}
      </Card>

      {/* MODAL DETALLE */}
      {detalle && (
        <Card
          style={{
            position: "fixed", bottom: 20, right: 20, width: 340,
            borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            zIndex: 1000,
          }}
          title={
            <Space>
              <HistoryOutlined style={{ color: "#d81b87" }} />
              <span>Detalle de venta</span>
            </Space>
          }
          extra={<Button size="small" onClick={() => setDetalle(null)}>✕</Button>}
          bodyStyle={{ padding: 12 }}
        >
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary">Fecha: </Text>
            <Text strong>{dayjs(detalle.fecha).format("DD/MM/YYYY HH:mm")}</Text>
          </div>
          {(detalle.cliente as any)?.nombre_completo && (
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">Cliente: </Text>
              <Text strong>{(detalle.cliente as any).nombre_completo}</Text>
            </div>
          )}
          <Divider style={{ margin: "8px 0" }} />
          {(detalle.items || []).map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <Text style={{ fontSize: 12 }}>{item.nombre} × {item.cantidad}</Text>
              <Text style={{ fontSize: 12, color: "#d81b87" }}>${(item.precio * item.cantidad).toLocaleString()}</Text>
            </div>
          ))}
          <Divider style={{ margin: "8px 0" }} />
          {detalle.descuento ? (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text type="secondary">Descuento</Text>
              <Text style={{ color: "#52c41a" }}>-${Number(detalle.descuento).toLocaleString()}</Text>
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <Text strong style={{ fontSize: 14 }}>Total</Text>
            <Text strong style={{ fontSize: 16, color: "#d81b87" }}>${Number(detalle.total).toLocaleString()}</Text>
          </div>
          <Tag color={METODO_TAG[detalle.metodo_pago || ""] || "default"} style={{ marginTop: 8 }}>
            {detalle.metodo_pago || "—"}
          </Tag>
        </Card>
      )}
    </>
  );
}
