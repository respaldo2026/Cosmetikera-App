"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card, Button, Typography, Space, Input, Select, Tag, App, Spin,
  Row, Col, Statistic, Divider, Grid, Tooltip, Avatar, Badge,
  InputNumber, Modal, Form, Radio, Table, Empty, message as antdMessage,
} from "antd";
import {
  ShoppingCartOutlined, SearchOutlined, UserOutlined, PlusOutlined,
  MinusOutlined, DeleteOutlined, CheckOutlined, DollarOutlined,
  CreditCardOutlined, MobileOutlined, BarChartOutlined, TagsOutlined,
  GiftOutlined, CrownOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";
import EscanerCodigo from "@/components/EscanerCodigo";
import { imprimirTicketTermico, abrirCajon, DatosTicket } from "@utils/pos-hardware";
import { PrinterOutlined, GoldOutlined } from "@ant-design/icons";
import { crearMovimiento } from "@/modules/finanzas/movimientos.service";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type Articulo = {
  id: string; nombre: string; precio_venta: number;
  stock: number; categoria?: string; marca?: string; imagen_url?: string;
};
type CarritoItem = Articulo & { cantidad: number; subtotal: number };
type Cliente = { id: string; nombre_completo: string; telefono?: string; puntos_fidelidad?: number; nivel_fidelidad?: string; total_compras?: number; rol?: string; activo?: boolean };
type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "mixto";
type PagoMixto = { efectivo: number; tarjeta: number; transferencia: number };

const NIVEL_COLORS: Record<string, string> = {
  bronce: "#cd7f32", plata: "#aaa", oro: "#faad14", diamante: "#13c2c2",
};

const METODO_PAGO_LABELS: Record<Exclude<MetodoPago, "mixto">, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const getNivelFidelidad = (puntos: number) => {
  if (puntos >= 15000) return "diamante";
  if (puntos >= 5000) return "oro";
  if (puntos >= 1000) return "plata";
  return "bronce";
};

const getMetodoPagoPersistido = (metodo: MetodoPago, pagoMixto: PagoMixto) => {
  if (metodo !== "mixto") return metodo;

  const partes = Object.entries(pagoMixto)
    .filter(([, monto]) => Number(monto) > 0)
    .map(([clave, monto]) => `${clave}:${Number(monto)}`);

  return partes.length > 0 ? `mixto|${partes.join("|")}` : "mixto";
};

const getDetallePagoMixto = (pagoMixto: PagoMixto) =>
  Object.entries(pagoMixto)
    .filter(([, monto]) => Number(monto) > 0)
    .map(([clave, monto]) => `${METODO_PAGO_LABELS[clave as keyof typeof METODO_PAGO_LABELS]} $${Number(monto).toLocaleString()}`)
    .join(" · ");

export default function VentasPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { message, modal } = App.useApp();
  const { user } = useCurrentUser();

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [descuento, setDescuento] = useState(0);
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState(0);
  const [ultimaVentaId, setUltimaVentaId] = useState<string | null>(null);
  const [ultimoTicket, setUltimoTicket] = useState<DatosTicket | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [pagoMixto, setPagoMixto] = useState<PagoMixto>({ efectivo: 0, tarjeta: 0, transferencia: 0 });

  const cargar = useCallback(async () => {
    setLoading(true);
    const [{ data: arts }, { data: cls }] = await Promise.all([
      supabaseBrowserClient.from("articulos").select("*").eq("activo", true).order("nombre"),
      supabaseBrowserClient
        .from("perfiles")
        .select("id,nombre_completo,telefono,puntos_fidelidad,nivel_fidelidad,total_compras,rol,activo")
        .eq("rol", "estudiante")
        .eq("activo", true)
        .order("nombre_completo"),
    ]);
    setArticulos((arts || []).filter((a: Articulo) => a.stock > 0));
    setClientes(cls || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const articulosFiltrados = useMemo(() =>
    articulos.filter((a) => {
      const matchSearch = !search ||
        a.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (a.marca || "").toLowerCase().includes(search.toLowerCase());
      const matchCat = !filtroCategoria || a.categoria === filtroCategoria;
      return matchSearch && matchCat;
    }),
    [articulos, search, filtroCategoria]
  );

  const categorias = [...new Set(articulos.map((a) => a.categoria).filter(Boolean))];

  const subtotalCarrito = carrito.reduce((s, i) => s + i.subtotal, 0);
  const descuentoVal = Math.round(subtotalCarrito * (descuento / 100));
  const totalFinal = subtotalCarrito - descuentoVal;
  const vuelta = efectivoRecibido - totalFinal;
  const totalPagoMixto = useMemo(
    () => Object.values(pagoMixto).reduce((acc, monto) => acc + Number(monto || 0), 0),
    [pagoMixto]
  );
  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);

  const agregarAlCarrito = (art: Articulo) => {
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === art.id);
      if (existe) {
        if (existe.cantidad >= art.stock) {
          antdMessage.warning("No hay más stock disponible");
          return prev;
        }
        return prev.map((i) =>
          i.id === art.id
            ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_venta }
            : i
        );
      }
      return [...prev, { ...art, cantidad: 1, subtotal: art.precio_venta }];
    });
  };

  const cambiarCantidad = (id: string, delta: number) => {
    setCarrito((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const nuevaCant = Math.max(1, Math.min(i.cantidad + delta, i.stock));
        return { ...i, cantidad: nuevaCant, subtotal: nuevaCant * i.precio_venta };
      })
    );
  };

  const quitarItem = (id: string) => setCarrito((prev) => prev.filter((i) => i.id !== id));

  const limpiarVenta = () => {
    setCarrito([]);
    setClienteId(null);
    setDescuento(0);
    setMetodoPago("efectivo");
    setEfectivoRecibido(0);
    setPagoMixto({ efectivo: 0, tarjeta: 0, transferencia: 0 });
  };

  const procesarVenta = async () => {
    if (carrito.length === 0) { message.warning("El carrito está vacío"); return; }
    if (metodoPago === "efectivo" && efectivoRecibido < totalFinal) {
      message.warning("El efectivo recibido debe cubrir el total de la venta");
      return;
    }
    if (metodoPago === "mixto" && totalPagoMixto !== totalFinal) {
      message.warning("El desglose del pago mixto debe sumar exactamente el total de la venta");
      return;
    }

    setProcesando(true);
    try {
      const metodoPagoPersistido = getMetodoPagoPersistido(metodoPago, pagoMixto);
      const puntosGanados = clienteId ? Math.floor(totalFinal / 1000) : 0;

      // Registrar venta en Supabase
      const { data: venta, error: ventaErr } = await supabaseBrowserClient
        .from("ventas")
        .insert([{
          cliente_id: clienteId,
          fecha: dayjs().toISOString(),
          subtotal: subtotalCarrito,
          descuento: descuentoVal,
          total: totalFinal,
          metodo_pago: metodoPagoPersistido,
          items: carrito.map((i) => ({ id: i.id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio_venta, subtotal: i.subtotal })),
        }])
        .select()
        .single();

      if (ventaErr) throw ventaErr;

      // Actualizar stock
      await Promise.all(carrito.map((i) =>
        supabaseBrowserClient
          .from("articulos")
          .update({ stock: i.stock - i.cantidad })
          .eq("id", i.id)
      ));

      // Puntos de fidelidad (1 punto por cada $1000)
      if (clienteId && clienteSeleccionado) {
        try {
          await supabaseBrowserClient.rpc("sumar_puntos_cliente", {
            p_cliente_id: clienteId,
            p_puntos: puntosGanados,
          });
        } catch {
          const nuevosPuntos = Number(clienteSeleccionado.puntos_fidelidad || 0) + puntosGanados;
          await supabaseBrowserClient
            .from("perfiles")
            .update({
              puntos_fidelidad: nuevosPuntos,
              nivel_fidelidad: getNivelFidelidad(nuevosPuntos),
            })
            .eq("id", clienteId);
        }

        await supabaseBrowserClient
          .from("perfiles")
          .update({
            total_compras: Number(clienteSeleccionado.total_compras || 0) + totalFinal,
          })
          .eq("id", clienteId);
      }

      try {
        const detallePagoMixto = metodoPago === "mixto" ? getDetallePagoMixto(pagoMixto) : null;
        await crearMovimiento({
          fecha: dayjs().format("YYYY-MM-DD"),
          tipo: "ingreso",
          monto: totalFinal,
          concepto: `Venta POS ${venta?.id ? `#${String(venta.id).slice(-6).toUpperCase()}` : ""}`.trim(),
          categoria: "ventas",
          metodo_pago: metodoPagoPersistido,
          referencia: venta?.id || null,
          descripcion: [
            `Items: ${carrito.map((item) => `${item.nombre} x${item.cantidad}`).join(", ")}`,
            detallePagoMixto ? `Pago: ${detallePagoMixto}` : null,
          ].filter(Boolean).join(" | "),
          estudiante_id: clienteId,
          created_by: user?.id || null,
        });
      } catch {
        // El asiento financiero no debe bloquear la venta.
      }

      const ticketDatos: DatosTicket = {
        nombreTienda: "La Cosmetikera",
        numeroVenta: venta?.id?.slice(-6).toUpperCase() ?? "------",
        fecha: dayjs().format("DD/MM/YYYY HH:mm"),
        cliente: clienteSeleccionado?.nombre_completo,
        metodoPago: metodoPago === "mixto" ? `Mixto (${getDetallePagoMixto(pagoMixto)})` : metodoPago,
        cambio: metodoPago === "efectivo" ? Math.max(0, vuelta) : undefined,
        puntosFidelidad: clienteSeleccionado ? puntosGanados : undefined,
        mensaje: "¡Gracias por tu compra en La Cosmetikera!",
        lineas: [
          { tipo: "titulo", texto: "DETALLE DE VENTA" },
          { tipo: "linea" },
          ...carrito.map((i) => ({ tipo: "item" as const, descripcion: i.nombre, cantidad: i.cantidad, precio: i.precio_venta })),
          { tipo: "linea" },
          ...(descuento > 0
            ? [
                { tipo: "total" as const, etiqueta: "Subtotal", valor: subtotalCarrito },
                { tipo: "total" as const, etiqueta: `Descuento (${descuento}%)`, valor: -descuentoVal },
              ]
            : []),
          ...(metodoPago === "mixto"
            ? Object.entries(pagoMixto)
                .filter(([, monto]) => Number(monto) > 0)
                .map(([clave, monto]) => ({
                  tipo: "total" as const,
                  etiqueta: METODO_PAGO_LABELS[clave as keyof typeof METODO_PAGO_LABELS],
                  valor: Number(monto),
                }))
            : []),
          { tipo: "total", etiqueta: "TOTAL", valor: totalFinal },
        ],
      };

      setUltimaVentaId(venta?.id ?? null);
      setUltimoTicket(ticketDatos);
      message.success("¡Venta registrada exitosamente! 🎉");
      // Abrir cajón monedero automáticamente si el pago fue en efectivo
      if (metodoPago === "efectivo") {
        abrirCajon().catch(() => {});
      }
      setModalPagoOpen(false);
      limpiarVenta();
      cargar();
    } catch (e: any) {
      message.error("Error al procesar: " + (e?.message || "desconocido"));
    } finally {
      setProcesando(false);
    }
  };

  // Buscar artículo por código al escanear
  const buscarPorCodigo = useCallback((codigo: string) => {
    const art = articulos.find(
      (a) =>
        (a as any).referencia === codigo ||
        (a as any).codigo_barras === codigo ||
        a.id === codigo
    );
    if (art) {
      agregarAlCarrito(art);
      message.success(`${art.nombre} agregado al carrito`);
    } else {
      // Si no se encuentra, poner el código en el buscador
      setSearch(codigo);
      message.info(`Código: ${codigo} — no encontrado, mostrando búsqueda`);
    }
  }, [articulos]); // eslint-disable-line

  const imprimirUltimaVenta = async () => {
    if (!ultimoTicket && !ultimaVentaId) return;
    setImprimiendo(true);
    const result = await imprimirTicketTermico(
      ultimoTicket || {
        nombreTienda: "La Cosmetikera",
        numeroVenta: ultimaVentaId?.slice(-6).toUpperCase() ?? "------",
        fecha: dayjs().format("DD/MM/YYYY HH:mm"),
        metodoPago,
        mensaje: "¡Gracias por tu compra en La Cosmetikera!",
        lineas: [{ tipo: "total", etiqueta: "TOTAL", valor: totalFinal }],
      }
    );
    if (!result.ok) {
      message.warning(result.error || "No se pudo imprimir. Verifica QZ Tray.");
    }
    setImprimiendo(false);
  };

  const PanelProductos = () => (
    <div>
      {/* Escáner de código de barras / QR */}
      <div style={{ marginBottom: 8 }}>
        <EscanerCodigo
          onCodigo={buscarPorCodigo}
          placeholder="Escanear código de barras o QR del producto..."
          conCamara
        />
      </div>
      {/* Búsqueda manual */}
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col flex="auto">
          <Input
            placeholder="Buscar artículo por nombre o marca..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            size="large"
          />
        </Col>
        <Col>
          <Select
            placeholder="Categoría"
            allowClear
            style={{ minWidth: 130 }}
            value={filtroCategoria}
            onChange={setFiltroCategoria}
            size="large"
            options={categorias.map((c) => ({ label: c, value: c }))}
          />
        </Col>
      </Row>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
      ) : articulosFiltrados.length === 0 ? (
        <Empty description="Sin artículos" />
      ) : (
        <Row gutter={[8, 8]}>
          {articulosFiltrados.map((art) => {
            const enCarrito = carrito.find((i) => i.id === art.id);
            return (
              <Col key={art.id} xs={12} sm={8} lg={6} xl={isMobile ? 12 : 6}>
                <Card
                  hoverable
                  onClick={() => agregarAlCarrito(art)}
                  style={{
                    borderRadius: 10,
                    cursor: "pointer",
                    border: enCarrito ? "2px solid #d81b87" : undefined,
                    transition: "all 0.15s",
                  }}
                  bodyStyle={{ padding: 8 }}
                  cover={
                    <div style={{
                      height: 80, background: "linear-gradient(135deg,#fce4f8,#f0d6ff)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative",
                    }}>
                      {art.imagen_url
                        ? <img src={art.imagen_url} alt={art.nombre} style={{ height: "100%", width: "100%", objectFit: "cover" }} />
                        : <TagsOutlined style={{ fontSize: 28, color: "#d81b87", opacity: 0.5 }} />
                      }
                      {enCarrito && (
                        <Badge
                          count={enCarrito.cantidad}
                          style={{ position: "absolute", top: 4, right: 4, background: "#d81b87" }}
                        />
                      )}
                    </div>
                  }
                >
                  <Text style={{ fontSize: 11, fontWeight: 600, display: "block" }} ellipsis>{art.nombre}</Text>
                  <Text style={{ fontSize: 12, color: "#d81b87", fontWeight: 700 }}>
                    ${Number(art.precio_venta).toLocaleString()}
                  </Text>
                  <div>
                    <Tag style={{ fontSize: 10, padding: "0 4px" }}>{art.stock} en stock</Tag>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );

  const PanelCarrito = () => (
    <Card
      style={{ borderRadius: 12, height: "100%", display: "flex", flexDirection: "column" }}
      bodyStyle={{ padding: 12, display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Cliente */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>
          Cliente
        </Text>
        <Select
          showSearch
          allowClear
          placeholder="Seleccionar cliente (opcional)"
          style={{ width: "100%", marginTop: 4 }}
          value={clienteId}
          onChange={setClienteId}
          filterOption={(input, opt) =>
            (opt?.label as string || "").toLowerCase().includes(input.toLowerCase())
          }
          options={clientes.map((c) => ({
            value: c.id,
            label: c.nombre_completo,
          }))}
        />
        {clienteSeleccionado && (
          <div style={{ marginTop: 6, padding: "6px 10px", background: "#f9f0ff", borderRadius: 8 }}>
            <Space>
              <Avatar size="small" icon={<UserOutlined />} style={{ background: "#d81b87" }} />
              <div>
                <Text strong style={{ fontSize: 12 }}>{clienteSeleccionado.nombre_completo}</Text>
                {clienteSeleccionado.nivel_fidelidad && (
                  <Tag
                    color={NIVEL_COLORS[clienteSeleccionado.nivel_fidelidad] || "purple"}
                    style={{ marginLeft: 4, fontSize: 10 }}
                  >
                    <CrownOutlined /> {clienteSeleccionado.nivel_fidelidad}
                  </Tag>
                )}
                {clienteSeleccionado.puntos_fidelidad !== undefined && (
                  <div>
                    <Text style={{ fontSize: 11, color: "#888" }}>
                      <GiftOutlined /> {clienteSeleccionado.puntos_fidelidad} puntos
                    </Text>
                  </div>
                )}
              </div>
            </Space>
          </div>
        )}
      </div>

      <Divider style={{ margin: "8px 0" }} />

      {/* Items */}
      <div style={{ flex: 1, overflowY: "auto", marginBottom: 8 }}>
        {carrito.length === 0 ? (
          <Empty
            image={<ShoppingCartOutlined style={{ fontSize: 40, color: "#ccc" }} />}
            description="Toca un producto para agregar"
            imageStyle={{ height: 50 }}
          />
        ) : (
          carrito.map((item) => (
            <div key={item.id} style={{
              padding: "6px 0", borderBottom: "1px solid #f0f0f0",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12, fontWeight: 600 }} ellipsis>{item.nombre}</Text>
                <div>
                  <Text style={{ fontSize: 11, color: "#d81b87" }}>
                    ${Number(item.precio_venta).toLocaleString()}
                  </Text>
                </div>
              </div>
              <Space size={4}>
                <Button size="small" icon={<MinusOutlined />} onClick={() => cambiarCantidad(item.id, -1)} />
                <Text strong style={{ minWidth: 20, textAlign: "center" }}>{item.cantidad}</Text>
                <Button size="small" icon={<PlusOutlined />} onClick={() => cambiarCantidad(item.id, 1)} />
              </Space>
              <Text strong style={{ fontSize: 12, minWidth: 60, textAlign: "right" }}>
                ${Number(item.subtotal).toLocaleString()}
              </Text>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => quitarItem(item.id)}
              />
            </div>
          ))
        )}
      </div>

      {/* Descuento */}
      <div style={{ marginBottom: 8 }}>
        <Row align="middle" gutter={8}>
          <Col>
            <Text style={{ fontSize: 12, color: "#888" }}>Descuento:</Text>
          </Col>
          <Col>
            <InputNumber
              min={0} max={100}
              value={descuento}
              onChange={(v) => setDescuento(v || 0)}
              formatter={(v) => `${v}%`}
              parser={(v) => Number((v || "").replace("%", ""))}
              size="small"
              style={{ width: 80 }}
            />
          </Col>
          {descuento > 0 && (
            <Col>
              <Tag color="green">-${descuentoVal.toLocaleString()}</Tag>
            </Col>
          )}
        </Row>
      </div>

      <Divider style={{ margin: "8px 0" }} />

      {/* Totales */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Text type="secondary">Subtotal</Text>
          <Text>${subtotalCarrito.toLocaleString()}</Text>
        </div>
        {descuento > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Text type="secondary">Descuento ({descuento}%)</Text>
            <Text style={{ color: "#52c41a" }}>-${descuentoVal.toLocaleString()}</Text>
          </div>
        )}
        <div style={{
          display: "flex", justifyContent: "space-between",
          padding: "8px 0", borderTop: "2px solid #f0f0f0", marginTop: 4,
        }}>
          <Text strong style={{ fontSize: 16 }}>TOTAL</Text>
          <Text strong style={{ fontSize: 20, color: "#d81b87" }}>${totalFinal.toLocaleString()}</Text>
        </div>
      </div>

      {/* Botones */}
      <Space direction="vertical" style={{ width: "100%" }}>
        <Button
          type="primary"
          size="large"
          block
          icon={<CheckOutlined />}
          disabled={carrito.length === 0}
          onClick={() => setModalPagoOpen(true)}
          style={{ background: "linear-gradient(90deg,#d81b87,#9c27b0)", border: "none", height: 44 }}
        >
          Cobrar ${totalFinal.toLocaleString()}
        </Button>
        {carrito.length > 0 && (
          <Button block onClick={limpiarVenta}>Limpiar carrito</Button>
        )}
      </Space>
    </Card>
  );

  return (
    <>
      {/* HEADER */}
      <Card style={{ marginBottom: 12, borderRadius: 12 }} bodyStyle={{ padding: "10px 16px" }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg,#d81b87,#9c27b0)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ShoppingCartOutlined style={{ color: "#fff", fontSize: 20 }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>Punto de Venta</Title>
                <Text type="secondary" style={{ fontSize: 11 }}>{dayjs().format("dddd D [de] MMMM, YYYY")}</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
          </Col>
        </Row>
      </Card>

      {/* LAYOUT POS */}
      <Row gutter={[12, 12]} style={{ height: "calc(100vh - 200px)", minHeight: 500 }}>
        <Col xs={24} lg={16} style={{ height: "100%", overflowY: "auto" }}>
          <PanelProductos />
        </Col>
        <Col xs={24} lg={8} style={{ height: "100%" }}>
          <PanelCarrito />
        </Col>
      </Row>

      {/* MODAL PAGO */}
      <Modal
        title="Cobro de venta"
        open={modalPagoOpen}
        onCancel={() => setModalPagoOpen(false)}
        footer={null}
        width={420}
      >
        <div style={{ padding: "12px 0" }}>
          <div style={{
            background: "linear-gradient(135deg,#fce4f8,#f0d6ff)",
            borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 16,
          }}>
            <Text type="secondary">Total a cobrar</Text>
            <div>
              <Text style={{ fontSize: 32, fontWeight: 800, color: "#d81b87" }}>
                ${totalFinal.toLocaleString()}
              </Text>
            </div>
            {clienteSeleccionado && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Cliente: {clienteSeleccionado.nombre_completo}
              </Text>
            )}
          </div>

          <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>Método de pago</Text>
          <Radio.Group
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            style={{ width: "100%", marginBottom: 16 }}
          >
            <Row gutter={[8, 8]}>
              {[
                { value: "efectivo", label: "Efectivo", icon: <DollarOutlined /> },
                { value: "tarjeta", label: "Tarjeta", icon: <CreditCardOutlined /> },
                { value: "transferencia", label: "Transferencia", icon: <MobileOutlined /> },
                { value: "mixto", label: "Mixto", icon: <BarChartOutlined /> },
              ].map((m) => (
                <Col span={12} key={m.value}>
                  <Radio.Button
                    value={m.value}
                    style={{
                      width: "100%", textAlign: "center", padding: "8px 0",
                      background: metodoPago === m.value ? "#fce4f8" : undefined,
                    }}
                  >
                    {m.icon} {m.label}
                  </Radio.Button>
                </Col>
              ))}
            </Row>
          </Radio.Group>

          {metodoPago === "efectivo" && (
            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13 }}>Efectivo recibido:</Text>
              <InputNumber
                size="large"
                style={{ width: "100%", marginTop: 4 }}
                min={0}
                value={efectivoRecibido}
                onChange={(v) => setEfectivoRecibido(v || 0)}
                formatter={(v) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                placeholder="$ 0"
              />
              {efectivoRecibido >= totalFinal && (
                <div style={{
                  marginTop: 8, padding: "8px 12px",
                  background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 8,
                }}>
                  <Text style={{ color: "#389e0d" }}>
                    Cambio: <strong>${Math.max(0, vuelta).toLocaleString()}</strong>
                  </Text>
                </div>
              )}
            </div>
          )}

          {metodoPago === "mixto" && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>Desglose pago mixto</Text>
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                {(["efectivo", "tarjeta", "transferencia"] as const).map((clave) => (
                  <div key={clave}>
                    <Text style={{ fontSize: 12 }}>{METODO_PAGO_LABELS[clave]}</Text>
                    <InputNumber
                      size="large"
                      style={{ width: "100%", marginTop: 4 }}
                      min={0}
                      value={pagoMixto[clave]}
                      onChange={(valor) => setPagoMixto((prev) => ({ ...prev, [clave]: Number(valor || 0) }))}
                      formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                      placeholder="$ 0"
                    />
                  </div>
                ))}
              </Space>
              <div style={{
                marginTop: 10,
                padding: "8px 12px",
                background: totalPagoMixto === totalFinal ? "#f6ffed" : "#fff7e6",
                border: `1px solid ${totalPagoMixto === totalFinal ? "#b7eb8f" : "#ffd591"}`,
                borderRadius: 8,
              }}>
                <Text style={{ color: totalPagoMixto === totalFinal ? "#389e0d" : "#d46b08" }}>
                  Total ingresado: <strong>${totalPagoMixto.toLocaleString()}</strong>
                  {totalPagoMixto !== totalFinal ? ` · faltan/exceden ${Math.abs(totalFinal - totalPagoMixto).toLocaleString()}` : ""}
                </Text>
              </div>
            </div>
          )}

          {clienteSeleccionado && (
            <div style={{
              padding: "8px 12px", background: "#f9f0ff",
              borderRadius: 8, marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, color: "#722ed1" }}>
                <GiftOutlined /> El cliente ganará <strong>{Math.floor(totalFinal / 1000)} puntos</strong> por esta compra
              </Text>
            </div>
          )}

          <Button
            type="primary"
            size="large"
            block
            loading={procesando}
            onClick={procesarVenta}
            icon={<CheckOutlined />}
            style={{ background: "linear-gradient(90deg,#d81b87,#9c27b0)", border: "none", height: 44 }}
          >
            Confirmar venta
          </Button>
          <Row gutter={8} style={{ marginTop: 8 }}>
            <Col span={12}>
              <Button
                block
                icon={<PrinterOutlined />}
                loading={imprimiendo}
                onClick={imprimirUltimaVenta}
                disabled={!ultimaVentaId && !ultimoTicket}
              >
                Imprimir ticket
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                icon={<GoldOutlined />}
                onClick={() => abrirCajon().then(r => !r.ok && message.warning("No se pudo abrir el cajón: " + r.error))}
              >
                Abrir cajón
              </Button>
            </Col>
          </Row>
        </div>
      </Modal>
    </>
  );
}
