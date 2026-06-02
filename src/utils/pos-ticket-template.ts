import { supabaseBrowserClient } from "@utils/supabase/client";
import type { DatosTicket, LineaTicket } from "@utils/pos-hardware";

export type TicketFieldsConfig = {
  logo: boolean;
  nombreAcademia: boolean;
  ruc: boolean;
  direccion: boolean;
  telefono: boolean;
  email: boolean;
  fecha: boolean;
  concepto: boolean;
  monto: boolean;
  puntos: boolean;
  nota: boolean;
  pie: boolean;
  titulo: boolean;
};

export type TicketPromoFontSize = "sm" | "md" | "lg";
export type TicketPromoAlign = "left" | "center";

export interface TicketPromoConfig {
  fontSize: TicketPromoFontSize;
  align: TicketPromoAlign;
  bold: boolean;
  boxed: boolean;
}

export const DEFAULT_TICKET_PROMO_CONFIG: TicketPromoConfig = {
  fontSize: "md",
  align: "center",
  bold: false,
  boxed: false,
};

export interface PosTicketTemplateConfig {
  nombreNegocio: string;
  ruc: string;
  direccion: string;
  telefono: string;
  email: string;
  logoUrl: string;
  ticketTitle: string;
  ticketFooter: string;
  ticketNote: string;
  ticketFields: TicketFieldsConfig;
  promoConfig: TicketPromoConfig;
}

type ConfiguracionTicketRow = {
  nombre_academia?: string | null;
  ruc?: string | null;
  nit?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  logo_url?: string | null;
  ticket_titulo?: string | null;
  ticket_pie?: string | null;
  ticket_nota?: string | null;
  ticket_campos?: Record<string, unknown> | null;
};

export const DEFAULT_TICKET_FIELDS: TicketFieldsConfig = {
  logo: true,
  nombreAcademia: true,
  ruc: true,
  direccion: true,
  telefono: true,
  email: true,
  fecha: true,
  concepto: true,
  monto: true,
  puntos: true,
  nota: true,
  pie: true,
  titulo: true,
};

let cachedTicketTemplate: PosTicketTemplateConfig | null = null;

function normalizarTexto(value: string | null | undefined, fallback = ""): string {
  return (value ?? fallback).trim();
}

function normalizarTicketFields(value?: unknown): TicketFieldsConfig {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = { ...DEFAULT_TICKET_FIELDS };

  for (const key of Object.keys(DEFAULT_TICKET_FIELDS) as Array<keyof TicketFieldsConfig>) {
    if (typeof source[key] === "boolean") {
      next[key] = source[key] as boolean;
    }
  }

  return next;
}

export function normalizarTicketPromoConfig(value?: unknown): TicketPromoConfig {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const fontSize =
    source.fontSize === "sm" || source.fontSize === "md" || source.fontSize === "lg"
      ? source.fontSize
      : DEFAULT_TICKET_PROMO_CONFIG.fontSize;

  const align = source.align === "left" || source.align === "center"
    ? source.align
    : DEFAULT_TICKET_PROMO_CONFIG.align;

  return {
    fontSize,
    align,
    bold: typeof source.bold === "boolean" ? source.bold : DEFAULT_TICKET_PROMO_CONFIG.bold,
    boxed: typeof source.boxed === "boolean" ? source.boxed : DEFAULT_TICKET_PROMO_CONFIG.boxed,
  };
}

function limpiarLineas(lineas: LineaTicket[]): LineaTicket[] {
  const resultado: LineaTicket[] = [];
  for (const linea of lineas) {
    const previa = resultado[resultado.length - 1];
    if (linea.tipo === "linea" && (!previa || previa.tipo === "linea")) {
      continue;
    }
    resultado.push(linea);
  }

  while (resultado[0]?.tipo === "linea") {
    resultado.shift();
  }
  while (resultado[resultado.length - 1]?.tipo === "linea") {
    resultado.pop();
  }

  return resultado;
}

function construirTemplateDesdeFila(data?: ConfiguracionTicketRow | null): PosTicketTemplateConfig {
  const ticketCampos = data?.ticket_campos;

  return {
    nombreNegocio: normalizarTexto(data?.nombre_academia, process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? "La Cosmetikera"),
    ruc: normalizarTexto(data?.ruc ?? data?.nit, process.env.NEXT_PUBLIC_TIENDA_NIT ?? ""),
    direccion: normalizarTexto(data?.direccion, process.env.NEXT_PUBLIC_TIENDA_DIRECCION ?? ""),
    telefono: normalizarTexto(data?.telefono, process.env.NEXT_PUBLIC_TIENDA_TELEFONO ?? ""),
    email: normalizarTexto(data?.email, ""),
    logoUrl: normalizarTexto(data?.logo_url, ""),
    ticketTitle: normalizarTexto(data?.ticket_titulo, "Detalle de venta"),
    ticketFooter: normalizarTexto(data?.ticket_pie, process.env.NEXT_PUBLIC_TIENDA_MENSAJE_TICKET ?? "Gracias por tu compra"),
    ticketNote: normalizarTexto(data?.ticket_nota, ""),
    ticketFields: normalizarTicketFields(ticketCampos),
    promoConfig: normalizarTicketPromoConfig(
      ticketCampos && typeof ticketCampos === "object"
        ? (ticketCampos as Record<string, unknown>).promo_config
        : undefined
    ),
  };
}

export async function cargarConfigTicketPOS(): Promise<PosTicketTemplateConfig> {
  if (cachedTicketTemplate) return cachedTicketTemplate;

  try {
    const { data, error } = await supabaseBrowserClient
      .from("configuracion")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    cachedTicketTemplate = construirTemplateDesdeFila((data as ConfiguracionTicketRow | null) ?? null);
  } catch {
    cachedTicketTemplate = construirTemplateDesdeFila(null);
  }

  return cachedTicketTemplate;
}

export function invalidarConfigTicketPOS(): void {
  cachedTicketTemplate = null;
}

export function crearTemplateTicketPOS(
  values: Partial<ConfiguracionTicketRow>,
  ticketFields?: Partial<TicketFieldsConfig>,
  promoConfig?: Partial<TicketPromoConfig>
): PosTicketTemplateConfig {
  const ticketCamposBase = values.ticket_campos && typeof values.ticket_campos === "object"
    ? values.ticket_campos
    : {};

  return construirTemplateDesdeFila({
    ...values,
    ticket_campos: {
      ...ticketCamposBase,
      ...(ticketFields ?? {}),
      promo_config: {
        ...(ticketCamposBase as Record<string, unknown>).promo_config as Record<string, unknown> | undefined,
        ...(promoConfig ?? {}),
      },
    },
  });
}

export function aplicarPlantillaTicketPOS(baseTicket: DatosTicket, template: PosTicketTemplateConfig): DatosTicket {
  const lineasBase = [...baseTicket.lineas];
  let lineas = lineasBase;

  if (template.ticketFields.titulo) {
    const titulo = template.ticketTitle || "Detalle de venta";
    if (lineas[0]?.tipo === "titulo") {
      lineas[0] = { ...lineas[0], texto: titulo };
    } else {
      lineas = [{ tipo: "titulo", texto: titulo }, { tipo: "linea" }, ...lineas];
    }
  } else if (lineas[0]?.tipo === "titulo") {
    lineas = lineas.slice(1);
    if (lineas[0]?.tipo === "linea") {
      lineas = lineas.slice(1);
    }
  }

  if (!template.ticketFields.concepto) {
    lineas = lineas.filter((linea) => linea.tipo !== "item");
  }

  if (!template.ticketFields.monto) {
    lineas = lineas.filter((linea) => linea.tipo !== "total");
  }

  lineas = limpiarLineas(lineas);

  return {
    ...baseTicket,
    nombreTienda: template.ticketFields.nombreAcademia ? template.nombreNegocio : "",
    nit: template.ticketFields.ruc ? template.ruc || undefined : undefined,
    direccion: template.ticketFields.direccion ? template.direccion || undefined : undefined,
    telefono: template.ticketFields.telefono ? template.telefono || undefined : undefined,
    fecha: template.ticketFields.fecha ? baseTicket.fecha : "",
    puntosFidelidad: template.ticketFields.puntos ? baseTicket.puntosFidelidad : undefined,
    puntosAcumulados: template.ticketFields.puntos ? baseTicket.puntosAcumulados : undefined,
    nivelFidelidad: template.ticketFields.puntos ? baseTicket.nivelFidelidad : undefined,
    nota: template.ticketFields.nota ? template.ticketNote || undefined : undefined,
    promoConfig: template.promoConfig,
    pie: template.ticketFields.pie ? template.ticketFooter || undefined : undefined,
    lineas,
  };
}

export function crearTicketPruebaPOS(template: PosTicketTemplateConfig): DatosTicket {
  const ticketBase: DatosTicket = {
    nombreTienda: template.nombreNegocio || "La Cosmetikera",
    numeroVenta: "TEST-001",
    fecha: new Date().toLocaleString("es-CO"),
    cliente: "Cliente de prueba",
    metodoPago: "Tarjeta",
    cambio: 0,
    puntosFidelidad: 5,
    puntosAcumulados: 150,
    nivelFidelidad: "Plata",
    mensaje: "Vista de ticket de venta",
    lineas: [
      { tipo: "titulo", texto: template.ticketTitle || "Detalle de venta" },
      { tipo: "linea" },
      { tipo: "item", descripcion: "Base ligera", cantidad: 1, precio: 38000 },
      { tipo: "item", descripcion: "Labial mate", cantidad: 2, precio: 19500 },
      { tipo: "linea" },
      { tipo: "total", etiqueta: "Subtotal", valor: 77000 },
      { tipo: "total", etiqueta: "Descuento", valor: -5000 },
      { tipo: "total", etiqueta: "TOTAL", valor: 72000 },
    ],
  };

  return aplicarPlantillaTicketPOS(ticketBase, template);
}