"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { ROLES } from "@/constants/roles";

export interface RolePermissions {
  rol: string;
  permisos: Record<string, boolean>;
}

interface RolesPermissionsContextType {
  permisos: Record<string, Record<string, boolean>>;
  loading: boolean;
  guardarPermisos: (rol: string, nuevoPermisos: Record<string, boolean>) => Promise<{ success: boolean; error?: string }>;
  tienePermiso: (rol: string | undefined, modulo: string) => boolean;
  recargar: () => Promise<void>;
}

const RolesPermissionsContext = createContext<RolesPermissionsContextType | undefined>(undefined);

export const RolesPermissionsProvider = ({ children }: { children: ReactNode }) => {
  const [permisos, setPermisos] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabaseBrowserClient
        .from("role_permissions")
        .select("rol, permisos");

      if (data) {
        const permisosMap: Record<string, Record<string, boolean>> = {};
        data.forEach((row: { rol: string; permisos: Record<string, boolean> | null }) => {
          const normalizedRole = (row.rol === "administrativo" ? "admin" : row.rol).toLowerCase();
          permisosMap[normalizedRole] = row.permisos ?? {};
        });

        const completos = Object.keys(ROLES).reduce<Record<string, Record<string, boolean>>>((acc, rol) => {
          acc[rol] = permisosMap[rol] ?? {};
          return acc;
        }, {});

        setPermisos(completos);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const guardarPermisos = async (rol: string, nuevoPermisos: Record<string, boolean>) => {
    try {
      const { error } = await supabaseBrowserClient
        .from("role_permissions")
        .upsert(
          { rol, permisos: nuevoPermisos },
          { onConflict: "rol" }
        );
      if (error) throw error;
      const normalized = rol.toLowerCase();
      setPermisos((prev) => ({ ...prev, [normalized]: nuevoPermisos }));
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  };

  const tienePermiso = (rol: string | undefined, modulo: string): boolean => {
    if (!rol) return false;
    const normalized = rol.toLowerCase();
    const permsRol = permisos[normalized];
    if (!permsRol) return false;
    return permsRol[modulo] ?? false;
  };

  return (
    <RolesPermissionsContext.Provider value={{ permisos, loading, guardarPermisos, tienePermiso, recargar }}>
      {children}
    </RolesPermissionsContext.Provider>
  );
};

export const useRolesPermissions = () => {
  const ctx = useContext(RolesPermissionsContext);
  if (!ctx) throw new Error("useRolesPermissions debe usarse dentro de RolesPermissionsProvider");
  return ctx;
};
