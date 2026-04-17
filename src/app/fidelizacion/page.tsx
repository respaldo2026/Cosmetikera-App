"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Typography, Space, Tag, Spin, Row, Col, Statistic,
  Table, Empty, Grid, Button, Avatar, Tooltip, Progress,
  Divider, Badge, Modal, Select, Input, Form, InputNumber, App,
} from "antd";
import {
  GiftOutlined, CrownOutlined, UserOutlined, SearchOutlined,
  ReloadOutlined, TrophyOutlined, StarOutlined, HeartOutlined,
  PlusOutlined, ClockCircleOutlined, WhatsAppOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type Cliente = {
  id: string;
  nombre_completo: string;
  telefono?: string;
  email?: string;
  puntos_fidelidad?: number;
  nivel_fidelidad?: string;
  fecha_nacimiento?: string;
  total_compras?: number;
};

type NivelFidelidad = {
  key: string;
  label: string;
  color: string;
  min: number;
  max: number;
  icon: string;
};

const NIVELES: NivelFidelidad[] = [
  { key: "bronce", label: "Bronce", color: "#cd7f32", min: 0, max: 999, icon: "🥉" },
  { key: "plata", label: "Plata", color: "#aaa", min: 1000, max: 4999, icon: "🥈" },
  { key: "oro", label: "Oro", color: "#faad14", min: 5000, max: 14999, icon: "🥇" },
  { key: "diamante", label: "Diamante", color: "#13c2c2", min: 15000, max: Infinity, icon: "💎" },
];

function getNivel(puntos: number): NivelFidelidad {
  return NIVELES.findLast((n) => puntos >= n.min) ?? NIVELES[0]!;
}

function getniveProgresoNext(puntos: number) {
  const actual = getNivel(puntos);
  const idx = NIVELES.indexOf(actual);
  if (idx >= NIVELES.length - 1) return null;
  const sig = NIVELES[idx + 1];
  if (!sig) return null;
  const progress = Math.round(((puntos - actual.min) / (sig.min - actual.min)) * 100);
  return { siguiente: sig, progress, faltantes: sig.min - puntos };
}

export default function FidelizacionPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroNivel, setFiltroNivel] = useState<string | null>(null);
  const [modalPuntos, setModalPuntos] = useState<Cliente | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabaseBrowserClient
      .from("perfiles")
      .select("id,nombre_completo,telefono,email,puntos_fidelidad,nivel_fidelidad,fecha_nacimiento,total_compras")
      .order("puntos_fidelidad", { ascending: false });
    setClientes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cumpleaniosHoy = clientes.filter((c) => {
    if (!c.fecha_nacimiento) return false;
    const hoy = dayjs();
    const cumple = dayjs(c.fecha_nacimiento);
    return cumple.month() === hoy.month() && cumple.date() === hoy.date();
  });

  const cumpleaniosMes = clientes.filter((c) => {
    if (!c.fecha_nacimiento) return false;
    return dayjs(c.fecha_nacimiento).month() === dayjs().month();
  });

  const filtrados = clientes.filter((c) => {
    const matchSearch = !search ||
      c.nombre_completo.toLowerCase().includes(search.toLowerCase());
    const nivel = getNivel(c.puntos_fidelidad || 0);
    const matchNivel = !filtroNivel || nivel.key === filtroNivel;
    return matchSearch && matchNivel;
  });

  const resumenNiveles = NIVELES.map((n) => ({
    ...n,
    count: clientes.filter((c) => getNivel(c.puntos_fidelidad || 0).key === n.key).length,
  }));

  const agregarPuntos = async () => {
    if (!modalPuntos) return;
    const values = await form.validateFields();
    setGuardando(true);
    try {
      const nuevosPuntos = (modalPuntos.puntos_fidelidad || 0) + Number(values.puntos);
      const nuevoNivel = getNivel(nuevosPuntos);
      await supabaseBrowserClient
        .from("perfiles")
        .update({
          puntos_fidelidad: nuevosPuntos,
          nivel_fidelidad: nuevoNivel.key,
        })
        .eq("id", modalPuntos.id);
      message.success(`✅ +${values.puntos} puntos a ${modalPuntos.nombre_completo}`);
      if (nuevoNivel.key !== getNivel(modalPuntos.puntos_fidelidad || 0).key) {
        message.success(`🎉 ¡${modalPuntos.nombre_completo} subió a nivel ${nuevoNivel.label}!`);
      }
      setModalPuntos(null);
      cargar();
    } catch (e: any) {
      message.error(e?.message || "Error");
    } finally {
      setGuardando(false);
    }
  };

  const columns = [
    {
      title: "#",
      key: "rank",
      width: 50,
      render: (_: any, __: any, idx: number) => (
        <Text strong style={{ color: idx < 3 ? "#faad14" : "#888" }}>
          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
        </Text>
      ),
    },
    {
      title: "Cliente",
      key: "cliente",
      render: (_: any, rec: Cliente) => {
        const nivel = getNivel(rec.puntos_fidelidad || 0);
        return (
          <Space>
            <Avatar
              style={{ background: nivel.color, flexShrink: 0 }}
              icon={<UserOutlined />}
            />
            <div>
              <Text strong>{rec.nombre_completo}</Text>
              <div>
                <Tag
                  color={nivel.color}
                  style={{ fontSize: 10, padding: "0 6px" }}
                >
                  {nivel.icon} {nivel.label}
                </Tag>
                {rec.fecha_nacimiento &&
                  dayjs(rec.fecha_nacimiento).month() === dayjs().month() && (
                    <Tag color="pink" style={{ fontSize: 10 }}>🎂 cumple este mes</Tag>
                  )}
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: "Puntos",
      key: "puntos",
      width: 200,
      render: (_: any, rec: Cliente) => {
        const puntos = rec.puntos_fidelidad || 0;
        const prog = getniveProgresoNext(puntos);
        const nivel = getNivel(puntos);
        return (
          <div>
            <Space style={{ marginBottom: 2 }}>
              <StarOutlined style={{ color: "#faad14" }} />
              <Text strong style={{ fontSize: 14 }}>{puntos.toLocaleString()}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>pts</Text>
            </Space>
            {prog ? (
              <Tooltip title={`Faltan ${prog.faltantes.toLocaleString()} pts para ${prog.siguiente.label}`}>
                <Progress
                  percent={prog.progress}
                  size="small"
                  strokeColor={prog.siguiente.color}
                  showInfo={false}
                />
              </Tooltip>
            ) : (
              <Tag color="#13c2c2">💎 Nivel máximo</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Compras",
      dataIndex: "total_compras",
      key: "compras",
      width: 100,
      render: (v: number) => (
        <Text>{v ? `$${Number(v).toLocaleString()}` : "—"}</Text>
      ),
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 110,
      render: (_: any, rec: Cliente) => (
        <Space>
          <Tooltip title="Agregar puntos">
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setModalPuntos(rec); form.resetFields(); }}
              style={{ background: "#faad14", borderColor: "#faad14" }}
            />
          </Tooltip>
          {rec.telefono && (
            <Tooltip title="WhatsApp">
              <Button
                size="small"
                icon={<WhatsAppOutlined />}
                style={{ color: "#25D366", borderColor: "#25D366" }}
                onClick={() => window.open(`https://wa.me/57${rec.telefono?.replace(/\D/g, "")}`, "_blank")}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* HEADER */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }} bodyStyle={{ padding: "12px 16px" }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Space>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "linear-gradient(135deg,#faad14,#d81b87)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <GiftOutlined style={{ color: "#fff", fontSize: 22 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>Fidelización de clientes</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Sistema de puntos y niveles de lealtad
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
          </Col>
        </Row>
      </Card>

      {/* NIVELES RESUMEN */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {resumenNiveles.map((n) => (
          <Col xs={12} sm={6} key={n.key}>
            <Card
              size="small"
              style={{
                borderRadius: 10, textAlign: "center",
                cursor: "pointer",
                border: filtroNivel === n.key ? `2px solid ${n.color}` : undefined,
              }}
              bodyStyle={{ padding: "10px 8px" }}
              onClick={() => setFiltroNivel(filtroNivel === n.key ? null : n.key)}
            >
              <div style={{ fontSize: 24, marginBottom: 4 }}>{n.icon}</div>
              <Text strong style={{ color: n.color }}>{n.label}</Text>
              <div>
                <Text style={{ fontSize: 20, fontWeight: 800 }}>{n.count}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}> cliente(s)</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 10 }}>
                {n.min === 0 ? `0` : `${n.min.toLocaleString()}`}
                {n.max < Infinity ? ` – ${n.max.toLocaleString()} pts` : "+ pts"}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ALERTAS CUMPLEAÑOS */}
      {cumpleaniosHoy.length > 0 && (
        <Card
          style={{ marginBottom: 12, borderRadius: 10, background: "linear-gradient(135deg,#fff0f6,#fce4f8)", border: "1px solid #ffadd2" }}
          bodyStyle={{ padding: "10px 16px" }}
        >
          <Space>
            <span style={{ fontSize: 24 }}>🎂</span>
            <div>
              <Text strong style={{ color: "#d81b87" }}>¡Cumpleaños hoy!</Text>
              <div>
                {cumpleaniosHoy.map((c) => (
                  <Tag key={c.id} color="pink" style={{ margin: 2 }}>{c.nombre_completo}</Tag>
                ))}
              </div>
            </div>
          </Space>
        </Card>
      )}

      {cumpleaniosMes.length > 0 && cumpleaniosHoy.length === 0 && (
        <Card
          style={{ marginBottom: 12, borderRadius: 10 }}
          bodyStyle={{ padding: "8px 14px" }}
        >
          <Text>
            🎂 <strong>{cumpleaniosMes.length} cliente(s)</strong> cumplen años este mes:{" "}
            {cumpleaniosMes.slice(0, 5).map((c) => (
              <Tag key={c.id} style={{ margin: 2 }}>{c.nombre_completo}</Tag>
            ))}
            {cumpleaniosMes.length > 5 && <Text type="secondary">+{cumpleaniosMes.length - 5} más</Text>}
          </Text>
        </Card>
      )}

      {/* FILTRO BÚSQUEDA */}
      <Card style={{ marginBottom: 12, borderRadius: 10 }} bodyStyle={{ padding: "10px 14px" }}>
        <Input
          placeholder="Buscar cliente..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 400 }}
        />
      </Card>

      {/* RANKING TABLE */}
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}
        title={
          <Space>
            <TrophyOutlined style={{ color: "#faad14" }} />
            <Text strong>Ranking de clientes más leales</Text>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
        ) : filtrados.length === 0 ? (
          <Empty description="Sin clientes con puntos" style={{ padding: 60 }} />
        ) : (
          <Table
            dataSource={filtrados}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            scroll={{ x: 550 }}
          />
        )}
      </Card>

      {/* MODAL AGREGAR PUNTOS */}
      <Modal
        title={`Agregar puntos a ${modalPuntos?.nombre_completo}`}
        open={!!modalPuntos}
        onCancel={() => setModalPuntos(null)}
        onOk={agregarPuntos}
        confirmLoading={guardando}
        okText="Agregar puntos"
        cancelText="Cancelar"
        width={400}
      >
        {modalPuntos && (
          <div style={{ padding: "8px 0" }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card size="small" style={{ textAlign: "center", borderRadius: 10 }}>
                  <Text type="secondary">Puntos actuales</Text>
                  <div>
                    <Text strong style={{ fontSize: 22, color: "#faad14" }}>
                      {(modalPuntos.puntos_fidelidad || 0).toLocaleString()}
                    </Text>
                  </div>
                  <Tag color={getNivel(modalPuntos.puntos_fidelidad || 0).color}>
                    {getNivel(modalPuntos.puntos_fidelidad || 0).icon}{" "}
                    {getNivel(modalPuntos.puntos_fidelidad || 0).label}
                  </Tag>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ textAlign: "center", borderRadius: 10 }}>
                  <Text type="secondary">Equivale a</Text>
                  <div>
                    <Text strong style={{ fontSize: 16, color: "#d81b87" }}>
                      ${((modalPuntos.puntos_fidelidad || 0) * 10).toLocaleString()}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>en descuentos</Text>
                </Card>
              </Col>
            </Row>
            <Form form={form} layout="vertical">
              <Form.Item name="puntos" label="Puntos a agregar" rules={[{ required: true, min: 1 }]}>
                <InputNumber min={1} style={{ width: "100%" }} placeholder="Ej: 50" size="large" />
              </Form.Item>
              <Form.Item name="motivo" label="Motivo (opcional)">
                <Input placeholder="Ej: Compra especial, bono de bienvenida..." />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </>
  );
}
