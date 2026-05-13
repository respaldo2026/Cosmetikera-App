"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Card, Tabs, Typography, Space, Button, Spin, Row, Col,
  Statistic, Tag, Table, Avatar, Empty, Form, Input,
  InputNumber, Badge, Descriptions, App, Switch, Select,
} from "antd";
import {
  ArrowLeftOutlined, TagsOutlined, ShoppingOutlined,
  UserOutlined, GiftOutlined, HistoryOutlined, EditOutlined,
  SaveOutlined, ShopOutlined, BarcodeOutlined, CameraOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";
import Link from "next/link";
import EscanerCodigo from "@/components/EscanerCodigo";
import { getCatalogosArticulosLocal, mergeCatalogos, type CatalogosArticulos } from "@/utils/articulos-catalogos";

const { Title, Text } = Typography;

/** Normaliza campos que pueden estar guardados como string-array ej: ["OPI"] → "OPI" */
const normalizeTagField = (v: unknown): string | undefined => {
  if (!v) return undefined;
  if (Array.isArray(v)) return (v[0] as string) || undefined;
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("[")) {
      try { const p = JSON.parse(t); return Array.isArray(p) ? ((p[0] as string) || undefined) : (t || undefined); } catch { /* ignore */ }
    }
    return t || undefined;
  }
  return undefined;
};

type Articulo = {
  id: string;
  nombre: string;
  codigo_barras?: string;
  referencia?: string;
  codigo_secundario?: string;
  categoria?: string;
  precio_venta: number;
  precio_costo?: number;
  stock: number;
  stock_minimo?: number;
  marca?: string;
  descripcion?: string;
  proveedor?: string;
  activo?: boolean;
  imagen_url?: string;
  descuento_porcentaje?: number;
  promocion_texto?: string;
};

const extractCatalogosFromTicketCampos = (raw: unknown): CatalogosArticulos => {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const catalogos = source.catalogos_articulos;
  if (!catalogos || typeof catalogos !== "object") {
    return { categorias: [], marcas: [], fabricantes: [] };
  }

  return mergeCatalogos(catalogos as Partial<CatalogosArticulos>);
};

type VentaHistorial = {
  id: string;
  fecha: string;
  total: number;
  metodo_pago: string;
  cliente_id?: string;
  cliente_nombre?: string;
  cantidad: number;
  subtotal: number;
};

export default function ArticuloDetallePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const id = params.id as string;
  const backQueryParams = new URLSearchParams(searchParams.toString());
  backQueryParams.delete("edit");
  const backQueryStr = backQueryParams.toString();
  const backToListHref = backQueryStr ? `/articulos?${backQueryStr}` : "/articulos";
  const startInEditMode = searchParams.get("edit") === "1";

  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState<VentaHistorial[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [editandoPromo, setEditandoPromo] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);
  const [editandoFicha, setEditandoFicha] = useState(startInEditMode);
  const [savingFicha, setSavingFicha] = useState(false);
  const [formPromo] = Form.useForm();
  const [formFicha] = Form.useForm();
  const codigoBarrasValue = Form.useWatch("codigo_barras", formFicha);
  const [catalogosCustom, setCatalogosCustom] = useState<CatalogosArticulos>({
    categorias: [],
    marcas: [],
    fabricantes: [],
  });

  const cargarArticulo = useCallback(async () => {
    const { data, error } = await supabaseBrowserClient
      .from("articulos")
      .select("*")
      .eq("id", id)
      .single();
    if (!error && data) {
      const art: Articulo = {
        ...(data as Articulo),
        categoria: normalizeTagField((data as Articulo).categoria),
        marca: normalizeTagField((data as Articulo).marca),
        proveedor: normalizeTagField((data as Articulo).proveedor),
      };
      setArticulo(art);
      formFicha.setFieldsValue({
        ...art,
        categoria: art.categoria ? [art.categoria] : undefined,
        marca: art.marca ? [art.marca] : undefined,
        proveedor: art.proveedor ? [art.proveedor] : undefined,
      });
    }
    setLoading(false);
  }, [formFicha, id]);

  const cargarVentas = useCallback(async () => {
    setLoadingVentas(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("ventas")
        .select("id, fecha, total, metodo_pago, cliente_id, items, perfiles:cliente_id(nombre_completo)")
        .order("fecha", { ascending: false })
        .limit(500);

      if (error) throw error;

      const ventasFiltradas: VentaHistorial[] = [];
      for (const v of (data || [])) {
        const items = Array.isArray(v.items) ? v.items : [];
        const item = items.find((i: any) => i.id === id);
        if (item) {
          ventasFiltradas.push({
            id: v.id,
            fecha: v.fecha,
            total: v.total,
            metodo_pago: v.metodo_pago,
            cliente_id: v.cliente_id,
            cliente_nombre: (v.perfiles as any)?.nombre_completo || "Sin cliente",
            cantidad: item.cantidad,
            subtotal: item.subtotal,
          });
        }
      }
      setVentas(ventasFiltradas);
    } catch {
      // sin ventas
    } finally {
      setLoadingVentas(false);
    }
  }, [id]);

  const cargarCatalogosCompartidos = useCallback(async () => {
    const localCatalogos = getCatalogosArticulosLocal();

    try {
      const { data, error } = await supabaseBrowserClient
        .from("configuracion")
        .select("ticket_campos")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      const supabaseCatalogos = extractCatalogosFromTicketCampos(data?.ticket_campos);
      setCatalogosCustom(mergeCatalogos(localCatalogos, supabaseCatalogos));
    } catch (error) {
      console.error("No se pudieron cargar catalogos compartidos:", error);
      setCatalogosCustom(localCatalogos);
    }
  }, []);

  useEffect(() => {
    cargarArticulo();
    cargarVentas();
    void cargarCatalogosCompartidos();
  }, [cargarArticulo, cargarVentas, cargarCatalogosCompartidos]);

  // Auto-generar codigo_secundario = últimos 6 dígitos del codigo_barras
  useEffect(() => {
    if (!editandoFicha) return;
    const barras = String(codigoBarrasValue || "").trim();
    const generado = barras.length >= 1 ? barras.slice(-6) : "";
    formFicha.setFieldValue("codigo_secundario", generado || undefined);
  }, [codigoBarrasValue, editandoFicha, formFicha]);

  const catalogosDisponibles = useMemo(
    () => mergeCatalogos(
      catalogosCustom,
      {
        categorias: articulo?.categoria ? [articulo.categoria] : [],
        marcas: articulo?.marca ? [articulo.marca] : [],
        fabricantes: articulo?.proveedor ? [articulo.proveedor] : [],
      },
    ),
    [catalogosCustom, articulo?.categoria, articulo?.marca, articulo?.proveedor],
  );

  const guardarPromocion = async () => {
    const values = formPromo.getFieldsValue();
    setSavingPromo(true);
    try {
      const { error } = await supabaseBrowserClient
        .from("articulos")
        .update({
          descuento_porcentaje: values.descuento_porcentaje || null,
          promocion_texto: values.promocion_texto || null,
        })
        .eq("id", id);
      if (error) throw error;
      message.success("Promoción guardada");
      setEditandoPromo(false);
      cargarArticulo();
    } catch (e: any) {
      message.error(e?.message || "Error al guardar la promoción");
    } finally {
      setSavingPromo(false);
    }
  };

  const guardarFicha = async () => {
    const values = await formFicha.validateFields();
    setSavingFicha(true);
    try {
      const { error } = await supabaseBrowserClient
        .from("articulos")
        .update({
          ...values,
          referencia: values.referencia || null,
          codigo_secundario: values.codigo_secundario || null,
          categoria: Array.isArray(values.categoria) ? (values.categoria[0] || null) : (values.categoria || null),
          marca: Array.isArray(values.marca) ? (values.marca[0] || null) : (values.marca || null),
          proveedor: Array.isArray(values.proveedor) ? (values.proveedor[0] || null) : (values.proveedor || null),
          precio_costo: values.precio_costo ?? null,
          stock_minimo: values.stock_minimo ?? null,
          descripcion: values.descripcion || null,
          imagen_url: values.imagen_url || null,
        })
        .eq("id", id);

      if (error) throw error;

      message.success("Ficha del artículo actualizada");
      setEditandoFicha(false);
      cargarArticulo();
    } catch (error) {
      message.error((error instanceof Error ? error.message : "Error al guardar el artículo"));
    } finally {
      setSavingFicha(false);
    }
  };

  const getStockColor = (art: Articulo) => {
    if (art.stock === 0) return "#ff4d4f";
    if (art.stock <= (art.stock_minimo ?? 3)) return "#fa8c16";
    return "#52c41a";
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!articulo) {
    return (
      <Empty description="Artículo no encontrado">
        <Button onClick={() => router.push(backToListHref)}>Volver</Button>
      </Empty>
    );
  }

  const precioConDescuento = articulo.descuento_porcentaje
    ? articulo.precio_venta * (1 - articulo.descuento_porcentaje / 100)
    : null;

  const totalVendido = ventas.reduce((s, v) => s + v.cantidad, 0);
  const totalIngresos = ventas.reduce((s, v) => s + v.subtotal, 0);

  const clientesUnicos = ventas
    .filter((v) => v.cliente_id)
    .reduce(
      (acc, v) => {
        const existing = acc.find((c) => c.cliente_id === v.cliente_id);
        if (existing) {
          existing.totalCompras += v.subtotal;
          existing.numCompras += 1;
        } else {
          acc.push({
            cliente_id: v.cliente_id!,
            nombre: v.cliente_nombre!,
            totalCompras: v.subtotal,
            numCompras: 1,
            ultimaCompra: v.fecha,
          });
        }
        return acc;
      },
      [] as Array<{
        cliente_id: string;
        nombre: string;
        totalCompras: number;
        numCompras: number;
        ultimaCompra: string;
      }>
    )
    .sort((a, b) => b.totalCompras - a.totalCompras);

  return (
    <>
      {/* Header */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }} bodyStyle={{ padding: "12px 16px" }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
              Volver
            </Button>
          </Col>
          <Col flex="auto">
            <Space align="center">
              <div style={{
                width: 48, height: 48, borderRadius: 10,
                background: "linear-gradient(135deg,#d81b87,#9c27b0)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", flexShrink: 0,
              }}>
                {articulo.imagen_url
                  ? <img src={articulo.imagen_url} alt={articulo.nombre} style={{ width: 48, height: 48, objectFit: "cover" }} />
                  : <ShopOutlined style={{ color: "#fff", fontSize: 22 }} />
                }
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>{articulo.nombre}</Title>
                <Space size={4}>
                  {articulo.categoria && <Tag color="purple">{articulo.categoria}</Tag>}
                  {articulo.marca && <Text type="secondary" style={{ fontSize: 12 }}>{articulo.marca}</Text>}
                  {articulo.activo === false && <Tag color="error">Inactivo</Tag>}
                  {articulo.descuento_porcentaje ? (
                    <Tag color="red">🔥 {articulo.descuento_porcentaje}% OFF</Tag>
                  ) : null}
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={editandoFicha ? <SaveOutlined /> : <EditOutlined />}
              loading={savingFicha}
              onClick={() => {
                if (editandoFicha) {
                  guardarFicha();
                  return;
                }
                formFicha.setFieldsValue({
                  ...articulo,
                  categoria: articulo.categoria ? [articulo.categoria] : undefined,
                  marca: articulo.marca ? [articulo.marca] : undefined,
                  proveedor: articulo.proveedor ? [articulo.proveedor] : undefined,
                });
                setEditandoFicha(true);
              }}
              style={{ background: "linear-gradient(90deg,#d81b87,#9c27b0)" }}
            >
              {editandoFicha ? "Guardar cambios" : "Editar artículo"}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Precio venta"
              value={precioConDescuento ?? articulo.precio_venta}
              prefix="$"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: "#d81b87" }}
            />
            {precioConDescuento && (
              <Text type="secondary" style={{ fontSize: 11, textDecoration: "line-through" }}>
                ${Number(articulo.precio_venta).toLocaleString()}
              </Text>
            )}
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Stock actual"
              value={articulo.stock}
              valueStyle={{ color: getStockColor(articulo) }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              Mín: {articulo.stock_minimo ?? 3}
            </Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Unidades vendidas"
              value={totalVendido}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic
              title="Ingresos generados"
              value={totalIngresos}
              prefix="$"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card style={{ borderRadius: 12 }}>
        <Tabs
          defaultActiveKey="ficha"
          items={[
            {
              key: "ficha",
              label: <Space><TagsOutlined />Ficha</Space>,
              children: (
                editandoFicha ? (
                  <Form form={formFicha} layout="vertical">
                    <Row gutter={16}>
                      <Col xs={24} md={16}>
                        <Form.Item name="nombre" label="Nombre del artículo" rules={[{ required: true, message: "Requerido" }]}>
                          <Input placeholder="Ej: Esmalte Base Coat 15ml" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="codigo_barras" label="Código de barras (principal)">
                          <EscanerCodigo
                            value={codigoBarrasValue}
                            onChange={(value) => formFicha.setFieldValue("codigo_barras", value)}
                            onCodigo={(codigo) => formFicha.setFieldValue("codigo_barras", codigo)}
                            placeholder="Escanear o escribir código"
                            conCamara
                            submitOnEnter={false}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Form.Item
                          name="codigo_secundario"
                          label="Código corto QR (auto)"
                          tooltip="Se genera automáticamente con los últimos 6 dígitos del código de barras. Es el código que aparece en el QR de la etiqueta."
                        >
                          <Input
                            readOnly
                            disabled
                            prefix={<BarcodeOutlined />}
                            placeholder="Se genera del código de barras"
                            style={{ background: "#f5f5f5", cursor: "default" }}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="categoria" label="Categoría">
                          <Select
                            showSearch
                            allowClear
                            mode="tags"
                            maxCount={1}
                            placeholder="Seleccionar o escribir..."
                            options={catalogosDisponibles.categorias.map((c) => ({ label: c, value: c }))}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Form.Item name="marca" label="Marca">
                          <Select
                            showSearch
                            allowClear
                            mode="tags"
                            maxCount={1}
                            placeholder="Seleccionar o escribir..."
                            options={catalogosDisponibles.marcas.map((m) => ({ label: m, value: m }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="proveedor" label="Fabricante">
                          <Select
                            showSearch
                            allowClear
                            mode="tags"
                            maxCount={1}
                            placeholder="Seleccionar o escribir..."
                            options={catalogosDisponibles.fabricantes.map((f) => ({ label: f, value: f }))}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Form.Item name="precio_venta" label="Precio de venta" rules={[{ required: true, message: "Requerido" }]}>
                          <InputNumber min={0} style={{ width: "100%" }} addonBefore="$" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="precio_costo" label="Precio de costo">
                          <InputNumber min={0} style={{ width: "100%" }} addonBefore="$" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="stock" label="Stock actual" rules={[{ required: true, message: "Requerido" }]}>
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Form.Item name="stock_minimo" label="Stock mínimo">
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="imagen_url" label="URL imagen">
                          <Input placeholder="https://..." prefix={<CameraOutlined />} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={4}>
                        <Form.Item name="activo" label="Activo" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="descripcion" label="Descripción">
                      <Input.TextArea rows={3} placeholder="Notas del producto..." />
                    </Form.Item>
                    <Space>
                      <Button type="primary" icon={<SaveOutlined />} loading={savingFicha} onClick={guardarFicha} style={{ background: "linear-gradient(90deg,#d81b87,#9c27b0)" }}>
                        Guardar cambios
                      </Button>
                      <Button onClick={() => { formFicha.setFieldsValue({ ...articulo, categoria: articulo.categoria ? [articulo.categoria] : undefined, marca: articulo.marca ? [articulo.marca] : undefined, proveedor: articulo.proveedor ? [articulo.proveedor] : undefined }); setEditandoFicha(false); }}>
                        Cancelar
                      </Button>
                    </Space>
                  </Form>
                ) : (
                  <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                    <Descriptions.Item label="Nombre">{articulo.nombre}</Descriptions.Item>
                    <Descriptions.Item label="Código de barras (principal)">
                      {articulo.codigo_barras
                        ? <Tag color="blue">{articulo.codigo_barras}</Tag>
                        : <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Código corto QR">
                      {articulo.codigo_secundario
                        ? <Tag color="geekblue">{articulo.codigo_secundario}</Tag>
                        : <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Categoría">
                      {articulo.categoria ? <Tag color="purple">{articulo.categoria}</Tag> : <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Marca">
                      {articulo.marca || <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Fabricante">
                      {articulo.proveedor || <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Precio de venta">
                      <Text strong style={{ color: "#d81b87" }}>
                        ${Number(articulo.precio_venta).toLocaleString()}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Precio de costo">
                      {articulo.precio_costo
                        ? `$${Number(articulo.precio_costo).toLocaleString()}`
                        : <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Margen de ganancia">
                      {articulo.precio_costo && articulo.precio_costo > 0 ? (
                        <Tag color="blue">
                          {(((articulo.precio_venta - articulo.precio_costo) / articulo.precio_costo) * 100).toFixed(1)}%
                        </Tag>
                      ) : <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Estado">
                      {articulo.activo !== false
                        ? <Tag color="success">Activo</Tag>
                        : <Tag color="error">Inactivo</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Stock actual">
                      <Space>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: getStockColor(articulo) }} />
                        <Text strong>{articulo.stock} unidades</Text>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Stock mínimo">
                      {articulo.stock_minimo ?? 3} unidades
                    </Descriptions.Item>
                    {articulo.descripcion && (
                      <Descriptions.Item label="Descripción" span={2}>
                        {articulo.descripcion}
                      </Descriptions.Item>
                    )}
                    {articulo.imagen_url && (
                      <Descriptions.Item label="Imagen" span={2}>
                        <img
                          src={articulo.imagen_url}
                          alt={articulo.nombre}
                          style={{ maxHeight: 140, borderRadius: 8, objectFit: "cover" }}
                        />
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                )
              ),
            },
            {
              key: "historial",
              label: (
                <Space>
                  <HistoryOutlined />
                  Historial
                  {ventas.length > 0 && (
                    <Badge count={ventas.length} style={{ backgroundColor: "#d81b87" }} />
                  )}
                </Space>
              ),
              children: (
                <Table
                  loading={loadingVentas}
                  dataSource={ventas}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  locale={{ emptyText: <Empty description="Sin ventas registradas para este artículo" /> }}
                  columns={[
                    {
                      title: "Fecha",
                      dataIndex: "fecha",
                      render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm"),
                      sorter: (a, b) => dayjs(a.fecha).unix() - dayjs(b.fecha).unix(),
                      defaultSortOrder: "descend",
                    },
                    {
                      title: "Cliente",
                      dataIndex: "cliente_nombre",
                      render: (v, r) => (
                        <Space>
                          <Avatar size="small" icon={<UserOutlined />} style={{ background: "#9c27b0" }} />
                          {r.cliente_id
                            ? <Link href={`/perfiles/${r.cliente_id}`}>{v}</Link>
                            : <Text type="secondary">Sin cliente</Text>}
                        </Space>
                      ),
                    },
                    {
                      title: "Cantidad",
                      dataIndex: "cantidad",
                      render: (v) => <Tag color="blue">{v} ud.</Tag>,
                    },
                    {
                      title: "Subtotal",
                      dataIndex: "subtotal",
                      render: (v) => <Text strong style={{ color: "#52c41a" }}>${Number(v).toLocaleString()}</Text>,
                    },
                    {
                      title: "Método pago",
                      dataIndex: "metodo_pago",
                      render: (v) => <Tag>{(v || "").split("|")[0]}</Tag>,
                    },
                  ]}
                  summary={() => ventas.length > 0 ? (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <Text strong>Total</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>
                        <Tag color="blue">{totalVendido} uds.</Tag>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>
                        <Text strong style={{ color: "#52c41a" }}>${totalIngresos.toLocaleString()}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} />
                    </Table.Summary.Row>
                  ) : null}
                />
              ),
            },
            {
              key: "clientes",
              label: (
                <Space>
                  <UserOutlined />
                  Clientes
                  {clientesUnicos.length > 0 && (
                    <Badge count={clientesUnicos.length} style={{ backgroundColor: "#722ed1" }} />
                  )}
                </Space>
              ),
              children: clientesUnicos.length === 0 ? (
                <Empty description="Aún no hay clientes registrados para este artículo" style={{ padding: 40 }} />
              ) : (
                <Table
                  dataSource={clientesUnicos}
                  rowKey="cliente_id"
                  size="small"
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  columns={[
                    {
                      title: "Cliente",
                      dataIndex: "nombre",
                      render: (v, r) => (
                        <Space>
                          <Avatar icon={<UserOutlined />} style={{ background: "#9c27b0" }} />
                          <Link href={`/perfiles/${r.cliente_id}`}>{v}</Link>
                        </Space>
                      ),
                    },
                    {
                      title: "Compras",
                      dataIndex: "numCompras",
                      render: (v) => <Tag color="blue">{v} {v === 1 ? "vez" : "veces"}</Tag>,
                      sorter: (a, b) => a.numCompras - b.numCompras,
                    },
                    {
                      title: "Total gastado",
                      dataIndex: "totalCompras",
                      render: (v) => <Text strong>${Number(v).toLocaleString()}</Text>,
                      sorter: (a, b) => a.totalCompras - b.totalCompras,
                      defaultSortOrder: "descend",
                    },
                    {
                      title: "Última compra",
                      dataIndex: "ultimaCompra",
                      render: (v) => dayjs(v).format("DD/MM/YYYY"),
                    },
                  ]}
                />
              ),
            },
            {
              key: "ofertas",
              label: <Space><GiftOutlined />Ofertas</Space>,
              children: (
                <div style={{ maxWidth: 520 }}>
                  <Card
                    style={{ borderRadius: 12, background: "linear-gradient(135deg,#fce4f8,#f0d6ff)", marginBottom: 16 }}
                    bodyStyle={{ padding: 20 }}
                  >
                    <Space direction="vertical" style={{ width: "100%" }} size="middle">
                      <div>
                        <Title level={5} style={{ margin: 0, color: "#d81b87" }}>
                          <GiftOutlined /> Promoción activa
                        </Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Configura un descuento o mensaje promocional para este artículo
                        </Text>
                      </div>

                      {!editandoPromo ? (
                        <>
                          {articulo.descuento_porcentaje ? (
                            <div>
                              <Tag color="error" style={{ fontSize: 15, padding: "5px 12px" }}>
                                🔥 {articulo.descuento_porcentaje}% DESCUENTO
                              </Tag>
                              <div style={{ marginTop: 8 }}>
                                <Text strong style={{ fontSize: 20, color: "#d81b87" }}>
                                  ${Number(precioConDescuento).toLocaleString()}
                                </Text>
                                <Text type="secondary" style={{ marginLeft: 10, textDecoration: "line-through", fontSize: 14 }}>
                                  ${Number(articulo.precio_venta).toLocaleString()}
                                </Text>
                              </div>
                              {articulo.promocion_texto && (
                                <Text style={{ display: "block", marginTop: 6, fontStyle: "italic", color: "#555" }}>
                                  "{articulo.promocion_texto}"
                                </Text>
                              )}
                            </div>
                          ) : (
                            <Empty
                              image={<GiftOutlined style={{ fontSize: 40, color: "#d9d9d9" }} />}
                              imageStyle={{ height: 50 }}
                              description="Sin promoción activa"
                            />
                          )}
                          <Button
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={() => {
                              formPromo.setFieldsValue({
                                descuento_porcentaje: articulo.descuento_porcentaje ?? undefined,
                                promocion_texto: articulo.promocion_texto ?? "",
                              });
                              setEditandoPromo(true);
                            }}
                            style={{ background: "linear-gradient(90deg,#d81b87,#9c27b0)" }}
                          >
                            {articulo.descuento_porcentaje ? "Modificar promoción" : "Agregar promoción"}
                          </Button>
                        </>
                      ) : (
                        <Form form={formPromo} layout="vertical">
                          <Form.Item
                            name="descuento_porcentaje"
                            label="Descuento (%)"
                            help="Déjalo vacío para quitar el descuento"
                          >
                            <InputNumber
                              min={0}
                              max={100}
                              style={{ width: "100%" }}
                              placeholder="Ej: 20 para un 20% de descuento"
                              addonAfter="%"
                            />
                          </Form.Item>
                          <Form.Item name="promocion_texto" label="Texto promocional (opcional)">
                            <Input placeholder="Ej: ¡Oferta por tiempo limitado!" maxLength={100} />
                          </Form.Item>
                          <Space>
                            <Button
                              type="primary"
                              icon={<SaveOutlined />}
                              loading={savingPromo}
                              onClick={guardarPromocion}
                              style={{ background: "linear-gradient(90deg,#d81b87,#9c27b0)" }}
                            >
                              Guardar
                            </Button>
                            <Button onClick={() => setEditandoPromo(false)}>
                              Cancelar
                            </Button>
                          </Space>
                        </Form>
                      )}
                    </Space>
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
