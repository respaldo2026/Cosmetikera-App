// Servicio de profesores: lógica de negocio para dashboard, cursos y métricas
import { supabaseBrowserClient } from "@utils/supabase/client";
import { fetchProfessorDashboardData } from "@hooks/useProfessorDashboard";

export async function obtenerDashboardProfesor(profesorId: string) {
  try {
    const [dashboard, perfilResult] = await Promise.all([
      fetchProfessorDashboardData(profesorId),
      supabaseBrowserClient
        .from("perfiles")
        .select("id, nombre_completo, email, telefono, identificacion, created_at, activo")
        .eq("id", profesorId)
        .maybeSingle(),
    ]);

    if (perfilResult.error) {
      console.error("Error obteniendo perfil del profesor", perfilResult.error);
    }

    const perfil = perfilResult.error ? undefined : perfilResult.data;
    const profesorNombre = perfil?.nombre_completo || perfil?.email || undefined;

    return {
      loading: false,
      profesorNombre,
      perfil,
      ...dashboard,
    };
  } catch (error) {
    console.error("Error general obteniendo dashboard del profesor", error);
    return {
      loading: false,
      profesorNombre: undefined,
      perfil: undefined,
      stats: {
        cursosActivos: 0,
        totalEstudiantes: 0,
        horasMes: 0,
        porcentajeAsistencia: 0,
        promedioCalificaciones: 0,
        pendientesPorCalificar: 0,
        asistenciaChart: [],
        calificacionesChart: [],
        topCursos: [],
        horasQuincena: 0,
        proyeccionQuincena: 0,
        tarifaHora: null,
        totalPagadoMes: 0,
      },
      cursos: [],
      proximasSesiones: [],
      pendientes: [],
      pagos: [],
    };
  }
}
