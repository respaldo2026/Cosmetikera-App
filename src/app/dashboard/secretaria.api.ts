import { supabaseBrowserClient } from "@utils/supabase/client";

export async function getProgramasResumen() {
  const { data, error } = await supabaseBrowserClient
    .from("programas")
    .select(
      "id, nombre, descripcion, contenido, duracion, precio_inscripcion, precio_mensualidad, total_clases"
    )
    .eq("activo", true)
    .order("nombre", { ascending: true });

  return { data, error };
}

export async function getCursosSecretaria() {
  const { data, error } = await supabaseBrowserClient
    .from("cursos")
    .select(`
      id,
      nombre,
      estado,
      fecha_inicio,
      fecha_fin,
      dias_semana,
      hora_inicio,
      hora_fin,
      cupos,
      programa_id,
      programas:programa_id ( id, nombre ),
      matriculas:matriculas ( count )
    `)
    .in("estado", ["activo", "proximo"])
    .order("fecha_inicio", { ascending: true, nullsFirst: true });

  return { data, error };
}

export async function getPagosPendientes() {
  try {
    const { data, error } = await supabaseBrowserClient
      .from("pagos")
      .select(`
        id,
        monto,
        fecha_vencimiento,
        referencia,
        estado,
        numero_cuota,
        periodo_pagado,
        matricula_id,
        estudiante_id
      `)
      .in("estado", ["pendiente", "vencido"])
      .order("fecha_vencimiento", { ascending: true, nullsFirst: true });

    if (error) {
      console.error("Error en getPagosPendientes:", error);
      return { data: [], error };
    }

    // Obtener datos relacionados de forma separada para evitar problemas con RLS
    if (data && data.length > 0) {
      const estudianteIds = [...new Set(data.map(p => p.estudiante_id).filter(Boolean))];
      const matriculaIds = [...new Set(data.map(p => p.matricula_id).filter(Boolean))];

      let estudiantesMap: Record<string, any> = {};
      let matriculasMap: Record<string, any> = {};

      // Cargar estudiantes
      if (estudianteIds.length > 0) {
        const { data: estudiantes } = await supabaseBrowserClient
          .from("perfiles")
          .select("id, nombre_completo")
          .in("id", estudianteIds);

        if (estudiantes) {
          estudiantes.forEach(e => {
            estudiantesMap[e.id] = e;
          });
        }
      }

      // Cargar matrículas
      if (matriculaIds.length > 0) {
        const { data: matriculas } = await supabaseBrowserClient
          .from("matriculas")
          .select("id, cursos ( nombre )")
          .in("id", matriculaIds);

        if (matriculas) {
          matriculas.forEach(m => {
            matriculasMap[m.id] = m;
          });
        }
      }

      // Enriquecer datos de pagos con relaciones
      const enrichedData = data.map(pago => ({
        ...pago,
        perfiles: estudiantesMap[pago.estudiante_id] || null,
        matriculas: matriculasMap[pago.matricula_id] || null,
      }));

      return { data: enrichedData, error: null };
    }

    return { data, error };
  } catch (err) {
    console.error("Exception en getPagosPendientes:", err);
    return { data: [], error: err };
  }
}

export async function getLeadsPendientes(limit = 6) {
  const { data, error } = await supabaseBrowserClient
    .from("leads")
    .select("id, nombre, telefono, email, interes, estado, created_at, canal")
    .in("estado", ["nuevo", "contactado", "en_seguimiento"])
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data, error };
}

export async function getEstudiantesActivos() {
  const { data, error } = await supabaseBrowserClient
    .from("perfiles")
    .select("id, nombre_completo")
    .eq("rol", "estudiante")
    .eq("activo", true)
    .order("nombre_completo", { ascending: true });

  return { data, error };
}
