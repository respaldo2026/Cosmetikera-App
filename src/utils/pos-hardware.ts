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

async function cargarQZ() {
  if (!qz) {
    qz = (await import("qz-tray")).default;
  }
  return qz;
}

// ── Conexión ─────────────────────────────────────────────────────────────────

export async function qzConectar(): Promise<boolean> {
  try {
    const q = await cargarQZ();
    if (q.websocket.isActive()) return true;
    await q.websocket.connect({ retries: 2, delay: 1 });
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
  puntosFidelidad?: number;
  mensaje?: string;
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
  cmds.push(`${ESC}!\x38`); // doble ancho + alto
  cmds.push(datos.nombreTienda + LF);
  cmds.push(`${ESC}!\x00`); // texto normal
  if (datos.nit) cmds.push(`NIT: ${datos.nit}` + LF);
  if (datos.direccion) cmds.push(datos.direccion + LF);
  if (datos.telefono) cmds.push(`Tel: ${datos.telefono}` + LF);
  cmds.push(sep + LF);

  // DATOS VENTA
  cmds.push(`${ESC}a\x00`); // izquierda
  cmds.push(`Ticket #: ${datos.numeroVenta}` + LF);
  cmds.push(`Fecha   : ${datos.fecha}` + LF);
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
  if (datos.puntosFidelidad && datos.puntosFidelidad > 0) {
    cmds.push(sep + LF);
    cmds.push(`${ESC}a\x01`);
    cmds.push(`★ Ganaste ${datos.puntosFidelidad} puntos` + LF);
    cmds.push(`${ESC}a\x00`);
  }

  // MENSAJE FINAL
  cmds.push(sep + LF);
  cmds.push(`${ESC}a\x01`);
  cmds.push((datos.mensaje || "¡Gracias por tu compra!") + LF);
  cmds.push("La Cosmetikera" + LF);
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
  // Usar variables de entorno si no se pasan parámetros
  const printerName = impresora ?? process.env.NEXT_PUBLIC_POS_PRINTER_NAME ?? null;
  const printWidth = ancho ?? Number(process.env.NEXT_PUBLIC_POS_PRINTER_WIDTH ?? 32);
  try {
    const q = await cargarQZ();

    const conectado = await qzConectar();
    if (!conectado) {
      return { ok: false, error: "QZ Tray no está disponible. Verifica que esté instalado y corriendo." };
    }

    // Obtener la impresora
    let resolvedPrinter = printerName;
    if (!resolvedPrinter) {
      resolvedPrinter = await q.printers.getDefault();
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

    await q.print(config, data);
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
  try {
    const q = await cargarQZ();

    const conectado = await qzConectar();
    if (!conectado) {
      return { ok: false, error: "QZ Tray no disponible" };
    }

    let printerName = impresora;
    if (!printerName) {
      printerName = await q.printers.getDefault();
    }

    const config = q.configs.create(printerName, { encoding: "Cp1252" });

    // Comando ESC/POS estándar para abrir cajón:
    // ESC p m t1 t2  →  0x1B 0x70 0x00 0x19 0xFA
    const pulso = "\x1B\x70\x00\x19\xFA";
    const data = [{ type: "raw", format: "plain", data: pulso }];

    await q.print(config, data);
    return { ok: true };
  } catch (e: any) {
    console.error("[POS] Error al abrir cajón:", e);
    return { ok: false, error: e?.message ?? "Error al abrir cajón monedero" };
  }
}

// ── Listar impresoras ─────────────────────────────────────────────────────────

export async function listarImpresoras(): Promise<string[]> {
  try {
    const q = await cargarQZ();
    await qzConectar();
    const lista = await q.printers.find(""); // busca todas
    return Array.isArray(lista) ? lista : [lista];
  } catch (_) {
    return [];
  }
}
