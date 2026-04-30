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
} from "antd";
import {
  SearchOutlined,
  CheckOutlined,
  RobotOutlined,
  UserOutlined,
  ReloadOutlined,
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
        setConversations(json.conversations);
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
    try {
      const res = await fetchWithTimeout(`/api/whatsapp/conversations?phone=${encodeURIComponent(phone)}`);
      const json = await res.json();
      if (json.messages) setMessages(json.messages);
      if (json.clientName !== undefined) setClientName(json.clientName);
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
      style={{
        display: "flex",
        height: "calc(100vh - 64px)",
        background: "#f0f2f5",
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── Panel izquierdo: lista de conversaciones ─────────────── */}
      <div
        style={{
          width: 360,
          minWidth: 280,
          borderRight: "1px solid #e0e0e0",
          background: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Header lista */}
        <div
          style={{
            background: "#128C7E",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
            WhatsApp Bot
          </Text>
          <Tooltip title="Actualizar">
            <ReloadOutlined
              style={{ color: "#fff", cursor: "pointer", fontSize: 16 }}
              onClick={() => loadConversations(search)}
            />
          </Tooltip>
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
              const name = conv.nombre || conv.telefono;
              const bg = getAvatarColor(conv.telefono);
              const ini = getInitials(conv.nombre, conv.telefono);
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
