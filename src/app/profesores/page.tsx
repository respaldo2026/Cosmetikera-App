"use client";

import React, { useEffect, useState } from "react";
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
  Avatar, Typography, Row, Col, Statistic, message, Popconfirm, Tooltip,
} from "antd";
import {
  UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  PhoneOutlined, WhatsAppOutlined, MailOutlined, SolutionOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";

const { Title, Text } = Typography;
const { Option } = Select;

type Colaborador = {
  id: string;
  nombre_completo: string;
  telefono: string;
  email: string;
  rol: string;
  cargo: string;
  activo: boolean;
  created_at: string;
};

const ROLES_EQUIPO = [
  { value: "administrador", label: "Administrador", color: "#d81b87" },
  { value: "vendedor", label: "Vendedor/a", color: "#1677ff" },
  { value: "esteticista", label: "Esteticista", color: "#13c2c2" },
  { value: "bodega", label: "Bodega", color: "#fa8c16" },
  { value: "contador", label: "Contador/a", color: "#52c41a" },
  { value: "mensajero", label: "Mensajero/a", color: "#722ed1" },
];

const rolColor = (rol: string) =>
  ROLES_EQUIPO.find((r) => r.value === rol)?.color ?? "#999";

export default function EquipoPage() {
  const [equipo, setEquipo] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Colaborador | null>(null);
  const [form] = Form.useForm();

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabaseBrowserClient
      .from("perfiles")
      .select("id, nombre_completo, telefono, email, rol, cargo, activo, created_at")
      .in("rol", ["administrador", "vendedor", "esteticista", "bodega", "contador", "mensajero"])
      .order("nombre_completo");
    setEquipo(data || []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const abrirCrear = () => { setEditando(null); form.resetFields(); setModalOpen(true); };
  const abrirEditar = (c: Colaborador) => { setEditando(c); form.setFieldsValue(c); setModalOpen(true); };

  const guardar = async () => {
    const vals = await form.validateFields();
    if (editando) {
      await supabaseBrowserClient.from("perfiles").update(vals).eq("id", editando.id);
      message.success("Colaborador actualizado");
    } else {
      await supabaseBrowserClient.from("perfiles").insert({ ...vals, activo: true });
      message.success("Colaborador agregado");
    }
    setModalOpen(false);
    cargar();
  };

  const eliminar = async (id: string) => {
    await supabaseBrowserClient.from("perfiles").update({ activo: false }).eq("id", id);
    message.success("Colaborador desactivado");
    cargar();
  };

  const totalesPorRol = ROLES_EQUIPO.map((r) => ({
    ...r,
    count: equipo.filter((c) => c.rol === r.value).length,
  }));

  const columns = [
    {
      title: "Colaborador",
      render: (_: any, c: Colaborador) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ background: rolColor(c.rol) }} />
          <div>
            <Text strong>{c.nombre_completo}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{c.cargo || "—"}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Rol",
      dataIndex: "rol",
      render: (rol: string) => (
        <Tag color={rolColor(rol)} style={{ borderRadius: 8 }}>
          {ROLES_EQUIPO.find((r) => r.value === rol)?.label ?? rol}
        </Tag>
      ),
      filters: ROLES_EQUIPO.map((r) => ({ text: r.label, value: r.value })),
      onFilter: (value: any, record: Colaborador) => record.rol === value,
    },
    {
      title: "Contacto",
      render: (_: any, c: Colaborador) => (
        <Space direction="vertical" size={0}>
          {c.telefono && (
            <Space size={4}>
              <PhoneOutlined style={{ color: "#888" }} />
              <Text style={{ fontSize: 13 }}>{c.telefono}</Text>
              <Tooltip title="WhatsApp">
                <Button
                  size="small" type="link" icon={<WhatsAppOutlined style={{ color: "#25D366" }} />}
                  onClick={() => window.open(`https://wa.me/${c.telefono?.replace(/\D/g, "")}`, "_blank")}
                />
              </Tooltip>
            </Space>
          )}
          {c.email && (
            <Space size={4}>
              <MailOutlined style={{ color: "#888" }} />
              <Text style={{ fontSize: 13 }}>{c.email}</Text>
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: "Estado",
      render: (_: any, c: Colaborador) => (
        <Tag color={c.activo ? "green" : "default"}>{c.activo ? "Activo" : "Inactivo"}</Tag>
      ),
    },
    {
      title: "Acciones",
      render: (_: any, c: Colaborador) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditar(c)} />
          <Popconfirm title="¿Desactivar colaborador?" onConfirm={() => eliminar(c.id)} okText="Sí" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <SolutionOutlined style={{ marginRight: 8, color: "#d81b87" }} />
            Equipo de trabajo
          </Title>
          <Text type="secondary">Gestión de colaboradores de la tienda</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: "#d81b87" }} onClick={abrirCrear}>
          Agregar colaborador
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {totalesPorRol.filter((r) => r.count > 0).map((r) => (
          <Col key={r.value}>
            <Card size="small" style={{ borderRadius: 10, minWidth: 100, textAlign: "center" }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>{r.label}</span>}
                value={r.count}
                valueStyle={{ color: r.color, fontSize: 22 }}
              />
            </Card>
          </Col>
        ))}
        <Col>
          <Card size="small" style={{ borderRadius: 10, minWidth: 100, textAlign: "center" }}>
            <Statistic title={<span style={{ fontSize: 11 }}>Total equipo</span>} value={equipo.filter((c) => c.activo).length} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={equipo}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>

      <Modal
        title={editando ? "Editar colaborador" : "Nuevo colaborador"}
        open={modalOpen}
        onOk={guardar}
        onCancel={() => setModalOpen(false)}
        okText="Guardar"
        cancelText="Cancelar"
        okButtonProps={{ style: { background: "#d81b87" } }}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="nombre_completo" label="Nombre completo" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} placeholder="Nombre y apellido" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rol" label="Rol" rules={[{ required: true }]}>
                <Select placeholder="Seleccionar rol">
                  {ROLES_EQUIPO.map((r) => (
                    <Option key={r.value} value={r.value}>{r.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cargo" label="Cargo / descripción">
                <Input placeholder="Ej: Vendedora principal" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="telefono" label="Teléfono / WhatsApp">
                <Input prefix={<PhoneOutlined />} placeholder="+57 300..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Correo electrónico">
                <Input prefix={<MailOutlined />} placeholder="correo@ejemplo.com" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}