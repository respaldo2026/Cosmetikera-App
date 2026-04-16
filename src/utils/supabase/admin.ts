import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Faltan variables de entorno de Supabase");
}

/**
 * Cliente Supabase con Service Role Key
 * Bypasea todas las políticas RLS
 * Solo usar en endpoints API del servidor
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Helper genérico para insertar con bypass RLS
 */
export async function insertWithAdmin<T = any>(
  table: string,
  data: any
): Promise<{ data: T | null; error: any }> {
  const { data: result, error } = await supabaseAdmin
    .from(table)
    .insert(data)
    .select()
    .single();
  
  return { data: result, error };
}

/**
 * Helper genérico para actualizar con bypass RLS
 */
export async function updateWithAdmin<T = any>(
  table: string,
  data: any,
  match: Record<string, any>
): Promise<{ data: T[] | null; error: any }> {
  let query = supabaseAdmin.from(table).update(data);
  
  // Agregar condiciones where
  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  
  const { data: result, error } = await query.select();
  
  return { data: result, error };
}

/**
 * Helper genérico para eliminar con bypass RLS
 */
export async function deleteWithAdmin(
  table: string,
  match: Record<string, any>
): Promise<{ error: any }> {
  let query = supabaseAdmin.from(table).delete();
  
  // Agregar condiciones where
  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  
  const { error } = await query;
  
  return { error };
}
