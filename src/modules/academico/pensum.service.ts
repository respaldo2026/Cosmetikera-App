// Servicio de pensum y materiales: lógica de negocio para planes de estudio y recursos
import { supabaseBrowserClient } from "@utils/supabase/client";

export async function obtenerPensumPorProgramas(programaIds: string[]) {
  const { data, error } = await supabaseBrowserClient
    .from("pensum")
    .select("*, pensum_cursos (*)")
    .in("programa_id", programaIds)
    .eq("activo", true)
    .order("numero_ciclo", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function obtenerMaterialesPorProgramas(programaIds: string[]) {
  const { data, error } = await supabaseBrowserClient
    .from("material_didactico")
    .select("*")
    .in("programa_id", programaIds)
    .or("visible.is.null,visible.eq.true")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function obtenerMaterialesCicloPorProgramas(programaIds: string[]) {
  const { data, error } = await supabaseBrowserClient
    .from("materiales_ciclo")
    .select("*")
    .in("programa_id", programaIds)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function obtenerMaterialesClasePorProgramas(programaIds: string[]) {
  const { data, error } = await supabaseBrowserClient
    .from("materiales_clase")
    .select(`
      *,
      materiales_ciclo: material_ciclo_id (id, nombre, cantidad, incluido_kit),
      pensum_cursos: pensum_curso_id (id, nombre_curso, orden),
      pensum: pensum_id (id, nombre_ciclo, numero_ciclo)
    `)
    .in("programa_id", programaIds)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
