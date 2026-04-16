"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Tag,
  Button,
  Divider,
  Form,
  Input,
  Modal,
  message,
  Skeleton,
  Badge,
} from "antd";
import { WhatsAppOutlined, ShareAltOutlined, ClockCircleOutlined, BookOutlined, DollarOutlined } from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { enviarWhatsapp } from "@utils/whatsapp";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;

type Programa = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  duracion?: string | null;
  total_clases?: number | null;
  precio_inscripcion?: number | null;
  precio_mensualidad?: number | null;
  emoji?: string | null;
  activo?: boolean | null;
};

type Grupo = {
  id: string;
  programa_id?: string | null;
  nombre?: string | null;
  fecha_inicio?: string | null;
  estado?: string | null;
};

type SharePayload = {
  nombre: string;
  telefono: string;
  email?: string;
  notas?: string;
};

const gradientBg = "linear-gradient(135deg, #111827 0%, #1e1b4b 45%, #312e81 100%)";

const normalizePhone = (value: string) => {
  const cleanPhone = value.replace(/\D+/g, "");
  // WhatsApp Cloud espera formato E.164 sin el símbolo + (ej: 573001234567)
  if (cleanPhone.startsWith("57")) {
    return cleanPhone;
  }
  if (cleanPhone.startsWith("3")) {
    return "57" + cleanPhone;
  }
  return "57" + cleanPhone;
};

export default function CatalogoCursosPage() {
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedPrograma, setSelectedPrograma] = useState<Programa | null>(null);
  const [form] = Form.useForm<SharePayload>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [{ data: programasData }, { data: gruposData }] = await Promise.all([
          supabaseBrowserClient
            .from("programas")
            .select("id, nombre, descripcion, duracion, total_clases, precio_inscripcion, precio_mensualidad, emoji, activo")
            .eq("activo", true)
            .order("nombre", { ascending: true }),
          supabaseBrowserClient
            .from("cursos")
            .select("id, programa_id, nombre, fecha_inicio, estado")
            .in("estado", ["proximo", "activo"])
            .order("fecha_inicio", { ascending: true }),
        ]);

        setProgramas(programasData || []);
        setGrupos(gruposData || []);
      } catch (error) {
        message.error("No se pudo cargar el catálogo");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const proximosPorPrograma = useMemo(() => {
    const mapa: Record<string, Grupo[]> = {};
    grupos.forEach((grupo) => {
      const key = grupo.programa_id ? String(grupo.programa_id) : undefined;
      if (!key) return;
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(grupo);
    });
    return mapa;
  }, [grupos]);

  const abrirShare = (programa: Programa) => {
    setSelectedPrograma(programa);
    form.resetFields();
    form.setFieldsValue({ notas: `Interés: ${programa.nombre}` });
    setShareOpen(true);
  };

  const compartir = async (values: SharePayload) => {
    if (!selectedPrograma) return;

    const telefono = normalizePhone(values.telefono || "");
    if (!telefono) {
      message.error("Ingresa un teléfono válido");
      return;
    }

    try {
      const payload = {
        nombre: values.nombre,
        telefono,
        email: values.email || null,
        interes: selectedPrograma.nombre,
        canal: "WhatsApp",
        estado: "nuevo",
        notas: values.notas || `Interesado en ${selectedPrograma.nombre} (catálogo)`
      };

      const { data: leadData, error } = await supabaseBrowserClient.from("leads").insert(payload).select('id').single();
      if (error) throw error;

      // Cargar configuración de la academia
      const { data: configData } = await supabaseBrowserClient
        .from("configuracion_academia")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("[Catálogo] ===== CONFIG FRESCA PARA MENSAJE =====", configData);

      const proximos = proximosPorPrograma[selectedPrograma.id] || [];
      const proximoTexto = proximos
        .slice(0, 2)
        .map((g) => {
          const fecha = g.fecha_inicio ? dayjs(g.fecha_inicio).format("DD MMM") : "Próximamente";
          return `${g.nombre || "Grupo"} - ${fecha}`;
        })
        .join("\n");

      const mensualidad = selectedPrograma.precio_mensualidad
        ? `$${Number(selectedPrograma.precio_mensualidad).toLocaleString("es-CO")}`
        : "Consultar";
      const inscripcion = selectedPrograma.precio_inscripcion
        ? `$${Number(selectedPrograma.precio_inscripcion).toLocaleString("es-CO")}`
        : "Consultar";

      const duracion = selectedPrograma.duracion || "Por confirmar";

      // Enviar plantilla v4 con datos del programa y botones
      const { enviarFormularioInteres } = await import('@/services/whatsapp-messages-module');
      const resultado = await enviarFormularioInteres(telefono, leadData.id, {
        nombre: values.nombre,
        cursoInteres: selectedPrograma.nombre,
        fechaInicio: proximoTexto || 'Fecha por confirmar',
        duracion,
        totalClases: selectedPrograma.total_clases ? `${selectedPrograma.total_clases} clases` : undefined,
        precioInscripcion: inscripcion,
        precioMensualidad: mensualidad,
      });

      if (resultado?.exito) {
        setShareOpen(false);
        form.resetFields();
        message.success("Lead guardado y mensaje enviado por WhatsApp");
      } else {
        message.warning("Lead guardado, pero hubo un problema al enviar el mensaje");
      }
    } catch (err: any) {
      console.error("[Catálogo] Error:", err);
      message.error(err?.message || "No se pudo guardar el lead");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b1220", padding: "32px 24px" }}>
      <Card
        bordered={false}
        style={{
          marginBottom: 24,
          background: gradientBg,
          color: "#e5e7eb",
          overflow: "hidden",
          position: "relative",
        }}
        bodyStyle={{ padding: 28 }}
      >
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.12), transparent 35%)" }} />
        <Space direction="vertical" size={12} style={{ position: "relative", zIndex: 1 }}>
          <Tag color="#c084fc" style={{ width: "fit-content" }}>Catálogo premium</Tag>
          <Title level={2} style={{ color: "#f8fafc", margin: 0 }}>
            Programas listos para compartir por WhatsApp
          </Title>
          <Paragraph style={{ color: "#cbd5e1", maxWidth: 720, marginBottom: 0 }}>
            Envía la ficha del programa a un interesado en un clic. Cada envío queda guardado como lead para que el equipo de ventas haga seguimiento.
          </Paragraph>
        </Space>
      </Card>

      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {loading ? (
          <Row gutter={[16, 16]}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <Col xs={24} md={12} xl={8} key={idx}>
                <Card bordered={false} style={{ background: "#0f172a", border: "1px solid #1f2937" }}>
                  <Skeleton active paragraph={{ rows: 4 }} />
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Row gutter={[16, 16]}>
            {programas.map((programa) => {
              const proximos = proximosPorPrograma[programa.id] || [];
              const emoji = (programa.emoji || "").trim() || "🎯";
              const mensualidad = programa.precio_mensualidad
                ? `$${Number(programa.precio_mensualidad).toLocaleString("es-CO")}`
                : "Consultar";
              const inscripcion = programa.precio_inscripcion
                ? `$${Number(programa.precio_inscripcion).toLocaleString("es-CO")}`
                : "Consultar";

              return (
                <Col xs={24} md={12} xl={8} key={programa.id}>
                  <Card
                    bordered={false}
                    style={{
                      height: "100%",
                      background: "linear-gradient(165deg, #0f172a 0%, #111827 60%, #0b1220 100%)",
                      border: "1px solid #1f2937",
                      boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
                    }}
                    bodyStyle={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, height: "100%" }}
                  >
                    <Space align="center" size={12}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        background: "#1e293b",
                        fontSize: 20,
                      }}>
                        {emoji}
                      </div>
                      <Space direction="vertical" size={0}>
                        <Title level={4} style={{ margin: 0, color: "#f8fafc" }}>{programa.nombre}</Title>
                        <Text style={{ color: "#94a3b8" }}>{programa.duracion || "Duración a confirmar"}</Text>
                      </Space>
                    </Space>

                    <Paragraph style={{ color: "#cbd5e1", margin: 0 }} ellipsis={{ rows: 2 }}>
                      {programa.descripcion || "Programa diseñado para potenciar tu carrera."}
                    </Paragraph>

                    <Space size={8} wrap>
                      <Tag icon={<ClockCircleOutlined />} color="geekblue">{programa.total_clases ? `${programa.total_clases} clases` : "Ritmo flexible"}</Tag>
                      <Tag icon={<DollarOutlined />} color="green">Mensualidad {mensualidad}</Tag>
                      <Tag icon={<BookOutlined />} color="purple">Inscripción {inscripcion}</Tag>
                    </Space>

                    {proximos.length > 0 ? (
                      <Space direction="vertical" size={4} style={{ width: "100%" }}>
                        <Text style={{ color: "#cbd5e1" }}>Próximos grupos</Text>
                        <Space direction="vertical" size={6} style={{ width: "100%" }}>
                          {proximos.slice(0, 2).map((g) => (
                            <Card
                              key={g.id}
                              size="small"
                              bordered={false}
                              style={{ background: "#111827", border: "1px solid #1f2937" }}
                            >
                              <Space style={{ width: "100%", justifyContent: "space-between", alignItems: "center" }}>
                                <Text style={{ color: "#e2e8f0" }}>{g.nombre || "Grupo"}</Text>
                                <Space size={8}>
                                  <Tag color="purple" style={{ margin: 0 }}>{(g.estado || "").toUpperCase()}</Tag>
                                  <Text style={{ color: "#94a3b8" }}>{g.fecha_inicio ? dayjs(g.fecha_inicio).format("DD MMM") : "Próximamente"}</Text>
                                </Space>
                              </Space>
                            </Card>
                          ))}
                        </Space>
                      </Space>
                    ) : (
                      <Tag color="default">Próximamente se anunciarán fechas</Tag>
                    )}

                    <Divider style={{ margin: "8px 0", borderColor: "#1f2937" }} />

                    <Space style={{ width: "100%", justifyContent: "space-between", marginTop: "auto" }}>
                      <Space size={8}>
                        <Tag color="#22c55e">Incluye seguimiento</Tag>
                        <Tag color="#a855f7">Certificado</Tag>
                      </Space>
                      <Button
                        type="primary"
                        icon={<WhatsAppOutlined />}
                        onClick={() => abrirShare(programa)}
                        style={{ background: "#22c55e", borderColor: "#16a34a" }}
                      >
                      </Button>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Space>

      <Modal
        title={`Compartir ${selectedPrograma?.nombre ?? "programa"}`}
        open={shareOpen}
        onCancel={() => setShareOpen(false)}
        onOk={() => form.submit()}
        okText="Enviar y guardar lead"
        cancelText="Cancelar"
        okButtonProps={{ icon: <ShareAltOutlined /> }}
      >
        <Form layout="vertical" form={form} onFinish={compartir}>
          <Form.Item label="Nombre del interesado" name="nombre" rules={[{ required: true, message: "Ingresa el nombre" }]}>
            <Input placeholder="Ej: Andrea Gómez" />
          </Form.Item>
          <Form.Item label="Teléfono WhatsApp" name="telefono" rules={[{ required: true, message: "Ingresa el teléfono" }]}>
            <Input placeholder="Solo dígitos" prefix={<WhatsAppOutlined />} />
          </Form.Item>
          <Form.Item label="Email (opcional)" name="email">
            <Input placeholder="Correo del interesado" />
          </Form.Item>
          <Form.Item label="Notas internas" name="notas">
            <Input.TextArea rows={3} placeholder="Observaciones o contexto" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
