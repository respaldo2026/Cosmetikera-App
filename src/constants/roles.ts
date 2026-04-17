// Centralized roles and permissions definitions

export interface RoleDefinition {
  label: string;
  color: string;
  nivel: number;
  descripcion: string;
}

export const ROLES: Record<string, RoleDefinition> = {
  administrador: { label: "👔 Administrador", color: "blue", nivel: 4, descripcion: "Gestión completa del negocio" },
  marketing:     { label: "📣 Marketing",     color: "purple", nivel: 3, descripcion: "Gestión de contenido y campañas" },
  vendedor:      { label: "🛒 Vendedor",      color: "cyan", nivel: 2, descripcion: "Ventas y atención al cliente" },
  cliente:       { label: "🛍️ Cliente",       color: "default", nivel: 1, descripcion: "Cliente de la tienda" },
};

export type RoleKey = keyof typeof ROLES;
