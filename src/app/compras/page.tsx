"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card, Button, Typography, Space, Modal, Form, Input, InputNumber,
  Select, Tag, App, Spin, Row, Col, Statistic, Table, Empty,
  Grid, Tooltip, Avatar, DatePicker, Divider, Badge,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, InboxOutlined,
  SearchOutlined, ReloadOutlined, TruckOutlined, CheckCircleOutlined,
  ClockCircleOutlined, WarningOutlined, DollarOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type CompraItem = { nombre: string; cantidad: number; precio_unitario: number };
type Compra = {
  id: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  fecha: string;
  total: number;
  estado: "pendiente" | "recibida" | "parcial" | "cancelada";
  notas?: string;
  items?: CompraItem[];
};

const ESTADO_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pendiente: { color: "gold", label: "Pendiente", icon: <ClockCircleOutlined /> },
  recibida: { color: "green", label: "Recibida", icon: <CheckCircleOutlined /> },
  parcial: { color: "orange", label: "Parcial", icon: <WarningOutlined /> },
  cancelada: { color: "red", label: "Cancelada", icon: <DeleteOutlined /> },
};

export default function ComprasPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [itemsForm, setItemsForm] = useState<CompraItem[]>([{ nombre: "", cantidad: 1, precio_unitario: 0 }]);

  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Compra | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: p }] = await Promise.all([
      supabaseBrowserClient.from("compras").select("*").order("fecha", { ascending: false }),
      supabaseBrowserClient.from("proveedores").select("id,nombre").order("nombre"),
    ]);
    setCompras(c || []);
    setProveedores(p || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = compras.filter((c) => {
    const matchSearch = !search ||
      (c.proveedor_nombre || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.notas || "").toLowerCase().includes(search.toLowerCase());
    const matchEstado = !filtroEstado || c.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const totalGastado = compras.filter(c => c.estado === "recibida")
    .reduce((s, c) => s + Number(c.total || 0), 0);
  const pendientes = compras.filter(c => c.estado === "pendiente").length;

  const totalItems = useMemo(() =>
    itemsForm.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0),
    [itemsForm]
  );

  const addItem = () => setItemsForm([...itemsForm, { nombre: "", cantidad: 1, precio_unitario: 0 }]);
  const removeItem = (idx: number) => setItemsForm(itemsForm.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof CompraItem, value: any) => {
    const updated = [...itemsForm];
    updated[idx] = { ...updated[idx], [field]: value };
    setItemsForm(updated);
  };

  const openModal = (c?: Compra) => {
    setEditing(c || null);
    form.resetFields();
    if (c) {
      form.setFieldsValue({ ...c, fecha: c.fecha ? dayjs(c.fecha) : null });
      setItemsForm(c.items || [{ nombre: "", cantidad: 1, precio_unitario: 0 }]);
    } else {
      form.setFieldsValue({ estado: "pendiente", fecha: dayjs() });
      setItemsForm([{ nombre: "", cantidad: 1, precio_unitario: 0 }]);
    }
    setModalOpen(true);
  };

  const handleGuardar = async () => {
    const values = await form.validateFields();
    if (itemsForm.some(i => !i.nombre)) {
      message.warning("Todos los ítems deben tener nombre"); return;
    }
    setSaving(true);
    const prov = proveedores.find(p => p.id === values.proveedor_id);
    const payload = {
      ...values,
      fecha: values.fecha ? dayjs(values.fecha).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      proveedor_nombre: prov?.nombre || "",
      total: totalItems,
      items: itemsForm,
    };
    try {
      if (editing) {
        const { error } = await supabaseBrowserClient.from("compras").update(payload).eq("id", editing.id);
        if (error) throw error;
        message.success("Compra actualizada");
      } else {
        const { error } = await supabaseBrowserClient.from("compras").insert([payload]);
        if (error) throw error;
        message.success("Compra registrada");
      }
      setModalOpen(false);
      cargar();
    } catch (e: any) {
      message.error(e?.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = (c: Compra) => {
    modal.confirm({
      title: "Eliminar orden de compra",
      content: "¿Confirmas eliminar esta compra?",
      okType: "danger", okText: "Eliminar", cancelText: "Cancelar",
      onOk: async () => {
        await supabaseBrowserClient.from("compras").delete().eq("id", c.id);
        message.success("Eliminada");
        cargar();
      },
    });
  };

  const cambiarEstado = async (c: Compra, estado: string) => {
    await supabaseBrowserClient.from("compras").update({ estado }).eq("id", c.id);
    message.success(`Estado → ${ESTADO_CONFIG[estado]?.label}`);
    cargar();
  };

  const columns = [
    {
      title: "Fecha",
      dataIndex: "fecha",
      key: "fecha",
      width: 110,
      render: (v: string) => <Text>{dayjs(v).format("DD/MM/YYYY")}</Text>,
    },
    {
      title: "Proveedor",
      dataIndex: "proveedor_nombre",
      key: "proveedor",
      render: (v: string) => (
        <Space>
          <Avatar size="small" style={{ background: "#722ed1" }} icon={<TruckOutlined />} />
          <Text strong>{v || "—"}</Text>
        </Space>
      ),
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (v: string) => {
        const cfg = ESTADO_CONFIG[v] || ESTADO_CONFIG.pendiente;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (v: number) => <Text strong style={{ color: "#d81b87" }}>${Number(v).toLocaleString()}</Text>,
    },
    {
      title: "Ítems",
      dataIndex: "items",
      key: "items",
      render: (v: CompraItem[]) => <Tag>{(v || []).length} ítem(s)</Tag>,
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 160,
      render: (_: any, rec: Compra) => (
        <Space>
          {rec.estado === "pendiente" && (
            <Tooltip title="Marcar recibida">
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                onClick={() => cambiarEstado(rec, "recibida")} />
            </Tooltip>
          )}
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => openModal(rec)} />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleEliminar(rec)} />
          </Tooltip>
        </Space>
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
                background: "linear-gradient(135deg,#096dd9,#1890ff)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <InboxOutlined style={{ color: "#fff", fontSize: 22 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>Compras</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Órdenes de compra a proveedores</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openModal()}
                style={{ background: "linear-gradient(90deg,#096dd9,#1890ff)" }}
              >
                {isMobile ? "Nueva" : "Nueva compra"}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Total compras" value={compras.length} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Pendientes"
              value={pendientes}
              valueStyle={{ color: pendientes > 0 ? "#fa8c16" : "#52c41a" }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Recibidas"
              value={compras.filter(c => c.estado === "recibida").length}
              valueStyle={{ color: "#52c41a" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Total invertido"
              value={totalGastado}
              prefix="$"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: "#d81b87" }}
            />
          </Card>
        </Col>
      </Row>

      {/* FILTROS */}
      <Card style={{ marginBottom: 12, borderRadius: 10 }} bodyStyle={{ padding: "10px 14px" }}>
        <Row gutter={12}>
          <Col xs={24} sm={14}>
            <Input
              placeholder="Buscar por proveedor o notas..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={10}>
            <Select
              placeholder="Estado"
              allowClear
              style={{ width: "100%" }}
              value={filtroEstado}
              onChange={setFiltroEstado}
              options={Object.entries(ESTADO_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
          </Col>
        </Row>
      </Card>

      {/* TABLA */}
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
        ) : filtradas.length === 0 ? (
          <Empty description="No hay órdenes de compra" style={{ padding: 60 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Nueva compra</Button>
          </Empty>
        ) : (
          <Table dataSource={filtradas} columns={columns} rowKey="id" pagination={{ pageSize: 15 }} scroll={{ x: 600 }} />
        )}
      </Card>

      {/* MODAL */}
      <Modal
        title={editing ? "Editar compra" : "Nueva orden de compra"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleGuardar}
        confirmLoading={saving}
        okText={editing ? "Guardar" : "Registrar compra"}
        cancelText="Cancelar"
        width={640}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="proveedor_id" label="Proveedor">
                <Select
                  showSearch
                  placeholder="Seleccionar proveedor"
                  options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="fecha" label="Fecha" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="estado" label="Estado" rules={[{ required: true }]}>
                <Select options={Object.entries(ESTADO_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 13 }}>Ítems de la compra</Divider>
          {itemsForm.map((item, idx) => (
            <Row key={idx} gutter={8} style={{ marginBottom: 8 }} align="middle">
              <Col flex="auto">
                <Input
                  placeholder="Nombre del producto"
                  value={item.nombre}
                  onChange={(e) => updateItem(idx, "nombre", e.target.value)}
                />
              </Col>
              <Col span={4}>
                <InputNumber
                  min={1}
                  placeholder="Cant."
                  value={item.cantidad}
                  onChange={(v) => updateItem(idx, "cantidad", v || 1)}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col span={5}>
                <InputNumber
                  min={0}
                  placeholder="$ Precio"
                  value={item.precio_unitario}
                  onChange={(v) => updateItem(idx, "precio_unitario", v || 0)}
                  style={{ width: "100%" }}
                  formatter={(v) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                />
              </Col>
              <Col span={2}>
                {itemsForm.length > 1 && (
                  <Button danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(idx)} />
                )}
              </Col>
            </Row>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={addItem} block style={{ marginBottom: 12 }}>
            Agregar ítem
          </Button>
          <div style={{ textAlign: "right", padding: "8px 0" }}>
            <Text strong style={{ fontSize: 16 }}>
              Total: <span style={{ color: "#d81b87" }}>${totalItems.toLocaleString()}</span>
            </Text>
          </div>
          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={2} placeholder="Observaciones, condiciones especiales..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
