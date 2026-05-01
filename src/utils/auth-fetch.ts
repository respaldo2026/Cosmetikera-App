/**
 * Helper para adjuntar el token de sesión de Supabase como header Authorization
 * a cualquier fetch que necesite autenticación server-side (API routes con requireAdmin).
 */
import { supabaseBrowserClient } from "@utils/supabase/client";

/** Devuelve el access_token de la sesión activa, o null si no hay sesión. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabaseBrowserClient.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Construye headers con Authorization Bearer si hay sesión activa. */
export async function authHeaders(extra?: Record<string, string>): Promise<HeadersInit> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
