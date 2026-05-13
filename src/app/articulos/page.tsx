"use client";

import React, { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef } from "react";
import {
  Card, Button, Typography, Space, Modal, Form, Input, InputNumber,
  Select, Tag, App, Spin, Tooltip, Row, Col, Statistic, Badge, Upload,
  Divider, Grid, Empty, Dropdown, Progress, Table, Radio, Alert, Checkbox, Switch,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MoreOutlined,
  WarningOutlined, TagsOutlined, SearchOutlined, ReloadOutlined,
  InboxOutlined, BarcodeOutlined, ShopOutlined, AppstoreOutlined,
  UnorderedListOutlined, CameraOutlined, EyeOutlined, PercentageOutlined,
  DollarOutlined, RiseOutlined, FallOutlined, ControlOutlined, CopyOutlined,
  FileExcelOutlined, UploadOutlined, CheckOutlined, PrinterOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { normalizarDatosFormulario } from "@utils/form-normalizer";
import { useRouter, useSearchParams } from "next/navigation";
import EscanerCodigo from "@/components/EscanerCodigo";
import { getCatalogosArticulosLocal, mergeCatalogos, type CatalogosArticulos } from "@/utils/articulos-catalogos";
import { listLabelPrinters, printPriceLabels, type LabelPrinter } from "@/utils/label-agent";

let xlsxModulePromise: Promise<typeof import("xlsx")> | null = null;

const loadXlsx = () => {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }
  return xlsxModulePromise;
};

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

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

const formatPrecio = (v: number | string | undefined) =>
  `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const CATEGORIAS_DEFAULT = [
  "Esmaltes", "Bases y Tops", "Maquillaje", "Cuidado de piel",
  "Cejas y pestañas", "Accesorios", "Herramientas", "Insumos",
];

const extractCatalogosFromTicketCampos = (raw: unknown): CatalogosArticulos => {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const catalogos = source.catalogos_articulos;
  if (!catalogos || typeof catalogos !== "object") {
    return { categorias: [], marcas: [], fabricantes: [] };
  }

  return mergeCatalogos(catalogos as Partial<CatalogosArticulos>);
};

type Articulo = {
  id: string;
  nombre: string;
  referencia?: string;
  codigo_barras?: string;
  codigo_secundario?: string;
  categoria?: string;
  precio_venta: number;
  precio_costo?: number;
  stock: number;
  stock_minimo?: number;
  marca?: string;
  descripcion?: string;
  proveedor?: string;
  tamano?: string;
  empaque?: string;
  activo?: boolean;
  imagen_url?: string;
};

type InlineEditableField = "precio_venta" | "stock";

type ImportArticuloDraft = {
  nombre: string;
  referencia?: string;
  codigo_barras?: string;
  codigo_secundario?: string;
  categoria?: string;
  marca?: string;
  proveedor?: string;
  tamano?: string;
  empaque?: string;
  precio_venta: number;
  precio_costo?: number;
  stock: number;
  stock_minimo?: number;
  descripcion?: string;
  activo: boolean;
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.toLowerCase().trim() : "";

const getArticuloProveedor = (articulo: Articulo) =>
  normalizeText((articulo as Articulo & { proveedor_nombre?: string; proveedor_label?: string }).proveedor)
  || normalizeText((articulo as Articulo & { proveedor_nombre?: string; proveedor_label?: string }).proveedor_nombre)
  || normalizeText((articulo as Articulo & { proveedor_nombre?: string; proveedor_label?: string }).proveedor_label);

const getArticuloTamano = (articulo: Articulo) =>
  normalizeText((articulo as Articulo & { talla?: string; presentacion_tamano?: string }).tamano)
  || normalizeText((articulo as Articulo & { talla?: string; presentacion_tamano?: string }).talla)
  || normalizeText((articulo as Articulo & { talla?: string; presentacion_tamano?: string }).presentacion_tamano);

const getArticuloEmpaque = (articulo: Articulo) =>
  normalizeText((articulo as Articulo & { presentacion?: string; tipo_empaque?: string }).empaque)
  || normalizeText((articulo as Articulo & { presentacion?: string; tipo_empaque?: string }).presentacion)
  || normalizeText((articulo as Articulo & { presentacion?: string; tipo_empaque?: string }).tipo_empaque);

const normalizeImportHeader = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

const getImportCell = (row: Record<string, unknown>, aliases: string[]) => {
  const aliasSet = new Set(aliases.map(normalizeImportHeader));
  for (const [rawKey, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeImportHeader(rawKey))) {
      return value;
    }
  }
  return "";
};

const toImportText = (value: unknown) => String(value ?? "").trim();

const toImportNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  let cleaned = raw
    .replace(/\$/g, "")
    .replace(/cop/gi, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "");

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = cleaned.split(",");
    const last = parts[parts.length - 1] ?? "";
    if (parts.length === 2 && last.length === 3) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      cleaned = cleaned.replace(/,/g, ".");
    }
  } else if (hasDot) {
    const parts = cleaned.split(".");
    const last = parts[parts.length - 1] ?? "";
    if (parts.length === 2 && last.length === 3) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapImportRowToArticulo = (row: Record<string, unknown>): ImportArticuloDraft => {
  const nombre = toImportText(getImportCell(row, ["nombre", "producto", "articulo", "ítem", "item"]));
  const referencia = toImportText(getImportCell(row, ["referencia", "ref"])) || undefined;
  const codigoBarras = toImportText(getImportCell(row, ["codigo", "código", "codigo_barras", "codigobarras", "barra", "ean", "sku"])) || undefined;
  const codigoSecundario = toImportText(getImportCell(row, ["codigo_secundario", "codigosecundario", "cod_secundario"])) || undefined;

  const precioVenta = toImportNumber(
    getImportCell(row, ["precio_venta", "precioventa", "precio venta", "precio", "valor", "pvp"]),
    0,
  );

  const precioCosto = toImportNumber(
    getImportCell(row, ["precio_costo", "preciocosto", "precio costo", "costo"]),
    0,
  );

  const stock = toImportNumber(getImportCell(row, ["stock", "cantidad", "existencia", "inventario"]), 0);
  const stockMinimo = toImportNumber(getImportCell(row, ["stock_minimo", "stock minimo", "minimo", "min"]), 3);

  return {
    nombre,
    referencia,
    codigo_barras: codigoBarras,
    codigo_secundario: codigoSecundario,
    categoria: toImportText(getImportCell(row, ["categoria", "categoría", "linea", "línea"])) || undefined,
    marca: toImportText(getImportCell(row, ["marca"])) || undefined,
    proveedor: toImportText(getImportCell(row, ["proveedor", "distribuidor"])) || undefined,
    tamano: toImportText(getImportCell(row, ["tamano", "tamaño", "presentacion", "presentación", "size"])) || undefined,
    empaque: toImportText(getImportCell(row, ["empaque", "envase", "tipo_empaque"])) || undefined,
    precio_venta: precioVenta,
    precio_costo: precioCosto > 0 ? precioCosto : undefined,
    stock,
    stock_minimo: stockMinimo > 0 ? stockMinimo : undefined,
    descripcion: toImportText(getImportCell(row, ["descripcion", "descripción", "detalle"])) || undefined,
    activo: true,
  };
};

export default function ArticulosPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const processedQuickCodeRef = useRef<string | null>(null);
  const searchParamQ = searchParams.get("q")?.trim() ?? "";
  const searchParamCategoria = searchParams.get("categoria")?.trim() || null;
  const searchParamMarca = Array.from(new Set(
    searchParams.getAll("marca").map((value) => value.trim()).filter(Boolean)
  ));
  const searchParamProveedor = searchParams.get("proveedor")?.trim() ?? "";
  const searchParamTamano = searchParams.get("tamano")?.trim() ?? "";
  const searchParamEmpaque = searchParams.get("empaque")?.trim() ?? "";
  const searchParamVista = searchParams.get("vista") === "grid" ? "grid" : "lista";

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Articulo | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(searchParamQ);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(searchParamCategoria);
  const [filtroMarca, setFiltroMarca] = useState<string[]>(searchParamMarca);
  const [filtroProveedor, setFiltroProveedor] = useState(searchParamProveedor);
  const [filtroTamano, setFiltroTamano] = useState(searchParamTamano);
  const [filtroEmpaque, setFiltroEmpaque] = useState(searchParamEmpaque);
  const [vista, setVista] = useState<"grid" | "lista">(searchParamVista);
  const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkForm] = Form.useForm();
  const [inlineDrafts, setInlineDrafts] = useState<Record<string, Partial<Pick<Articulo, InlineEditableField>>>>({});
  const [inlineSaving, setInlineSaving] = useState<Record<string, Partial<Record<InlineEditableField, boolean>>>>({});
  const [inlineJustSaved, setInlineJustSaved] = useState<Record<string, Partial<Record<InlineEditableField, boolean>>>>({});
  const inlineFeedbackTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  // Importación Excel
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importFileName, setImportFileName] = useState("");

  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelPrinters, setLabelPrinters] = useState<LabelPrinter[]>([]);
  const [selectedLabelPrinter, setSelectedLabelPrinter] = useState<string | null>(null);
  const [loadingLabelPrinters, setLoadingLabelPrinters] = useState(false);
  const [printingLabels, setPrintingLabels] = useState(false);
  const [labelItems, setLabelItems] = useState<{ articuloId: string; nombre: string; precio: number; cantidad: number; sku?: string; codigoCorto?: string }[]>([]);
  const [mostrarCodigoCortoEnEtiqueta, setMostrarCodigoCortoEnEtiqueta] = useState(true);
  const [nombreTienda, setNombreTienda] = useState("La Cosmetikera");
  const LABEL_PRINTER_STORAGE_KEY = "pos_label_printer_name_v1";

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
  }, [LABEL_PRINTER_STORAGE_KEY]);

  const importRowsParsed = useMemo(
    () => importRows.map((row) => mapImportRowToArticulo(row)),
    [importRows],
  );
  const codigoBarrasValue = Form.useWatch("codigo_barras", form);
  const [catalogosCustom, setCatalogosCustom] = useState<CatalogosArticulos>({
    categorias: [],
    marcas: [],
    fabricantes: [],
  });
  const [gridVisibleCount, setGridVisibleCount] = useState(120);
  const deferredSearch = useDeferredValue(search);

  const cargar = useCallback(async () => {
    setLoading(true);
    const pageSize = 1000;
    const norm = (a: Articulo): Articulo => ({
      ...a,
      categoria: normalizeTagField(a.categoria),
      marca: normalizeTagField(a.marca),
      proveedor: normalizeTagField(a.proveedor),
    });

    // Obtener primera página + total en una sola petición
    const { data: firstBatch, error, count } = await supabaseBrowserClient
      .from("articulos")
      .select("*", { count: "exact" })
      .order("nombre")
      .range(0, pageSize - 1);

    if (error) {
      setArticulos([]);
      setLoading(false);
      return;
    }

    // Mostrar datos inmediatamente sin esperar páginas restantes
    setArticulos((firstBatch || []).map(norm) as Articulo[]);
    setLoading(false);

    // Cargar páginas adicionales en paralelo (si hay más de 1000 artículos)
    if (count && count > pageSize) {
      const remainingPages = Math.ceil((count - pageSize) / pageSize);
      const requests = Array.from({ length: remainingPages }, (_, i) =>
        supabaseBrowserClient
          .from("articulos")
          .select("*")
          .order("nombre")
          .range((i + 1) * pageSize, (i + 2) * pageSize - 1)
      );
      const results = await Promise.all(requests);
      const extra = results.flatMap((r) => (r.data || []).map(norm)) as Articulo[];
      if (extra.length > 0) {
        setArticulos((prev) => [...prev, ...extra]);
      }
    }
  }, []);

  const cargarCatalogosCompartidos = useCallback(async () => {
    const localCatalogos = getCatalogosArticulosLocal();

    try {
      const { data, error } = await supabaseBrowserClient
        .from("configuracion")
        .select("ticket_campos, nombre_academia")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data?.nombre_academia) setNombreTienda(String(data.nombre_academia).trim() || "La Cosmetikera");
      const supabaseCatalogos = extractCatalogosFromTicketCampos(data?.ticket_campos);
      setCatalogosCustom(mergeCatalogos(localCatalogos, supabaseCatalogos));
    } catch (error) {
      console.error("No se pudieron cargar catálogos compartidos:", error);
      setCatalogosCustom(localCatalogos);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Auto-generar codigo_secundario = últimos 6 dígitos del codigo_barras
  useEffect(() => {
    if (!modalOpen) return;
    const barras = String(codigoBarrasValue || "").trim();
    const generado = barras.length >= 1 ? barras.slice(-6) : "";
    form.setFieldValue("codigo_secundario", generado || undefined);
  }, [codigoBarrasValue, modalOpen, form]);

  const cargarImpresorasEtiquetas = useCallback(async () => {
    setLoadingLabelPrinters(true);
    try {
      const printers = await listLabelPrinters();
      setLabelPrinters(printers);
      const preferred = typeof window !== "undefined" ? window.localStorage.getItem(LABEL_PRINTER_STORAGE_KEY) : null;
      const preferredExists = preferred && printers.some((p) => p.name === preferred);
      const resolved = preferredExists ? preferred : (printers.find((p) => p.isDefault)?.name ?? printers[0]?.name ?? null);
      actualizarImpresoraEtiquetas(resolved);
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
  }, [LABEL_PRINTER_STORAGE_KEY, actualizarImpresoraEtiquetas, message]);

  const resolverCodigoEtiqueta = useCallback((articulo: Partial<Articulo>) => {
    // El codigo_secundario es siempre los últimos 6 dígitos del codigo_barras
    const barras = String(articulo.codigo_barras || "").trim();
    return String(
      articulo.codigo_secundario ||
      (barras ? barras.slice(-6) : "") ||
      barras ||
      articulo.id || ""
    ).trim();
  }, []);

  const abrirModalEtiquetaArticulo = useCallback(async (articulo: Articulo) => {
    const codigoEtiqueta = resolverCodigoEtiqueta(articulo);
    setLabelItems([{ articuloId: articulo.id, nombre: articulo.nombre, precio: articulo.precio_venta, cantidad: 1, sku: codigoEtiqueta, codigoCorto: codigoEtiqueta }]);
    setLabelModalOpen(true);
    await cargarImpresorasEtiquetas();
  }, [cargarImpresorasEtiquetas, resolverCodigoEtiqueta]);

  const abrirModalEtiquetasSeleccion = useCallback(async () => {
    const ids = new Set(selectedIds.map(String));
    const selectedArticulos = articulos.filter((a) => ids.has(String(a.id)));
    if (!selectedArticulos.length) {
      message.warning("Selecciona al menos un articulo");
      return;
    }

    setLabelItems(
      selectedArticulos.map((a) => ({
        articuloId: a.id,
        nombre: a.nombre,
        precio: a.precio_venta,
        cantidad: 1,
        sku: resolverCodigoEtiqueta(a),
        codigoCorto: resolverCodigoEtiqueta(a),
      }))
    );
    setLabelModalOpen(true);
    await cargarImpresorasEtiquetas();
  }, [articulos, cargarImpresorasEtiquetas, message, resolverCodigoEtiqueta, selectedIds]);

  const imprimirEtiquetasArticulo = useCallback(async () => {
    const printerName = String(selectedLabelPrinter || "").trim();
    if (!printerName) {
      message.warning("Selecciona una impresora de etiquetas");
      return;
    }

    const items = labelItems
      .filter((i) => i.cantidad > 0)
      .map((i) => ({
        name: i.nombre,
        price: i.precio,
        quantity: i.cantidad,
        dataMatrix: String(i.sku || i.articuloId).trim(),
        sku: i.sku,
        shortCode: i.codigoCorto,
      }));

    if (!items.length) {
      message.warning("No hay etiquetas para imprimir");
      return;
    }

    setPrintingLabels(true);
    try {
      const result = await printPriceLabels(items, printerName, nombreTienda, mostrarCodigoCortoEnEtiqueta);
      actualizarImpresoraEtiquetas(printerName);
      message.success(`Etiquetas enviadas: ${result.totalLabels} (${result.pages} fila(s))`);
      setLabelModalOpen(false);
    } catch (error: any) {
      message.error(error?.message || "No fue posible imprimir etiquetas");
    } finally {
      setPrintingLabels(false);
    }
  }, [actualizarImpresoraEtiquetas, labelItems, message, mostrarCodigoCortoEnEtiqueta, nombreTienda, selectedLabelPrinter]);

  useEffect(() => {
    void cargarCatalogosCompartidos();
  }, [cargarCatalogosCompartidos]);

  useEffect(() => {
    const quickCode = searchParams.get("quickCode")?.trim();
    if (!quickCode) return;
    if (processedQuickCodeRef.current === quickCode) return;

    processedQuickCodeRef.current = quickCode;
    setEditing(null);
    form.setFieldsValue({
      activo: true,
      stock: 0,
      stock_minimo: 3,
      codigo_barras: quickCode,
      referencia: quickCode,
    });
    setModalOpen(true);
    message.info(`Creación rápida iniciada para código ${quickCode}`);
  }, [searchParams, form, message]);

  const articulosIndex = useMemo(() => articulos.map((a) => {
    const proveedor = getArticuloProveedor(a);
    const tamano = getArticuloTamano(a);
    const empaque = getArticuloEmpaque(a);

    return {
      articulo: a,
      searchableText: [
        a.nombre,
        a.referencia,
        a.codigo_secundario,
        a.codigo_barras,
        a.marca,
        a.categoria,
        a.descripcion,
        proveedor,
        tamano,
        empaque,
      ].map(normalizeText).join(" "),
      proveedorSource: [proveedor, a.descripcion, a.nombre, a.marca].map(normalizeText).join(" "),
      tamanoSource: [tamano, a.descripcion, a.nombre].map(normalizeText).join(" "),
      empaqueSource: [empaque, a.descripcion, a.nombre].map(normalizeText).join(" "),
    };
  }), [articulos]);

  const articulosFiltrados = useMemo(() => {
    const normalizedSearch = normalizeText(deferredSearch);
    const normalizedProveedor = normalizeText(filtroProveedor);
    const normalizedTamano = normalizeText(filtroTamano);
    const normalizedEmpaque = normalizeText(filtroEmpaque);

    return articulosIndex
      .filter((item) => {
        const a = item.articulo;
        const matchSearch = !normalizedSearch || item.searchableText.includes(normalizedSearch);
        const matchCat = !filtroCategoria || a.categoria === filtroCategoria;
        const matchMarca = filtroMarca.length === 0 || filtroMarca.includes(a.marca || "");
        const matchProveedor = !normalizedProveedor || item.proveedorSource.includes(normalizedProveedor);
        const matchTamano = !normalizedTamano || item.tamanoSource.includes(normalizedTamano);
        const matchEmpaque = !normalizedEmpaque || item.empaqueSource.includes(normalizedEmpaque);
        return matchSearch && matchCat && matchMarca && matchProveedor && matchTamano && matchEmpaque;
      })
      .map((item) => item.articulo);
  }, [articulosIndex, deferredSearch, filtroCategoria, filtroMarca, filtroProveedor, filtroTamano, filtroEmpaque]);

  const stockBajo = useMemo(() => articulos.filter((a) => a.stock <= (a.stock_minimo ?? 3)), [articulos]);
  const valorInventario = useMemo(() => articulos.reduce((s, a) => s + a.stock * (a.precio_costo || 0), 0), [articulos]);
  const categorias: string[] = useMemo(
    () => [...new Set(articulos.map((a) => a.categoria).filter((v): v is string => Boolean(v)))],
    [articulos],
  );
  const marcas: string[] = useMemo(
    () => [...new Set(articulos.map((a) => a.marca).filter((v): v is string => Boolean(v)))],
    [articulos],
  );
  const fabricantes: string[] = useMemo(
    () => [...new Set(articulos
      .map((a) =>
        String(
          a.proveedor
          || (a as Articulo & { proveedor_nombre?: string; proveedor_label?: string }).proveedor_nombre
          || (a as Articulo & { proveedor_nombre?: string; proveedor_label?: string }).proveedor_label
          || ""
        ).trim()
      )
      .filter(Boolean)
    )],
    [articulos],
  );
  const codigoBarrasIndex = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string }>();
    for (const a of articulos) {
      const code = normalizeText(a.codigo_barras);
      if (!code || a.id === editing?.id) continue;
      map.set(code, { id: a.id, nombre: a.nombre });
    }
    return map;
  }, [articulos, editing?.id]);

  const catalogosDisponibles = useMemo(
    () => mergeCatalogos(
      {
        categorias: [...CATEGORIAS_DEFAULT, ...categorias],
        marcas,
        fabricantes,
      },
      catalogosCustom,
    ),
    [categorias, marcas, fabricantes, catalogosCustom],
  );
  const articulosGridVisibles = useMemo(
    () => articulosFiltrados.slice(0, gridVisibleCount),
    [articulosFiltrados, gridVisibleCount],
  );
  const faltanGrid = Math.max(0, articulosFiltrados.length - articulosGridVisibles.length);
  const selectedCount = selectedIds.length;

  useEffect(() => {
    setGridVisibleCount(120);
  }, [search, filtroCategoria, filtroMarca, filtroProveedor, filtroTamano, filtroEmpaque, vista]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => articulosFiltrados.some((a) => a.id === id));
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [articulosFiltrados]);

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
      const updates = articulosAjuste.map((art) => {
        const item: Record<string, unknown> = { id: art.id };
        if (ajusteCampo !== "precio_costo") item.precio_venta = art.nuevo_precio_venta;
        if (ajusteCampo !== "precio_venta") item.precio_costo = art.nuevo_precio_costo;
        return item;
      });
      const res = await fetch("/api/articulos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(json.error || "Error de servidor");
      if (json.errores > 0) message.warning(`${json.errores} artículo(s) no se pudieron actualizar`);
      else message.success(`✅ ${articulosAjuste.length} artículo(s) actualizados`);
      // Actualizar precios en estado local sin re-fetch
      const preciosMap = new Map(
        articulosAjuste.map((a) => [a.id, { nuevo_precio_venta: a.nuevo_precio_venta, nuevo_precio_costo: a.nuevo_precio_costo }])
      );
      setArticulos((prev) =>
        prev.map((a) => {
          const upd = preciosMap.get(a.id);
          if (!upd) return a;
          return {
            ...a,
            ...(ajusteCampo !== "precio_costo" ? { precio_venta: upd.nuevo_precio_venta } : {}),
            ...(ajusteCampo !== "precio_venta" ? { precio_costo: upd.nuevo_precio_costo } : {}),
          };
        })
      );
      setAjusteOpen(false);
      setAjusteValor(0);
      setAjusteFiltroCategoria([]);
      setAjusteFiltrMarca([]);
    } catch (e: unknown) {
      message.error((e as Error)?.message || "Error al aplicar ajuste masivo");
    } finally {
      setAplicandoAjuste(false);
    }
  };

  const handleArchivoImport = (file: File) => {
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await loadXlsx();
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("El archivo no contiene hojas válidas");
        }
        const ws = wb.Sheets[firstSheetName];
        if (!ws) {
          throw new Error("No se pudo acceder a la hoja del archivo");
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        setImportRows(rows);
      } catch {
        message.error("No se pudo leer el archivo. Asegúrate que sea .xlsx, .xls o .csv");
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // prevent auto-upload
  };

  const COLUMNAS_IMPORT = [
    { key: "nombre",            label: "nombre (requerido)" },
    { key: "codigo_barras",     label: "codigo (código de barras / sku)" },
    { key: "referencia",        label: "referencia" },
    { key: "codigo_secundario", label: "codigo_secundario" },
    { key: "categoria",         label: "categoria" },
    { key: "marca",             label: "marca" },
    { key: "proveedor",         label: "proveedor" },
    { key: "tamano",            label: "tamano" },
    { key: "empaque",           label: "empaque" },
    { key: "precio_venta",      label: "precio_venta" },
    { key: "precio_costo",      label: "precio_costo" },
    { key: "stock",             label: "stock" },
    { key: "stock_minimo",      label: "stock_minimo" },
    { key: "descripcion",       label: "descripcion" },
  ];

  const confirmarImport = async () => {
    if (importRows.length === 0) { message.warning("No hay filas para importar"); return; }
    setImportLoading(true);
    try {
      const articulos_nuevos = importRowsParsed.filter((a) => a.nombre);

      if (articulos_nuevos.length === 0) {
        message.error("Ninguna fila tiene columna 'nombre' válida");
        return;
      }

      const res = await fetch("/api/articulos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articulos: articulos_nuevos }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al importar");

      message.success(`✅ ${articulos_nuevos.length} artículo(s) importados`);
      setImportOpen(false);
      setImportRows([]);
      setImportFileName("");
      cargar();
    } catch (e: unknown) {
      message.error((e as Error)?.message || "Error al importar");
    } finally {
      setImportLoading(false);
    }
  };

  const descargarPlantilla = async () => {
    const XLSX = await loadXlsx();
    const ws = XLSX.utils.aoa_to_sheet([
      ["nombre", "codigo_barras", "referencia", "codigo_secundario", "categoria", "marca", "proveedor", "tamano", "empaque", "precio_venta", "precio_costo", "stock", "stock_minimo", "descripcion"],
      ["Esmalte Ejemplo", "7701234567890", "COD-001", "REF-A", "Esmaltes", "OPI", "Distribuidor ABC", "15 ml", "Frasco", 15000, 8000, 20, 3, "Esmalte de ejemplo"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Artículos");
    XLSX.writeFile(wb, "plantilla_articulos.xlsx");
  };

  const openModal = (art?: Articulo) => {
    setEditing(art || null);
    form.setFieldsValue(art ? {
      ...art,
      categoria: art.categoria ? [art.categoria] : undefined,
      marca: art.marca ? [art.marca] : undefined,
      proveedor: art.proveedor ? [art.proveedor] : undefined,
    } : { activo: true, stock: 0, stock_minimo: 3 });
    setModalOpen(true);
  };

  const verificarCodigoBarrasRapido = useCallback(async (codigo: string) => {
    const cleaned = String(codigo || "").trim();
    if (!cleaned) return;

    const normalized = normalizeText(cleaned);
    const existeLocal = codigoBarrasIndex.get(normalized);
    if (existeLocal) {
      message.warning(`Código ya existe en "${existeLocal.nombre}"`);
      return;
    }

    // Fallback puntual: por si se creó en otro dispositivo y aún no está en memoria local.
    const query = supabaseBrowserClient
      .from("articulos")
      .select("id,nombre")
      .eq("codigo_barras", cleaned)
      .limit(1);

    const filteredQuery = editing?.id
      ? query.neq("id", editing.id)
      : query;

    const { data } = await filteredQuery.maybeSingle();

    if (data?.nombre) {
      message.warning(`Código ya existe en "${data.nombre}"`);
    }
  }, [codigoBarrasIndex, editing?.id, message]);

  const duplicarArticulo = (art: Articulo) => {
    setEditing(null); // es nuevo, no edición
    form.setFieldsValue({
      nombre: `${art.nombre} (copia)`,
      codigo_barras: undefined,
      categoria: art.categoria ? [art.categoria] : undefined,
      marca: art.marca ? [art.marca] : undefined,
      proveedor: art.proveedor ? [art.proveedor] : undefined,
      tamano: art.tamano,
      empaque: art.empaque,
      descripcion: art.descripcion,
      precio_venta: art.precio_venta,
      precio_costo: art.precio_costo,
      stock: 0,
      stock_minimo: art.stock_minimo,
      imagen_url: art.imagen_url,
      activo: true,
      codigo_secundario: undefined,
    });
    setModalOpen(true);
  };

  const handleGuardar = async () => {
    const values = await form.validateFields();
    // El Select con mode="tags" devuelve array; normalizar a string
    if (Array.isArray(values.categoria)) values.categoria = values.categoria[0] ?? undefined;
    if (Array.isArray(values.marca)) values.marca = values.marca[0] ?? undefined;
    if (Array.isArray(values.proveedor)) values.proveedor = values.proveedor[0] ?? undefined;
    const datosNormalizados = normalizarDatosFormulario(values);
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/articulos?id=${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(datosNormalizados),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al actualizar");
        // Actualizar estado local sin re-fetch
        setArticulos((prev) =>
          prev.map((a) =>
            a.id === editing.id ? { ...a, ...(datosNormalizados as Partial<Articulo>) } : a
          )
        );
        message.success("Artículo actualizado");
      } else {
        const res = await fetch("/api/articulos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articulo: datosNormalizados }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al crear");
        // Agregar al estado local sin re-fetch
        const created = (json.data as Articulo[] | undefined)?.[0];
        if (created) {
          setArticulos((prev) => [
            {
              ...created,
              categoria: normalizeTagField(created.categoria),
              marca: normalizeTagField(created.marca),
              proveedor: normalizeTagField(created.proveedor),
            },
            ...prev,
          ]);
        }
        message.success("Artículo creado");
      }
      setModalOpen(false);
    } catch (e: unknown) {
      message.error((e as Error)?.message || "Error al guardar");
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
        const res = await fetch(`/api/articulos?id=${art.id}`, { method: "DELETE" });
        const json = await res.json();
        if (!res.ok) { message.error(json.error || "Error al eliminar"); return; }
        setArticulos((prev) => prev.filter((a) => a.id !== art.id));
        message.success("Eliminado");
      },
    });
  };

  const eliminarSeleccionados = () => {
    if (selectedCount === 0) {
      message.warning("Selecciona artículos para eliminar");
      return;
    }

    modal.confirm({
      title: `Eliminar ${selectedCount} artículo(s)`,
      content: "Esta acción no se puede deshacer.",
      okType: "danger",
      okText: "Eliminar seleccionados",
      cancelText: "Cancelar",
      onOk: async () => {
        const results = await Promise.all(
          selectedIds.map(async (id) => {
            const res = await fetch(`/api/articulos?id=${id}`, { method: "DELETE" });
            return res.ok;
          })
        );

        const okCount = results.filter(Boolean).length;
        const failCount = results.length - okCount;

        if (okCount > 0) message.success(`${okCount} artículo(s) eliminado(s)`);
        if (failCount > 0) message.warning(`${failCount} artículo(s) no se pudieron eliminar`);

        // Quitar del estado local los que se eliminaron con éxito
        const eliminadosIds = new Set(
          selectedIds.filter((_, i) => results[i]).map(String)
        );
        setArticulos((prev) => prev.filter((a) => !eliminadosIds.has(a.id)));
        setSelectedIds([]);
      },
    });
  };

  const aplicarCambiosSeleccionados = async () => {
    if (selectedCount === 0) {
      message.warning("Selecciona artículos para modificar");
      return;
    }

    const values = await bulkForm.validateFields();
    const payload: Record<string, unknown> = {};

    if (typeof values.categoria === "string" && values.categoria.trim()) payload.categoria = values.categoria.trim();
    if (typeof values.marca === "string" && values.marca.trim()) payload.marca = values.marca.trim();
    if (typeof values.proveedor === "string" && values.proveedor.trim()) payload.proveedor = values.proveedor.trim();
    if (typeof values.tamano === "string" && values.tamano.trim()) payload.tamano = values.tamano.trim();
    if (typeof values.empaque === "string" && values.empaque.trim()) payload.empaque = values.empaque.trim();
    if (typeof values.stock_minimo === "number") payload.stock_minimo = values.stock_minimo;
    if (typeof values.descuento_porcentaje === "number") payload.descuento_porcentaje = values.descuento_porcentaje;
    if (typeof values.activo === "boolean") payload.activo = values.activo;

    if (Object.keys(payload).length === 0) {
      message.warning("Define al menos un cambio para aplicar");
      return;
    }

    setBulkSaving(true);
    try {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          const res = await fetch(`/api/articulos?id=${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          return res.ok;
        })
      );

      const okCount = results.filter(Boolean).length;
      const failCount = results.length - okCount;
      if (okCount > 0) message.success(`${okCount} artículo(s) actualizado(s)`);
      if (failCount > 0) message.warning(`${failCount} artículo(s) no se pudieron actualizar`);

      // Actualizar estado local de los que tuvieron éxito
      const actualizadosIds = new Set(
        selectedIds.filter((_, i) => results[i]).map(String)
      );
      setArticulos((prev) =>
        prev.map((a) =>
          actualizadosIds.has(a.id) ? { ...a, ...(payload as Partial<Articulo>) } : a
        )
      );
      setBulkEditOpen(false);
      bulkForm.resetFields();
    } catch {
      message.error("Error al aplicar cambios masivos");
    } finally {
      setBulkSaving(false);
    }
  };

  useEffect(() => () => {
    for (const timeoutId of Object.values(inlineFeedbackTimersRef.current)) {
      clearTimeout(timeoutId);
    }
  }, []);

  const normalizeInlineValue = (field: InlineEditableField, value: number) => {
    if (field === "stock") {
      return Math.max(0, Math.trunc(value));
    }
    return Math.max(0, Math.round(value));
  };

  const setInlineDraftValue = (id: string, field: InlineEditableField, value: number | null) => {
    setInlineDrafts((prev) => {
      const current = prev[id] ?? {};

      if (value === null || Number.isNaN(value)) {
        const nextForId = { ...current };
        delete nextForId[field];
        if (Object.keys(nextForId).length === 0) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return { ...prev, [id]: nextForId };
      }

      return {
        ...prev,
        [id]: {
          ...current,
          [field]: normalizeInlineValue(field, value),
        },
      };
    });
  };

  const getInlineDisplayValue = (articulo: Articulo, field: InlineEditableField) => {
    const draft = inlineDrafts[articulo.id]?.[field];
    return typeof draft === "number" ? draft : articulo[field];
  };

  const isInlineDirty = (articulo: Articulo, field: InlineEditableField) => {
    const draft = inlineDrafts[articulo.id]?.[field];
    return typeof draft === "number" && draft !== articulo[field];
  };

  const clearInlineDraft = (id: string, field: InlineEditableField) => {
    setInlineDrafts((prev) => {
      const current = prev[id];
      if (!current || !Object.prototype.hasOwnProperty.call(current, field)) return prev;

      const nextForId = { ...current };
      delete nextForId[field];

      if (Object.keys(nextForId).length === 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }

      return { ...prev, [id]: nextForId };
    });
  };

  const setInlineSavingState = (id: string, field: InlineEditableField, savingField: boolean) => {
    setInlineSaving((prev) => {
      const current = prev[id] ?? {};
      const nextForId = {
        ...current,
        [field]: savingField,
      };

      const hasAny = Object.values(nextForId).some(Boolean);
      if (!hasAny) {
        const next = { ...prev };
        delete next[id];
        return next;
      }

      return { ...prev, [id]: nextForId };
    });
  };

  const setInlineSavedFeedback = (id: string, field: InlineEditableField) => {
    const key = `${id}:${field}`;

    setInlineJustSaved((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {}),
        [field]: true,
      },
    }));

    const currentTimer = inlineFeedbackTimersRef.current[key];
    if (currentTimer) {
      clearTimeout(currentTimer);
    }

    inlineFeedbackTimersRef.current[key] = setTimeout(() => {
      setInlineJustSaved((prev) => {
        const current = prev[id];
        if (!current) return prev;

        const nextForId = { ...current };
        delete nextForId[field];

        if (Object.keys(nextForId).length === 0) {
          const next = { ...prev };
          delete next[id];
          return next;
        }

        return { ...prev, [id]: nextForId };
      });

      delete inlineFeedbackTimersRef.current[key];
    }, 1400);
  };

  const guardarCampoInline = async (articulo: Articulo, field: InlineEditableField) => {
    const draft = inlineDrafts[articulo.id]?.[field];
    if (typeof draft !== "number") return;

    const normalizedValue = normalizeInlineValue(field, draft);
    if (normalizedValue === articulo[field]) {
      clearInlineDraft(articulo.id, field);
      return;
    }

    setInlineSavingState(articulo.id, field, true);
    try {
      const res = await fetch(`/api/articulos?id=${articulo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: normalizedValue }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "No se pudo actualizar el artículo");
      }

      setArticulos((prev) => prev.map((item) => (
        item.id === articulo.id
          ? { ...item, [field]: normalizedValue }
          : item
      )));

      clearInlineDraft(articulo.id, field);
      setInlineSavedFeedback(articulo.id, field);
      message.success(field === "precio_venta" ? "Precio actualizado" : "Stock actualizado");
    } catch (e: unknown) {
      message.error((e as Error)?.message || "Error al guardar cambios rápidos");
    } finally {
      setInlineSavingState(articulo.id, field, false);
    }
  };

  const renderInlineNumberEditor = (articulo: Articulo, field: InlineEditableField) => {
    const value = getInlineDisplayValue(articulo, field);
    const savingField = Boolean(inlineSaving[articulo.id]?.[field]);
    const dirtyField = isInlineDirty(articulo, field);
    const justSavedField = Boolean(inlineJustSaved[articulo.id]?.[field]);

    return (
      <Space
        size={4}
        onClick={detenerEvento}
        onMouseDown={detenerEvento}
        data-stop-row-nav="true"
        style={{
          padding: justSavedField ? "2px 4px" : undefined,
          borderRadius: 8,
          background: justSavedField ? "#f6ffed" : undefined,
          transition: "background-color 220ms ease",
        }}
      >
        <InputNumber
          min={0}
          precision={0}
          step={field === "precio_venta" ? 500 : 1}
          value={typeof value === "number" ? value : 0}
          onChange={(next) => setInlineDraftValue(articulo.id, field, next)}
          onPressEnter={() => { if (dirtyField && !savingField) void guardarCampoInline(articulo, field); }}
          style={{ width: field === "precio_venta" ? 120 : 90 }}
          disabled={savingField}
        />
        {dirtyField && (
          <Tooltip title="Guardar cambio rápido">
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              loading={savingField}
              onClick={(event) => {
                detenerEvento(event);
                void guardarCampoInline(articulo, field);
              }}
            />
          </Tooltip>
        )}
      </Space>
    );
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

  const irADetalle = (id: string) => {
    const params = new URLSearchParams();
    const query = search.trim();

    if (query) params.set("q", query);
    if (filtroCategoria) params.set("categoria", filtroCategoria);
    for (const marca of filtroMarca) {
      const marcaTrimmed = marca.trim();
      if (marcaTrimmed) params.append("marca", marcaTrimmed);
    }
    if (filtroProveedor.trim()) params.set("proveedor", filtroProveedor.trim());
    if (filtroTamano.trim()) params.set("tamano", filtroTamano.trim());
    if (filtroEmpaque.trim()) params.set("empaque", filtroEmpaque.trim());
    if (vista) params.set("vista", vista);

    const suffix = params.toString() ? `?${params.toString()}` : "";
    router.push(`/articulos/show/${id}${suffix}`);
  };

  const irAEditar = (id: string) => {
    const params = new URLSearchParams();
    const query = search.trim();

    if (query) params.set("q", query);
    if (filtroCategoria) params.set("categoria", filtroCategoria);
    for (const marca of filtroMarca) {
      const marcaTrimmed = marca.trim();
      if (marcaTrimmed) params.append("marca", marcaTrimmed);
    }
    if (filtroProveedor.trim()) params.set("proveedor", filtroProveedor.trim());
    if (filtroTamano.trim()) params.set("tamano", filtroTamano.trim());
    if (filtroEmpaque.trim()) params.set("empaque", filtroEmpaque.trim());
    if (vista) params.set("vista", vista);
    params.set("edit", "1");

    router.push(`/articulos/show/${id}?${params.toString()}`);
  };

  const detenerEvento = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const renderCard = (art: Articulo) => (
    <Col key={art.id} xs={12} sm={8} md={6} xl={4}>
      <Card
        hoverable
        style={{ borderRadius: 12, overflow: "hidden", position: "relative", cursor: "pointer" }}
        bodyStyle={{ padding: 12 }}
        onClick={() => irADetalle(art.id)}
        cover={
          <div style={{
            height: 110, background: "linear-gradient(135deg,#fce4f8,#f0d6ff)",
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
          }}>
            {art.imagen_url
              ? <img src={art.imagen_url} alt={art.nombre} style={{ height: "100%", objectFit: "cover", width: "100%" }} />
              : <ShopOutlined style={{ fontSize: 40, color: "#d81b87", opacity: 0.4 }} />
            }
            <div style={{ position: "absolute", top: 6, left: 6 }}>
              <Checkbox
                checked={selectedIds.includes(art.id)}
                onClick={detenerEvento}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setSelectedIds((prev) =>
                    checked ? [...new Set([...prev, art.id])] : prev.filter((id) => id !== art.id)
                  );
                }}
              />
            </div>
            <div style={{ position: "absolute", top: 6, right: 6 }}>
              {getStockTag(art)}
            </div>
          </div>
        }
        actions={[
          <Tooltip key="view" title="Ver detalle">
            <EyeOutlined onClick={(event) => { detenerEvento(event); irADetalle(art.id); }} />
          </Tooltip>,
          <Tooltip key="edit" title="Editar artículo">
            <EditOutlined onClick={(event) => { detenerEvento(event); irAEditar(art.id); }} />
          </Tooltip>,
          <Tooltip key="copy" title="Duplicar artículo">
            <CopyOutlined style={{ color: "#1677ff" }} onClick={(event) => { detenerEvento(event); duplicarArticulo(art); }} />
          </Tooltip>,
          <Tooltip key="del" title="Eliminar">
            <DeleteOutlined style={{ color: "#ff4d4f" }} onClick={(event) => { detenerEvento(event); handleEliminar(art); }} />
          </Tooltip>,
          <Tooltip key="label" title="Imprimir etiqueta">
            <PrinterOutlined style={{ color: "#9c27b0" }} onClick={(event) => { detenerEvento(event); abrirModalEtiquetaArticulo(art); }} />
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
            {`$${Number(art.precio_venta).toLocaleString()}`}
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
          <Col xs={24} sm="auto">
            <Space wrap size={[6, 6]}>
              <Button
                icon={vista === "grid" ? <UnorderedListOutlined /> : <AppstoreOutlined />}
                onClick={() => setVista(vista === "grid" ? "lista" : "grid")}
              />
              <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
              <Button
                icon={<FileExcelOutlined />}
                onClick={() => setImportOpen(true)}
              >
                {isMobile ? "Importar" : "Importar Excel"}
              </Button>
              <Button
                icon={<ControlOutlined />}
                onClick={() => setAjusteOpen(true)}
              >
                {isMobile ? "Precios" : "Ajuste masivo"}
              </Button>
              <Button
                icon={<EditOutlined />}
                disabled={selectedCount === 0}
                onClick={() => setBulkEditOpen(true)}
              >
                {isMobile ? "Editar sel." : `Editar selección (${selectedCount})`}
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={selectedCount === 0}
                onClick={eliminarSeleccionados}
              >
                {isMobile ? "Borrar" : `Borrar selección (${selectedCount})`}
              </Button>
              <Button
                icon={<PrinterOutlined />}
                disabled={selectedCount === 0}
                onClick={abrirModalEtiquetasSeleccion}
                style={{ color: "#9c27b0", borderColor: "#9c27b0" }}
              >
                {isMobile ? "Etiquetas" : `Etiquetas selección (${selectedCount})`}
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
              placeholder="Buscar por palabras parciales (nombre, marca, código, categoría, descripción...)"
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
          <Col xs={24} sm={12} md={6}>
            <Select
              mode="multiple"
              placeholder="Filtrar por marca"
              allowClear
              style={{ width: "100%" }}
              value={filtroMarca}
              onChange={setFiltroMarca}
              options={marcas.map((m) => ({ label: m, value: m }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Proveedor (parcial)"
              value={filtroProveedor}
              onChange={(e) => setFiltroProveedor(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Tamaño (parcial)"
              value={filtroTamano}
              onChange={(e) => setFiltroTamano(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Empaque (parcial)"
              value={filtroEmpaque}
              onChange={(e) => setFiltroEmpaque(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24}>
            <Space wrap>
              <Button
                size="small"
                onClick={() => setSelectedIds(articulosFiltrados.map((a) => a.id))}
                disabled={articulosFiltrados.length === 0}
              >
                Seleccionar filtrados ({articulosFiltrados.length})
              </Button>
              <Button size="small" onClick={() => setSelectedIds([])} disabled={selectedCount === 0}>
                Limpiar selección
              </Button>
              {selectedCount > 0 ? <Tag color="blue">{selectedCount} seleccionado(s)</Tag> : null}
            </Space>
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
      ) : vista === "lista" ? (
        isMobile ? (
          /* ── LISTA MOBILE: tarjetas compactas ── */
          <Row gutter={[8, 8]}>
            {articulosFiltrados.map((a) => (
              <Col xs={24} key={a.id}>
                <Card
                  size="small"
                  style={{ borderRadius: 10 }}
                  bodyStyle={{ padding: "10px 12px" }}
                >
                  <Row align="middle" gutter={8}>
                    <Col>
                      <Checkbox
                        checked={selectedIds.includes(a.id)}
                        onClick={detenerEvento}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedIds((prev) =>
                            checked ? [...new Set([...prev, a.id])] : prev.filter((id) => id !== a.id)
                          );
                        }}
                      />
                    </Col>
                    <Col flex="auto">
                      <Text strong style={{ fontSize: 13, color: "#1677ff", display: "block" }}>{a.nombre}</Text>
                      <Space size={4} wrap style={{ marginTop: 4 }}>
                        {a.marca && <Text type="secondary" style={{ fontSize: 11 }}>{a.marca}</Text>}
                        {a.codigo_barras && <Tag color="blue" style={{ fontSize: 10 }}>{a.codigo_barras}</Tag>}
                        {a.codigo_secundario && <Tag color="geekblue" style={{ fontSize: 10 }}>QR: {a.codigo_secundario}</Tag>}
                        {a.categoria && <Tag color="purple" style={{ fontSize: 10 }}>{a.categoria}</Tag>}
                        {getStockTag(a)}
                      </Space>
                    </Col>
                    <Col>
                      <Text strong style={{ color: "#d81b87", fontSize: 15 }}>${Number(a.precio_venta).toLocaleString()}</Text>
                    </Col>
                    <Col>
                      <Space size={4}>
                        <Button size="small" icon={<EditOutlined />} onClick={(e) => { detenerEvento(e); irAEditar(a.id); }} />
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => { detenerEvento(e); handleEliminar(a); }} />
                        <Button size="small" icon={<PrinterOutlined />} style={{ color: "#9c27b0", borderColor: "#9c27b0" }} onClick={(e) => { detenerEvento(e); abrirModalEtiquetaArticulo(a); }} />
                      </Space>
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Card style={{ borderRadius: 10 }} bodyStyle={{ padding: 0 }}>
          <Table
            dataSource={articulosFiltrados}
            rowKey="id"
            rowSelection={{
              selectedRowKeys: selectedIds,
              onChange: (keys) => setSelectedIds(keys),
              preserveSelectedRowKeys: true,
            }}
            size="small"
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} artículos` }}
            scroll={{ x: 700 }}
            columns={[
              {
                title: "Artículo", key: "nombre",
                render: (_: unknown, a: Articulo) => (
                  <Space size={4} direction="vertical" style={{ lineHeight: 1.3 }}>
                    <Text strong style={{ fontSize: 13, color: "#1677ff" }}>{a.nombre}</Text>
                    {a.marca && <Text type="secondary" style={{ fontSize: 11 }}>{a.marca}</Text>}
                  </Space>
                ),
              },
              {
                title: "Código", key: "ref", width: 130,
                render: (_: unknown, a: Articulo) => (
                  <Space direction="vertical" size={2}>
                    {a.codigo_barras && <Tag color="blue" style={{ fontSize: 10 }}>{a.codigo_barras}</Tag>}
                    {a.codigo_secundario && <Tag color="geekblue" style={{ fontSize: 10 }}>QR: {a.codigo_secundario}</Tag>}
                    {!a.codigo_barras && !a.codigo_secundario && <Text type="secondary">—</Text>}
                  </Space>
                ),
              },
              {
                title: "Categoría", dataIndex: "categoria", width: 120,
                render: (c?: string) => c ? <Tag color="purple" style={{ fontSize: 10 }}>{c}</Tag> : <Text type="secondary">—</Text>,
              },
              {
                title: "P. Venta", dataIndex: "precio_venta", width: 110, align: "right" as const,
                render: (_: number, a: Articulo) => (
                  <Space size={4} direction="vertical" style={{ width: "100%" }}>
                    {renderInlineNumberEditor(a, "precio_venta")}
                    <Text strong style={{ color: "#d81b87", fontSize: 12 }}>
                      {`$${Number(a.precio_venta).toLocaleString()}`}
                    </Text>
                  </Space>
                ),
                sorter: (a: Articulo, b: Articulo) => a.precio_venta - b.precio_venta,
              },
              {
                title: "P. Costo", dataIndex: "precio_costo", width: 100, align: "right" as const,
                render: (v?: number) => v ? <Text type="secondary">{`$${Number(v).toLocaleString()}`}</Text> : <Text type="secondary">—</Text>,
              },
              {
                title: "Stock", dataIndex: "stock", width: 90, align: "center" as const,
                render: (_: number, a: Articulo) => (
                  <Space size={4} direction="vertical" style={{ width: "100%", alignItems: "center" }}>
                    {renderInlineNumberEditor(a, "stock")}
                    {getStockTag(a)}
                  </Space>
                ),
                sorter: (a: Articulo, b: Articulo) => a.stock - b.stock,
              },
              {
                title: "Estado", dataIndex: "activo", width: 80, align: "center" as const,
                render: (v?: boolean) => v === false ? <Tag color="default">Inactivo</Tag> : <Tag color="success">Activo</Tag>,
              },
              {
                title: "Acciones", key: "actions", width: 160, align: "center" as const, fixed: "right" as const,
                render: (_: unknown, a: Articulo) => (
                  <Space size={4}>
                    <Tooltip title="Ver"><Button size="small" icon={<EyeOutlined />} onClick={(event) => { detenerEvento(event); irADetalle(a.id); }} /></Tooltip>
                    <Tooltip title="Editar artículo"><Button size="small" icon={<EditOutlined />} onClick={(event) => { detenerEvento(event); irAEditar(a.id); }} /></Tooltip>
                    <Tooltip title="Duplicar"><Button size="small" icon={<CopyOutlined />} onClick={(event) => { detenerEvento(event); duplicarArticulo(a); }} /></Tooltip>
                    <Tooltip title="Eliminar"><Button size="small" danger icon={<DeleteOutlined />} onClick={(event) => { detenerEvento(event); handleEliminar(a); }} /></Tooltip>
                    <Tooltip title="Imprimir etiqueta"><Button size="small" icon={<PrinterOutlined />} style={{ color: "#9c27b0", borderColor: "#9c27b0" }} onClick={(event) => { detenerEvento(event); abrirModalEtiquetaArticulo(a); }} /></Tooltip>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
        )
      ) : (
        <>
          <Row gutter={[12, 12]}>
            {articulosGridVisibles.map(renderCard)}
          </Row>
          {faltanGrid > 0 && (
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <Button onClick={() => setGridVisibleCount((prev) => prev + 120)}>
                Cargar más ({faltanGrid} restantes)
              </Button>
            </div>
          )}
        </>
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
                      <Text delete type="secondary" style={{ fontSize: 11 }}>{`$${Number(r.precio_venta).toLocaleString()}`}</Text>
                      <Text>→</Text>
                      <Text strong style={{ color: ajusteDireccion === "subir" ? "#52c41a" : "#ff4d4f" }}>
                        {`$${Number(r.nuevo_precio_venta).toLocaleString()}`}
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
                      <Text delete type="secondary" style={{ fontSize: 11 }}>{`$${Number(r.precio_costo || 0).toLocaleString()}`}</Text>
                      <Text>→</Text>
                      <Text strong style={{ color: ajusteDireccion === "subir" ? "#52c41a" : "#ff4d4f" }}>
                        {`$${Number(r.nuevo_precio_costo).toLocaleString()}`}
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

      {/* ── MODAL IMPORTACIÓN EXCEL ── */}
      <Modal
        title={<Space><FileExcelOutlined style={{ color: "#52c41a" }} />Importar artículos desde Excel / CSV</Space>}
        open={importOpen}
        onCancel={() => { setImportOpen(false); setImportRows([]); setImportFileName(""); }}
        width={900}
        footer={null}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          {/* Plantilla */}
          <Card size="small" style={{ background: "#f6ffed", border: "1px solid #b7eb8f" }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text>Descarga la plantilla para ver el formato esperado:</Text>
              </Col>
              <Col>
                <Button icon={<FileExcelOutlined />} size="small" onClick={descargarPlantilla}>
                  Descargar plantilla
                </Button>
              </Col>
            </Row>
            <div style={{ marginTop: 6 }}>
              {COLUMNAS_IMPORT.map((c) => (
                <Tag key={c.key} style={{ fontSize: 10, marginBottom: 2 }}
                  color={c.key === "nombre" ? "red" : "default"}>
                  {c.label}
                </Tag>
              ))}
            </div>
          </Card>

          {/* Subir archivo */}
          <Upload.Dragger
            name="file"
            accept=".xlsx,.xls,.csv"
            showUploadList={false}
            beforeUpload={handleArchivoImport}
            style={{ borderRadius: 8 }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 40, color: "#1677ff" }} />
            </p>
            <p className="ant-upload-text">Arrastra tu archivo aquí o haz clic para seleccionar</p>
            <p className="ant-upload-hint">Formatos soportados: .xlsx, .xls, .csv</p>
            {importFileName && (
              <Tag color="blue" style={{ marginTop: 8 }}>📄 {importFileName}</Tag>
            )}
          </Upload.Dragger>

          {/* Preview */}
          {importRows.length > 0 && (
            <Card size="small"
              title={<Text strong>Vista previa — {importRows.length} fila(s) detectadas</Text>}
            >
              <Table
                dataSource={importRowsParsed.slice(0, 10)}
                rowKey={(_, i) => String(i)}
                size="small"
                pagination={false}
                scroll={{ x: 600 }}
                columns={[
                  { title: "nombre", dataIndex: "nombre", width: 220, ellipsis: true },
                  { title: "codigo_barras", dataIndex: "codigo_barras", width: 140, ellipsis: true },
                  { title: "referencia", dataIndex: "referencia", width: 140, ellipsis: true },
                  {
                    title: "precio_venta",
                    dataIndex: "precio_venta",
                    width: 120,
                    render: (v: unknown) => Number(v || 0).toLocaleString("es-CO"),
                  },
                  {
                    title: "stock",
                    dataIndex: "stock",
                    width: 90,
                    render: (v: unknown) => Number(v || 0),
                  },
                ]}
              />
              {importRows.length > 10 && (
                <Text type="secondary" style={{ fontSize: 11 }}>...y {importRows.length - 10} filas más</Text>
              )}
            </Card>
          )}

          <Row justify="end" gutter={8}>
            <Col>
              <Button onClick={() => { setImportOpen(false); setImportRows([]); setImportFileName(""); }}>Cancelar</Button>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                loading={importLoading}
                disabled={importRows.length === 0}
                onClick={confirmarImport}
                style={{ background: "#52c41a", borderColor: "#52c41a" }}
              >
                Importar {importRows.length > 0 ? `${importRows.length} artículo(s)` : ""}
              </Button>
            </Col>
          </Row>
        </Space>
      </Modal>

      {/* ── MODAL EDICIÓN ── */}
      {/* ── MODAL EDICIÓN ── */}
      <Modal
        title={editing ? "Editar artículo" : "Nuevo artículo"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        width={isMobile ? "calc(100vw - 16px)" : 600}
        style={isMobile ? { top: 8 } : undefined}
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space style={{ justifyContent: "space-between", width: "100%", display: "flex" }}>
            <Button
              icon={<PrinterOutlined />}
              style={{ color: "#9c27b0", borderColor: "#9c27b0" }}
              disabled={!editing}
              title={editing ? "Imprimir etiqueta de este artículo" : "Guarda el artículo primero para imprimir"}
              onClick={() => {
                if (!editing) return;
                const vals = form.getFieldsValue();
                const barras = String(vals.codigo_barras || editing.codigo_barras || "").trim();
                const codigoCorto = String(vals.codigo_secundario || editing.codigo_secundario || (barras ? barras.slice(-6) : "") || "").trim();
                const art: Articulo = {
                  ...editing,
                  nombre: vals.nombre || editing.nombre,
                  precio_venta: vals.precio_venta ?? editing.precio_venta,
                  codigo_barras: barras || undefined,
                  codigo_secundario: codigoCorto || undefined,
                };
                void abrirModalEtiquetaArticulo(art);
              }}
            >
              Imprimir etiqueta
            </Button>
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </Space>
        )}
        onOk={handleGuardar}
        okText={editing ? "Guardar cambios" : "Crear artículo"}
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>

          {/* 1. Escáner primero */}
          <Form.Item
            name="codigo_barras"
            label="Código de barras"
            validateTrigger={["onBlur"]}
            rules={[{
              validator: async (_, value) => {
                if (!value) return;
                const existeNombre = codigoBarrasIndex.get(normalizeText(value));
                if (existeNombre) return Promise.reject(`Ya existe: "${existeNombre.nombre}"`);
              },
            }]}
          >
            <EscanerCodigo
              value={codigoBarrasValue}
              onChange={(value) => {
                form.setFieldValue("codigo_barras", value);
              }}
              onCodigo={async (codigo) => {
                form.setFieldValue("codigo_barras", codigo);
                await verificarCodigoBarrasRapido(codigo);
                form.validateFields(["codigo_barras"]);
              }}
              placeholder="Escanear o escribir código de barras"
              conCamara
              submitOnEnter={false}
            />
          </Form.Item>

          {/* Código secundario auto-generado */}
          <Form.Item
            name="codigo_secundario"
            label="Código corto (auto — últimos 6 dígitos)"
            tooltip="Se genera automáticamente con los últimos 6 dígitos del código de barras. Es el código que se usa en el QR de la etiqueta."
          >
            <Input
              readOnly
              disabled
              prefix={<BarcodeOutlined />}
              placeholder="Se genera del código de barras"
              style={{ background: "#f5f5f5", cursor: "default" }}
            />
          </Form.Item>

          {/* 3. Nombre + precio venta (esenciales) */}
          <Form.Item name="nombre" label="Nombre del artículo" rules={[{ required: true, message: "Requerido" }]}>
            <Input placeholder="Ej: Esmalte Base Coat 15ml" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="precio_venta" label="Precio venta ($)" rules={[{ required: true, message: "Requerido" }]}>
                <InputNumber min={0} style={{ width: "100%" }} formatter={formatPrecio} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="categoria" label="Categoría">
                <Select
                  showSearch allowClear mode="tags" maxCount={1}
                  placeholder="Seleccionar o escribir..."
                  options={catalogosDisponibles.categorias.map((c) => ({ label: c, value: c }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 4. Datos opcionales al final */}
          <Divider style={{ margin: "8px 0", fontSize: 12, color: "#999" }}>Datos opcionales</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="precio_costo" label="Precio costo ($)">
                <InputNumber min={0} style={{ width: "100%" }} formatter={formatPrecio} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="stock" label="Stock inicial">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="stock_minimo" label="Stock mínimo">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="tamano" label="Tamaño">
                <Input placeholder="Ej: 15 ml" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="empaque" label="Empaque">
                <Input placeholder="Ej: Frasco" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="marca" label="Marca">
                <Select
                  showSearch allowClear mode="tags" maxCount={1}
                  placeholder="Seleccionar o escribir..."
                  options={catalogosDisponibles.marcas.map((m) => ({ label: m, value: m }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="proveedor" label="Fabricante / Proveedor">
                <Select
                  showSearch allowClear mode="tags" maxCount={1}
                  placeholder="Seleccionar o escribir..."
                  options={catalogosDisponibles.fabricantes.map((f) => ({ label: f, value: f }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="imagen_url" label="URL imagen">
                <Input placeholder="https://..." prefix={<CameraOutlined />} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item name="descripcion" label="Descripción">
                <Input.TextArea rows={2} placeholder="Notas del producto..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="activo" label="Activo" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Modal>

      <Modal
        title={`Editar ${selectedCount} artículo(s) seleccionados`}
        open={bulkEditOpen}
        onCancel={() => setBulkEditOpen(false)}
        onOk={aplicarCambiosSeleccionados}
        confirmLoading={bulkSaving}
        okText="Aplicar cambios"
        cancelText="Cancelar"
        width={640}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Solo se aplicarán los campos que llenes. Los vacíos no se modifican."
        />
        <Form form={bulkForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="categoria" label="Nueva categoría">
                <Input placeholder="Ej: Tintes" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="marca" label="Nueva marca">
                <Input placeholder="Ej: OPI" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="proveedor" label="Nuevo proveedor">
                <Input placeholder="Ej: Distribuidor XYZ" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="tamano" label="Nuevo tamaño">
                <Input placeholder="Ej: 15 ml" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="empaque" label="Nuevo empaque">
                <Input placeholder="Ej: Frasco" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="stock_minimo" label="Stock mínimo">
                <InputNumber style={{ width: "100%" }} min={0} placeholder="Ej: 3" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="descuento_porcentaje" label="Descuento (%)">
                <InputNumber style={{ width: "100%" }} min={0} max={100} placeholder="Ej: 10" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="activo" label="Estado">
                <Select
                  allowClear
                  placeholder="Sin cambios"
                  options={[
                    { label: "Activo", value: true },
                    { label: "Inactivo", value: false },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={<Space><PrinterOutlined style={{ color: "#9c27b0" }} />Imprimir etiqueta(s)</Space>}
        open={labelModalOpen}
        onCancel={() => setLabelModalOpen(false)}
        width={560}
        footer={[
          <Button key="cancel" onClick={() => setLabelModalOpen(false)}>Cancelar</Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            loading={printingLabels}
            disabled={!selectedLabelPrinter || labelItems.reduce((sum, item) => sum + Number(item.cantidad || 0), 0) === 0}
            onClick={imprimirEtiquetasArticulo}
            style={{ background: "#9c27b0", borderColor: "#9c27b0" }}
          >
            Imprimir {labelItems.reduce((sum, item) => sum + Number(item.cantidad || 0), 0)} etiqueta(s)
          </Button>,
        ]}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Impresora de etiquetas</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              mode="tags"
              showSearch
              loading={loadingLabelPrinters}
              value={selectedLabelPrinter ? [selectedLabelPrinter] : []}
              onChange={(value) => {
                const lastValue = Array.isArray(value) ? value[value.length - 1] : null;
                actualizarImpresoraEtiquetas(lastValue ?? null);
              }}
              onSearch={(value) => {
                const normalized = String(value || "").trim();
                if (normalized) {
                  setSelectedLabelPrinter(normalized);
                }
              }}
              placeholder="Selecciona o escribe impresora"
              options={labelPrinters.map((p) => ({
                label: `${p.name}${p.isDefault ? " (predeterminada)" : ""}`,
                value: p.name,
              }))}
            />
            <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
              Si no aparece en la lista, escríbela manualmente y ya quedará guardada para próximas etiquetas.
            </Text>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Switch
              checked={mostrarCodigoCortoEnEtiqueta}
              onChange={setMostrarCodigoCortoEnEtiqueta}
              size="small"
            />
            <Text style={{ fontSize: 13 }}>Mostrar código corto (6 dígitos) encima del QR</Text>
          </div>

          <Table
            dataSource={labelItems}
            rowKey="articuloId"
            size="small"
            pagination={false}
            scroll={{ y: 260 }}
            columns={[
              { title: "Artículo", dataIndex: "nombre", ellipsis: true },
              {
                title: "Código QR",
                dataIndex: "codigoCorto",
                width: 110,
                render: (v?: string) => v ? <Tag color="geekblue" style={{ fontSize: 10 }}>{v}</Tag> : <Text type="secondary">—</Text>,
              },
              { title: "Precio", dataIndex: "precio", width: 100, render: (v: number) => `$${Number(v).toLocaleString()}` },
              {
                title: "Cantidad", dataIndex: "cantidad", width: 120,
                render: (value: number, record: { articuloId: string }) => (
                  <InputNumber
                    min={0}
                    max={999}
                    size="small"
                    style={{ width: 90 }}
                    value={value}
                    onChange={(nextValue) => {
                      const safeValue = Math.max(0, Number(nextValue || 0));
                      setLabelItems((prev) => prev.map((item) => item.articuloId === record.articuloId ? { ...item, cantidad: safeValue } : item));
                    }}
                  />
                ),
              },
            ]}
          />
        </Space>
      </Modal>
    </>
  );
}
