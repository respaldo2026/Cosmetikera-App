"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card, Typography, Space, Tag, Spin, Row, Col, Statistic,
  Table, Empty, Grid, Button, Avatar, Tooltip, Progress,
  Divider, Badge, Modal, Input, Form, App, Tabs, InputNumber,
  Select, Alert, Popconfirm, Timeline,
} from "antd";
import {
  GiftOutlined, UserOutlined, SearchOutlined,
  ReloadOutlined, TrophyOutlined, StarOutlined,
  PlusOutlined, WhatsAppOutlined, ThunderboltOutlined,
  LockOutlined, MinusOutlined, HistoryOutlined, SettingOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const limpiarTelefono = (tel: string) => tel.replace(/\D/g, "");

type Cliente = {
  id: string;
  nombre_completo: string;
  telefono?: string;
  email?: string;
  cedula?: string;
  puntos_fidelidad?: number;
  puntos_canjeados?: number;
  puntos_ganados?: number;
  nivel_fidelidad?: string;
  fecha_nacimiento?: string;
  total_compras?: number;
  logros?: string[];
  racha_visitas?: number;
  fecha_ultima_visita?: string;
};

type PuntosLog = {
  id: string;
  tipo: string;
  puntos: number;
  concepto: string;
  created_at: string;
};

const NIVELES = [
  { key: "bronce",   label: "Bronce",   color: "#cd7f32", icon: "🥉", min: 0,     max: 999,      beneficios: ["Puntos en cada compra","Acceso al club"], descuento: 0 },
  { key: "plata",    label: "Plata",    color: "#8c8c8c", icon: "🥈", min: 1000,  max: 4999,     beneficios: ["5% descuento","Puntos dobles en cumpleaños","Ofertas exclusivas"], descuento: 5 },
  { key: "oro",      label: "Oro",      color: "#faad14", icon: "🥇", min: 5000,  max: 14999,    beneficios: ["10% descuento","Puntos dobles mes cumpleaños","Acceso anticipado","Regalo cumpleaños"], descuento: 10 },
  { key: "diamante", label: "Diamante", color: "#13c2c2", icon: "💎", min: 15000, max: Infinity, beneficios: ["15% descuento","Puntos triples cumpleaños","Atención VIP","Invitaciones exclusivas","Gift bag anual"], descuento: 15 },
];

const LOGROS_CATALOGO = [
  { key: "primera_compra",  emoji: "🌟", titulo: "Primera compra",       desc: "Realizó su primera compra",             meta: 1,       tipo: "compras"  },
  { key: "compradora_5",    emoji: "🛍️", titulo: "Compradora frecuente", desc: "5 compras realizadas",                  meta: 5,       tipo: "compras"  },
  { key: "compradora_10",   emoji: "👑", titulo: "Cliente fiel",          desc: "10 compras realizadas",                 meta: 10,      tipo: "compras"  },
  { key: "compradora_20",   emoji: "🏆", titulo: "Embajadora",            desc: "20 compras realizadas",                 meta: 20,      tipo: "compras"  },
  { key: "gasto_200k",      emoji: "💰", titulo: "$200.000 gastados",     desc: "Acumuló $200.000 en compras",           meta: 200000,  tipo: "monto"    },
  { key: "gasto_500k",      emoji: "💎", titulo: "$500.000 gastados",     desc: "Acumuló $500.000 en compras",           meta: 500000,  tipo: "monto"    },
  { key: "gasto_1m",        emoji: "🔮", titulo: "Club Millón",           desc: "Acumuló $1.000.000 en compras",         meta: 1000000, tipo: "monto"    },
  { key: "racha_3",         emoji: "🔥", titulo: "En racha x3",          desc: "3 meses seguidos comprando",            meta: 3,       tipo: "racha"    },
  { key: "racha_6",         emoji: "⚡", titulo: "Imparable x6",         desc: "6 meses seguidos comprando",            meta: 6,       tipo: "racha"    },
  { key: "nivel_plata",     emoji: "🥈", titulo: "Nivel Plata",          desc: "Alcanzó el nivel Plata",                meta: 1000,    tipo: "nivel"    },
  { key: "nivel_oro",       emoji: "🥇", titulo: "Nivel Oro",            desc: "Alcanzó el nivel Oro",                  meta: 5000,    tipo: "nivel"    },
  { key: "nivel_diamante",  emoji: "💍", titulo: "Diamante",             desc: "Nivel máximo alcanzado",                meta: 15000,   tipo: "nivel"    },
  { key: "cumpleanos",      emoji: "🎂", titulo: "Cumpleañera VIP",      desc: "Compró en su mes de cumpleaños",        meta: 1,       tipo: "especial" },
  { key: "canje_1",         emoji: "🎁", titulo: "Primer canje",         desc: "Canjeó puntos por primera vez",         meta: 1,       tipo: "canje"    },
];

function getNivel(puntos: number) {
  return NIVELES.findLast((n) => puntos >= n.min) ?? NIVELES[0]!;
}

function getProgreso(puntos: number) {
  const actual = getNivel(puntos);
  const idx = NIVELES.indexOf(actual);
  if (idx >= NIVELES.length - 1) return null;
  const sig = NIVELES[idx + 1]!;
  const pct = Math.min(100, Math.round(((puntos - actual.min) / (sig.min - actual.min)) * 100));
  return { siguiente: sig, pct, faltantes: sig.min - puntos };
}

function calcularLogros(c: Cliente): string[] {
  const logros: string[] = [];
  const puntos = c.puntos_fidelidad || 0;
  const compras = c.total_compras || 0;
  const racha = c.racha_visitas || 0;
  if (compras >= 1)  logros.push("primera_compra");
  if (compras >= 5)  logros.push("compradora_5");
  if (compras >= 10) logros.push("compradora_10");
  if (compras >= 20) logros.push("compradora_20");
  if (puntos >= 1000)  logros.push("nivel_plata");
  if (puntos >= 5000)  logros.push("nivel_oro");
  if (puntos >= 15000) logros.push("nivel_diamante");
  if (racha >= 3) logros.push("racha_3");
  if (racha >= 6) logros.push("racha_6");
  if (c.logros) logros.push(...c.logros.filter((l: string) => !logros.includes(l)));
  return [...new Set(logros)];
}

function TarjetaNivel({ nivel, puntos, nombre }: { nivel: typeof NIVELES[0]; puntos: number; nombre?: string }) {
  const prog = getProgreso(puntos);
  return (
    <div style={{ background: `linear-gradient(135deg, ${nivel.color}22, ${nivel.color}44)`, border: `2px solid ${nivel.color}`, borderRadius: 16, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: 16, top: 16, fontSize: 48, opacity: 0.2 }}>{nivel.icon}</div>
      <Space direction="vertical" size={4}>
        {nombre && <Text strong style={{ fontSize: 16 }}>{nombre}</Text>}
        <Tag style={{ background: nivel.color, color: "#fff", border: "none", fontSize: 14, padding: "2px 12px" }}>{nivel.icon} {nivel.label}</Tag>
        <Text style={{ fontSize: 28, fontWeight: 800, color: nivel.color }}>⭐ {puntos.toLocaleString()} pts</Text>
        {prog ? (
          <div style={{ width: "100%" }}>
            <Row justify="space-between" style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: "#666" }}>→ {prog.siguiente.icon} {prog.siguiente.label}</Text>
              <Text style={{ fontSize: 11, color: "#666" }}>faltan {prog.faltantes.toLocaleString()} pts</Text>
            </Row>
            <Progress percent={prog.pct} strokeColor={{ "0%": nivel.color, "100%": prog.siguiente.color }} showInfo={false} />
          </div>
        ) : <Tag color="#13c2c2">💎 ¡Nivel máximo!</Tag>}
      </Space>
    </div>
  );
}

function BadgeLogro({ logroKey, desbloqueado }: { logroKey: string; desbloqueado: boolean }) {
  const logro = LOGROS_CATALOGO.find((l) => l.key === logroKey);
  if (!logro) return null;
  return (
    <Tooltip title={`${logro.titulo}: ${logro.desc}`}>
      <div style={{ textAlign: "center", opacity: desbloqueado ? 1 : 0.3, filter: desbloqueado ? "none" : "grayscale(100%)", cursor: "pointer" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 4px", background: desbloqueado ? "linear-gradient(135deg,#fff7e6,#ffe7ba)" : "#f0f0f0", border: `2px solid ${desbloqueado ? "#faad14" : "#d9d9d9"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: desbloqueado ? "0 2px 8px rgba(250,173,20,0.4)" : "none" }}>
          {desbloqueado ? logro.emoji : <LockOutlined style={{ fontSize: 20, color: "#bbb" }} />}
        </div>
        <Text style={{ fontSize: 10, display: "block", maxWidth: 64, color: desbloqueado ? "#333" : "#bbb" }}>{logro.titulo}</Text>
      </div>
    </Tooltip>
  );
}

function TabDashboard({ clientes, loading }: { clientes: Cliente[]; loading: boolean }) {
  const totalPuntos = clientes.reduce((s, c) => s + (c.puntos_fidelidad || 0), 0);
  const totalCanjeados = clientes.reduce((s, c) => s + (c.puntos_canjeados || 0), 0);
  const cumpleaniosHoy = clientes.filter((c) => {
    if (!c.fecha_nacimiento) return false;
    const hoy = dayjs(); const d = dayjs(c.fecha_nacimiento);
    return d.month() === hoy.month() && d.date() === hoy.date();
  });
  const cumpleaniosMes = clientes.filter((c) => {
    if (!c.fecha_nacimiento) return false;
    return dayjs(c.fecha_nacimiento).month() === dayjs().month();
  });
  const nivelResumen = NIVELES.map((n) => ({ ...n, count: clientes.filter((c) => getNivel(c.puntos_fidelidad || 0).key === n.key).length }));

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { title: "Total clientes", value: clientes.length, icon: "👥", color: "#d81b87" },
          { title: "Puntos activos", value: totalPuntos, icon: "⭐", color: "#faad14" },
          { title: "Puntos canjeados", value: totalCanjeados, icon: "🎁", color: "#52c41a" },
          { title: "Nivel Oro+", value: nivelResumen.filter((n) => ["oro","diamante"].includes(n.key)).reduce((s, n) => s + n.count, 0), icon: "🏆", color: "#13c2c2" },
        ].map((k) => (
          <Col xs={12} sm={6} key={k.title}>
            <Card size="small" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{k.icon}</div>
              <Statistic value={k.value} valueStyle={{ color: k.color, fontSize: 22 }} formatter={(v) => Number(v).toLocaleString()} />
              <Text type="secondary" style={{ fontSize: 11 }}>{k.title}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {nivelResumen.map((n) => (
          <Col xs={12} sm={6} key={n.key}>
            <Card size="small" style={{ borderTop: `4px solid ${n.color}`, textAlign: "center" }} bodyStyle={{ padding: "12px 8px" }}>
              <div style={{ fontSize: 32 }}>{n.icon}</div>
              <Text strong style={{ color: n.color, display: "block" }}>{n.label}</Text>
              <Text style={{ fontSize: 26, fontWeight: 800, color: n.color }}>{n.count}</Text>
              <Text type="secondary" style={{ fontSize: 11, display: "block" }}>clientes</Text>
              {n.descuento > 0 && <Tag style={{ marginTop: 4, background: n.color, color: "#fff", border: "none" }}>{n.descuento}% dto.</Tag>}
              <div style={{ marginTop: 6 }}>
                {n.beneficios.slice(0, 2).map((b) => <Text key={b} type="secondary" style={{ fontSize: 10, display: "block" }}>✓ {b}</Text>)}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {cumpleaniosHoy.length > 0 && (
        <Alert style={{ marginBottom: 12, borderRadius: 10 }} type="success" icon={<span style={{ fontSize: 22 }}>🎂</span>} showIcon
          message={<Text strong>¡Cumpleaños hoy!</Text>}
          description={<Space wrap>{cumpleaniosHoy.map((c) => (
            <Tag key={c.id} color="pink" style={{ fontSize: 13, padding: "2px 10px" }}>
              🎉 {c.nombre_completo}
              {c.telefono && <Button size="small" type="link" style={{ color: "#25D366", padding: "0 4px" }} icon={<span>📱</span>}
                onClick={() => window.open(`https://wa.me/57${limpiarTelefono(c.telefono || "")}?text=¡Hola ${c.nombre_completo}! 🎂 ¡Feliz cumpleaños! Tienes puntos dobles en tu próxima compra 🎁`, "_blank")} />}
            </Tag>
          ))}</Space>}
        />
      )}

      {cumpleaniosMes.length > 0 && (
        <Alert style={{ marginBottom: 16, borderRadius: 10 }} type="info" showIcon icon={<span>🎂</span>}
          message={<Text><strong>{cumpleaniosMes.length} cliente(s)</strong> cumplen años este mes — tienen puntos dobles activos</Text>}
          description={<Space wrap style={{ marginTop: 4 }}>{cumpleaniosMes.map((c) => <Tag key={c.id} style={{ margin: 2 }}>{c.nombre_completo} ({dayjs(c.fecha_nacimiento).format("D MMM")})</Tag>)}</Space>}
        />
      )}

      <Card title={<Space><SettingOutlined />Reglas del programa</Space>} size="small">
        <Row gutter={[16, 8]}>
          {[
            { icon: "💵", title: "$1.000 = 1 punto", desc: "Por cada $1.000 COP gastado ganas 1 punto" },
            { icon: "🎂", title: "Puntos dobles en cumpleaños", desc: "El mes de tu cumpleaños acumulas el doble" },
            { icon: "🎁", title: "100 pts = $5.000 COP", desc: "Canjea tus puntos como descuento" },
            { icon: "🌟", title: "50 pts de bienvenida", desc: "Puntos gratis al registrarte" },
            { icon: "🔥", title: "Rachas de visitas", desc: "3 meses seguidos: +400 pts bonus" },
            { icon: "🤝", title: "Refiere a una amiga", desc: "+300 pts cuando tu referida compre por primera vez" },
          ].map((r) => (
            <Col xs={24} sm={12} md={8} key={r.title}>
              <Space align="start">
                <span style={{ fontSize: 22 }}>{r.icon}</span>
                <div>
                  <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
                  <Text type="secondary" style={{ fontSize: 11, display: "block" }}>{r.desc}</Text>
                </div>
              </Space>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}

function TabRanking({ clientes, loading, onRecargar }: { clientes: Cliente[]; loading: boolean; onRecargar: () => void }) {
  const { message } = App.useApp();
  const [search, setSearch] = useState("");
  const [filtroNivel, setFiltroNivel] = useState<string | null>(null);
  const [modalCliente, setModalCliente] = useState<Cliente | null>(null);
  const [puntos, setPuntos] = useState<number>(0);
  const [concepto, setConcepto] = useState("Ajuste manual");
  const [guardando, setGuardando] = useState(false);

  const filtrados = useMemo(() =>
    clientes.filter((c) => {
      const ok = !search || c.nombre_completo.toLowerCase().includes(search.toLowerCase()) || (c.cedula || "").includes(search);
      const okNivel = !filtroNivel || getNivel(c.puntos_fidelidad || 0).key === filtroNivel;
      return ok && okNivel;
    }).sort((a, b) => (b.puntos_fidelidad || 0) - (a.puntos_fidelidad || 0)),
    [clientes, search, filtroNivel]);

  const aplicarPuntos = async () => {
    if (!modalCliente || puntos === 0) return;
    setGuardando(true);
    try {
      const actuales = modalCliente.puntos_fidelidad || 0;
      const nuevos = Math.max(0, actuales + puntos);
      const nivelAnterior = getNivel(actuales).key;
      const nivelNuevo = getNivel(nuevos);
      const { error } = await supabaseBrowserClient.from("perfiles").update({ puntos_fidelidad: nuevos, nivel_fidelidad: nivelNuevo.key }).eq("id", modalCliente.id);
      if (error) throw error;
      await supabaseBrowserClient.from("puntos_historial").insert({ perfil_id: modalCliente.id, tipo: puntos > 0 ? "bonificacion" : "ajuste", puntos, concepto }).catch(() => {});
      message.success(`${puntos > 0 ? "+" : ""}${puntos} puntos aplicados`);
      if (nivelAnterior !== nivelNuevo.key) message.success(`🎉 ¡Subió a nivel ${nivelNuevo.label}!`);
      setModalCliente(null);
      onRecargar();
    } catch { message.error("Error al aplicar puntos"); }
    finally { setGuardando(false); }
  };

  const columns: ColumnsType<Cliente> = [
    { title: "#", width: 52, render: (_: unknown, __: Cliente, i: number) => <Text strong style={{ fontSize: 18, color: i === 0 ? "#faad14" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "#888" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</Text> },
    {
      title: "Cliente",
      render: (_: unknown, c: Cliente) => {
        const nivel = getNivel(c.puntos_fidelidad || 0);
        const esCumple = c.fecha_nacimiento && dayjs(c.fecha_nacimiento).month() === dayjs().month();
        const logros = calcularLogros(c);
        return (
          <Space>
            <Avatar size={40} style={{ background: nivel.color }}>{c.nombre_completo[0]?.toUpperCase()}</Avatar>
            <div>
              <Space size={4}><Text strong>{c.nombre_completo}</Text>{esCumple && <Tag color="pink" style={{ fontSize: 10 }}>🎂</Tag>}</Space>
              <div style={{ marginTop: 2 }}>
                <Tag style={{ background: nivel.color, color: "#fff", border: "none", fontSize: 10 }}>{nivel.icon} {nivel.label}</Tag>
                {logros.slice(0, 3).map((l) => { const info = LOGROS_CATALOGO.find((x) => x.key === l); return info ? <Tooltip key={l} title={info.titulo}><span style={{ fontSize: 14 }}>{info.emoji}</span></Tooltip> : null; })}
                {logros.length > 3 && <Text type="secondary" style={{ fontSize: 10 }}>+{logros.length - 3}</Text>}
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: "Puntos",
      width: 200,
      render: (_: unknown, c: Cliente) => {
        const pts = c.puntos_fidelidad || 0; const prog = getProgreso(pts);
        return (
          <div>
            <Text strong style={{ color: "#faad14", fontSize: 16 }}>⭐ {pts.toLocaleString()}</Text>
            {prog ? <Tooltip title={`${prog.faltantes.toLocaleString()} pts para ${prog.siguiente.icon} ${prog.siguiente.label}`}><Progress percent={prog.pct} size="small" strokeColor={prog.siguiente.color} showInfo={false} style={{ marginTop: 2 }} /></Tooltip> : <Tag color="#13c2c2" style={{ marginTop: 2, fontSize: 10 }}>💎 Nivel máximo</Tag>}
          </div>
        );
      },
    },
    { title: "Racha", dataIndex: "racha_visitas", width: 80, render: (r?: number) => r && r > 0 ? <Tag color={r >= 6 ? "purple" : r >= 3 ? "orange" : "default"}>{r >= 3 ? "🔥" : "📅"} {r}m</Tag> : <Text type="secondary">—</Text> },
    {
      title: "", width: 100,
      render: (_: unknown, c: Cliente) => (
        <Space>
          <Tooltip title="Gestionar puntos"><Button size="small" type="primary" icon={<StarOutlined />} style={{ background: "#faad14", borderColor: "#faad14" }} onClick={() => { setModalCliente(c); setPuntos(0); setConcepto("Ajuste manual"); }} /></Tooltip>
          {c.telefono && <Tooltip title="WhatsApp"><Button size="small" icon={<span>📱</span>} style={{ color: "#25D366", borderColor: "#25D366" }} onClick={() => window.open(`https://wa.me/57${limpiarTelefono(c.telefono || "")}`, "_blank")} /></Tooltip>}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col flex="auto"><Input prefix={<SearchOutlined />} placeholder="Nombre o cédula..." value={search} onChange={(e) => setSearch(e.target.value)} allowClear /></Col>
        <Col><Select placeholder="Nivel" allowClear value={filtroNivel} onChange={setFiltroNivel} style={{ width: 130 }} options={NIVELES.map((n) => ({ value: n.key, label: `${n.icon} ${n.label}` }))} /></Col>
        <Col><Button icon={<ReloadOutlined />} onClick={onRecargar} loading={loading} /></Col>
      </Row>
      <Table dataSource={filtrados} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20, showTotal: (t) => `${t} clientes` }} locale={{ emptyText: <Empty description="Sin clientes" /> }} />
      <Modal open={!!modalCliente} title={<Space><StarOutlined style={{ color: "#faad14" }} />Gestionar puntos — {modalCliente?.nombre_completo}</Space>} onCancel={() => setModalCliente(null)} footer={null} width={420}>
        {modalCliente && (
          <div>
            <TarjetaNivel nivel={getNivel(modalCliente.puntos_fidelidad || 0)} puntos={modalCliente.puntos_fidelidad || 0} />
            <Divider />
            <Form layout="vertical">
              <Form.Item label="Puntos (+ agregar / - descontar)">
                <InputNumber style={{ width: "100%" }} value={puntos} onChange={(v) => setPuntos(v || 0)} addonBefore={puntos >= 0 ? <PlusOutlined style={{ color: "#52c41a" }} /> : <MinusOutlined style={{ color: "#ff4d4f" }} />} />
              </Form.Item>
              <Form.Item label="Concepto">
                <Select value={concepto} onChange={setConcepto} style={{ width: "100%" }} options={[
                  { value: "Compra en tienda", label: "🛍️ Compra en tienda" },
                  { value: "Bonificación especial", label: "🎁 Bonificación especial" },
                  { value: "Premio cumpleaños", label: "🎂 Premio cumpleaños" },
                  { value: "Puntos de bienvenida", label: "🌟 Puntos de bienvenida" },
                  { value: "Racha de visitas", label: "🔥 Racha de visitas" },
                  { value: "Referido", label: "🤝 Referido" },
                  { value: "Ajuste manual", label: "⚙️ Ajuste manual" },
                ]} />
              </Form.Item>
              <Button type="primary" block loading={guardando} onClick={aplicarPuntos} disabled={puntos === 0} style={{ background: "#d81b87", borderColor: "#d81b87" }}>
                Aplicar {puntos > 0 ? `+${puntos}` : puntos} puntos
              </Button>
            </Form>
          </div>
        )}
      </Modal>
    </>
  );
}

function TabLogros({ clientes }: { clientes: Cliente[] }) {
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [historial, setHistorial] = useState<PuntosLog[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const logrosDesbloqueados = cliente ? calcularLogros(cliente) : [];

  useEffect(() => {
    if (!clienteId) return;
    setLoadingHist(true);
    supabaseBrowserClient.from("puntos_historial").select("id,tipo,puntos,concepto,created_at").eq("perfil_id", clienteId).order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => { setHistorial(data || []); setLoadingHist(false); });
  }, [clienteId]);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card size="small" title={<Space><span>👤</span>Seleccionar cliente</Space>}>
          <Select showSearch optionFilterProp="label" style={{ width: "100%", marginBottom: 16 }} placeholder="Buscar cliente..." value={clienteId} onChange={setClienteId} options={clientes.map((c) => ({ value: c.id, label: `${c.nombre_completo} — ⭐${c.puntos_fidelidad || 0}` }))} />
          {cliente && <TarjetaNivel nivel={getNivel(cliente.puntos_fidelidad || 0)} puntos={cliente.puntos_fidelidad || 0} nombre={cliente.nombre_completo} />}
        </Card>
        {clienteId && (
          <Card size="small" title={<Space><HistoryOutlined />Historial de puntos</Space>} style={{ marginTop: 12 }}>
            {loadingHist ? <Spin /> : historial.length === 0 ? <Empty description="Sin historial" /> : (
              <Timeline items={historial.slice(0, 10).map((h) => ({ color: h.puntos > 0 ? "green" : "red", children: (<div><Space><Tag color={h.puntos > 0 ? "success" : "error"}>{h.puntos > 0 ? "+" : ""}{h.puntos} pts</Tag><Text style={{ fontSize: 12 }}>{h.concepto}</Text></Space><Text type="secondary" style={{ fontSize: 11, display: "block" }}>{dayjs(h.created_at).format("DD/MM/YYYY HH:mm")}</Text></div>) }))} />
            )}
          </Card>
        )}
      </Col>
      <Col xs={24} md={14}>
        <Card size="small" title={<Space><TrophyOutlined style={{ color: "#faad14" }} />Logros y medallas</Space>}>
          {!cliente ? <Empty description="Selecciona un cliente para ver sus logros" /> : (
            <>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>{logrosDesbloqueados.length} de {LOGROS_CATALOGO.length} logros desbloqueados</Text>
              <Progress percent={Math.round((logrosDesbloqueados.length / LOGROS_CATALOGO.length) * 100)} strokeColor={{ "0%": "#d81b87", "100%": "#faad14" }} style={{ marginBottom: 20 }} />
              <Row gutter={[12, 16]}>
                {LOGROS_CATALOGO.map((logro) => (
                  <Col key={logro.key} span={6}><BadgeLogro logroKey={logro.key} desbloqueado={logrosDesbloqueados.includes(logro.key)} /></Col>
                ))}
              </Row>
            </>
          )}
        </Card>
      </Col>
    </Row>
  );
}

function TabCanje({ clientes, onRecargar }: { clientes: Cliente[]; onRecargar: () => void }) {
  const { message } = App.useApp();
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [puntosACanjear, setPuntosACanjear] = useState<number>(100);
  const [canjeando, setCanjeando] = useState(false);
  const [canjes, setCanjes] = useState<{ id: string; puntos: number; valor_cop: number; descripcion: string; created_at: string }[]>([]);
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const disponibles = cliente?.puntos_fidelidad || 0;
  const valorDescuento = Math.floor(puntosACanjear / 100) * 5000;

  useEffect(() => {
    if (!clienteId) return;
    supabaseBrowserClient.from("canjes").select("id,puntos,valor_cop,descripcion,created_at").eq("perfil_id", clienteId).order("created_at", { ascending: false }).limit(10).then(({ data }) => setCanjes(data || []));
  }, [clienteId]);

  const canjear = async () => {
    if (!cliente || puntosACanjear < 100 || puntosACanjear > disponibles) return;
    setCanjeando(true);
    try {
      const nuevos = disponibles - puntosACanjear;
      const nivel = getNivel(nuevos);
      const { error } = await supabaseBrowserClient.from("perfiles").update({ puntos_fidelidad: nuevos, nivel_fidelidad: nivel.key, puntos_canjeados: (cliente.puntos_canjeados || 0) + puntosACanjear }).eq("id", cliente.id);
      if (error) throw error;
      await supabaseBrowserClient.from("canjes").insert({ perfil_id: cliente.id, puntos: puntosACanjear, valor_cop: valorDescuento, descripcion: `Canje ${puntosACanjear} pts = $${valorDescuento.toLocaleString()}`, estado: "aplicado" }).catch(() => {});
      await supabaseBrowserClient.from("puntos_historial").insert({ perfil_id: cliente.id, tipo: "canjeados", puntos: -puntosACanjear, concepto: `Canje por $${valorDescuento.toLocaleString()} de descuento` }).catch(() => {});
      message.success(`🎁 Canje exitoso: -${puntosACanjear} pts = $${valorDescuento.toLocaleString()}`);
      setPuntosACanjear(100);
      onRecargar();
    } catch { message.error("Error al canjear"); }
    finally { setCanjeando(false); }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card size="small" title={<Space><GiftOutlined />Canjear puntos</Space>}>
          <Form layout="vertical">
            <Form.Item label="Cliente">
              <Select showSearch optionFilterProp="label" placeholder="Buscar cliente..." value={clienteId} onChange={setClienteId} style={{ width: "100%" }} options={clientes.map((c) => ({ value: c.id, label: `${c.nombre_completo} — ⭐${c.puntos_fidelidad || 0} pts` }))} />
            </Form.Item>
            {cliente && (
              <>
                <TarjetaNivel nivel={getNivel(disponibles)} puntos={disponibles} />
                <Divider />
                <Form.Item label="Puntos a canjear (mínimo 100)">
                  <InputNumber style={{ width: "100%" }} min={100} max={disponibles} step={100} value={puntosACanjear} onChange={(v) => setPuntosACanjear(v || 100)} />
                </Form.Item>
                <Card size="small" style={{ background: "#f6ffed", border: "1px solid #b7eb8f", marginBottom: 12 }}>
                  <Row justify="space-between"><Text>Puntos a usar:</Text><Text strong style={{ color: "#ff4d4f" }}>−{puntosACanjear} pts</Text></Row>
                  <Row justify="space-between"><Text>Descuento:</Text><Text strong style={{ color: "#52c41a", fontSize: 18 }}>${valorDescuento.toLocaleString()}</Text></Row>
                  <Row justify="space-between"><Text type="secondary" style={{ fontSize: 11 }}>Quedarán:</Text><Text type="secondary" style={{ fontSize: 11 }}>{(disponibles - puntosACanjear).toLocaleString()} pts</Text></Row>
                </Card>
                <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 12 }}>100 puntos = $5.000 COP de descuento</Text>
                <Popconfirm title={`¿Canjear ${puntosACanjear} pts por $${valorDescuento.toLocaleString()} de descuento?`} onConfirm={canjear} okText="Sí, canjear" cancelText="Cancelar">
                  <Button type="primary" block loading={canjeando} disabled={puntosACanjear < 100 || puntosACanjear > disponibles} style={{ background: "#d81b87", borderColor: "#d81b87" }} icon={<GiftOutlined />}>Aplicar canje</Button>
                </Popconfirm>
              </>
            )}
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small" title={<Space><HistoryOutlined />Últimos canjes</Space>}>
          {!clienteId ? <Empty description="Selecciona un cliente" /> : canjes.length === 0 ? <Empty description="Sin canjes registrados" /> : (
            <Timeline items={canjes.map((c) => ({ color: "green", children: (<div><Space><Tag color="success">−{c.puntos} pts</Tag><Text strong style={{ color: "#52c41a" }}>${Number(c.valor_cop).toLocaleString()}</Text></Space><Text type="secondary" style={{ fontSize: 11, display: "block" }}>{dayjs(c.created_at).format("DD/MM/YYYY HH:mm")}</Text></div>) }))} />
          )}
        </Card>
      </Col>
    </Row>
  );
}

export default function FidelizacionPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabaseBrowserClient.from("perfiles")
      .select("id,nombre_completo,telefono,email,cedula,puntos_fidelidad,puntos_canjeados,puntos_ganados,nivel_fidelidad,fecha_nacimiento,total_compras,logros,racha_visitas,fecha_ultima_visita")
      .eq("rol", "cliente").order("puntos_fidelidad", { ascending: false });
    setClientes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      <Card style={{ marginBottom: 20, borderRadius: 12 }} bodyStyle={{ padding: "14px 20px" }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space align="center">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#faad14,#d81b87)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <GiftOutlined style={{ color: "#fff", fontSize: 24 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>Club de Fidelización</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Puntos · Niveles · Logros · Canjes · La Cosmetikera</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<UserOutlined />} onClick={() => window.open("/club", "_blank")}>Portal cliente</Button>
              <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
            </Space>
          </Col>
        </Row>
      </Card>

      <Card bodyStyle={{ paddingTop: 0 }}>
        <Tabs activeKey={tab} onChange={setTab} size={isMobile ? "small" : "middle"} items={[
          { key: "dashboard", label: <Space><ThunderboltOutlined />Resumen</Space>, children: <TabDashboard clientes={clientes} loading={loading} /> },
          { key: "ranking",   label: <Space><TrophyOutlined />Ranking</Space>,       children: <TabRanking clientes={clientes} loading={loading} onRecargar={cargar} /> },
          { key: "logros",    label: <Space><StarOutlined />Logros</Space>,           children: <TabLogros clientes={clientes} /> },
          { key: "canje",     label: <Space><GiftOutlined />Canje</Space>,            children: <TabCanje clientes={clientes} onRecargar={cargar} /> },
        ]} />
      </Card>
    </div>
  );
}
