"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Button, Typography, Space, Modal, Form, Input, InputNumber,
  Select, Tag, App, Spin, Tooltip, Row, Col, Statistic, Badge, Upload,
  Divider, Grid, Empty, Dropdown, Progress,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MoreOutlined,
  WarningOutlined, TagsOutlined, SearchOutlined, ReloadOutlined,
  InboxOutlined, BarcodeOutlined, ShopOutlined, AppstoreOutlined,
  UnorderedListOutlined, CameraOutlined, EyeOutlined,
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
      (a.marca || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !filtroCategoria || a.categoria === filtroCategoria;
    return matchSearch && matchCat;
  });

  const stockBajo = articulos.filter((a) => a.stock <= (a.stock_minimo ?? 3));
  const valorInventario = articulos.reduce((s, a) => s + a.stock * (a.precio_costo || 0), 0);
  const categorias = [...new Set(articulos.map((a) => a.categoria).filter(Boolean))];

  const openModal = (art?: Articulo) => {
    setEditing(art || null);
    form.setFieldsValue(art ? { ...art } : { activo: true, stock: 0, stock_minimo: 3 });
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
              <Form.Item name="referencia" label="Referencia / SKU">
                <Input placeholder="SKU-001" prefix={<BarcodeOutlined />} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="categoria" label="Categoría">
                <Select
                  showSearch allowClear
                  placeholder="Seleccionar categoría"
                  options={CATEGORIAS_DEFAULT.map((c) => ({ label: c, value: c }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
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
