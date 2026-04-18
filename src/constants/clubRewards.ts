export type ClubLevelKey = "bronce" | "plata" | "oro" | "diamante";

export type ClubClientSnapshot = {
  id: string;
  nombre_completo?: string;
  puntos_fidelidad?: number | null;
  puntos_canjeados?: number | null;
  nivel_fidelidad?: string | null;
  fecha_nacimiento?: string | null;
};

export type ClubReward = {
  key: string;
  icon: string;
  title: string;
  description: string;
  category: "descuento" | "producto" | "experiencia" | "cumpleanos";
  pointsCost: number;
  valueCop: number;
  levelMin?: ClubLevelKey;
  birthdayOnly?: boolean;
  featured?: boolean;
  badge?: string;
};

export const CLUB_LEVELS = [
  { key: "bronce", label: "Bronce", color: "#cd7f32", icon: "🥉", min: 0, max: 999, beneficios: ["Puntos en cada compra", "Acceso al club"], descuento: 0 },
  { key: "plata", label: "Plata", color: "#8c8c8c", icon: "🥈", min: 1000, max: 4999, beneficios: ["5% descuento", "Puntos dobles en cumpleaños", "Ofertas exclusivas"], descuento: 5 },
  { key: "oro", label: "Oro", color: "#faad14", icon: "🥇", min: 5000, max: 14999, beneficios: ["10% descuento", "Puntos dobles mes cumpleaños", "Acceso anticipado", "Regalo cumpleaños"], descuento: 10 },
  { key: "diamante", label: "Diamante", color: "#13c2c2", icon: "💎", min: 15000, max: Number.POSITIVE_INFINITY, beneficios: ["15% descuento", "Puntos triples cumpleaños", "Atención VIP", "Invitaciones exclusivas", "Gift bag anual"], descuento: 15 },
] as const;

export const CLUB_REWARDS: ClubReward[] = [
  {
    key: "voucher_5k",
    icon: "💸",
    title: "Bono inmediato $5.000",
    description: "Úsalo en caja como descuento directo en tu próxima compra.",
    category: "descuento",
    pointsCost: 100,
    valueCop: 5000,
    featured: true,
    badge: "Canje rápido",
  },
  {
    key: "mini_kit",
    icon: "🧴",
    title: "Mini kit de viaje",
    description: "Kit sorpresa de minis seleccionado en tienda.",
    category: "producto",
    pointsCost: 180,
    valueCop: 12000,
    levelMin: "plata",
    badge: "Favorito",
  },
  {
    key: "esmalte_premium",
    icon: "💅",
    title: "Esmalte premium",
    description: "Canjea un esmalte o producto de impulso participante.",
    category: "producto",
    pointsCost: 220,
    valueCop: 15000,
    levelMin: "plata",
  },
  {
    key: "voucher_15k",
    icon: "🎟️",
    title: "Voucher $15.000",
    description: "Descuento fuerte para compras medianas o reposición premium.",
    category: "descuento",
    pointsCost: 300,
    valueCop: 15000,
    levelMin: "oro",
    featured: true,
    badge: "Mejor valor",
  },
  {
    key: "experiencia_vip",
    icon: "✨",
    title: "Experiencia VIP",
    description: "Reserva una atención preferencial o servicio express participante.",
    category: "experiencia",
    pointsCost: 450,
    valueCop: 30000,
    levelMin: "oro",
  },
  {
    key: "birthday_box",
    icon: "🎂",
    title: "Birthday beauty box",
    description: "Regalo especial de cumpleaños. Solo disponible en tu mes.",
    category: "cumpleanos",
    pointsCost: 350,
    valueCop: 25000,
    levelMin: "oro",
    birthdayOnly: true,
    badge: "Campaña cumpleaños",
  },
  {
    key: "diamante_gift",
    icon: "💎",
    title: "Gift bag diamante",
    description: "Bolsa premium con selección exclusiva del club.",
    category: "producto",
    pointsCost: 650,
    valueCop: 50000,
    levelMin: "diamante",
    badge: "Exclusivo",
  },
];

const LEVEL_ORDER: ClubLevelKey[] = ["bronce", "plata", "oro", "diamante"];

export function getClubLevel(points = 0) {
  return CLUB_LEVELS.findLast((level) => points >= level.min) ?? CLUB_LEVELS[0];
}

export function getClubProgress(points = 0) {
  const current = getClubLevel(points);
  const currentIndex = CLUB_LEVELS.findIndex((level) => level.key === current.key);
  if (currentIndex === -1 || currentIndex === CLUB_LEVELS.length - 1) {
    return null;
  }

  const next = CLUB_LEVELS[currentIndex + 1]!;
  const span = Math.max(1, next.min - current.min);
  const pct = Math.min(100, Math.round(((points - current.min) / span) * 100));
  return { siguiente: next, pct, faltantes: Math.max(0, next.min - points) };
}

export function isBirthdayMonth(date?: string | null) {
  if (!date) return false;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getMonth() === new Date().getMonth();
}

export function isRewardUnlocked(reward: ClubReward, client?: ClubClientSnapshot | null) {
  if (!client) return false;
  const points = client.puntos_fidelidad ?? 0;
  const level = (client.nivel_fidelidad as ClubLevelKey | null) ?? getClubLevel(points).key;
  const levelIndex = LEVEL_ORDER.indexOf(level);
  const minLevelIndex = reward.levelMin ? LEVEL_ORDER.indexOf(reward.levelMin) : 0;
  if (levelIndex < minLevelIndex) return false;
  if (reward.birthdayOnly && !isBirthdayMonth(client.fecha_nacimiento)) return false;
  return points >= reward.pointsCost;
}

export function getEligibleRewards(client?: ClubClientSnapshot | null) {
  return CLUB_REWARDS.filter((reward) => isRewardUnlocked(reward, client));
}

export function getRecommendedNextReward(client?: ClubClientSnapshot | null) {
  if (!client) return null;
  const points = client.puntos_fidelidad ?? 0;
  const level = (client.nivel_fidelidad as ClubLevelKey | null) ?? getClubLevel(points).key;
  const levelIndex = LEVEL_ORDER.indexOf(level);

  return CLUB_REWARDS
    .filter((reward) => {
      const minLevelIndex = reward.levelMin ? LEVEL_ORDER.indexOf(reward.levelMin) : 0;
      return minLevelIndex <= levelIndex && (!reward.birthdayOnly || isBirthdayMonth(client.fecha_nacimiento));
    })
    .filter((reward) => reward.pointsCost > points)
    .sort((left, right) => left.pointsCost - right.pointsCost)[0] ?? null;
}

export function getActiveBenefits(client?: ClubClientSnapshot | null) {
  if (!client) return [];
  const points = client.puntos_fidelidad ?? 0;
  const level = getClubLevel(points);
  const birthdayActive = isBirthdayMonth(client.fecha_nacimiento);

  return [
    {
      key: "level_discount",
      icon: level.icon,
      title: level.descuento > 0 ? `${level.descuento}% de descuento por nivel` : "Acumula para desbloquear descuentos",
      description: level.descuento > 0 ? `Tu nivel ${level.label} ya activa descuento base en tienda.` : "Sube a Plata para activar descuentos automáticos.",
      active: level.descuento > 0,
    },
    {
      key: "birthday_multiplier",
      icon: "🎂",
      title: birthdayActive ? "Puntos extra de cumpleaños activos" : "Campaña de cumpleaños",
      description: birthdayActive ? "Este mes puedes acumular puntos dobles o triples según tu nivel." : "En tu mes de cumpleaños activas un multiplicador especial y acceso a premios temáticos.",
      active: birthdayActive,
    },
    {
      key: "referral",
      icon: "🤝",
      title: "Campaña de referidos",
      description: "Comparte tu código y gana 300 pts cuando tu referida compre por primera vez.",
      active: true,
    },
    {
      key: "priority_access",
      icon: "⚡",
      title: level.key === "oro" || level.key === "diamante" ? "Acceso anticipado activo" : "Acceso anticipado bloqueado",
      description: level.key === "oro" || level.key === "diamante" ? "Ya puedes recibir lanzamientos y promos antes que el resto del club." : "Desbloquéalo al llegar a nivel Oro.",
      active: level.key === "oro" || level.key === "diamante",
    },
  ];
}

export function getReferralCode(client?: ClubClientSnapshot | null) {
  if (!client?.id) return "";
  return `COSM-${client.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function getReferralShareMessage(client?: ClubClientSnapshot | null) {
  const name = client?.nombre_completo?.split(" ")[0] || "yo";
  const code = getReferralCode(client);
  return `Hola. Te comparto mi código del Club La Cosmetikera: ${code}. Si compras por primera vez con ese código, ambas ganamos beneficios del club. Pídelo en tienda o por WhatsApp.`;
}

export function buildVoucherCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CLUB-${random}`;
}

export function buildRewardCanjeDescription(reward: ClubReward, code: string) {
  return `[club_reward=${reward.key};club_code=${code}] ${reward.title} · ${reward.description}`;
}

export function parseRewardCanjeDescription(description?: string | null) {
  if (!description) return null;
  const match = description.match(/\[club_reward=([^;\]]+);club_code=([^\]]+)\]/i);
  if (!match?.[1] || !match?.[2]) return null;
  return {
    rewardKey: match[1],
    code: match[2].toUpperCase(),
    cleanDescription: description.replace(match[0], "").trim(),
  };
}

export function getRewardByKey(key?: string | null) {
  return CLUB_REWARDS.find((reward) => reward.key === key) ?? null;
}