// Servicio de asistencias y pagos: lógica de negocio para estadísticas de matrículas
import { supabaseBrowserClient } from "@utils/supabase/client";

export async function obtenerStatsAsistenciasYPagos(matriculaIds: string[], cursosPorMatricula: Record<string, any>) {
  const { data: asistencias } = await supabaseBrowserClient
    .from("asistencias")
    .select("matricula_id, estado")
    .in("matricula_id", matriculaIds);

  const { data: pagos } = await supabaseBrowserClient
    .from("pagos")
    .select("matricula_id, monto")
    .in("matricula_id", matriculaIds);

  const statsMap: Record<string, any> = {};
  matriculaIds.forEach((id) => {
    const asistenciasAlumno = asistencias?.filter(a => a.matricula_id === id) || [];
    const totalClases = asistenciasAlumno.length;
    const presentes = asistenciasAlumno.filter(a => a.estado === 'presente').length;
    const porcentaje = totalClases > 0 ? (presentes / totalClases) * 100 : 0;
    const minimoRequerido = cursosPorMatricula[id]?.porcentaje_minimo || 80;

    const pagosMatricula = pagos?.filter(p => p.matricula_id === id) || [];
    const pagosCount = pagosMatricula.length;
    const pagosTotal = pagosMatricula.reduce((acc, curr) => acc + Number(curr.monto || 0), 0);

    statsMap[id] = {
      totalClases,
      presentes,
      porcentaje: Math.round(porcentaje),
      minimoRequerido,
      cumple: porcentaje >= minimoRequerido,
      tieneDatos: totalClases > 0,
      pagosCount,
      pagosTotal
    };
  });
  return statsMap;
}
