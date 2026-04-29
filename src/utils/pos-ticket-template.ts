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
  ticket_campos?: Partial<TicketFieldsConfig> | null;
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

function normalizarTicketFields(value?: Partial<TicketFieldsConfig> | null): TicketFieldsConfig {
  return { ...DEFAULT_TICKET_FIELDS, ...(value ?? {}) };
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
    ticketFields: normalizarTicketFields(data?.ticket_campos),
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

export function crearTemplateTicketPOS(values: Partial<ConfiguracionTicketRow>, ticketFields?: Partial<TicketFieldsConfig>): PosTicketTemplateConfig {
  return construirTemplateDesdeFila({ ...values, ticket_campos: { ...(values.ticket_campos ?? {}), ...(ticketFields ?? {}) } });
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