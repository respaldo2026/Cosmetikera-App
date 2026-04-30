"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Grid,
  Input,
  Modal,
  Progress,
  Row,
  Space,
  Spin,
  Tag,
  Tabs,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import {
  CopyOutlined,
  BellOutlined,
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
  getReferralCode,
  getReferralShareMessage,
  isBirthdayMonth,
} from "@/constants/clubRewards";
import {
  useClubConfig,
  isRewardEligibleDynamic,
  getNivelDinamico,
} from "@/hooks/useClubConfig";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const BRAND_FUCHSIA = "#d81b87";
const BRAND_FUCHSIA_SOFT = "#ff4fa3";
const WHATSAPP_BOT_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER;

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 16,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #fff3f9 100%)",
  border: "1px solid #ffd6e7",
  boxShadow: "0 6px 16px rgba(216,27,135,0.08)",
};

function buildWhatsAppLink(text: string): string {
  if (!WHATSAPP_BOT_NUMBER) {
    return "#";
  }
  return `https://wa.me/${WHATSAPP_BOT_NUMBER}?text=${encodeURIComponent(text)}`;
}

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

type RecomendacionProducto = {
  id: string;
  nombre: string;
  categoria?: string | null;
  marca?: string | null;
  precio_venta?: number | null;
  descuento_porcentaje?: number | null;
  promocion_texto?: string | null;
  imagen_url?: string | null;
  razon: string;
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

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").trim();
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output.buffer;
}

export default function ClubPage() {
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [acceso, setAcceso] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [canjeando, setCanjeando] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [historial, setHistorial] = useState<PuntosLog[]>([]);
  const [canjes, setCanjes] = useState<ClubCanje[]>([]);
  const [error, setError] = useState("");
  const [codigoReferidoIngresado, setCodigoReferidoIngresado] = useState("");
  const [aplicandoReferido, setAplicandoReferido] = useState(false);
  const [referidoAplicado, setReferidoAplicado] = useState(false);
  const [tabActiva, setTabActiva] = useState("resumen");
  const [canjeModalOpen, setCanjeModalOpen] = useState(false);
  const [rewardPendiente, setRewardPendiente] = useState<string | null>(null);
  const [telefonoCanje, setTelefonoCanje] = useState("");
  const [recomendaciones, setRecomendaciones] = useState<RecomendacionProducto[]>([]);
  const [loadingRecomendaciones, setLoadingRecomendaciones] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [pushEnabled, setPushEnabled] = useState(false);

  const cargarCanjes = useCallback(async (perfilId: string) => {
    const response = await fetch(`/api/club/canjes?perfil_id=${encodeURIComponent(perfilId)}`);
    const json = await response.json();
    if (response.ok) {
      setCanjes(json.data || []);
    }
  }, []);

  const cargarRecomendaciones = useCallback(async (perfilId: string) => {
    setLoadingRecomendaciones(true);
    try {
      const response = await fetch(`/api/club/recomendaciones?perfil_id=${encodeURIComponent(perfilId)}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudieron cargar recomendaciones");
      setRecomendaciones(Array.isArray(json.data) ? json.data : []);
    } catch {
      setRecomendaciones([]);
    } finally {
      setLoadingRecomendaciones(false);
    }
  }, []);

  const buscar = useCallback(async () => {
    const val = acceso.trim().replace(/\D/g, "");
    if (!val) return;
    setBuscando(true);
    setCliente(null);
    setHistorial([]);
    setCanjes([]);
    setRecomendaciones([]);
    setError("");
    setCanjeModalOpen(false);
    setRewardPendiente(null);
    setTelefonoCanje("");

    try {
      const res = await fetch(`/api/club?acceso=${encodeURIComponent(val)}`);
      const json = await res.json();

      if (res.status === 404 || !json.data) {
        setError("No encontramos una cuenta con esa cédula.");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Error");

      setCliente(json.data);
      setReferidoAplicado(false);
      setCodigoReferidoIngresado("");

      const [histRes] = await Promise.all([
        fetch("/api/club", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ perfil_id: json.data.id }),
        }),
        cargarCanjes(json.data.id),
        cargarRecomendaciones(json.data.id),
      ]);
      const histJson = await histRes.json();
      setHistorial(histJson.data || []);
      setTabActiva("resumen");
    } catch {
      setError("Error al conectar. Intenta nuevamente.");
    } finally {
      setBuscando(false);
    }
  }, [acceso, cargarCanjes, cargarRecomendaciones]);

  const canjearRecompensa = useCallback(async (rewardKey: string, telefonoVerificacion: string) => {
    if (!cliente) return;

    const telefono = normalizePhone(telefonoVerificacion);
    if (!telefono) {
      message.error("Ingresa tu teléfono para confirmar el canje");
      return;
    }

    setCanjeando(rewardKey);
    try {
      const response = await fetch("/api/club/canjes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfilId: cliente.id, rewardKey, telefonoVerificacion: telefono }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo generar el voucher");

      const reward = catalogoDinamico.find((item) => item.key === rewardKey);
      const costo = reward?.points_cost || 0;
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
      setCanjeModalOpen(false);
      setRewardPendiente(null);
      setTelefonoCanje("");
      message.success(`Voucher emitido: ${json.data.code}`);
    } catch (requestError: unknown) {
      const errorMessage = requestError instanceof Error
        ? requestError.message
        : "No se pudo emitir la recompensa";
      message.error(errorMessage);
    } finally {
      setCanjeando(null);
    }
  }, [cliente, message]);

  const solicitarCanje = useCallback((rewardKey: string) => {
    setRewardPendiente(rewardKey);
    setTelefonoCanje("");
    setCanjeModalOpen(true);
  }, []);

  const confirmarCanje = useCallback(async () => {
    if (!rewardPendiente) return;
    await canjearRecompensa(rewardPendiente, telefonoCanje);
  }, [canjearRecompensa, rewardPendiente, telefonoCanje]);

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

  const aplicarCodigoReferido = useCallback(async () => {
    if (!cliente || !codigoReferidoIngresado.trim()) return;
    setAplicandoReferido(true);
    try {
      const res = await fetch("/api/club/referido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: codigoReferidoIngresado.trim().toUpperCase(),
          nuevoClienteId: cliente.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo aplicar el código");
      setReferidoAplicado(true);
      message.success(`¡Código aplicado! ${json.referidor?.nombre} recibió 300 puntos 🎉`);
    } catch (e: any) {
      message.error(e?.message || "No se pudo aplicar el código de referido");
    } finally {
      setAplicandoReferido(false);
    }
  }, [cliente, codigoReferidoIngresado, message]);

  const { recompensas: catalogoDinamico, reglas, loading: loadingConfig } = useClubConfig();

  const esCumple = !!cliente?.fecha_nacimiento && isBirthdayMonth(cliente.fecha_nacimiento);

  const nivel = useMemo(() => {
    if (!cliente) return null;
    const pts = cliente.puntos_fidelidad || 0;
    const key = getNivelDinamico(pts, reglas);
    const NIVEL_META: Record<string, { label: string; color: string; icon: string }> = {
      bronce:   { label: "Bronce",   color: BRAND_FUCHSIA, icon: "🥉" },
      plata:    { label: "Plata",    color: "#8c8c8c", icon: "🥈" },
      oro:      { label: "Oro",      color: BRAND_FUCHSIA_SOFT, icon: "🥇" },
      diamante: { label: "Diamante", color: "#13c2c2", icon: "💎" },
    };
    return { key, ...NIVEL_META[key] };
  }, [cliente, reglas]);

  const progreso = useMemo(() => {
    if (!cliente || !nivel) return null;
    const pts = cliente.puntos_fidelidad || 0;
    const umbrales: Record<string, number> = {
      plata: reglas.puntos_min_plata, oro: reglas.puntos_min_oro, diamante: reglas.puntos_min_diamante,
    };
    const NIVEL_ORDER = ["bronce", "plata", "oro", "diamante"] as const;
    const NIVEL_META: Record<string, { label: string; color: string; icon: string; min: number }> = {
      bronce:   { label: "Bronce",   color: BRAND_FUCHSIA, icon: "🥉", min: 0 },
      plata:    { label: "Plata",    color: "#8c8c8c", icon: "🥈", min: reglas.puntos_min_plata },
      oro:      { label: "Oro",      color: BRAND_FUCHSIA_SOFT, icon: "🥇", min: reglas.puntos_min_oro },
      diamante: { label: "Diamante", color: "#13c2c2", icon: "💎", min: reglas.puntos_min_diamante },
    };
    const idx = NIVEL_ORDER.indexOf(nivel.key as typeof NIVEL_ORDER[number]);
    if (idx === -1 || idx === NIVEL_ORDER.length - 1) return null;
    const nextKey = NIVEL_ORDER[idx + 1];
    if (!nextKey) return null;
    const siguiente = NIVEL_META[nextKey];
    const current = NIVEL_META[nivel.key];
    if (!siguiente || !current) return null;
    const span = Math.max(1, siguiente.min - current.min);
    const pct = Math.min(100, Math.round(((pts - current.min) / span) * 100));
    return { siguiente, pct, faltantes: Math.max(0, siguiente.min - pts) };
  }, [cliente, nivel, reglas]);

  const logros = useMemo(() => cliente ? calcularLogros(cliente) : [], [cliente]);
  const beneficiosActivos = useMemo(() => [
    {
      key: "level_discount",
      icon: nivel?.icon ?? "🥉",
      title: nivel && reglas[`descuento_${nivel.key}` as keyof typeof reglas]
        ? `${reglas[`descuento_${nivel.key}` as keyof typeof reglas]}% de descuento por nivel`
        : "Acumula para desbloquear descuentos",
      description: nivel && Number(reglas[`descuento_${nivel.key}` as keyof typeof reglas]) > 0
        ? `Tu nivel ${nivel.label} ya activa descuento base en tienda.`
        : "Sube a Plata para activar descuentos automáticos.",
      active: nivel ? Number(reglas[`descuento_${nivel.key}` as keyof typeof reglas] ?? 0) > 0 : false,
    },
    {
      key: "birthday_multiplier",
      icon: "🎂",
      title: esCumple ? "Puntos extra de cumpleaños activos" : "Campaña de cumpleaños",
      description: esCumple
        ? `Este mes acumulas puntos con multiplicador ${reglas[`multiplicador_cumple_${nivel?.key ?? "bronce"}` as keyof typeof reglas] ?? 1}×.`
        : "En tu mes de cumpleaños activas un multiplicador especial y acceso a premios temáticos.",
      active: esCumple,
    },
    {
      key: "referral",
      icon: "🤝",
      title: "Campaña de referidos",
      description: "Comparte tu código y gana 300 pts cuando tu referida compre por primera vez.",
      active: true,
    },
  ], [nivel, esCumple, reglas]);

  const recompensasDisponibles = useMemo(
    () => cliente ? catalogoDinamico.filter(r => isRewardEligibleDynamic(r, cliente, reglas, esCumple)) : [],
    [catalogoDinamico, cliente, reglas, esCumple]
  );

  const siguienteRecompensa = useMemo(() => {
    if (!cliente) return null;
    const pts = cliente.puntos_fidelidad ?? 0;
    return catalogoDinamico
      .filter(r => !isRewardEligibleDynamic(r, cliente, reglas, esCumple) && r.points_cost > pts)
      .sort((a, b) => a.points_cost - b.points_cost)[0] ?? null;
  }, [catalogoDinamico, cliente, reglas, esCumple]);

  const referralCode = useMemo(() => getReferralCode(cliente), [cliente]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPushPermission("unsupported");
      return;
    }
    setPushPermission(window.Notification.permission);

    const syncStatus = async () => {
      if (!("serviceWorker" in navigator)) {
        setPushEnabled(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          setPushEnabled(false);
          return;
        }
        const existing = await registration.pushManager.getSubscription();
        setPushEnabled(Boolean(existing));
      } catch {
        setPushEnabled(false);
      }
    };

    void syncStatus();
  }, []);

  const activarNotificacionesPush = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      message.warning("Este dispositivo no soporta notificaciones push web");
      return;
    }

    if (pushPermission === "denied") {
      message.warning("Las notificaciones están bloqueadas en el navegador. Debes habilitarlas manualmente en ajustes.");
      return;
    }

    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        message.warning("Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY para activar push real.");
        return;
      }

      if (!("serviceWorker" in navigator)) {
        message.warning("Este navegador no soporta Service Worker para push.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");

      const permission = await window.Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted") {
        setPushEnabled(false);
        return;
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perfilId: cliente?.id || null,
          subscription: subscription.toJSON(),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "No se pudo registrar la suscripción push");
      }

      setPushEnabled(true);
      message.success("Notificaciones activadas. Recibirás promociones incluso con la app cerrada.");
    } catch (pushError: unknown) {
      const errorMessage = pushError instanceof Error
        ? pushError.message
        : "No se pudieron activar las notificaciones push";
      message.error(errorMessage);
    }
  }, [cliente?.id, message, pushPermission]);

  useEffect(() => {
    if (!pushEnabled || !cliente?.id || typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const vincularPerfil = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perfilId: cliente.id,
            subscription: subscription.toJSON(),
          }),
        });
      } catch {
        // No bloquear UI si falla la vinculación de perfil con suscripción.
      }
    };

    void vincularPerfil();
  }, [cliente?.id, pushEnabled]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fff0f8 0%, #f9f0ff 55%, #ffe8f5 100%)", display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(16px, 5vw, 40px) 16px" }}>
      <div style={{ textAlign: "center", marginBottom: isMobile ? 16 : 32 }}>
        <div style={{ width: isMobile ? 56 : 72, height: isMobile ? 56 : 72, borderRadius: isMobile ? 16 : 20, background: "linear-gradient(135deg,#ff4fa3,#d81b87)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", boxShadow: "0 4px 20px rgba(216,27,135,0.3)" }}>
          <GiftOutlined style={{ color: "#fff", fontSize: isMobile ? 26 : 34 }} />
        </div>
        <Title level={isMobile ? 3 : 2} style={{ margin: 0, color: BRAND_FUCHSIA, lineHeight: 1.15 }}>Club La Cosmetikera</Title>
        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Puntos, recompensas, vouchers y campañas activas del club</Text>
      </div>

      {!cliente && (
        <Card style={{ width: "100%", maxWidth: 560, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 24 }}>
          <Space direction="vertical" size={4} style={{ marginBottom: 16 }}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 0 }}>Ingresa tu número de cédula</Title>
          </Space>
          <Form onFinish={buscar}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                prefix={<SearchOutlined style={{ color: "#d81b87" }} />}
                placeholder="Ej: 1234567890"
                value={acceso}
                onChange={(event) => setAcceso(event.target.value.replace(/\D/g, ""))}
                size="large"
                maxLength={15}
                inputMode="numeric"
                autoFocus
                autoComplete="off"
              />
              <Button type="primary" size="large" loading={buscando} onClick={buscar} style={{ background: BRAND_FUCHSIA, borderColor: BRAND_FUCHSIA }}>
                Entrar
              </Button>
            </Space.Compact>
          </Form>
          {error && <Alert type="warning" message={error} showIcon style={{ marginTop: 12, borderRadius: 8 }} />}
        </Card>
      )}

      {buscando && <Spin size="large" style={{ margin: "32px 0" }} />}

      {cliente && nivel && (
        <div style={{ width: "100%", maxWidth: 980, boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <PwaInstallPrompt
              inline
              buttonOnly
              buttonLabel="Instalar app"
              helperText="Instala la app para ver ofertas, puntos y promociones más rápido."
              dismissKey="club-portal-install"
              autoHideDays={14}
            />
          </div>

          <Card
            style={{ borderRadius: 16, marginBottom: 12, background: `linear-gradient(135deg, ${nivel.color}18, ${nivel.color}30)`, border: `2px solid ${nivel.color}` }}
            styles={{ body: { padding: isMobile ? 14 : 20 } }}
          >
            <Row align="middle" gutter={[12, 12]}>
              <Col>
                <Avatar size={isMobile ? 50 : 64} style={{ background: nivel.color, fontSize: isMobile ? 21 : 26 }}>{cliente.nombre_completo[0]?.toUpperCase()}</Avatar>
              </Col>
              <Col flex="auto">
                <Space direction="vertical" size={isMobile ? 1 : 2}>
                  <Space wrap>
                    <Title level={isMobile ? 5 : 4} style={{ margin: 0, lineHeight: 1.1 }}>{cliente.nombre_completo}</Title>
                    {esCumple && <Tag color="pink" style={{ marginInlineEnd: 0 }}>Mes de cumpleaños activo</Tag>}
                    <Tag style={{ background: nivel.color, color: "#fff", border: "none", fontSize: isMobile ? 11 : 13, padding: isMobile ? "0 8px" : "2px 12px", marginInlineEnd: 0 }}>{nivel.icon} {nivel.label}</Tag>
                  </Space>
                  {cliente.cedula && <Text type="secondary" style={{ fontSize: 12 }}>CC: {cliente.cedula}</Text>}
                  <Button
                    size="small"
                    onClick={() => {
                      setCliente(null);
                      setAcceso("");
                      setError("");
                      setHistorial([]);
                      setCanjes([]);
                      setRecomendaciones([]);
                      setReferidoAplicado(false);
                      setCodigoReferidoIngresado("");
                      setCanjeModalOpen(false);
                      setRewardPendiente(null);
                      setTelefonoCanje("");
                    }}
                    style={{ marginTop: 4, color: "#888", borderColor: "#ddd", fontSize: 11 }}
                  >
                    ← Cambiar cédula
                  </Button>
                </Space>
              </Col>
            </Row>

            <Divider style={{ margin: isMobile ? "12px 0" : "16px 0" }} />

            <Row gutter={[10, 10]}>
              <Col xs={12} md={6}>
                <div style={{ background: "rgba(255,255,255,0.72)", borderRadius: 12, padding: "8px 10px" }}>
                  <Text style={{ fontSize: 11, color: "#666", display: "block", lineHeight: 1.15 }}>Puntos disponibles</Text>
                  <Text style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, color: nivel.color, lineHeight: 1.2 }}>
                    {(cliente.puntos_fidelidad || 0).toLocaleString()}
                  </Text>
                </div>
              </Col>
              <Col xs={12} md={6}>
                <div style={{ background: "rgba(255,255,255,0.72)", borderRadius: 12, padding: "8px 10px" }}>
                  <Text style={{ fontSize: 11, color: "#666", display: "block", lineHeight: 1.15 }}>Puntos canjeados</Text>
                  <Text style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: "#52c41a", lineHeight: 1.2 }}>
                    {(cliente.puntos_canjeados || 0).toLocaleString()}
                  </Text>
                </div>
              </Col>
              <Col xs={12} md={6}>
                <div style={{ background: "rgba(255,255,255,0.72)", borderRadius: 12, padding: "8px 10px" }}>
                  <Text style={{ fontSize: 11, color: "#666", display: "block", lineHeight: 1.15 }}>Rewards desbloqueadas</Text>
                  <Text style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: "#d81b87", lineHeight: 1.2 }}>
                    {recompensasDisponibles.length}
                  </Text>
                </div>
              </Col>
              <Col xs={12} md={6}>
                <div style={{ background: "rgba(255,255,255,0.72)", borderRadius: 12, padding: "8px 10px" }}>
                  <Text style={{ fontSize: 11, color: "#666", display: "block", lineHeight: 1.15 }}>Valor canjeable hoy</Text>
                  <Text style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: "#722ed1", lineHeight: 1.2 }}>
                    ${recompensasDisponibles.reduce((sum, reward) => sum + reward.value_cop, 0).toLocaleString()}
                  </Text>
                </div>
              </Col>
            </Row>

            {progreso ? (
              <div style={{ marginTop: 12 }}>
                <Row justify="space-between" style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "#666" }}>Progreso hacia {progreso.siguiente.icon} {progreso.siguiente.label}</Text>
                  <Text style={{ fontSize: 12, color: "#666" }}>Faltan {progreso.faltantes.toLocaleString()} pts</Text>
                </Row>
                <Progress
                  percent={progreso.pct}
                  strokeColor={{
                    "0%": nivel?.color ?? BRAND_FUCHSIA,
                    "100%": progreso.siguiente.color ?? BRAND_FUCHSIA_SOFT,
                  }}
                />
              </div>
            ) : (
              <Alert style={{ marginTop: 12, borderRadius: 8 }} type="success" message="Estás en el nivel más alto del club." showIcon />
            )}

          </Card>

          <Tabs
            activeKey={tabActiva}
            onChange={setTabActiva}
            style={{ marginTop: 4 }}
            items={[
              {
                key: "resumen",
                label: "Resumen",
                children: (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                      <Card style={sectionCardStyle} title={<Space><TrophyOutlined style={{ color: BRAND_FUCHSIA }} /><Text strong>Beneficios activos</Text></Space>}>
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
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card style={sectionCardStyle} title={<Space><StarOutlined style={{ color: BRAND_FUCHSIA }} /><Text strong>Siguiente recompensa</Text></Space>}>
                        {siguienteRecompensa ? (
                          <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            <Text strong style={{ fontSize: 16 }}>{siguienteRecompensa.icon} {siguienteRecompensa.title}</Text>
                            <Text type="secondary">{siguienteRecompensa.description}</Text>
                            <Space wrap>
                              <Tag color="purple">{siguienteRecompensa.points_cost.toLocaleString()} pts</Tag>
                              <Tag color="green">${siguienteRecompensa.value_cop.toLocaleString()}</Tag>
                            </Space>
                            <Alert type="info" showIcon message={`Te faltan ${Math.max(0, siguienteRecompensa.points_cost - (cliente.puntos_fidelidad || 0)).toLocaleString()} pts para desbloquearla.`} style={{ borderRadius: 10 }} />
                          </Space>
                        ) : (
                          <Alert type="success" showIcon message="Ya tienes desbloqueadas todas las recompensas compatibles con tu nivel actual." style={{ borderRadius: 10 }} />
                        )}
                      </Card>

                      <Card style={sectionCardStyle} title={<Space><GiftOutlined style={{ color: BRAND_FUCHSIA }} /><Text strong>Recomendadas para ti</Text></Space>}>
                        {loadingRecomendaciones ? (
                          <Spin />
                        ) : recomendaciones.length === 0 ? (
                          <Alert
                            type="info"
                            showIcon
                            style={{ borderRadius: 10 }}
                            message="Aún no tenemos suficientes compras para personalizar recomendaciones."
                            description="Cuando registres más compras, te sugeriremos productos alineados con tu estilo."
                          />
                        ) : (
                          <Space direction="vertical" size={10} style={{ width: "100%" }}>
                            {recomendaciones.map((producto) => (
                              <div key={producto.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #ffd6e7", background: "#fff" }}>
                                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                                  <Space wrap>
                                    <Text strong>{producto.nombre}</Text>
                                    {producto.descuento_porcentaje ? <Tag color="red">{producto.descuento_porcentaje}% OFF</Tag> : null}
                                    {producto.categoria ? <Tag>{producto.categoria}</Tag> : null}
                                  </Space>
                                  <Text type="secondary" style={{ fontSize: 12 }}>{producto.razon}</Text>
                                  <Text style={{ color: BRAND_FUCHSIA, fontWeight: 700 }}>
                                    ${(producto.precio_venta || 0).toLocaleString()}
                                  </Text>
                                </Space>
                              </div>
                            ))}
                          </Space>
                        )}
                      </Card>

                      <Card style={sectionCardStyle} title={<Space><StarOutlined style={{ color: BRAND_FUCHSIA }} /><Text strong>Tus logros</Text><Tag>{logros.length}/{LOGROS_CATALOGO.length}</Tag></Space>}>
                        <Progress percent={Math.round((logros.length / LOGROS_CATALOGO.length) * 100)} strokeColor={{ "0%": BRAND_FUCHSIA, "100%": BRAND_FUCHSIA_SOFT }} style={{ marginBottom: 16 }} />
                        <Row gutter={[12, 16]}>
                          {LOGROS_CATALOGO.map((achievement) => {
                            const unlocked = logros.includes(achievement.key);
                            return (
                              <Col key={achievement.key} xs={8} sm={6} style={{ textAlign: "center" }}>
                                <Tooltip title={`${achievement.titulo}: ${achievement.desc}`}>
                                  <div>
                                    <div style={{ width: 52, height: 52, borderRadius: "50%", margin: "0 auto 4px", background: unlocked ? "linear-gradient(135deg,#fff2f8,#ffd6e7)" : "#f5f5f5", border: `2px solid ${unlocked ? BRAND_FUCHSIA_SOFT : "#e0e0e0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, opacity: unlocked ? 1 : 0.35, filter: unlocked ? "none" : "grayscale(100%)", boxShadow: unlocked ? "0 2px 8px rgba(216,27,135,0.28)" : "none" }}>
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
                ),
              },
              {
                key: "recompensas",
                label: "Recompensas",
                children: (
                  <Row gutter={[16, 16]}>
                    <Col xs={24}>
                      <Card style={sectionCardStyle} title={<Space><GiftOutlined style={{ color: BRAND_FUCHSIA }} /><Text strong>Catálogo de recompensas</Text></Space>} extra={<Tag color="magenta">{recompensasDisponibles.length} disponibles</Tag>}>
                        <Row gutter={[12, 12]}>
                          {loadingConfig ? <Col span={24}><Spin /></Col> : catalogoDinamico.map((reward) => {
                            const unlocked = isRewardEligibleDynamic(reward, cliente, reglas, esCumple);
                            const faltantes = Math.max(0, reward.points_cost - (cliente.puntos_fidelidad || 0));
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
                                      <Tag color="purple">{reward.points_cost.toLocaleString()} pts</Tag>
                                      <Tag color="green">${reward.value_cop.toLocaleString()}</Tag>
                                      {reward.level_min && <Tag>{reward.level_min}</Tag>}
                                      {reward.birthday_only && <Tag color="pink">solo cumpleaños</Tag>}
                                    </Space>
                                    {!unlocked && (
                                      <Alert
                                        type="info"
                                        showIcon
                                        message={reward.birthday_only && !esCumple ? "Disponible solo en tu mes de cumpleaños" : faltantes > 0 ? `Te faltan ${faltantes.toLocaleString()} pts` : "Tu nivel aún no la desbloquea"}
                                        style={{ borderRadius: 10 }}
                                      />
                                    )}
                                    <Button
                                      type={unlocked ? "primary" : "default"}
                                      disabled={!unlocked}
                                      loading={canjeando === reward.key}
                                      onClick={() => solicitarCanje(reward.key)}
                                      style={unlocked ? { background: BRAND_FUCHSIA, borderColor: BRAND_FUCHSIA } : undefined}
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

                      <Card style={sectionCardStyle} title={<Space><GiftOutlined style={{ color: BRAND_FUCHSIA }} /><Text strong>Mis vouchers y canjes</Text></Space>}>
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
                  </Row>
                ),
              },
              {
                key: "actividad",
                label: "Actividad",
                children: (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={14}>
                      <Card style={sectionCardStyle} title={<Space><GiftOutlined style={{ color: BRAND_FUCHSIA }} />Historial de puntos</Space>}>
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

                      <Card style={sectionCardStyle} title="Campañas del club">
                        <Space direction="vertical" size={12} style={{ width: "100%" }}>
                          <div style={{ padding: 12, borderRadius: 12, background: esCumple ? "#fff0f6" : "#fff2f8", border: `1px solid ${esCumple ? "#ffadd2" : "#ffc1dd"}` }}>
                            <Space direction="vertical" size={4}>
                              <Text strong>🎂 Campaña de cumpleaños</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {esCumple ? "Este mes tienes multiplicador de puntos activo y acceso a recompensas especiales." : "Cuando llegue tu mes de cumpleaños se activarán puntos extra y premios temáticos."}
                              </Text>
                            </Space>
                          </div>
                          <div style={{ padding: 12, borderRadius: 12, background: "#fff2f8", border: "1px solid #ffc1dd" }}>
                            <Space direction="vertical" size={6} style={{ width: "100%" }}>
                              <Text strong>🤝 Campaña de referidos</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>Tu código personal suma 300 pts cuando tu referida haga su primera compra.</Text>
                              <Space wrap style={{ width: "100%" }}>
                                <Tag color="purple" style={{ fontSize: 13, padding: "4px 10px", borderRadius: 8 }}>{referralCode}</Tag>
                                <Button icon={<CopyOutlined />} onClick={() => copiar(referralCode)}>Copiar código</Button>
                                <Button icon={<ShareAltOutlined />} onClick={compartirReferido}>Compartir</Button>
                              </Space>
                              <Divider style={{ margin: "8px 0" }} />
                              <Text type="secondary" style={{ fontSize: 12 }}>¿Alguien te refirió? Ingresa su código y le acreditamos 300 puntos:</Text>
                              {referidoAplicado ? (
                                <Tag color="success" style={{ fontSize: 12 }}>✅ Código de referido ya aplicado</Tag>
                              ) : (
                                <Space.Compact style={{ width: "100%" }}>
                                  <Input
                                    placeholder="COSM-XXXXXXXX"
                                    value={codigoReferidoIngresado}
                                    onChange={e => setCodigoReferidoIngresado(e.target.value.toUpperCase())}
                                    style={{ textTransform: "uppercase", letterSpacing: 1 }}
                                    maxLength={13}
                                    onPressEnter={aplicarCodigoReferido}
                                  />
                                  <Button
                                    type="primary"
                                    loading={aplicandoReferido}
                                    onClick={aplicarCodigoReferido}
                                    disabled={!codigoReferidoIngresado.trim()}
                                  >
                                    Aplicar
                                  </Button>
                                </Space.Compact>
                              )}
                            </Space>
                          </div>
                        </Space>
                      </Card>
                    </Col>

                    <Col xs={24} lg={10}>
                      <Card style={sectionCardStyle} title={<Space><BellOutlined style={{ color: BRAND_FUCHSIA }} /><Text strong>Notificaciones de promociones</Text></Space>}>
                        <Space direction="vertical" size={10} style={{ width: "100%" }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Activa notificaciones para recibir en tu teléfono las promociones publicadas desde Marketing Center.
                          </Text>
                          <Space wrap>
                            <Tag color={pushEnabled ? "success" : "default"}>
                              {pushPermission === "unsupported"
                                ? "No soportado"
                                : pushEnabled
                                  ? "Activo"
                                  : pushPermission === "denied"
                                    ? "Bloqueado"
                                    : "Pendiente"}
                            </Tag>
                            <Button
                              type="primary"
                              onClick={activarNotificacionesPush}
                              disabled={pushPermission === "unsupported" || pushPermission === "denied"}
                              style={{ background: BRAND_FUCHSIA, borderColor: BRAND_FUCHSIA }}
                            >
                              Activar notificaciones
                            </Button>
                          </Space>
                          {pushPermission === "denied" && (
                            <Alert
                              type="warning"
                              showIcon
                              style={{ borderRadius: 10 }}
                              message="Notificaciones bloqueadas"
                              description="Habilítalas en la configuración del navegador para recibir promociones en este dispositivo."
                            />
                          )}
                        </Space>
                      </Card>

                      <Card style={sectionCardStyle} title="Cómo ganar más puntos">
                        <Space direction="vertical" size={10} style={{ width: "100%" }}>
                          {[
                            { icon: "💵", text: "Gana 1 punto por cada $1.000 de compra." },
                            { icon: "🎂", text: "El mes de tu cumpleaños se activan puntos extra según tu nivel." },
                            { icon: "🤝", text: "Recibe 300 pts cuando una referida compre por primera vez." },
                            { icon: "🔥", text: "Mantén tu racha mensual para desbloquear logros." },
                            { icon: "🎟️", text: "Convierte tus puntos en vouchers que ya funcionan en caja." },
                          ].map((item) => (
                            <div key={item.text} style={{ padding: 12, borderRadius: 12, background: "#fff", border: "1px solid #ffd6e7" }}>
                              <Space>
                                <span style={{ fontSize: 18 }}>{item.icon}</span>
                                <Text style={{ fontSize: 12 }}>{item.text}</Text>
                              </Space>
                            </div>
                          ))}
                        </Space>
                      </Card>

                      <Card style={{ ...sectionCardStyle, background: "linear-gradient(135deg,#fff0f8,#ffd6e7)" }}>
                        <Space direction="vertical" size={12} style={{ width: "100%" }}>
                          <Title level={5} style={{ margin: 0, color: BRAND_FUCHSIA }}>¿Qué necesitas hoy? Habla con una asesora 💬</Title>
                          <Text style={{ fontSize: 13 }}>
                            Elige tu preocupación y recibe una recomendación profesional y personalizada por WhatsApp — rápido, sin citas y con precios al día.
                          </Text>
                          {[
                            {
                              emoji: "💆‍♀️",
                              label: "Caída del cabello",
                              msg: "Hola, tengo problema de caida del cabello y quiero una recomendacion profesional. Me puedes orientar con los mejores productos segun mi tipo de cabello y presupuesto?",
                            },
                            {
                              emoji: "✨",
                              label: "Alisado / Keratina",
                              msg: "Hola, quiero alisar o hacer keratina en casa. Me puedes recomendar los mejores productos para alisado segun mi tipo de cabello? Cual es el mas efectivo y duradero?",
                            },
                            {
                              emoji: "🎨",
                              label: "Coloración / Tintes",
                              msg: "Hola, quiero colorarme el cabello en casa. Me puedes orientar con tintes o decolorantes? Que necesito para un buen resultado y cuidar mi cabello?",
                            },
                            {
                              emoji: "💧",
                              label: "Hidratación y nutrición",
                              msg: "Hola, mi cabello esta reseco y sin vida. Que tratamientos o productos me recomiendas para hidratar y nutrir profundamente mi cabello desde casa?",
                            },
                            {
                              emoji: "💄",
                              label: "Maquillaje",
                              msg: "Hola, quiero mejorar mi rutina de maquillaje. Me puedes recomendar productos como base, corrector, labiales o sombras segun mi tono de piel y presupuesto?",
                            },
                            {
                              emoji: "💅",
                              label: "Uñas",
                              msg: "Hola, quiero cuidar o decorar mis unas en casa. Me puedes recomendar esmaltes, geles, nail art o productos para fortalecer las unas?",
                            },
                          ].map(({ emoji, label, msg }) => (
                            <Button
                              key={label}
                              block
                              icon={<PhoneOutlined />}
                              style={{ background: "#25D366", borderColor: "#25D366", color: "#fff", textAlign: "left", height: "auto", padding: "10px 16px" }}
                              onClick={() => window.open(buildWhatsAppLink(msg), "_blank")}
                            >
                              <span style={{ fontSize: 16, marginRight: 8 }}>{emoji}</span>{label}
                            </Button>
                          ))}
                          <Button
                            block
                            onClick={() =>
                              window.open(
                                buildWhatsAppLink("Hola, quiero consultar mis puntos del Club La Cosmetikera y recibir recomendaciones personalizadas."),
                                "_blank",
                              )
                            }
                          >
                            🏅 Consultar mis puntos del Club
                          </Button>
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                ),
              },
            ]}
          />

          <Modal
            title="Confirmar canje con teléfono"
            open={canjeModalOpen}
            onCancel={() => {
              setCanjeModalOpen(false);
              setRewardPendiente(null);
              setTelefonoCanje("");
            }}
            onOk={confirmarCanje}
            okText="Confirmar canje"
            cancelText="Cancelar"
            confirmLoading={!!rewardPendiente && canjeando === rewardPendiente}
          >
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              <Text type="secondary">Para seguridad, ingresa el teléfono registrado de la clienta para este canje.</Text>
              <Input
                prefix={<PhoneOutlined style={{ color: "#d81b87" }} />}
                placeholder="Ej: 3001234567"
                value={telefonoCanje}
                onChange={(event) => setTelefonoCanje(event.target.value.replace(/\D/g, ""))}
                maxLength={15}
                onPressEnter={confirmarCanje}
              />
            </Space>
          </Modal>
        </div>
      )}

      <Text type="secondary" style={{ marginTop: 32, fontSize: 11 }}>La Cosmetikera · Club de fidelización</Text>
    </div>
  );
}
