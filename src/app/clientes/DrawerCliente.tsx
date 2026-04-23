"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  GiftOutlined,
  HistoryOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  SaveOutlined,
  ShoppingOutlined,
  StarOutlined,
  TrophyOutlined,
  UserOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";

const { Text } = Typography;

type Cliente = {
  id: string;
  nombre_completo: string;
  telefono?: string;
  telefono_2?: string;
  email?: string;
  cedula?: string;
  puntos_fidelidad?: number;
  nivel_fidelidad?: string;
  fecha_nacimiento?: string;
  total_compras?: number;
  activo?: boolean;
  created_at?: string;
};

type Venta = {
  id: string;
  created_at: string;
  total: number;
  metodo_pago?: string;
  items?: VentaItem[];
};

type VentaItem = {
  articulo_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

type ProductoResumen = {
  articulo_id: string;
  nombre: string;
  total_cantidad: number;
  total_gastado: number;
  veces_comprado: number;
};

const NIVEL_ICONS: Record<string, string> = {
  bronce: "🥉", plata: "🥈", oro: "🥇", diamante: "💎",
};

const NIVELES = [
  { key: "bronce", label: "Bronce", min: 0, color: "#cd7f32" },
  { key: "plata", label: "Plata", min: 1000, color: "#8c8c8c" },
  { key: "oro", label: "Oro", min: 5000, color: "#faad14" },
  { key: "diamante", label: "Diamante", min: 15000, color: "#13c2c2" },
];

function getNivel(puntos: number) {
  return [...NIVELES].reverse().find((n) => puntos >= n.min) ?? NIVELES[0]!;
}

function getProgreso(puntos: number) {
  const idx = NIVELES.findIndex((n) => n.key === getNivel(puntos).key);
  if (idx >= NIVELES.length - 1) return null;
  const actual = NIVELES[idx]!;
  const sig = NIVELES[idx + 1]!;
  const pct = Math.min(100, Math.round(((puntos - actual.min) / (sig.min - actual.min)) * 100));
  return { siguiente: sig, pct, faltantes: sig.min - puntos };
}

export default function DrawerCliente({
  cliente,
  onClose,
  onGuardado,
}: {
  cliente: Cliente | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { message } = App.useApp();
  const [tab, setTab] = useState("datos");
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [puntosAgregar, setPuntosAgregar] = useState(0);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!cliente) return;
    setTab("datos");
    setPuntosAgregar(0);
    form.setFieldsValue({
      nombre_completo: cliente.nombre_completo,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      telefono_2: cliente.telefono_2,
      email: cliente.email,
      fecha_nacimiento: cliente.fecha_nacimiento ? dayjs(cliente.fecha_nacimiento) : null,
      activo: cliente.activo ?? true,
    });
  }, [cliente, form]);

  const cargarVentas = useCallback(async () => {
    if (!cliente) return;
    setLoadingVentas(true);
    const { data } = await supabaseBrowserClient
      .from("ventas")
      .select("id,created_at,total,metodo_pago,items")
      .eq("cliente_id", cliente.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setVentas(data || []);
    setLoadingVentas(false);
  }, [cliente]);

  useEffect(() => {
    if (tab === "historial" || tab === "productos") cargarVentas();
  }, [tab, cargarVentas]);

  const guardarDatos = async () => {
    if (!cliente) return;
    try {
      const values = await form.validateFields();
      setGuardando(true);
      const res = await fetch(`/api/perfiles?id=${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_completo: values.nombre_completo,
          cedula: values.cedula || null,
          telefono: values.telefono || null,
          telefono_2: values.telefono_2 || null,
          email: values.email || null,
          fecha_nacimiento: values.fecha_nacimiento
            ? dayjs(values.fecha_nacimiento).format("YYYY-MM-DD") : null,
          activo: values.activo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      message.success("Datos actualizados");
      onGuardado();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const aplicarPuntos = async () => {
    if (!cliente || puntosAgregar === 0) return;
    setGuardando(true);
    try {
      const nuevos = Math.max(0, (cliente.puntos_fidelidad || 0) + puntosAgregar);
      const res = await fetch(`/api/perfiles?id=${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puntos_fidelidad: nuevos, nivel_fidelidad: getNivel(nuevos).key }),
      });
      if (!res.ok) throw new Error("Error");
      message.success(`${puntosAgregar > 0 ? "+" : ""}${puntosAgregar} puntos aplicados`);
      setPuntosAgregar(0);
      onGuardado();
    } catch {
      message.error("Error al aplicar puntos");
    } finally {
      setGuardando(false);
    }
  };

  const puntos = cliente?.puntos_fidelidad || 0;
  const nivel = getNivel(puntos);
  const prog = getProgreso(puntos);

  const productosMap: Record<string, ProductoResumen> = {};
  ventas.forEach((v) => {
    (v.items || []).forEach((item) => {
      if (!productosMap[item.articulo_id]) {
        productosMap[item.articulo_id] = { articulo_id: item.articulo_id, nombre: item.nombre, total_cantidad: 0, total_gastado: 0, veces_comprado: 0 };
      }
      productosMap[item.articulo_id]!.total_cantidad += item.cantidad;
      productosMap[item.articulo_id]!.total_gastado += item.subtotal;
      productosMap[item.articulo_id]!.veces_comprado += 1;
    });
  });
  const productos = Object.values(productosMap).sort((a, b) => b.total_cantidad - a.total_cantidad);
  const totalGastado = ventas.reduce((s, v) => s + (v.total || 0), 0);

  const colsVentas: ColumnsType<Venta> = [
    { title: "Fecha", dataIndex: "created_at", render: (d: string) => dayjs(d).format("DD/MM/YYYY HH:mm"), width: 140 },
    { title: "Total", dataIndex: "total", render: (t: number) => <Text strong>${t?.toLocaleString()}</Text>, width: 110 },
    { title: "Método", dataIndex: "metodo_pago", render: (m?: string) => m ? <Tag>{m}</Tag> : <Text type="secondary">—</Text>, width: 110 },
    {
      title: "Productos", dataIndex: "items",
      render: (items?: VentaItem[]) => items?.length
        ? items.map((i) => <div key={i.articulo_id} style={{ fontSize: 12 }}>{i.cantidad}x {i.nombre}</div>)
        : <Text type="secondary">—</Text>,
    },
  ];

  const colsProductos: ColumnsType<ProductoResumen> = [
    { title: "#", key: "r", width: 40, render: (_: unknown, __: ProductoResumen, i: number) => <Text>{i + 1}</Text> },
    { title: "Producto", dataIndex: "nombre", render: (n: string) => <Text strong>{n}</Text> },
    { title: "Uds.", dataIndex: "total_cantidad", width: 70, render: (q: number) => <Tag>{q}</Tag> },
    { title: "Gastado", dataIndex: "total_gastado", width: 110, render: (t: number) => <Text>${t?.toLocaleString()}</Text> },
  ];

  if (!cliente) return null;

  return (
    <Drawer
      open={!!cliente}
      onClose={onClose}
      width={620}
      styles={{ body: { padding: 0 } }}
      title={
        <Space>
          <Avatar size={36} style={{ background: nivel.color }}>{cliente.nombre_completo[0]?.toUpperCase()}</Avatar>
          <div>
            <Text strong style={{ fontSize: 15 }}>{cliente.nombre_completo}</Text>
            <div>
              <Tag style={{ background: nivel.color, color: "#fff", border: "none", fontSize: 11 }}>{NIVEL_ICONS[nivel.key]} {nivel.label}</Tag>
              {cliente.cedula && <Text type="secondary" style={{ fontSize: 11 }}>CC: {cliente.cedula}</Text>}
            </div>
          </div>
        </Space>
      }
      extra={
        (cliente.telefono || cliente.telefono_2) && (
          <Button
            icon={<WhatsAppOutlined />}
            style={{ color: "#25D366", borderColor: "#25D366" }}
            onClick={() => window.open(`https://wa.me/57${(cliente.telefono || cliente.telefono_2 || "").replace(/\D/g, "")}`, "_blank")}
          >
            WhatsApp
          </Button>
        )
      }
    >
      <Tabs
        activeKey={tab}
        onChange={setTab}
        tabBarStyle={{ padding: "0 20px", marginBottom: 0 }}
        items={[
          {
            key: "datos",
            label: <Space size={4}><UserOutlined />Datos</Space>,
            children: (
              <div style={{ padding: "16px 20px" }}>
                <Form form={form} layout="vertical">
                  <Row gutter={12}>
                    <Col span={24}>
                      <Form.Item name="nombre_completo" label="Nombre completo" rules={[{ required: true }]}>
                        <Input prefix={<UserOutlined />} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="cedula" label="Cédula">
                        <Input prefix={<IdcardOutlined />} placeholder="Número de documento" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="telefono" label="Teléfono principal" rules={[{ pattern: /^\d{7,15}$/, message: "Solo dígitos, entre 7 y 15 caracteres" }]}>
                        <Input prefix={<PhoneOutlined />} placeholder="3001234567" maxLength={15} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="telefono_2"
                        label="Teléfono alterno"
                        extra="Sirve como acceso de respaldo al Club si el cliente cambia o pierde su número principal."
                        rules={[{ pattern: /^\d{7,15}$/, message: "Solo dígitos, entre 7 y 15 caracteres" }]}
                      >
                        <Input prefix={<PhoneOutlined />} placeholder="3019876543" maxLength={15} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="email" label="Email">
                        <Input prefix={<MailOutlined />} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
                        <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="activo" label="Estado">
                        <Select options={[{ value: true, label: "✅ Activo" }, { value: false, label: "🔴 Inactivo" }]} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Miembro desde">
                        <Input disabled value={cliente.created_at ? dayjs(cliente.created_at).format("DD/MM/YYYY") : "—"} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button type="primary" icon={<SaveOutlined />} loading={guardando} onClick={guardarDatos}
                    style={{ background: "#d81b87", borderColor: "#d81b87" }}>
                    Guardar cambios
                  </Button>
                </Form>
              </div>
            ),
          },
          {
            key: "fidelizacion",
            label: <Space size={4}><GiftOutlined />Fidelización</Space>,
            children: (
              <div style={{ padding: "16px 20px" }}>
                <div style={{ background: `linear-gradient(135deg,${nivel.color}22,${nivel.color}44)`, border: `2px solid ${nivel.color}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                  <Row align="middle" justify="space-between">
                    <Col>
                      <Tag style={{ background: nivel.color, color: "#fff", border: "none", fontSize: 13, padding: "2px 12px" }}>
                        {NIVEL_ICONS[nivel.key]} {nivel.label}
                      </Tag>
                      <div style={{ marginTop: 8 }}>
                        <Text style={{ fontSize: 30, fontWeight: 800, color: nivel.color }}>⭐ {puntos.toLocaleString()}</Text>
                        <Text type="secondary"> pts</Text>
                      </div>
                    </Col>
                    <Col>
                      <Text type="secondary" style={{ fontSize: 12 }}>Vale</Text>
                      <div><Text strong style={{ fontSize: 20, color: "#52c41a" }}>${(Math.floor(puntos / 100) * 5000).toLocaleString()}</Text></div>
                      <Text type="secondary" style={{ fontSize: 11 }}>en descuentos</Text>
                    </Col>
                  </Row>
                  {prog && (
                    <div style={{ marginTop: 12 }}>
                      <Row justify="space-between">
                        <Text style={{ fontSize: 11 }}>→ {NIVEL_ICONS[prog.siguiente.key]} {prog.siguiente.label}</Text>
                        <Text style={{ fontSize: 11 }}>faltan {prog.faltantes.toLocaleString()} pts</Text>
                      </Row>
                      <Progress percent={prog.pct} strokeColor={{ "0%": nivel.color, "100%": prog.siguiente.color }} showInfo={false} style={{ marginTop: 4 }} />
                    </div>
                  )}
                </div>
                <Card size="small" title={<Space><StarOutlined />Gestionar puntos</Space>}>
                  <Row gutter={8} align="middle">
                    <Col flex="auto">
                      <InputNumber style={{ width: "100%" }} value={puntosAgregar} onChange={(v) => setPuntosAgregar(v || 0)}
                        placeholder="+ agregar / - descontar" />
                    </Col>
                    <Col>
                      <Button type="primary" loading={guardando} onClick={aplicarPuntos} disabled={puntosAgregar === 0}
                        style={{ background: "#d81b87", borderColor: "#d81b87" }}>
                        Aplicar
                      </Button>
                    </Col>
                  </Row>
                  <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 6 }}>Positivo para agregar, negativo para descontar</Text>
                </Card>
              </div>
            ),
          },
          {
            key: "historial",
            label: <Space size={4}><HistoryOutlined />Historial</Space>,
            children: (
              <div style={{ padding: "16px 20px" }}>
                {loadingVentas ? <Spin /> : (
                  <>
                    {ventas.length > 0 && (
                      <Row gutter={16} style={{ marginBottom: 12 }}>
                        <Col><Statistic title="Compras" value={ventas.length} valueStyle={{ fontSize: 18 }} /></Col>
                        <Col><Statistic title="Total gastado" value={totalGastado} prefix="$" formatter={(v) => Number(v).toLocaleString()} valueStyle={{ fontSize: 18, color: "#d81b87" }} /></Col>
                      </Row>
                    )}
                    <Table dataSource={ventas} columns={colsVentas} rowKey="id" size="small"
                      pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="Sin compras registradas" /> }} />
                  </>
                )}
              </div>
            ),
          },
          {
            key: "productos",
            label: <Space size={4}><ShoppingOutlined />Favoritos</Space>,
            children: (
              <div style={{ padding: "16px 20px" }}>
                {loadingVentas ? <Spin /> : (
                  <Table dataSource={productos} columns={colsProductos} rowKey="articulo_id" size="small"
                    pagination={false} locale={{ emptyText: <Empty description="Sin compras registradas" /> }} />
                )}
              </div>
            ),
          },
          {
            key: "tipo",
            label: <Space size={4}><TrophyOutlined />Tipo</Space>,
            children: (
              <div style={{ padding: "16px 20px" }}>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="Nivel de fidelidad">
                    <Tag style={{ background: nivel.color, color: "#fff", border: "none" }}>{NIVEL_ICONS[nivel.key]} {nivel.label}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Puntos acumulados">
                    <Text strong style={{ color: "#faad14" }}>⭐ {puntos.toLocaleString()}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Descuento aplicable">
                    <Tag color="green">{nivel.key === "bronce" ? "0%" : nivel.key === "plata" ? "5%" : nivel.key === "oro" ? "10%" : "15%"}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Total de compras">
                    {cliente.total_compras || ventas.length || 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="Total gastado">
                    <Text strong style={{ color: "#d81b87" }}>${totalGastado.toLocaleString()}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Estado">
                    <Badge status={cliente.activo !== false ? "success" : "error"} text={cliente.activo !== false ? "Activo" : "Inactivo"} />
                  </Descriptions.Item>
                  <Descriptions.Item label="Cumpleaños">
                    {cliente.fecha_nacimiento ? dayjs(cliente.fecha_nacimiento).format("DD/MM/YYYY") : "—"}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            ),
          },
        ]}
      />
    </Drawer>
  );
}
