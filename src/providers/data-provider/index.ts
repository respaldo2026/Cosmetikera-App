"use client";

import { dataProvider as dataProviderSupabase } from "@refinedev/supabase";
import { supabaseBrowserClient } from "@utils/supabase/client";
import type { DataProvider, UpdateParams, UpdateResponse, BaseRecord } from "@refinedev/core";

const supabaseDataProvider = dataProviderSupabase(supabaseBrowserClient);

export const dataProvider: DataProvider = {
  ...supabaseDataProvider,
  
  update: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({ resource, id, variables, meta }: UpdateParams<TVariables>): Promise<UpdateResponse<TData>> => {
    console.log("🔵 [DATA PROVIDER] UPDATE INICIADO");
    console.log("  📌 Resource:", resource);
    console.log("  📌 ID:", id);
    console.log("  📌 Variables (datos a guardar):", JSON.stringify(variables, null, 2));
    console.log("  📌 Meta:", meta);
    console.log("  📌 Timestamp:", new Date().toISOString());
    
    if (!id) {
      console.error("❌ [DATA PROVIDER] ERROR: NO HAY ID!");
      throw new Error("No hay ID para actualizar");
    }
    
    if (!variables || Object.keys(variables).length === 0) {
      console.error("❌ [DATA PROVIDER] ERROR: Variables vacías!");
      throw new Error("No hay datos para actualizar");
    }
    
    try {
      console.log("🟡 [DATA PROVIDER] Refrescando sesión...");
      await supabaseBrowserClient.auth.refreshSession();
      const { data: sessionData } = await supabaseBrowserClient.auth.getSession();
      const session = sessionData?.session;
      const userId = session?.user?.id;
      const userRole = session?.user?.app_metadata?.rol;

      console.log("🟡 [DATA PROVIDER] Sesión actual:");
      console.log("  - userId:", userId);
      console.log("  - userRole:", userRole);

      if (!session) {
        throw new Error("No hay sesión activa. Cierra sesión y vuelve a entrar.");
      }

      const isAdmin = ["admin", "director", "administrativo"].includes(String(userRole));
      const isOwner = String(userId) === String(id);
      if (!isAdmin && !isOwner) {
        throw new Error("Permisos insuficientes para actualizar este perfil.");
      }

      console.log("🟡 [DATA PROVIDER] Enviando UPDATE a Supabase...");

      // Paso 1: Hacer el UPDATE sin SELECT
      const { error: updateError } = await supabaseBrowserClient
        .from(resource)
        .update(variables as any)
        .eq("id", id);

      if (updateError) {
        console.error("❌ [DATA PROVIDER] ERROR en UPDATE:", updateError);
        throw updateError;
      }

      console.log("✅ [DATA PROVIDER] UPDATE ejecutado sin errores");

      // Paso 2: Hacer un SELECT separado para obtener los datos actualizados
      console.log("🟡 [DATA PROVIDER] Obteniendo datos actualizados...");
      const { data, error: selectError } = await supabaseBrowserClient
        .from(resource)
        .select("*")
        .eq("id", id)
        .single();

      if (selectError) {
        console.error("❌ [DATA PROVIDER] ERROR en SELECT:", selectError);
        // No lanzamos error aquí porque el UPDATE ya se completó
        return { data: undefined as any };
      }

      console.log("✅ [DATA PROVIDER] DATOS OBTENIDOS");
      console.log("  📊 Datos actualizados:", data);

      return { data: data as TData };
    } catch (error: any) {
      console.error("❌ [DATA PROVIDER] UPDATE FALLÓ");
      console.error("  💥 Error message:", error?.message);
      console.error("  💥 Error code:", error?.code);
      console.error("  💥 Error completo:", error);
      throw error;
    }
  },
};
