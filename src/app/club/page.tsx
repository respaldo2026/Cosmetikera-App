"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import {
  CopyOutlined,
  GiftOutlined,
  LockOutlined,
  PhoneOutlined,
  SearchOutlined,
  ShareAltOutlined,
  StarOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  CLUB_REWARDS,
  getActiveBenefits,
  getClubLevel,
  getClubProgress,
  getEligibleRewards,
  getRecommendedNextReward,
  getReferralCode,
  getReferralShareMessage,
  isBirthdayMonth,
  isRewardUnlocked,
} from "@/constants/clubRewards";

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

type ClubCanje = {
  id: string;
  code: string | null;
  description: string;
  estado: string;
  puntos: number;
  valorCop: number;
  rewardTitle: string;
  rewardIcon: string;
  createdAt: string;
};

const LOGROS_CATALOGO = [
  { key: "primera_compra", emoji: "🌟", titulo: "Primera compra", desc: "Realizó su primera compra" },
  { key: "compradora_5", emoji: "🛍️", titulo: "Compradora frecuente", desc: "5 compras realizadas" },
  { key: "compradora_10", emoji: "👑", titulo: "Cliente fiel", desc: "10 compras realizadas" },
  { key: "compradora_20", emoji: "🏆", titulo: "Embajadora", desc: "20 compras realizadas" },
  { key: "gasto_200k", emoji: "💰", titulo: "$200.000 gastados", desc: "Acumuló $200.000 en compras" },
  { key: "gasto_500k", emoji: "💎", titulo: "$500.000 gastados", desc: "Acumuló $500.000 en compras" },
  { key: "gasto_1m", emoji: "🔮", titulo: "Club Millón", desc: "Acumuló $1.000.000 en compras" },
  { key: "racha_3", emoji: "🔥", titulo: "En racha x3", desc: "3 meses seguidos comprando" },
  { key: "racha_6", emoji: "⚡", titulo: "Imparable x6", desc: "6 meses seguidos comprando" },
  { key: "nivel_plata", emoji: "🥈", titulo: "Nivel Plata", desc: "Alcanzó el nivel Plata" },
  { key: "nivel_oro", emoji: "🥇", titulo: "Nivel Oro", desc: "Alcanzó el nivel Oro" },
  { key: "nivel_diamante", emoji: "💍", titulo: "Diamante", desc: "Nivel máximo alcanzado" },
  { key: "cumpleanos", emoji: "🎂", titulo: "Cumpleañera VIP", desc: "Compró en su mes de cumpleaños" },
  { key: "canje_1", emoji: "🎁", titulo: "Primer canje", desc: "Canjeó puntos por primera vez" },
];

function calcularLogros(c: Cliente): string[] {
  const logros: string[] = [];
  const puntos = c.puntos_fidelidad || 0;
  const compras = c.total_compras || 0;
  const racha = c.racha_visitas || 0;
  if (compras >= 1) logros.push("primera_compra");
  if (compras >= 5) logros.push("compradora_5");
  if (compras >= 10) logros.push("compradora_10");
  if (compras >= 20) logros.push("compradora_20");
  if (puntos >= 1000) logros.push("nivel_plata");
  if (puntos >= 5000) logros.push("nivel_oro");
  if (puntos >= 15000) logros.push("nivel_diamante");
  if (racha >= 3) logros.push("racha_3");
  if (racha >= 6) logros.push("racha_6");
  if (c.logros) logros.push(...c.logros.filter((item) => !logros.includes(item)));
  return [...new Set(logros)];
}

export default function ClubPage() {
  const { message } = App.useApp();
  const [cedula, setCedula] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [canjeando, setCanjeando] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [historial, setHistorial] = useState<PuntosLog[]>([]);
  const [canjes, setCanjes] = useState<ClubCanje[]>([]);
  const [error, setError] = useState("");

  const cargarCanjes = useCallback(async (perfilId: string) => {
    const response = await fetch(`/api/club/canjes?perfil_id=${encodeURIComponent(perfilId)}`);
    const json = await response.json();
    if (response.ok) {
      setCanjes(json.data || []);
    }
  }, []);

  const buscar = useCallback(async () => {
    const val = cedula.trim().replace(/\D/g, "");
    if (!val) return;
    setBuscando(true);
    setCliente(null);
    setHistorial([]);
    setCanjes([]);
    setError("");

    try {
      const res = await fetch(`/api/club?cedula=${encodeURIComponent(val)}`);
      const json = await res.json();

      if (res.status === 404 || !json.data) {
        setError("No encontramos una cuenta con esa cédula. Verifica el número o visítanos en tienda.");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Error");

      setCliente(json.data);

      const [histRes] = await Promise.all([
        fetch("/api/club", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ perfil_id: json.data.id }),
        }),
        cargarCanjes(json.data.id),
      ]);
      const histJson = await histRes.json();
      setHistorial(histJson.data || []);
    } catch {
      setError("Error al conectar. Intenta nuevamente.");
    } finally {
      setBuscando(false);
    }
  }, [cargarCanjes, cedula]);

  const canjearRecompensa = useCallback(async (rewardKey: string) => {
    if (!cliente) return;
    setCanjeando(rewardKey);
    try {
      const response = await fetch("/api/club/canjes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfilId: cliente.id, rewardKey }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo generar el voucher");

      const reward = CLUB_REWARDS.find((item) => item.key === rewardKey);
      const costo = reward?.pointsCost || 0;
      setCliente((current) => current ? {
        ...current,
        puntos_fidelidad: Math.max(0, (current.puntos_fidelidad || 0) - costo),
        puntos_canjeados: (current.puntos_canjeados || 0) + costo,
      } : current);
      setCanjes((current) => [json.data, ...current]);
      setHistorial((current) => [{
        id: `club-${Date.now()}`,
        tipo: "canjeados",
        puntos: -costo,
        concepto: `Canje ${reward?.title || "recompensa"} · código ${json.data.code}`,
        created_at: new Date().toISOString(),
      }, ...current]);
      message.success(`Voucher emitido: ${json.data.code}`);
    } catch (requestError: any) {
      message.error(requestError?.message || "No se pudo emitir la recompensa");
    } finally {
      setCanjeando(null);
    }
  }, [cliente, message]);

  const copiar = useCallback(async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      message.success("Código copiado");
    } catch {
      message.error("No se pudo copiar el código");
    }
  }, [message]);

  const compartirReferido = useCallback(() => {
    if (!cliente) return;
    const texto = encodeURIComponent(getReferralShareMessage(cliente));
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  }, [cliente]);

  const nivel = useMemo(() => cliente ? getClubLevel(cliente.puntos_fidelidad || 0) : null, [cliente]);
  const progreso = useMemo(() => cliente ? getClubProgress(cliente.puntos_fidelidad || 0) : null, [cliente]);
  const logros = useMemo(() => cliente ? calcularLogros(cliente) : [], [cliente]);
  const esCumple = !!cliente?.fecha_nacimiento && isBirthdayMonth(cliente.fecha_nacimiento);
  const beneficiosActivos = useMemo(() => getActiveBenefits(cliente), [cliente]);
  const recompensasDisponibles = useMemo(() => getEligibleRewards(cliente), [cliente]);
  const siguienteRecompensa = useMemo(() => getRecommendedNextReward(cliente), [cliente]);
  const referralCode = useMemo(() => getReferralCode(cliente), [cliente]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fff0f8 0%, #f9f0ff 50%, #fffbe6 100%)", display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(16px, 5vw, 40px) 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,#faad14,#d81b87)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 4px 20px rgba(216,27,135,0.3)" }}>
          <GiftOutlined style={{ color: "#fff", fontSize: 34 }} />
        </div>
        <Title level={2} style={{ margin: 0, color: "#d81b87" }}>Club La Cosmetikera</Title>
        <Text type="secondary">Puntos, recompensas, vouchers y campañas activas del club</Text>
      </div>

      {!cliente && (
        <Card style={{ width: "100%", maxWidth: 560, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 24 }}>
          <Title level={5} style={{ marginTop: 0 }}>Consulta y canjea tus beneficios</Title>
          <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 16 }}>Ingresa tu cédula para abrir tu wallet del club</Text>
          <Form onFinish={buscar}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                prefix={<SearchOutlined style={{ color: "#d81b87" }} />}
                placeholder="Ej: 1234567890"
                value={cedula}
                onChange={(event) => setCedula(event.target.value.replace(/\D/g, ""))}
                size="large"
                maxLength={12}
              />
              <Button type="primary" size="large" loading={buscando} onClick={buscar} style={{ background: "#d81b87", borderColor: "#d81b87" }}>
                Buscar
              </Button>
            </Space.Compact>
          </Form>
          {error && <Alert type="warning" message={error} showIcon style={{ marginTop: 12, borderRadius: 8 }} />}
        </Card>
      )}

      {error && cliente === null && !buscando && cedula && (
        <Alert type="warning" message={error} showIcon style={{ width: "100%", maxWidth: 560, marginBottom: 16, borderRadius: 8 }} />
      )}

      {buscando && <Spin size="large" style={{ margin: "32px 0" }} />}

      {cliente && nivel && (
        <div style={{ width: "100%", maxWidth: 980, boxSizing: "border-box" }}>
          <Card style={{ borderRadius: 16, marginBottom: 16, background: `linear-gradient(135deg, ${nivel.color}18, ${nivel.color}30)`, border: `2px solid ${nivel.color}` }}>
            <Row align="middle" gutter={[16, 16]}>
              <Col>
                <Avatar size={64} style={{ background: nivel.color, fontSize: 26 }}>{cliente.nombre_completo[0]?.toUpperCase()}</Avatar>
              </Col>
              <Col flex="auto">
                <Space direction="vertical" size={2}>
                  <Space wrap>
                    <Title level={4} style={{ margin: 0 }}>{cliente.nombre_completo}</Title>
                    {esCumple && <Tag color="pink">Mes de cumpleaños activo</Tag>}
                    <Tag style={{ background: nivel.color, color: "#fff", border: "none", fontSize: 13, padding: "2px 12px" }}>{nivel.icon} {nivel.label}</Tag>
                  </Space>
                  {cliente.cedula && <Text type="secondary" style={{ fontSize: 12 }}>CC: {cliente.cedula}</Text>}
                  <Text type="secondary" style={{ fontSize: 12 }}>Tu portal ya puede emitir vouchers para usar en caja.</Text>
                  <Button
                    size="small"
                    onClick={() => { setCliente(null); setCedula(""); setError(""); setHistorial([]); setCanjes([]); }}
                    style={{ marginTop: 4, color: "#888", borderColor: "#ddd", fontSize: 11 }}
                  >
                    ← Cambiar cédula
                  </Button>
                </Space>
              </Col>
            </Row>

            <Divider style={{ margin: "16px 0" }} />

            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Statistic title={<Text style={{ fontSize: 12 }}>Puntos disponibles</Text>} value={cliente.puntos_fidelidad || 0} valueStyle={{ color: nivel.color, fontWeight: 800 }} formatter={(value) => Number(value).toLocaleString()} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title={<Text style={{ fontSize: 12 }}>Puntos canjeados</Text>} value={cliente.puntos_canjeados || 0} valueStyle={{ color: "#52c41a" }} formatter={(value) => Number(value).toLocaleString()} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title={<Text style={{ fontSize: 12 }}>Rewards desbloqueadas</Text>} value={recompensasDisponibles.length} valueStyle={{ color: "#d81b87" }} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title={<Text style={{ fontSize: 12 }}>Valor canjeable hoy</Text>} value={recompensasDisponibles.reduce((sum, reward) => sum + reward.valueCop, 0)} prefix="$" valueStyle={{ color: "#722ed1" }} formatter={(value) => Number(value).toLocaleString()} />
              </Col>
            </Row>

            {progreso ? (
              <div style={{ marginTop: 16 }}>
                <Row justify="space-between" style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "#666" }}>Progreso hacia {progreso.siguiente.icon} {progreso.siguiente.label}</Text>
                  <Text style={{ fontSize: 12, color: "#666" }}>Faltan {progreso.faltantes.toLocaleString()} pts</Text>
                </Row>
                <Progress percent={progreso.pct} strokeColor={{ "0%": nivel.color, "100%": progreso.siguiente.color }} />
              </div>
            ) : (
              <Alert style={{ marginTop: 12, borderRadius: 8 }} type="success" message="Estás en el nivel más alto del club." showIcon />
            )}
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card style={{ borderRadius: 16, marginBottom: 16 }} title={<Space><GiftOutlined style={{ color: "#d81b87" }} /><Text strong>Catálogo de recompensas</Text></Space>} extra={<Tag color="magenta">{recompensasDisponibles.length} disponibles</Tag>}>
                <Row gutter={[12, 12]}>
                  {CLUB_REWARDS.map((reward) => {
                    const unlocked = isRewardUnlocked(reward, cliente);
                    const faltantes = Math.max(0, reward.pointsCost - (cliente.puntos_fidelidad || 0));
                    return (
                      <Col xs={24} md={12} key={reward.key}>
                        <Card size="small" style={{ borderRadius: 14, border: unlocked ? "1px solid #f0d6ff" : "1px solid #f0f0f0", minHeight: 220, background: unlocked ? "linear-gradient(180deg,#fff,#fff7fb)" : "#fafafa" }}>
                          <Space direction="vertical" size={10} style={{ width: "100%" }}>
                            <Space wrap>
                              <span style={{ fontSize: 24 }}>{reward.icon}</span>
                              <Text strong>{reward.title}</Text>
                              {reward.badge && <Tag color={reward.featured ? "gold" : "default"}>{reward.badge}</Tag>}
                            </Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>{reward.description}</Text>
                            <Space wrap>
                              <Tag color="purple">{reward.pointsCost.toLocaleString()} pts</Tag>
                              <Tag color="green">${reward.valueCop.toLocaleString()}</Tag>
                              {reward.levelMin && <Tag>{reward.levelMin}</Tag>}
                              {reward.birthdayOnly && <Tag color="pink">solo cumpleaños</Tag>}
                            </Space>
                            {!unlocked && (
                              <Alert
                                type="info"
                                showIcon
                                message={reward.birthdayOnly && !esCumple ? "Disponible solo en tu mes de cumpleaños" : faltantes > 0 ? `Te faltan ${faltantes.toLocaleString()} pts` : "Tu nivel aún no la desbloquea"}
                                style={{ borderRadius: 10 }}
                              />
                            )}
                            <Button
                              type={unlocked ? "primary" : "default"}
                              disabled={!unlocked}
                              loading={canjeando === reward.key}
                              onClick={() => canjearRecompensa(reward.key)}
                              style={unlocked ? { background: "#d81b87", borderColor: "#d81b87" } : undefined}
                            >
                              {unlocked ? "Canjear ahora" : "Bloqueada"}
                            </Button>
                          </Space>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Card>

              <Card style={{ borderRadius: 16, marginBottom: 16 }} title={<Space><GiftOutlined /><Text strong>Mis vouchers y canjes</Text></Space>}>
                {canjes.length === 0 ? <Empty description="Todavía no has emitido vouchers" /> : (
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {canjes.map((canje) => (
                      <div key={canje.id} style={{ padding: 14, borderRadius: 12, background: canje.estado === "redimido" ? "#fafafa" : "#fff7fb", border: `1px solid ${canje.estado === "redimido" ? "#f0f0f0" : "#ffd6e7"}` }}>
                        <Row gutter={[12, 12]} align="middle">
                          <Col flex="auto">
                            <Space direction="vertical" size={4}>
                              <Space wrap>
                                <Text strong>{canje.rewardIcon} {canje.rewardTitle}</Text>
                                <Tag color={canje.estado === "redimido" ? "default" : "success"}>{canje.estado}</Tag>
                              </Space>
                              <Text type="secondary" style={{ fontSize: 12 }}>{canje.description}</Text>
                              <Space wrap>
                                <Tag color="purple">-{canje.puntos} pts</Tag>
                                <Tag color="green">${canje.valorCop.toLocaleString()}</Tag>
                                <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(canje.createdAt).format("DD/MM/YYYY HH:mm")}</Text>
                              </Space>
                            </Space>
                          </Col>
                          <Col>
                            {canje.code ? (
                              <Space direction="vertical" size={6} style={{ textAlign: "center" }}>
                                <Tag style={{ fontSize: 13, padding: "4px 10px", borderRadius: 8, wordBreak: "break-all" }}>{canje.code}</Tag>
                                <Button icon={<CopyOutlined />} onClick={() => canje.code && copiar(canje.code)} disabled={canje.estado === "redimido"}>Copiar</Button>
                              </Space>
                            ) : null}
                          </Col>
                        </Row>
                      </div>
                    ))}
                  </Space>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={10}>
              <Card style={{ borderRadius: 16, marginBottom: 16 }} title={<Space><TrophyOutlined style={{ color: nivel.color }} /><Text strong>Beneficios activos</Text></Space>}>
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  {beneficiosActivos.map((benefit) => (
                    <div key={benefit.key} style={{ padding: 12, borderRadius: 12, background: benefit.active ? "#f6ffed" : "#fafafa", border: `1px solid ${benefit.active ? "#b7eb8f" : "#f0f0f0"}` }}>
                      <Space direction="vertical" size={2}>
                        <Space wrap>
                          <span>{benefit.icon}</span>
                          <Text strong>{benefit.title}</Text>
                          <Tag color={benefit.active ? "success" : "default"}>{benefit.active ? "activo" : "por desbloquear"}</Tag>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>{benefit.description}</Text>
                      </Space>
                    </div>
                  ))}
                </Space>
              </Card>

              <Card style={{ borderRadius: 16, marginBottom: 16 }} title={<Space><StarOutlined style={{ color: "#faad14" }} /><Text strong>Siguiente recompensa recomendada</Text></Space>}>
                {siguienteRecompensa ? (
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Text strong style={{ fontSize: 16 }}>{siguienteRecompensa.icon} {siguienteRecompensa.title}</Text>
                    <Text type="secondary">{siguienteRecompensa.description}</Text>
                    <Space wrap>
                      <Tag color="purple">{siguienteRecompensa.pointsCost.toLocaleString()} pts</Tag>
                      <Tag color="green">${siguienteRecompensa.valueCop.toLocaleString()}</Tag>
                    </Space>
                    <Alert type="info" showIcon message={`Te faltan ${Math.max(0, siguienteRecompensa.pointsCost - (cliente.puntos_fidelidad || 0)).toLocaleString()} pts para desbloquearla.`} style={{ borderRadius: 10 }} />
                  </Space>
                ) : (
                  <Alert type="success" showIcon message="Ya tienes desbloqueadas todas las recompensas compatibles con tu nivel actual." style={{ borderRadius: 10 }} />
                )}
              </Card>

              <Card style={{ borderRadius: 16, marginBottom: 16 }} title="Campañas del club">
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <div style={{ padding: 12, borderRadius: 12, background: esCumple ? "#fff0f6" : "#fffbe6", border: `1px solid ${esCumple ? "#ffadd2" : "#ffe58f"}` }}>
                    <Space direction="vertical" size={4}>
                      <Text strong>🎂 Campaña de cumpleaños</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {esCumple ? "Este mes tienes multiplicador de puntos activo y acceso a recompensas especiales." : "Cuando llegue tu mes de cumpleaños se activarán puntos extra y premios temáticos."}
                      </Text>
                    </Space>
                  </div>
                  <div style={{ padding: 12, borderRadius: 12, background: "#f9f0ff", border: "1px solid #d3adf7" }}>
                    <Space direction="vertical" size={6} style={{ width: "100%" }}>
                      <Text strong>🤝 Campaña de referidos</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>Tu código personal suma 300 pts cuando tu referida haga su primera compra.</Text>
                      <Space wrap style={{ width: "100%" }}>
                        <Tag color="purple" style={{ fontSize: 13, padding: "4px 10px", borderRadius: 8 }}>{referralCode}</Tag>
                        <Button icon={<CopyOutlined />} onClick={() => copiar(referralCode)}>Copiar código</Button>
                        <Button icon={<ShareAltOutlined />} onClick={compartirReferido}>Compartir</Button>
                      </Space>
                    </Space>
                  </div>
                </Space>
              </Card>

              <Card style={{ borderRadius: 16, marginBottom: 16 }} title={<Space><StarOutlined style={{ color: "#faad14" }} /><Text strong>Tus logros</Text><Tag>{logros.length}/{LOGROS_CATALOGO.length}</Tag></Space>}>
                <Progress percent={Math.round((logros.length / LOGROS_CATALOGO.length) * 100)} strokeColor={{ "0%": "#d81b87", "100%": "#faad14" }} style={{ marginBottom: 16 }} />
                <Row gutter={[12, 16]}>
                  {LOGROS_CATALOGO.map((achievement) => {
                    const unlocked = logros.includes(achievement.key);
                    return (
                      <Col key={achievement.key} xs={8} sm={6} style={{ textAlign: "center" }}>
                        <Tooltip title={`${achievement.titulo}: ${achievement.desc}`}>
                          <div>
                            <div style={{ width: 52, height: 52, borderRadius: "50%", margin: "0 auto 4px", background: unlocked ? "linear-gradient(135deg,#fff7e6,#ffe7ba)" : "#f5f5f5", border: `2px solid ${unlocked ? "#faad14" : "#e0e0e0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, opacity: unlocked ? 1 : 0.35, filter: unlocked ? "none" : "grayscale(100%)", boxShadow: unlocked ? "0 2px 8px rgba(250,173,20,0.35)" : "none" }}>
                              {unlocked ? achievement.emoji : <LockOutlined style={{ color: "#bbb", fontSize: 18 }} />}
                            </div>
                            <Text style={{ fontSize: 10, color: unlocked ? "#333" : "#bbb", display: "block" }}>{achievement.titulo}</Text>
                          </div>
                        </Tooltip>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card style={{ borderRadius: 16, marginBottom: 24 }} title={<Space><GiftOutlined />Historial de puntos</Space>}>
                {historial.length === 0 ? <Empty description="Sin movimientos registrados" /> : (
                  <Timeline
                    items={historial.map((item) => ({
                      color: item.puntos > 0 ? "green" : "red",
                      children: (
                        <div>
                          <Space wrap>
                            <Tag color={item.puntos > 0 ? "success" : "error"}>{item.puntos > 0 ? "+" : ""}{item.puntos} pts</Tag>
                            <Text style={{ fontSize: 13 }}>{item.concepto}</Text>
                          </Space>
                          <Text type="secondary" style={{ fontSize: 11, display: "block" }}>{dayjs(item.created_at).format("DD/MM/YYYY HH:mm")}</Text>
                        </div>
                      ),
                    }))}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card style={{ borderRadius: 16, marginBottom: 24 }} title="Cómo ganar más puntos">
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  {[
                    { icon: "💵", text: "Gana 1 punto por cada $1.000 de compra." },
                    { icon: "🎂", text: "El mes de tu cumpleaños se activan puntos extra según tu nivel." },
                    { icon: "🤝", text: "Recibe 300 pts cuando una referida compre por primera vez." },
                    { icon: "🔥", text: "Mantén tu racha mensual para desbloquear logros." },
                    { icon: "🎟️", text: "Convierte tus puntos en vouchers que ya funcionan en caja." },
                  ].map((item) => (
                    <div key={item.text} style={{ padding: 12, borderRadius: 12, background: "#fff", border: "1px solid #f0f0f0" }}>
                      <Space>
                        <span style={{ fontSize: 18 }}>{item.icon}</span>
                        <Text style={{ fontSize: 12 }}>{item.text}</Text>
                      </Space>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>

          <Card style={{ borderRadius: 16, textAlign: "center", background: "linear-gradient(135deg,#fff0f8,#ffe4f2)" }}>
            <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>¿Quieres ayuda para usar tu código o revisar tu club?</Text>
            <Button
              type="primary"
              icon={<PhoneOutlined />}
              style={{ background: "#25D366", borderColor: "#25D366" }}
              onClick={() => window.open("https://wa.me/57XXXXXXXXXX?text=Hola! Quiero consultar mis puntos del Club La Cosmetikera", "_blank")}
            >
              Contáctanos por WhatsApp
            </Button>
          </Card>
        </div>
      )}

      <Text type="secondary" style={{ marginTop: 32, fontSize: 11 }}>La Cosmetikera · Club de fidelización</Text>
    </div>
  );
}
