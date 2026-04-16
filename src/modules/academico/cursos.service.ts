// Servicio de cursos: lógica de negocio para cursos, inscripciones y gestión académica
import { supabaseBrowserClient } from "@utils/supabase/client";

export interface GrupoAcademico {
  id: number;
  nombre: string | null;
  estado: string | null;
  descripcion?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  dias_semana?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  cupos?: number | null;
  programa_id?: number | null;
  profesor_id?: string | null;
  programas?: {
    id: number;
    nombre: string | null;
  } | null;
  profesor?: {
    id: string;
    nombre_completo: string | null;
  } | null;
  matriculas?: Array<{ count: number }>;
}

export async function crearCurso(curso: {
  nombre: string;
  descripcion: string;
  fecha_inicio: string;
  cupos: number;
}) {
  // Validaciones de negocio aquí
  const { error } = await supabaseBrowserClient.from("cursos").insert(curso);
  if (error) throw error;
  return true;
}

export async function obtenerCursos(): Promise<GrupoAcademico[]> {
  const { data, error } = await supabaseBrowserClient
    .from("cursos")
    .select(
      `
        id,
        nombre,
        estado,
        descripcion,
        fecha_inicio,
        fecha_fin,
        dias_semana,
        hora_inicio,
        hora_fin,
        cupos,
        programa_id,
        profesor_id,
        programas:programa_id ( id, nombre ),
        profesor:profesor_id ( id, nombre_completo ),
        matriculas:matriculas ( count )
      `
    )
    .order("estado", { ascending: true })
    .order("fecha_inicio", { ascending: true, nullsFirst: true })
    .order("hora_inicio", { ascending: true, nullsFirst: true });

  if (error) throw error;
  const normalizados = (data ?? []).map((item: any) => ({
    ...item,
    programas: Array.isArray(item.programas) ? item.programas[0] ?? null : item.programas,
    profesor: Array.isArray(item.profesor) ? item.profesor[0] ?? null : item.profesor,
    matriculas: Array.isArray(item.matriculas)
      ? item.matriculas
      : item.matriculas
        ? [item.matriculas]
        : [],
  }));

  return normalizados as GrupoAcademico[];
}

// ...más funciones de negocio para cursos, inscripciones, etc.
