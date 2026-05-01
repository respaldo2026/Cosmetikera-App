"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Button, Card, Col, Divider, Form, Input, InputNumber, message,
  Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, Tooltip, Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined, EditOutlined, GiftOutlined, PlusOutlined,
  ReloadOutlined, SaveOutlined, SettingOutlined, StarOutlined,
} from "@ant-design/icons";
import { invalidateClubConfigCache, type DynamicClubReward, type ClubReglas, DEFAULT_REGLAS } from "@/hooks/useClubConfig";

const { Title, Text } = Typography;
const { Option } = Select;

const CATEGORIAS = [
  { value: "descuento",    label: "Descuento / Bono", color: "green" },
  { value: "producto",     label: "Producto físico",  color: "blue" },
  { value: "experiencia",  label: "Experiencia VIP",  color: "purple" },
  { value: "cumpleanos",   label: "Cumpleaños",       color: "magenta" },
];

const NIVELES = [
  { value: "bronce",   label: "Bronce 🥉" },
  { value: "plata",    label: "Plata 🥈" },
  { value: "oro",      label: "Oro 🥇" },
  { value: "diamante", label: "Diamante 💎" },
];

const REGLAS_LABELS: Record<string, { label: string; description: string; min?: number; max?: number }> = {
  puntos_por_mil:               { label: "Puntos por cada $1.000",             description: "Cuántos puntos se acreditan por cada $1.000 COP de compra.", min: 1, max: 100 },
  multiplicador_cumple_bronce:  { label: "Multiplicador cumpleaños — Bronce",  description: "Factor de puntos en el mes de cumpleaños para clientes Bronce.", min: 1, max: 10 },
  multiplicador_cumple_plata:   { label: "Multiplicador cumpleaños — Plata",   description: "Factor de puntos en el mes de cumpleaños para clientes Plata.", min: 1, max: 10 },
  multiplicador_cumple_oro:     { label: "Multiplicador cumpleaños — Oro",     description: "Factor de puntos en el mes de cumpleaños para clientes Oro.", min: 1, max: 10 },
  multiplicador_cumple_diamante:{ label: "Multiplicador cumpleaños — Diamante",description: "Factor de puntos en el mes de cumpleaños para clientes Diamante.", min: 1, max: 10 },
  puntos_min_plata:             { label: "Puntos mínimos para nivel Plata",    description: "La clienta sube a Plata cuando alcanza este número de puntos.", min: 1 },
  puntos_min_oro:               { label: "Puntos mínimos para nivel Oro",      description: "La clienta sube a Oro cuando alcanza este número de puntos.", min: 1 },
  puntos_min_diamante:          { label: "Puntos mínimos para nivel Diamante", description: "La clienta sube a Diamante cuando alcanza este número de puntos.", min: 1 },
  descuento_plata:              { label: "% Descuento nivel Plata",            description: "Porcentaje de descuento automático en tienda para clientes Plata.", min: 0, max: 50 },
  descuento_oro:                { label: "% Descuento nivel Oro",              description: "Porcentaje de descuento automático en tienda para clientes Oro.", min: 0, max: 50 },
  descuento_diamante:           { label: "% Descuento nivel Diamante",         description: "Porcentaje de descuento automático en tienda para clientes Diamante.", min: 0, max: 50 },
  puntos_bienvenida:            { label: "Puntos de bienvenida",               description: "Puntos acreditados automáticamente al registrar un cliente nuevo.", min: 0 },
  puntos_referido:              { label: "Puntos por referido",                description: "Puntos que recibe la cliente referidora por cada referido válido.", min: 0, max: 5000 },
  puntos_max_saldo:             { label: "Tope máximo de saldo",               description: "Máximo de puntos acumulados simultáneamente por cliente.", min: 0 },
  puntos_max_ganados_mes:       { label: "Tope de puntos ganados por mes",     description: "Límite mensual de acumulación por cliente para evitar crecimiento indefinido.", min: 0 },
  puntos_vigencia_dias:         { label: "Vigencia de puntos (días)",          description: "Días de validez de los puntos antes de aplicar vencimiento.", min: 30, max: 3650 },
};

export default function ConfigClubPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [recompensas, setRecompensas] = useState<DynamicClubReward[]>([]);
  const [reglas, setReglas] = useState<ClubReglas>(DEFAULT_REGLAS);
  const [loadingData, setLoadingData] = useState(true);
  const [savingReglas, setSavingReglas] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<DynamicClubReward | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [reglasForm] = Form.useForm();

  const cargar = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/configuracion/club");
      const json = await res.json();
      setRecompensas(json.recompensas ?? []);
      setReglas({ ...DEFAULT_REGLAS, ...(json.reglas ?? {}) });
      reglasForm.setFieldsValue({ ...DEFAULT_REGLAS, ...(json.reglas ?? {}) });
    } catch {
      messageApi.error("No se pudo cargar la configuración del club");
    } finally {
      setLoadingData(false);
    }
  }, [messageApi, reglasForm]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNueva = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ activa: true, featured: false, birthday_only: false, icon: "🎁", orden: recompensas.length });
    setModalOpen(true);
  };

  const abrirEditar = (r: DynamicClubReward) => {
    setEditando(r);
    form.setFieldsValue({ ...r, level_min: r.level_min ?? undefined });
    setModalOpen(true);
  };

  const guardarRecompensa = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        ...values,
        level_min: values.level_min || null,
        badge: values.badge || null,
      };

      const url = editando
        ? `/api/configuracion/club/recompensas/${editando.id}`
        : "/api/configuracion/club/recompensas";
      const method = editando ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      messageApi.success(editando ? "Recompensa actualizada" : "Recompensa creada");
      setModalOpen(false);
      invalidateClubConfigCache();
      cargar();
    } catch (e: any) {
      messageApi.error(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const eliminarRecompensa = async (id: string) => {
    try {
      const res = await fetch(`/api/configuracion/club/recompensas/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      messageApi.success("Recompensa eliminada");
      invalidateClubConfigCache();
      cargar();
    } catch (e: any) {
      messageApi.error(e?.message || "Error al eliminar");
    }
  };

  const toggleActiva = async (record: DynamicClubReward, activa: boolean) => {
    try {
      const res = await fetch(`/api/configuracion/club/recompensas/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa }),
      });
      if (!res.ok) throw new Error();
      setRecompensas(prev => prev.map(r => r.id === record.id ? { ...r, activa } : r));
      invalidateClubConfigCache();
    } catch {
      messageApi.error("No se pudo cambiar el estado");
    }
  };

  const guardarReglas = async () => {
    const values = await reglasForm.validateFields();
    setSavingReglas(true);
    try {
      const res = await fetch("/api/configuracion/club", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reglas: values }),
      });
      if (!res.ok) throw new Error();
      messageApi.success("Reglas guardadas correctamente");
      invalidateClubConfigCache();
      setReglas({ ...DEFAULT_REGLAS, ...values });
    } catch {
      messageApi.error("No se pudieron guardar las reglas");
    } finally {
      setSavingReglas(false);
    }
  };

  const columns: ColumnsType<DynamicClubReward> = [
    {
      title: "",
      dataIndex: "icon",
      width: 44,
      render: (icon: string) => <span style={{ fontSize: 22 }}>{icon}</span>,
    },
    {
      title: "Nombre",
      dataIndex: "title",
      render: (title: string, r: DynamicClubReward) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{title}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.description.slice(0, 50)}{r.description.length > 50 ? "…" : ""}</Text>
        </Space>
      ),
    },
    {
      title: "Categoría",
      dataIndex: "category",
      width: 130,
      render: (cat: string) => {
        const c = CATEGORIAS.find(x => x.value === cat);
        return <Tag color={c?.color}>{c?.label ?? cat}</Tag>;
      },
    },
    {
      title: "Costo (pts)",
      dataIndex: "points_cost",
      width: 100,
      align: "right",
      render: (v: number) => <Text strong style={{ color: "#722ed1" }}>{v.toLocaleString()} pts</Text>,
    },
    {
      title: "Valor ($)",
      dataIndex: "value_cop",
      width: 100,
      align: "right",
      render: (v: number) => `$${v.toLocaleString()}`,
    },
    {
      title: "Nivel min.",
      dataIndex: "level_min",
      width: 100,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: "Especiales",
      width: 110,
      render: (_: unknown, r: DynamicClubReward) => (
        <Space size={4}>
          {r.birthday_only && <Tag color="magenta" style={{ fontSize: 10 }}>🎂 Cumple</Tag>}
          {r.featured && <Tag color="gold" style={{ fontSize: 10 }}>⭐ Dest.</Tag>}
        </Space>
      ),
    },
    {
      title: "Activa",
      dataIndex: "activa",
      width: 70,
      align: "center",
      render: (activa: boolean, r: DynamicClubReward) => (
        <Switch size="small" checked={activa} onChange={v => toggleActiva(r, v)} />
      ),
    },
    {
      title: "",
      width: 90,
      align: "center",
      render: (_: unknown, r: DynamicClubReward) => (
        <Space>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditar(r)} />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar esta recompensa?"
            description="Esta acción no se puede deshacer."
            onConfirm={() => eliminarRecompensa(r.id)}
            okText="Eliminar"
            okButtonProps={{ danger: true }}
            cancelText="Cancelar"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px 16px", maxWidth: 1100, margin: "0 auto" }}>
      {contextHolder}
      <Space align="center" style={{ marginBottom: 24, width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Space>
          <GiftOutlined style={{ fontSize: 22, color: "#d81b87" }} />
          <Title level={3} style={{ margin: 0 }}>Configuración del Club</Title>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={cargar} loading={loadingData}>
          Recargar
        </Button>
      </Space>

      {/* CATÁLOGO DE RECOMPENSAS */}
      <Card
        title={<Space><StarOutlined style={{ color: "#722ed1" }} /><span>Catálogo de recompensas</span></Space>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={abrirNueva}>
            Nueva recompensa
          </Button>
        }
        style={{ marginBottom: 24, borderRadius: 12 }}
      >
        <Table
          dataSource={recompensas}
          columns={columns}
          rowKey="id"
          loading={loadingData}
          size="small"
          pagination={false}
          scroll={{ x: 800 }}
          locale={{ emptyText: "No hay recompensas. Ejecuta la migración SQL para cargar el catálogo inicial." }}
        />
      </Card>

      {/* REGLAS DEL CLUB */}
      <Card
        title={<Space><SettingOutlined style={{ color: "#1677ff" }} /><span>Reglas del club</span></Space>}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={savingReglas} onClick={guardarReglas}>
            Guardar reglas
          </Button>
        }
        style={{ borderRadius: 12 }}
      >
        <Form form={reglasForm} layout="vertical">
          <Divider orientation="left" style={{ fontSize: 13, color: "#888" }}>Acumulación de puntos</Divider>
          <Row gutter={[16, 0]}>
            {["puntos_por_mil", "puntos_bienvenida", "puntos_referido"].map(clave => (
              <Col key={clave} xs={24} sm={12} md={8}>
                <Form.Item
                  name={clave}
                  label={<Tooltip title={REGLAS_LABELS[clave]?.description}><span>{REGLAS_LABELS[clave]?.label}</span></Tooltip>}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={REGLAS_LABELS[clave]?.min ?? 0} max={REGLAS_LABELS[clave]?.max} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Divider orientation="left" style={{ fontSize: 13, color: "#888" }}>Política de vencimiento y topes</Divider>
          <Row gutter={[16, 0]}>
            {["puntos_vigencia_dias", "puntos_max_saldo", "puntos_max_ganados_mes"].map(clave => (
              <Col key={clave} xs={24} sm={12} md={8}>
                <Form.Item
                  name={clave}
                  label={<Tooltip title={REGLAS_LABELS[clave]?.description}><span>{REGLAS_LABELS[clave]?.label}</span></Tooltip>}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={REGLAS_LABELS[clave]?.min ?? 0} max={REGLAS_LABELS[clave]?.max} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Divider orientation="left" style={{ fontSize: 13, color: "#888" }}>Multiplicadores de cumpleaños</Divider>
          <Row gutter={[16, 0]}>
            {["multiplicador_cumple_bronce", "multiplicador_cumple_plata", "multiplicador_cumple_oro", "multiplicador_cumple_diamante"].map(clave => (
              <Col key={clave} xs={24} sm={12} md={6}>
                <Form.Item
                  name={clave}
                  label={<Tooltip title={REGLAS_LABELS[clave]?.description}><span>{REGLAS_LABELS[clave]?.label}</span></Tooltip>}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} max={10} addonAfter="×" style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Divider orientation="left" style={{ fontSize: 13, color: "#888" }}>Umbrales de nivel (puntos)</Divider>
          <Row gutter={[16, 0]}>
            {["puntos_min_plata", "puntos_min_oro", "puntos_min_diamante"].map(clave => (
              <Col key={clave} xs={24} sm={8}>
                <Form.Item
                  name={clave}
                  label={<Tooltip title={REGLAS_LABELS[clave]?.description}><span>{REGLAS_LABELS[clave]?.label}</span></Tooltip>}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} step={100} style={{ width: "100%" }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Divider orientation="left" style={{ fontSize: 13, color: "#888" }}>Descuentos por nivel (%)</Divider>
          <Row gutter={[16, 0]}>
            {["descuento_plata", "descuento_oro", "descuento_diamante"].map(clave => (
              <Col key={clave} xs={24} sm={8}>
                <Form.Item
                  name={clave}
                  label={<Tooltip title={REGLAS_LABELS[clave]?.description}><span>{REGLAS_LABELS[clave]?.label}</span></Tooltip>}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} max={50} addonAfter="%" style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </Card>

      {/* MODAL CREAR / EDITAR RECOMPENSA */}
      <Modal
        title={editando ? "Editar recompensa" : "Nueva recompensa"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={guardarRecompensa}
        confirmLoading={saving}
        okText={editando ? "Guardar cambios" : "Crear recompensa"}
        cancelText="Cancelar"
        width={580}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={4}>
              <Form.Item name="icon" label="Icono" rules={[{ required: true }]}>
                <Input maxLength={4} style={{ fontSize: 22, textAlign: "center" }} />
              </Form.Item>
            </Col>
            <Col span={20}>
              <Form.Item name="title" label="Nombre" rules={[{ required: true, message: "Requerido" }]}>
                <Input placeholder="Ej: Voucher $10.000" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} placeholder="Describe cómo se usa esta recompensa en tienda." />
          </Form.Item>
          {!editando && (
            <Form.Item name="key" label="Clave única (slug)" rules={[{ required: true }, { pattern: /^[a-z0-9_]+$/, message: "Solo letras minúsculas, números y guión bajo" }]}>
              <Input placeholder="Ej: voucher_10k" />
            </Form.Item>
          )}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="category" label="Categoría" rules={[{ required: true }]}>
                <Select placeholder="Seleccionar">
                  {CATEGORIAS.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="level_min" label="Nivel mínimo requerido">
                <Select allowClear placeholder="Cualquier nivel">
                  {NIVELES.map(n => <Option key={n.value} value={n.value}>{n.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="points_cost" label="Costo en puntos" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: "100%" }} addonAfter="pts" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="value_cop" label="Valor en pesos">
                <InputNumber min={0} step={1000} style={{ width: "100%" }} addonBefore="$" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="badge" label="Badge / etiqueta">
                <Input placeholder="Ej: Mejor valor" maxLength={30} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="orden" label="Orden de aparición">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col>
              <Form.Item name="featured" valuePropName="checked" label="Destacada">
                <Switch />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="birthday_only" valuePropName="checked" label="Solo cumpleaños">
                <Switch />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="activa" valuePropName="checked" label="Activa">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
