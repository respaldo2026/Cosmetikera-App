"use client";

import React, { useState } from "react";
import {
  Card, Typography, Space, Tag, Spin, Row, Col, Statistic,
  Input, Button, Avatar, Tooltip, Progress, Divider, Timeline,
  Empty, Alert, Form,
} from "antd";
import {
  SearchOutlined, GiftOutlined, TrophyOutlined, StarOutlined,
  LockOutlined, PhoneOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

type Cliente = {
  id: string;
  nombre_completo: string;
  telefono?: string;
  cedula?: string;
  puntos_fidelidad?: number;
  puntos_canjeados?: number;
  nivel_fidelidad?: string;
  fecha_nacimiento?: string;
  total_compras?: number;
  logros?: string[];
  racha_visitas?: number;
};

type PuntosLog = {
  id: string;
  tipo: string;
  puntos: number;
  concepto: string;
  created_at: string;
};

const NIVELES = [
  { key: "bronce",   label: "Bronce",   color: "#cd7f32", icon: "🥉", min: 0,     max: 999,      beneficios: ["Puntos en cada compra", "Acceso al club"], descuento: 0 },
  { key: "plata",    label: "Plata",    color: "#8c8c8c", icon: "🥈", min: 1000,  max: 4999,     beneficios: ["5% descuento", "Puntos dobles en cumpleaños", "Ofertas exclusivas"], descuento: 5 },
  { key: "oro",      label: "Oro",      color: "#faad14", icon: "🥇", min: 5000,  max: 14999,    beneficios: ["10% descuento", "Puntos dobles mes cumpleaños", "Acceso anticipado", "Regalo cumpleaños"], descuento: 10 },
  { key: "diamante", label: "Diamante", color: "#13c2c2", icon: "💎", min: 15000, max: Infinity, beneficios: ["15% descuento", "Puntos triples cumpleaños", "Atención VIP", "Invitaciones exclusivas", "Gift bag anual"], descuento: 15 },
];

const LOGROS_CATALOGO = [
  { key: "primera_compra",  emoji: "🌟", titulo: "Primera compra",       desc: "Realizó su primera compra" },
  { key: "compradora_5",    emoji: "🛍️", titulo: "Compradora frecuente", desc: "5 compras realizadas" },
  { key: "compradora_10",   emoji: "👑", titulo: "Cliente fiel",          desc: "10 compras realizadas" },
  { key: "compradora_20",   emoji: "🏆", titulo: "Embajadora",            desc: "20 compras realizadas" },
  { key: "gasto_200k",      emoji: "💰", titulo: "$200.000 gastados",     desc: "Acumuló $200.000 en compras" },
  { key: "gasto_500k",      emoji: "💎", titulo: "$500.000 gastados",     desc: "Acumuló $500.000 en compras" },
  { key: "gasto_1m",        emoji: "🔮", titulo: "Club Millón",           desc: "Acumuló $1.000.000 en compras" },
  { key: "racha_3",         emoji: "🔥", titulo: "En racha x3",          desc: "3 meses seguidos comprando" },
  { key: "racha_6",         emoji: "⚡", titulo: "Imparable x6",         desc: "6 meses seguidos comprando" },
  { key: "nivel_plata",     emoji: "🥈", titulo: "Nivel Plata",          desc: "Alcanzó el nivel Plata" },
  { key: "nivel_oro",       emoji: "🥇", titulo: "Nivel Oro",            desc: "Alcanzó el nivel Oro" },
  { key: "nivel_diamante",  emoji: "💍", titulo: "Diamante",             desc: "Nivel máximo alcanzado" },
  { key: "cumpleanos",      emoji: "🎂", titulo: "Cumpleañera VIP",      desc: "Compró en su mes de cumpleaños" },
  { key: "canje_1",         emoji: "🎁", titulo: "Primer canje",         desc: "Canjeó puntos por primera vez" },
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
  if (c.logros) logros.push(...c.logros.filter((l) => !logros.includes(l)));
  return [...new Set(logros)];
}

export default function ClubPage() {
  const [cedula, setCedula] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [historial, setHistorial] = useState<PuntosLog[]>([]);
  const [error, setError] = useState("");

  const buscar = async () => {
    const val = cedula.trim().replace(/\D/g, "");
    if (!val) return;
    setBuscando(true);
    setCliente(null);
    setHistorial([]);
    setError("");

    try {
      const res = await fetch(`/api/club?cedula=${encodeURIComponent(val)}`);
      const json = await res.json();

      if (res.status === 404 || !json.data) {
        setError("No encontramos una cuenta con esa cédula. Verifica el número o visítanos en tienda.");
        setBuscando(false);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Error");

      setCliente(json.data);

      // Cargar historial de puntos
      const histRes = await fetch("/api/club", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil_id: json.data.id }),
      });
      const histJson = await histRes.json();
      setHistorial(histJson.data || []);
    } catch {
      setError("Error al conectar. Intenta nuevamente.");
    } finally {
      setBuscando(false);
    }
  };

  const nivel = cliente ? getNivel(cliente.puntos_fidelidad || 0) : null;
  const prog = cliente ? getProgreso(cliente.puntos_fidelidad || 0) : null;
  const logros = cliente ? calcularLogros(cliente) : [];
  const esCumple = cliente?.fecha_nacimiento && dayjs(cliente.fecha_nacimiento).month() === dayjs().month();

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fff0f8 0%, #f9f0ff 50%, #fffbe6 100%)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,#faad14,#d81b87)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 4px 20px rgba(216,27,135,0.3)" }}>
          <GiftOutlined style={{ color: "#fff", fontSize: 34 }} />
        </div>
        <Title level={2} style={{ margin: 0, color: "#d81b87" }}>Club La Cosmetikera</Title>
        <Text type="secondary">Tu portal de puntos y beneficios</Text>
      </div>

      {/* Buscador */}
      <Card style={{ width: "100%", maxWidth: 480, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 24 }}>
        <Title level={5} style={{ marginTop: 0 }}>Consulta tu saldo de puntos</Title>
        <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 16 }}>Ingresa tu número de cédula para ver tu perfil</Text>
        <Form onFinish={buscar}>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              prefix={<SearchOutlined style={{ color: "#d81b87" }} />}
              placeholder="Ej: 1234567890"
              value={cedula}
              onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
              size="large"
              maxLength={12}
            />
            <Button
              type="primary"
              size="large"
              loading={buscando}
              onClick={buscar}
              style={{ background: "#d81b87", borderColor: "#d81b87" }}
            >
              Buscar
            </Button>
          </Space.Compact>
        </Form>
        {error && <Alert type="warning" message={error} showIcon style={{ marginTop: 12, borderRadius: 8 }} />}
      </Card>

      {buscando && <Spin size="large" style={{ margin: "32px 0" }} />}

      {/* Perfil del cliente */}
      {cliente && nivel && (
        <div style={{ width: "100%", maxWidth: 680 }}>
          {/* Tarjeta principal */}
          <Card style={{ borderRadius: 16, marginBottom: 16, background: `linear-gradient(135deg, ${nivel.color}18, ${nivel.color}30)`, border: `2px solid ${nivel.color}` }}>
            <Row align="middle" gutter={16}>
              <Col>
                <Avatar size={64} style={{ background: nivel.color, fontSize: 26 }}>{cliente.nombre_completo[0]?.toUpperCase()}</Avatar>
              </Col>
              <Col flex="auto">
                <Space direction="vertical" size={2}>
                  <Space>
                    <Title level={4} style={{ margin: 0 }}>{cliente.nombre_completo}</Title>
                    {esCumple && <Tag color="pink">🎂 ¡Mes de cumpleaños!</Tag>}
                  </Space>
                  {cliente.cedula && <Text type="secondary" style={{ fontSize: 12 }}>CC: {cliente.cedula}</Text>}
                  <Tag style={{ background: nivel.color, color: "#fff", border: "none", fontSize: 13, padding: "2px 12px" }}>{nivel.icon} {nivel.label}</Tag>
                </Space>
              </Col>
            </Row>

            <Divider style={{ margin: "16px 0" }} />

            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8}>
                <Statistic
                  title={<Text style={{ fontSize: 12 }}>⭐ Puntos disponibles</Text>}
                  value={cliente.puntos_fidelidad || 0}
                  valueStyle={{ color: nivel.color, fontWeight: 800 }}
                  formatter={(v) => Number(v).toLocaleString()}
                />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic
                  title={<Text style={{ fontSize: 12 }}>🎁 Puntos canjeados</Text>}
                  value={cliente.puntos_canjeados || 0}
                  valueStyle={{ color: "#52c41a" }}
                  formatter={(v) => Number(v).toLocaleString()}
                />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic
                  title={<Text style={{ fontSize: 12 }}>💰 Valor disponible</Text>}
                  value={Math.floor((cliente.puntos_fidelidad || 0) / 100) * 5000}
                  prefix="$"
                  valueStyle={{ color: "#d81b87" }}
                  formatter={(v) => Number(v).toLocaleString()}
                />
              </Col>
            </Row>

            {/* Progreso al siguiente nivel */}
            {prog ? (
              <div style={{ marginTop: 16 }}>
                <Row justify="space-between" style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "#666" }}>Progreso hacia {prog.siguiente.icon} {prog.siguiente.label}</Text>
                  <Text style={{ fontSize: 12, color: "#666" }}>Faltan {prog.faltantes.toLocaleString()} pts</Text>
                </Row>
                <Progress percent={prog.pct} strokeColor={{ "0%": nivel.color, "100%": prog.siguiente.color }} />
              </div>
            ) : (
              <Alert style={{ marginTop: 12, borderRadius: 8 }} type="success" message="💎 ¡Felicidades! Eres del nivel más alto: Diamante" showIcon />
            )}
          </Card>

          {/* Beneficios del nivel */}
          <Card style={{ borderRadius: 16, marginBottom: 16 }} title={<Space><TrophyOutlined style={{ color: nivel.color }} /><Text strong>Tus beneficios — Nivel {nivel.label}</Text></Space>} size="small">
            <Row gutter={[8, 8]}>
              {nivel.beneficios.map((b) => (
                <Col key={b} xs={24} sm={12}>
                  <Space>
                    <span style={{ color: nivel.color }}>✓</span>
                    <Text style={{ fontSize: 13 }}>{b}</Text>
                  </Space>
                </Col>
              ))}
            </Row>
            {nivel.descuento > 0 && (
              <Alert style={{ marginTop: 12, borderRadius: 8 }} type="info" showIcon message={<Text>Tienes <Text strong style={{ color: "#d81b87" }}>{nivel.descuento}% de descuento</Text> en cada compra</Text>} />
            )}
          </Card>

          {/* Logros */}
          <Card style={{ borderRadius: 16, marginBottom: 16 }} title={<Space><StarOutlined style={{ color: "#faad14" }} /><Text strong>Tus logros</Text><Tag>{logros.length}/{LOGROS_CATALOGO.length}</Tag></Space>} size="small">
            <Progress percent={Math.round((logros.length / LOGROS_CATALOGO.length) * 100)} strokeColor={{ "0%": "#d81b87", "100%": "#faad14" }} style={{ marginBottom: 16 }} />
            <Row gutter={[12, 16]}>
              {LOGROS_CATALOGO.map((l) => {
                const desbloqueado = logros.includes(l.key);
                return (
                  <Col key={l.key} span={6} style={{ textAlign: "center" }}>
                    <Tooltip title={`${l.titulo}: ${l.desc}`}>
                      <div>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", margin: "0 auto 4px", background: desbloqueado ? "linear-gradient(135deg,#fff7e6,#ffe7ba)" : "#f5f5f5", border: `2px solid ${desbloqueado ? "#faad14" : "#e0e0e0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, opacity: desbloqueado ? 1 : 0.35, filter: desbloqueado ? "none" : "grayscale(100%)", boxShadow: desbloqueado ? "0 2px 8px rgba(250,173,20,0.35)" : "none" }}>
                          {desbloqueado ? l.emoji : <LockOutlined style={{ color: "#bbb", fontSize: 18 }} />}
                        </div>
                        <Text style={{ fontSize: 10, color: desbloqueado ? "#333" : "#bbb", display: "block" }}>{l.titulo}</Text>
                      </div>
                    </Tooltip>
                  </Col>
                );
              })}
            </Row>
          </Card>

          {/* Historial */}
          <Card style={{ borderRadius: 16, marginBottom: 24 }} title={<Space><GiftOutlined />Historial de puntos</Space>} size="small">
            {historial.length === 0 ? <Empty description="Sin movimientos registrados" /> : (
              <Timeline
                items={historial.map((h) => ({
                  color: h.puntos > 0 ? "green" : "red",
                  children: (
                    <div>
                      <Space>
                        <Tag color={h.puntos > 0 ? "success" : "error"}>{h.puntos > 0 ? "+" : ""}{h.puntos} pts</Tag>
                        <Text style={{ fontSize: 13 }}>{h.concepto}</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 11, display: "block" }}>{dayjs(h.created_at).format("DD/MM/YYYY HH:mm")}</Text>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>

          {/* Cómo ganar más */}
          <Card style={{ borderRadius: 16, marginBottom: 24 }} title="💡 ¿Cómo ganar más puntos?" size="small">
            <Row gutter={[12, 8]}>
              {[
                { icon: "💵", text: "Gana 1 punto por cada $1.000 de compra" },
                { icon: "🎂", text: "El mes de tu cumpleaños acumulas el doble" },
                { icon: "🤝", text: "+300 pts cuando refieres a una amiga" },
                { icon: "🔥", text: "Bono por racha: 3 meses seguidos comprando" },
                { icon: "🎁", text: "100 puntos = $5.000 COP de descuento" },
              ].map((r) => (
                <Col xs={24} sm={12} key={r.text}>
                  <Space>
                    <span style={{ fontSize: 18 }}>{r.icon}</span>
                    <Text style={{ fontSize: 12 }}>{r.text}</Text>
                  </Space>
                </Col>
              ))}
            </Row>
          </Card>

          {/* Contacto */}
          <Card style={{ borderRadius: 16, textAlign: "center", background: "linear-gradient(135deg,#fff0f8,#ffe4f2)" }} size="small">
            <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>¿Tienes dudas sobre tus puntos o quieres canjear?</Text>
            <Button
              type="primary"
              icon={<PhoneOutlined />}
              style={{ background: "#25D366", borderColor: "#25D366" }}
              onClick={() => window.open("https://wa.me/57XXXXXXXXXX?text=Hola! Quiero consultar mis puntos del Club La Cosmetikera 🌸", "_blank")}
            >
              Contáctanos por WhatsApp
            </Button>
          </Card>
        </div>
      )}

      <Text type="secondary" style={{ marginTop: 32, fontSize: 11 }}>© La Cosmetikera — Club de fidelización</Text>
    </div>
  );
}
