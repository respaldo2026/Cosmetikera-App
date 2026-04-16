// Centralized roles and permissions definitions

export interface RoleDefinition {
  label: string;
  color: string;
  nivel: number;
  descripcion: string;
}

export const ROLES: Record<string, RoleDefinition> = {
  admin: { label: "👔 Administrador", color: "blue", nivel: 5, descripcion: "Gestión administrativa y financiera" },
  director: { label: "🏆 Director", color: "gold", nivel: 6, descripcion: "Propietario de la academia" },
  secretaria: { label: "🗂️ Secretaría", color: "purple", nivel: 4, descripcion: "Soporte académico y atención" },
  asesor: { label: "📞 Asesor", color: "cyan", nivel: 3, descripcion: "Gestión de leads y ventas" },
  profesor: { label: "🎓 Profesor", color: "green", nivel: 2, descripcion: "Docente" },
  estudiante: { label: "👨‍🎓 Estudiante", color: "default", nivel: 1, descripcion: "Aprendiz" },
};

export type RoleKey = keyof typeof ROLES;
