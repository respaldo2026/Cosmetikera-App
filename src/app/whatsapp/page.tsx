"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Input,
  Avatar,
  Badge,
  Spin,
  Empty,
  Typography,
  Tooltip,
  Tag,
  Button,
  Modal,
  InputNumber,
  Alert,
} from "antd";
import {
  SearchOutlined,
  CheckOutlined,
  RobotOutlined,
  LeftOutlined,
  ReloadOutlined,
  SendOutlined,
  BugOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Conversation = {
  telefono: string;
  nombre: string;
  ultimo_mensaje: string;
  ultimo_rol: string;
  created_at: string;
  total: number;
  es_plantilla?: boolean;
};

type Message = {
  id: string;
  telefono: string;
  rol: "cliente" | "agente";
  mensaje: string;
  tipo_mensaje: string;
  intento: string | null;
  created_at: string;
  perfil_id: string | null;
};

async function fetchWithTimeout(input: RequestInfo | URL, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function toTimestamp(value: unknown): number {
  const t = Date.parse(String(value || ""));
  return Number.isFinite(t) ? t : 0;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function formatListTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
  if (diffDays === 0)
    return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (diffDays === 1) return "Ayer";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function getInitials(name: string, phone: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    const first = parts[0] ?? "";
    const second = parts[1] ?? "";
    return parts.length >= 2
      ? ((first[0] ?? "") + (second[0] ?? "")).toUpperCase()
      : first.slice(0, 2).toUpperCase();
  }
  return phone.slice(-2) || "?";
}

function getAvatarColor(phone: string): string {
  const colors = [
    "#25D366", "#128C7E", "#075E54", "#34B7F1",
    "#ECE5DD", "#9C27B0", "#E91E63", "#FF5722",
    "#3F51B5", "#009688",
  ];
  const hash = phone.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length] ?? "#128C7E";
}

function extractClientNameFromTemplateText(text: string): string {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const patterns = [
    /bienvenida\s+enviada\s+a\s+(.+)$/i,
    /bienvenida\s+para\s+([^|\n]+)(?:\||$)/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const candidate = String(match?.[1] || "").trim();
    if (candidate) return candidate;
  }
  return "";
}

// Separador de fecha entre mensajes
function groupMessagesByDate(messages: Message[]): Array<Message | { type: "separator"; label: string }> {
  const result: Array<Message | { type: "separator"; label: string }> = [];
  let lastDate = "";
  for (const msg of messages) {
    const d = new Date(msg.created_at);
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dateKey !== lastDate) {
      result.push({ type: "separator", label: formatDate(msg.created_at) });
      lastDate = dateKey;
    }
    result.push(msg);
  }
  return result;
}

// ── Renderizador de formato WhatsApp (*negrita*, _cursiva_, ~tachado~, saltos) ─
function renderWhatsApp(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  // Captura: *negrita*, _cursiva_, ~tachado~ y saltos de línea
  const regex = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|\n)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token === "\n") {
      parts.push(<br key={key++} />);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{token.slice(1, -1)}</strong>);
    } else if (token.startsWith("_") && token.endsWith("_")) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("~") && token.endsWith("~")) {
      parts.push(<del key={key++}>{token.slice(1, -1)}</del>);
    } else {
      parts.push(token);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

// ── Componente burbuja de mensaje ─────────────────────────────────────────────
const MessageBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  const isClient = msg.rol === "cliente";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isClient ? "flex-end" : "flex-start",
        marginBottom: 2,
        padding: "0 16px",
      }}
    >
      <div
        style={{
          maxWidth: "72%",
          backgroundColor: isClient ? "#DCF8C6" : "#FFFFFF",
          borderRadius: isClient ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "8px 12px 6px 12px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
          position: "relative",
          wordBreak: "break-word",
        }}
      >
        {/* Etiqueta "Agente IA" solo para mensajes del agente */}
        {!isClient && (
          <div style={{ marginBottom: 2 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#128C7E",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <RobotOutlined style={{ fontSize: 10 }} />
              Agente IA
            </Text>
          </div>
        )}
        <Text style={{ fontSize: 14, color: "#111", lineHeight: "20px", display: "block" }}>
          {renderWhatsApp(msg.mensaje)}
        </Text>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 4,
            marginTop: 3,
          }}
        >
          {msg.intento && (
            <Tooltip title={`Intención: ${msg.intento}`}>
              <Tag
                style={{
                  fontSize: 9,
                  padding: "0 4px",
                  height: 14,
                  lineHeight: "14px",
                  borderRadius: 4,
                  margin: 0,
                  opacity: 0.7,
                  cursor: "default",
                }}
                color="blue"
              >
                {msg.intento}
              </Tag>
            </Tooltip>
          )}
          <Text style={{ fontSize: 11, color: "#999" }}>{formatTime(msg.created_at)}</Text>
          {isClient && (
            <CheckOutlined style={{ fontSize: 10, color: "#34B7F1" }} />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Componente principal ───────────────────────────────────────────────────────
export default function WhatsAppMonitorPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [clientName, setClientName] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState("");
  const [hasLoadedList, setHasLoadedList] = useState(false);
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const isFetchingListRef = useRef(false);
  const isFetchingMessagesRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const isResizingPanelRef = useRef(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(360);

  // ── Estado modal retry bienvenida ────────────────────────────
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryStep, setRetryStep] = useState<"idle" | "checked" | "sent">("idle");
  const [retryLimit, setRetryLimit] = useState<number>(100);
  const [retryLoading, setRetryLoading] = useState(false);
  type RetryResult = {
    dry_run: boolean;
    sent: number;
    failed: number;
    already_sent: number;
    skipped_invalid: number;
    details: Array<{ telefono: string; nombre: string; status: string; error?: string }>;
  };
  const [retryResult, setRetryResult] = useState<RetryResult | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const callRetryEndpoint = async (dryRun: boolean) => {
    setRetryLoading(true);
    setRetryError(null);
    try {
      const res = await fetch("/api/whatsapp/retry-club-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: dryRun, limit: retryLimit }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRetryError(json?.error || `Error ${res.status}`);
      } else {
        setRetryResult(json as RetryResult);
        setRetryStep(dryRun ? "checked" : "sent");
      }
    } catch (e) {
      setRetryError(String(e));
    } finally {
      setRetryLoading(false);
    }
  };

  const openRetryModal = () => {
    setRetryModalOpen(true);
    setRetryStep("idle");
    setRetryResult(null);
    setRetryError(null);
  };

  // ── Estado modal diagnóstico ───────────────────────────
  const [diagnoseModalOpen, setDiagnoseModalOpen] = useState(false);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  type DiagnoseCheck = {
    name: string;
    status: "ok" | "warn" | "fail";
    detail: string;
    action?: string;
    data?: Record<string, unknown>;
  };
  type DiagnoseResult = {
    success: boolean;
    summary: { fail: number; warn: number; ok: number };
    config: { template_name: string; template_language: string; phone_number_id: string; waba_id: string };
    checks: DiagnoseCheck[];
    generated_at: string;
    error?: string;
  };
  const [diagnoseResult, setDiagnoseResult] = useState<DiagnoseResult | null>(null);
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null);

  const runDiagnose = async () => {
    setDiagnoseLoading(true);
    setDiagnoseResult(null);
    setDiagnoseError(null);
    try {
      const res = await fetch("/api/whatsapp/diagnose", { method: "GET", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setDiagnoseError(json?.error || `Error ${res.status}`);
      } else {
        setDiagnoseResult(json as DiagnoseResult);
      }
    } catch (e) {
      setDiagnoseError(String(e));
    } finally {
      setDiagnoseLoading(false);
    }
  };

  type LoadOptions = {
    silent?: boolean;
  };

  // ── Cargar lista de conversaciones ───────────────────────────────
  const loadConversations = useCallback(async (q = "", options?: LoadOptions) => {
    if (isFetchingListRef.current && options?.silent) return;
    isFetchingListRef.current = true;

    if (!options?.silent && !hasLoadedList) setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      const res = await fetchWithTimeout(`/api/whatsapp/conversations?${params}`);
      const json = await res.json();
      if (json.conversations) {
        const ordered = [...json.conversations].sort(
          (a: Conversation, b: Conversation) => toTimestamp(b.created_at) - toTimestamp(a.created_at),
        );
        setConversations(ordered);
      }
      setHasLoadedList(true);
    } catch {
      // silencioso
    } finally {
      if (!options?.silent) setLoadingList(false);
      isFetchingListRef.current = false;
    }
  }, [hasLoadedList]);

  // ── Cargar mensajes de un teléfono ───────────────────────────────
  const loadMessages = useCallback(async (phone: string, options?: LoadOptions) => {
    if (isFetchingMessagesRef.current && options?.silent) return;
    isFetchingMessagesRef.current = true;

    if (!options?.silent && !hasLoadedMessages) setLoadingMessages(true);
    if (!options?.silent) setClientName("");
    try {
      const res = await fetchWithTimeout(`/api/whatsapp/conversations?phone=${encodeURIComponent(phone)}`);
      const json = await res.json();
      if (json.messages) setMessages(json.messages);
      const resolvedName = String(json.clientName || "").trim();
      setClientName(resolvedName);
      if (resolvedName) {
        setConversations((prev) =>
          prev.map((c) =>
            c.telefono === phone && !String(c.nombre || "").trim()
              ? { ...c, nombre: resolvedName }
              : c
          )
        );
      }
      setHasLoadedMessages(true);
    } catch {
      // silencioso
    } finally {
      if (!options?.silent) setLoadingMessages(false);
      isFetchingMessagesRef.current = false;
    }
  }, [hasLoadedMessages]);

  // Carga inicial
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const updateLayout = () => {
      setIsMobile(window.innerWidth < 992);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingPanelRef.current || isMobile) return;
      const root = rootRef.current;
      if (!root) return;

      const rect = root.getBoundingClientRect();
      const proposed = event.clientX - rect.left;
      const nextWidth = Math.max(280, Math.min(560, proposed));
      setLeftPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      if (!isResizingPanelRef.current) return;
      isResizingPanelRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isMobile]);

  const startResizePanel = () => {
    if (isMobile) return;
    isResizingPanelRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  // Auto-scroll al último mensaje SOLO si el usuario está cerca del final
  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    // Si está a <= 80px del final, permitimos auto-scroll en nuevas actualizaciones
    shouldStickToBottomRef.current = distanceFromBottom <= 80;
  };

  // Polling: refresca la conversación activa cada 8 s
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (!selectedPhone) return;

    refreshTimerRef.current = setInterval(() => {
      loadMessages(selectedPhone, { silent: true });
      loadConversations(search, { silent: true });
    }, 10000);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [selectedPhone, loadMessages, loadConversations, search]);

  const handleSelectConversation = (phone: string) => {
    setSelectedPhone(phone);
    setClientName("");
    setHasLoadedMessages(false);
    setLoadingMessages(true);
    loadMessages(phone);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    loadConversations(value);
  };

  const grouped = groupMessagesByDate(messages);

  const displayName =
    clientName ||
    conversations.find((c) => c.telefono === selectedPhone)?.nombre ||
    selectedPhone ||
    "";

  const avatarBg = selectedPhone ? getAvatarColor(selectedPhone) : "#128C7E";
  const initials = getInitials(displayName, selectedPhone || "");

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        height: "calc(100vh - 72px)",
        background: "linear-gradient(180deg, #eef3f6 0%, #f6f8fa 100%)",
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        overflow: "hidden",
        padding: isMobile ? 0 : 12,
        gap: 0,
      }}
    >
      {/* ── Panel izquierdo: lista de conversaciones ─────────────── */}
      <div
        style={{
          width: isMobile ? "100%" : leftPanelWidth,
          minWidth: isMobile ? "100%" : 300,
          borderRight: isMobile ? "none" : "1px solid #e0e0e0",
          background: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRadius: isMobile ? 0 : 14,
          boxShadow: isMobile ? "none" : "0 6px 22px rgba(0,0,0,0.06)",
          overflow: "hidden",
          height: "100%",
          visibility: isMobile && selectedPhone ? "hidden" : "visible",
          position: isMobile && selectedPhone ? "absolute" : "relative",
        }}
      >
        {/* Header lista */}
        <div
          style={{
            background: "#128C7E",
            padding: "14px 16px 10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <Text style={{ color: "#fff", fontWeight: 700, fontSize: 16, display: "block" }}>
              WhatsApp Bot
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
              {conversations.length} conversación(es)
            </Text>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Tooltip title="Diagnóstico de WhatsApp">
              <BugOutlined
                style={{ color: "#fff", cursor: "pointer", fontSize: 16 }}
                onClick={() => { setDiagnoseModalOpen(true); setDiagnoseResult(null); setDiagnoseError(null); }}
              />
            </Tooltip>
            <Tooltip title="Reenviar bienvenida club a clientes pendientes">
              <SendOutlined
                style={{ color: "#fff", cursor: "pointer", fontSize: 16 }}
                onClick={() => openRetryModal()}
              />
            </Tooltip>
            <Tooltip title="Actualizar">
              <ReloadOutlined
                style={{ color: "#fff", cursor: "pointer", fontSize: 16 }}
                onClick={() => loadConversations(search)}
              />
            </Tooltip>
          </div>
        </div>

        {/* Buscador */}
        <div style={{ padding: "8px 10px", background: "#f6f6f6", borderBottom: "1px solid #e9e9e9" }}>
          <Input
            prefix={<SearchOutlined style={{ color: "#888" }} />}
            placeholder="Buscar por nombre o número"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            allowClear
            style={{ borderRadius: 20, background: "#fff", border: "none" }}
          />
        </div>

        {/* Lista de conversaciones */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loadingList ? (
            <div style={{ textAlign: "center", padding: 32 }}>
              <Spin />
            </div>
          ) : conversations.length === 0 ? (
            <Empty
              description="Sin conversaciones"
              style={{ padding: 32 }}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.telefono === selectedPhone;
              const inferredName = extractClientNameFromTemplateText(conv.ultimo_mensaje || "");
              const name = conv.nombre || inferredName || conv.telefono;
              const bg = getAvatarColor(conv.telefono);
              const ini = getInitials(name, conv.telefono);
              return (
                <div
                  key={conv.telefono}
                  onClick={() => handleSelectConversation(conv.telefono)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    cursor: "pointer",
                    background: isSelected ? "#f0f9f7" : "#fff",
                    borderBottom: "1px solid #f2f2f2",
                    transition: "background 0.15s",
                    borderLeft: isSelected ? "4px solid #25D366" : "4px solid transparent",
                  }}
                >
                  <Avatar
                    size={46}
                    style={{ background: bg, flexShrink: 0, fontWeight: 700, fontSize: 15 }}
                  >
                    {ini}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <Text
                          ellipsis
                          style={{ fontWeight: 600, fontSize: 14, color: "#111", maxWidth: 140 }}
                        >
                          {name}
                        </Text>
                        {conv.es_plantilla && (
                          <Tooltip title="Incluye plantilla de bienvenida enviada">
                            <Tag
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                height: 18,
                                lineHeight: "18px",
                                borderRadius: 4,
                                background: "#e6f7ff",
                                border: "1px solid #91d5ff",
                                color: "#0050b3",
                                marginRight: 0,
                                whiteSpace: "nowrap",
                              }}
                            >
                              📧 Plantilla
                            </Tag>
                          </Tooltip>
                        )}
                      </div>
                      <Text style={{ fontSize: 11, color: "#aaa", flexShrink: 0 }}>
                        {formatListTime(conv.created_at)}
                      </Text>
                    </div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Text
                        ellipsis
                        style={{ fontSize: 12, color: "#777", maxWidth: 190 }}
                      >
                        {conv.ultimo_rol === "agente" ? (
                          <span style={{ color: "#128C7E" }}>
                            <RobotOutlined style={{ marginRight: 3 }} />
                          </span>
                        ) : null}
                        {conv.ultimo_mensaje.replace(/\*([^*\n]+)\*/g, "$1").replace(/_([^_\n]+)_/g, "$1").replace(/~([^~\n]+)~/g, "$1").slice(0, 60)}
                      </Text>
                      {conv.total > 0 && (
                        <Badge
                          count={conv.total}
                          overflowCount={99}
                          style={{
                            backgroundColor: "#25D366",
                            fontSize: 10,
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Modal diagnóstico WhatsApp ─────────────────────── */}
      <Modal
        title="Diagnóstico WhatsApp"
        open={diagnoseModalOpen}
        onCancel={() => setDiagnoseModalOpen(false)}
        footer={null}
        width={600}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Alert
            message="Verifica en tiempo real si el token, las plantillas y la base de datos están funcionando correctamente."
            type="info"
            showIcon
          />
          <Button
            type="primary"
            icon={<BugOutlined />}
            loading={diagnoseLoading}
            onClick={runDiagnose}
            style={{ alignSelf: "flex-start" }}
          >
            {diagnoseLoading ? "Analizando..." : "Ejecutar diagnóstico"}
          </Button>

          {diagnoseError && <Alert message={diagnoseError} type="error" showIcon />}

          {diagnoseResult && (() => {
            const { summary, config, checks, generated_at } = diagnoseResult;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Resumen */}
                <div style={{ display: "flex", gap: 10 }}>
                  <Tag color="success" icon={<CheckCircleOutlined />}>{summary.ok} OK</Tag>
                  {summary.warn > 0 && <Tag color="warning" icon={<WarningOutlined />}>{summary.warn} Advertencia</Tag>}
                  {summary.fail > 0 && <Tag color="error" icon={<CloseCircleOutlined />}>{summary.fail} Error</Tag>}
                </div>
                {/* Config usada */}
                <div style={{ background: "#f6f8fa", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#555" }}>
                  <b>Plantilla:</b> {config.template_name} &nbsp;|&nbsp;
                  <b>Idioma:</b> {config.template_language} &nbsp;|&nbsp;
                  <b>Phone ID:</b> {config.phone_number_id}
                </div>
                {/* Checks */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {checks.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        borderRadius: 6,
                        padding: "8px 12px",
                        background: c.status === "ok" ? "#f6ffed" : c.status === "warn" ? "#fffbe6" : "#fff2f0",
                        border: `1px solid ${c.status === "ok" ? "#b7eb8f" : c.status === "warn" ? "#ffe58f" : "#ffccc7"}`,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: c.action || c.data ? 4 : 0 }}>
                        {c.status === "ok" && <CheckCircleOutlined style={{ color: "#52c41a" }} />}
                        {c.status === "warn" && <WarningOutlined style={{ color: "#faad14" }} />}
                        {c.status === "fail" && <CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
                        <b style={{ color: "#333" }}>{c.name}</b>
                        <span style={{ color: "#555", fontWeight: 400 }}>{c.detail}</span>
                      </div>
                      {c.action && (
                        <div style={{ color: "#856404", fontSize: 12, marginLeft: 22, marginTop: 2 }}>
                          → {c.action}
                        </div>
                      )}
                      {c.data && Object.keys(c.data).length > 0 && (
                        <div style={{ fontSize: 11, color: "#888", marginLeft: 22, marginTop: 2 }}>
                          {Object.entries(c.data).map(([k, v]) => (
                            <span key={k} style={{ marginRight: 10 }}><b>{k}:</b> {String(v ?? "-")}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#aaa", textAlign: "right" }}>generado: {new Date(generated_at).toLocaleString("es-CO")}</div>
              </div>
            );
          })()}
        </div>
      </Modal>

      {/* ── Modal retry bienvenida club ─────────────────────── */}
      <Modal
        title="Bienvenida del Club — Pendientes"
        open={retryModalOpen}
        onCancel={() => setRetryModalOpen(false)}
        footer={null}
        width={520}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Paso 0: verificar */}
          {retryStep === "idle" && (
            <>
              <Alert
                message="Primero verifica cuántos clientes no han recibido aún el mensaje de bienvenida del club."
                type="info"
                showIcon
              />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span>Revisar hasta:</span>
                <InputNumber
                  min={1}
                  max={500}
                  value={retryLimit}
                  onChange={(v) => setRetryLimit(v ?? 100)}
                  style={{ width: 100 }}
                  addonAfter="clientes"
                />
              </div>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                loading={retryLoading}
                onClick={() => callRetryEndpoint(true)}
              >
                Verificar pendientes
              </Button>
            </>
          )}

          {/* Paso 1: resultado verificación */}
          {retryStep === "checked" && retryResult && (
            <>
              <Alert
                type={retryResult.sent === 0 ? "success" : "warning"}
                message={
                  retryResult.sent === 0
                    ? `✅ Todos los clientes ya tienen su bienvenida enviada.`
                    : `⚠️ ${retryResult.sent} cliente(s) aún no han recibido la bienvenida.`
                }
                description={`Ya enviados: ${retryResult.already_sent}  |  Sin teléfono válido: ${retryResult.skipped_invalid}`}
                showIcon={false}
              />

              {retryResult.details.filter(d => d.status === "would_send").length > 0 && (
                <div
                  style={{
                    maxHeight: 180,
                    overflowY: "auto",
                    fontSize: 12,
                    background: "#fffbe6",
                    borderRadius: 6,
                    padding: "8px 12px",
                    border: "1px solid #ffe58f",
                  }}
                >
                  {retryResult.details
                    .filter(d => d.status === "would_send")
                    .map((d, i, arr) => (
                      <div
                        key={i}
                        style={{
                          padding: "3px 0",
                          borderBottom: i < arr.length - 1 ? "1px solid #ffd666" : "none",
                          color: "#614700",
                        }}
                      >
                        {d.nombre || d.telefono} — {d.telefono}
                      </div>
                    ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button onClick={() => { setRetryStep("idle"); setRetryResult(null); }}>
                  Volver
                </Button>
                {retryResult.sent > 0 && (
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={retryLoading}
                    onClick={() => callRetryEndpoint(false)}
                    style={{ background: "#128C7E", borderColor: "#128C7E" }}
                  >
                    Enviar bienvenida a {retryResult.sent} cliente(s)
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Paso 2: resultado envío */}
          {retryStep === "sent" && retryResult && (
            <>
              <Alert
                type="success"
                message={`Proceso completado`}
                description={`Enviados: ${retryResult.sent}  |  Fallidos: ${retryResult.failed}  |  Ya tenían: ${retryResult.already_sent}`}
                showIcon
              />
              {retryResult.failed > 0 && (
                <div
                  style={{
                    maxHeight: 150,
                    overflowY: "auto",
                    fontSize: 12,
                    background: "#fff2f0",
                    borderRadius: 6,
                    padding: "8px 12px",
                    border: "1px solid #ffccc7",
                  }}
                >
                  {retryResult.details
                    .filter(d => d.status === "failed")
                    .map((d, i) => (
                      <div key={i} style={{ padding: "3px 0", color: "#cf1322" }}>
                        {d.nombre || d.telefono}: {d.error}
                      </div>
                    ))}
                </div>
              )}
              <Button onClick={() => setRetryModalOpen(false)}>
                Cerrar
              </Button>
            </>
          )}

          {retryError && (
            <Alert message={retryError} type="error" showIcon />
          )}
        </div>
      </Modal>

      {!isMobile && (
        <div
          onMouseDown={startResizePanel}
          style={{
            width: 10,
            cursor: "col-resize",
            position: "relative",
            flexShrink: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "stretch",
          }}
          title="Arrastra para ampliar o reducir el simulador"
        >
          <div
            style={{
              width: 2,
              background: "#cfd8e3",
              borderRadius: 4,
              margin: "14px 0",
            }}
          />
        </div>
      )}

      {/* ── Panel derecho: chat ───────────────────────────────────── */}
      {selectedPhone ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "#ECE5DD",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='%23f0ede8' fill-opacity='0.5'/%3E%3C/svg%3E\")",
            overflow: "hidden",
            borderRadius: isMobile ? 0 : 14,
            boxShadow: isMobile ? "none" : "0 6px 22px rgba(0,0,0,0.06)",
          }}
        >
          {/* Header conversación */}
          <div
            style={{
              background: "#128C7E",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            }}
          >
            {isMobile && (
              <Tooltip title="Volver a conversaciones">
                <LeftOutlined
                  onClick={() => setSelectedPhone(null)}
                  style={{ color: "#fff", fontSize: 16, cursor: "pointer" }}
                />
              </Tooltip>
            )}
            <Avatar
              size={42}
              style={{ background: avatarBg, fontWeight: 700, fontSize: 15, flexShrink: 0 }}
            >
              {initials}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text
                ellipsis
                style={{ color: "#fff", fontWeight: 700, fontSize: 15, display: "block" }}
              >
                {displayName}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
                {selectedPhone}
              </Text>
            </div>
            <Tooltip title="Refrescar mensajes">
              <ReloadOutlined
                style={{ color: "#fff", cursor: "pointer", fontSize: 16 }}
                onClick={() => loadMessages(selectedPhone)}
              />
            </Tooltip>
          </div>

          {/* Mensajes */}
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {loadingMessages && !hasLoadedMessages ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : messages.length === 0 ? (
              <Empty
                description="Sin mensajes registrados"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ margin: "auto", padding: 40 }}
              />
            ) : (
              grouped.map((item, idx) => {
                if ("type" in item) {
                  return (
                    <div
                      key={`sep-${idx}`}
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        margin: "10px 0",
                      }}
                    >
                      <div
                        style={{
                          background: "rgba(255,255,255,0.85)",
                          borderRadius: 10,
                          padding: "3px 12px",
                          fontSize: 12,
                          color: "#555",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                        }}
                      >
                        {item.label}
                      </div>
                    </div>
                  );
                }
                return <MessageBubble key={item.id} msg={item} />;
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pie: solo monitoreo, no se envía */}
          <div
            style={{
              background: "#F0F0F0",
              padding: "10px 16px",
              borderTop: "1px solid #ddd",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <RobotOutlined style={{ color: "#128C7E", fontSize: 18 }} />
            <Text style={{ color: "#888", fontSize: 13 }}>
              Modo monitoreo — Las respuestas las gestiona el agente IA automáticamente
            </Text>
          </div>
        </div>
      ) : (
        /* Estado vacío: no hay conversación seleccionada */
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8f9fa",
            gap: 16,
            borderRadius: isMobile ? 0 : 14,
            boxShadow: isMobile ? "none" : "0 6px 22px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 32px rgba(37,211,102,0.25)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="white"
              width="56"
              height="56"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <Text
              style={{ fontSize: 20, fontWeight: 700, color: "#333", display: "block" }}
            >
              Monitoreo de Conversaciones
            </Text>
            <Text style={{ color: "#888", fontSize: 14, marginTop: 8, display: "block" }}>
              Selecciona una conversación del panel izquierdo
              <br />
              para ver el historial completo
            </Text>
          </div>
        </div>
      )}
    </div>
  );
}
