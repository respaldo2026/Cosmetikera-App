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
  GiftOutlined, CrownOutlined, ReloadOutlined, ExclamationCircleOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";
import EscanerCodigo from "@/components/EscanerCodigo";
import { imprimirTicketTermico, imprimirTicketNavegador, abrirCajon, DatosTicket } from "@utils/pos-hardware";
import { PrinterOutlined, GoldOutlined, BarcodeOutlined } from "@ant-design/icons";
import { crearMovimiento } from "@/modules/finanzas/movimientos.service";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type Articulo = {
  id: string; nombre: string; precio_venta: number;
  stock: number; categoria?: string; marca?: string; imagen_url?: string;
};
type CarritoItem = Articulo & { cantidad: number; subtotal: number };
type Cliente = { id: string; nombre_completo: string; cedula?: string; telefono?: string; puntos_fidelidad?: number; nivel_fidelidad?: string; total_compras?: number; rol?: string; activo?: boolean };
type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "mixto";
type PagoMixto = { efectivo: number; tarjeta: number; transferencia: number };
type ClubVoucher = {
  id: string;
  perfilId: string;
  code: string;
  puntos: number;
  valueCop: number;
  status: string;
  rewardKey?: string | null;
  rewardTitle: string;
  rewardIcon: string;
  description: string;
};

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
  const [codigoVoucherClub, setCodigoVoucherClub] = useState("");
  const [voucherClub, setVoucherClub] = useState<ClubVoucher | null>(null);
  const [validandoVoucher, setValidandoVoucher] = useState(false);
  const [ultimaVentaId, setUltimaVentaId] = useState<string | null>(null);
  const [ultimoTicket, setUltimoTicket] = useState<DatosTicket | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [pagoMixto, setPagoMixto] = useState<PagoMixto>({ efectivo: 0, tarjeta: 0, transferencia: 0 });

  const [nuevoClienteOpen, setNuevoClienteOpen] = useState(false);
  const [nuevoClienteForm] = Form.useForm();
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);

  const subtotalCarrito = carrito.reduce((s, i) => s + i.subtotal, 0);
  const descuentoVal = Math.round(subtotalCarrito * (descuento / 100));
  const descuentoVoucherClub = Math.min(voucherClub?.valueCop || 0, Math.max(0, subtotalCarrito - descuentoVal));
  const totalFinal = Math.max(0, subtotalCarrito - descuentoVal - descuentoVoucherClub);
  const vuelta = efectivoRecibido - totalFinal;
  const totalPagoMixto = useMemo(
    () => Object.values(pagoMixto).reduce((acc, monto) => acc + Number(monto || 0), 0),
    [pagoMixto]
  );
  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);

  useEffect(() => {
    if (!voucherClub) return;
    if (!clienteId || voucherClub.perfilId !== clienteId) {
      setVoucherClub(null);
      setCodigoVoucherClub("");
    }
  }, [clienteId, voucherClub]);

  const crearClienteRapido = async () => {
    const values = await nuevoClienteForm.validateFields();
    setCreandoCliente(true);
    try {
      const res = await fetch("/api/perfiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, rol: "cliente", activo: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al crear cliente");
      message.success(`✅ Cliente ${values.nombre_completo} creado`);
      setNuevoClienteOpen(false);
      nuevoClienteForm.resetFields();
      const r = await fetch("/api/perfiles?rol=cliente");
      const rj = await r.json();
      setClientes(rj.data || []);
      if (json.data?.id) setClienteId(json.data.id);
    } catch (e: unknown) {
      message.error((e as Error)?.message || "Error al crear cliente");
    } finally {
      setCreandoCliente(false);
    }
  };

  const validarVoucherClub = async () => {
    const code = codigoVoucherClub.trim().toUpperCase();
    if (!code) {
      message.warning("Ingresa un código del club");
      return;
    }
    if (!clienteId) {
      message.warning("Selecciona el cliente antes de aplicar un voucher del club");
      return;
    }

    setValidandoVoucher(true);
    try {
      const response = await fetch("/api/club/voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", code, clienteId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo validar el voucher");
      setVoucherClub(json.data);
      setCodigoVoucherClub(json.data.code);
      message.success(`Voucher ${json.data.code} aplicado`);
    } catch (error: any) {
      setVoucherClub(null);
      message.error(error?.message || "No se pudo validar el voucher");
    } finally {
      setValidandoVoucher(false);
    }
  };

  const removerVoucherClub = () => {
    setVoucherClub(null);
    setCodigoVoucherClub("");
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    const [{ data: arts }, clientesRes] = await Promise.all([
      supabaseBrowserClient.from("articulos").select("*").eq("activo", true).order("nombre"),
      fetch("/api/perfiles?rol=cliente").then((r) => r.json()),
    ]);
    setArticulos((arts || []).filter((a: Articulo) => a.stock > 0));
    setClientes((clientesRes.data || []).filter((c: Cliente) => c.activo !== false));
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
    setCodigoVoucherClub("");
    setVoucherClub(null);
    setClientesFiltrados([]);
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
          descuento: descuentoVal + descuentoVoucherClub,
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
            voucherClub ? `Voucher club: ${voucherClub.code} (${voucherClub.rewardTitle})` : null,
          ].filter(Boolean).join(" | "),
          estudiante_id: clienteId,
          created_by: user?.id || null,
        });
      } catch {
        // El asiento financiero no debe bloquear la venta.
      }

      if (voucherClub && clienteId && venta?.id) {
        try {
          const voucherResponse = await fetch("/api/club/voucher", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "consume",
              code: voucherClub.code,
              clienteId,
              ventaId: venta.id,
            }),
          });
          const voucherJson = await voucherResponse.json();
          if (!voucherResponse.ok) {
            throw new Error(voucherJson.error || "No se pudo consumir el voucher");
          }
        } catch (voucherError) {
          console.error("No se pudo cerrar el voucher del club", voucherError);
          message.warning("La venta quedó registrada, pero el voucher requiere revisión manual.");
        }
      }

      const ticketDatos: DatosTicket = {
        nombreTienda: "La Cosmetikera",
        numeroVenta: venta?.id?.slice(-6).toUpperCase() ?? "------",
        fecha: dayjs().format("DD/MM/YYYY HH:mm"),
        cliente: clienteSeleccionado?.nombre_completo,
        metodoPago: metodoPago === "mixto" ? `Mixto (${getDetallePagoMixto(pagoMixto)})` : metodoPago,
        cambio: metodoPago === "efectivo" ? Math.max(0, vuelta) : undefined,
        puntosFidelidad: clienteSeleccionado ? puntosGanados : undefined,
        puntosAcumulados: clienteSeleccionado
          ? Number(clienteSeleccionado.puntos_fidelidad || 0) + puntosGanados
          : undefined,
        nivelFidelidad: clienteSeleccionado
          ? getNivelFidelidad(Number(clienteSeleccionado.puntos_fidelidad || 0) + puntosGanados)
          : undefined,
        mensaje: voucherClub ? `Voucher aplicado: ${voucherClub.code}. Gracias por tu compra en La Cosmetikera.` : "¡Gracias por tu compra en La Cosmetikera!",
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
          ...(voucherClub
            ? [{ tipo: "total" as const, etiqueta: `Voucher club ${voucherClub.code}`, valor: -descuentoVoucherClub }]
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

    const ticketParaImprimir = ultimoTicket || {
      nombreTienda: "La Cosmetikera",
      numeroVenta: ultimaVentaId?.slice(-6).toUpperCase() ?? "------",
      fecha: dayjs().format("DD/MM/YYYY HH:mm"),
      metodoPago,
      mensaje: "¡Gracias por tu compra en La Cosmetikera!",
      lineas: [{ tipo: "total" as const, etiqueta: "TOTAL", valor: totalFinal }],
    };

    // Intentar con QZ Tray (impresora térmica)
    const result = await imprimirTicketTermico(ticketParaImprimir);

    if (!result.ok) {
      // Fallback: impresión por navegador
      try {
        imprimirTicketNavegador(ticketParaImprimir);
      } catch (e) {
        message.warning("No se pudo imprimir. Verifica QZ Tray o permite ventanas emergentes.");
      }
    }

    setImprimiendo(false);
  };

  const handleCobrar = () => {
    if (!clienteId && carrito.length > 0) {
      modal.confirm({
        title: "¿Vender sin cliente?",
        icon: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
        content: (
          <div>
            <p>Los <strong>{Math.floor(totalFinal / 1000)} puntos</strong> de esta compra no se acumularán.</p>
            <p style={{ color: "#888", fontSize: 12 }}>Puedes asignar o crear un cliente en el panel del carrito antes de cobrar.</p>
          </div>
        ),
        okText: "Continuar sin cliente",
        cancelText: "← Asignar cliente",
        okButtonProps: { danger: true },
        onOk: () => setModalPagoOpen(true),
      });
    } else {
      setModalPagoOpen(true);
    }
  };

  const panelProductos = (
    <div>
      {/* Escáner de código de barras / QR */}
      <div style={{ marginBottom: 12 }}>
        <EscanerCodigo
          onCodigo={buscarPorCodigo}
          placeholder="Escanear código de barras o QR del producto..."
          conCamara
        />
      </div>

      {/* Búsqueda manual por nombre o código */}
      <Input
        placeholder="🔍 Buscar por nombre, marca o referencia..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        size="large"
        style={{ marginBottom: 8 }}
      />

      {/* Resultados solo cuando hay 3+ caracteres */}
      {search.trim().length >= 3 && (
        loading ? (
          <div style={{ textAlign: "center", padding: 24 }}><Spin /></div>
        ) : articulosFiltrados.length === 0 ? (
          <Empty description="Sin resultados" style={{ padding: 24 }} />
        ) : (
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #f0d6ff" }}>
            {articulosFiltrados.slice(0, 8).map((art, idx) => {
              const enCarrito = carrito.find((i) => i.id === art.id);
              return (
                <div
                  key={art.id}
                  onClick={() => agregarAlCarrito(art)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px",
                    background: enCarrito ? "#fce4f8" : idx % 2 === 0 ? "#fff" : "#fdf5ff",
                    borderBottom: idx < Math.min(articulosFiltrados.length, 8) - 1 ? "1px solid #f0d6ff" : "none",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    borderLeft: enCarrito ? "4px solid #d81b87" : "4px solid transparent",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: 600, fontSize: 13, display: "block" }} ellipsis>
                      {art.nombre}
                    </Text>
                    {art.marca && (
                      <Text style={{ fontSize: 11, color: "#aaa" }}>{art.marca}</Text>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <Text style={{ color: "#d81b87", fontWeight: 700, fontSize: 14, display: "block" }}>
                      ${Number(art.precio_venta).toLocaleString()}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#aaa" }}>{art.stock} en stock</Text>
                  </div>
                  {enCarrito ? (
                    <Badge count={enCarrito.cantidad} style={{ background: "#d81b87" }} />
                  ) : (
                    <PlusOutlined style={{ color: "#d81b87", fontSize: 16 }} />
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Instrucción cuando no hay búsqueda */}
      {search.trim().length === 0 && (
        <div style={{
          marginTop: 40, textAlign: "center",
          padding: "32px 24px",
          background: "linear-gradient(135deg,#fce4f8,#f0d6ff)",
          borderRadius: 16,
        }}>
          <BarcodeOutlined style={{ fontSize: 56, color: "#d81b87", opacity: 0.4, display: "block", marginBottom: 12 }} />
          <Text style={{ fontSize: 15, color: "#9c27b0", fontWeight: 600, display: "block" }}>
            Escanea el código de barras
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            o escribe el nombre del producto para buscarlo
          </Text>
        </div>
      )}

      {search.trim().length > 0 && search.trim().length < 3 && (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Escribe al menos 3 caracteres para buscar...</Text>
        </div>
      )}
    </div>
  );

  const panelCarrito = (
    <Card
      style={{ borderRadius: 12, height: "100%", display: "flex", flexDirection: "column" }}
      styles={{ body: { padding: 12, display: "flex", flexDirection: "column", height: "100%" } }}
    >
      {/* Cliente */}
      <div style={{
        marginBottom: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: clienteId
          ? "linear-gradient(135deg,#f9f0ff,#fff0f6)"
          : "linear-gradient(135deg,#fff7e6,#fff1f0)",
        border: `2px solid ${clienteId ? "#d81b87" : "#ffbb96"}`,
        transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <CrownOutlined style={{ color: "#d81b87", fontSize: 15 }} />
          <Text strong style={{ fontSize: 13, color: "#d81b87", letterSpacing: 0.5 }}>
            Cliente · Fidelización
          </Text>
          {!clienteId && carrito.length > 0 && (
            <Tag color="warning" style={{ fontSize: 10, marginLeft: "auto", cursor: "default", fontWeight: 600 }}>
              ⚠ Sin cliente
            </Tag>
          )}
          {clienteId && (
            <Tag color="success" style={{ fontSize: 10, marginLeft: "auto", cursor: "default" }}>
              ✓ Asignado
            </Tag>
          )}
        </div>
        <Row gutter={6}>
          <Col flex="auto">
            <Select
              showSearch
              allowClear
              placeholder="👤 Buscar por nombre, cédula o teléfono..."
              status={carrito.length > 0 && !clienteId ? "warning" : ""}
              size="large"
              style={{ width: "100%", fontSize: 13 }}
              value={clienteId}
              onChange={setClienteId}
              optionLabelProp="label"
              notFoundContent={null}
              filterOption={false}
              onSearch={(input) => {
                const q = input.trim();
                if (q.length < 3) {
                  setClientesFiltrados([]);
                  return;
                }
                const ql = q.toLowerCase();
                const qd = q.replace(/\D/g, "");
                const matches = clientes
                  .filter((c) =>
                    c.nombre_completo.toLowerCase().includes(ql) ||
                    (c.cedula || "").toLowerCase().includes(ql) ||
                    (qd && (c.telefono || "").replace(/\D/g, "").includes(qd))
                  )
                  .slice(0, 5);
                setClientesFiltrados(matches);
              }}
              optionRender={(opt) => {
                const c = clientes.find((x) => x.id === opt.value);
                return (
                  <div style={{ lineHeight: 1.4, padding: "2px 0" }}>
                    <div style={{ fontWeight: 600 }}>{c?.nombre_completo}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {[c?.cedula ? `CC ${c.cedula}` : null, c?.telefono || null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                );
              }}
              options={clientesFiltrados.map((c) => ({ value: c.id, label: c.nombre_completo }))}
            />
          </Col>
          <Col>
            <Tooltip title="Crear nuevo cliente">
              <Button
                size="large"
                icon={<PlusOutlined />}
                onClick={() => setNuevoClienteOpen(true)}
                style={{ borderColor: "#d81b87", color: "#d81b87", background: "#fff0f6" }}
              />
            </Tooltip>
          </Col>
        </Row>
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
        {clienteId && (
          <div style={{ marginTop: 10, padding: "10px", background: voucherClub ? "#f6ffed" : "#fff7fb", borderRadius: 10, border: `1px solid ${voucherClub ? "#b7eb8f" : "#ffd6e7"}` }}>
            <Text strong style={{ fontSize: 12, display: "block", marginBottom: 8 }}>Voucher Club</Text>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={codigoVoucherClub}
                onChange={(event) => setCodigoVoucherClub(event.target.value.toUpperCase())}
                placeholder="Ej: CLUB-ABC123"
                disabled={!!voucherClub}
              />
              <Button onClick={voucherClub ? removerVoucherClub : validarVoucherClub} loading={validandoVoucher} style={voucherClub ? undefined : { borderColor: "#d81b87", color: "#d81b87" }}>
                {voucherClub ? "Quitar" : "Aplicar"}
              </Button>
            </Space.Compact>
            {voucherClub && (
              <Space wrap style={{ marginTop: 8 }}>
                <Tag color="success">{voucherClub.rewardIcon} {voucherClub.rewardTitle}</Tag>
                <Tag color="green">-${descuentoVoucherClub.toLocaleString()}</Tag>
              </Space>
            )}
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
            styles={{ image: { height: 50 } }}
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
        {voucherClub && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Text type="secondary">Voucher Club {voucherClub.code}</Text>
            <Text style={{ color: "#389e0d" }}>-${descuentoVoucherClub.toLocaleString()}</Text>
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

      {/* Preview fidelización */}
      {carrito.length > 0 && (
        clienteId && clienteSeleccionado ? (
          <div style={{
            marginBottom: 10, padding: "8px 12px",
            background: "linear-gradient(90deg,#f9f0ff,#fff0f6)",
            borderRadius: 8, border: "1px solid #d3adf7",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <GiftOutlined style={{ color: "#722ed1", fontSize: 16, flexShrink: 0 }} />
            <div>
              <Text style={{ fontSize: 12, color: "#722ed1", fontWeight: 600, display: "block" }}>
                +{Math.floor(totalFinal / 1000)} puntos en esta compra
              </Text>
              <Text style={{ fontSize: 11, color: "#888" }}>
                Total acumulado: {Number(clienteSeleccionado.puntos_fidelidad || 0) + Math.floor(totalFinal / 1000)} pts · {getNivelFidelidad(Number(clienteSeleccionado.puntos_fidelidad || 0) + Math.floor(totalFinal / 1000))}
              </Text>
            </div>
          </div>
        ) : (
          <div style={{
            marginBottom: 10, padding: "8px 12px",
            background: "#fffbe6", borderRadius: 8, border: "1px solid #ffe58f",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <ExclamationCircleOutlined style={{ color: "#faad14", fontSize: 14, flexShrink: 0 }} />
            <Text style={{ fontSize: 11, color: "#ad6800" }}>
              Asigna un cliente para acumular <strong>{Math.floor(totalFinal / 1000)} puntos</strong>
            </Text>
          </div>
        )
      )}

      {/* Botones */}
      <Space direction="vertical" style={{ width: "100%" }}>
        <Button
          type="primary"
          size="large"
          block
          icon={<CheckOutlined />}
          disabled={carrito.length === 0}
          onClick={handleCobrar}
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
      <Card style={{ marginBottom: 12, borderRadius: 12 }} styles={{ body: { padding: "10px 16px" } }}>
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
          {panelProductos}
        </Col>
        <Col xs={24} lg={8} style={{ height: "100%" }}>
          {panelCarrito}
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
            {clienteSeleccionado ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ background: "#d81b87", flexShrink: 0 }} />
                <Text type="secondary" style={{ fontSize: 12, flex: 1 }}>
                  {clienteSeleccionado.nombre_completo}
                  {clienteSeleccionado.nivel_fidelidad && (
                    <Tag
                      color={NIVEL_COLORS[clienteSeleccionado.nivel_fidelidad] || "purple"}
                      style={{ marginLeft: 4, fontSize: 10 }}
                    >
                      {clienteSeleccionado.nivel_fidelidad}
                    </Tag>
                  )}
                </Text>
                <Button
                  size="small"
                  type="link"
                  style={{ padding: 0, fontSize: 11, color: "#d81b87" }}
                  onClick={() => setClienteId(null)}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>Sin cliente asignado</Text>
            )}
          </div>

          {/* Selector de cliente en el modal de cobro */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>
              <UserOutlined /> Cliente (fidelización)
            </Text>
            <Row gutter={6}>
              <Col flex="auto">
                <Select
                  showSearch
                  allowClear
                  placeholder="Buscar por nombre, cédula o teléfono..."
                  style={{ width: "100%" }}
                  value={clienteId}
                  onChange={setClienteId}
                  optionLabelProp="label"
                  filterOption={(input, opt) => {
                    const q = input.toLowerCase().trim();
                    if (!q) return true;
                    const c = clientes.find((x) => x.id === opt?.value);
                    if (!c) return false;
                    return (
                      c.nombre_completo.toLowerCase().includes(q) ||
                      (c.cedula || "").toLowerCase().includes(q) ||
                      (c.telefono || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
                    );
                  }}
                  optionRender={(opt) => {
                    const c = clientes.find((x) => x.id === opt.value);
                    return (
                      <div style={{ lineHeight: 1.3 }}>
                        <div style={{ fontWeight: 500 }}>{c?.nombre_completo}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                          {[c?.cedula ? `CC ${c.cedula}` : null, c?.telefono || null].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    );
                  }}
                  options={clientes.map((c) => ({ value: c.id, label: c.nombre_completo }))}
                />
              </Col>
              <Col>
                <Tooltip title="Crear nuevo cliente">
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setNuevoClienteOpen(true)}
                    style={{ borderColor: "#d81b87", color: "#d81b87" }}
                  />
                </Tooltip>
              </Col>
            </Row>
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

      {/* MODAL NUEVO CLIENTE RÁPIDO */}
      <Modal
        title={<Space><UserOutlined style={{ color: "#d81b87" }} />Nuevo cliente</Space>}
        open={nuevoClienteOpen}
        onCancel={() => { setNuevoClienteOpen(false); nuevoClienteForm.resetFields(); }}
        onOk={crearClienteRapido}
        confirmLoading={creandoCliente}
        okText="Crear cliente"
        cancelText="Cancelar"
        width={420}
        destroyOnHidden
      >
        <Form form={nuevoClienteForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="nombre_completo"
            label="Nombre completo"
            rules={[{ required: true, message: "El nombre es requerido" }]}
          >
            <Input placeholder="Ej: María García" prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item
            name="cedula"
            label="Cédula"
            rules={[{ required: true, message: "La cédula es requerida" }]}
          >
            <Input placeholder="Ej: 1234567890" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="telefono" label="Teléfono">
                <Input placeholder="300 000 0000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="correo@ejemplo.com" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
