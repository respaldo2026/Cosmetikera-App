"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card, Typography, Space, Tag, Spin, Row, Col, Statistic,
  Table, Empty, Grid, Button, Avatar, Tooltip, Progress,
  Divider, Badge, Modal, Input, Form, App, Tabs, Descriptions,
  Select, DatePicker, InputNumber,
} from "antd";
import {
  UserOutlined, SearchOutlined, ReloadOutlined, EditOutlined,
  GiftOutlined, CrownOutlined, HistoryOutlined, ShoppingOutlined,
  PlusOutlined, PhoneOutlined, MailOutlined, TrophyOutlined,
  StarOutlined, BarChartOutlined, SaveOutlined, CloseOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// ─── Tipos ────────────────────────────────────────────────────────────────

type Cliente = {
  id: string;
  nombre_completo: string;
  telefono?: string;
  email?: string;
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

// ─── Constantes ───────────────────────────────────────────────────────────

const NIVEL_COLORS: Record<string, string> = {
  bronce: "#cd7f32",
  plata: "#aaa",
  oro: "#faad14",
  diamante: "#13c2c2",
};
const NIVEL_ICONS: Record<string, string> = {
  bronce: "🥉", plata: "🥈", oro: "🥇", diamante: "💎",
};
const NIVELES = [
  { key: "bronce", label: "Bronce", min: 0, max: 999 },
  { key: "plata", label: "Plata", min: 1000, max: 4999 },
  { key: "oro", label: "Oro", min: 5000, max: 14999 },
  { key: "diamante", label: "Diamante", min: 15000, max: Infinity },
];

function getNivel(puntos: number) {
  return NIVELES.findLast((n) => puntos >= n.min) ?? NIVELES[0]!;
}

function getProgreso(puntos: number) {
  const actual = getNivel(puntos);
  const idx = NIVELES.indexOf(actual);
  if (idx >= NIVELES.length - 1) return null;
  const sig = NIVELES[idx + 1]!;
  const pct = Math.round(((puntos - actual.min) / (sig.min - actual.min)) * 100);
  return { siguiente: sig, pct, faltantes: sig.min - puntos };
}

// ─── Sub-componentes de tabs ──────────────────────────────────────────────

// Tab 1: Lista + Edición
function TabClientes({
  clientes, loading, onRecargar,
}: {
  clientes: Cliente[];
  loading: boolean;
  onRecargar: () => void;
}) {
  const { message } = App.useApp();
  const [search, setSearch] = useState("");
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form] = Form.useForm();
  const [formNuevo] = Form.useForm();

  const filtrados = useMemo(() =>
    clientes.filter((c) =>
      !search ||
      c.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.telefono || "").includes(search)
    ), [clientes, search]);

  const abrirEdicion = (cliente: Cliente) => {
    setEditando(cliente);
    form.setFieldsValue({
      nombre_completo: cliente.nombre_completo,
      telefono: cliente.telefono,
      email: cliente.email,
      fecha_nacimiento: cliente.fecha_nacimiento ? dayjs(cliente.fecha_nacimiento) : null,
      activo: cliente.activo ?? true,
    });
  };

  const guardar = async () => {
    if (!editando) return;
    try {
      const values = await form.validateFields();
      setGuardando(true);
      const { error } = await supabaseBrowserClient
        .from("perfiles")
        .update({
          nombre_completo: values.nombre_completo,
          telefono: values.telefono || null,
          email: values.email || null,
          fecha_nacimiento: values.fecha_nacimiento
            ? dayjs(values.fecha_nacimiento).format("YYYY-MM-DD")
            : null,
          activo: values.activo,
        })
        .eq("id", editando.id);
      if (error) throw error;
      message.success("Cliente actualizado");
      setEditando(null);
      onRecargar();
    } catch {
      message.error("Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const crearCliente = async () => {
    try {
      const values = await formNuevo.validateFields();
      setGuardando(true);
      const { error } = await supabaseBrowserClient.from("perfiles").insert({
        nombre_completo: values.nombre_completo,
        telefono: values.telefono || null,
        email: values.email || null,
        cedula: values.cedula || null,
        fecha_nacimiento: values.fecha_nacimiento
          ? dayjs(values.fecha_nacimiento).format("YYYY-MM-DD")
          : null,
        rol: "cliente",
        puntos_fidelidad: 50,
        nivel_fidelidad: "bronce",
        puntos_ganados: 50,
        activo: true,
      });
      if (error) throw error;
      message.success("✅ Cliente creado — 50 pts de bienvenida");
      setCreando(false);
      formNuevo.resetFields();
      onRecargar();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      message.error("Error al crear cliente: " + msg);
    } finally {
      setGuardando(false);
    }
  };

  const columns: ColumnsType<Cliente> = [
    {
      title: "Cliente",
      dataIndex: "nombre_completo",
      render: (nombre: string, r) => (
        <Space>
          <Avatar style={{ background: NIVEL_COLORS[r.nivel_fidelidad || "bronce"] }}>
            {nombre[0]?.toUpperCase()}
          </Avatar>
          <div>
            <Text strong>{nombre}</Text>
            {r.email && <div><Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text></div>}
          </div>
        </Space>
      ),
    },
    {
      title: "Teléfono",
      dataIndex: "telefono",
      render: (t?: string) => t ? <Space size={4}><PhoneOutlined />{t}</Space> : <Text type="secondary">—</Text>,
    },
    {
      title: "Nivel",
      dataIndex: "nivel_fidelidad",
      render: (n?: string) => {
        const nivel = n || "bronce";
        return (
          <Tag color={NIVEL_COLORS[nivel]} style={{ color: "#fff" }}>
            {NIVEL_ICONS[nivel]} {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
          </Tag>
        );
      },
    },
    {
      title: "Puntos",
      dataIndex: "puntos_fidelidad",
      render: (p?: number) => <Text strong style={{ color: "#faad14" }}>⭐ {(p || 0).toLocaleString()}</Text>,
      sorter: (a, b) => (a.puntos_fidelidad || 0) - (b.puntos_fidelidad || 0),
    },
    {
      title: "Estado",
      dataIndex: "activo",
      render: (a?: boolean) => <Badge status={a !== false ? "success" : "error"} text={a !== false ? "Activo" : "Inactivo"} />,
    },
    {
      title: "",
      key: "acciones",
      width: 60,
      render: (_, r) => (
        <Tooltip title="Editar">
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirEdicion(r)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col flex="auto">
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar por nombre, email o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={onRecargar} loading={loading}>
            Actualizar
          </Button>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: "#d81b87", borderColor: "#d81b87" }}
            onClick={() => { setCreando(true); formNuevo.resetFields(); }}
          >
            Nuevo cliente
          </Button>
        </Col>
      </Row>

      <Table
        dataSource={filtrados}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 15, showTotal: (t) => `${t} clientes` }}
        locale={{ emptyText: <Empty description="No hay clientes registrados" /> }}
      />

      <Modal
        open={!!editando}
        title={<Space><EditOutlined /> Editar cliente</Space>}
        onCancel={() => setEditando(null)}
        footer={[
          <Button key="cancel" icon={<CloseOutlined />} onClick={() => setEditando(null)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={guardando} onClick={guardar}>Guardar</Button>,
        ]}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="nombre_completo" label="Nombre completo" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="telefono" label="Teléfono">
                <Input prefix={<PhoneOutlined />} />
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
            <Col span={12}>
              <Form.Item name="activo" label="Estado">
                <Select options={[{ value: true, label: "Activo" }, { value: false, label: "Inactivo" }]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal: Nuevo cliente */}
      <Modal
        open={creando}
        title={<Space><PlusOutlined style={{ color: "#d81b87" }} /> Nuevo cliente</Space>}
        onCancel={() => setCreando(false)}
        footer={[
          <Button key="cancel" icon={<CloseOutlined />} onClick={() => setCreando(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={guardando} onClick={crearCliente}
            style={{ background: "#d81b87", borderColor: "#d81b87" }}>
            Crear cliente
          </Button>,
        ]}
        destroyOnClose
      >
        <Form form={formNuevo} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="nombre_completo" label="Nombre completo" rules={[{ required: true, message: "Campo obligatorio" }]}>
            <Input prefix={<UserOutlined />} placeholder="Ej: María García" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="cedula" label="Cédula">
                <Input placeholder="Ej: 1234567890" maxLength={12} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="telefono" label="Teléfono">
                <Input prefix={<PhoneOutlined />} placeholder="Ej: 3001234567" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="Email">
            <Input prefix={<MailOutlined />} placeholder="correo@ejemplo.com" />
          </Form.Item>
          <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="DD/MM/AAAA" />
          </Form.Item>
          <div style={{ background: "#fff7e6", border: "1px solid #ffe7ba", borderRadius: 8, padding: "10px 14px" }}>
            <Text style={{ fontSize: 12 }}>🌟 El cliente recibirá <strong>50 puntos de bienvenida</strong> al crearse</Text>
          </div>
        </Form>
      </Modal>
    </>
  );
}

// Tab 2: Historial de compras
function TabHistorial({ clientes }: { clientes: Cliente[] }) {
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(false);

  const cargarHistorial = useCallback(async (id: string) => {
    setLoading(true);
    const { data } = await supabaseBrowserClient
      .from("ventas")
      .select("id,created_at,total,metodo_pago,items")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    setVentas(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (clienteId) cargarHistorial(clienteId);
  }, [clienteId, cargarHistorial]);

  const columnas: ColumnsType<Venta> = [
    {
      title: "Fecha",
      dataIndex: "created_at",
      render: (d: string) => dayjs(d).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Total",
      dataIndex: "total",
      render: (t: number) => <Text strong>${t?.toLocaleString()}</Text>,
    },
    {
      title: "Método de pago",
      dataIndex: "metodo_pago",
      render: (m?: string) => m ? <Tag>{m}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: "Productos",
      dataIndex: "items",
      render: (items?: VentaItem[]) =>
        items && items.length > 0
          ? items.map((i) => (
            <div key={i.articulo_id} style={{ fontSize: 12 }}>
              {i.cantidad}x {i.nombre} — <Text type="secondary">${i.subtotal?.toLocaleString()}</Text>
            </div>
          ))
          : <Text type="secondary">—</Text>,
    },
  ];

  const totalGastado = ventas.reduce((s, v) => s + (v.total || 0), 0);

  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <Select
            showSearch
            style={{ width: "100%" }}
            placeholder="Selecciona un cliente..."
            optionFilterProp="label"
            value={clienteId}
            onChange={setClienteId}
            options={clientes.map((c) => ({ value: c.id, label: c.nombre_completo }))}
          />
        </Col>
        {clienteId && ventas.length > 0 && (
          <Col>
            <Space>
              <Statistic
                title="Compras"
                value={ventas.length}
                prefix={<ShoppingOutlined />}
                valueStyle={{ fontSize: 16 }}
              />
              <Divider type="vertical" style={{ height: 40 }} />
              <Statistic
                title="Total gastado"
                value={totalGastado}
                prefix="$"
                valueStyle={{ fontSize: 16, color: "#d81b87" }}
                formatter={(v) => Number(v).toLocaleString()}
              />
            </Space>
          </Col>
        )}
      </Row>

      {!clienteId ? (
        <Empty description="Selecciona un cliente para ver su historial" />
      ) : (
        <Table
          dataSource={ventas}
          columns={columnas}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10, showTotal: (t) => `${t} compras` }}
          locale={{ emptyText: <Empty description="Este cliente no tiene compras registradas" /> }}
        />
      )}
    </div>
  );
}

// Tab 3: Productos más comprados
function TabProductos({ clientes }: { clientes: Cliente[] }) {
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [productos, setProductos] = useState<ProductoResumen[]>([]);
  const [loading, setLoading] = useState(false);

  const cargarProductos = useCallback(async (id: string) => {
    setLoading(true);
    const { data: ventas } = await supabaseBrowserClient
      .from("ventas")
      .select("items,total")
      .eq("cliente_id", id);

    const mapa: Record<string, ProductoResumen> = {};
    (ventas || []).forEach((v) => {
      const items: VentaItem[] = v.items || [];
      items.forEach((item) => {
        if (!mapa[item.articulo_id]) {
          mapa[item.articulo_id] = {
            articulo_id: item.articulo_id,
            nombre: item.nombre,
            total_cantidad: 0,
            total_gastado: 0,
            veces_comprado: 0,
          };
        }
        mapa[item.articulo_id]!.total_cantidad += item.cantidad;
        mapa[item.articulo_id]!.total_gastado += item.subtotal;
        mapa[item.articulo_id]!.veces_comprado += 1;
      });
    });

    const lista = Object.values(mapa).sort((a, b) => b.total_cantidad - a.total_cantidad);
    setProductos(lista);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (clienteId) cargarProductos(clienteId);
  }, [clienteId, cargarProductos]);

  const maxCantidad = productos[0]?.total_cantidad || 1;

  const columnas: ColumnsType<ProductoResumen> = [
    {
      title: "#",
      key: "rank",
      width: 48,
      render: (_: unknown, __: ProductoResumen, i: number) => (
        <Text strong style={{ color: i === 0 ? "#faad14" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : undefined }}>
          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
        </Text>
      ),
    },
    {
      title: "Producto",
      dataIndex: "nombre",
      render: (n: string) => <Text strong>{n}</Text>,
    },
    {
      title: "Unidades",
      dataIndex: "total_cantidad",
      render: (q: number) => (
        <Space direction="vertical" size={2} style={{ width: "100%" }}>
          <Text>{q} uds.</Text>
          <Progress percent={Math.round((q / maxCantidad) * 100)} showInfo={false} strokeColor="#d81b87" size="small" />
        </Space>
      ),
    },
    {
      title: "Veces comprado",
      dataIndex: "veces_comprado",
      render: (v: number) => <Tag color="blue">{v}x</Tag>,
    },
    {
      title: "Total gastado",
      dataIndex: "total_gastado",
      render: (t: number) => <Text strong>${t?.toLocaleString()}</Text>,
    },
  ];

  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <Select
            showSearch
            style={{ width: "100%" }}
            placeholder="Selecciona un cliente..."
            optionFilterProp="label"
            value={clienteId}
            onChange={setClienteId}
            options={clientes.map((c) => ({ value: c.id, label: c.nombre_completo }))}
          />
        </Col>
      </Row>

      {!clienteId ? (
        <Empty description="Selecciona un cliente para ver sus productos más comprados" />
      ) : (
        <Table
          dataSource={productos}
          columns={columnas}
          rowKey="articulo_id"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="Sin compras registradas" /> }}
        />
      )}
    </div>
  );
}

// Tab 4: Fidelización
function TabFidelizacion({
  clientes, onRecargar,
}: {
  clientes: Cliente[];
  loading: boolean;
  onRecargar: () => void;
}) {
  const { message } = App.useApp();
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [puntosAgregar, setPuntosAgregar] = useState<number>(0);
  const [nota, setNota] = useState("");

  const cliente = useMemo(() => clientes.find((c) => c.id === clienteId) ?? null, [clientes, clienteId]);
  const puntos = cliente?.puntos_fidelidad || 0;
  const nivel = getNivel(puntos);
  const progreso = getProgreso(puntos);

  const resumenNiveles = NIVELES.map((n) => ({
    ...n,
    count: clientes.filter((c) => getNivel(c.puntos_fidelidad || 0).key === n.key).length,
  }));

  const agregarPuntos = async () => {
    if (!cliente || puntosAgregar === 0) return;
    setGuardando(true);
    try {
      const nuevosPuntos = Math.max(0, puntos + puntosAgregar);
      const nuevoNivel = getNivel(nuevosPuntos);
      const { error } = await supabaseBrowserClient
        .from("perfiles")
        .update({
          puntos_fidelidad: nuevosPuntos,
          nivel_fidelidad: nuevoNivel.key,
        })
        .eq("id", cliente.id);
      if (error) throw error;
      message.success(puntosAgregar > 0 ? `+${puntosAgregar} puntos agregados` : `${puntosAgregar} puntos descontados`);
      setPuntosAgregar(0);
      setNota("");
      onRecargar();
    } catch {
      message.error("Error al actualizar puntos");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      {/* Resumen global */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {resumenNiveles.map((n) => (
          <Col xs={12} sm={6} key={n.key}>
            <Card size="small" style={{ textAlign: "center", borderTop: `3px solid ${NIVEL_COLORS[n.key]}` }}>
              <div style={{ fontSize: 24 }}>{NIVEL_ICONS[n.key]}</div>
              <Text strong>{n.label}</Text>
              <div><Text style={{ fontSize: 22, fontWeight: 700, color: NIVEL_COLORS[n.key] }}>{n.count}</Text></div>
              <Text type="secondary" style={{ fontSize: 11 }}>clientes</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider />

      {/* Gestión individual */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={10}>
          <Card size="small" title={<Space><UserOutlined />Seleccionar cliente</Space>}>
            <Select
              showSearch
              style={{ width: "100%", marginBottom: 16 }}
              placeholder="Buscar cliente..."
              optionFilterProp="label"
              value={clienteId}
              onChange={setClienteId}
              options={clientes.map((c) => ({
                value: c.id,
                label: `${c.nombre_completo} — ${c.puntos_fidelidad || 0} pts`,
              }))}
            />

            {cliente && (
              <>
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="Nombre">{cliente.nombre_completo}</Descriptions.Item>
                  <Descriptions.Item label="Teléfono">{cliente.telefono || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Email">{cliente.email || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Compras">{cliente.total_compras || 0}</Descriptions.Item>
                </Descriptions>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} md={14}>
          {!cliente ? (
            <Empty description="Selecciona un cliente para gestionar sus puntos" style={{ marginTop: 40 }} />
          ) : (
            <Card size="small" title={<Space><GiftOutlined />Puntos de fidelización</Space>}>
              {/* Nivel actual */}
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 40 }}>{NIVEL_ICONS[nivel.key]}</div>
                <Tag color={NIVEL_COLORS[nivel.key]} style={{ color: "#fff", fontSize: 16, padding: "4px 16px" }}>
                  {nivel.label}
                </Tag>
                <div style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 28, fontWeight: 700, color: "#faad14" }}>
                    ⭐ {puntos.toLocaleString()}
                  </Text>
                  <Text type="secondary"> puntos</Text>
                </div>
              </div>

              {/* Progreso al siguiente nivel */}
              {progreso && (
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Faltan {progreso.faltantes.toLocaleString()} puntos para {NIVEL_ICONS[progreso.siguiente.key]} {progreso.siguiente.label}
                  </Text>
                  <Progress
                    percent={progreso.pct}
                    strokeColor={{ "0%": NIVEL_COLORS[nivel.key], "100%": NIVEL_COLORS[progreso.siguiente.key] }}
                    style={{ marginTop: 4 }}
                  />
                </div>
              )}

              <Divider style={{ margin: "12px 0" }} />

              {/* Agregar / quitar puntos */}
              <Row gutter={8} align="middle">
                <Col flex="auto">
                  <InputNumber
                    style={{ width: "100%" }}
                    value={puntosAgregar}
                    onChange={(v) => setPuntosAgregar(v || 0)}
                    placeholder="Puntos (+ agregar / - quitar)"
                    prefix={<StarOutlined />}
                  />
                </Col>
                <Col>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    loading={guardando}
                    onClick={agregarPuntos}
                    disabled={puntosAgregar === 0}
                    style={{ background: "#d81b87", borderColor: "#d81b87" }}
                  >
                    Aplicar
                  </Button>
                </Col>
              </Row>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Ingresa valor positivo para agregar puntos o negativo para descontar
              </Text>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function ClientesPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("lista");

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabaseBrowserClient
      .from("perfiles")
      .select("id,nombre_completo,telefono,email,puntos_fidelidad,nivel_fidelidad,fecha_nacimiento,total_compras,activo,created_at")
      .eq("rol", "cliente")
      .order("nombre_completo");
    setClientes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const estadisticas = useMemo(() => ({
    total: clientes.length,
    activos: clientes.filter((c) => c.activo !== false).length,
    puntosTotales: clientes.reduce((s, c) => s + (c.puntos_fidelidad || 0), 0),
    nivelOroPlus: clientes.filter((c) => ["oro", "diamante"].includes(c.nivel_fidelidad || "")).length,
  }), [clientes]);

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space align="center">
            <Avatar size={40} style={{ background: "linear-gradient(135deg,#d81b87,#f5317f)" }} icon={<UserOutlined />} />
            <div>
              <Title level={4} style={{ margin: 0 }}>Clientes</Title>
              <Text type="secondary" style={{ fontSize: 12 }}>Gestión, historial y fidelización</Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading}>
            {!isMobile && "Actualizar"}
          </Button>
        </Col>
      </Row>

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { title: "Total clientes", value: estadisticas.total, prefix: <UserOutlined />, color: "#d81b87" },
          { title: "Activos", value: estadisticas.activos, prefix: "✅", color: "#52c41a" },
          { title: "Puntos emitidos", value: estadisticas.puntosTotales, prefix: "⭐", color: "#faad14" },
          { title: "Oro & Diamante", value: estadisticas.nivelOroPlus, prefix: "🏆", color: "#13c2c2" },
        ].map((k) => (
          <Col xs={12} sm={6} key={k.title}>
            <Card size="small">
              <Statistic
                title={k.title}
                value={k.value}
                prefix={k.prefix}
                valueStyle={{ color: k.color, fontSize: 20 }}
                formatter={(v) => Number(v).toLocaleString()}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabs principales */}
      <Card bodyStyle={{ paddingTop: 0 }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          size={isMobile ? "small" : "middle"}
          items={[
            {
              key: "lista",
              label: <Space><UserOutlined />Clientes</Space>,
              children: (
                <TabClientes
                  clientes={clientes}
                  loading={loading}
                  onRecargar={cargar}
                />
              ),
            },
            {
              key: "historial",
              label: <Space><HistoryOutlined />Historial de compras</Space>,
              children: <TabHistorial clientes={clientes} />,
            },
            {
              key: "productos",
              label: <Space><BarChartOutlined />Productos favoritos</Space>,
              children: <TabProductos clientes={clientes} />,
            },
            {
              key: "fidelizacion",
              label: <Space><GiftOutlined />Fidelización</Space>,
              children: (
                <TabFidelizacion
                  clientes={clientes}
                  loading={loading}
                  onRecargar={cargar}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
