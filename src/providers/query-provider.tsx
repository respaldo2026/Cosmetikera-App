"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Caché por 5 minutos
            staleTime: 5 * 60 * 1000,
            // Mantener datos en caché por 10 minutos
            gcTime: 10 * 60 * 1000,
            // Reintentar una vez en caso de error
            retry: 1,
            // No refetch automático al volver a la ventana
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
