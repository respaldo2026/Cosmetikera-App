// Servicio de matrículas: lógica de negocio para inscripciones y cursos de estudiantes
import { supabaseBrowserClient } from "@utils/supabase/client";

export async function obtenerCursosDeEstudiante(estudianteId: string) {
  const { data, error } = await supabaseBrowserClient
    .from("matriculas")
    .select("id, cursos(nombre, precio_mensualidad)")
    .eq("estudiante_id", estudianteId);
  if (error) throw error;
  return data || [];
}
