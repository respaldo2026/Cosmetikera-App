import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Proveedor de Autenticación para el Lado del Servidor
 * Este archivo se usa en Server Components y Middleware para validar acceso rápido.
 */
export const authProviderServer: any = {
  check: async () => {
    const cookieStore = await cookies();

    // Creamos el cliente de servidor para gestionar las cookies de sesión
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Verificar si hay una sesión activa
    const { data: { session } } = await supabase.auth.getSession();
    
    // Si no hay sesión, redirigir a login
    if (!session) {
      return {
        authenticated: false,
        redirectTo: "/login",
      };
    }

    // Si hay sesión, usuario está autenticado
    return {
      authenticated: true,
    };
  },

  // Estas funciones suelen ser dummies en el servidor ya que el cliente las maneja
  login: async () => ({ success: true }),
  logout: async () => ({ success: true }),
  getPermissions: async () => null,
  getIdentity: async () => null,
  onError: async (error: any) => ({ error }),
};