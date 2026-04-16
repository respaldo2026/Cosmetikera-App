// Centralized color constants for roles, UI, and status

export const ROLE_COLORS: Record<string, string> = {
  director: "gold",
  administrador: "blue",
  asesor: "cyan",
  profesor: "green",
  estudiante: "default",
};

export const STATUS_COLORS: Record<string, string> = {
  pagado: "green",
  pendiente: "orange",
  vencido: "red",
  cancelado: "red",
  default: "blue",
};

export const UI_COLORS = {
  primary: "#5B21B6",
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
  info: "#0284C7",
  textBase: "#1F2937",
  bgBase: "#FFFFFF",
};
