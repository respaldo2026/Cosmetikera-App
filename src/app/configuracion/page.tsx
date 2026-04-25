"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Tabs, Card, Spin, Form, Input, Button, message, Table, Switch, Select, Modal, Tag, Divider, Upload, Space, Row, Col, Grid, Alert, Badge, Radio } from "antd";
import { SettingOutlined, TeamOutlined, SaveOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, CreditCardOutlined, WhatsAppOutlined, UploadOutlined, InstagramOutlined, FacebookOutlined, YoutubeOutlined, EnvironmentOutlined, PrinterOutlined, WifiOutlined, ReloadOutlined, CopyOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import type { ColumnsType } from "antd/es/table";
import type { Breakpoint } from "antd/es/_util/responsiveObserver";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { qzConectar, qzActivo, listarImpresoras, invalidarConfigPOS, imprimirTicketTermico, abrirCajon } from "@utils/pos-hardware";
import { DEFAULT_TICKET_FIELDS, crearTemplateTicketPOS, crearTicketPruebaPOS, invalidarConfigTicketPOS } from "@utils/pos-ticket-template";
import { MODULES, type ModuleDefinition } from "@/constants/modules";
import { ROLES } from "@/constants/roles";

const { TextArea } = Input;
const { Option } = Select;
const LOGO_STORAGE_BUCKET = "branding";

// Interfaces
interface Admin {
  id: string;
  nombre_completo: string;
  email: string;
  rol: string;
  identificacion: string;
  telefono?: string;
  created_at: string;
}

interface PermisosPorRol {
  [rol: string]: {
    [modulo: string]: boolean;
  };
}

interface MedioPago {
  id: number;
  nombre: string;
  tipo: string;
  descripcion?: string; // Instrucciones o detalles del medio de pago
  informacion?: string; // Información adicional (número cuenta, etc)
  activo: boolean;
  detalles?: any;
  created_at?: string;
}

interface PlantillaWhatsApp {
  id: string;
  nombre: string;
  descripcion?: string;
  plantilla: string;
  activa: boolean;
  created_at?: string;
}

export default function ConfiguracionPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState("negocio");
  const [initialized, setInitialized] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;

  // Estados para la configuración del negocio
  const [formAcademia] = Form.useForm();
  const [loadingAcademia, setLoadingAcademia] = useState(false);
  const [savingAcademia, setSavingAcademia] = useState(false);
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [configuracionId, setConfiguracionId] = useState<string | null>(null);

  const [ticketFields, setTicketFields] = useState(DEFAULT_TICKET_FIELDS);

  const previewNombreAcademia = Form.useWatch("nombre_academia", formAcademia) as string | undefined;
  const previewRuc = Form.useWatch("ruc", formAcademia) as string | undefined;
  const previewDireccion = Form.useWatch("direccion", formAcademia) as string | undefined;
  const previewTelefono = Form.useWatch("telefono", formAcademia) as string | undefined;
  const previewEmail = Form.useWatch("email", formAcademia) as string | undefined;
  const previewLogoUrl = Form.useWatch("logo_url", formAcademia) as string | undefined;
  const previewTicketTitulo = Form.useWatch("ticket_titulo", formAcademia) as string | undefined;
  const previewTicketPie = Form.useWatch("ticket_pie", formAcademia) as string | undefined;
  const previewTicketNota = Form.useWatch("ticket_nota", formAcademia) as string | undefined;
  const previewInstagram = Form.useWatch("instagram", formAcademia) as string | undefined;
  const previewFacebook = Form.useWatch("facebook", formAcademia) as string | undefined;
  const previewYoutube = Form.useWatch("youtube", formAcademia) as string | undefined;
  const previewMapsUrl = Form.useWatch("maps_url", formAcademia) as string | undefined;

  // Función para acortar URLs de redes sociales
  const shortenSocialUrl = (url: string | undefined, platform: 'instagram' | 'facebook' | 'youtube'): string => {
    if (!url || url.trim() === '') return '';
    
    let cleanUrl = url.trim();
    cleanUrl = cleanUrl.replace(/^https?:\/\/(www\.)?/, '');
    
    if (platform === 'instagram') {
      const match = cleanUrl.match(/instagram\.com\/([^\/\?\s]+)/);
      if (match && match[1]) return `@${match[1]}`;
      return cleanUrl;
    }
    
    if (platform === 'facebook') {
      let cleaned = cleanUrl.replace(/facebook\.com/, 'fb.com');
      cleaned = cleaned.replace(/\/pages\/([^\/]+)\/\d+/, '/$1');
      cleaned = cleaned.split('?')[0] || cleaned;
      return cleaned;
    }
    
    if (platform === 'youtube') {
      const atMatch = cleanUrl.match(/youtube\.com\/@([^\/\?\s]+)/);
      if (atMatch && atMatch[1]) return `@${atMatch[1]}`;
      let cleaned = cleanUrl.replace(/youtube\.com/, 'yt.com');
      cleaned = cleaned.split('?')[0] || cleaned;
      return cleaned;
    }
    
    return cleanUrl;
  };

  // Estados para Permisos
  const [permisos, setPermisos] = useState<PermisosPorRol>({});
  const [loadingPermisos, setLoadingPermisos] = useState(false);
  const [savingPermisos, setSavingPermisos] = useState(false);
  const [hasChangesPermisos, setHasChangesPermisos] = useState(false);

  // Estados para Administradores
  const [formAdmin] = Form.useForm();
  const [adminsList, setAdminsList] = useState<Admin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [modalAdminVisible, setModalAdminVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  // Estados para Medios de Pago
  const [formMedioPago] = Form.useForm();
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);
  const [loadingMediosPago, setLoadingMediosPago] = useState(false);
  const [modalMedioPagoVisible, setModalMedioPagoVisible] = useState(false);
  const [editingMedioPago, setEditingMedioPago] = useState<MedioPago | null>(null);
  const [submittingMedioPago, setSubmittingMedioPago] = useState(false);

  // Estados para Plantillas WhatsApp
  const [formPlantilla] = Form.useForm();
  const [plantillasWhatsApp, setPlantillasWhatsApp] = useState<PlantillaWhatsApp[]>([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [modalPlantillaVisible, setModalPlantillaVisible] = useState(false);
  const [editingPlantilla, setEditingPlantilla] = useState<PlantillaWhatsApp | null>(null);
  const [submittingPlantilla, setSubmittingPlantilla] = useState(false);

  // ── Estados POS / Impresora ──────────────────────────────────────────────
  const [qzEstado, setQzEstado] = useState<"desconocido" | "conectado" | "desconectado">("desconocido");
  const [conectandoQZ, setConectandoQZ] = useState(false);
  const [impresorasDisponibles, setImpresorasDisponibles] = useState<string[]>([]);
  const [buscandoImpresoras, setBuscandoImpresoras] = useState(false);
  const [posPrinterName, setPosPrinterName] = useState<string>("");
  const [posPrinterWidth, setPosPrinterWidth] = useState<number>(48);
  const [savingPos, setSavingPos] = useState(false);
  const [testImprimiendo, setTestImprimiendo] = useState(false);
  const [testCajon, setTestCajon] = useState(false);
  const posPrintMode = (process.env.NEXT_PUBLIC_POS_PRINT_MODE ?? "auto").toLowerCase();
  const usaQZ = posPrintMode === "qz";
  const usaAgenteLocal = posPrintMode === "agent" || posPrintMode === "auto";
  const permiteCajon = usaQZ || usaAgenteLocal;
  const currentSiteOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const modulos: ModuleDefinition[] = MODULES;

  const roleKeys = Object.keys(ROLES);
  const roleLabels = roleKeys.reduce<Record<string, string>>((acc, key) => {
    const rawLabel = ROLES[key]?.label || key;
    acc[key] = rawLabel.replace(/^[^\w]*\s*/, "").trim() || key;
    return acc;
  }, {});
  const adminAssignableRoles = ["administrador", "marketing", "vendedor"];
  const infoSeparator = "\n\nInformacion adicional:\n";

  const splitDescripcion = (value?: string | null) => {
    const raw = value || "";
    if (!raw.includes(infoSeparator)) {
      return { descripcion: raw, informacion: "" };
    }

    const [descripcion, informacion] = raw.split(infoSeparator);
    return {
      descripcion: (descripcion || "").trim(),
      informacion: (informacion || "").trim(),
    };
  };

  const buildDescripcion = (descripcion?: string, informacion?: string) => {
    const base = (descripcion || "").trim();
    const extra = (informacion || "").trim();
    if (!extra) return base;
    return `${base}${base ? infoSeparator : "Informacion adicional:\n"}${extra}`;
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      messageApi.error("Solo puedes subir imágenes (PNG, JPG, SVG)");
      return Upload.LIST_IGNORE;
    }

    setUploadingLogo(true);
    try {
      const fileExt = (file.name.split(".").pop() || "png").toLowerCase();
      const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
      const filePath = `logo/logo-${uniqueId}.${fileExt}`;

      const { error: uploadError } = await supabaseBrowserClient.storage
        .from(LOGO_STORAGE_BUCKET)
        .upload(filePath, file, { cacheControl: "3600", upsert: true, contentType: file.type });

      if (uploadError) {
        const errorMessage = uploadError.message || "Error subiendo el logo";
        if (errorMessage.toLowerCase().includes("bucket")) {
          throw new Error(
            `No existe el bucket '${LOGO_STORAGE_BUCKET}' en Supabase Storage. Créalo como público y agrega políticas de insert/select para storage.objects.`
          );
        }
        if (errorMessage.toLowerCase().includes("policy") || errorMessage.toLowerCase().includes("row-level")) {
          throw new Error(
            `Faltan políticas RLS para subir el logo en el bucket '${LOGO_STORAGE_BUCKET}'.`
          );
        }
        throw uploadError;
      }

      const { data: publicData } = supabaseBrowserClient.storage
        .from(LOGO_STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) {
        throw new Error("No se pudo obtener la URL pública del logo");
      }

      formAcademia.setFieldsValue({ logo_url: publicUrl });
      setLogoFileList([
        {
          uid: uniqueId,
          name: file.name,
          status: "done",
          url: publicUrl,
        },
      ]);

      messageApi.success("Logo actualizado correctamente");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo subir el logo";
      messageApi.error(errorMessage);
    } finally {
      setUploadingLogo(false);
    }

    return Upload.LIST_IGNORE;
  };

  const handleRemoveLogo = () => {
    formAcademia.setFieldsValue({ logo_url: null });
    setLogoFileList([]);
    messageApi.info("Logo eliminado");
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === "permisos" && Object.keys(permisos).length === 0) {
      cargarPermisos();
    } else if (key === "administradores" && adminsList.length === 0) {
      cargarAdministradores();
    } else if (key === "medios-pago" && mediosPago.length === 0) {
      cargarMediosPago();
    } else if (key === "plantillas-whatsapp" && plantillasWhatsApp.length === 0) {
      cargarPlantillasWhatsApp();
    } else if (key === "pos") {
      cargarConfigPosTab();
    }
  };

  // ==================== FUNCIONES POS / IMPRESORA ====================
  const cargarConfigPosTab = useCallback(async () => {
    // Cargar config guardada
    try {
      const { data } = await supabaseBrowserClient
        .from("configuracion")
        .select("pos_printer_name, pos_printer_width")
        .limit(1)
        .maybeSingle();
      if (data) {
        setPosPrinterName(data.pos_printer_name ?? "");
        setPosPrinterWidth(data.pos_printer_width ?? 48);
      }
    } catch { /* ignorar */ }
    // Verificar estado QZ Tray
    setQzEstado(qzActivo() ? "conectado" : "desconectado");
  }, []);

  const conectarQZ = async () => {
    if (!usaQZ) {
      messageApi.info("El modo actual no usa QZ Tray. Esta acción no aplica.");
      return;
    }
    setConectandoQZ(true);
    const ok = await qzConectar();
    setQzEstado(ok ? "conectado" : "desconectado");
    if (ok) {
      buscarImpresoras();
    } else {
      messageApi.error("No se pudo conectar a QZ Tray. Verifica que esté instalado y corriendo.");
    }
    setConectandoQZ(false);
  };

  const buscarImpresoras = async () => {
    if (!usaQZ) {
      setImpresorasDisponibles([]);
      return;
    }
    setBuscandoImpresoras(true);
    const lista = await listarImpresoras();
    setImpresorasDisponibles(lista);
    setBuscandoImpresoras(false);
  };

  const guardarConfigPos = async () => {
    setSavingPos(true);
    try {
      // Obtener ID del registro de configuración existente
      const { data: configs } = await supabaseBrowserClient
        .from("configuracion")
        .select("id")
        .limit(1);
      const id = configs?.[0]?.id;
      if (!id) {
        messageApi.error("No hay registro de configuración. Guarda primero la pestaña Negocio.");
        return;
      }
      const { error } = await supabaseBrowserClient
        .from("configuracion")
        .update({ pos_printer_name: posPrinterName || null, pos_printer_width: posPrinterWidth })
        .eq("id", id);
      if (error) throw error;
      invalidarConfigPOS();
      invalidarConfigTicketPOS();
      messageApi.success("Configuración de impresora guardada");
    } catch (e: any) {
      messageApi.error("Error al guardar: " + e.message);
    } finally {
      setSavingPos(false);
    }
  };

  const testImprimir = async () => {
    setTestImprimiendo(true);
    try {
      const ticket = crearTicketPruebaPOS(
        crearTemplateTicketPOS(formAcademia.getFieldsValue(), ticketFields)
      );
      const result = await imprimirTicketTermico(
        ticket,
        posPrinterName || null,
        posPrinterWidth,
        { allowBrowserFallback: false }
      );
      if (!result.ok) {
        if (usaAgenteLocal) {
          messageApi.error(`El agente no pudo imprimir: ${result.error ?? "sin detalle"}`);
        } else {
          messageApi.warning(`No se pudo imprimir por backend local: ${result.error ?? "sin detalle"}. Abriendo impresión del navegador...`);
          const { imprimirTicketNavegador } = await import("@utils/pos-hardware");
          imprimirTicketNavegador(ticket);
        }
      } else {
        messageApi.success(
          usaQZ
            ? "Ticket de prueba enviado a la impresora"
            : usaAgenteLocal
            ? "Ticket de prueba enviado por agente local"
            : "Se abrió la impresión del navegador"
        );
      }
    } catch (e: any) {
      messageApi.error("La prueba de impresión falló: " + (e?.message ?? "desconocido"));
    } finally {
      setTestImprimiendo(false);
    }
  };

  const testAbrirCajon = async () => {
    if (!permiteCajon) {
      messageApi.info("Este modo no tiene backend de hardware para abrir cajón.");
      return;
    }
    setTestCajon(true);
    try {
      const result = await abrirCajon(posPrinterName || null);
      if (!result.ok) {
        messageApi.error("No se pudo abrir el cajón: " + (result.error ?? "desconocido"));
      } else {
        messageApi.success("\u00a1Señal enviada al cajón monedero!");
      }
    } finally {
      setTestCajon(false);
    }
  };

  const copiarSitioActualQZ = async () => {
    if (!currentSiteOrigin) {
      messageApi.warning("No se pudo detectar la URL actual de la app.");
      return;
    }

    try {
      await navigator.clipboard.writeText(currentSiteOrigin);
      messageApi.success("Sitio copiado. Pégalo en los sitios permitidos de QZ Tray.");
    } catch {
      messageApi.warning(`Copia manualmente este sitio en QZ Tray: ${currentSiteOrigin}`);
    }
  };

  const renderTicketDesigner = () => {
    const ticketTemplate = crearTemplateTicketPOS(formAcademia.getFieldsValue(), ticketFields);
    const ticketPreview = crearTicketPruebaPOS(ticketTemplate);

    return (
      <>
        <Divider orientation="left">Diseño del ticket de venta</Divider>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Este diseño se usa tanto en la prueba de impresora como en el ticket real de cada venta."
        />
        <Row gutter={[16, 8]}>
          <Col xs={24} md={12}>
            <Form.Item label="Título del ticket" name="ticket_titulo">
              <Input placeholder="Detalle de venta" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Texto del pie" name="ticket_pie">
              <Input placeholder="Gracias por tu compra" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="Mensaje adicional" name="ticket_nota">
              <TextArea rows={3} placeholder="Indicaciones, campaña o mensaje comercial para el ticket" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
          <Col xs={24} lg={8}>
            <Card size="small" title="Campos visibles">
              <Row gutter={[8, 8]}>
                <Col xs={24} sm={12}>
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937", textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 8px", background: "#f3f4f6", borderRadius: 6 }}>
                      Encabezado
                    </div>
                    <Switch checked={ticketFields.logo} onChange={(value) => setTicketFields((prev) => ({ ...prev, logo: value }))} /> Logo
                    <Switch checked={ticketFields.nombreAcademia} onChange={(value) => setTicketFields((prev) => ({ ...prev, nombreAcademia: value }))} /> Nombre del negocio
                    <Switch checked={ticketFields.ruc} onChange={(value) => setTicketFields((prev) => ({ ...prev, ruc: value }))} /> RUC/NIT
                    <Switch checked={ticketFields.direccion} onChange={(value) => setTicketFields((prev) => ({ ...prev, direccion: value }))} /> Dirección
                    <Switch checked={ticketFields.telefono} onChange={(value) => setTicketFields((prev) => ({ ...prev, telefono: value }))} /> Teléfono
                    <Switch checked={ticketFields.email} onChange={(value) => setTicketFields((prev) => ({ ...prev, email: value }))} /> Email
                  </Space>
                </Col>
                <Col xs={24} sm={12}>
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937", textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 8px", background: "#f3f4f6", borderRadius: 6 }}>
                      Contenido
                    </div>
                    <Switch checked={ticketFields.titulo} onChange={(value) => setTicketFields((prev) => ({ ...prev, titulo: value }))} /> Título
                    <Switch checked={ticketFields.fecha} onChange={(value) => setTicketFields((prev) => ({ ...prev, fecha: value }))} /> Fecha
                    <Switch checked={ticketFields.concepto} onChange={(value) => setTicketFields((prev) => ({ ...prev, concepto: value }))} /> Productos
                    <Switch checked={ticketFields.monto} onChange={(value) => setTicketFields((prev) => ({ ...prev, monto: value }))} /> Totales
                    <Switch checked={ticketFields.nota} onChange={(value) => setTicketFields((prev) => ({ ...prev, nota: value }))} /> Nota
                    <Switch checked={ticketFields.pie} onChange={(value) => setTicketFields((prev) => ({ ...prev, pie: value }))} /> Pie final
                    <Switch checked={ticketFields.puntos} onChange={(value) => setTicketFields((prev) => ({ ...prev, puntos: value }))} /> Bloque de fidelidad
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            <Card size="small" style={{ borderStyle: "dashed" }} title={`Previsualización del ticket (${posPrinterWidth === 48 ? "80mm" : "58mm"})`}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{ width: posPrinterWidth === 48 ? "80mm" : "58mm", background: "#fff", padding: 12, border: "1px dashed #e5e7eb" }}>
                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    {ticketFields.logo && previewLogoUrl ? <img src={previewLogoUrl} alt="Logo" style={{ maxHeight: 56, maxWidth: 160, objectFit: "contain" }} /> : null}
                    {ticketPreview.nombreTienda ? <div style={{ fontWeight: 700, fontSize: 16, marginTop: 6 }}>{ticketPreview.nombreTienda}</div> : null}
                    {ticketPreview.nit ? <div style={{ fontSize: 12, color: "#6b7280" }}>RUC/NIT: {ticketPreview.nit}</div> : null}
                    {ticketPreview.direccion ? <div style={{ fontSize: 12, color: "#6b7280" }}>{ticketPreview.direccion}</div> : null}
                    {ticketPreview.telefono ? <div style={{ fontSize: 12, color: "#6b7280" }}>Tel: {ticketPreview.telefono}</div> : null}
                    {ticketFields.email && previewEmail ? <div style={{ fontSize: 12, color: "#6b7280" }}>{previewEmail}</div> : null}
                  </div>

                  <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 8 }}>
                    {ticketPreview.fecha ? <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Fecha: {ticketPreview.fecha}</div> : null}
                    {ticketPreview.lineas.map((linea, index) => {
                      if (linea.tipo === "titulo") {
                        return (
                          <div key={`linea-${index}`} style={{ textAlign: "center", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            {linea.texto.toUpperCase()}
                          </div>
                        );
                      }

                      if (linea.tipo === "subtitulo") {
                        return (
                          <div key={`linea-${index}`} style={{ textAlign: "center", fontSize: 12, marginBottom: 6 }}>
                            {linea.texto}
                          </div>
                        );
                      }

                      if (linea.tipo === "linea") {
                        return <div key={`linea-${index}`} style={{ borderTop: "1px dashed #e5e7eb", margin: "8px 0" }} />;
                      }

                      if (linea.tipo === "item") {
                        return (
                          <div key={`linea-${index}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, gap: 8 }}>
                            <span>{linea.cantidad}x {linea.descripcion}</span>
                            <span>${(linea.precio * linea.cantidad).toLocaleString("es-CO")}</span>
                          </div>
                        );
                      }

                      if (linea.tipo === "total") {
                        return (
                          <div key={`linea-${index}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, fontWeight: linea.etiqueta === "TOTAL" ? 700 : 500 }}>
                            <span>{linea.etiqueta}</span>
                            <span>${linea.valor.toLocaleString("es-CO")}</span>
                          </div>
                        );
                      }

                      if (linea.tipo === "texto") {
                        return (
                          <div key={`linea-${index}`} style={{ textAlign: "center", fontSize: 12, color: "#4b5563", marginBottom: 6 }}>
                            {linea.texto}
                          </div>
                        );
                      }

                      return <div key={`linea-${index}`} style={{ height: 8 }} />;
                    })}
                    <div style={{ borderTop: "1px dashed #e5e7eb", margin: "8px 0" }} />
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                      Pago: <strong>{ticketPreview.metodoPago}</strong>
                    </div>
                    {ticketPreview.cambio && ticketPreview.cambio > 0 ? (
                      <div style={{ fontSize: 12, marginBottom: 6 }}>
                        Cambio: <strong>${ticketPreview.cambio.toLocaleString("es-CO")}</strong>
                      </div>
                    ) : null}
                    {ticketPreview.mensaje ? <div style={{ fontSize: 12, color: "#374151", marginTop: 8 }}>{ticketPreview.mensaje}</div> : null}
                    {ticketPreview.nota ? <div style={{ fontSize: 12, color: "#374151", marginTop: 8 }}>{ticketPreview.nota}</div> : null}
                    {ticketPreview.pie ? <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>{ticketPreview.pie}</div> : null}
                    {ticketPreview.puntosAcumulados !== undefined ? (
                      <div style={{ marginTop: 10, background: "#fff8e1", border: "1px dashed #f5a623", borderRadius: 4, padding: "6px 8px", textAlign: "center", fontSize: 11 }}>
                        <span style={{ color: "#f5a623", fontSize: 14 }}>★</span>
                        {" "}Ganaste <strong>{ticketPreview.puntosFidelidad}</strong> puntos en esta compra<br />
                        Total acumulado: <strong>{ticketPreview.puntosAcumulados} pts</strong><br />
                        Nivel: <strong>{ticketPreview.nivelFidelidad?.toUpperCase()}</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </>
    );
  };


  // ==================== FUNCIONES DEL NEGOCIO ====================
  const cargarConfiguracionAcademia = useCallback(async () => {
    setLoadingAcademia(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("configuracion")
        .select("*")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Config error:", error);
        return;
      }

      if (data) {
        // Guardar el ID UUID para usarlo en el upsert
        if (isValidUUID(data.id)) {
          setConfiguracionId(data.id);
        } else {
          setConfiguracionId(null);
        }
        if (data.ticket_campos && typeof data.ticket_campos === "object") {
          setTicketFields((prev) => ({ ...prev, ...data.ticket_campos }));
        }
        formAcademia.setFieldsValue(data);
        if (data.logo_url) {
          setLogoFileList([
            {
              uid: "logo",
              name: "logo",
              status: "done",
              url: data.logo_url,
            },
          ]);
        } else {
          setLogoFileList([]);
        }
      } else {
        // Si no hay registro, crear uno base para evitar pantalla vacía
        const nuevoId = generateUUID();
        const { error: insertError } = await supabaseBrowserClient
          .from("configuracion")
          .insert({ id: nuevoId });

        if (!insertError) {
          setConfiguracionId(nuevoId);
          formAcademia.resetFields();
        }
      }
    } catch (error) {
      console.error("Load config error:", error);
    } finally {
      setLoadingAcademia(false);
    }
  }, [formAcademia]);

  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      cargarConfiguracionAcademia();
    }
  }, [initialized, cargarConfiguracionAcademia]);

  const generateUUID = (): string => {
    if (typeof crypto !== "undefined") {
      if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }

      if (typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
        bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
        return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
      }
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const isValidUUID = (value?: string | null): boolean => {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  };

  const guardarConfiguracionAcademia = async () => {
    try {
      const values = await formAcademia.validateFields();
      const { id: _ignoredId, ...valuesSinId } = values as { id?: string };
      setSavingAcademia(true);

      // Si no tenemos ID aún, obtener el primero existente o crear uno nuevo
      let idParaGuardar = isValidUUID(configuracionId) ? configuracionId : null;
      
      if (!idParaGuardar) {
        // Obtener el ID existente de la BD
        const { data: configs } = await supabaseBrowserClient
          .from("configuracion")
          .select("id")
          .limit(1);
        
        const primerId = configs && configs.length > 0 ? configs[0]?.id ?? null : null;

        if (isValidUUID(primerId)) {
          idParaGuardar = primerId;
          setConfiguracionId(primerId);
        } else {
          // Si no existe, generar un UUID válido
          idParaGuardar = generateUUID();
        }
      }

      const { error } = await supabaseBrowserClient
        .from("configuracion")
        .upsert({ ...valuesSinId, id: idParaGuardar, ticket_campos: ticketFields });

      if (error) throw error;

      // Actualizar el ID si se acaba de crear
      if (!configuracionId && idParaGuardar) {
        setConfiguracionId(idParaGuardar);
      }

      invalidarConfigTicketPOS();
      messageApi.success("Configuración guardada correctamente");
      cargarConfiguracionAcademia();
    } catch (error: any) {
      messageApi.error("Error al guardar: " + error.message);
    } finally {
      setSavingAcademia(false);
    }
  };

  // ==================== FUNCIONES PERMISOS ====================
  const cargarPermisos = async () => {
    setLoadingPermisos(true);
    try {
      const { data } = await supabaseBrowserClient
        .from("role_permissions")
        .select("rol, permisos");

      const permisosMap: PermisosPorRol = {};

      data?.forEach((row: { rol: string; permisos: Record<string, boolean> }) => {
        const normalizedRole = row.rol === "administrativo" ? "admin" : row.rol;
        permisosMap[normalizedRole] = row.permisos || {};
      });

      roleKeys.forEach((rol) => {
        if (!permisosMap[rol]) permisosMap[rol] = {};
      });

      setPermisos(permisosMap);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingPermisos(false);
    }
  };

  const handleTogglePermiso = (rol: string, modulo: string, valor: boolean) => {
    setPermisos(prev => ({
      ...prev,
      [rol]: {
        ...prev[rol],
        [modulo]: valor
      }
    }));
    setHasChangesPermisos(true);
  };

  const guardarPermisos = async () => {
    try {
      setSavingPermisos(true);
      for (const rol of roleKeys) {
        await supabaseBrowserClient
          .from("role_permissions")
          .upsert({ rol, permisos: permisos[rol] || {} });
      }
      messageApi.success("Permisos actualizados correctamente");
      setHasChangesPermisos(false);
    } catch (error) {
      messageApi.error("Error al guardar permisos");
    } finally {
      setSavingPermisos(false);
    }
  };

  // ==================== FUNCIONES ADMINISTRADORES ====================
  const cargarAdministradores = async () => {
    setLoadingAdmins(true);
    try {
      const { data } = await supabaseBrowserClient
        .from("perfiles")
        .select("*")
        .in("rol", adminAssignableRoles)
        .order("created_at", { ascending: false });
      setAdminsList(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleOpenModalAdmin = (admin?: Admin) => {
    if (admin) {
      setEditingAdmin(admin);
      formAdmin.setFieldsValue(admin);
    } else {
      setEditingAdmin(null);
      formAdmin.resetFields();
    }
    setModalAdminVisible(true);
  };

  const handleSubmitAdmin = async () => {
    try {
      setSubmittingAdmin(true);
      const values = await formAdmin.validateFields();

      if (editingAdmin) {
        await supabaseBrowserClient
          .from("perfiles")
          .update(values)
          .eq("id", editingAdmin.id);
        messageApi.success("Administrador actualizado");
      } else {
        await supabaseBrowserClient.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: {
              nombre_completo: values.nombre_completo,
              rol: values.rol,
              identificacion: values.identificacion,
              telefono: values.telefono
            }
          }
        });
        messageApi.success("Administrador creado");
      }
      setModalAdminVisible(false);
      cargarAdministradores();
    } catch (error: any) {
      messageApi.error("Error: " + error.message);
    } finally {
      setSubmittingAdmin(false);
    }
  };

  const handleDeleteAdmin = (admin: Admin) => {
    Modal.confirm({
      title: "¿Eliminar administrador?",
      content: `Se eliminará a ${admin.nombre_completo}`,
      okText: "Eliminar",
      okType: "danger",
      onOk: async () => {
        try {
          await supabaseBrowserClient.from("perfiles").delete().eq("id", admin.id);
          messageApi.success("Eliminado");
          cargarAdministradores();
        } catch (e: any) {
          messageApi.error(e.message);
        }
      }
    });
  };

  // ==================== FUNCIONES MEDIOS DE PAGO ====================
  const cargarMediosPago = async () => {
    setLoadingMediosPago(true);
    try {
      const { data } = await supabaseBrowserClient
        .from("medios_pago")
        .select("*")
        .order("nombre", { ascending: true });
      const normalizados = (data || []).map((medio: any) => {
        const parsed = splitDescripcion(medio?.descripcion);
        return {
          ...medio,
          tipo: medio?.codigo || medio?.tipo || "",
          descripcion: parsed.descripcion,
          informacion: parsed.informacion,
        } as MedioPago;
      });
      setMediosPago(normalizados);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMediosPago(false);
    }
  };

  const handleOpenModalMedioPago = (medio?: MedioPago) => {
    if (medio) {
      setEditingMedioPago(medio);
      formMedioPago.setFieldsValue({
        ...medio,
        tipo: medio.tipo || (medio as any).codigo || "",
      });
    } else {
      setEditingMedioPago(null);
      formMedioPago.resetFields();
      formMedioPago.setFieldsValue({ activo: true });
    }
    setModalMedioPagoVisible(true);
  };

  const handleSubmitMedioPago = async () => {
    try {
      setSubmittingMedioPago(true);
      const values = await formMedioPago.validateFields();
      const payload = {
        nombre: values.nombre,
        codigo: values.tipo,
        descripcion: buildDescripcion(values.descripcion, values.informacion),
        activo: values.activo ?? true,
      };

      if (editingMedioPago) {
        const { error } = await supabaseBrowserClient
          .from("medios_pago")
          .update(payload)
          .eq("id", editingMedioPago.id);
        if (error) throw error;
        messageApi.success("Medio de pago actualizado");
      } else {
        const { error } = await supabaseBrowserClient
          .from("medios_pago")
          .insert(payload);
        if (error) throw error;
        messageApi.success("Medio de pago creado");
      }
      setModalMedioPagoVisible(false);
      cargarMediosPago();
    } catch (error: any) {
      const errorMessage = error?.message || "No se pudo guardar el medio de pago";
      messageApi.error(`Error: ${errorMessage}`);
    } finally {
      setSubmittingMedioPago(false);
    }
  };

  const handleDeleteMedioPago = (medio: MedioPago) => {
    Modal.confirm({
      title: "¿Eliminar medio de pago?",
      content: `Se eliminará ${medio.nombre}`,
      okText: "Eliminar",
      okType: "danger",
      onOk: async () => {
        try {
          await supabaseBrowserClient.from("medios_pago").delete().eq("id", medio.id);
          messageApi.success("Eliminado");
          cargarMediosPago();
        } catch (e: any) {
          messageApi.error(e.message);
        }
      }
    });
  };

  // ==================== FUNCIONES PLANTILLAS WHATSAPP ====================
  const cargarPlantillasWhatsApp = async () => {
    setLoadingPlantillas(true);
    try {
      const { data } = await supabaseBrowserClient
        .from("plantillas_whatsapp")
        .select("*")
        .order("nombre", { ascending: true });
      setPlantillasWhatsApp(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingPlantillas(false);
    }
  };

  const handleOpenModalPlantilla = (plantilla?: PlantillaWhatsApp) => {
    if (plantilla) {
      setEditingPlantilla(plantilla);
      formPlantilla.setFieldsValue(plantilla);
    } else {
      setEditingPlantilla(null);
      formPlantilla.resetFields();
      formPlantilla.setFieldsValue({ activa: true });
    }
    setModalPlantillaVisible(true);
  };

  const handleSubmitPlantilla = async () => {
    try {
      setSubmittingPlantilla(true);
      const values = await formPlantilla.validateFields();

      if (editingPlantilla) {
        await supabaseBrowserClient
          .from("plantillas_whatsapp")
          .update(values)
          .eq("id", editingPlantilla.id);
        messageApi.success("Plantilla actualizada");
      } else {
        await supabaseBrowserClient
          .from("plantillas_whatsapp")
          .insert(values);
        messageApi.success("Plantilla creada");
      }
      setModalPlantillaVisible(false);
      cargarPlantillasWhatsApp();
    } catch (error: any) {
      messageApi.error("Error: " + error.message);
    } finally {
      setSubmittingPlantilla(false);
    }
  };

  const handleDeletePlantilla = (plantilla: PlantillaWhatsApp) => {
    Modal.confirm({
      title: "¿Eliminar plantilla?",
      content: `Se eliminará ${plantilla.nombre}`,
      okText: "Eliminar",
      okType: "danger",
      onOk: async () => {
        try {
          await supabaseBrowserClient.from("plantillas_whatsapp").delete().eq("id", plantilla.id);
          messageApi.success("Eliminado");
          cargarPlantillasWhatsApp();
        } catch (e: any) {
          messageApi.error(e.message);
        }
      }
    });
  };

  // Columnas para las tablas
  const permisosColumns = [
    { title: "Módulo", dataIndex: "modulo", key: "modulo", fixed: "left" as const, width: 180 },
    ...roleKeys.map((rol) => ({
      title: roleLabels[rol] || rol,
      dataIndex: rol,
      key: rol,
      width: 140,
      render: (_: unknown, record: { key: string }) => (
        <Switch
          checked={permisos[rol]?.[record.key] || false}
          onChange={(val) => handleTogglePermiso(rol, record.key, val)}
          disabled={savingPermisos}
        />
      ),
    })),
  ];

  const adminColumns: ColumnsType<Admin> = [
    { title: "Nombre", dataIndex: "nombre_completo", key: "name", render: (t: string) => <span><UserOutlined /> {t}</span> },
    { title: "Email", dataIndex: "email", key: "email", responsive: ["md" as Breakpoint] },
    { title: "Identificación", dataIndex: "identificacion", key: "identificacion", responsive: ["lg" as Breakpoint] },
    { title: "Teléfono", dataIndex: "telefono", key: "telefono", render: (t: string) => t || "-", responsive: ["md" as Breakpoint] },
    {
      title: "Rol",
      dataIndex: "rol",
      key: "rol",
      render: (rol: string) => {
        const def = ROLES[rol];
        return <Tag color={def?.color || "blue"}>{roleLabels[rol] || rol}</Tag>;
      },
    },
    {
      title: "Acciones", key: "actions", render: (_: any, r: Admin) => (
        <>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenModalAdmin(r)} style={{ marginRight: 8 }} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteAdmin(r)} />
        </>
      )
    }
  ];

  const mediosPagoColumns: ColumnsType<MedioPago> = [
    { title: "Nombre", dataIndex: "nombre", key: "nombre", width: 150 },
    { title: "Tipo", dataIndex: "tipo", key: "tipo", responsive: ["md" as Breakpoint], width: 120 },
    {
      title: "Descripción",
      dataIndex: "descripcion",
      key: "descripcion",
      responsive: ["lg" as Breakpoint],
      render: (desc: string) => (
        <span style={{ color: "#666", fontSize: 12 }}>
          {desc ? (desc.length > 50 ? `${desc.substring(0, 50)}...` : desc) : "-"}
        </span>
      )
    },
    {
      title: "Estado",
      dataIndex: "activo",
      key: "activo",
      width: 80,
      render: (activo: boolean) => <Tag color={activo ? "green" : "red"}>{activo ? "Activo" : "Inactivo"}</Tag>
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 90,
      render: (_: any, record: MedioPago) => (
        <>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenModalMedioPago(record)} style={{ marginRight: 8 }} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteMedioPago(record)} />
        </>
      )
    }
  ];

  const plantillasColumns: ColumnsType<PlantillaWhatsApp> = [
    { title: "Nombre", dataIndex: "nombre", key: "nombre" },
    { title: "Descripción", dataIndex: "descripcion", key: "descripcion", responsive: ["md" as Breakpoint] },
    {
      title: "Estado",
      dataIndex: "activa",
      key: "activa",
      render: (activa: boolean) => <Tag color={activa ? "green" : "red"}>{activa ? "Activo" : "Inactivo"}</Tag>
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (_: any, record: PlantillaWhatsApp) => (
        <>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenModalPlantilla(record)} style={{ marginRight: 8 }} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeletePlantilla(record)} />
        </>
      )
    }
  ];

  const permisosData = modulos.map((m: ModuleDefinition) => ({ key: m.key, modulo: m.label }));
  const permisosScrollX = 240 + roleKeys.length * 160;

  const academiaTab = (
    <Spin spinning={loadingAcademia}>
      <Form form={formAcademia} layout="vertical">
        <Divider orientation="left">Información General</Divider>
        <Row gutter={[16, 8]}>
          <Col xs={24} md={12}>
            <Form.Item label="Nombre del negocio" name="nombre_academia" rules={[{ required: true }]}>
              <Input placeholder="La Cosmetikera" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="RUC / NIT" name="ruc">
              <Input placeholder="1234567890001" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="Dirección" name="direccion">
              <TextArea rows={2} placeholder="Direccion completa de la tienda" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="Telefono / WhatsApp principal"
              name="telefono"
              extra="Este numero se usa en la app para ventas, soporte y fidelizacion de clientes."
            >
              <Input placeholder="+57 301 203 8582" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Email" name="email" rules={[{ type: "email" }]}>
              <Input placeholder="hola@lacosmetikera.com" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="Sitio Web" name="sitio_web">
              <Input placeholder="https://www.lacosmetikera.com" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="logo_url" hidden>
          <Input type="hidden" />
        </Form.Item>

        <Divider orientation="left">Marca y Redes</Divider>
        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={10}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Upload
                listType="picture-card"
                fileList={logoFileList}
                showUploadList={{ showPreviewIcon: false }}
                beforeUpload={handleLogoUpload}
                onRemove={() => {
                  handleRemoveLogo();
                  return true;
                }}
              >
                {logoFileList.length >= 1 ? null : (
                  <div>
                    <UploadOutlined style={{ fontSize: 20 }} />
                    <div style={{ marginTop: 8 }}>Subir Logo</div>
                  </div>
                )}
              </Upload>
              <Button loading={uploadingLogo} onClick={handleRemoveLogo} disabled={logoFileList.length === 0}>
                Limpiar Logo
              </Button>
            </Space>
          </Col>
          <Col xs={24} lg={14}>
            <Row gutter={[16, 8]}>
              <Col xs={24} sm={12}>
                <Form.Item label="Instagram" name="instagram">
                  <Input prefix={<InstagramOutlined />} placeholder="https://instagram.com/lacosmetikera" />
                </Form.Item>
                {previewInstagram && (
                  <div style={{ marginTop: -16, marginBottom: 8 }}>
                    <Tag color="purple" style={{ fontSize: 11 }}>
                      Se mostrará: {shortenSocialUrl(previewInstagram, 'instagram')}
                    </Tag>
                  </div>
                )}
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Facebook" name="facebook">
                  <Input prefix={<FacebookOutlined />} placeholder="https://facebook.com/lacosmetikera" />
                </Form.Item>
                {previewFacebook && (
                  <div style={{ marginTop: -16, marginBottom: 8 }}>
                    <Tag color="blue" style={{ fontSize: 11 }}>
                      Se mostrará: {shortenSocialUrl(previewFacebook, 'facebook')}
                    </Tag>
                  </div>
                )}
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="YouTube" name="youtube">
                  <Input prefix={<YoutubeOutlined />} placeholder="https://youtube.com/@lacosmetikera" />
                </Form.Item>
                {previewYoutube && (
                  <div style={{ marginTop: -16, marginBottom: 8 }}>
                    <Tag color="red" style={{ fontSize: 11 }}>
                      Se mostrará: {shortenSocialUrl(previewYoutube, 'youtube')}
                    </Tag>
                  </div>
                )}
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="WhatsApp Agente"
                  name="whatsapp"
                    extra="Este número se usa para atención comercial y soporte a clientes."
                >
                  <Input prefix={<WhatsAppOutlined />} placeholder="https://wa.me/573001112233" />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  label="Ubicación Google Maps"
                  name="maps_url"
                    extra="Este enlace se usará para compartir la ubicación de la tienda por WhatsApp."
                >
                  <Input prefix={<EnvironmentOutlined />} placeholder="https://maps.app.goo.gl/..." />
                </Form.Item>
                {previewMapsUrl && (
                  <div style={{ marginTop: -16, marginBottom: 8 }}>
                    <Tag color="geekblue" style={{ fontSize: 11 }}>
                      Ubicación configurada para el agente
                    </Tag>
                  </div>
                )}
              </Col>
            </Row>
          </Col>
        </Row>

        <Divider orientation="left">Parámetros Financieros</Divider>
        <Row gutter={[16, 8]}>
          <Col xs={24} md={12}>
            <Form.Item label="Moneda" name="moneda">
              <Select placeholder="Seleccionar moneda">
                <Option value="USD">Dólar (USD)</Option>
                <Option value="EUR">Euro (EUR)</Option>
                <Option value="COP">Peso Colombiano (COP)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Impuesto (%)" name="impuesto">
              <Input type="number" placeholder="19" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Días de gracia para pagos" name="dias_gracia_pago">
              <Input type="number" placeholder="5" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Mora por día (%)" name="mora_por_dia">
              <Input type="number" placeholder="2" />
            </Form.Item>
          </Col>
        </Row>
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="El diseño del ticket de ventas ahora se configura desde la pestaña Impresora."
        />

        <Form.Item style={{ marginTop: 16 }}>
          <Button type="primary" icon={<SaveOutlined />} loading={savingAcademia} onClick={guardarConfiguracionAcademia}>
            Guardar Configuración
          </Button>
        </Form.Item>
      </Form>
    </Spin>
  );

  const permisosTab = (
    <Spin spinning={loadingPermisos}>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>Matriz de Permisos por Rol</h3>
        {hasChangesPermisos && (
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={guardarPermisos}
            loading={savingPermisos}
            block={isMobile}
          >
            Guardar Cambios
          </Button>
        )}
      </div>
      <Table
        dataSource={permisosData}
        columns={permisosColumns}
        pagination={false}
        scroll={{ x: permisosScrollX }}
        bordered
        size={isMobile ? "small" : "middle"}
      />
    </Spin>
  );

  const administradoresTab = (
    <Spin spinning={loadingAdmins}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleOpenModalAdmin()}
          block={isMobile}
        >
          Nuevo Administrador
        </Button>
      </div>
      {isMobile ? (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {adminsList.map((admin) => (
            <Card key={admin.id} size="small">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    <UserOutlined /> {admin.nombre_completo}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{admin.email}</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    ID: {admin.identificacion || "-"}
                  </div>
                  <div style={{ fontSize: 12 }}>
                    Tel: {admin.telefono || "-"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <Tag color={ROLES[admin.rol]?.color || "blue"}>{roleLabels[admin.rol] || admin.rol}</Tag>
                  <Space size="small">
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenModalAdmin(admin)} />
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteAdmin(admin)} />
                  </Space>
                </div>
              </div>
            </Card>
          ))}
        </Space>
      ) : (
        <Table
          dataSource={adminsList}
          columns={adminColumns}
          rowKey="id"
          size={isMobile ? "small" : "middle"}
          scroll={{ x: 800 }}
        />
      )}
    </Spin>
  );

  const mediosPagoTab = (
    <Spin spinning={loadingMediosPago}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleOpenModalMedioPago()}
          block={isMobile}
        >
          Nuevo Medio de Pago
        </Button>
      </div>
      {isMobile ? (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {mediosPago.map((medio) => (
            <Card key={medio.id} size="small">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{medio.nombre}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{medio.tipo}</div>
                  {medio.descripcion && (
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 4, fontStyle: "italic" }}>
                      {medio.descripcion}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <Tag color={medio.activo ? "green" : "red"}>{medio.activo ? "Activo" : "Inactivo"}</Tag>
                  <Space size="small">
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenModalMedioPago(medio)} />
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteMedioPago(medio)} />
                  </Space>
                </div>
              </div>
            </Card>
          ))}
        </Space>
      ) : (
        <Table
          dataSource={mediosPago}
          columns={mediosPagoColumns}
          rowKey="id"
          size={isMobile ? "small" : "middle"}
          scroll={{ x: 900 }}
        />
      )}
    </Spin>
  );

  const plantillasTab = (
    <Spin spinning={loadingPlantillas}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleOpenModalPlantilla()}
          block={isMobile}
        >
          Nueva Plantilla
        </Button>
      </div>
      {isMobile ? (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {plantillasWhatsApp.map((plantilla) => (
            <Card key={plantilla.id} size="small">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{plantilla.nombre}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{plantilla.descripcion || "-"}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <Tag color={plantilla.activa ? "green" : "red"}>{plantilla.activa ? "Activo" : "Inactivo"}</Tag>
                  <Space size="small">
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenModalPlantilla(plantilla)} />
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeletePlantilla(plantilla)} />
                  </Space>
                </div>
              </div>
            </Card>
          ))}
        </Space>
      ) : (
        <Table
          dataSource={plantillasWhatsApp}
          columns={plantillasColumns}
          rowKey="id"
          size={isMobile ? "small" : "middle"}
          scroll={{ x: 600 }}
        />
      )}
    </Spin>
  );

  const posTab = (
    <div style={{ maxWidth: 980 }}>
      {usaQZ ? (
        <>
          {/* Estado QZ Tray */}
          <Divider orientation="left">Estado de QZ Tray</Divider>
          <Alert
            type={qzEstado === "conectado" ? "success" : qzEstado === "desconectado" ? "error" : "info"}
            showIcon
            message={
              qzEstado === "conectado"
                ? "QZ Tray conectado — la impresora está lista"
                : qzEstado === "desconectado"
                ? "QZ Tray no está conectado"
                : "Estado desconocido — haz clic en Conectar"
            }
            description={
              qzEstado !== "conectado" && (
                <span>
                  Descarga QZ Tray desde{" "}
                  <a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer">
                    qz.io/download
                  </a>{" "}
                  e instálalo en el PC donde está la impresora.
                </span>
              )
            }
            style={{ marginBottom: 16 }}
          />
          <Space style={{ marginBottom: 24 }}>
            <Button
              icon={<WifiOutlined />}
              loading={conectandoQZ}
              onClick={conectarQZ}
              type={qzEstado === "conectado" ? "default" : "primary"}
            >
              {qzEstado === "conectado" ? "Verificar servicio QZ Tray" : "Conectar QZ Tray"}
            </Button>
            {qzEstado === "conectado" && (
              <Button
                icon={<ReloadOutlined />}
                loading={buscandoImpresoras}
                onClick={buscarImpresoras}
              >
                Detectar impresoras
              </Button>
            )}
          </Space>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Sitio permitido en QZ Tray"
            description={
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <span>
                  Si QZ Tray sigue bloqueando o pidiendo autorización, agrega este sitio en Allowed / Trusted Sites dentro de QZ Tray.
                </span>
                <Input
                  value={currentSiteOrigin}
                  readOnly
                  addonAfter={
                    <Button type="link" icon={<CopyOutlined />} onClick={copiarSitioActualQZ}>
                      Copiar
                    </Button>
                  }
                />
              </Space>
            }
          />
        </>
      ) : usaAgenteLocal ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="Modo agente local activo"
          description="La impresión y apertura de cajón se envían al servicio local (http://127.0.0.1:17891)."
        />
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Modo de impresión por navegador activo"
          description="La app abrirá el diálogo de impresión del navegador directamente. QZ Tray no es necesario en este modo."
        />
      )}

      {/* Selección de impresora */}
      <Divider orientation="left">Configuración de impresión</Divider>
      <Row gutter={[16, 16]}>
        {(usaQZ || usaAgenteLocal) && (
          <Col xs={24}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Nombre de la impresora</div>
            {impresorasDisponibles.length > 0 ? (
              <Select
                showSearch
                value={posPrinterName || undefined}
                placeholder="Selecciona la impresora"
                style={{ width: "100%" }}
                onChange={(v) => setPosPrinterName(v)}
                options={impresorasDisponibles.map((p) => ({ label: p, value: p }))}
              />
            ) : (
              <Input
                value={posPrinterName}
                onChange={(e) => setPosPrinterName(e.target.value)}
                placeholder="Ej: EPSON TM-T20II"
                prefix={<PrinterOutlined />}
              />
            )}
            <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
              Deja vacío para usar la impresora predeterminada del sistema.
            </div>
          </Col>
        )}
        <Col xs={24}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Ancho de papel</div>
          <Radio.Group
            value={posPrinterWidth}
            onChange={(e) => setPosPrinterWidth(e.target.value)}
          >
            <Radio value={48}>
              <strong>80 mm</strong>{" "}
              <span style={{ color: "#888", fontSize: 12 }}>(48 chars — Epson TM-T20II)</span>
            </Radio>
            <Radio value={32}>
              <strong>58 mm</strong>{" "}
              <span style={{ color: "#888", fontSize: 12 }}>(32 chars)</span>
            </Radio>
          </Radio.Group>
        </Col>
      </Row>

      <Button
        type="primary"
        icon={<SaveOutlined />}
        loading={savingPos}
        onClick={guardarConfigPos}
        style={{ marginTop: 20, background: "#d81b87", borderColor: "#d81b87" }}
      >
        Guardar configuración
      </Button>

      {/* Pruebas */}
      <Divider orientation="left">Pruebas</Divider>
      <Space wrap>
        <Button
          icon={<PrinterOutlined />}
          loading={testImprimiendo}
          onClick={testImprimir}
        >
          Imprimir ticket de prueba
        </Button>
        {permiteCajon && (
          <Button
            icon={<span style={{ marginRight: 4 }}>💰</span>}
            loading={testCajon}
            onClick={testAbrirCajon}
          >
            Abrir cajón monedero
          </Button>
        )}
      </Space>
      {permiteCajon && (
        <div style={{ marginTop: 12, color: "#888", fontSize: 12 }}>
          Asegúrate de que el cajón monedero esté conectado al puerto RJ-11 de la impresora.
        </div>
      )}

      {renderTicketDesigner()}
    </div>
  );

  const tabsItems = [
    {
      key: "negocio",
      label: (
        <span>
          <SettingOutlined /> Negocio
        </span>
      ),
      children: academiaTab,
    },
    {
      key: "permisos",
      label: (
        <span>
          <TeamOutlined /> Permisos por Rol
        </span>
      ),
      children: permisosTab,
    },
    {
      key: "administradores",
      label: (
        <span>
          <UserOutlined /> Administradores
        </span>
      ),
      children: administradoresTab,
    },
    {
      key: "medios-pago",
      label: (
        <span>
          <CreditCardOutlined /> Medios de Pago
        </span>
      ),
      children: mediosPagoTab,
    },
    {
      key: "plantillas-whatsapp",
      label: (
        <span>
          <WhatsAppOutlined /> Plantillas WhatsApp
        </span>
      ),
      children: plantillasTab,
    },
    {
      key: "pos",
      label: (
        <span>
          <PrinterOutlined /> Impresora POS
        </span>
      ),
      children: posTab,
    },
  ];

  return (
    <div style={{ padding: isMobile ? 12 : isTablet ? 16 : 24 }}>
      {contextHolder}
      <h2 style={{ marginBottom: isMobile ? 16 : 24, fontSize: isMobile ? 18 : 22 }}>Configuración del Sistema</h2>
      <Card
        bodyStyle={{ padding: isMobile ? 12 : isTablet ? 16 : 24 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabsItems}
          size={isMobile ? "small" : "middle"}
          tabBarGutter={isMobile ? 8 : 16}
          tabBarStyle={{ marginBottom: isMobile ? 12 : 16, flexWrap: "wrap" }}
        />
      </Card>

      {/* Modal Administradores */}
      <Modal
        title={editingAdmin ? "Editar Administrador" : "Nuevo Administrador"}
        open={modalAdminVisible}
        onCancel={() => setModalAdminVisible(false)}
        onOk={handleSubmitAdmin}
        confirmLoading={submittingAdmin}
        forceRender
      >
        <Form form={formAdmin} layout="vertical">
          <Form.Item label="Nombre Completo" name="nombre_completo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
            <Input disabled={!!editingAdmin} />
          </Form.Item>
          {!editingAdmin && (
            <Form.Item label="Contraseña" name="password" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item label="Identificación" name="identificacion" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Teléfono" name="telefono">
            <Input />
          </Form.Item>
          <Form.Item label="Rol" name="rol" rules={[{ required: true }]}> 
            <Select>
              {adminAssignableRoles.map((rol) => (
                <Option key={rol} value={rol}>
                  {roleLabels[rol] || rol}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Medios de Pago */}
      <Modal
        title={editingMedioPago ? "Editar Medio de Pago" : "Nuevo Medio de Pago"}
        open={modalMedioPagoVisible}
        onCancel={() => setModalMedioPagoVisible(false)}
        onOk={handleSubmitMedioPago}
        confirmLoading={submittingMedioPago}
        width={600}
        forceRender
      >
        <Form form={formMedioPago} layout="vertical">
          <Form.Item label="Nombre" name="nombre" rules={[{ required: true }]}>
            <Input placeholder="Ej: Efectivo, Transferencia Bancolombia, Nequi" />
          </Form.Item>
          <Form.Item label="Tipo" name="tipo" rules={[{ required: true }]}>
            <Select>
              <Option value="efectivo">Efectivo</Option>
              <Option value="transferencia">Transferencia Bancaria</Option>
              <Option value="nequi">Nequi</Option>
              <Option value="tarjeta">Tarjeta de Crédito/Débito</Option>
              <Option value="datafono">Datáfono</Option>
              <Option value="sistemacredito">Sistema de Crédito</Option>
              <Option value="otro">Otro</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Descripción/Instrucciones" name="descripcion">
            <TextArea 
              rows={3} 
              placeholder="Ej: Se aceptan pagos en efectivo en caja, horario 7am - 7pm de lunes a viernes"
            />
          </Form.Item>
          <Form.Item label="Información Adicional" name="informacion">
            <TextArea 
              rows={4} 
              placeholder="Ej: Banco: Bancolombia | Cuenta: 123456789 | Titular: La Cosmetikera | CCI/CLABE: 098765432..."
            />
          </Form.Item>
          <Form.Item label="Activo" name="activo" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Plantillas WhatsApp */}
      <Modal
        title={editingPlantilla ? "Editar Plantilla" : "Nueva Plantilla WhatsApp"}
        open={modalPlantillaVisible}
        onCancel={() => setModalPlantillaVisible(false)}
        onOk={handleSubmitPlantilla}
        confirmLoading={submittingPlantilla}
        width={600}
        forceRender
      >
        <Form form={formPlantilla} layout="vertical">
          <Form.Item label="Nombre de la Plantilla" name="nombre" rules={[{ required: true }]}>
            <Input placeholder="Ej: Recordatorio de pago" />
          </Form.Item>
          <Form.Item label="Tipo" name="descripcion" rules={[{ required: true }]}>
            <Select placeholder="Selecciona un tipo">
              <Option value="recordatorio">Recordatorio</Option>
              <Option value="bienvenida">Bienvenida</Option>
              <Option value="informativo">Informativo</Option>
              <Option value="otro">Otro</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Mensaje" name="plantilla" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder="Escribe el mensaje de la plantilla" />
          </Form.Item>
          <Form.Item label="Activo" name="activa" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}