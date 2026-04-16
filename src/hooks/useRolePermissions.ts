import { useRolesPermissions } from "@contexts/roles-permissions-context";
import { MODULES } from "@/constants/modules";
import { ROLES, type RoleKey, type RoleDefinition } from "@/constants/roles";

export type { RoleKey, RoleDefinition };

export interface ModuleDefinition {
  key: string;
  label: string;
}

export const MODULOS_DISPONIBLES: ModuleDefinition[] = MODULES;
export const ROLES_DISPONIBLES: Record<RoleKey, RoleDefinition> = ROLES;

export const useRolePermissions = () => useRolesPermissions();


