import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@utils/supabase/client";

export interface CurrentUser {
  id: string;
  email?: string;
  rol?: string;
  nombre_completo?: string;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutHandle = setTimeout(() => resolve(fallbackValue), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/**
 * Hook para obtener el usuario actual y su información de rol
 * Optimizado para evitar llamadas duplicadas
 */
export function useCurrentUser() {
  const queryClient = useQueryClient();
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["current-user"],
    queryFn: async (): Promise<CurrentUser | null> => {
      console.log('[useCurrentUser] Iniciando query...');
      
      try {
        const { data: { session }, error: sessionError } = await supabaseBrowserClient.auth.getSession();
        if (sessionError) {
          console.warn('[useCurrentUser] Error de sesión (fallback a null):', sessionError);
          return null;
        }

        const authUser = session?.user ?? null;
        
        if (!authUser) {
          console.log('[useCurrentUser] No hay usuario autenticado');
          return null;
        }

        console.log('[useCurrentUser] Usuario auth encontrado:', authUser.id);

        const perfilResult = await withTimeout(
          Promise.resolve(
            supabaseBrowserClient
              .from("perfiles")
              .select("id, email, rol, nombre_completo")
              .eq("id", authUser.id)
              .maybeSingle()
          ),
          8000,
          {
            data: null,
            error: new Error("timeout perfil") as any,
            count: null,
            status: 408,
            statusText: "Request Timeout",
          } as any
        );

        const { data: perfil, error } = perfilResult as { data: any; error: any };

        if (error || !perfil) {
          console.warn('[useCurrentUser] No se encontró perfil, usando datos de auth');
          return { id: authUser.id, email: authUser.email, rol: undefined };
        }

        console.log('[useCurrentUser] Perfil cargado:', perfil.rol);
        
        return {
          id: perfil.id,
          email: perfil.email || authUser.email,
          rol: perfil.rol || authUser.role || undefined,
          nombre_completo: perfil.nombre_completo,
        };
      } catch (err) {
        console.error('[useCurrentUser] Error en queryFn (fallback seguro):', err);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 0,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const { data: authListener } = supabaseBrowserClient.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabaseBrowserClient
      .channel(`perfil-rol-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "perfiles", filter: `id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["current-user"] });
        }
      )
      .subscribe();

    return () => {
      supabaseBrowserClient.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  // Memorizamos el resultado para evitar re-renders innecesarios
  const result = useMemo(() => {
    console.log('[useCurrentUser] Estado actual:', { user: user?.id, loading: isLoading, error });
    return {
      user: user ?? null,
      loading: isLoading,
      error
    };
  }, [user, isLoading, error]);

  return result;
}
