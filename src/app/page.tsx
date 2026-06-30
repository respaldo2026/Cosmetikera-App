"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Typography, Space, Row, Col, Spin, Tag,
  Button, Avatar, Grid, Empty, Badge,
} from "antd";
import {
  ShoppingCartOutlined, UserOutlined, TagsOutlined, GiftOutlined,
  TruckOutlined, WarningOutlined, CrownOutlined, ThunderboltOutlined,
  DollarCircleOutlined, CalendarOutlined, ReloadOutlined, InboxOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@hooks/useCurrentUser";
import dayjs from "dayjs";
import "dayjs/locale/es";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);
dayjs.locale("es");

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function VistaRapidaPage() {
  const screens = useBreakpoint();
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [router, user, userLoading]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }
      const dashData = await response.json();

      const hoy = dayjs();
      const ventasH = dashData.ventasHoy || [];
      const ventasM = dashData.ventasMes || [];
      const clientes = dashData.clientes || [];
      const articulos = dashData.articulos || [];

      const stockBajoItems = articulos.filter((a: any) => a.stock <= (a.stock_minimo ?? 3));
      const clientesNuevosMes = clientes.filter((c: any) => dayjs(c.created_at).isAfter(hoy.startOf("month")));
      const cumpleMes = clientes.filter((c: any) => c.fecha_nacimiento && dayjs(c.fecha_nacimiento).month() === hoy.month());
      const clientesTop = [...clientes].sort((a: any, b: any) => (b.puntos_fidelidad || 0) - (a.puntos_fidelidad || 0)).slice(0, 5);

      setStats({
        ventasHoy: ventasH.length,
        ingresoHoy: ventasH.reduce((s: number, v: any) => s + Number(v.total || 0), 0),
        ventasMes: ventasM.length,
        ingresoMes: ventasM.reduce((s: number, v: any) => s + Number(v.total || 0), 0),
        totalClientes: clientes.length,
        clientesNuevosMes: clientesNuevosMes.length,
        totalArticulos: articulos.length,
        stockBajo: stockBajoItems.length,
        comprasPendientes: (dashData.compras || []).length,
        ventasRecientes: dashData.ventasRec || [],
        clientesTop,
        cumpleanierosMes: cumpleMes,
      });
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (userLoading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}><Spin size="large" /></div>;
  }

  if (!user) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}><Spin size="large" tip="Redirigiendo al acceso..." /></div>;
  }

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400 }}><Spin size="large" tip="Cargando..." /></div>;
  }

  const s = stats || {};

  const KpiCard = ({ title, value, prefix, suffix, color, icon, onClick, badge }: any) => (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      style={{ borderRadius: 14, cursor: onClick ? "pointer" : "default", border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
      bodyStyle={{ padding: "14px 16px" }}
    >
      <Row align="middle" gutter={12}>
        <Col>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: color || "linear-gradient(135deg,#d81b87,#9c27b0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {React.cloneElement(icon, { style: { color: "#fff", fontSize: 20 } })}
          </div>
        </Col>
        <Col flex="auto">
          <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</Text>
          <div>
            <Text strong style={{ fontSize: 22, color: "#1a1a1a" }}>
              {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
            </Text>
          </div>
        </Col>
        {badge > 0 && <Col><Badge count={badge} style={{ background: "#ff4d4f" }} /></Col>}
      </Row>
    </Card>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* BIENVENIDA */}
      <Card style={{ borderRadius: 16, border: "none", background: "linear-gradient(135deg,#fce4f8 0%,#f0d6ff 50%,#dbeafe 100%)", boxShadow: "0 4px 20px rgba(216,27,135,0.12)" }} bodyStyle={{ padding: "20px 24px" }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space align="center">
              <span style={{ fontSize: 36 }}>💄</span>
              <div>
                <Title level={3} style={{ margin: 0, color: "#d81b87" }}>La Cosmetikera</Title>
                <Text style={{ color: "#888" }}>{dayjs().format("dddd D [de] MMMM, YYYY")}</Text>
              </div>
            </Space>
          </Col>
          <Col><Button icon={<ReloadOutlined />} onClick={cargar}>Actualizar</Button></Col>
        </Row>
      </Card>

      {/* KPIs VENTAS */}
      <div>
        <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>💰 Ventas</Text>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard title="Ingresos hoy" value={s.ingresoHoy || 0} prefix="$" color="linear-gradient(135deg,#389e0d,#52c41a)" icon={<DollarCircleOutlined />} onClick={() => router.push("/ventas")} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard title="Ventas hoy" value={s.ventasHoy || 0} suffix=" ventas" color="linear-gradient(135deg,#d81b87,#9c27b0)" icon={<ShoppingCartOutlined />} onClick={() => router.push("/ventas")} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard title="Ingresos este mes" value={s.ingresoMes || 0} prefix="$" color="linear-gradient(135deg,#1890ff,#096dd9)" icon={<CalendarOutlined />} onClick={() => router.push("/historial")} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard title="Ventas del mes" value={s.ventasMes || 0} suffix=" ventas" color="linear-gradient(135deg,#722ed1,#531dab)" icon={<ThunderboltOutlined />} onClick={() => router.push("/historial")} />
          </Col>
        </Row>
      </div>

      {/* KPIs TIENDA */}
      <div>
        <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>🏪 Tienda</Text>
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}>
            <KpiCard title="Artículos" value={s.totalArticulos || 0} color="linear-gradient(135deg,#fa8c16,#faad14)" icon={<TagsOutlined />} onClick={() => router.push("/articulos")} />
          </Col>
          <Col xs={12} sm={6}>
            <KpiCard title="Stock bajo" value={s.stockBajo || 0} color="linear-gradient(135deg,#cf1322,#ff4d4f)" icon={<WarningOutlined />} onClick={() => router.push("/articulos")} badge={s.stockBajo} />
          </Col>
          <Col xs={12} sm={6}>
            <KpiCard title="Compras pend." value={s.comprasPendientes || 0} color="linear-gradient(135deg,#096dd9,#0050b3)" icon={<InboxOutlined />} onClick={() => router.push("/compras")} badge={s.comprasPendientes} />
          </Col>
          <Col xs={12} sm={6}>
            <KpiCard title="Clientes" value={s.totalClientes || 0} color="linear-gradient(135deg,#08979c,#13c2c2)" icon={<UserOutlined />} onClick={() => router.push("/fidelizacion")} />
          </Col>
        </Row>
      </div>

      {/* TOP CLIENTES + VENTAS RECIENTES */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <Card title={<Space><CrownOutlined style={{ color: "#faad14" }} /><Text strong>Top clientes</Text></Space>} extra={<Button type="link" size="small" onClick={() => router.push("/fidelizacion")}>Ver todos</Button>} style={{ borderRadius: 12, height: "100%" }} bodyStyle={{ padding: "8px 12px" }}>
            {(s.clientesTop || []).length === 0 ? (
              <Empty description="Sin datos" imageStyle={{ height: 40 }} />
            ) : (
              (s.clientesTop || []).map((c: any, idx: number) => {
                const iconNivel = c.nivel_fidelidad === "diamante" ? "💎" : c.nivel_fidelidad === "oro" ? "🥇" : c.nivel_fidelidad === "plata" ? "🥈" : "🥉";
                return (
                  <div key={c.id} style={{ padding: "8px 0", display: "flex", alignItems: "center", gap: 8, borderBottom: idx < 4 ? "1px solid #f0f0f0" : undefined }}>
                    <Text strong style={{ minWidth: 20, color: idx < 3 ? "#faad14" : "#888" }}>{idx + 1}</Text>
                    <Avatar size="small" icon={<UserOutlined />} style={{ background: "#d81b87" }} />
                    <Text style={{ flex: 1, fontSize: 13 }} ellipsis>{c.nombre_completo}</Text>
                    <Text strong style={{ color: "#faad14", fontSize: 12 }}>{iconNivel} {(c.puntos_fidelidad || 0).toLocaleString()} pts</Text>
                  </div>
                );
              })
            )}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title={<Space><ShoppingCartOutlined style={{ color: "#d81b87" }} /><Text strong>Ventas recientes</Text></Space>} extra={<Button type="link" size="small" onClick={() => router.push("/historial")}>Ver historial</Button>} style={{ borderRadius: 12, height: "100%" }} bodyStyle={{ padding: "8px 12px" }}>
            {(s.ventasRecientes || []).length === 0 ? (
              <Empty description="Sin ventas registradas" imageStyle={{ height: 40 }}>
                <Button type="primary" size="small" onClick={() => router.push("/ventas")}>Ir al POS</Button>
              </Empty>
            ) : (
              (s.ventasRecientes || []).map((v: any) => (
                <div key={v.id} style={{ padding: "8px 4px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#fce4f8,#f0d6ff)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ShoppingCartOutlined style={{ color: "#d81b87" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: 13 }}>{(v.cliente as any)?.nombre_completo || "Cliente sin registrar"}</Text>
                    <div><Text type="secondary" style={{ fontSize: 11 }}>{dayjs(v.fecha).fromNow()} · {(v.items || []).length} ítem(s)</Text></div>
                  </div>
                  <Text strong style={{ color: "#d81b87", fontSize: 15 }}>${Number(v.total).toLocaleString()}</Text>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* ACCESOS RÁPIDOS + CUMPLEAÑOS */}
      <Row gutter={[12, 12]}>
        {(s.cumpleanierosMes || []).length > 0 && (
          <Col xs={24} md={10}>
            <Card title={<Space><span>🎂</span><Text strong>Cumpleaños este mes</Text></Space>} style={{ borderRadius: 12 }} bodyStyle={{ padding: "8px 12px" }}>
              <Row gutter={[8, 8]}>
                {(s.cumpleanierosMes || []).slice(0, 6).map((c: any) => (
                  <Col key={c.id} span={12}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar size="small" icon={<UserOutlined />} style={{ background: "#ff4d94" }} />
                      <div>
                        <Text style={{ fontSize: 12 }} ellipsis>{c.nombre_completo}</Text>
                        <div><Text type="secondary" style={{ fontSize: 10 }}>{dayjs(c.fecha_nacimiento).format("D [de] MMMM")}</Text></div>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        )}
        <Col xs={24} md={(s.cumpleanierosMes || []).length > 0 ? 14 : 24}>
          <Card title={<Space><ThunderboltOutlined style={{ color: "#d81b87" }} /><Text strong>Accesos rápidos</Text></Space>} style={{ borderRadius: 12 }} bodyStyle={{ padding: "12px" }}>
            <Row gutter={[8, 8]}>
              {[
                { label: "Nueva venta", icon: <ShoppingCartOutlined />, path: "/ventas", color: "#d81b87" },
                { label: "Artículos", icon: <TagsOutlined />, path: "/articulos", color: "#722ed1" },
                { label: "Fidelización", icon: <GiftOutlined />, path: "/fidelizacion", color: "#faad14" },
                { label: "Clientes", icon: <UserOutlined />, path: "/perfiles", color: "#1890ff" },
                { label: "Nueva compra", icon: <InboxOutlined />, path: "/compras", color: "#096dd9" },
                { label: "Historial", icon: <CalendarOutlined />, path: "/historial", color: "#13c2c2" },
              ].map((item) => (
                <Col span={8} key={item.label}>
                  <Button block onClick={() => router.push(item.path)} style={{ height: 64, borderRadius: 12, border: "none", background: `${item.color}12`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 20, color: item.color }}>{item.icon}</div>
                    <Text style={{ fontSize: 11, color: item.color, marginTop: 2 }}>{item.label}</Text>
                  </Button>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}