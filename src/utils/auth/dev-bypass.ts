import type { CurrentUser } from "@/hooks/useCurrentUser";

export const isDevAuthBypassEnabled = process.env.NODE_ENV !== "production";

export const devAuthUser: CurrentUser = {
  id: "dev-admin",
  email: "admin@gmail.com",
  rol: "admin",
  nombre_completo: "Administrador",
};