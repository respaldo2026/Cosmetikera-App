"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Card, Button, Typography, Space, Modal, Form, Input, InputNumber,
  Select, Tag, App, Spin, Row, Col, Statistic, Table, Empty,
  Grid, Tooltip, Avatar, DatePicker, Divider, Badge, Drawer,
  List, Alert,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, InboxOutlined,
  SearchOutlined, ReloadOutlined, TruckOutlined, CheckCircleOutlined,
  ClockCircleOutlined, WarningOutlined,
  BarcodeOutlined, ShoppingCartOutlined, MinusOutlined,
  PlusCircleOutlined, CheckOutlined, ExclamationCircleOutlined, PrinterOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { listLabelPrinters, printPriceLabels, type LabelPrinter } from "@utils/label-agent";
import dayjs from "dayjs";
import EscanerCodigo from "@components/EscanerCodigo";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// ── Tipos ──────────────────────────────────────────────────────────────────────
type CarritoItem = {
  articulo_id?: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  stock_actual?: number;
  codigo?: string;
};

type CompraItem = {
  articulo_id?: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
};

type Compra = {
  id: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  fecha: string;
  total: number;
  estado: "pendiente" | "recibida" | "parcial" | "cancelada";
  notas?: string;
  items?: CompraItem[];
};

type Articulo = {
  id: string;
  nombre: string;
  referencia?: string;
  codigo_barras?: string;
  precio_costo?: number;
  precio_venta?: number;
  stock: number;
  categoria?: string;
  marca?: string;
};

type LabelDraftItem = {
  key: string;
  articuloId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  dataMatrix: string;
  sku: string;
};

type CompraEstado = Compra["estado"];

const ESTADO_CONFIG: Record<CompraEstado, { color: string; label: string; icon: React.ReactNode }> = {
  pendiente: { color: "gold", label: "Pendiente", icon: <ClockCircleOutlined /> },
  recibida: { color: "green", label: "Recibida", icon: <CheckCircleOutlined /> },
  parcial: { color: "orange", label: "Parcial", icon: <WarningOutlined /> },
  cancelada: { color: "red", label: "Cancelada", icon: <DeleteOutlined /> },
};

const LABEL_PRINTER_STORAGE_KEY = "pos_label_printer_name_v1";

export default function ComprasPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { message, modal } = App.useApp();

  // — Datos globales —
  const [compras, setCompras]         = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
  const [articulos, setArticulos]     = useState<Articulo[]>([]);
  const [loading, setLoading]         = useState(true);

  // — Filtros lista —
  const [search, setSearch]           = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);

  // — Drawer nueva compra —
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [realizando, setRealizando]   = useState(false);

  // — Carrito de la compra actual —
  const [carrito, setCarrito]         = useState<CarritoItem[]>([]);
  const [proveedorId, setProveedorId] = useState<string | undefined>();
  const [notasCompra, setNotasCompra] = useState("");
  const [fechaCompra, setFechaCompra] = useState<dayjs.Dayjs>(dayjs());

  // — Búsqueda de artículos —
  const [scanQuery, setScanQuery]     = useState("");
  const [resultados, setResultados]   = useState<Articulo[]>([]);
  const searchTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  // — Modal crear artículo rápido —
  const [crearForm] = Form.useForm();
  const [crearModalOpen, setCrearModalOpen]     = useState(false);
  const [codigoParaCrear, setCodigoParaCrear]   = useState("");
  const [guardandoArticulo, setGuardandoArticulo] = useState(false);

  // — Modal editar compra histórica —
  const [editForm] = Form.useForm();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editando, setEditando]           = useState<Compra | null>(null);
  const [editItems, setEditItems]         = useState<CompraItem[]>([]);
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // — Modal impresión de etiquetas al finalizar compra —
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelPrinters, setLabelPrinters] = useState<LabelPrinter[]>([]);
  const [selectedLabelPrinter, setSelectedLabelPrinter] = useState<string | null>(null);
  const [loadingLabelPrinters, setLoadingLabelPrinters] = useState(false);
  const [printingLabels, setPrintingLabels] = useState(false);
  const [labelDraftItems, setLabelDraftItems] = useState<LabelDraftItem[]>([]);

  const actualizarImpresoraEtiquetas = useCallback((value: string | null) => {
    const normalized = String(value || "").trim();
    const finalValue = normalized || null;
    setSelectedLabelPrinter(finalValue);
    if (typeof window !== "undefined") {
      if (finalValue) {
        window.localStorage.setItem(LABEL_PRINTER_STORAGE_KEY, finalValue);
      } else {
        window.localStorage.removeItem(LABEL_PRINTER_STORAGE_KEY);
      }
    }
  }, []);

  // ── Carga inicial ─────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: p }, { data: a }] = await Promise.all([
      supabaseBrowserClient.from("compras").select("*").order("fecha", { ascending: false }),
      supabaseBrowserClient.from("proveedores").select("id,nombre").order("nombre"),
      supabaseBrowserClient.from("articulos")
        .select("id,nombre,referencia,codigo_barras,precio_costo,precio_venta,stock,categoria,marca")
        .order("nombre"),
    ]);
    setCompras(c || []);
    setProveedores(p || []);
    setArticulos(a || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const totalEtiquetasDraft = useMemo(
    () => labelDraftItems.reduce((acc, item) => acc + Number(item.cantidad || 0), 0),
    [labelDraftItems]
  );

  const cargarImpresorasEtiquetas = useCallback(async () => {
    setLoadingLabelPrinters(true);
    try {
      const printers = await listLabelPrinters();
      setLabelPrinters(printers);

      if (typeof window !== "undefined") {
        const preferred = window.localStorage.getItem(LABEL_PRINTER_STORAGE_KEY);
        const preferredExists = preferred && printers.some((p) => p.name === preferred);

        if (preferredExists) {
          actualizarImpresoraEtiquetas(preferred);
        } else {
          const defaultPrinter = printers.find((p) => p.isDefault)?.name ?? printers[0]?.name ?? null;
          actualizarImpresoraEtiquetas(defaultPrinter);
        }
      }
    } catch (error: any) {
      const preferred = typeof window !== "undefined" ? window.localStorage.getItem(LABEL_PRINTER_STORAGE_KEY) : null;
      if (preferred) {
        actualizarImpresoraEtiquetas(preferred);
      }
      message.warning(error?.message
        ? `No se pudieron cargar las impresoras (${error.message}). Puedes escribirla manualmente.`
        : "No se pudieron cargar las impresoras. Puedes escribirla manualmente.");
      setLabelPrinters(preferred ? [{ name: preferred, isDefault: true }] : []);
    } finally {
      setLoadingLabelPrinters(false);
    }
  }, [actualizarImpresoraEtiquetas, message]);

  const abrirModalImpresionEtiquetas = useCallback(async (items: LabelDraftItem[]) => {
    setLabelDraftItems(items);
    setLabelModalOpen(true);
    await cargarImpresorasEtiquetas();
  }, [cargarImpresorasEtiquetas]);

  const imprimirEtiquetasCompra = useCallback(async () => {
    const printerName = String(selectedLabelPrinter || "").trim();
    if (!printerName) {
      message.warning("Selecciona una impresora de etiquetas");
      return;
    }

    const itemsToPrint = labelDraftItems
      .map((item) => ({
        name: item.nombre,
        price: item.precio,
        quantity: Math.max(0, Number(item.cantidad || 0)),
        dataMatrix: item.dataMatrix,
        sku: item.sku,
      }))
      .filter((item) => item.quantity > 0);

    if (!itemsToPrint.length) {
      message.warning("No hay etiquetas para imprimir");
      return;
    }

    setPrintingLabels(true);
    try {
      const result = await printPriceLabels(itemsToPrint, printerName, "La Cosmetikera");
      actualizarImpresoraEtiquetas(printerName);
      message.success(`Etiquetas enviadas: ${result.totalLabels} (${result.pages} fila(s))`);
      setLabelModalOpen(false);
      setLabelDraftItems([]);
    } catch (error: any) {
      message.error(error?.message || "No fue posible imprimir etiquetas");
    } finally {
      setPrintingLabels(false);
    }
  }, [actualizarImpresoraEtiquetas, labelDraftItems, message, selectedLabelPrinter]);

  // ── Filtrado lista ────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => compras.filter((c) => {
    const matchSearch = !search ||
      (c.proveedor_nombre || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.notas || "").toLowerCase().includes(search.toLowerCase());
    const matchEstado = !filtroEstado || c.estado === filtroEstado;
    return matchSearch && matchEstado;
  }), [compras, search, filtroEstado]);

  const totalGastado = useMemo(() =>
    compras.filter(c => c.estado === "recibida").reduce((s, c) => s + Number(c.total || 0), 0),
    [compras]
  );
  const pendientes = compras.filter(c => c.estado === "pendiente").length;

  // ── Carrito helpers ───────────────────────────────────────────────────────────
  const totalCarrito = useMemo(() =>
    carrito.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0),
    [carrito]
  );

  const agregarAlCarrito = useCallback((art: Articulo) => {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.articulo_id === art.id);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, {
        articulo_id: art.id,
        nombre: art.nombre,
        cantidad: 1,
        precio_unitario: art.precio_costo ?? 0,
        stock_actual: art.stock,
        codigo: art.referencia || art.codigo_barras || "",
      }];
    });
    setScanQuery("");
    setResultados([]);
    message.success(`\u2713 ${art.nombre} agregado`);
  }, [message]);

  const actualizarCantidad = (idx: number, cantidad: number) => {
    if (cantidad <= 0) return;
    setCarrito(prev => prev.map((item, i) => i === idx ? { ...item, cantidad } : item));
  };

  const actualizarPrecio = (idx: number, precio: number) => {
    setCarrito(prev => prev.map((item, i) => i === idx ? { ...item, precio_unitario: precio } : item));
  };

  const quitarDelCarrito = (idx: number) => {
    setCarrito(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Búsqueda de artículos ─────────────────────────────────────────────────────
  const buscarArticulos = useCallback((query: string) => {
    if (!query.trim()) { setResultados([]); return; }
    const q = query.toLowerCase();
    const found = articulos.filter(a =>
      a.nombre.toLowerCase().includes(q) ||
      (a.referencia || "").toLowerCase().includes(q) ||
      (a.codigo_barras || "").toLowerCase().includes(q) ||
      (a.categoria || "").toLowerCase().includes(q) ||
      (a.marca || "").toLowerCase().includes(q)
    ).slice(0, 10);
    setResultados(found);
  }, [articulos]);

  const handleSearchChange = (val: string) => {
    setScanQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => buscarArticulos(val), 250);
  };

  const handleCodigo = useCallback((codigo: string) => {
    const normalizado = codigo.trim();
    const art = articulos.find(a =>
      (a.referencia || "").toLowerCase() === normalizado.toLowerCase() ||
      (a.codigo_barras || "").toLowerCase() === normalizado.toLowerCase()
    );
    if (art) {
      agregarAlCarrito(art);
    } else {
      const parciales = articulos.filter(a =>
        (a.referencia || "").toLowerCase().includes(normalizado.toLowerCase()) ||
        (a.codigo_barras || "").toLowerCase().includes(normalizado.toLowerCase())
      );
      if (parciales.length === 1 && parciales[0]) {
        agregarAlCarrito(parciales[0]);
      } else if (parciales.length > 1) {
        setScanQuery(normalizado);
        setResultados(parciales);
        message.info("Varios productos encontrados, elige uno");
      } else {
        setCodigoParaCrear(normalizado);
        crearForm.setFieldsValue({ referencia: normalizado });
        setCrearModalOpen(true);
      }
    }
  }, [articulos, agregarAlCarrito, crearForm, message]);

  // ── Crear artículo rápido ─────────────────────────────────────────────────────
  const handleCrearArticulo = async () => {
    const values = await crearForm.validateFields();
    setGuardandoArticulo(true);
    try {
      const res = await fetch("/api/articulos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articulo: { ...values, stock: 0 } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error creando articulo");
      const { data: newArt } = await supabaseBrowserClient
        .from("articulos")
        .select("id,nombre,referencia,codigo_barras,precio_costo,precio_venta,stock,categoria,marca")
        .eq("id", json.data[0].id)
        .single();
      if (newArt) {
        setArticulos(prev => [...prev, newArt as Articulo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        agregarAlCarrito(newArt as Articulo);
      }
      setCrearModalOpen(false);
      crearForm.resetFields();
      message.success("Articulo creado y agregado a la compra");
    } catch (e: any) {
      message.error(e?.message || "Error creando articulo");
    } finally {
      setGuardandoArticulo(false);
    }
  };

  // ── Realizar compra ───────────────────────────────────────────────────────────
  const handleRealizarCompra = async () => {
    if (carrito.length === 0) {
      message.warning("Agrega al menos un producto a la compra");
      return;
    }
    setRealizando(true);
    try {
      const prov = proveedores.find(p => p.id === proveedorId);
      const payload = {
        proveedor_id: proveedorId || null,
        proveedor_nombre: prov?.nombre || "",
        fecha: fechaCompra.format("YYYY-MM-DD"),
        total: totalCarrito,
        estado: "recibida" as CompraEstado,
        notas: notasCompra || null,
        items: carrito.map(i => ({
          articulo_id: i.articulo_id,
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
        })),
      };

      const { error: errCompra } = await supabaseBrowserClient
        .from("compras")
        .insert([payload]);
      if (errCompra) throw new Error(errCompra.message);

      const itemsConId = carrito.filter(i => i.articulo_id);
      const etiquetasDraft: LabelDraftItem[] = itemsConId.map((item) => {
        const art = articulos.find((a) => a.id === item.articulo_id);
        const precioVenta = Number(art?.precio_venta ?? item.precio_unitario ?? 0);
        const sku = String(art?.referencia || art?.codigo_barras || item.codigo || item.articulo_id || "");
        const dataMatrix = `LC|${item.articulo_id}|${precioVenta}`;

        return {
          key: `${item.articulo_id}`,
          articuloId: String(item.articulo_id),
          nombre: item.nombre,
          precio: precioVenta,
          cantidad: Number(item.cantidad || 0),
          dataMatrix,
          sku,
        };
      });

      for (const item of itemsConId) {
        const artActual = articulos.find(a => a.id === item.articulo_id);
        const nuevoStock = (artActual?.stock ?? 0) + item.cantidad;
        await fetch(`/api/articulos?id=${item.articulo_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stock: nuevoStock }),
        });
      }

      message.success(
        `Compra registrada — ${itemsConId.length} articulo(s) con stock actualizado`
      );
      setCarrito([]);
      setProveedorId(undefined);
      setNotasCompra("");
      setFechaCompra(dayjs());
      setDrawerOpen(false);
      if (etiquetasDraft.length > 0) {
        await abrirModalImpresionEtiquetas(etiquetasDraft);
      }
      cargar();
    } catch (e: any) {
      message.error(e?.message || "Error al registrar compra");
    } finally {
      setRealizando(false);
    }
  };

  // ── Editar compra histórica ───────────────────────────────────────────────────
  const abrirEdicion = (c: Compra) => {
    setEditando(c);
    editForm.setFieldsValue({ ...c, fecha: c.fecha ? dayjs(c.fecha) : null });
    setEditItems(c.items || [{ nombre: "", cantidad: 1, precio_unitario: 0 }]);
    setEditModalOpen(true);
  };

  const totalEditItems = editItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

  const handleGuardarEdicion = async () => {
    const values = await editForm.validateFields();
    if (editItems.some(i => !i.nombre)) {
      message.warning("Todos los items deben tener nombre"); return;
    }
    setGuardandoEdit(true);
    const prov = proveedores.find(p => p.id === values.proveedor_id);
    const payload = {
      ...values,
      fecha: values.fecha ? dayjs(values.fecha).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      proveedor_nombre: prov?.nombre || "",
      total: totalEditItems,
      items: editItems,
    };
    try {
      const { error } = await supabaseBrowserClient.from("compras").update(payload).eq("id", editando!.id);
      if (error) throw error;
      message.success("Compra actualizada");
      setEditModalOpen(false);
      cargar();
    } catch (e: any) {
      message.error(e?.message || "Error");
    } finally {
      setGuardandoEdit(false);
    }
  };

  const handleEliminar = (c: Compra) => {
    modal.confirm({
      title: "Eliminar orden de compra",
      content: "Confirmas eliminar esta compra?",
      okType: "danger", okText: "Eliminar", cancelText: "Cancelar",
      onOk: async () => {
        await supabaseBrowserClient.from("compras").delete().eq("id", c.id);
        message.success("Eliminada");
        cargar();
      },
    });
  };

  const cambiarEstado = async (c: Compra, estado: CompraEstado) => {
    await supabaseBrowserClient.from("compras").update({ estado }).eq("id", c.id);
    message.success(`Estado -> ${ESTADO_CONFIG[estado]?.label}`);
    cargar();
  };

  // ── Columnas tabla ────────────────────────────────────────────────────────────
  const columns = [
    {
      title: "Fecha",
      dataIndex: "fecha",
      key: "fecha",
      width: 110,
      render: (v: string) => <Text>{dayjs(v).format("DD/MM/YYYY")}</Text>,
    },
    {
      title: "Proveedor",
      dataIndex: "proveedor_nombre",
      key: "proveedor",
      render: (v: string) => (
        <Space>
          <Avatar size="small" style={{ background: "#722ed1" }} icon={<TruckOutlined />} />
          <Text strong>{v || "—"}</Text>
        </Space>
      ),
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (v: CompraEstado) => {
        const cfg = ESTADO_CONFIG[v] || ESTADO_CONFIG.pendiente;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (v: number) => <Text strong style={{ color: "#d81b87" }}>${Number(v).toLocaleString()}</Text>,
    },
    {
      title: "Items",
      dataIndex: "items",
      key: "items",
      render: (v: CompraItem[]) => <Tag>{(v || []).length} item(s)</Tag>,
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 160,
      render: (_: any, rec: Compra) => (
        <Space>
          {rec.estado === "pendiente" && (
            <Tooltip title="Marcar recibida">
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                onClick={() => cambiarEstado(rec, "recibida")} />
            </Tooltip>
          )}
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => abrirEdicion(rec)} />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleEliminar(rec)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* HEADER */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }} bodyStyle={{ padding: "12px 16px" }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Space>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "linear-gradient(135deg,#096dd9,#1890ff)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <InboxOutlined style={{ color: "#fff", fontSize: 22 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>Compras</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Ordenes de compra a proveedores</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
              <Button
                type="primary"
                icon={<ShoppingCartOutlined />}
                onClick={() => setDrawerOpen(true)}
                style={{ background: "linear-gradient(90deg,#096dd9,#1890ff)" }}
              >
                {isMobile ? "Nueva" : "Nueva compra"}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Total compras" value={compras.length} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Pendientes" value={pendientes}
              valueStyle={{ color: pendientes > 0 ? "#fa8c16" : "#52c41a" }}
              prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Recibidas" value={compras.filter(c => c.estado === "recibida").length}
              valueStyle={{ color: "#52c41a" }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
            <Statistic title="Total invertido" value={totalGastado} prefix="$"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: "#d81b87" }} />
          </Card>
        </Col>
      </Row>

      {/* FILTROS */}
      <Card style={{ marginBottom: 12, borderRadius: 10 }} bodyStyle={{ padding: "10px 14px" }}>
        <Row gutter={12}>
          <Col xs={24} sm={14}>
            <Input
              placeholder="Buscar por proveedor o notas..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={10}>
            <Select
              placeholder="Estado"
              allowClear
              style={{ width: "100%" }}
              value={filtroEstado}
              onChange={setFiltroEstado}
              options={Object.entries(ESTADO_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
          </Col>
        </Row>
      </Card>

      {/* TABLA */}
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
        ) : filtradas.length === 0 ? (
          <Empty description="No hay ordenes de compra" style={{ padding: 60 }}>
            <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => setDrawerOpen(true)}>
              Nueva compra
            </Button>
          </Empty>
        ) : (
          <Table dataSource={filtradas} columns={columns} rowKey="id"
            pagination={{ pageSize: 15 }} scroll={{ x: 600 }} />
        )}
      </Card>

      {/* ── DRAWER: Nueva compra con scanner ──────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <ShoppingCartOutlined style={{ color: "#096dd9" }} />
            <span>Nueva compra</span>
            {carrito.length > 0 && (
              <Badge count={carrito.length} style={{ background: "#096dd9" }} />
            )}
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={isMobile ? "100%" : 600}
        placement={isMobile ? "bottom" : "right"}
        height={isMobile ? "95vh" : undefined}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Text strong style={{ fontSize: 16 }}>
              Total: <span style={{ color: "#d81b87" }}>${totalCarrito.toLocaleString()}</span>
            </Text>
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>Cancelar</Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={realizando}
                disabled={carrito.length === 0}
                onClick={handleRealizarCompra}
                style={{ background: "linear-gradient(90deg,#096dd9,#1890ff)" }}
              >
                Realizar compra
              </Button>
            </Space>
          </div>
        }
        bodyStyle={{ padding: "16px", overflowY: "auto" }}
      >
        {/* Proveedor y fecha */}
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={14}>
            <Text strong style={{ display: "block", marginBottom: 4 }}>Proveedor</Text>
            <Select
              showSearch
              placeholder="Seleccionar proveedor"
              style={{ width: "100%" }}
              value={proveedorId}
              onChange={setProveedorId}
              allowClear
              filterOption={(input, opt) =>
                (opt?.label as string || "").toLowerCase().includes(input.toLowerCase())
              }
              options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
            />
          </Col>
          <Col span={10}>
            <Text strong style={{ display: "block", marginBottom: 4 }}>Fecha</Text>
            <DatePicker
              style={{ width: "100%" }}
              value={fechaCompra}
              onChange={(d) => d && setFechaCompra(d)}
              format="DD/MM/YYYY"
            />
          </Col>
        </Row>

        <Divider orientation="left" style={{ fontSize: 13, margin: "12px 0" }}>
          <BarcodeOutlined /> Agregar productos
        </Divider>

        {/* Scanner */}
        <div style={{ marginBottom: 12 }}>
          <EscanerCodigo
            onCodigo={handleCodigo}
            placeholder="Escanear codigo de barras..."
            conCamara
            submitOnEnter
          />
        </div>

        {/* Busqueda por nombre */}
        <Input
          placeholder="Buscar por nombre, marca, categoria..."
          prefix={<SearchOutlined />}
          value={scanQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          allowClear
          onClear={() => { setScanQuery(""); setResultados([]); }}
          style={{ marginBottom: 8 }}
        />

        {/* Resultados de busqueda */}
        {resultados.length > 0 && (
          <Card
            size="small"
            style={{ marginBottom: 12, borderRadius: 8, maxHeight: 240, overflowY: "auto" }}
            bodyStyle={{ padding: 0 }}
          >
            <List
              size="small"
              dataSource={resultados}
              renderItem={(art) => (
                <List.Item
                  style={{ padding: "8px 12px", cursor: "pointer" }}
                  onClick={() => agregarAlCarrito(art)}
                  actions={[
                    <Button
                      key="add"
                      size="small"
                      type="primary"
                      icon={<PlusCircleOutlined />}
                      onClick={(e) => { e.stopPropagation(); agregarAlCarrito(art); }}
                    >
                      Agregar
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={<Text strong style={{ fontSize: 13 }}>{art.nombre}</Text>}
                    description={
                      <Space size={4} wrap>
                        {art.referencia && <Tag style={{ fontSize: 11 }}>{art.referencia}</Tag>}
                        {art.marca && <Text type="secondary" style={{ fontSize: 11 }}>{art.marca}</Text>}
                        <Text style={{ fontSize: 11, color: "#52c41a" }}>Stock: {art.stock}</Text>
                        {art.precio_costo != null && (
                          <Text style={{ fontSize: 11, color: "#096dd9" }}>
                            Costo: ${art.precio_costo.toLocaleString()}
                          </Text>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
            <div
              style={{
                padding: "8px 12px", cursor: "pointer", borderTop: "1px solid #f0f0f0",
                background: "#fafafa", display: "flex", alignItems: "center", gap: 8,
              }}
              onClick={() => {
                setCodigoParaCrear(scanQuery);
                crearForm.setFieldsValue({ nombre: scanQuery });
                setCrearModalOpen(true);
              }}
            >
              <PlusOutlined style={{ color: "#096dd9" }} />
              <Text style={{ color: "#096dd9", fontSize: 12 }}>
                No es ninguno - Crear nuevo articulo
              </Text>
            </div>
          </Card>
        )}

        {/* Boton crear si sin resultados */}
        {scanQuery.trim() && resultados.length === 0 && (
          <Alert
            message={
              <Space>
                <ExclamationCircleOutlined />
                <Text style={{ fontSize: 13 }}>Articulo no encontrado</Text>
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setCodigoParaCrear(scanQuery);
                    crearForm.setFieldsValue({ nombre: scanQuery });
                    setCrearModalOpen(true);
                  }}
                >
                  Crear articulo
                </Button>
              </Space>
            }
            type="warning"
            style={{ marginBottom: 12 }}
          />
        )}

        <Divider orientation="left" style={{ fontSize: 13, margin: "12px 0" }}>
          <ShoppingCartOutlined /> Carrito ({carrito.length})
        </Divider>

        {/* Carrito */}
        {carrito.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Escanea o busca productos para agregar"
            style={{ padding: "20px 0" }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {carrito.map((item, idx) => (
              <Card
                key={idx}
                size="small"
                style={{ borderRadius: 8, border: "1px solid #e8f4ff", background: "#f8fbff" }}
                bodyStyle={{ padding: "10px 12px" }}
              >
                <Row gutter={8} align="middle">
                  <Col flex="auto">
                    <Text strong style={{ fontSize: 13, display: "block" }}>{item.nombre}</Text>
                    {item.articulo_id ? (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Stock actual: {item.stock_actual ?? "—"}
                        {item.codigo ? ` - ${item.codigo}` : ""}
                      </Text>
                    ) : (
                      <Tag color="orange" style={{ fontSize: 10 }}>Sin vincular</Tag>
                    )}
                  </Col>
                  <Col>
                    <Space size={4} align="center">
                      <Button
                        size="small"
                        icon={<MinusOutlined />}
                        onClick={() => actualizarCantidad(idx, item.cantidad - 1)}
                        disabled={item.cantidad <= 1}
                      />
                      <InputNumber
                        size="small"
                        min={1}
                        value={item.cantidad}
                        onChange={(v) => actualizarCantidad(idx, v || 1)}
                        style={{ width: 54 }}
                      />
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => actualizarCantidad(idx, item.cantidad + 1)}
                      />
                    </Space>
                  </Col>
                  <Col>
                    <InputNumber
                      size="small"
                      min={0}
                      value={item.precio_unitario}
                      onChange={(v) => actualizarPrecio(idx, v ?? 0)}
                      formatter={(v) => `$${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                      parser={(v) => Number((v || "0").replace(/\$\s?|(,*)/g, ""))}
                      style={{ width: 90 }}
                      placeholder="$ Costo"
                    />
                  </Col>
                  <Col>
                    <Text style={{ fontSize: 12, color: "#d81b87", width: 70, display: "inline-block", textAlign: "right" }}>
                      ${(item.cantidad * item.precio_unitario).toLocaleString()}
                    </Text>
                  </Col>
                  <Col>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => quitarDelCarrito(idx)}
                    />
                  </Col>
                </Row>
              </Card>
            ))}
          </div>
        )}

        {carrito.length > 0 && (
          <>
            <Divider style={{ margin: "12px 0" }} />
            <div>
              <Text strong style={{ display: "block", marginBottom: 4 }}>Notas</Text>
              <Input.TextArea
                rows={2}
                placeholder="Observaciones de la compra..."
                value={notasCompra}
                onChange={(e) => setNotasCompra(e.target.value)}
              />
            </div>
          </>
        )}
      </Drawer>

      {/* MODAL: Crear articulo rapido */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: "#096dd9" }} />
            Crear nuevo articulo
          </Space>
        }
        open={crearModalOpen}
        onCancel={() => { setCrearModalOpen(false); crearForm.resetFields(); }}
        onOk={handleCrearArticulo}
        confirmLoading={guardandoArticulo}
        okText="Crear y agregar"
        cancelText="Cancelar"
        width={460}
      >
        <Form form={crearForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="nombre" label="Nombre del producto" rules={[{ required: true, message: "El nombre es obligatorio" }]}>
            <Input placeholder="Ej: Shampoo Argan 400ml" autoFocus />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="referencia" label="Codigo / Referencia">
                <Input placeholder="Ej: SHA-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="marca" label="Marca">
                <Input placeholder="Ej: L Oreal" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="precio_costo" label="Precio costo">
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  formatter={(v) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(v) => parseFloat((v || "0").replace(/\$\s?|(,*)/g, "")) as 0}
                  placeholder="$ 0"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="precio_venta" label="Precio venta">
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  formatter={(v) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(v) => parseFloat((v || "0").replace(/\$\s?|(,*)/g, "")) as 0}
                  placeholder="$ 0"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="categoria" label="Categoria">
            <Input placeholder="Ej: Cuidado capilar" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <PrinterOutlined style={{ color: "#096dd9" }} />
            Imprimir etiquetas de esta compra
          </Space>
        }
        open={labelModalOpen}
        onCancel={() => {
          if (printingLabels) return;
          setLabelModalOpen(false);
          setLabelDraftItems([]);
        }}
        onOk={imprimirEtiquetasCompra}
        okText={printingLabels ? "Imprimiendo..." : "Imprimir etiquetas"}
        cancelText="Omitir"
        confirmLoading={printingLabels}
        width={760}
        destroyOnHidden
      >
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Selecciona la impresora de etiquetas del PC de ventas y confirma cantidades.
          </Text>

          <Row gutter={10} style={{ marginTop: 12, marginBottom: 10 }}>
            <Col span={16}>
              <Text strong style={{ display: "block", marginBottom: 4 }}>Impresora de etiquetas</Text>
              <Select
                showSearch
                mode="tags"
                maxCount={1}
                loading={loadingLabelPrinters}
                placeholder="Selecciona o escribe impresora"
                style={{ width: "100%" }}
                value={selectedLabelPrinter ? [selectedLabelPrinter] : []}
                onChange={(value) => actualizarImpresoraEtiquetas(value?.[0] ?? null)}
                onSearch={(value) => {
                  const normalized = String(value || "").trim();
                  if (normalized) {
                    setSelectedLabelPrinter(normalized);
                  }
                }}
                options={labelPrinters.map((printer) => ({
                  value: printer.name,
                  label: printer.isDefault ? `${printer.name} (predeterminada)` : printer.name,
                }))}
              />
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                Si no aparece en la lista, escríbela manualmente y quedará guardada para próximas etiquetas.
              </Text>
            </Col>
            <Col span={8}>
              <Text strong style={{ display: "block", marginBottom: 4 }}>Total etiquetas</Text>
              <div style={{
                height: 32,
                border: "1px solid #d9d9d9",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fafafa",
                fontWeight: 700,
              }}>
                {totalEtiquetasDraft}
              </div>
            </Col>
          </Row>

          <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #f0f0f0", borderRadius: 8 }}>
            <Table
              size="small"
              pagination={false}
              rowKey="key"
              dataSource={labelDraftItems}
              columns={[
                {
                  title: "Articulo",
                  dataIndex: "nombre",
                  key: "nombre",
                  render: (nombre: string, row: LabelDraftItem) => (
                    <div>
                      <Text strong style={{ fontSize: 12 }}>{nombre}</Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {row.sku || row.articuloId}
                        </Text>
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Precio",
                  key: "precio",
                  width: 120,
                  render: (_: unknown, row: LabelDraftItem) => (
                    <Text style={{ color: "#096dd9", fontWeight: 700 }}>${Number(row.precio).toLocaleString()}</Text>
                  ),
                },
                {
                  title: "Etiquetas",
                  key: "cantidad",
                  width: 130,
                  render: (_: unknown, row: LabelDraftItem) => (
                    <InputNumber
                      min={0}
                      max={999}
                      value={row.cantidad}
                      onChange={(value) => {
                        const next = Math.max(0, Number(value || 0));
                        setLabelDraftItems((prev) => prev.map((item) => (
                          item.key === row.key ? { ...item, cantidad: next } : item
                        )));
                      }}
                      style={{ width: "100%" }}
                    />
                  ),
                },
              ]}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL: Editar compra historica */}
      <Modal
        title={editando ? "Editar compra" : ""}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleGuardarEdicion}
        confirmLoading={guardandoEdit}
        okText="Guardar"
        cancelText="Cancelar"
        width={640}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="proveedor_id" label="Proveedor">
                <Select
                  showSearch
                  placeholder="Seleccionar proveedor"
                  options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="fecha" label="Fecha" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="estado" label="Estado" rules={[{ required: true }]}>
                <Select options={Object.entries(ESTADO_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 13 }}>Items de la compra</Divider>
          {editItems.map((item, idx) => (
            <Row key={idx} gutter={8} style={{ marginBottom: 8 }} align="middle">
              <Col flex="auto">
                <Input
                  placeholder="Nombre del producto"
                  value={item.nombre}
                  onChange={(e) => setEditItems(prev => prev.map((it, i) =>
                    i === idx ? { ...it, nombre: e.target.value } : it
                  ))}
                />
              </Col>
              <Col span={4}>
                <InputNumber
                  min={1}
                  placeholder="Cant."
                  value={item.cantidad}
                  onChange={(v) => setEditItems(prev => prev.map((it, i) =>
                    i === idx ? { ...it, cantidad: v || 1 } : it
                  ))}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col span={5}>
                <InputNumber
                  min={0}
                  placeholder="$ Precio"
                  value={item.precio_unitario}
                  onChange={(v) => setEditItems(prev => prev.map((it, i) =>
                    i === idx ? { ...it, precio_unitario: v || 0 } : it
                  ))}
                  style={{ width: "100%" }}
                  formatter={(v) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                />
              </Col>
              <Col span={2}>
                {editItems.length > 1 && (
                  <Button danger size="small" icon={<DeleteOutlined />}
                    onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))} />
                )}
              </Col>
            </Row>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setEditItems(prev => [...prev, { nombre: "", cantidad: 1, precio_unitario: 0 }])}
            block
            style={{ marginBottom: 12 }}
          >
            Agregar item
          </Button>
          <div style={{ textAlign: "right", padding: "8px 0" }}>
            <Text strong style={{ fontSize: 16 }}>
              Total: <span style={{ color: "#d81b87" }}>${totalEditItems.toLocaleString()}</span>
            </Text>
          </div>
          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={2} placeholder="Observaciones, condiciones especiales..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
