"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CLUB_REWARDS,
  CLUB_LEVELS,
  type ClubReward,
  type ClubLevelKey,
  type ClubClientSnapshot,
} from "@/constants/clubRewards";
import {
  DEFAULT_REGLAS,
  mergeClubRules,
  type ClubReglas,
} from "@/utils/club-rules";

// ─── Tipos dinámicos ────────────────────────────────────────────────────────

export type DynamicClubReward = {
  id: string;
  key: string;
  icon: string;
  title: string;
  description: string;
  category: "descuento" | "producto" | "experiencia" | "cumpleanos";
  points_cost: number;
  value_cop: number;
  level_min: ClubLevelKey | null;
  birthday_only: boolean;
  featured: boolean;
  badge: string | null;
  activa: boolean;
  orden: number;
};

export type { ClubReglas };
export { DEFAULT_REGLAS };

// ─── Helpers que usan config dinámica ───────────────────────────────────────

export function getNivelDinamico(points: number, reglas: ClubReglas): ClubLevelKey {
  if (points >= reglas.puntos_min_diamante) return "diamante";
  if (points >= reglas.puntos_min_oro) return "oro";
  if (points >= reglas.puntos_min_plata) return "plata";
  return "bronce";
}

export function getMultiplicadorCumple(nivel: ClubLevelKey, reglas: ClubReglas): number {
  switch (nivel) {
    case "diamante": return reglas.multiplicador_cumple_diamante;
    case "oro":      return reglas.multiplicador_cumple_oro;
    case "plata":    return reglas.multiplicador_cumple_plata;
    default:         return reglas.multiplicador_cumple_bronce;
  }
}

export function getDescuentoNivel(nivel: ClubLevelKey, reglas: ClubReglas): number {
  switch (nivel) {
    case "diamante": return reglas.descuento_diamante;
    case "oro":      return reglas.descuento_oro;
    case "plata":    return reglas.descuento_plata;
    default:         return 0;
  }
}

export function calcularPuntosVenta(totalCop: number, reglas: ClubReglas): number {
  return Math.floor(totalCop / 1000) * reglas.puntos_por_mil;
}

export function isRewardEligibleDynamic(
  reward: DynamicClubReward,
  client: ClubClientSnapshot,
  reglas: ClubReglas,
  esCumple: boolean
): boolean {
  const points = client.puntos_fidelidad ?? 0;
  const nivel = getNivelDinamico(points, reglas);
  const LEVEL_ORDER: ClubLevelKey[] = ["bronce", "plata", "oro", "diamante"];
  const levelIndex = LEVEL_ORDER.indexOf(nivel);
  const minLevelIndex = reward.level_min ? LEVEL_ORDER.indexOf(reward.level_min) : 0;
  if (levelIndex < minLevelIndex) return false;
  if (reward.birthday_only && !esCumple) return false;
  return points >= reward.points_cost;
}

// Convierte DynamicClubReward → ClubReward (para compatibilidad con funciones existentes)
export function toClubReward(r: DynamicClubReward): ClubReward {
  return {
    key: r.key,
    icon: r.icon,
    title: r.title,
    description: r.description,
    category: r.category,
    pointsCost: r.points_cost,
    valueCop: r.value_cop,
    levelMin: r.level_min ?? undefined,
    birthdayOnly: r.birthday_only,
    featured: r.featured,
    badge: r.badge ?? undefined,
  };
}

// ─── Hook principal ─────────────────────────────────────────────────────────

let _cache: { recompensas: DynamicClubReward[]; reglas: ClubReglas } | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export function useClubConfig() {
  const [recompensas, setRecompensas] = useState<DynamicClubReward[]>([]);
  const [reglas, setReglas] = useState<ClubReglas>(DEFAULT_REGLAS);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async (force = false) => {
    if (!force && _cache && Date.now() - _cacheTime < CACHE_TTL) {
      setRecompensas(_cache.recompensas);
      setReglas(_cache.reglas);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/configuracion/club");
      if (!res.ok) throw new Error("config unavailable");
      const json = await res.json();

      const r: DynamicClubReward[] = json.recompensas?.length
        ? json.recompensas
        : CLUB_REWARDS.map((rew, i) => ({
            id: rew.key,
            key: rew.key,
            icon: rew.icon,
            title: rew.title,
            description: rew.description,
            category: rew.category,
            points_cost: rew.pointsCost,
            value_cop: rew.valueCop,
            level_min: rew.levelMin ?? null,
            birthday_only: rew.birthdayOnly ?? false,
            featured: rew.featured ?? false,
            badge: rew.badge ?? null,
            activa: true,
            orden: i,
          }));

      const rg: ClubReglas = mergeClubRules(json.reglas ?? {});

      _cache = { recompensas: r, reglas: rg };
      _cacheTime = Date.now();
      setRecompensas(r);
      setReglas(rg);
    } catch {
      // Fallback a hardcoded
      setRecompensas(
        CLUB_REWARDS.map((rew, i) => ({
          id: rew.key, key: rew.key, icon: rew.icon, title: rew.title,
          description: rew.description, category: rew.category,
          points_cost: rew.pointsCost, value_cop: rew.valueCop,
          level_min: rew.levelMin ?? null, birthday_only: rew.birthdayOnly ?? false,
          featured: rew.featured ?? false, badge: rew.badge ?? null,
          activa: true, orden: i,
        }))
      );
      setReglas(DEFAULT_REGLAS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return {
    recompensas: recompensas.filter(r => r.activa),
    recompensasTodas: recompensas,
    reglas,
    loading,
    recargar: () => cargar(true),
  };
}

/** Invalida el caché global (llamar tras guardar cambios en el admin) */
export function invalidateClubConfigCache() {
  _cache = null;
  _cacheTime = 0;
}
