import type { CurrentUser } from "@/hooks/useCurrentUser";

export const isDevAuthBypassEnabled =
  process.env.NODE_ENV !== "production"
  && (process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS === "true"
    || process.env.ENABLE_DEV_AUTH_BYPASS === "true");

export const devAuthUser: CurrentUser = {
  id: "dev-admin",
  email: "admin@gmail.com",
  rol: "admin",
  nombre_completo: "Administrador",
};