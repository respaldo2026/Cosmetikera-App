"use client";

import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import {
  Card, Typography, Space, Tag, Row, Col, Statistic,
  Table, Empty, Grid, Button, Avatar, Badge, Modal, Input, Form, App,
} from "antd";
import {
  UserOutlined, SearchOutlined, ReloadOutlined, EditOutlined,
  PlusOutlined, PhoneOutlined, MailOutlined, TrophyOutlined,
  SaveOutlined, CloseOutlined, IdcardOutlined, RightOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { authHeaders } from "@/utils/auth-fetch";
import { normalizarDatosFormulario } from "@utils/form-normalizer";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;
const DrawerCliente = dynamic(() => import("./DrawerCliente"), { ssr: false });

// ─── Tipos ───────────────────────────────────────────────────────────────

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

// ─── Constantes ──────────────────────────────────────────────────────────

const NIVEL_COLORS: Record<string, string> = {
  bronce: "#cd7f32", plata: "#8c8c8c", oro: "#faad14", diamante: "#13c2c2",
};
const NIVEL_ICONS: Record<string, string> = {
  bronce: "🥉", plata: "🥈", oro: "🥇", diamante: "💎",
};
const NIVELES = [
  { key: "bronce", label: "Bronce", min: 0,     color: "#cd7f32" },
  { key: "plata",  label: "Plata",  min: 1000,  color: "#8c8c8c" },
  { key: "oro",    label: "Oro",    min: 5000,  color: "#faad14" },
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

function parseDiaMesToIso(diaMes: string): string | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(String(diaMes || "").trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const base = dayjs(`2000-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, "YYYY-MM-DD", true);
  if (!base.isValid() || base.date() !== day || base.month() + 1 !== month) return null;

  return base.format("YYYY-MM-DD");
}

function formatDiaMesInput(value: string): string {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

// ─── Página principal ────────────────────────────────────────────────────

export default function ClientesPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { message, modal } = App.useApp();
  const { user } = useCurrentUser();
  const role = String((user as any)?.rol || "").toLowerCase();
  const isAdmin = ["administrador", "admin", "director", "administrativo"].includes(role);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formNuevo] = Form.useForm();
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const deferredSearch = useDeferredValue(search);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/perfiles?rol=cliente");
    const json = await res.json();
    setClientes(json.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() =>
    clientes.filter((c) => {
      const query = deferredSearch.trim().toLowerCase();
      if (!query) return true;

      return (
        c.nombre_completo.toLowerCase().includes(query) ||
        (c.cedula || "").includes(query) ||
        (c.telefono || "").includes(query) ||
        (c.telefono_2 || "").includes(query) ||
        (c.email || "").toLowerCase().includes(query)
      );
    }),
    [clientes, deferredSearch]
  );

  const estadisticas = useMemo(() => ({
    total: clientes.length,
    activos: clientes.filter((c) => c.activo !== false).length,
    puntosTotales: clientes.reduce((s, c) => s + (c.puntos_fidelidad || 0), 0),
    nivelOroPlus: clientes.filter((c) => ["oro", "diamante"].includes(c.nivel_fidelidad || "")).length,
  }), [clientes]);

  useEffect(() => {
    setSelectedClientIds((prev) => prev.filter((id) => clientes.some((c) => c.id === id)));
  }, [clientes]);

  const filtradosIds = useMemo(() => filtrados.map((c) => c.id), [filtrados]);
  const filtradosIdsSet = useMemo(() => new Set(filtradosIds), [filtradosIds]);
  const selectedCount = selectedClientIds.length;
  const selectedFiltradosCount = useMemo(
    () => selectedClientIds.filter((id) => filtradosIdsSet.has(id)).length,
    [filtradosIdsSet, selectedClientIds]
  );

  const crearCliente = async () => {
    try {
      const values = await formNuevo.validateFields();
      setGuardando(true);
      const datosParaGuardar = {
        nombre_completo: values.nombre_completo,
        cedula: values.cedula || null,
        telefono: values.telefono || null,
        telefono_2: values.telefono_2 || null,
        email: values.email || null,
        fecha_nacimiento: parseDiaMesToIso(values.cumple_dia_mes || ""),
      };
      const datosNormalizados = normalizarDatosFormulario(datosParaGuardar);
      const res = await fetch("/api/perfiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datosNormalizados),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al crear");
      message.success("✅ Cliente creado con 0 puntos iniciales");
      setCreando(false);
      formNuevo.resetFields();
      cargar();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : "Error al crear cliente");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarCliente = useCallback(async (cliente: Cliente) => {
    if (!isAdmin) {
      message.error("Solo el administrador puede eliminar clientes");
      return;
    }

    modal.confirm({
      title: "¿Eliminar cliente?",
      content: "Se eliminará el cliente y todas sus transacciones asociadas. Esta acción no se puede deshacer.",
      okText: "Eliminar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const res = await fetch(`/api/perfiles?id=${cliente.id}`, { method: "DELETE", headers: await authHeaders() });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "No se pudo eliminar el cliente");
          message.success("Cliente y transacciones eliminados");
          if (clienteSeleccionado?.id === cliente.id) {
            setClienteSeleccionado(null);
          }
          await cargar();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "Error al eliminar cliente");
        }
      },
    });
  }, [cargar, clienteSeleccionado?.id, isAdmin, message, modal]);

  const eliminarSeleccionados = useCallback(async () => {
    if (!isAdmin) {
      message.error("Solo el administrador puede eliminar clientes");
      return;
    }
    if (selectedCount === 0) {
      message.warning("Selecciona clientes para eliminar");
      return;
    }

    modal.confirm({
      title: `Eliminar ${selectedCount} cliente(s)`,
      content: "Se eliminarán clientes y transacciones asociadas. Esta acción no se puede deshacer.",
      okText: "Eliminar seleccionados",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const headers = await authHeaders();
          const results = await Promise.all(
            selectedClientIds.map(async (id) => {
              const res = await fetch(`/api/perfiles?id=${id}`, { method: "DELETE", headers });
              return res.ok;
            })
          );

          const okCount = results.filter(Boolean).length;
          const failCount = results.length - okCount;

          if (okCount > 0) message.success(`${okCount} cliente(s) eliminado(s)`);
          if (failCount > 0) message.warning(`${failCount} cliente(s) no se pudieron eliminar`);

          if (clienteSeleccionado?.id && selectedClientIds.includes(clienteSeleccionado.id)) {
            setClienteSeleccionado(null);
          }
          setSelectedClientIds([]);
          await cargar();
        } catch {
          message.error("Error al eliminar clientes en bloque");
        }
      },
    });
  }, [cargar, clienteSeleccionado?.id, isAdmin, message, modal, selectedClientIds, selectedCount]);

  const columns: ColumnsType<Cliente> = [
    {
      title: "Cliente",
      render: (_, r) => {
        const nivel = getNivel(r.puntos_fidelidad || 0);
        return (
          <Space>
            <Avatar size={36} style={{ background: nivel.color, flexShrink: 0 }}>{r.nombre_completo[0]?.toUpperCase()}</Avatar>
            <div>
              <Text strong style={{ fontSize: 13 }}>{r.nombre_completo}</Text>
              {r.email && <div><Text type="secondary" style={{ fontSize: 11 }}>{r.email}</Text></div>}
            </div>
          </Space>
        );
      },
    },
    {
      title: "Cédula",
      dataIndex: "cedula",
      width: 130,
      render: (c?: string) => c
        ? <Space size={4}><IdcardOutlined style={{ color: "#aaa" }} /><Text style={{ fontSize: 12 }}>{c}</Text></Space>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: "Teléfono",
      dataIndex: "telefono",
      width: 180,
      render: (_: string | undefined, r) => r.telefono || r.telefono_2
        ? (
          <div>
            {r.telefono && <Space size={4}><PhoneOutlined style={{ color: "#aaa" }} /><Text style={{ fontSize: 12 }}>{r.telefono}</Text></Space>}
            {r.telefono_2 && <div><Text type="secondary" style={{ fontSize: 11 }}>Alt: {r.telefono_2}</Text></div>}
          </div>
        )
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: "Nivel",
      dataIndex: "nivel_fidelidad",
      width: 110,
      render: (n?: string) => {
        const k = n || "bronce";
        return <Tag style={{ background: NIVEL_COLORS[k], color: "#fff", border: "none" }}>{NIVEL_ICONS[k]} {k.charAt(0).toUpperCase() + k.slice(1)}</Tag>;
      },
    },
    {
      title: "Puntos",
      dataIndex: "puntos_fidelidad",
      width: 100,
      sorter: (a, b) => (a.puntos_fidelidad || 0) - (b.puntos_fidelidad || 0),
      render: (p?: number) => <Text strong style={{ color: "#faad14" }}>⭐ {(p || 0).toLocaleString()}</Text>,
    },
    {
      title: "Estado",
      dataIndex: "activo",
      width: 90,
      render: (a?: boolean) => <Badge status={a !== false ? "success" : "error"} text={a !== false ? "Activo" : "Inactivo"} />,
    },
    {
      title: "",
      key: "ver",
      width: 110,
      render: (_: unknown, r) => (
        <Space>
          {isAdmin ? (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                eliminarCliente(r);
              }}
            />
          ) : null}
          <RightOutlined style={{ color: "#bbb" }} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space align="center">
            <Avatar size={40} style={{ background: "linear-gradient(135deg,#d81b87,#f5317f)" }} icon={<UserOutlined />} />
            <div>
              <Title level={4} style={{ margin: 0 }}>Clientes</Title>
              <Text type="secondary" style={{ fontSize: 12 }}>Haz clic en un cliente para ver sus detalles</Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
            <Button type="primary" icon={<PlusOutlined />}
              style={{ background: "#d81b87", borderColor: "#d81b87" }}
              onClick={() => { setCreando(true); formNuevo.resetFields(); }}>
              Nuevo cliente
            </Button>
          </Space>
        </Col>
      </Row>

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { title: "Total clientes", value: estadisticas.total, icon: "👥", color: "#d81b87" },
          { title: "Activos", value: estadisticas.activos, icon: "✅", color: "#52c41a" },
          { title: "Puntos emitidos", value: estadisticas.puntosTotales, icon: "⭐", color: "#faad14" },
          { title: "Oro & Diamante", value: estadisticas.nivelOroPlus, icon: "🏆", color: "#13c2c2" },
        ].map((k) => (
          <Col xs={12} sm={6} key={k.title}>
            <Card size="small" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22 }}>{k.icon}</div>
              <Statistic value={k.value} valueStyle={{ color: k.color, fontSize: 20 }} formatter={(v) => Number(v).toLocaleString()} />
              <Text type="secondary" style={{ fontSize: 11 }}>{k.title}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Buscador */}
      <div style={{ marginBottom: 12 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar por nombre, cédula, teléfono o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 400 }}
        />
      </div>

      <Space wrap size={[8, 8]} style={{ marginBottom: 12 }}>
        <Button
          size="small"
          onClick={() => setSelectedClientIds(filtradosIds)}
          disabled={filtradosIds.length === 0}
        >
          Seleccionar filtrados ({filtradosIds.length})
        </Button>
        <Button
          size="small"
          onClick={() => setSelectedClientIds((prev) => prev.filter((id) => !filtradosIdsSet.has(id)))}
          disabled={selectedFiltradosCount === 0}
        >
          Deseleccionar filtrados ({selectedFiltradosCount})
        </Button>
        <Button size="small" onClick={() => setSelectedClientIds([])} disabled={selectedCount === 0}>
          Limpiar selección
        </Button>
        {isAdmin ? (
          <Button size="small" danger onClick={eliminarSeleccionados} disabled={selectedCount === 0}>
            Eliminar seleccionados
          </Button>
        ) : null}
        {selectedCount > 0 ? <Tag color="blue">{selectedCount} seleccionado(s)</Tag> : null}
      </Space>

      {/* Tabla */}
      <Table
        dataSource={filtrados}
        columns={columns}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedClientIds,
          onChange: (keys) => setSelectedClientIds(keys as string[]),
          preserveSelectedRowKeys: true,
        }}
        loading={loading}
        size="small"
        virtual
        scroll={{ y: isMobile ? 420 : 560, x: 900 }}
        onRow={(r) => ({
          onClick: () => setClienteSeleccionado(r),
          style: { cursor: "pointer" },
        })}
        rowClassName={() => "cliente-row"}
        pagination={{ pageSize: 30, showSizeChanger: true, pageSizeOptions: [20, 30, 50, 100], showTotal: (t) => `${t} clientes` }}
        locale={{ emptyText: <Empty description="No hay clientes registrados" /> }}
      />

      {/* Drawer detalle */}
      <DrawerCliente
        cliente={clienteSeleccionado}
        onClose={() => setClienteSeleccionado(null)}
        onGuardado={() => { cargar(); }}
      />

      {/* Modal nuevo cliente */}
      <Modal
        open={creando}
        title={<Space><PlusOutlined style={{ color: "#d81b87" }} />Nuevo cliente</Space>}
        onCancel={() => setCreando(false)}
        footer={[
          <Button key="c" icon={<CloseOutlined />} onClick={() => setCreando(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<SaveOutlined />} loading={guardando} onClick={crearCliente}
            style={{ background: "#d81b87", borderColor: "#d81b87" }}>
            Crear cliente
          </Button>,
        ]}
        destroyOnClose
      >
        <Form form={formNuevo} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="nombre_completo" label="Nombre completo" rules={[{ required: true, message: "Campo obligatorio" }]}>
            <Input prefix={<UserOutlined />} placeholder="Ej: María García" autoFocus />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="cedula" label="Cédula" rules={[{ required: true, message: "La cédula es obligatoria — es uno de los accesos al portal Club" }, { pattern: /^\d{4,15}$/, message: "Solo dígitos, entre 4 y 15 caracteres" }]}>
                <Input prefix={<IdcardOutlined />} placeholder="1234567890" maxLength={15} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="telefono" label="Teléfono principal" rules={[{ required: true, message: "El teléfono es obligatorio" }, { pattern: /^\d{7,15}$/, message: "Solo dígitos, entre 7 y 15 caracteres" }]}>
                <Input prefix={<PhoneOutlined />} placeholder="3001234567" maxLength={15} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="telefono_2"
            label="Teléfono alterno"
            extra="También puede usarse para ingresar al Club si el cliente cambia o pierde su número principal."
            rules={[{ pattern: /^\d{7,15}$/, message: "Solo dígitos, entre 7 y 15 caracteres" }]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="3019876543" maxLength={15} />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input prefix={<MailOutlined />} placeholder="correo@ejemplo.com" />
          </Form.Item>
          <Form.Item
            name="cumple_dia_mes"
            label="Cumpleaños (día/mes)"
            getValueFromEvent={(e) => formatDiaMesInput(e?.target?.value)}
            rules={[
              { required: true, message: "El cumpleaños (día/mes) es obligatorio" },
              { pattern: /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])$/, message: "Usa formato DD/MM" },
            ]}
          >
            <Input
              placeholder="Ej: 07/11"
              maxLength={5}
              inputMode="numeric"
              onPressEnter={() => {
                const v = formNuevo.getFieldValue("cumple_dia_mes");
                if (typeof v === "string" && v.length === 5) crearCliente();
              }}
            />
          </Form.Item>
          <div style={{ background: "#fff7e6", border: "1px solid #ffe7ba", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
            <Text style={{ fontSize: 12 }}>🌟 El cliente iniciará con <strong>0 puntos</strong></Text>
          </div>
          <div style={{ background: "#f0f5ff", border: "1px solid #adc6ff", borderRadius: 8, padding: "10px 14px" }}>
            <Text style={{ fontSize: 12 }}>🔑 El cliente podrá entrar al <strong>Portal Club</strong> con su <strong>cédula</strong>, teléfono principal o teléfono alterno.</Text>
          </div>
        </Form>
      </Modal>

      <style>{`.cliente-row:hover td { background: #fff0f8 !important; }`}</style>
    </div>
  );
}
