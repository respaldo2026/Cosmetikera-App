"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Tag,
  Typography,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Alert,
  Divider,
  Tooltip,
  Grid,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  WhatsAppOutlined,
  MailOutlined,
  SendOutlined,
  PhoneOutlined,
  UserOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { enviarWhatsapp } from "@utils/whatsapp";

const { useBreakpoint } = Grid;

const { Title, Text } = Typography;

interface Lead {
  id: string;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  interes?: string | null;
  canal?: string | null;
  estado?: string | null;
  notas?: string | null;
  created_at?: string | null;
}

const estadoOptions = [
  { value: "nuevo", label: "Nuevo", color: "blue" },
  { value: "contactado", label: "Contactado", color: "cyan" },
  { value: "en_seguimiento", label: "En seguimiento", color: "gold" },
  { value: "cerrado", label: "Cerrado", color: "green" },
  { value: "perdido", label: "Perdido", color: "red" },
];

const canalOptions = [
  "Instagram",
  "WhatsApp",
  "Facebook",
  "Referencia",
  "Evento",
  "Web",
  "Otro",
];

const plantillaOptions = [
  {
    key: "bienvenida",
    titulo: "Bienvenida",
    cuerpo:
      "Hola {nombre}! Soy del equipo de Academia Crystal. Gracias por tu interés en {programa}. ¿Te gustaría que te enviemos el detalle del programa y horarios?",
  },
  {
    key: "seguimiento",
    titulo: "Seguimiento",
    cuerpo:
      "Hola {nombre}, solo paso para acompañarte con cualquier duda sobre {programa}. Podemos agendar una llamada breve hoy o mañana.",
  },
  {
    key: "promo",
    titulo: "Promoción",
    cuerpo:
      "Hola {nombre}! Esta semana tenemos un cupo limitado con beneficio especial para {programa}. Si te interesa, puedo reservarte y enviarte el link de inscripción.",
  },
  {
    key: "cierre",
    titulo: "Cierre",
    cuerpo:
      "Hola {nombre}, último recordatorio sobre {programa}. Iniciamos pronto y quedan pocos cupos. Avísame si quieres asegurar tu lugar o si prefieres que te contacte más adelante.",
  },
];

const applyPlantilla = (cuerpo: string, lead: Lead) => {
  return cuerpo
    .replace(/{nombre}/gi, lead.nombre || "allí")
    .replace(/{programa}/gi, lead.interes || "tu programa de interés");
};

const normalizePhone = (value?: string | null) => {
  if (!value) return "";
  return value.replace(/\D+/g, "");
};

const buildMailTo = (lead: Lead, mensaje: string) => {
  const subject = encodeURIComponent(`Info ${lead.interes || "Academia Crystal"}`);
  const body = encodeURIComponent(mensaje);
  return `mailto:${lead.email || ""}?subject=${subject}&body=${body}`;
};

export default function LeadsPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [filtroEstado, setFiltroEstado] = useState<string | undefined>();
  const [filtroCanal, setFiltroCanal] = useState<string | undefined>();
  const [filtroPrograma, setFiltroPrograma] = useState<string | undefined>();
  const [programas, setProgramas] = useState<string[]>([]);
  const [tablaInexistente, setTablaInexistente] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    cargarProgramas();
    cargarLeads();
  }, []);

  const cargarProgramas = async () => {
    try {
      const { data, error } = await supabaseBrowserClient
        .from("programas")
        .select("nombre")
        .eq("activo", true)
        .order("nombre");
      if (!error && data) {
        setProgramas(data.map((p: any) => p.nombre).filter(Boolean));
      }
    } catch (error) {
      console.error("Error cargando programas", error);
    }
  };

  const cargarLeads = async () => {
    setLoading(true);
    setTablaInexistente(false);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if ((error as any)?.code === "42P01") {
          setTablaInexistente(true);
        } else {
          message.error("No se pudieron cargar los leads");
        }
        setLeads([]);
        return;
      }

      setLeads((data as Lead[]) || []);
    } catch (err) {
      console.error("Error cargando leads", err);
      message.error("No se pudieron cargar los leads");
    } finally {
      setLoading(false);
    }
  };

  const crearLead = async (values: any) => {
    try {
      const payload = {
        nombre: values.nombre,
        telefono: values.telefono || null,
        email: values.email || null,
        interes: values.interes || null,
        canal: values.canal || null,
        notas: values.notas || null,
        estado: values.estado || "nuevo",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabaseBrowserClient.from("leads").insert(payload);
      if (error) {
        message.error("No se pudo guardar el lead");
        return;
      }

      message.success("Lead guardado");
      setModalVisible(false);
      form.resetFields();
      cargarLeads();
    } catch (err) {
      console.error("Error guardando lead", err);
      message.error("No se pudo guardar el lead");
    }
  };

  const actualizarEstado = async (lead: Lead, estado: string) => {
    try {
      setLoading(true);
      const { error } = await supabaseBrowserClient
        .from("leads")
        .update({ estado })
        .eq("id", lead.id);

      if (error) {
        message.error("No se pudo actualizar el estado");
        return;
      }

      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, estado } : l)));
      message.success("Estado actualizado");
    } catch (err) {
      console.error("Error actualizando estado", err);
      message.error("No se pudo actualizar el estado");
    } finally {
      setLoading(false);
    }
  };

  const eliminarLead = async (lead: Lead) => {
    console.log("🗑️ eliminarLead llamado para:", lead.nombre, "ID:", lead.id);
    
    // TEMPORAL: Sin modal de confirmación para testing
    const confirmDelete = window.confirm(`¿Eliminar a ${lead.nombre}?\n\nEsta acción no se puede deshacer.`);
    
    if (!confirmDelete) {
      console.log("❌ Usuario canceló con browser confirm");
      return;
    }
    
    console.log("✅ Usuario confirmó, iniciando eliminación...");
    
    try {
      setLoading(true);
      console.log("📡 Llamando a Supabase DELETE para ID:", lead.id);
      
      const { data, error, status, statusText } = await supabaseBrowserClient
        .from("leads")
        .delete()
        .eq("id", lead.id)
        .select();

      console.log("📊 Respuesta Supabase:", { data, error, status, statusText });

      if (error) {
        console.error("❌ Error Supabase:", error);
        console.error("❌ Error details:", error.details);
        console.error("❌ Error hint:", error.hint);
        console.error("❌ Error code:", error.code);
        message.error("No se pudo eliminar el lead: " + error.message);
        return;
      }

      console.log("✅ Lead eliminado exitosamente:", data);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      message.success("Lead eliminado");
    } catch (err) {
      console.error("💥 Error catch eliminando lead:", err);
      message.error("No se pudo eliminar el lead");
    } finally {
      setLoading(false);
      console.log("🏁 Proceso de eliminación finalizado");
    }
  };
  
  /*
  // VERSIÓN CON MODAL (deshabilitada temporalmente)
  const eliminarLeadConModal = async (lead: Lead) => {
    console.log("🗑️ eliminarLead llamado para:", lead.nombre, "ID:", lead.id);
    
    try {
      console.log("🔨 Intentando abrir Modal.confirm...");
      
      const modalInstance = Modal.confirm({
        title: "¿Eliminar este lead?",
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <p><strong>{lead.nombre}</strong></p>
            <p>Esta acción no se puede deshacer.</p>
          </div>
        ),
        okText: "Sí, eliminar",
        okType: "danger",
        cancelText: "Cancelar",
        centered: true,
        getContainer: () => document.body,
        zIndex: 9999,
        async onOk() {
          console.log("✅ Modal confirmado, iniciando eliminación...");
          try {
            setLoading(true);
            console.log("📡 Llamando a Supabase DELETE para ID:", lead.id);
            
            const { data, error, status, statusText } = await supabaseBrowserClient
              .from("leads")
              .delete()
              .eq("id", lead.id)
              .select();

            console.log("📊 Respuesta Supabase:", { data, error, status, statusText });

            if (error) {
              console.error("❌ Error Supabase:", error);
              console.error("❌ Error details:", error.details);
              console.error("❌ Error hint:", error.hint);
              console.error("❌ Error code:", error.code);
              message.error("No se pudo eliminar el lead: " + error.message);
              return;
            }

            console.log("✅ Lead eliminado exitosamente:", data);
            setLeads((prev) => prev.filter((l) => l.id !== lead.id));
            message.success("Lead eliminado");
          } catch (err) {
            console.error("💥 Error catch eliminando lead:", err);
            message.error("No se pudo eliminar el lead");
          } finally {
            setLoading(false);
            console.log("🏁 Proceso de eliminación finalizado");
          }
        },
        onCancel() {
          console.log("❌ Usuario canceló la eliminación");
        }
      });
      
      console.log("📦 Modal instance creado:", modalInstance ? "✅ OK" : "❌ NULL");
    } catch (error) {
      console.error("💥 ERROR al crear modal:", error);
    }
  };
  */

  const eliminarSeleccionados = () => {
    const totalSeleccionados = selectedRowKeys.length;
    
    if (totalSeleccionados === 0) {
      message.warning("Selecciona al menos un lead para eliminar");
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar ${totalSeleccionados} lead${totalSeleccionados > 1 ? "s" : ""}?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    const selectedIds = selectedRowKeys.map((key) => String(key));

    (async () => {
      try {
        setLoading(true);

        const { error } = await supabaseBrowserClient
          .from("leads")
          .delete()
          .in("id", selectedIds);

        if (error) {
          console.error("Error Supabase:", error);
          message.error("No se pudieron eliminar algunos leads");
          return;
        }

        setLeads((prev) => prev.filter((l) => !selectedIds.includes(String(l.id))));
        setSelectedRowKeys([]);
        message.success(`${totalSeleccionados} lead${totalSeleccionados > 1 ? 's' : ''} eliminado${totalSeleccionados > 1 ? 's' : ''}`);
      } catch (err) {
        console.error("Error eliminando leads:", err);
        message.error("No se pudieron eliminar los leads");
      } finally {
        setLoading(false);
      }
    })();
  };

  const eliminarTodosLeads = () => {
    let confirmInput = "";
    const totalLeads = leads.length;

    Modal.confirm({
      title: "¿ELIMINAR TODOS LOS LEADS?",
      icon: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
      width: 500,
      content: (
        <div>
          <p><strong>Se eliminarán {totalLeads} leads de forma permanente.</strong></p>
          <p style={{ color: "#ff4d4f", marginBottom: 16 }}>⚠️ Esta acción NO se puede deshacer.</p>
          <p style={{ marginBottom: 8 }}>Escribe <strong>&quot;ELIMINAR&quot;</strong> para confirmar:</p>
          <Input
            placeholder="Escribe ELIMINAR"
            onChange={(e) => { confirmInput = e.target.value; }}
            onPressEnter={(e) => {
              e.preventDefault();
              const btn = document.querySelector('.ant-modal-confirm-btns .ant-btn-primary') as HTMLButtonElement;
              btn?.click();
            }}
            autoFocus
          />
        </div>
      ),
      okText: "Confirmar eliminación",
      okType: "danger",
      cancelText: "Cancelar",
      async onOk() {
        if (confirmInput.trim() !== "ELIMINAR") {
          message.warning('Debes escribir "ELIMINAR" para confirmar');
          return Promise.reject(new Error("Confirmación incorrecta"));
        }

        try {
          setLoading(true);
          
          // Eliminar todos los leads de la base de datos
          const { error } = await supabaseBrowserClient
            .from("leads")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");

          if (error) {
            console.error("Error Supabase:", error);
            message.error("No se pudieron eliminar los leads");
            return Promise.reject(error);
          }

          setLeads([]);
          message.success(`${totalLeads} leads eliminados correctamente`);
        } catch (err) {
          console.error("Error eliminando todos los leads:", err);
          message.error("No se pudieron eliminar los leads");
          return Promise.reject(err);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const sendTemplate = (lead: Lead, plantillaKey: string, canal: "whatsapp" | "email") => {
    const plantilla = plantillaOptions.find((p) => p.key === plantillaKey);
    if (!plantilla) return;

    const mensaje = applyPlantilla(plantilla.cuerpo, lead);

    if (canal === "whatsapp") {
      if (!lead.telefono) {
        message.warning("El lead no tiene teléfono");
        return;
      }
      const phone = normalizePhone(lead.telefono);
      enviarWhatsapp(phone, mensaje);
    } else {
      if (!lead.email) {
        message.warning("El lead no tiene email");
        return;
      }
      const url = buildMailTo(lead, mensaje);
      window.open(url, "_blank");
    }
  };

  const leadsFiltrados = useMemo(() => {
    return leads.filter((l) => {
      if (filtroEstado && (l.estado || "").toLowerCase() !== filtroEstado) return false;
      if (filtroCanal && (l.canal || "").toLowerCase() !== filtroCanal.toLowerCase()) return false;
      if (filtroPrograma && (l.interes || "").toLowerCase() !== filtroPrograma.toLowerCase()) return false;
      return true;
    });
  }, [leads, filtroEstado, filtroCanal, filtroPrograma]);

  const leadStats = useMemo(() => {
    const total = leadsFiltrados.length;
    const nuevo = leadsFiltrados.filter((l) => (l.estado || "") === "nuevo").length;
    const seguimiento = leadsFiltrados.filter((l) => (l.estado || "") === "en_seguimiento").length;
    const cerrado = leadsFiltrados.filter((l) => (l.estado || "") === "cerrado").length;
    return { total, nuevo, seguimiento, cerrado };
  }, [leadsFiltrados]);

  const getEstadoColor = (estado?: string | null) => {
    return estadoOptions.find((e) => e.value === (estado || ""))?.color || "default";
  };

  const renderLeadCard = (record: Lead) => {
    const isSelected = selectedRowKeys.includes(record.id);
    
    return (
      <Card
        key={record.id}
        hoverable
        style={{ 
          borderRadius: 14, 
          border: isSelected ? "2px solid #1890ff" : "1px solid #f0f0f0",
          backgroundColor: isSelected ? "#f0f7ff" : "#fff"
        }}
        bodyStyle={{ padding: 16 }}
      >
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Space>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRowKeys([...selectedRowKeys, record.id]);
                  } else {
                    setSelectedRowKeys(selectedRowKeys.filter(k => k !== record.id));
                  }
                }}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <UserOutlined />
              <Text strong>{record.nombre}</Text>
            </Space>
            <Tag color={getEstadoColor(record.estado)}>{record.estado || "nuevo"}</Tag>
          </Space>

        <Space size={6} wrap>
          {record.telefono && (
            <Tag icon={<PhoneOutlined />} color="blue">
              {record.telefono}
            </Tag>
          )}
          {record.email && (
            <Tag icon={<MailOutlined />} color="geekblue">
              {record.email}
            </Tag>
          )}
        </Space>

        <Space direction="vertical" size={2}>
          <Text type="secondary">Interés: {record.interes || "-"}</Text>
          <Text type="secondary">Canal: {record.canal || "-"}</Text>
          <Text type="secondary">
            Creado: {record.created_at ? dayjs(record.created_at).format("DD MMM YYYY") : "-"}
          </Text>
        </Space>

        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Select
            size="middle"
            value={record.estado || "nuevo"}
            onChange={(value) => actualizarEstado(record, value)}
            options={estadoOptions.map((e) => ({ value: e.value, label: e.label }))}
            style={{ width: "100%" }}
          />
          <Space style={{ width: "100%" }}>
            <Button
              icon={<WhatsAppOutlined />}
              type="primary"
              ghost
              size="small"
              onClick={() => sendTemplate(record, "bienvenida", "whatsapp")}
            >
              WhatsApp
            </Button>
            <Button
              icon={<SendOutlined />}
              size="small"
              onClick={() => sendTemplate(record, "bienvenida", "email")}
            >
              Email
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => eliminarLead(record)}
            >
              Eliminar
            </Button>
          </Space>
        </Space>
      </Space>
    </Card>
    );
  };

  const columns = [
    {
      title: "Lead",
      dataIndex: "nombre",
      key: "nombre",
      render: (_: any, record: Lead) => (
        <Space direction="vertical" size={2}>
          <Space>
            <UserOutlined />
            <Text strong>{record.nombre}</Text>
          </Space>
          <Space size={6} wrap>
            {record.telefono && (
              <Tag icon={<PhoneOutlined />} color="blue">
                {record.telefono}
              </Tag>
            )}
            {record.email && (
              <Tag icon={<MailOutlined />} color="geekblue">
                {record.email}
              </Tag>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: "Interés",
      dataIndex: "interes",
      key: "interes",
      render: (value: string | null) => value || "-",
    },
    {
      title: "Canal",
      dataIndex: "canal",
      key: "canal",
      render: (value: string | null) => value || "-",
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (_: any, record: Lead) => {
        const estado = estadoOptions.find((e) => e.value === (record.estado || ""));
        return (
          <Select
            size="small"
            value={record.estado || "nuevo"}
            onChange={(value) => actualizarEstado(record, value)}
            options={estadoOptions.map((e) => ({ value: e.value, label: e.label }))}
            style={{ minWidth: 140 }}
          />
        );
      },
    },
    {
      title: "Creado",
      dataIndex: "created_at",
      key: "created_at",
      render: (value: string | null) => (value ? dayjs(value).format("DD MMM YYYY") : "-"),
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (_: any, record: Lead) => (
        <Space>
          <Select
            placeholder="Plantilla"
            size="small"
            style={{ width: 150 }}
            options={plantillaOptions.map((p) => ({ value: p.key, label: p.titulo }))}
            onSelect={(value) => sendTemplate(record, value, "whatsapp")}
            suffixIcon={<WhatsAppOutlined style={{ color: "#25D366" }} />}
          />
          <Tooltip title="Enviar por email">
            <Select
              placeholder="Email"
              size="small"
              style={{ width: 130 }}
              options={plantillaOptions.map((p) => ({ value: p.key, label: p.titulo }))}
              onSelect={(value) => sendTemplate(record, value, "email")}
              suffixIcon={<SendOutlined />}
            />
          </Tooltip>
          <Tooltip title="Eliminar lead">
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => eliminarLead(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? 12 : isTablet ? 16 : 24 }}>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Card
          style={{
            borderRadius: 16,
            border: "none",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
            color: "#fff",
          }}
          bodyStyle={{ padding: isMobile ? 16 : 24 }}
        >
          <Space
            style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}
            direction={isMobile ? "vertical" : "horizontal"}
          >
            <Space direction="vertical" size={4}>
              <Title level={isMobile ? 4 : 3} style={{ margin: 0, color: "#fff" }}>
                Leads e interesados
              </Title>
              <Text style={{ color: "#cbd5f5" }}>
                Gestiona contactos, seguimiento y comunicación en un solo lugar.
              </Text>
            </Space>
            <Space size={isMobile ? 8 : "middle"} wrap direction={isMobile ? "vertical" : "horizontal"} style={{ width: isMobile ? "100%" : "auto" }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={cargarLeads}
                size={isMobile ? "middle" : "large"}
                block={isMobile}
              >
                Recargar
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={eliminarTodosLeads}
                size={isMobile ? "middle" : "large"}
                block={isMobile}
                disabled={leads.length === 0}
              >
                Eliminar todos
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setModalVisible(true)}
                size={isMobile ? "middle" : "large"}
                block={isMobile}
              >
                Nuevo lead
              </Button>
            </Space>
          </Space>
        </Card>

        <Card style={{ borderRadius: 16 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={12} md={6}>
              <Statistic title="Total" value={leadStats.total} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Nuevos" value={leadStats.nuevo} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="En seguimiento" value={leadStats.seguimiento} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Cerrados" value={leadStats.cerrado} />
            </Col>
          </Row>
        </Card>

        <Card style={{ borderRadius: 16 }}>
          <Space
            style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}
            direction={isMobile ? "vertical" : "horizontal"}
          >
            <Space size="small" wrap>
              <Text strong>Filtros</Text>
              {!isMobile && <Tag color="purple">WhatsApp / Email</Tag>}
            </Space>
            <Space size={isMobile ? 8 : "middle"} wrap direction={isMobile ? "vertical" : "horizontal"} style={{ width: isMobile ? "100%" : "auto" }}>
              <Select
                allowClear
                placeholder="Estado"
                size={isMobile ? "middle" : "large"}
                style={{ width: isMobile ? "100%" : 160 }}
                options={estadoOptions}
                value={filtroEstado}
                onChange={(v) => setFiltroEstado(v)}
              />
              <Select
                allowClear
                placeholder="Canal"
                size={isMobile ? "middle" : "large"}
                style={{ width: isMobile ? "100%" : 160 }}
                options={canalOptions.map((c) => ({ value: c.toLowerCase(), label: c }))}
                value={filtroCanal}
                onChange={(v) => setFiltroCanal(v)}
              />
              <Select
                allowClear
                showSearch
                placeholder="Programa"
                size={isMobile ? "middle" : "large"}
                style={{ width: isMobile ? "100%" : 200 }}
                options={programas.map((p) => ({ value: p, label: p }))}
                value={filtroPrograma}
                onChange={(v) => setFiltroPrograma(v)}
              />
            </Space>
          </Space>
        </Card>

        {tablaInexistente && (
          <Alert
            type="warning"
            showIcon
            icon={<InfoCircleOutlined />}
            message="Crea la tabla 'leads' en Supabase"
            description={
              <div>
                La vista intentó consultar la tabla &quot;leads&quot; pero no existe. Crea una tabla con campos:
                <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                  <li>id (uuid) primary key default uuid_generate_v4()</li>
                  <li>nombre text</li>
                  <li>telefono text</li>
                  <li>email text</li>
                  <li>interes text</li>
                  <li>canal text</li>
                  <li>estado text</li>
                  <li>notas text</li>
                  <li>created_at timestamp with time zone default now()</li>
                </ul>
                Una vez creada, pulsa &quot;Recargar&quot;.
              </div>
            }
            style={{ background: "#fffbe6" }}
          />
        )}

        <Card style={{ borderRadius: 16 }}>
          {selectedRowKeys.length > 0 && (
            <Alert
              message={
                <Space direction={isMobile ? "vertical" : "horizontal"} style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text>
                    <strong>{selectedRowKeys.length}</strong> lead{selectedRowKeys.length > 1 ? 's' : ''} seleccionado{selectedRowKeys.length > 1 ? 's' : ''}
                  </Text>
                  <Space wrap>
                    <Button
                      size="small"
                      onClick={() => setSelectedRowKeys([])}
                    >
                      Limpiar selección
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={eliminarSeleccionados}
                    >
                      Eliminar seleccionados
                    </Button>
                  </Space>
                </Space>
              }
              type="info"
              style={{ marginBottom: 16 }}
            />
          )}
          
          {isMobile ? (
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              {leadsFiltrados.length === 0 && (
                <Text type="secondary">{tablaInexistente ? "Crea la tabla 'leads' y recarga." : "Sin leads"}</Text>
              )}
              {leadsFiltrados.map((lead) => renderLeadCard(lead))}
            </Space>
          ) : (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={leadsFiltrados}
              loading={loading}
              scroll={isTablet ? { x: 800 } : undefined}
              size="middle"
              pagination={{ 
                pageSize: 10,
                simple: false,
                showSizeChanger: true 
              }}
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys,
                onChange: (selectedKeys) => {
                  setSelectedRowKeys(selectedKeys);
                },
                selections: [
                  Table.SELECTION_ALL,
                  Table.SELECTION_INVERT,
                  Table.SELECTION_NONE,
                ],
              }}
              locale={{ emptyText: tablaInexistente ? "Crea la tabla 'leads' y recarga." : "Sin leads" }}
            />
          )}
        </Card>
      </Space>

      <Modal
        title="Nuevo lead"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText="Guardar"
        cancelText="Cancelar"
        width={isMobile ? "100%" : isTablet ? 500 : 600}
        style={isMobile ? { top: 0, paddingBottom: 0, maxHeight: "100vh" } : undefined}
        bodyStyle={isMobile ? { maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : undefined}
      >
        <Form layout="vertical" form={form} onFinish={crearLead}>
          <Form.Item name="nombre" label="Nombre completo" rules={[{ required: true, message: "Ingresa el nombre" }]}> 
            <Input placeholder="Ej: Andrea Gómez" />
          </Form.Item>

          <Form.Item label="Contacto">
            <Input.Group compact>
              <Form.Item name="telefono" noStyle>
                <Input style={{ width: "50%" }} prefix={<PhoneOutlined />} placeholder="Teléfono (solo dígitos)" />
              </Form.Item>
              <Form.Item name="email" noStyle>
                <Input style={{ width: "50%" }} prefix={<MailOutlined />} placeholder="Email" />
              </Form.Item>
            </Input.Group>
          </Form.Item>

          <Form.Item name="interes" label="Programa/Interés">
            <Select
              showSearch
              placeholder="Selecciona o escribe"
              options={programas.map((p) => ({ value: p, label: p }))}
              allowClear
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <Divider style={{ margin: "8px 0" }} />
                  <div style={{ padding: "0 8px 4px" }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Si no está en la lista, escríbelo directo
                    </Text>
                  </div>
                </div>
              )}
            />
          </Form.Item>

          <Form.Item name="canal" label="Canal de origen">
            <Select
              placeholder="Selecciona"
              allowClear
              options={canalOptions.map((c) => ({ value: c, label: c }))}
            />
          </Form.Item>

          <Form.Item name="estado" label="Estado" initialValue="nuevo">
            <Select options={estadoOptions} />
          </Form.Item>

          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={3} placeholder="Contexto, disponibilidad, motivación..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
