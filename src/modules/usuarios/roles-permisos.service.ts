// Servicio modular para roles y permisos
import { supabaseBrowserClient } from "@utils/supabase/client";
import type { components } from "@/types/supabase";

type PermisosPayload = NonNullable<components["schemas"]["role_permissions"]["permisos"]> extends Record<string, unknown>
  ? Record<string, unknown>
  : Record<string, unknown>;

type PermisosCache = Record<string, PermisosPayload>;

declare global {
  // eslint-disable-next-line no-var -- declared intentionally on globalThis
  var __permisosCache: PermisosCache | undefined;
}

const ensureCache = (): PermisosCache => {
  if (!globalThis.__permisosCache) {
    globalThis.__permisosCache = {};
  }

  return globalThis.__permisosCache;
};

export const obtenerPermisosPorRol = async (rol: string): Promise<PermisosPayload> => {
  const cache = ensureCache();

  if (cache[rol]) {
    return cache[rol];
  }

  const { data, error } = await supabaseBrowserClient
    .from("role_permissions")
    .select("permisos")
    .eq("rol", rol)
    .maybeSingle<{ permisos: PermisosPayload }>();

  if (error) {
    throw error;
  }

  const permisos = data?.permisos ?? {};
  cache[rol] = permisos;

  return permisos;
};

export const actualizarPermisosPorRol = async (
  rol: string,
  nuevoPermisos: PermisosPayload
): Promise<boolean> => {
  const { error } = await supabaseBrowserClient
    .from("role_permissions")
    .upsert({ rol, permisos: nuevoPermisos }, { onConflict: "rol" });

  if (error) {
    throw error;
  }

  const cache = ensureCache();
  cache[rol] = nuevoPermisos;

  return true;
};

export {}; // Garantiza que este archivo se trate como módulo
