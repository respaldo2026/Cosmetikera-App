"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Button, Typography, Space, Modal, Form, Input,
  Tag, App, Spin, Row, Col, Statistic, Table, Empty,
  Divider, Grid, Tooltip, Avatar,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, TruckOutlined,
  PhoneOutlined, MailOutlined, SearchOutlined, ReloadOutlined,
  GlobalOutlined, WhatsAppOutlined, ShopOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type Proveedor = {
  id: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  ciudad?: string;
  productos?: string;
  notas?: string;
  activo?: boolean;
};

export default function ProveedoresPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  const [data, setData] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabaseBrowserClient
      .from("proveedores")
      .select("*")
      .order("nombre");
    setData(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrado = data.filter((p) =>
    !search ||
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.contacto || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.ciudad || "").toLowerCase().includes(search.toLowerCase())
  );

  const openModal = (p?: Proveedor) => {
    setEditing(p || null);
    form.resetFields();
    if (p) form.setFieldsValue(p);
    setModalOpen(true);
  };

  const handleGuardar = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabaseBrowserClient.from("proveedores").update(values).eq("id", editing.id);
        if (error) throw error;
        message.success("Proveedor actualizado");
      } else {
        const { error } = await supabaseBrowserClient.from("proveedores").insert([values]);
        if (error) throw error;
        message.success("Proveedor creado");
      }
      setModalOpen(false);
      cargar();
    } catch (e: any) {
      message.error(e?.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = (p: Proveedor) => {
    modal.confirm({
      title: `Eliminar proveedor "${p.nombre}"`,
      content: "¿Confirmas eliminar este proveedor?",
      okType: "danger",
      okText: "Eliminar",
      cancelText: "Cancelar",
      onOk: async () => {
        const { error } = await supabaseBrowserClient.from("proveedores").delete().eq("id", p.id);
        if (error) { message.error(error.message); return; }
        message.success("Eliminado");
        cargar();
      },
    });
  };

  const columns = [
    {
      title: "Proveedor",
      key: "nombre",
      render: (_: any, rec: Proveedor) => (
        <Space>
          <Avatar
            style={{ background: "linear-gradient(135deg,#d81b87,#9c27b0)", flexShrink: 0 }}
            icon={<TruckOutlined />}
          />
          <div>
            <Text strong>{rec.nombre}</Text>
            {rec.contacto && <div><Text type="secondary" style={{ fontSize: 12 }}>{rec.contacto}</Text></div>}
          </div>
        </Space>
      ),
    },
    {
      title: "Contacto",
      key: "contacto",
      render: (_: any, rec: Proveedor) => (
        <Space direction="vertical" size={0}>
          {rec.telefono && (
            <Text style={{ fontSize: 12 }}>
              <PhoneOutlined style={{ marginRight: 4 }} />{rec.telefono}
            </Text>
          )}
          {rec.email && (
            <Text style={{ fontSize: 12 }}>
              <MailOutlined style={{ marginRight: 4 }} />{rec.email}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Ciudad",
      dataIndex: "ciudad",
      key: "ciudad",
      render: (v: string) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: "Productos / Líneas",
      dataIndex: "productos",
      key: "productos",
      render: (v: string) => v
        ? v.split(",").map((p, i) => <Tag key={i} color="purple" style={{ marginBottom: 2 }}>{p.trim()}</Tag>)
        : <Text type="secondary">—</Text>,
    },
    {
      title: "Acciones",
      key: "acciones",
      align: "center" as const,
      width: 100,
      render: (_: any, rec: Proveedor) => (
        <Space>
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
                background: "linear-gradient(135deg,#1890ff,#722ed1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <TruckOutlined style={{ color: "#fff", fontSize: 22 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>Proveedores</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Gestión de proveedores y distribuidores</Text>
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
                style={{ background: "linear-gradient(90deg,#1890ff,#722ed1)" }}
              >
                {isMobile ? "Nuevo" : "Nuevo proveedor"}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Total proveedores" value={data.length} prefix={<TruckOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Activos"
              value={data.filter(p => p.activo !== false).length}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Ciudades"
              value={new Set(data.map(p => p.ciudad).filter(Boolean)).size}
              prefix={<GlobalOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* BUSCADOR */}
      <Card style={{ marginBottom: 12, borderRadius: 10 }} bodyStyle={{ padding: "10px 14px" }}>
        <Input
          placeholder="Buscar proveedor por nombre, contacto o ciudad..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 500 }}
        />
      </Card>

      {/* TABLA */}
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
        ) : filtrado.length === 0 ? (
          <Empty description="Sin proveedores registrados" style={{ padding: 60 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Agregar proveedor
            </Button>
          </Empty>
        ) : (
          <Table
            dataSource={filtrado}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 15 }}
            scroll={{ x: 600 }}
          />
        )}
      </Card>

      {/* MODAL */}
      <Modal
        title={editing ? "Editar proveedor" : "Nuevo proveedor"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleGuardar}
        confirmLoading={saving}
        okText={editing ? "Guardar" : "Crear"}
        cancelText="Cancelar"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="nombre" label="Nombre del proveedor / empresa" rules={[{ required: true }]}>
            <Input placeholder="Ej: Distribuidora Beauty Colombia" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contacto" label="Persona de contacto">
                <Input placeholder="Nombre del vendedor" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ciudad" label="Ciudad">
                <Input placeholder="Bogotá, Medellín..." />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="telefono" label="Teléfono / WhatsApp">
                <Input placeholder="300 000 0000" prefix={<WhatsAppOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="ventas@proveedor.com" prefix={<MailOutlined />} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="productos" label="Líneas / productos que maneja">
            <Input placeholder="Esmaltes, bases, maquillaje... (separados por coma)" />
          </Form.Item>
          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={2} placeholder="Condiciones de pago, descuentos especiales, etc." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
