// Centralized roles and permissions definitions

export interface RoleDefinition {
  label: string;
  color: string;
  nivel: number;
  descripcion: string;
}

export const ROLES: Record<string, RoleDefinition> = {
  admin: { label: "👔 Administrador", color: "blue", nivel: 5, descripcion: "Gestión administrativa y financiera" },
  director: { label: "🏆 Director", color: "gold", nivel: 6, descripcion: "Propietario del negocio" },
  secretaria: { label: "🗂️ Secretaría", color: "purple", nivel: 4, descripcion: "Soporte operativo y atención" },
  asesor: { label: "📞 Asesor", color: "cyan", nivel: 3, descripcion: "Marketing y ventas" },
  profesor: { label: "🧾 Operativo", color: "green", nivel: 2, descripcion: "Equipo operativo heredado" },
  estudiante: { label: "🛍️ Cliente", color: "default", nivel: 1, descripcion: "Cliente heredado" },
};

export type RoleKey = keyof typeof ROLES;
