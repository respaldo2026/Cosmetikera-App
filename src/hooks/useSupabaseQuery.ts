import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@utils/supabase/client";

// Hook genérico para consultas de Supabase con caché automático
export function useSupabaseQuery<T>(
  queryKey: string[],
  tableName: string,
  options?: {
    select?: string;
    eq?: { column: string; value: any }[];
    order?: { column: string; ascending?: boolean };
    limit?: number;
  }
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabaseBrowserClient.from(tableName).select(options?.select || "*");

      // Aplicar filtros
      if (options?.eq) {
        options.eq.forEach(({ column, value }) => {
          query = query.eq(column, value);
        });
      }

      // Ordenamiento
      if (options?.order) {
        query = query.order(options.order.column, {
          ascending: options.order.ascending ?? false,
        });
      }

      // Límite
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as T;
    },
  });
}

// Hook para contar registros (también con caché)
export function useSupabaseCount(
  queryKey: string[],
  tableName: string,
  options?: {
    eq?: { column: string; value: any }[];
  }
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabaseBrowserClient
        .from(tableName)
        .select("*", { count: "exact", head: true });

      if (options?.eq) {
        options.eq.forEach(({ column, value }) => {
          query = query.eq(column, value);
        });
      }

      const { count, error } = await query;

      if (error) throw error;
      return count || 0;
    },
  });
}

// Hook para invalidar caché después de mutaciones
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateTable: (tableName: string) => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries();
    },
  };
}
