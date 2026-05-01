export type ClubReglas = {
  puntos_por_mil: number;
  multiplicador_cumple_bronce: number;
  multiplicador_cumple_plata: number;
  multiplicador_cumple_oro: number;
  multiplicador_cumple_diamante: number;
  puntos_min_plata: number;
  puntos_min_oro: number;
  puntos_min_diamante: number;
  descuento_plata: number;
  descuento_oro: number;
  descuento_diamante: number;
  puntos_bienvenida: number;
  puntos_referido: number;
  puntos_max_saldo: number;
  puntos_max_ganados_mes: number;
  puntos_vigencia_dias: number;
};

export const DEFAULT_REGLAS: ClubReglas = {
  puntos_por_mil: 1,
  multiplicador_cumple_bronce: 1,
  multiplicador_cumple_plata: 2,
  multiplicador_cumple_oro: 2,
  multiplicador_cumple_diamante: 3,
  puntos_min_plata: 1000,
  puntos_min_oro: 5000,
  puntos_min_diamante: 15000,
  descuento_plata: 5,
  descuento_oro: 10,
  descuento_diamante: 15,
  puntos_bienvenida: 50,
  puntos_referido: 300,
  puntos_max_saldo: 25000,
  puntos_max_ganados_mes: 5000,
  puntos_vigencia_dias: 365,
};

export function mergeClubRules(raw: Record<string, unknown> | null | undefined): ClubReglas {
  const next: ClubReglas = { ...DEFAULT_REGLAS };
  if (!raw || typeof raw !== "object") return next;

  for (const key of Object.keys(DEFAULT_REGLAS) as Array<keyof ClubReglas>) {
    const incoming = Number(raw[key]);
    if (Number.isFinite(incoming)) {
      next[key] = incoming;
    }
  }

  return next;
}

export function getNivelDinamico(points: number, reglas: ClubReglas) {
  if (points >= reglas.puntos_min_diamante) return "diamante" as const;
  if (points >= reglas.puntos_min_oro) return "oro" as const;
  if (points >= reglas.puntos_min_plata) return "plata" as const;
  return "bronce" as const;
}

export function clampPointsToMaxSaldo(points: number, reglas: ClubReglas): number {
  const maxSaldo = Math.max(0, Math.floor(Number(reglas.puntos_max_saldo || 0)));
  if (!Number.isFinite(maxSaldo) || maxSaldo <= 0) return Math.max(0, points);
  return Math.max(0, Math.min(points, maxSaldo));
}

export function getMonthRangeUtc(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export const GAIN_TIPOS = [
  "ganados",
  "bonificacion",
  "bienvenida",
  "cumpleanos",
  "racha",
  "referido",
] as const;

export type GainTipo = (typeof GAIN_TIPOS)[number];
