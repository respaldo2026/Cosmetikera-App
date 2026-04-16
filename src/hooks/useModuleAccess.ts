import { useCallback, useEffect, useState } from "react";
import { useRolesPermissions } from "@contexts/roles-permissions-context";
import { useCurrentUser } from "./useCurrentUser";

const MODULOS_DISPONIBLES = [
  "cursos",
  "estudiantes",
  "matriculas",
  "asistencias",
  "profesores",
  "tesoreria",
  "nomina",
  "perfiles",
  "leads",
  "inventario",
  "planificador",
  "portal-estudiante",
] as const;

/**
 * Hook para verificar si el usuario actual tiene acceso a un módulo.
 * Se usa en el layout para filtrar el menú dinámicamente.
 */
export const useModuleAccess = () => {
  const { user } = useCurrentUser();
  const { tienePermiso, loading } = useRolesPermissions();
  const [modulosAccesibles, setModulosAccesibles] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.rol || loading) {
      return;
    }

    const accesibles = MODULOS_DISPONIBLES.filter((modulo) =>
      tienePermiso(user.rol, modulo)
    );

    setModulosAccesibles(accesibles);
  }, [loading, tienePermiso, user?.rol]);

  const tieneAcceso = useCallback(
    (modulo: string): boolean => {
      if (modulosAccesibles.length === 0 && !loading) {
        return true;
      }

      return modulosAccesibles.includes(modulo);
    },
    [loading, modulosAccesibles]
  );

  return {
    modulosAccesibles,
    tieneAcceso,
    loading,
  };
};
