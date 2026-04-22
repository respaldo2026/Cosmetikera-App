import { WhatsAppService } from "@/services/whatsapp-service";

type WelcomeClubPayload = {
  nombre: string;
  telefono: string | null;
  usuarioClub: string | null;
};

type ClubPointsPayload = {
  nombre: string;
  telefono: string | null;
  tipo: string;
  puntosMovimiento: number;
  puntosActuales: number;
  concepto?: string | null;
};

function isClubWhatsAppEnabled() {
  return process.env.WHATSAPP_CLUB_AUTOMATIC_MESSAGES !== "false";
}

function getClubLink() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  return `${appUrl.replace(/\/$/, "")}/club`;
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

export async function sendClubWelcomeWhatsApp(payload: WelcomeClubPayload) {
  if (!isClubWhatsAppEnabled()) return;
  if (!payload.telefono) return;

  const credentials = WhatsAppService.checkCredentials();
  if (!credentials.valid) return;

  const texto = [
    `Hola ${payload.nombre}, bienvenida al Club La Cosmetikera.`,
    `Ya puedes ver tus beneficios aqui: ${getClubLink()}`,
    payload.usuarioClub ? `Usuario: ${payload.usuarioClub}` : null,
    "Si necesitas ayuda para ingresar, responde a este mensaje.",
  ]
    .filter(Boolean)
    .join("\n\n");

  await WhatsAppService.sendText(payload.telefono, texto);
}

export async function sendClubPointsWhatsApp(payload: ClubPointsPayload) {
  if (!isClubWhatsAppEnabled()) return;
  if (!payload.telefono) return;

  const credentials = WhatsAppService.checkCredentials();
  if (!credentials.valid) return;

  const verbo = payload.puntosMovimiento >= 0 ? "sumaron" : "descontaron";
  const puntosMovimientoAbs = Math.abs(payload.puntosMovimiento);

  const texto = [
    `Hola ${payload.nombre}, registramos un movimiento en tu Club La Cosmetikera.`,
    `Se ${verbo} ${formatPoints(puntosMovimientoAbs)} puntos (${payload.tipo}).`,
    `Saldo actual: ${formatPoints(payload.puntosActuales)} puntos.`,
    payload.concepto ? `Detalle: ${payload.concepto}` : null,
    `Consulta tus beneficios en: ${getClubLink()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  await WhatsAppService.sendText(payload.telefono, texto);
}
