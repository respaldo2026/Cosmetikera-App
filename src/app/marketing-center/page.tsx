"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Grid,
  Image,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  BellOutlined,
  BulbOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  LinkOutlined,
  PictureOutlined,
  ReloadOutlined,
  RocketOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";

type MarketingAsset = {
  id: string;
  titulo: string | null;
  descripcion: string | null;
  descripcion_ia: string | null;
  tipo_asset: string | null;
  url_archivo: string | null;
  keywords: string[] | string | null;
  categoria: string | null;
  programa_id: number | null;
  estado: string | null;
  visible_para_ia: boolean | null;
  created_at: string | null;
};

type ArticuloMarketing = {
  id: string;
  nombre: string;
  categoria?: string | null;
  marca?: string | null;
  stock?: number | null;
  stock_minimo?: number | null;
  precio_venta?: number | null;
  imagen_url?: string | null;
};

type AssetFormValues = {
  titulo: string;
  descripcion?: string;
  descripcion_ia?: string;
  tipo_asset: string;
  url_archivo: string;
  categoria?: string;
  keywords?: string;
  estado?: string;
  visible_para_ia?: boolean;
};

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

const assetTypeOptions = [
  { label: "Imagen", value: "imagen" },
  { label: "Video", value: "video" },
  { label: "Banner", value: "banner" },
  { label: "Plantilla", value: "plantilla" },
];

const statusOptions = [
  { label: "Borrador", value: "borrador" },
  { label: "Activo", value: "activo" },
  { label: "Archivado", value: "archivado" },
];

const brandGradient = "linear-gradient(135deg,#fff1f8 0%,#ffe4f1 38%,#f8d9ff 100%)";
const cardStyle: React.CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(216, 27, 135, 0.12)",
  boxShadow: "0 14px 40px rgba(216, 27, 135, 0.08)",
};

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function extractKeywords(value: MarketingAsset["keywords"]) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item));
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function isImageUrl(url?: string | null) {
  if (!url) return false;
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(url);
}

function appendPushTimestamp(value?: string | null) {
  const base = (value || "").trim();
  const marker = `[PUSH_TS:${Date.now()}]`;
  return base ? `${base}\n${marker}` : marker;
}

export default function MarketingCenterPage() {
  const screens = useBreakpoint();
  const [form] = Form.useForm<AssetFormValues>();
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [articulos, setArticulos] = useState<ArticuloMarketing[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [loadingArticulos, setLoadingArticulos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MarketingAsset | null>(null);
  const [editingAsset, setEditingAsset] = useState<MarketingAsset | null>(null);

  // ── Push inteligente ──
  const [pushInteligente, setPushInteligente] = useState<{
    cargando: boolean;
    resultado: null | { enviadas: number; sin_historial: number; suscripciones_inactivas: number; detalle: Array<{ perfil_id: string; estado: string; mensaje?: string }> };
    error: string | null;
  }>({ cargando: false, resultado: null, error: null });

  const lanzarPushInteligente = useCallback(async () => {
    setPushInteligente({ cargando: true, resultado: null, error: null });
    try {
      const res = await fetch("/api/club/push-inteligente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error enviando push");
      setPushInteligente({ cargando: false, resultado: json, error: null });
    } catch (err: unknown) {
      setPushInteligente({ cargando: false, resultado: null, error: err instanceof Error ? err.message : "Error desconocido" });
    }
  }, []);

  const cargarAssets = useCallback(async () => {
    setLoadingAssets(true);
    const { data, error } = await supabaseBrowserClient
      .from("marketing_assets")
      .select("id, titulo, descripcion, descripcion_ia, tipo_asset, url_archivo, keywords, categoria, programa_id, estado, visible_para_ia, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      message.error(`No se pudieron cargar los materiales: ${error.message}`);
      setAssets([]);
      setLoadingAssets(false);
      return;
    }

    setAssets((data as MarketingAsset[]) || []);
    setLoadingAssets(false);
  }, []);

  const cargarArticulos = useCallback(async () => {
    setLoadingArticulos(true);
    try {
      const response = await fetch("/api/articulos", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Error cargando artículos");
      }

      setArticulos(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "No se pudieron cargar los artículos");
      setArticulos([]);
    } finally {
      setLoadingArticulos(false);
    }
  }, []);

  useEffect(() => {
    void cargarAssets();
    void cargarArticulos();
  }, [cargarArticulos, cargarAssets]);

  const categoriasProducto = useMemo(() => {
    const counts = new Map<string, number>();
    articulos.forEach((articulo) => {
      const categoria = articulo.categoria?.trim();
      if (!categoria) return;
      counts.set(categoria, (counts.get(categoria) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6);
  }, [articulos]);

  const marcasProducto = useMemo(() => {
    const counts = new Map<string, number>();
    articulos.forEach((articulo) => {
      const marca = articulo.marca?.trim();
      if (!marca) return;
      counts.set(marca, (counts.get(marca) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  }, [articulos]);

  const productosDestacados = useMemo(
    () => [...articulos]
      .sort((a, b) => Number(b.precio_venta || 0) - Number(a.precio_venta || 0))
      .slice(0, 5),
    [articulos]
  );

  const stockBajo = useMemo(
    () => articulos.filter((articulo) => Number(articulo.stock || 0) <= Number(articulo.stock_minimo ?? 3)),
    [articulos]
  );

  const categoriasSugeridas = useMemo(() => {
    const assetCategories = new Set(
      assets
        .map((asset) => asset.categoria?.trim().toLowerCase())
        .filter(Boolean)
    );

    return categoriasProducto
      .filter((categoria) => !assetCategories.has(categoria.nombre.toLowerCase()))
      .slice(0, 3)
      .map((categoria) => categoria.nombre);
  }, [assets, categoriasProducto]);

  const stats = useMemo(() => ({
    totalAssets: assets.length,
    visiblesIA: assets.filter((asset) => asset.visible_para_ia).length,
    categoriasActivas: new Set(assets.map((asset) => asset.categoria).filter(Boolean)).size,
    productos: articulos.length,
    stockBajo: stockBajo.length,
  }), [articulos.length, assets, stockBajo.length]);

  const contextoComercial = useMemo(() => {
    const topCategoria = categoriasProducto[0]?.nombre;
    const topMarca = marcasProducto[0]?.nombre;

    if (!topCategoria && !topMarca) {
      return "Todavía no hay suficiente data comercial para sugerir campañas. Carga materiales o sincroniza artículos para activar el tablero.";
    }

    return [
      topCategoria ? `La categoría con más movimiento visible es ${topCategoria}.` : null,
      topMarca ? `La marca más representada en inventario es ${topMarca}.` : null,
      stockBajo.length > 0 ? `Hay ${stockBajo.length} productos en stock bajo que conviene mover o reponer.` : null,
      categoriasSugeridas.length > 0 ? `Faltan materiales para ${categoriasSugeridas.join(", ")}.` : null,
    ].filter(Boolean).join(" ");
  }, [categoriasProducto, categoriasSugeridas, marcasProducto, stockBajo.length]);

  const ideasCampana = useMemo(() => {
    const ideas = [
      categoriasProducto[0] ? `Campaña semanal para ${categoriasProducto[0].nombre} con foco en ticket medio.` : null,
      stockBajo[0] ? `Activa contenido urgente para ${stockBajo[0].nombre} antes de quiebre de inventario.` : null,
      productosDestacados[0] ? `Promociona ${productosDestacados[0].nombre} como producto ancla premium.` : null,
      categoriasSugeridas[0] ? `Diseña nuevas piezas para ${categoriasSugeridas[0]} y cubre ese hueco en biblioteca.` : null,
    ];

    return ideas.filter(Boolean) as string[];
  }, [categoriasProducto, categoriasSugeridas, productosDestacados, stockBajo]);

  const openCreateModal = () => {
    setEditingAsset(null);
    form.resetFields();
    form.setFieldsValue({
      tipo_asset: "imagen",
      estado: "activo",
      visible_para_ia: true,
    });
    setAssetModalOpen(true);
  };

  const openEditModal = (asset: MarketingAsset) => {
    setEditingAsset(asset);
    form.setFieldsValue({
      titulo: asset.titulo || "",
      descripcion: asset.descripcion || "",
      descripcion_ia: asset.descripcion_ia || "",
      tipo_asset: asset.tipo_asset || "imagen",
      url_archivo: asset.url_archivo || "",
      categoria: asset.categoria || "",
      keywords: extractKeywords(asset.keywords).join(", "),
      estado: asset.estado || "activo",
      visible_para_ia: Boolean(asset.visible_para_ia),
    });
    setAssetModalOpen(true);
  };

  const handleSaveAsset = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const urlLimpia = values.url_archivo.trim();
      const nombreArchivo = (() => {
        try {
          const segmento = new URL(urlLimpia).pathname.split("/").filter(Boolean).pop();
          return segmento ? decodeURIComponent(segmento) : values.titulo.trim();
        } catch {
          const segmento = urlLimpia.split("/").filter(Boolean).pop();
          return segmento ? segmento : values.titulo.trim();
        }
      })();

      const payload = {
        titulo: values.titulo.trim(),
        descripcion: values.descripcion?.trim() || null,
        descripcion_ia: values.descripcion_ia?.trim() || null,
        tipo_asset: values.tipo_asset,
        url_archivo: urlLimpia,
        nombre_archivo: nombreArchivo,
        categoria: values.categoria?.trim() || null,
        keywords: values.keywords
          ? values.keywords.split(",").map((item) => item.trim()).filter(Boolean)
          : [],
        estado: values.estado || "activo",
        visible_para_ia: values.visible_para_ia ?? true,
      };

      const query = editingAsset
        ? supabaseBrowserClient.from("marketing_assets").update(payload).eq("id", editingAsset.id)
        : supabaseBrowserClient.from("marketing_assets").insert(payload);

      const { error } = await query;

      if (error) {
        throw error;
      }

      message.success(editingAsset ? "Material actualizado" : "Material creado");
      setAssetModalOpen(false);
      form.resetFields();
      setEditingAsset(null);
      await cargarAssets();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    const { error } = await supabaseBrowserClient.from("marketing_assets").delete().eq("id", assetId);

    if (error) {
      message.error(error.message);
      return;
    }

    message.success("Material eliminado");
    await cargarAssets();
  };

  const handleToggleVisibility = async (asset: MarketingAsset, visible: boolean) => {
    const { error } = await supabaseBrowserClient
      .from("marketing_assets")
      .update({ visible_para_ia: visible })
      .eq("id", asset.id);

    if (error) {
      message.error(error.message);
      return;
    }

    setAssets((current) => current.map((item) => (
      item.id === asset.id ? { ...item, visible_para_ia: visible } : item
    )));
  };

  const handlePublishPush = async (asset: MarketingAsset) => {
    const payload = {
      estado: "activo",
      visible_para_ia: true,
      descripcion_ia: appendPushTimestamp(asset.descripcion_ia),
    };

    const { error } = await supabaseBrowserClient
      .from("marketing_assets")
      .update(payload)
      .eq("id", asset.id);

    if (error) {
      message.error(`No se pudo publicar la notificación: ${error.message}`);
      return;
    }

    try {
      const response = await fetch("/api/marketing-center/push-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: asset.titulo || "Promoción La Cosmetikera",
          message: asset.descripcion || asset.descripcion_ia || "Tenemos una promoción activa para ti.",
          url: "/club",
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "No se pudo enviar la campaña push");
      }

      const sent = Number(json.sent || 0);
      if (sent > 0) {
        message.success(`Promoción publicada y enviada a ${sent} dispositivo(s).`);
      } else {
        message.success("Promoción publicada. No había dispositivos suscritos para envío inmediato.");
      }
    } catch (pushError: unknown) {
      const errorMessage = pushError instanceof Error ? pushError.message : "Error enviando campaña push";
      message.warning(`Promoción publicada, pero el envío push falló: ${errorMessage}`);
    }

    await cargarAssets();
  };

  const assetColumns = [
    {
      title: "Material",
      key: "material",
      render: (_: unknown, asset: MarketingAsset) => (
        <Space align="start" size={12}>
          {isImageUrl(asset.url_archivo) ? (
            <Image
              src={asset.url_archivo || ""}
              alt={asset.titulo || "Material"}
              width={64}
              height={64}
              style={{ objectFit: "cover", borderRadius: 12 }}
              preview={false}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg,#ffd6eb,#f4e1ff)",
              }}
            >
              <PictureOutlined style={{ fontSize: 24, color: "#d81b87" }} />
            </div>
          )}
          <Space direction="vertical" size={4}>
            <Text strong>{asset.titulo || "Sin título"}</Text>
            <Text type="secondary">{asset.categoria || "Sin categoría"}</Text>
            <Space size={6} wrap>
              <Tag color="magenta">{asset.tipo_asset || "asset"}</Tag>
              <Tag color={asset.estado === "activo" ? "green" : "default"}>{asset.estado || "sin estado"}</Tag>
            </Space>
          </Space>
        </Space>
      ),
    },
    {
      title: "IA",
      dataIndex: "visible_para_ia",
      key: "visible_para_ia",
      width: 110,
      render: (value: boolean | null, asset: MarketingAsset) => (
        <Switch checked={Boolean(value)} onChange={(checked) => void handleToggleVisibility(asset, checked)} />
      ),
    },
    {
      title: "Keywords",
      key: "keywords",
      render: (_: unknown, asset: MarketingAsset) => (
        <Space size={4} wrap>
          {extractKeywords(asset.keywords).slice(0, 4).map((keyword) => (
            <Tag key={`${asset.id}-${keyword}`}>{keyword}</Tag>
          ))}
          {extractKeywords(asset.keywords).length === 0 && <Text type="secondary">Sin keywords</Text>}
        </Space>
      ),
    },
    {
      title: "Fecha",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (value: string | null) => value ? dayjs(value).format("DD/MM/YYYY") : "-",
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 230,
      render: (_: unknown, asset: MarketingAsset) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => setPreviewAsset(asset)} />
          <Button icon={<EditOutlined />} onClick={() => openEditModal(asset)} />
          <Tooltip title="Publicar para notificación en app móvil">
            <Button icon={<BellOutlined />} onClick={() => void handlePublishPush(asset)} />
          </Tooltip>
          <Popconfirm
            title="Eliminar material"
            description="Esta acción no se puede deshacer."
            okText="Eliminar"
            cancelText="Cancelar"
            onConfirm={() => void handleDelete(asset.id)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const loading = loadingAssets || loadingArticulos;

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Card style={{ ...cardStyle, background: brandGradient }} styles={{ body: { padding: screens.xs ? 18 : 28 } }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={16}>
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Space size={10}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg,#d81b87,#ff5ea8)",
                    color: "#fff",
                  }}
                >
                  <RocketOutlined style={{ fontSize: 24 }} />
                </div>
                <div>
                  <Title level={screens.xs ? 4 : 2} style={{ margin: 0, color: "#8f145f" }}>
                    Marketing Center
                  </Title>
                  <Text style={{ color: "#7a4b62" }}>
                    Biblioteca comercial y foco de campañas para La Cosmetikera.
                  </Text>
                </div>
              </Space>
              <Paragraph style={{ marginBottom: 0, color: "#6f4258", maxWidth: 760 }}>
                {contextoComercial}
              </Paragraph>
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Space wrap style={{ justifyContent: screens.md ? "flex-end" : "flex-start", width: "100%" }}>
              <Button icon={<ReloadOutlined />} onClick={() => { void cargarAssets(); void cargarArticulos(); }}>
                Actualizar
              </Button>
              <Button type="primary" icon={<FolderOpenOutlined />} onClick={openCreateModal}>
                Nuevo material
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {stockBajo.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Inventario con presión comercial"
          description={`Hay ${stockBajo.length} productos con stock en nivel crítico. Conviene priorizar reposición o activar campañas rápidas.`}
          style={{ borderRadius: 16 }}
        />
      )}

      <Tabs
        defaultActiveKey="resumen"
        items={[
          {
            key: "resumen",
            label: "Resumen comercial",
            children: loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                <Spin size="large" />
              </div>
            ) : (
              <Space direction="vertical" size={20} style={{ width: "100%" }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} xl={6}>
                    <Card style={cardStyle} styles={{ body: { padding: 20 } }}>
                      <Statistic title="Materiales" value={stats.totalAssets} prefix={<PictureOutlined />} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} xl={6}>
                    <Card style={cardStyle} styles={{ body: { padding: 20 } }}>
                      <Statistic title="Visibles para IA" value={stats.visiblesIA} prefix={<BulbOutlined />} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} xl={6}>
                    <Card style={cardStyle} styles={{ body: { padding: 20 } }}>
                      <Statistic title="Productos" value={stats.productos} prefix={<TagsOutlined />} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} xl={6}>
                    <Card style={cardStyle} styles={{ body: { padding: 20 } }}>
                      <Statistic title="Stock bajo" value={stats.stockBajo} prefix={<LinkOutlined />} />
                    </Card>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={14}>
                    <Card title="Ideas de campaña" style={cardStyle} styles={{ body: { padding: 20 } }}>
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        {ideasCampana.length > 0 ? ideasCampana.map((idea) => (
                          <Alert key={idea} type="info" showIcon message={idea} style={{ borderRadius: 14 }} />
                        )) : <Empty description="Sin ideas disponibles todavía" />}
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} xl={10}>
                    <Card title="Huecos de contenido" style={cardStyle} styles={{ body: { padding: 20 } }}>
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        {categoriasSugeridas.length > 0 ? categoriasSugeridas.map((categoria) => (
                          <Tag key={categoria} color="magenta" style={{ width: "fit-content", padding: "6px 10px", borderRadius: 999 }}>
                            {categoria}
                          </Tag>
                        )) : <Text type="secondary">La cobertura de categorías se ve equilibrada.</Text>}
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <Card title="Categorías con más inventario" style={cardStyle} styles={{ body: { padding: 20 } }}>
                      <Space direction="vertical" size={10} style={{ width: "100%" }}>
                        {categoriasProducto.length > 0 ? categoriasProducto.map((categoria) => (
                          <Row key={categoria.nombre} justify="space-between">
                            <Text>{categoria.nombre}</Text>
                            <Tag>{categoria.cantidad}</Tag>
                          </Row>
                        )) : <Empty description="Sin categorías" />}
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="Marcas destacadas" style={cardStyle} styles={{ body: { padding: 20 } }}>
                      <Space direction="vertical" size={10} style={{ width: "100%" }}>
                        {marcasProducto.length > 0 ? marcasProducto.map((marca) => (
                          <Row key={marca.nombre} justify="space-between">
                            <Text>{marca.nombre}</Text>
                            <Tag color="purple">{marca.cantidad}</Tag>
                          </Row>
                        )) : <Empty description="Sin marcas" />}
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Card title="Productos destacados" style={cardStyle} styles={{ body: { padding: 20 } }}>
                  <Row gutter={[16, 16]}>
                    {productosDestacados.length > 0 ? productosDestacados.map((producto) => (
                      <Col xs={24} md={12} xl={8} key={producto.id}>
                        <Card size="small" style={{ borderRadius: 16, background: "#fff8fc" }}>
                          <Space direction="vertical" size={6} style={{ width: "100%" }}>
                            <Text strong>{producto.nombre}</Text>
                            <Text type="secondary">{producto.categoria || "Sin categoría"}</Text>
                            <Text>{formatMoney(producto.precio_venta)}</Text>
                            <Tag color={Number(producto.stock || 0) <= Number(producto.stock_minimo ?? 3) ? "red" : "green"}>
                              Stock: {Number(producto.stock || 0)}
                            </Tag>
                          </Space>
                        </Card>
                      </Col>
                    )) : <Col span={24}><Empty description="Sin productos para destacar" /></Col>}
                  </Row>
                </Card>
              </Space>
            ),
          },
          {
            key: "notificaciones-ia",
            label: <Space size={4}><BellOutlined />Notificaciones IA</Space>,
            children: (
              <Space direction="vertical" size={20} style={{ width: "100%" }}>
                <Card style={cardStyle} styles={{ body: { padding: 24 } }}>
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Space size={10} align="start">
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#d81b87,#ff5ea8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <BellOutlined style={{ color: "#fff", fontSize: 20 }} />
                      </div>
                      <div>
                        <Title level={5} style={{ margin: 0 }}>Notificaciones inteligentes personalizadas</Title>
                        <Paragraph style={{ margin: 0, color: "#888", fontSize: 13 }}>
                          El sistema analiza el historial de compra de cada clienta, estima si ya se le agotó el producto según la categoría,
                          y usa IA (Gemini) para redactar un mensaje personalizado. Solo se notifica a quienes tienen la app instalada y el push activo.
                        </Paragraph>
                      </div>
                    </Space>
                    <Row gutter={[12, 12]}>
                      {[
                        { icon: "🔍", titulo: "Historial real",        desc: "Lee las últimas 180 días de compras de cada clienta." },
                        { icon: "⏱️", titulo: "Duración estimada",     desc: "Shampoo ~45 días · Tinte ~35 días · Base ~90 días, etc." },
                        { icon: "🤖", titulo: "Texto con IA",          desc: "Gemini genera el copy personalizado para cada clienta." },
                        { icon: "📲", titulo: "Push individual",       desc: "Cada clienta recibe su propio mensaje, no una campaña masiva." },
                      ].map((item) => (
                        <Col xs={24} sm={12} key={item.titulo}>
                          <Card size="small" style={{ borderRadius: 12, background: "#fff8fc", border: "1px solid #ffd6e7" }}>
                            <Space size={8}>
                              <span style={{ fontSize: 22 }}>{item.icon}</span>
                              <div>
                                <Text strong style={{ fontSize: 13 }}>{item.titulo}</Text>
                                <div><Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text></div>
                              </div>
                            </Space>
                          </Card>
                        </Col>
                      ))}
                    </Row>

                    <Alert
                      type="info"
                      showIcon
                      message="¿Cuándo se envía?"
                      description="Solo se envía push a clientas cuyo producto estimado lleva más del 85% de su tiempo de uso. Las demás se omiten para evitar spam."
                      style={{ borderRadius: 12 }}
                    />

                    <Button
                      type="primary"
                      size="large"
                      icon={<RocketOutlined />}
                      loading={pushInteligente.cargando}
                      onClick={() => void lanzarPushInteligente()}
                      style={{ background: "#d81b87", borderColor: "#d81b87" }}
                    >
                      {pushInteligente.cargando ? "Analizando y enviando..." : "Lanzar notificaciones inteligentes"}
                    </Button>

                    {pushInteligente.error && (
                      <Alert type="error" showIcon message={pushInteligente.error} style={{ borderRadius: 12 }} />
                    )}

                    {pushInteligente.resultado && (
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Row gutter={[12, 12]}>
                          <Col xs={8}>
                            <Card size="small" style={{ borderRadius: 12, textAlign: "center" }}>
                              <Statistic title="Enviadas" value={pushInteligente.resultado.enviadas} valueStyle={{ color: "#52c41a" }} />
                            </Card>
                          </Col>
                          <Col xs={8}>
                            <Card size="small" style={{ borderRadius: 12, textAlign: "center" }}>
                              <Statistic title="Sin historial" value={pushInteligente.resultado.sin_historial} valueStyle={{ color: "#faad14" }} />
                            </Card>
                          </Col>
                          <Col xs={8}>
                            <Card size="small" style={{ borderRadius: 12, textAlign: "center" }}>
                              <Statistic title="Subs expiradas" value={pushInteligente.resultado.suscripciones_inactivas} valueStyle={{ color: "#ff4d4f" }} />
                            </Card>
                          </Col>
                        </Row>
                        <Card
                          size="small"
                          title="Detalle por clienta"
                          style={{ borderRadius: 12, maxHeight: 320, overflow: "auto" }}
                        >
                          <Space direction="vertical" size={6} style={{ width: "100%" }}>
                            {pushInteligente.resultado.detalle.map((d) => (
                              <Row key={d.perfil_id} justify="space-between" wrap={false}>
                                <Col flex="auto" style={{ minWidth: 0 }}>
                                  <Text ellipsis style={{ fontSize: 12 }}>{d.mensaje ?? "—"}</Text>
                                </Col>
                                <Col style={{ flexShrink: 0, marginLeft: 8 }}>
                                  <Tag
                                    color={d.estado === "enviada" ? "green" : d.estado === "sin_historial" ? "orange" : "default"}
                                    style={{ fontSize: 11 }}
                                  >
                                    {d.estado}
                                  </Tag>
                                </Col>
                              </Row>
                            ))}
                          </Space>
                        </Card>
                      </Space>
                    )}
                  </Space>
                </Card>
              </Space>
            ),
          },
          {
            key: "materiales",
            label: "Materiales",
            children: (
              <Card style={cardStyle} styles={{ body: { padding: screens.xs ? 14 : 20 } }}>
                <Table
                  rowKey="id"
                  loading={loadingAssets}
                  columns={assetColumns}
                  dataSource={assets}
                  pagination={{ pageSize: 8 }}
                  scroll={{ x: 960 }}
                  locale={{ emptyText: <Empty description="No hay materiales todavía" /> }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        open={assetModalOpen}
        title={editingAsset ? "Editar material" : "Nuevo material"}
        onCancel={() => {
          setAssetModalOpen(false);
          setEditingAsset(null);
        }}
        onOk={() => void handleSaveAsset()}
        confirmLoading={saving}
        okText={editingAsset ? "Guardar cambios" : "Crear material"}
        cancelText="Cancelar"
        width={720}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="titulo" label="Título" rules={[{ required: true, message: "Ingresa un título" }]}>
                <Input placeholder="Ej. Banner promo capilar" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="categoria" label="Categoría">
                <Input placeholder="Ej. Maquillaje" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="tipo_asset" label="Tipo" rules={[{ required: true, message: "Selecciona un tipo" }]}>
                <Select options={assetTypeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="estado" label="Estado">
                <Select options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="url_archivo" label="URL del material" rules={[{ required: true, message: "Ingresa la URL del archivo" }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción comercial">
            <Input.TextArea rows={3} placeholder="Qué comunica este material y cómo se debe usar" />
          </Form.Item>
          <Form.Item name="descripcion_ia" label="Descripción para IA">
            <Input.TextArea rows={3} placeholder="Contexto útil para respuestas automáticas y agentes" />
          </Form.Item>
          <Form.Item name="keywords" label="Keywords">
            <Input placeholder="skincare, brillo, cabello, oferta" />
          </Form.Item>
          <Form.Item name="visible_para_ia" label="Visible para IA" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(previewAsset)}
        footer={null}
        onCancel={() => setPreviewAsset(null)}
        title={previewAsset?.titulo || "Vista previa"}
        width={820}
      >
        {previewAsset && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {isImageUrl(previewAsset.url_archivo) ? (
              <Image
                src={previewAsset.url_archivo || ""}
                alt={previewAsset.titulo || "Vista previa"}
                style={{ width: "100%", borderRadius: 16 }}
              />
            ) : (
              <Alert
                type="info"
                showIcon
                message="Vista previa limitada"
                description="Este material no parece ser una imagen. Usa el enlace directo para revisarlo."
              />
            )}
            <Space direction="vertical" size={4}>
              <Text strong>Categoría</Text>
              <Text>{previewAsset.categoria || "Sin categoría"}</Text>
            </Space>
            <Space direction="vertical" size={4}>
              <Text strong>Descripción</Text>
              <Text>{previewAsset.descripcion || "Sin descripción"}</Text>
            </Space>
            <Space direction="vertical" size={4}>
              <Text strong>Keywords</Text>
              <Space wrap>
                {extractKeywords(previewAsset.keywords).map((keyword) => <Tag key={keyword}>{keyword}</Tag>)}
              </Space>
            </Space>
          </Space>
        )}
      </Modal>
    </Space>
  );
}
