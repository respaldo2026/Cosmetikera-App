// Servicio de usuarios: lógica de negocio para gestión de usuarios, roles y perfiles
import { supabaseBrowserClient } from "@utils/supabase/client";

export async function crearUsuario(usuario: {
  nombre_completo: string;
  email: string;
  rol: string;
}) {
  // Validaciones de negocio aquí
  // ...
  const { error } = await supabaseBrowserClient
    .from("perfiles")
    .insert(usuario);
  if (error) throw error;
  return true;
}

export async function obtenerUsuariosPorRol(rol: string) {
  const { data, error } = await supabaseBrowserClient
    .from("perfiles")
    .select("*")
    .eq("rol", rol)
    .eq("activo", true);
  if (error) throw error;
  return data;
}

// ...más funciones de negocio para usuarios, roles, perfiles, etc.
