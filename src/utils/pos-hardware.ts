/**
 * pos-hardware.ts
 * Utilidades para hardware POS:
 *  - Impresora térmica ESC/POS vía QZ Tray
 *  - Cajón monedero (cash drawer) vía pulso ESC/POS
 *
 * REQUISITO: Tener QZ Tray instalado y corriendo en el PC del POS.
 * Descarga: https://qz.io/download/
 *
 * Flujo:
 *  1. qzConectar()       → conecta al agente QZ Tray local (WebSocket)
 *  2. imprimirTicket()    → envía comandos ESC/POS al térmico
 *  3. abrirCajon()       → envía pulso ESC para abrir el cajón
 *  4. qzDesconectar()    → cierra la conexión
 */

// qz-tray usa import dinámico porque manipula `window`
let qz: any = null;
let qzSecurityInitialized = false;

const QZ_CONNECT_TIMEOUT_MS = 8000;
const QZ_OPERATION_TIMEOUT_MS = 10000;
const POS_PRINT_MODE = (process.env.NEXT_PUBLIC_POS_PRINT_MODE ?? "auto").toLowerCase();
const POS_AGENT_URL = (process.env.NEXT_PUBLIC_POS_AGENT_URL ?? "http://127.0.0.1:17891").replace(/\/$/, "");
const POS_AGENT_TIMEOUT_MS = 2500;
const POS_AGENT_TOKEN = process.env.NEXT_PUBLIC_POS_AGENT_TOKEN ?? "";

function usarQZTray(): boolean {
  return POS_PRINT_MODE === "qz";
}

function usarAgentePOS(): boolean {
  return POS_PRINT_MODE === "agent" || POS_PRINT_MODE === "auto";
}

async function llamarAgentePOS<T = any>(ruta: string, payload: Record<string, any>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POS_AGENT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (POS_AGENT_TOKEN) {
      headers["x-pos-agent-token"] = POS_AGENT_TOKEN;
    }

    const response = await fetch(`${POS_AGENT_URL}${ruta}`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "Agente POS no disponible");
    }

    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function normalizarPem(valor: string): string {
  return valor
    .replace(/\\n/g, "\n")
    .trim();
}

async function inicializarSeguridadQZ(q: any): Promise<void> {
  if (qzSecurityInitialized) return;

  const certRaw =
    process.env.NEXT_PUBLIC_QZ_CERTIFICATE ??
    process.env.NEXT_PUBLIC_QZ_CERT ??
    "";

  const certificate = normalizarPem(certRaw);
  if (!certificate) {
    console.warn(
      "[POS] QZ Tray sin certificado (NEXT_PUBLIC_QZ_CERTIFICATE). " +
      "Solicitara autorizacion manual en cada impresion/apertura de cajon."
    );
    qzSecurityInitialized = true;
    return;
  }

  console.log("[POS/QZ] Certificado cargado, configurando seguridad...");
  q.security.setCertificatePromise(() => {
    console.log("[POS/QZ] ✓ Certificado enviado a QZ Tray");
    return Promise.resolve(certificate);
  });
  
  q.security.setSignatureAlgorithm("SHA512");
  console.log("[POS/QZ] Algoritmo de firma: SHA512");
  
  q.security.setSignaturePromise(async (stringToSign: string) => {
    console.log("[POS/QZ] Firmando solicitud...");
    const controller = new AbortController();
    const abortId = setTimeout(() => controller.abort(), QZ_OPERATION_TIMEOUT_MS);
    const response = await fetch("/api/qz/sign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({ stringToSign }),
    }).finally(() => clearTimeout(abortId));

    if (!response.ok) {
      let detalle = "Error firmando solicitud";
      try {
        const body = await response.json();
        if (body?.error) detalle = String(body.error);
      } catch (_) {}
      console.error("[POS/QZ] ✗ Error en endpoint de firma:", detalle);
      throw new Error(detalle);
    }

    const payload = await response.json();
    if (!payload?.signature) {
      console.error("[POS/QZ] ✗ Endpoint devolvió sin firma");
      throw new Error("La firma de QZ no fue generada");
    }
    console.log("[POS/QZ] ✓ Firma recibida del servidor");
    return payload.signature as string;
  });

  qzSecurityInitialized = true;
  console.log("[POS/QZ] Inicialización de seguridad completada");
}

async function cargarQZ() {
  if (!qz) {
    qz = (await import("qz-tray")).default;
  }
  return qz;
}

// ── Configuración POS (cargada desde Supabase) ────────────────────────────────

interface PosConfig {
  printerName: string | null;
  printerWidth: number;
}

let cachedPosConfig: PosConfig | null = null;

/** Carga la config de impresora desde la tabla `configuracion` de Supabase. */
export async function cargarConfigPOS(): Promise<PosConfig> {
  if (cachedPosConfig) return cachedPosConfig;
  try {
    const { supabaseBrowserClient } = await import("@utils/supabase/client");
    const { data } = await supabaseBrowserClient
      .from("configuracion")
      .select("pos_printer_name, pos_printer_width")
      .limit(1)
      .maybeSingle();
    cachedPosConfig = {
      printerName: data?.pos_printer_name ?? process.env.NEXT_PUBLIC_POS_PRINTER_NAME ?? null,
      printerWidth: data?.pos_printer_width ?? Number(process.env.NEXT_PUBLIC_POS_PRINTER_WIDTH ?? 48),
    };
  } catch {
    cachedPosConfig = {
      printerName: process.env.NEXT_PUBLIC_POS_PRINTER_NAME ?? null,
      printerWidth: Number(process.env.NEXT_PUBLIC_POS_PRINTER_WIDTH ?? 48),
    };
  }
  return cachedPosConfig;
}

/** Invalida el caché para que la próxima impresión relean la config. */
export function invalidarConfigPOS(): void {
  cachedPosConfig = null;
}

/** Lista todas las impresoras disponibles en QZ Tray. */
export async function listarImpresoras(): Promise<string[]> {
  if (!usarQZTray()) return [];
  try {
    const q = await cargarQZ();
    const conectado = await qzConectar();
    if (!conectado) return [];
    const result = await withTimeout(
      q.printers.find(""),
      QZ_OPERATION_TIMEOUT_MS,
      "QZ Tray tardó demasiado detectando impresoras"
    );
    return Array.isArray(result) ? (result as string[]) : [(result as string)].filter(Boolean);
  } catch {
    return [];
  }
}

// ── Conexión ─────────────────────────────────────────────────────────────────

export async function qzConectar(): Promise<boolean> {
  if (!usarQZTray()) {
    return false;
  }
  try {
    const q = await cargarQZ();
    await inicializarSeguridadQZ(q);
    if (q.websocket.isActive()) return true;
    await withTimeout(
      q.websocket.connect({ retries: 2, delay: 1 }),
      QZ_CONNECT_TIMEOUT_MS,
      "QZ Tray no respondió a tiempo al conectar"
    );
    return true;
  } catch (e) {
    console.error("[POS] No se pudo conectar a QZ Tray:", e);
    return false;
  }
}

export async function qzDesconectar() {
  try {
    const q = await cargarQZ();
    if (q.websocket.isActive()) await q.websocket.disconnect();
  } catch (_) {}
}

export function qzActivo(): boolean {
  if (!usarQZTray()) return false;
  if (!qz) return false;
  return qz.websocket.isActive?.() ?? false;
}

// ── Impresión térmica ─────────────────────────────────────────────────────────

export type LineaTicket =
  | { tipo: "titulo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "linea" }
  | { tipo: "item"; descripcion: string; cantidad: number; precio: number }
  | { tipo: "total"; etiqueta: string; valor: number }
  | { tipo: "texto"; texto: string }
  | { tipo: "espacio" };

export type DatosTicket = {
  nombreTienda: string;
  nit?: string;
  direccion?: string;
  telefono?: string;
  numeroVenta: string;
  fecha: string;
  cliente?: string;
  cajero?: string;
  lineas: LineaTicket[];
  metodoPago: string;
  cambio?: number;
  puntosFidelidad?: number;     // puntos ganados EN esta compra
  puntosAcumulados?: number;    // puntos totales del cliente tras la compra
  nivelFidelidad?: string;      // nivel actual del cliente
  mensaje?: string;
  nota?: string;
  pie?: string;
};

function centrar(texto: string, ancho = 32): string {
  if (texto.length >= ancho) return texto.slice(0, ancho);
  const pad = Math.floor((ancho - texto.length) / 2);
  return " ".repeat(pad) + texto;
}

function formatearPrecio(valor: number): string {
  return "$" + valor.toLocaleString("es-CO");
}

function lineaItemEscpos(desc: string, cant: number, precio: number, ancho = 32): string {
  const priceStr = formatearPrecio(precio * cant);
  const cantDesc = `${cant}x ${desc}`;
  const espacio = ancho - cantDesc.length - priceStr.length;
  if (espacio <= 0) return `${cantDesc}\n${" ".repeat(ancho - priceStr.length)}${priceStr}`;
  return cantDesc + " ".repeat(espacio) + priceStr;
}

function lineaTotalEscpos(etiqueta: string, valor: number, ancho = 32): string {
  const valStr = formatearPrecio(valor);
  const espacio = ancho - etiqueta.length - valStr.length;
  return etiqueta + " ".repeat(Math.max(1, espacio)) + valStr;
}

/**
 * Construye el array de comandos ESC/POS para el ticket.
 * Compatible con impresoras de 58mm (32 chars) y 80mm (48 chars).
 */
function construirComandosEscpos(datos: DatosTicket, ancho = 32): string[] {
  const ESC = "\x1B";
  const GS = "\x1D";
  const LF = "\n";

  const cmds: string[] = [
    // Inicializar impresora
    `${ESC}@`,
    // Encoding UTF-8
    `${ESC}t\x12`,
  ];

  const sep = "─".repeat(ancho);

  // CABECERA — centrado
  cmds.push(`${ESC}a\x01`); // centrar
  if (datos.nombreTienda) {
    cmds.push(`${ESC}!\x38`); // doble ancho + alto
    cmds.push(datos.nombreTienda + LF);
    cmds.push(`${ESC}!\x00`); // texto normal
  }
  if (datos.nit) cmds.push(`NIT: ${datos.nit}` + LF);
  if (datos.direccion) cmds.push(datos.direccion + LF);
  if (datos.telefono) cmds.push(`Tel: ${datos.telefono}` + LF);
  cmds.push(sep + LF);

  // DATOS VENTA
  cmds.push(`${ESC}a\x00`); // izquierda
  cmds.push(`Ticket #: ${datos.numeroVenta}` + LF);
  if (datos.fecha) cmds.push(`Fecha   : ${datos.fecha}` + LF);
  if (datos.cajero) cmds.push(`Cajero  : ${datos.cajero}` + LF);
  if (datos.cliente) cmds.push(`Cliente : ${datos.cliente}` + LF);
  cmds.push(sep + LF);

  // LÍNEAS DEL TICKET
  for (const linea of datos.lineas) {
    switch (linea.tipo) {
      case "titulo":
        cmds.push(`${ESC}a\x01`);
        cmds.push(`${ESC}!\x08`); // negrita
        cmds.push(linea.texto.toUpperCase() + LF);
        cmds.push(`${ESC}!\x00`);
        cmds.push(`${ESC}a\x00`);
        break;
      case "subtitulo":
        cmds.push(`${ESC}a\x01`);
        cmds.push(linea.texto + LF);
        cmds.push(`${ESC}a\x00`);
        break;
      case "linea":
        cmds.push(sep + LF);
        break;
      case "item":
        cmds.push(lineaItemEscpos(linea.descripcion, linea.cantidad, linea.precio, ancho) + LF);
        break;
      case "total":
        cmds.push(`${ESC}!\x08`); // negrita
        cmds.push(lineaTotalEscpos(linea.etiqueta, linea.valor, ancho) + LF);
        cmds.push(`${ESC}!\x00`);
        break;
      case "texto":
        cmds.push(linea.texto + LF);
        break;
      case "espacio":
        cmds.push(LF);
        break;
    }
  }

  cmds.push(sep + LF);

  // PAGO
  cmds.push(`${ESC}!\x08`);
  cmds.push(`Pago: ${datos.metodoPago.toUpperCase()}` + LF);
  cmds.push(`${ESC}!\x00`);
  if (datos.cambio !== undefined && datos.cambio > 0) {
    cmds.push(`Cambio: ${formatearPrecio(datos.cambio)}` + LF);
  }

  // PUNTOS FIDELIDAD
  if (datos.puntosAcumulados !== undefined) {
    cmds.push(sep + LF);
    cmds.push(`${ESC}a\x01`);
    cmds.push(`${ESC}!\x08`); // negrita
    if (datos.puntosFidelidad !== undefined && datos.puntosFidelidad > 0) {
      cmds.push(`\u2605 Ganaste ${datos.puntosFidelidad} puntos` + LF);
    } else {
      cmds.push(`\u2605 Puntos de fidelidad` + LF);
    }
    cmds.push(`${ESC}!\x00`);
    cmds.push(`Total acumulado: ${datos.puntosAcumulados.toLocaleString("es-CO")} pts` + LF);
    if (datos.nivelFidelidad) {
      cmds.push(`Nivel: ${datos.nivelFidelidad.toUpperCase()}` + LF);
    }
    cmds.push(`${ESC}a\x00`);
  }

  // MENSAJE FINAL
  cmds.push(sep + LF);
  cmds.push(`${ESC}a\x01`);
  if (datos.mensaje) cmds.push(datos.mensaje + LF);
  if (datos.nota) cmds.push(datos.nota + LF);
  cmds.push((datos.pie || "¡Gracias por tu compra!") + LF);
  cmds.push(`${ESC}a\x00`);

  // Avanzar papel y cortar
  cmds.push(`${LF}${LF}${LF}`);
  cmds.push(`${GS}V\x41\x05`); // corte parcial

  return cmds;
}

/**
 * Imprime un ticket en la impresora térmica.
 * @param datos  Datos del ticket
 * @param impresora  Nombre de la impresora (null = primera disponible)
 * @param ancho  Caracteres por línea: 32 para 58mm, 48 para 80mm
 */
export async function imprimirTicketTermico(
  datos: DatosTicket,
  impresora?: string | null,
  ancho?: number
): Promise<{ ok: boolean; error?: string }> {
  // Usar config de Supabase si no se pasan parámetros explícitos
  const cfg = await cargarConfigPOS();
  const printerName = impresora ?? cfg.printerName;
  const printWidth = ancho ?? cfg.printerWidth;

  if (usarAgentePOS()) {
    try {
      const comandos = construirComandosEscpos(datos, printWidth);
      const resp = await llamarAgentePOS<{ ok: boolean; error?: string }>("/print-raw", {
        printerName,
        raw: comandos.join(""),
        encoding: "cp1252",
      });

      if (resp?.ok) {
        return { ok: true };
      }
      return { ok: false, error: resp?.error ?? "El agente POS no pudo imprimir" };
    } catch (e: any) {
      if (POS_PRINT_MODE === "agent") {
        return { ok: false, error: e?.message ?? "No fue posible contactar el agente POS" };
      }
      try {
        imprimirTicketNavegador(datos);
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message ?? "No se pudo abrir la impresión del navegador" };
      }
    }
  }

  if (!usarQZTray()) {
    try {
      imprimirTicketNavegador(datos);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "No se pudo abrir la impresión del navegador" };
    }
  }

  try {
    const q = await cargarQZ();

    const conectado = await qzConectar();
    if (!conectado) {
      return { ok: false, error: "QZ Tray no está disponible. Verifica que esté instalado y corriendo." };
    }

    // Obtener la impresora
    let resolvedPrinter = printerName;
    if (!resolvedPrinter) {
      resolvedPrinter = await withTimeout(
        q.printers.getDefault(),
        QZ_OPERATION_TIMEOUT_MS,
        "QZ Tray tardó demasiado obteniendo la impresora predeterminada"
      );
    }
    if (!resolvedPrinter) {
      return { ok: false, error: "No se encontró ninguna impresora configurada." };
    }

    const config = q.configs.create(resolvedPrinter, {
      encoding: "Cp1252",
      altPrinting: false,
      colorType: "blackwhite",
    });

    const comandos = construirComandosEscpos(datos, printWidth);
    const data = [{ type: "raw", format: "plain", data: comandos.join("") }];

    await withTimeout(
      q.print(config, data),
      QZ_OPERATION_TIMEOUT_MS,
      "QZ Tray tardó demasiado procesando la impresión"
    );
    return { ok: true };
  } catch (e: any) {
    console.error("[POS] Error al imprimir:", e);
    return { ok: false, error: e?.message ?? "Error desconocido al imprimir" };
  }
}

// ── Cajón monedero ────────────────────────────────────────────────────────────

/**
 * Abre el cajón monedero enviando el pulso ESC/POS estándar.
 * El cajón debe estar conectado a la impresora térmica (conector RJ11).
 * @param impresora Nombre de la impresora (null = primera disponible)
 */
export async function abrirCajon(
  impresora?: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (usarAgentePOS()) {
    try {
      const cfg = await cargarConfigPOS();
      const printerName = impresora ?? cfg.printerName;
      const resp = await llamarAgentePOS<{ ok: boolean; error?: string }>("/drawer", {
        printerName,
      });
      return resp?.ok ? { ok: true } : { ok: false, error: resp?.error ?? "No se pudo abrir el cajón" };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "No fue posible contactar el agente POS" };
    }
  }

  if (!usarQZTray()) {
    return {
      ok: false,
      error: "Este modo no puede abrir cajón físico sin un agente local o QZ Tray.",
    };
  }

  try {
    const q = await cargarQZ();

    const conectado = await qzConectar();
    if (!conectado) {
      return { ok: false, error: "QZ Tray no disponible" };
    }

    // Usar config de Supabase si no se pasa impresora explícita
    const cfg = await cargarConfigPOS();
    let printerName = impresora ?? cfg.printerName;
    if (!printerName) {
      printerName = await withTimeout(
        q.printers.getDefault(),
        QZ_OPERATION_TIMEOUT_MS,
        "QZ Tray tardó demasiado obteniendo la impresora para abrir el cajón"
      );
    }

    const config = q.configs.create(printerName, { encoding: "Cp1252" });

    // Comando ESC/POS estándar para abrir cajón:
    // ESC p m t1 t2  →  0x1B 0x70 0x00 0x19 0xFA
    const pulso = "\x1B\x70\x00\x19\xFA";
    const data = [{ type: "raw", format: "plain", data: pulso }];

    await withTimeout(
      q.print(config, data),
      QZ_OPERATION_TIMEOUT_MS,
      "QZ Tray tardó demasiado enviando la señal al cajón"
    );
    return { ok: true };
  } catch (e: any) {
    console.error("[POS] Error al abrir cajón:", e);
    return { ok: false, error: e?.message ?? "Error al abrir cajón monedero" };
  }
}

// ── Impresión por navegador (fallback sin QZ Tray) ────────────────────────────

/**
 * Genera un HTML de ticket de venta y abre el diálogo de impresión del navegador.
 * Se usa como fallback cuando QZ Tray no está disponible.
 */
export function imprimirTicketNavegador(datos: DatosTicket): void {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const fmtPrecio = (v: number) =>
    "$" + v.toLocaleString("es-CO");

  const detalleHtml = datos.lineas.map((linea) => {
    if (linea.tipo === "titulo") {
      return `<div class="title-row">${esc(linea.texto.toUpperCase())}</div>`;
    }
    if (linea.tipo === "subtitulo") {
      return `<div class="subtitle-row">${esc(linea.texto)}</div>`;
    }
    if (linea.tipo === "linea") {
      return `<hr class="sep" />`;
    }
    if (linea.tipo === "item") {
      return `
        <div class="detail-row item-row">
          <span>${esc(`${linea.cantidad}x ${linea.descripcion}`)}</span>
          <span>${fmtPrecio(linea.precio * linea.cantidad)}</span>
        </div>`;
    }
    if (linea.tipo === "total") {
      return `
        <div class="detail-row ${linea.etiqueta === "TOTAL" ? "total-row" : "subtotal-row"}">
          <span>${esc(linea.etiqueta)}</span>
          <span>${fmtPrecio(linea.valor)}</span>
        </div>`;
    }
    if (linea.tipo === "texto") {
      return `<div class="text-row">${esc(linea.texto)}</div>`;
    }
    return `<div class="spacer-row"></div>`;
  }).join("");

  const puntosHtml = datos.puntosAcumulados !== undefined ? `
    <div class="puntos">
      <span class="star">&#9733;</span>
      ${datos.puntosFidelidad !== undefined && datos.puntosFidelidad > 0
        ? `Ganaste <strong>${datos.puntosFidelidad}</strong> puntos en esta compra<br/>`
        : `<strong>Puntos de fidelidad</strong><br/>`}
      Total acumulado: <strong>${datos.puntosAcumulados.toLocaleString("es-CO")}</strong> pts
      ${datos.nivelFidelidad
        ? `<br/>Nivel: <strong>${datos.nivelFidelidad.toUpperCase()}</strong>`
        : ""}
    </div>` : "";

  const cambioHtml = datos.cambio !== undefined && datos.cambio > 0
    ? `<p class="cambio">Cambio: <strong>${fmtPrecio(datos.cambio)}</strong></p>` : "";

  const notaHtml = datos.nota ? `<p style="margin-top:8px">${esc(datos.nota)}</p>` : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Ticket #${esc(datos.numeroVenta)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      width: 80mm;
      margin: 0 auto;
      padding: 8px 6px;
      color: #111;
    }
    .header { text-align: center; margin-bottom: 8px; }
    .header h1 { font-size: 16px; font-weight: 900; letter-spacing: 1px; }
    .header p { font-size: 10px; color: #444; }
    hr.sep { border: none; border-top: 1px dashed #999; margin: 6px 0; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .info-row span:first-child { font-weight: bold; }
    .detail-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; font-size: 12px; }
    .detail-row span:last-child { text-align: right; white-space: nowrap; }
    .title-row { text-align: center; font-weight: 700; font-size: 13px; margin-bottom: 6px; }
    .subtitle-row { text-align: center; font-size: 12px; margin-bottom: 6px; }
    .text-row { text-align: center; font-size: 11px; color: #4b5563; margin-bottom: 6px; }
    .spacer-row { height: 8px; }
    .subtotal-row { color: #555; }
    .total-row { font-size: 13px; font-weight: 900; border-top: 2px solid #111; padding-top: 4px; }
    .pago { margin-top: 6px; font-size: 11px; }
    .cambio { font-size: 11px; margin-top: 2px; }
    .puntos {
      margin-top: 8px;
      background: #fff8e1;
      border: 1px dashed #f5a623;
      border-radius: 4px;
      padding: 6px 8px;
      text-align: center;
      font-size: 11px;
      line-height: 1.5;
    }
    .star { color: #f5a623; font-size: 14px; }
    .footer { text-align: center; margin-top: 10px; font-size: 10px; color: #555; }
    @media print {
      body { width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${esc(datos.nombreTienda)}</h1>
    ${datos.nit ? `<p>NIT: ${esc(datos.nit)}</p>` : ""}
    ${datos.direccion ? `<p>${esc(datos.direccion)}</p>` : ""}
    ${datos.telefono ? `<p>Tel: ${esc(datos.telefono)}</p>` : ""}
  </div>

  <hr class="sep" />
  <div class="info-row"><span>Ticket #</span><span>${esc(datos.numeroVenta)}</span></div>
  <div class="info-row"><span>Fecha</span><span>${esc(datos.fecha)}</span></div>
  ${datos.cajero ? `<div class="info-row"><span>Cajero</span><span>${esc(datos.cajero)}</span></div>` : ""}
  ${datos.cliente ? `<div class="info-row"><span>Cliente</span><span>${esc(datos.cliente)}</span></div>` : ""}
  <hr class="sep" />

  <div>${detalleHtml}</div>

  <hr class="sep" />
  <p class="pago">Método de pago: <strong>${esc(datos.metodoPago.toUpperCase())}</strong></p>
  ${cambioHtml}
  ${puntosHtml}
  <div class="footer">
    <hr class="sep" />
    ${datos.mensaje ? `<p>${esc(datos.mensaje)}</p>` : ""}
    ${notaHtml}
    <p style="margin-top:4px;font-weight:bold;">${esc(datos.pie || "¡Gracias por tu compra!")}</p>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  // Esperar que cargue y luego imprimir
  win.onload = () => { win.print(); };
  setTimeout(() => {
    try { win.print(); } catch (_) {}
  }, 600);
}
