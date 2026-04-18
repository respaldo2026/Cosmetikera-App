"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card, Button, Typography, Space, Modal, Form, Input, InputNumber,
  Select, Tag, App, Spin, Tooltip, Row, Col, Statistic, Badge, Upload,
  Divider, Grid, Empty, Dropdown, Progress, Table, Radio, Alert, Checkbox,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MoreOutlined,
  WarningOutlined, TagsOutlined, SearchOutlined, ReloadOutlined,
  InboxOutlined, BarcodeOutlined, ShopOutlined, AppstoreOutlined,
  UnorderedListOutlined, CameraOutlined, EyeOutlined, PercentageOutlined,
  DollarOutlined, RiseOutlined, FallOutlined, ControlOutlined, CopyOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const CATEGORIAS_DEFAULT = [
  "Esmaltes", "Bases y Tops", "Maquillaje", "Cuidado de piel",
  "Cejas y pestañas", "Accesorios", "Herramientas", "Insumos",
];

type Articulo = {
  id: string;
  nombre: string;
  referencia?: string;
  codigo_secundario?: string;
  categoria?: string;
  precio_venta: number;
  precio_costo?: number;
  stock: number;
  stock_minimo?: number;
  marca?: string;
  descripcion?: string;
  activo?: boolean;
  imagen_url?: string;
};

export default function ArticulosPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const router = useRouter();

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Articulo | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [vista, setVista] = useState<"grid" | "lista">("grid");

  // Ajuste masivo
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteForm] = Form.useForm();
  const [ajusteFiltroCategoria, setAjusteFiltroCategoria] = useState<string[]>([]);
  const [ajusteFiltrMarca, setAjusteFiltrMarca] = useState<string[]>([]);
  const [ajusteTipo, setAjusteTipo] = useState<"porcentaje" | "fijo">("porcentaje");
  const [ajusteDireccion, setAjusteDireccion] = useState<"subir" | "bajar">("subir");
  const [ajusteValor, setAjusteValor] = useState<number>(0);
  const [ajusteCampo, setAjusteCampo] = useState<"precio_venta" | "precio_costo" | "ambos">("precio_venta");
  const [aplicandoAjuste, setAplicandoAjuste] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabaseBrowserClient
      .from("articulos")
      .select("*")
      .order("nombre");
    if (error) {
      // Tabla puede no existir aún
      setArticulos([]);
    } else {
      setArticulos(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const articulosFiltrados = articulos.filter((a) => {
    const matchSearch = !search ||
      a.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (a.referencia || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.codigo_secundario || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.marca || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !filtroCategoria || a.categoria === filtroCategoria;
    return matchSearch && matchCat;
  });

  const stockBajo = articulos.filter((a) => a.stock <= (a.stock_minimo ?? 3));
  const valorInventario = articulos.reduce((s, a) => s + a.stock * (a.precio_costo || 0), 0);
  const categorias = [...new Set(articulos.map((a) => a.categoria).filter(Boolean))];
  const marcas = [...new Set(articulos.map((a) => a.marca).filter(Boolean))];

  // Previsualización ajuste masivo
  const articulosAjuste = useMemo(() => {
    let lista = [...articulos];
    if (ajusteFiltroCategoria.length > 0)
      lista = lista.filter((a) => ajusteFiltroCategoria.includes(a.categoria || ""));
    if (ajusteFiltrMarca.length > 0)
      lista = lista.filter((a) => ajusteFiltrMarca.includes(a.marca || ""));
    return lista.map((a) => {
      const calcNuevo = (precio: number) => {
        if (!ajusteValor || ajusteValor <= 0) return precio;
        let delta = ajusteTipo === "porcentaje" ? Math.round(precio * ajusteValor / 100) : ajusteValor;
        return ajusteDireccion === "subir" ? precio + delta : Math.max(0, precio - delta);
      };
      return {
        ...a,
        nuevo_precio_venta: ajusteCampo !== "precio_costo" ? calcNuevo(a.precio_venta) : a.precio_venta,
        nuevo_precio_costo: ajusteCampo !== "precio_venta" ? calcNuevo(a.precio_costo || 0) : (a.precio_costo || 0),
      };
    });
  }, [articulos, ajusteFiltroCategoria, ajusteFiltrMarca, ajusteTipo, ajusteDireccion, ajusteValor, ajusteCampo]);

  const aplicarAjusteMasivo = async () => {
    if (!ajusteValor || ajusteValor <= 0) { message.warning("Ingresa un valor mayor a 0"); return; }
    setAplicandoAjuste(true);
    try {
      let errores = 0;
      for (const art of articulosAjuste) {
        const update: Record<string, number> = {};
        if (ajusteCampo !== "precio_costo") update.precio_venta = art.nuevo_precio_venta;
        if (ajusteCampo !== "precio_venta") update.precio_costo = art.nuevo_precio_costo;
        const { error } = await supabaseBrowserClient.from("articulos").update(update).eq("id", art.id);
        if (error) errores++;
      }
      if (errores > 0) message.warning(`${errores} artículo(s) no se pudieron actualizar`);
      else message.success(`✅ ${articulosAjuste.length} artículo(s) actualizados`);
      setAjusteOpen(false);
      setAjusteValor(0);
      setAjusteFiltroCategoria([]);
      setAjusteFiltrMarca([]);
      cargar();
    } catch {
      message.error("Error al aplicar ajuste masivo");
    } finally {
      setAplicandoAjuste(false);
    }
  };

  const openModal = (art?: Articulo) => {
    setEditing(art || null);
    form.setFieldsValue(art ? { ...art } : { activo: true, stock: 0, stock_minimo: 3 });
    setModalOpen(true);
  };

  const duplicarArticulo = (art: Articulo) => {
    setEditing(null); // es nuevo, no edición
    form.setFieldsValue({
      nombre: `${art.nombre} (copia)`,
      categoria: art.categoria,
      marca: art.marca,
      descripcion: art.descripcion,
      precio_venta: art.precio_venta,
      precio_costo: art.precio_costo,
      stock: 0,
      stock_minimo: art.stock_minimo,
      imagen_url: art.imagen_url,
      activo: true,
      referencia: undefined, // se omite el código intencionalmente
      codigo_secundario: undefined,
    });
    setModalOpen(true);
  };

  const handleGuardar = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabaseBrowserClient
          .from("articulos").update(values).eq("id", editing.id);
        if (error) throw error;
        message.success("Artículo actualizado");
      } else {
        const { error } = await supabaseBrowserClient
          .from("articulos").insert([values]);
        if (error) throw error;
        message.success("Artículo creado");
      }
      setModalOpen(false);
      cargar();
    } catch (e: any) {
      message.error(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = (art: Articulo) => {
    modal.confirm({
      title: `Eliminar "${art.nombre}"`,
      content: "¿Confirmas eliminar este artículo?",
      okType: "danger",
      okText: "Eliminar",
      cancelText: "Cancelar",
      onOk: async () => {
        const { error } = await supabaseBrowserClient
          .from("articulos").delete().eq("id", art.id);
        if (error) { message.error(error.message); return; }
        message.success("Eliminado");
        cargar();
      },
    });
  };

  const getStockColor = (art: Articulo) => {
    if (art.stock === 0) return "#ff4d4f";
    if (art.stock <= (art.stock_minimo ?? 3)) return "#fa8c16";
    return "#52c41a";
  };

  const getStockTag = (art: Articulo) => {
    if (art.stock === 0) return <Tag color="error">Sin stock</Tag>;
    if (art.stock <= (art.stock_minimo ?? 3)) return <Tag color="warning">Stock bajo</Tag>;
    return <Tag color="success">{art.stock} uds.</Tag>;
  };

  const renderCard = (art: Articulo) => (
    <Col key={art.id} xs={12} sm={8} md={6} xl={4}>
      <Card
        hoverable
        style={{ borderRadius: 12, overflow: "hidden", position: "relative" }}
        bodyStyle={{ padding: 12 }}
        cover={
          <div style={{
            height: 110, background: "linear-gradient(135deg,#fce4f8,#f0d6ff)",
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
          }}>
            {art.imagen_url
              ? <img src={art.imagen_url} alt={art.nombre} style={{ height: "100%", objectFit: "cover", width: "100%" }} />
              : <ShopOutlined style={{ fontSize: 40, color: "#d81b87", opacity: 0.4 }} />
            }
            <div style={{ position: "absolute", top: 6, right: 6 }}>
              {getStockTag(art)}
            </div>
          </div>
        }
        actions={[
          <Tooltip key="view" title="Ver detalle">
            <EyeOutlined onClick={() => router.push(`/articulos/show/${art.id}`)} />
          </Tooltip>,
          <Tooltip key="edit" title="Editar">
            <EditOutlined onClick={() => openModal(art)} />
          </Tooltip>,
          <Tooltip key="copy" title="Duplicar artículo">
            <CopyOutlined style={{ color: "#1677ff" }} onClick={() => duplicarArticulo(art)} />
          </Tooltip>,
          <Tooltip key="del" title="Eliminar">
            <DeleteOutlined style={{ color: "#ff4d4f" }} onClick={() => handleEliminar(art)} />
          </Tooltip>,
        ]}
      >
        <Text strong style={{ fontSize: 13, display: "block", marginBottom: 2 }} ellipsis>
          {art.nombre}
        </Text>
        {art.marca && <Text type="secondary" style={{ fontSize: 11 }}>{art.marca}</Text>}
        {art.categoria && (
          <Tag style={{ marginTop: 4, fontSize: 10 }} color="purple">{art.categoria}</Tag>
        )}
        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text strong style={{ color: "#d81b87", fontSize: 15 }}>
            ${Number(art.precio_venta).toLocaleString()}
          </Text>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: getStockColor(art), flexShrink: 0,
          }} />
        </div>
      </Card>
    </Col>
  );

  return (
    <>
      {/* ── HEADER ── */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }} bodyStyle={{ padding: "12px 16px" }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Space align="center">
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "linear-gradient(135deg,#d81b87,#9c27b0)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <TagsOutlined style={{ color: "#fff", fontSize: 22 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>Artículos</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Catálogo de productos cosméticos
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={vista === "grid" ? <UnorderedListOutlined /> : <AppstoreOutlined />}
                onClick={() => setVista(vista === "grid" ? "lista" : "grid")}
              />
              <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
              <Button
                icon={<ControlOutlined />}
                onClick={() => setAjusteOpen(true)}
              >
                {isMobile ? "Precios" : "Ajuste masivo"}
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openModal()}
                style={{ background: "linear-gradient(90deg,#d81b87,#9c27b0)" }}
              >
                {isMobile ? "Nuevo" : "Nuevo artículo"}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── KPIs ── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Total artículos" value={articulos.length} prefix={<TagsOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Stock bajo"
              value={stockBajo.length}
              valueStyle={{ color: "#fa8c16" }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Categorías" value={categorias.length} prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Valor inventario"
              value={valorInventario}
              prefix="$"
              formatter={(v) => Number(v).toLocaleString()}
            />
          </Card>
        </Col>
      </Row>

      {/* ── FILTROS ── */}
      <Card style={{ marginBottom: 16, borderRadius: 10 }} bodyStyle={{ padding: "10px 14px" }}>
        <Row gutter={[12, 8]}>
          <Col xs={24} sm={12} md={10}>
            <Input
              placeholder="Buscar por nombre, referencia o marca..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Filtrar por categoría"
              allowClear
              style={{ width: "100%" }}
              value={filtroCategoria}
              onChange={setFiltroCategoria}
              options={[...CATEGORIAS_DEFAULT, ...categorias.filter(c => !CATEGORIAS_DEFAULT.includes(c!))]
                .map((c) => ({ label: c, value: c }))}
            />
          </Col>
          {stockBajo.length > 0 && (
            <Col xs={24} md={6}>
              <Tag color="warning" icon={<WarningOutlined />} style={{ padding: "5px 10px", fontSize: 13 }}>
                {stockBajo.length} artículo(s) con stock bajo
              </Tag>
            </Col>
          )}
        </Row>
      </Card>

      {/* ── CONTENIDO ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
      ) : articulosFiltrados.length === 0 ? (
        <Empty description="No hay artículos. Agrega el primero." style={{ padding: 60 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Agregar artículo
          </Button>
        </Empty>
      ) : (
        <Row gutter={[12, 12]}>
          {articulosFiltrados.map(renderCard)}
        </Row>
      )}

      {/* ── MODAL AJUSTE MASIVO DE PRECIOS ── */}
      <Modal
        title={<Space><ControlOutlined style={{ color: "#d81b87" }} />Modificación masiva de precios</Space>}
        open={ajusteOpen}
        onCancel={() => setAjusteOpen(false)}
        width={820}
        footer={null}
        destroyOnClose
      >
        {/* Filtros */}
        <Card size="small" style={{ marginBottom: 12, background: "#fafafa" }}
          title={<Text strong style={{ fontSize: 13 }}>1. Seleccionar artículos</Text>}>
          <Row gutter={[12, 8]}>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Filtrar por categoría</Text></div>
              <Select
                mode="multiple"
                placeholder="Todas las categorías"
                style={{ width: "100%" }}
                value={ajusteFiltroCategoria}
                onChange={setAjusteFiltroCategoria}
                allowClear
                options={[...CATEGORIAS_DEFAULT, ...categorias.filter(c => !CATEGORIAS_DEFAULT.includes(c!))]
                  .map((c) => ({ label: c, value: c }))}
              />
            </Col>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Filtrar por marca</Text></div>
              <Select
                mode="multiple"
                placeholder="Todas las marcas"
                style={{ width: "100%" }}
                value={ajusteFiltrMarca}
                onChange={setAjusteFiltrMarca}
                allowClear
                options={marcas.map((m) => ({ label: m, value: m }))}
              />
            </Col>
          </Row>
          <div style={{ marginTop: 8 }}>
            <Tag color="blue">{articulosAjuste.length} artículo(s) seleccionados</Tag>
            {ajusteFiltroCategoria.length === 0 && ajusteFiltrMarca.length === 0 && (
              <Tag color="orange">Sin filtros = se modifican TODOS los artículos</Tag>
            )}
          </div>
        </Card>

        {/* Tipo de ajuste */}
        <Card size="small" style={{ marginBottom: 12, background: "#fafafa" }}
          title={<Text strong style={{ fontSize: 13 }}>2. Tipo de modificación</Text>}>
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} sm={8}>
              <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Campo a modificar</Text></div>
              <Radio.Group value={ajusteCampo} onChange={(e) => setAjusteCampo(e.target.value)} size="small">
                <Space direction="vertical" size={4}>
                  <Radio value="precio_venta">Precio venta</Radio>
                  <Radio value="precio_costo">Precio costo</Radio>
                  <Radio value="ambos">Ambos precios</Radio>
                </Space>
              </Radio.Group>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Método</Text></div>
              <Radio.Group value={ajusteTipo} onChange={(e) => setAjusteTipo(e.target.value)} size="small">
                <Space direction="vertical" size={4}>
                  <Radio value="porcentaje"><PercentageOutlined /> Porcentaje (%)</Radio>
                  <Radio value="fijo"><DollarOutlined /> Valor fijo ($)</Radio>
                </Space>
              </Radio.Group>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Dirección</Text></div>
              <Radio.Group value={ajusteDireccion} onChange={(e) => setAjusteDireccion(e.target.value)} size="small">
                <Space direction="vertical" size={4}>
                  <Radio value="subir"><RiseOutlined style={{ color: "#52c41a" }} /> Subir precio</Radio>
                  <Radio value="bajar"><FallOutlined style={{ color: "#ff4d4f" }} /> Bajar precio</Radio>
                </Space>
              </Radio.Group>
            </Col>
          </Row>
          <Divider style={{ margin: "12px 0" }} />
          <Row align="middle" gutter={12}>
            <Col>
              <Text>Valor a {ajusteDireccion === "subir" ? "aumentar" : "reducir"}:</Text>
            </Col>
            <Col>
              <InputNumber
                min={0}
                max={ajusteTipo === "porcentaje" ? 100 : undefined}
                value={ajusteValor}
                onChange={(v) => setAjusteValor(v || 0)}
                addonAfter={ajusteTipo === "porcentaje" ? "%" : "$"}
                style={{ width: 160 }}
                size="large"
              />
            </Col>
            {ajusteValor > 0 && (
              <Col>
                <Alert
                  type={ajusteDireccion === "subir" ? "success" : "warning"}
                  showIcon
                  style={{ padding: "2px 10px" }}
                  message={
                    ajusteTipo === "porcentaje"
                      ? `${ajusteDireccion === "subir" ? "+" : "-"}${ajusteValor}% en ${articulosAjuste.length} artículo(s)`
                      : `${ajusteDireccion === "subir" ? "+" : "-"}$${ajusteValor.toLocaleString()} en ${articulosAjuste.length} artículo(s)`
                  }
                />
              </Col>
            )}
          </Row>
        </Card>

        {/* Preview */}
        {ajusteValor > 0 && articulosAjuste.length > 0 && (
          <Card size="small" style={{ marginBottom: 12 }}
            title={<Text strong style={{ fontSize: 13 }}>3. Vista previa ({articulosAjuste.length} artículos)</Text>}>
            <Table
              dataSource={articulosAjuste}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 6, size: "small" }}
              scroll={{ x: 500 }}
              columns={[
                { title: "Artículo", dataIndex: "nombre", ellipsis: true, render: (n: string, r: Articulo & { nuevo_precio_venta: number; nuevo_precio_costo: number }) => (
                  <Space size={4} direction="vertical" style={{ lineHeight: 1.2 }}>
                    <Text style={{ fontSize: 12 }}>{n}</Text>
                    {r.marca && <Text type="secondary" style={{ fontSize: 11 }}>{r.marca}</Text>}
                  </Space>
                )},
                { title: "Categoría", dataIndex: "categoria", width: 120, render: (c?: string) => c ? <Tag style={{ fontSize: 10 }}>{c}</Tag> : <Text type="secondary">—</Text> },
                ...(ajusteCampo !== "precio_costo" ? [{
                  title: "Precio venta",
                  key: "pv",
                  width: 180,
                  render: (_: unknown, r: Articulo & { nuevo_precio_venta: number }) => (
                    <Space size={4}>
                      <Text delete type="secondary" style={{ fontSize: 11 }}>${Number(r.precio_venta).toLocaleString()}</Text>
                      <Text>→</Text>
                      <Text strong style={{ color: ajusteDireccion === "subir" ? "#52c41a" : "#ff4d4f" }}>
                        ${Number(r.nuevo_precio_venta).toLocaleString()}
                      </Text>
                    </Space>
                  ),
                }] : []),
                ...(ajusteCampo !== "precio_venta" ? [{
                  title: "Precio costo",
                  key: "pc",
                  width: 180,
                  render: (_: unknown, r: Articulo & { nuevo_precio_costo: number }) => (
                    <Space size={4}>
                      <Text delete type="secondary" style={{ fontSize: 11 }}>${Number(r.precio_costo || 0).toLocaleString()}</Text>
                      <Text>→</Text>
                      <Text strong style={{ color: ajusteDireccion === "subir" ? "#52c41a" : "#ff4d4f" }}>
                        ${Number(r.nuevo_precio_costo).toLocaleString()}
                      </Text>
                    </Space>
                  ),
                }] : []),
              ]}
            />
          </Card>
        )}

        {/* Acciones */}
        <Row justify="end" gutter={8}>
          <Col><Button onClick={() => setAjusteOpen(false)}>Cancelar</Button></Col>
          <Col>
            <Button
              type="primary"
              danger={ajusteDireccion === "bajar"}
              icon={ajusteDireccion === "subir" ? <RiseOutlined /> : <FallOutlined />}
              loading={aplicandoAjuste}
              disabled={ajusteValor <= 0 || articulosAjuste.length === 0}
              onClick={aplicarAjusteMasivo}
              style={ajusteDireccion === "subir" ? { background: "#52c41a", borderColor: "#52c41a" } : {}}
            >
              Aplicar a {articulosAjuste.length} artículo(s)
            </Button>
          </Col>
        </Row>
      </Modal>

      {/* ── MODAL EDICIÓN ── */}
      <Modal
        title={editing ? "Editar artículo" : "Nuevo artículo"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleGuardar}
        confirmLoading={saving}
        okText={editing ? "Guardar cambios" : "Crear artículo"}
        cancelText="Cancelar"
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="nombre" label="Nombre del artículo" rules={[{ required: true, message: "Requerido" }]}>
                <Input placeholder="Ej: Esmalte Base Coat 15ml" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="referencia" label="Código principal">
                <Input placeholder="COD-001" prefix={<BarcodeOutlined />} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="codigo_secundario" label="Referencia / 2° código">
                <Input placeholder="REF-001" prefix={<BarcodeOutlined />} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="categoria" label="Categoría">
                <Select
                  showSearch allowClear
                  placeholder="Seleccionar categoría"
                  options={CATEGORIAS_DEFAULT.map((c) => ({ label: c, value: c }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="marca" label="Marca">
                <Input placeholder="Ej: OPI, Essie, Sally Hansen..." />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="precio_venta" label="Precio venta ($)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: "100%" }} formatter={(v) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="precio_costo" label="Precio costo ($)">
                <InputNumber min={0} style={{ width: "100%" }} formatter={(v) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stock" label="Stock actual" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="stock_minimo" label="Stock mínimo">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="imagen_url" label="URL imagen (opcional)">
                <Input placeholder="https://..." prefix={<CameraOutlined />} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} placeholder="Notas del producto..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
